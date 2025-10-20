export type AzureChatMessage = {
	role: "system" | "user" | "assistant";
	content: string;
};

export type AzureChatResult = {
	content: string;
	warnings?: string[];
};

const apiVersion = process.env.AI_FOUNDRY_API_VERSION ?? "2024-05-01-preview";

/**
 * Calls an Azure AI Foundry Chat Completions deployment.
 * Falls back to a canned response when configuration is missing so the demo still works locally.
 */
export async function completeChatWithAiFoundry(
	messages: AzureChatMessage[],
): Promise<AzureChatResult> {
	const verbose = isVerboseLoggingEnabled();
	const endpoint = process.env.AI_FOUNDRY_ENDPOINT;
	const apiKey = process.env.AI_FOUNDRY_API_KEY;
	const deployment =
		process.env.AI_FOUNDRY_CHAT_DEPLOYMENT ?? process.env.AI_FOUNDRY_DEPLOYMENT;

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
	let base: string;

	try {
		const url = new URL(normalizedEndpoint);
		base = url.toString().replace(/\/$/, "");
	} catch (error) {
		if (verbose) {
			console.error("[aiFoundry] Invalid endpoint URL", {
				endpoint,
				normalizedEndpoint,
				error,
			});
		}
		throw new Error(
			"AI_FOUNDRY_ENDPOINT is not a valid URL. Include the https:// prefix.",
		);
	}

	const requestUrl = `${base}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

	if (verbose) {
		console.log(
			"[aiFoundry] Sending chat request",
			JSON.stringify({
				endpoint: base,
				deployment,
				messageCount: messages.length,
					apiVersion,
					temperature: process.env.AI_FOUNDRY_TEMPERATURE ?? "default",
					top_p: process.env.AI_FOUNDRY_TOP_P ?? "default",
			}),
		);
	}

		const requestPayload: Record<string, unknown> = {
			messages,
		};

		const temperature = parseOptionalNumber(process.env.AI_FOUNDRY_TEMPERATURE);
		if (temperature !== undefined) {
			requestPayload.temperature = temperature;
		}

		const topP = parseOptionalNumber(process.env.AI_FOUNDRY_TOP_P);
		if (topP !== undefined) {
			requestPayload.top_p = topP;
		}

		const requestBody = JSON.stringify(requestPayload);

	let response: Response;

	try {
		response = await fetch(requestUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"api-key": apiKey,
			},
			body: requestBody,
		});
	} catch (error) {
		if (verbose) {
			console.error("[aiFoundry] Network error while calling chat endpoint", error);
		}
		throw error;
	}

	if (!response.ok) {
		const errorText = await safeReadBody(response);
		if (verbose) {
			console.error(
				"[aiFoundry] Request failed",
				JSON.stringify({ status: response.status, errorText }),
			);
		}
		throw new Error(
			`Azure AI Foundry request failed with ${response.status}: ${errorText}`,
		);
	}

	const payload = (await response.json()) as {
		choices?: Array<{ message?: { role?: string; content?: string } }>;
	};

	const text = payload.choices?.[0]?.message?.content?.trim();
	if (!text) {
		if (verbose) {
			console.error("[aiFoundry] Empty response payload", JSON.stringify(payload));
		}
		throw new Error("Azure AI Foundry returned an empty response");
	}

	if (verbose) {
		console.log("[aiFoundry] Received response", {
			characters: text.length,
			preview: text.slice(0, 120),
		});
	}

	return { content: text };
}

async function safeReadBody(response: Response) {
	try {
		return await response.text();
	} catch (error) {
		console.error("Failed to read Azure response", error);
		return "";
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
