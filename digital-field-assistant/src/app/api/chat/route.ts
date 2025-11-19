import { NextRequest, NextResponse } from "next/server";
import { SpanKind, type Span, context, trace } from '@opentelemetry/api';
import { getTracer } from "@/lib/telemetry";
import {
  AzureChatMessage,
  completeChatWithAiFoundry,
  completeChatAuto,
  isVerboseLoggingEnabled,
} from "@/lib/aiFoundry";

type ChatRequest = {
  messages?: Array<{
    role?: AzureChatMessage["role"];
    content?: string;
  }>;
};


export async function POST(request: NextRequest) {
  const tracer = getTracer();
  const activeSpan = trace.getSpan(context.active());
  return tracer.startActiveSpan(
    'api.chat.request',
    { kind: SpanKind.INTERNAL, attributes: activeSpan ? undefined : { 'http.method': 'POST', 'http.route': '/api/chat', 'http.target': '/api/chat' } },
    async (span: Span) => {
    const verbose = isVerboseLoggingEnabled();
    const requestId = createRequestId();
    const logPrefix = `[api/chat][${requestId}]`;
    span.setAttribute('chat.request.id', requestId);
    // GenAI trace correlation identifiers (thread/run scoped to this request, response populated later)
    const threadId = requestId; // Reuse request id for simplicity; could be external conversation id
    const threadRunId = createRequestId();
    span.setAttribute('gen_ai.thread.id', threadId);
    span.setAttribute('gen_ai.thread.run.id', threadRunId);
    // Provider & model metadata (adjust via env overrides if provided)
    span.setAttribute('gen_ai.provider.name', process.env.AI_FOUNDRY_PROVIDER_NAME || 'azure_openai');
    if (process.env.AI_FOUNDRY_MODEL_DEPLOYMENT)
      span.setAttribute('gen_ai.model.name', process.env.AI_FOUNDRY_MODEL_DEPLOYMENT);
    // Helper to emit GenAI child spans (instead of events) for UI visibility while retaining attributes for KQL.
    const emitGenAiSpan = (spanName: string, content: unknown, role: string, extra: Record<string, unknown> = {}) => {
      const jsonContent = JSON.stringify(content);
      tracer.startActiveSpan(spanName, { kind: SpanKind.INTERNAL }, (child: Span) => {
        child.setAttribute('event.name', spanName);
        child.setAttribute('gen_ai.event.content', jsonContent);
        child.setAttribute('gen_ai.thread.id', threadId);
        child.setAttribute('gen_ai.thread.run.id', threadRunId);
        child.setAttribute('gen_ai.role', role);
        for (const [k,v] of Object.entries(extra)) child.setAttribute(k, v as any);
        child.end();
      });
      // Also emit a lightweight event on the parent span for KQL paths expecting events
      span.addEvent(spanName, {
        'event.name': spanName,
        'gen_ai.event.content': jsonContent,
        'gen_ai.thread.id': threadId,
        'gen_ai.thread.run.id': threadRunId,
        ...extra,
      });
    };
      span.addEvent('chat.request.start', { requestId });

    let payload: ChatRequest;
    try {
      payload = (await request.json()) as ChatRequest;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: 'invalid_json' });
      if (verbose) console.error(`${logPrefix} Failed to parse JSON`, error);
      span.end();
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    if (!payload.messages?.length) {
      span.setStatus({ code: 2, message: 'missing_messages' });
      if (verbose) console.warn(`${logPrefix} Request missing messages array`);
      span.end();
      return NextResponse.json({ error: 'Missing chat messages' }, { status: 400 });
    }

    const sanitizedMessages: AzureChatMessage[] = payload.messages.map((message) => ({
      role: message.role ?? 'user',
      content: (message.content ?? '').slice(0, 6_000),
    }));
    span.setAttribute('chat.message.count', sanitizedMessages.length);

    const systemPrompt = process.env.AI_FOUNDRY_SYSTEM_PROMPT?.trim();
    const preparedMessages = applySystemPrompt(sanitizedMessages, systemPrompt);
    span.setAttribute('chat.system.injected', Boolean(systemPrompt && !hasSystemRole(sanitizedMessages)));
    if (systemPrompt) {
      // Attribute for KQL filter
      span.setAttribute('gen_ai.system', systemPrompt);
    }

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
  // Auto-dispatch: if AI_FOUNDRY_AGENT_ID is defined we invoke the agent endpoint, else legacy chat deployment.
  const result = await completeChatAuto(preparedMessages);
      // Emit per-message child spans (system + user messages) BEFORE assistant completion
      try {
        for (const [index, m] of preparedMessages.entries()) {
          const role = m.role || 'user';
          emitGenAiSpan(`gen_ai.${role}.message`, {
            type: 'message',
            index,
            role,
            content: [{ type: 'text', value: m.content }],
          }, role, { 'gen_ai.message.index': index });
        }
      } catch (e) {
        if (verbose) console.warn(`${logPrefix} Failed to emit prompt spans`, e);
      }
      span.setAttribute('chat.response.characters', result.content.length);
      if (result.warnings?.length) span.setAttribute('chat.response.warnings', result.warnings.length);
      // Bubble up usage metrics captured by OpenAI instrumentation so they appear on the request span too
      if (result.usage) {
        // Canonical names (prompt/completion/total) per emerging semantic conventions
  if (result.usage.prompt_tokens !== undefined) span.setAttribute('gen_ai.usage.prompt_tokens', result.usage.prompt_tokens);
  if (result.usage.completion_tokens !== undefined) span.setAttribute('gen_ai.usage.completion_tokens', result.usage.completion_tokens);
  if (result.usage.total_tokens !== undefined) span.setAttribute('gen_ai.usage.total_tokens', result.usage.total_tokens);
  // Legacy aliases
  if (result.usage.input_tokens !== undefined) span.setAttribute('gen_ai.usage.input_tokens', result.usage.input_tokens);
  if (result.usage.output_tokens !== undefined) span.setAttribute('gen_ai.usage.output_tokens', result.usage.output_tokens);
      }
      // Response identifier & assistant completion event
      const responseId = createRequestId();
      span.setAttribute('gen_ai.response.id', responseId);
      emitGenAiSpan('gen_ai.assistant.message', {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', value: result.content }],
        warnings: result.warnings,
      }, 'assistant', { 'gen_ai.response.id': responseId });
      // Optional evaluation event example (guarded by env)
      if (process.env.AI_FOUNDRY_EMIT_EVAL === '1') {
        const evaluatorName = process.env.AI_FOUNDRY_EVAL_NAME || 'safety';
        const score = Number(process.env.AI_FOUNDRY_EVAL_SCORE || '0.95');
        const evalEventName = `gen_ai.evaluation.${evaluatorName}`;
        emitGenAiSpan(evalEventName, {
          type: 'evaluation',
          evaluator: evaluatorName,
          score,
        }, 'evaluation', {
          'gen_ai.response.id': responseId,
          'gen_ai.evaluator.name': evaluatorName,
          'gen_ai.evaluation.score': score,
          'gen_ai.evaluation.id': createRequestId(),
        });
      }
      span.setAttribute('http.status_code', 200);
      if (verbose) {
        console.log(
          `${logPrefix} Returning response`,
          JSON.stringify({ characters: result.content.length, warnings: result.warnings?.length ?? 0 }),
        );
        console.timeEnd(`${logPrefix} latency`);
      }
      span.setStatus({ code: 1 }); // OK
      span.addEvent('chat.request.end', { requestId, status: 'OK' });
  span.end();
  return NextResponse.json(result);
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message });
      console.error('AI Foundry chat failure', error);
      const reason = error instanceof Error ? error.message : 'Unknown error calling AI Foundry';
      // Emit assistant message span & event with error placeholder so output column not empty in tracing UI
      emitGenAiSpan('gen_ai.assistant.message', {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', value: `[error] ${reason}` }],
        error: true,
      }, 'assistant', { 'gen_ai.error': true });
      if (verbose) {
        console.error(`${logPrefix} Upstream error`, reason);
        console.timeEnd(`${logPrefix} latency`);
      }
      // Provide HTTP error status mapping (generic 502 fallback already used)
      span.setAttribute('http.status_code', 502);
      span.addEvent('chat.request.end', { requestId, status: 'ERROR', error: reason });
      span.end();
      return NextResponse.json({ error: reason }, { status: 502 });
    }
    }
  );
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
