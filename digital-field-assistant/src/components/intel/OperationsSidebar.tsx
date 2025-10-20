type SignalStatus = "green" | "amber" | "red";

const signalHealth: Array<{
  label: string;
  status: SignalStatus;
  detail: string;
}> = [
  { label: "Telemetry ingestion", status: "green", detail: "12 streams healthy" },
  { label: "Work order sync", status: "amber", detail: "3 jobs queued" },
  { label: "Safety checklists", status: "green", detail: "Up to date" },
  { label: "Inventory feeds", status: "red", detail: "Depot 4 offline" },
];

const upcomingSiteVisits = [
  {
    site: "North Ridge Wind Farm",
    crew: "Crew 7A",
    eta: "Tomorrow 07:30",
    focus: "Pitch bearing swap",
  },
  {
    site: "Pipeline Segment B",
    crew: "Integrity Team",
    eta: "Tomorrow 11:00",
    focus: "Drone leak survey",
  },
];

const integrationRoadmap = [
  {
    milestone: "Azure AI Foundry",
    detail: "Production deployment of chat completion endpoint",
    target: "In progress",
  },
  {
    milestone: "Microsoft Fabric Lakehouse",
    detail: "Real-time telemetry ingestion into Delta tables",
    target: "Planned",
  },
  {
    milestone: "Databricks Workflows",
    detail: "Automated field insights notebooks",
    target: "Design",
  },
];

export function OperationsSidebar() {
  return (
    <aside className="flex h-full flex-col gap-6 rounded-3xl border border-slate-100 bg-white/70 p-6 shadow-lg backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
      <section className="space-y-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Live signal health
          </p>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
            Data pipelines
          </h3>
        </div>
        <ul className="space-y-2">
          {signalHealth.map((signal) => (
            <li
              key={signal.label}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950/60"
            >
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-200">
                  {signal.label}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {signal.detail}
                </p>
              </div>
              <span
                className={`h-3 w-3 rounded-full ${dotColor(signal.status)}`}
                aria-label={signal.status}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Dispatch outlook
          </p>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
            Upcoming site visits
          </h3>
        </div>
        <ul className="space-y-3">
          {upcomingSiteVisits.map((visit) => (
            <li
              key={`${visit.site}-${visit.eta}`}
              className="rounded-2xl border border-slate-200 bg-gradient-to-r from-sky-50 to-white px-4 py-4 text-sm shadow-sm dark:border-slate-800 dark:from-slate-900/80 dark:to-slate-950/60"
            >
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {visit.site}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {visit.crew} • {visit.eta}
              </p>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                Focus: {visit.focus}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Platform roadmap
          </p>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
            Integrations
          </h3>
        </div>
        <ol className="space-y-3 text-sm">
          {integrationRoadmap.map((item) => (
            <li
              key={item.milestone}
              className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/70"
            >
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {item.milestone}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {item.detail}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                Status: {item.target}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}

function dotColor(status: "green" | "amber" | "red") {
  switch (status) {
    case "green":
      return "bg-emerald-500";
    case "amber":
      return "bg-amber-400";
    case "red":
      return "bg-rose-500";
    default:
      return "bg-slate-400";
  }
}
