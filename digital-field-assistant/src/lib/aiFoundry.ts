import { AzureOpenAI } from "openai";

export type AzureChatMessage = {
	role: "system" | "user" | "assistant";
	content: string;
};

export type AzureChatResult = {
	content: string;
	warnings?: string[];
	usage?: {
		// Legacy naming (input/output) retained for backward compatibility
		input_tokens?: number;
		output_tokens?: number;
		total_tokens?: number;
		// Canonical emerging semantic convention names
		prompt_tokens?: number;
		completion_tokens?: number;
	};
};

/**
 * Calls an Azure AI Foundry Chat Completions deployment using the Azure OpenAI SDK.
 * Falls back to a canned response when configuration is missing so the demo still works locally.
 * 
 * OpenTelemetry automatic instrumentation captures all Azure OpenAI calls with GenAI semantic conventions.
 */
export async function completeChatWithAiFoundry(
	messages: AzureChatMessage[],
): Promise<AzureChatResult> {
	const verbose = isVerboseLoggingEnabled();
	const endpoint = process.env.AI_FOUNDRY_ENDPOINT;
	const apiKey = process.env.AI_FOUNDRY_API_KEY;
	const deployment =
		process.env.AI_FOUNDRY_CHAT_DEPLOYMENT ?? process.env.AI_FOUNDRY_DEPLOYMENT;
	const apiVersion = process.env.AI_FOUNDRY_API_VERSION ?? "2024-12-01-preview";

	if (!endpoint || !apiKey || !deployment) {
		if (verbose) {
			console.warn(
				"[aiFoundry] Missing configuration. Falling back to simulated response.",
			);
		}
		return {
			content:
				"WARNING: Azure AI Foundry credentials are not configured yet. Here's a simulated response so you can keep exploring the assistant.\n\n" +
				buildDemoResponse(messages),
			warnings: [
				"Set AI_FOUNDRY_ENDPOINT, AI_FOUNDRY_API_KEY, and AI_FOUNDRY_CHAT_DEPLOYMENT in .env.local to connect to your Azure project.",
			],
		};
	}

	const normalizedEndpoint = normalizeEndpoint(endpoint);

	if (verbose) {
		console.log(
			"[aiFoundry] Sending chat request",
			JSON.stringify({
				endpoint: normalizedEndpoint,
				deployment,
				messageCount: messages.length,
				apiVersion,
				temperature: process.env.AI_FOUNDRY_TEMPERATURE ?? "default",
				top_p: process.env.AI_FOUNDRY_TOP_P ?? "default",
			}),
		);
	}

	// Initialize Azure OpenAI client
	const client = new AzureOpenAI({
		endpoint: normalizedEndpoint,
		apiKey,
		deployment,
		apiVersion,
	});

	// Build request options with proper typing
	const temperature = parseOptionalNumber(process.env.AI_FOUNDRY_TEMPERATURE);
	const topP = parseOptionalNumber(process.env.AI_FOUNDRY_TOP_P);

	try {
		// Call the chat completions API
		// OpenAI instrumentation automatically captures:
		// - gen_ai.system, gen_ai.request.model, gen_ai.response.id
		// - gen_ai.usage.input_tokens, gen_ai.usage.output_tokens
		// - gen_ai.user.message, gen_ai.choice events
		const response = await client.chat.completions.create({
			messages,
			model: deployment, // Required by the SDK even though deployment is already set
			...(temperature !== undefined && { temperature }),
			...(topP !== undefined && { top_p: topP }),
		});

		const text = response.choices?.[0]?.message?.content?.trim();
		if (!text) {
			if (verbose) {
				console.error("[aiFoundry] Empty response payload", JSON.stringify(response));
			}
			throw new Error("Azure AI Foundry returned an empty response");
		}

		if (verbose) {
			console.log("[aiFoundry] Received response", {
				characters: text.length,
				preview: text.slice(0, 120),
				usage: response.usage,
			});
		}

		const usage = response.usage
			? {
				input_tokens: response.usage.prompt_tokens,
				output_tokens: response.usage.completion_tokens,
				prompt_tokens: response.usage.prompt_tokens,
				completion_tokens: response.usage.completion_tokens,
				total_tokens:
					(response.usage.prompt_tokens ?? 0) +
					(response.usage.completion_tokens ?? 0),
			  }
			: undefined;
		return { content: text, usage };
	} catch (error) {
		if (verbose) {
			console.error("[aiFoundry] Request failed", error);
		}

		const message =
			error instanceof Error
				? error.message
				: "Unknown error occurred while calling Azure AI Foundry";

		throw new Error(`Azure AI Foundry request failed: ${message}`);
	}
}

function buildDemoResponse(messages: AzureChatMessage[]) {
	const latestUserMessage = [...messages]
		.reverse()
		.find((message) => message.role === "user");

	if (!latestUserMessage) {
		return "Ask a question to see the assistant's recommendations.";
	}

	return (
		"I understand you're asking: " +
		`"${latestUserMessage.content}".` +
		"\n\nOnce the Azure AI Foundry deployment is wired up, this response will come directly from your configured model. " +
		"For now, consider drafting a follow-up action plan or requesting data from Fabric when the integration is ready."
	);
}

export function isVerboseLoggingEnabled() {
	return String(process.env.LOG_VERBOSE ?? "").toLowerCase() === "true";
}

function normalizeEndpoint(endpoint: string) {
	if (!/^https?:\/\//i.test(endpoint)) {
		return `https://${endpoint}`;
	}
	return endpoint;
}

function parseOptionalNumber(value?: string) {
	if (value === undefined || value === "") {
		return undefined;
	}

	const parsed = Number(value);
	if (Number.isNaN(parsed)) {
		console.warn(
			"[aiFoundry] Ignoring invalid numeric environment value",
			value,
		);
		return undefined;
	}
	return parsed;
}
