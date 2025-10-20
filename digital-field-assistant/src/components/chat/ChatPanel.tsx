"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type ChatRole = "user" | "assistant" | "system";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  status?: "pending" | "error";
};

type ChatResponse = {
  content: string;
  context?: string[];
  warnings?: string[];
};

type AssistantTab = "chat" | "briefings" | "actions";

const initialMessages: ChatMessage[] = [
  {
    id: "assistant-welcome",
    role: "assistant",
    content:
      "Hi there! I'm your Digital Field Assistant. Ask me about crews, safety readiness, or anything you need to keep operations on track.",
  },
];

const quickPrompts = [
  "Summarize inspection findings from the North wind farm.",
  "Draft a safety briefing for tomorrow's crew on site 12.",
  "What materials are low in inventory for pipeline segment B?",
];

const tabs: Array<{ id: AssistantTab; label: string; blurb: string }> = [
  {
    id: "chat",
    label: "Chat",
    blurb: "Ask questions and request insights from the assistant.",
  },
  {
    id: "briefings",
    label: "Briefings",
    blurb: "Generate or review crew briefings before dispatch.",
  },
  {
    id: "actions",
    label: "Actions",
    blurb: "Run guided playbooks to unblock field operations.",
  },
];

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AssistantTab>("chat");
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeTab === "chat") {
      scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  const trimmedInput = useMemo(() => input.trim(), [input]);

  async function sendMessage(chain: ChatMessage[]) {
    setIsSending(true);
    setPanelError(null);

    const assistantPlaceholder: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "Thinking…",
      status: "pending",
    };

    setMessages((prev) => chainWithAssistant(prev, assistantPlaceholder));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: chain.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!response.ok) {
        const errorText = await safeRead(response);
        throw new Error(errorText || `Request failed with ${response.status}`);
      }

      const payload = (await response.json()) as ChatResponse;
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantPlaceholder.id
            ? {
                ...message,
                content: decorateWarnings(payload.content, payload.warnings),
                status: undefined,
              }
            : message,
        ),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected error sending chat";
      setMessages((prev) =>
        prev.map((entry) =>
          entry.id === assistantPlaceholder.id
            ? {
                ...entry,
                content: message,
                status: "error",
              }
            : entry,
        ),
      );
      setPanelError(message);
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmedInput) {
      return;
    }

    const userEntry: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmedInput,
    };

    const nextChain = [...messages, userEntry];
    setMessages(nextChain);
    setInput("");

    void sendMessage(nextChain);
  }

  function handleQuickPrompt(prompt: string) {
    setInput(prompt);
  }

  return (
    <section className="flex h-full flex-col gap-5 rounded-3xl border border-slate-100 bg-white/80 p-6 shadow-xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
      <header className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Crew Support Copilot
        </p>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
          Operations assistant
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Ask about work orders, telemetry, and safety readiness or launch guided actions.
        </p>
      </header>

      <nav className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? "border-sky-500 bg-sky-600 text-white shadow"
                : "border-slate-200 bg-white/80 text-slate-600 hover:border-slate-400 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white"
            }`}
            aria-pressed={activeTab === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <p className="-mt-1 text-xs text-slate-500 dark:text-slate-400">
        {tabs.find((tab) => tab.id === activeTab)?.blurb}
      </p>

      {activeTab === "chat" && (
        <>
          <div className="flex flex-wrap gap-2">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleQuickPrompt(prompt)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:border-slate-400 hover:text-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="relative flex h-[360px] flex-col gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/70 sm:h-[420px]">
            <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto pr-2">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`flex flex-col gap-1 rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm transition ${
                    {
                      user: "self-end border-sky-200 bg-sky-50 text-slate-900 dark:border-sky-600/40 dark:bg-sky-900/60 dark:text-white",
                      assistant:
                        "self-start border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
                      system:
                        "self-center border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/60 dark:bg-amber-950/30 dark:text-amber-200",
                    }[message.role]
                  }`}
                >
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {labelForRole(message.role)}
                  </span>
                  <p className="whitespace-pre-line">{message.content}</p>
                  {message.status === "pending" && (
                    <span className="text-xs text-slate-400">Generating…</span>
                  )}
                  {message.status === "error" && (
                    <span className="text-xs text-rose-500">The assistant could not complete that request.</span>
                  )}
                </article>
              ))}
              <div ref={scrollAnchorRef} />
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80"
          >
            <label htmlFor="chat-input" className="text-xs font-medium uppercase text-slate-500 dark:text-slate-300">
              Compose request
            </label>
            <textarea
              id="chat-input"
              name="message"
              required
              rows={3}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about inspections, inventory, safety briefings, or data prep for crews"
              className="min-h-[88px] resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-inner focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-sky-500 dark:focus:ring-sky-700/40"
            />
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              {panelError ? (
                <span className="text-rose-500">{panelError}</span>
              ) : (
                <span>Messages may route to live Azure AI resources once configured.</span>
              )}
              <button
                type="submit"
                disabled={isSending || !trimmedInput}
                className="flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSending ? "Sending" : "Send"}
                <span aria-hidden className="inline-block text-base">{isSending ? "…" : "→"}</span>
              </button>
            </div>
          </form>
        </>
      )}

      {activeTab === "briefings" && <BriefingsTab />}
      {activeTab === "actions" && <ActionsTab />}
    </section>
  );
}

async function safeRead(response: Response) {
  try {
    return await response.text();
  } catch (error) {
    console.error("Failed to read response body", error);
    return null;
  }
}

function labelForRole(role: ChatRole) {
  switch (role) {
    case "assistant":
      return "assistant";
    case "system":
      return "system";
    default:
      return "you";
  }
}

function chainWithAssistant(chain: ChatMessage[], assistantMessage: ChatMessage) {
  return [...chain, assistantMessage];
}

function decorateWarnings(content: string, warnings?: string[]) {
  if (!warnings?.length) {
    return content;
  }

  const warningBanner = warnings
    .map((warning) => `WARNING: ${warning}`)
    .join("\n");

  return `${warningBanner}\n\n${content}`;
}

export type { ChatMessage, ChatRole };

function BriefingsTab() {
  return (
    <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white/80 p-6 text-sm leading-relaxed shadow-inner dark:border-slate-800 dark:bg-slate-900/80">
      <section>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Upcoming crew briefings
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Generate briefing packs with weather, hazards, and task notes. These templates wire easily into Fabric notebooks.
        </p>
      </section>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          {
            crew: "Crew 7A",
            focus: "Pitch bearing swap",
            needs: "Include overnight wind forecast and spare parts checklist.",
          },
          {
            crew: "Integrity Team",
            focus: "Drone leak survey",
            needs: "Attach last methane sensor calibration and permit status.",
          },
        ].map((briefing) => (
          <article
            key={briefing.crew}
            className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950/60"
          >
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {briefing.crew}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Focus: {briefing.focus}</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{briefing.needs}</p>
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-sky-600 hover:text-sky-500 dark:text-sky-400"
            >
              Draft briefing
              <span aria-hidden>→</span>
            </button>
          </article>
        ))}
      </div>
      <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400">
        Connect Fabric or Databricks notebooks to auto-populate these packets from the latest telemetry and asset libraries.
      </div>
    </div>
  );
}

function ActionsTab() {
  return (
    <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white/80 p-6 text-sm leading-relaxed shadow-inner dark:border-slate-800 dark:bg-slate-900/80">
      <section>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Guided actions
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Launch proactive workflows without leaving the assistant.
        </p>
      </section>
      <div className="space-y-3">
        {[
          {
            title: "Escalate safety incident",
            description:
              "Log an incident ticket, notify the duty manager, and sync to Teams.",
            cta: "Start triage",
          },
          {
            title: "Request replacement parts",
            description:
              "Check inventory across depots, create a purchase request, and alert supply chain.",
            cta: "Open workflow",
          },
          {
            title: "Schedule drone survey",
            description:
              "Share coordinates, auto-populate weather gates, and dispatch the drone team.",
            cta: "Plan survey",
          },
        ].map((action) => (
          <article
            key={action.title}
            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950/60"
          >
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {action.title}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{action.description}</p>
            </div>
            <button
              type="button"
              className="inline-flex w-max items-center gap-2 rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
            >
              {action.cta}
              <span aria-hidden>→</span>
            </button>
          </article>
        ))}
      </div>
      <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400">
        These actions can call Logic Apps, Power Automate, or Databricks Workflows once the integrations are in place.
      </div>
    </div>
  );
}
