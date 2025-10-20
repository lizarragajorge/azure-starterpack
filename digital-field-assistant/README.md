## Digital Field Assistant Demo

This project showcases a conversational field operations assistant built with Next.js 15, Tailwind CSS, and Azure AI Foundry. The experience combines:

- A **chat copilot** that routes prompts to Azure AI Foundry models via a server-side API route.
- An **operations sidebar** that highlights live pipeline health, dispatch plans, and an integration roadmap for Fabric or Databricks.
- A responsive landing page that presents metrics and clear next steps for turning the demo into a production pilot.

You can use this repository to explore UI/UX concepts, validate Azure AI integration, and prototype workflows before wiring in live telemetry.

## Getting Started

```bash
# install dependencies if you have not already
yarn install

# run the Next.js dev server
yarn dev
```

Visit [http://localhost:3000](http://localhost:3000) to interact with the demo.

## Configuring Azure AI Foundry

1. Create a `.env.local` file in the project root and supply your Azure credentials:

	```bash
	AI_FOUNDRY_ENDPOINT="https://<your-resource>.openai.azure.com"
	AI_FOUNDRY_API_KEY="<your-api-key>"
	AI_FOUNDRY_CHAT_DEPLOYMENT="<your-deployment-name>"
	AI_FOUNDRY_API_VERSION="2024-05-01-preview" # optional override
		AI_FOUNDRY_SYSTEM_PROMPT="You are a helpful digital field assistant..." # optional default persona
		AI_FOUNDRY_TEMPERATURE="1" # optional, unset to use the model default
		AI_FOUNDRY_TOP_P="" # optional, leave blank unless your deployment allows it
		LOG_VERBOSE="true" # optional debug logging toggle
	```

2. Restart `yarn dev` to load the environment variables.

If credentials are missing the chat experience falls back to a simulated assistant so the UI remains usable.

> **Security tip:** keep `.env.local` out of version control and rotate any keys that may have been committed previously.

## Project Structure

- `src/app/page.tsx` — Landing page layout and integration checklist.
- `src/components/chat/ChatPanel.tsx` — Client component with messaging UI that calls `/api/chat`.
- `src/components/intel/OperationsSidebar.tsx` — Static operational insights and integration roadmap cards.
- `src/app/api/chat/route.ts` — Serverless route that brokers chat requests to Azure AI Foundry.
- `src/lib/aiFoundry.ts` — Helper for calling the Azure Chat Completions endpoint (with graceful fallback).

## Next Steps

- Replace the static sidebar data with calls to Microsoft Fabric or Databricks once the backend is ready.
- Add authentication and audit logging around `/api/chat` before sharing broadly.
- Introduce streaming chat responses or rich citations to extend the copilot experience.
