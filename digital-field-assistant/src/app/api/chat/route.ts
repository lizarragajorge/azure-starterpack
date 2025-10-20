import { NextRequest, NextResponse } from "next/server";
import {
  AzureChatMessage,
  completeChatWithAiFoundry,
  isVerboseLoggingEnabled,
} from "@/lib/aiFoundry";

type ChatRequest = {
  messages?: Array<{
    role?: AzureChatMessage["role"];
    content?: string;
  }>;
};

export async function POST(request: NextRequest) {
  const verbose = isVerboseLoggingEnabled();
  const requestId = createRequestId();
  const logPrefix = `[api/chat][${requestId}]`;
  let payload: ChatRequest;

  try {
    payload = (await request.json()) as ChatRequest;
  } catch (error) {
    if (verbose) {
      console.error(`${logPrefix} Failed to parse JSON`, error);
    }
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  if (!payload.messages?.length) {
    if (verbose) {
      console.warn(`${logPrefix} Request missing messages array`);
    }
    return NextResponse.json(
      { error: "Missing chat messages" },
      { status: 400 },
    );
  }

  const sanitizedMessages: AzureChatMessage[] = payload.messages.map((message) => ({
    role: message.role ?? "user",
    content: (message.content ?? "").slice(0, 6_000),
  }));

  const systemPrompt = process.env.AI_FOUNDRY_SYSTEM_PROMPT?.trim();
  const preparedMessages = applySystemPrompt(sanitizedMessages, systemPrompt);

  if (verbose) {
    console.log(
      `${logPrefix} Received request`,
      JSON.stringify({
        messageCount: preparedMessages.length,
        lastRole: preparedMessages.at(-1)?.role,
        lastPreview: preparedMessages.at(-1)?.content.slice(0, 120),
        systemInjected: Boolean(systemPrompt && !hasSystemRole(sanitizedMessages)),
      }),
    );
    console.time(`${logPrefix} latency`);
  }

  try {
    const result = await completeChatWithAiFoundry(preparedMessages);
    if (verbose) {
      console.log(
        `${logPrefix} Returning response`,
        JSON.stringify({
          characters: result.content.length,
          warnings: result.warnings?.length ?? 0,
        }),
      );
      console.timeEnd(`${logPrefix} latency`);
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("AI Foundry chat failure", error);
    const reason =
      error instanceof Error ? error.message : "Unknown error calling AI Foundry";
    if (verbose) {
      console.error(`${logPrefix} Upstream error`, reason);
      console.timeEnd(`${logPrefix} latency`);
    }
    return NextResponse.json({ error: reason }, { status: 502 });
  }
}

function createRequestId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

function applySystemPrompt(
  messages: AzureChatMessage[],
  systemPrompt?: string,
): AzureChatMessage[] {
  if (!systemPrompt) {
    return messages;
  }

  if (hasSystemRole(messages)) {
    return messages;
  }

  return [
    {
      role: "system",
      content: systemPrompt,
    },
    ...messages,
  ];
}

function hasSystemRole(messages: AzureChatMessage[]) {
  return messages.some((message) => message.role === "system");
}
