## Digital Field Assistant Demo

This project showcases a conversational field operations assistant built with Next.js 15, Tailwind CSS, and Azure AI Foundry. The experience combines:

- A **chat copilot** that routes prompts to Azure AI Foundry models via the Azure OpenAI SDK.
- An **operations sidebar** that highlights live pipeline health, dispatch plans, and an integration roadmap for Fabric or Databricks.
- A responsive landing page that presents metrics and clear next steps for turning the demo into a production pilot.

You can use this repository to explore UI/UX concepts, validate Azure AI integration, and prototype workflows before wiring in live telemetry.

## Technology Stack

- **Next.js 15** with App Router and Server Components
- **React 19** for UI components
- **Tailwind CSS 4** for styling
- **Azure OpenAI SDK** (`openai` package) for AI integration

## Getting Started

```bash
# Install dependencies
yarn install

# Run the Next.js dev server
yarn dev
```

Visit [http://localhost:3000](http://localhost:3000) to interact with the demo.

## Configuring Azure AI Foundry

This demo can operate in two modes:

1. **Deployment (Chat Completions) Mode** – You point directly at a model deployment (e.g. `gpt-4o-mini`) using the Azure OpenAI SDK.
2. **Agent Mode (Preview)** – You invoke an Azure AI Foundry Agent that encapsulates system instructions, tool wiring, and (optionally) memory. The API route auto-selects agent mode when `AI_FOUNDRY_AGENT_ID` is present.

### 1. Set up your environment variables

Create a `.env.local` file in the project root with your Azure credentials. Choose either deployment variables or agent variables (you can keep both; agent mode wins automatically when the agent ID is defined):

```bash
#############################################
# Core endpoint + auth (used by both modes) #
#############################################
AI_FOUNDRY_ENDPOINT="https://<your-resource>.cognitiveservices.azure.com/"
AI_FOUNDRY_API_KEY="<your-api-key>"

#############################################
# Deployment (Chat Completions) mode         #
#############################################
AI_FOUNDRY_CHAT_DEPLOYMENT="<your-deployment-name>"    # e.g. gpt-4o-mini
AI_FOUNDRY_API_VERSION="2024-12-01-preview"            # optional override
AI_FOUNDRY_SYSTEM_PROMPT="You are a helpful digital field assistant for energy operations..."
AI_FOUNDRY_TEMPERATURE="1"                             # optional
AI_FOUNDRY_TOP_P=""                                    # optional

#############################################
# Agent mode (Preview)                       #
#############################################
AI_FOUNDRY_AGENT_ID="<your-agent-id>"                  # Enables agent auto-dispatch
AI_FOUNDRY_AGENT_API_VERSION="2024-12-01-preview"      # optional; falls back to API_VERSION

# Tracing / logging
LOG_VERBOSE="true"
```

### 2. Find your credentials

- Endpoint & API key: **Deployments + Endpoints** page in Azure AI Foundry project.
- Deployment name: Shown in your model deployment list.
- Agent ID (preview): Create an Agent in the **Agents** blade, then copy its identifier.

### 3. How agent mode differs

When `AI_FOUNDRY_AGENT_ID` is present the API route calls `completeChatWithAgent()` via a unified `completeChatAuto()` dispatcher. The agent’s own system instructions, tools, and safety config are stored server-side so you no longer need to ship a long system prompt in every request. Multi-step tool executions, retrieval, and memory features (if enabled for the agent) occur transparently.

### 4. Restart the dev server

```bash
yarn dev
```

If neither deployment nor agent credentials are present, the chat experience falls back to a simulated assistant so the UI remains usable.

> **Security tip:** Keep `.env.local` out of version control and rotate any keys that may have been committed previously.

## Project Structure

- `src/app/page.tsx` — Landing page layout and integration checklist.
- `src/components/chat/ChatPanel.tsx` — Client component with tabbed interface (chat, briefings, actions) that calls `/api/chat`.
- `src/components/intel/OperationsSidebar.tsx` — Static operational insights and integration roadmap cards.
- `src/app/api/chat/route.ts` — Serverless API route that brokers chat requests to Azure AI Foundry (auto agent vs deployment dispatch).
- `src/lib/aiFoundry.ts` — Wrapper offering both direct deployment completions and agent responses with graceful fallback.

## OpenTelemetry Tracing

This app follows **Microsoft's recommended approach** for tracing AI applications using OpenTelemetry. You can trace to:

1. **VS Code AI Toolkit** (local, for development) - recommended
2. **Azure Application Insights** (cloud, for production)

This gives you visibility into:
- API request latency and success rates
- Azure OpenAI call performance and token usage
- Custom spans for business logic
- Error tracking and diagnostics

### Option 1: Local Tracing with VS Code AI Toolkit (Recommended)

This is the **Microsoft-recommended approach** for development, following the [VS Code AI Toolkit tracing guide](https://code.visualstudio.com/docs/intelligentapps/tracing).

1. Install the [AI Toolkit extension](https://marketplace.visualstudio.com/items?itemName=ms-ai-toolkit.vscode-ai-toolkit) in VS Code

2. Open the AI Toolkit sidebar and navigate to **Tracing**

3. Click **Start Collector** to start the local OTLP trace collector (runs on `localhost:4318`)

4. Add to your `.env.local`:
   ```bash
   OTLP_ENDPOINT="http://localhost:4318"
   ```

5. Restart your dev server:
   ```bash
   yarn dev
   ```

6. Make some chat requests, then click **Refresh** in the AI Toolkit Tracing view

7. Click on any trace to see:
   - Complete execution flow in the span tree
   - AI messages in the Input + Output tab
   - Token usage and latency metrics
   - Raw metadata

### Option 2: Azure Application Insights (Production)

For production deployments, send traces to Azure Application Insights:

1. Get your Application Insights connection string from Azure AI Foundry:
   - Navigate to: **Project → Tracing → Manage data source → Connection string**

2. Add it to your `.env.local`:
   ```bash
   APPLICATIONINSIGHTS_CONNECTION_STRING="InstrumentationKey=...;IngestionEndpoint=..."
   ```

3. Restart your dev server:
   ```bash
   yarn dev
   ```

4. View traces in Azure Portal:
   - Go to **Azure AI Foundry → Tracing**

### Custom instrumentation

The app uses the `withSpan()` utility to create custom traces. Example:

```typescript
import { withSpan } from "@/lib/telemetry";

const result = await withSpan("custom_operation", async (span) => {
  span?.setAttribute("custom.attribute", "value");
  return await yourBusinessLogic();
});
```

All Azure OpenAI calls are automatically traced with attributes like:
- `ai.deployment` - The deployment name
- `ai.message_count` - Number of messages in the request
- `ai.usage.total_tokens` - Token usage
- `ai.response_length` - Response character count

## Next Steps

- Replace the static sidebar data with calls to Microsoft Fabric or Databricks once the backend is ready.
- Add authentication and audit logging around `/api/chat` before sharing broadly.
- Introduce streaming chat responses or rich citations to extend the copilot experience (agents can simplify tool orchestration).
- Set up alerts in Application Insights for high latency or error rates.
