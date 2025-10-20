import { ChatPanel } from "@/components/chat/ChatPanel";
import { OperationsSidebar } from "@/components/intel/OperationsSidebar";

const metrics = [
  {
    label: "Active field crews",
    value: "18",
    trend: "+3 vs yesterday",
  },
  {
    label: "Open critical alerts",
    value: "4",
    trend: "2 require follow-up",
  },
  {
    label: "AI assisted briefings",
    value: "26",
    trend: "Fabric integration planned",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 px-6 py-12 text-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 sm:px-10 lg:px-16">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10">
        <header className="space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300">
            Digital Field Assistant Demo
          </span>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            Orchestrate safer, smarter field operations with Azure AI
          </h1>
          <p className="max-w-3xl text-lg text-slate-600 dark:text-slate-300">
            This demo pairs a conversational copilot with real-time operational context.
            Plug in Azure AI Foundry models for reasoning, then expand to Microsoft Fabric
            or Databricks workflows for data fusion and automation.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-lg backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80"
            >
              <p className="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {metric.label}
              </p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
                {metric.value}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {metric.trend}
              </p>
            </div>
          ))}
        </section>

        <main className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <ChatPanel />
          <OperationsSidebar />
        </main>

        <section className="rounded-3xl border border-dashed border-slate-300 bg-white/50 p-6 text-sm text-slate-600 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Next integrations
          </h2>
          <ul className="mt-3 space-y-2 list-disc pl-5">
            <li>
              Connect the chat API to an Azure AI Foundry deployment by setting{" "}
              <code className="rounded border border-slate-300 bg-slate-100 px-1 py-0.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                AI_FOUNDRY_ENDPOINT
              </code>
              {", "}
              <code className="rounded border border-slate-300 bg-slate-100 px-1 py-0.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                AI_FOUNDRY_API_KEY
              </code>
              {", and "}
              <code className="rounded border border-slate-300 bg-slate-100 px-1 py-0.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                AI_FOUNDRY_CHAT_DEPLOYMENT
              </code>
              {" in a "}
              <code className="rounded border border-slate-300 bg-slate-100 px-1 py-0.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                .env.local
              </code>
              {" file."}
            </li>
            <li>
              Surface Fabric or Databricks insights by wiring the sidebar status cards to
              REST or Delta Lake queries.
            </li>
            <li>
              Add role-based authentication and telemetry streams to evolve this demo into a
              production-ready field assistant hub.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
