"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  GuardianAgentResult,
  GuardianConfig,
  GuardianTicket,
} from "@/types/guardian";
import { fetchTickets, resolveTicket, sendResponse } from "@/lib/guardianClient";
import { generateAgentResponse } from "@/lib/aiEngine";
import { sampleTickets } from "@/lib/sampleData";

type ActivityLevel = "info" | "success" | "error";

interface ActivityLogEntry {
  id: string;
  timestamp: string;
  message: string;
  level: ActivityLevel;
}

const envConfig = {
  baseUrl: process.env.NEXT_PUBLIC_SAFE_GUARDIAN_BASE_URL ?? "",
  apiKey: process.env.NEXT_PUBLIC_SAFE_GUARDIAN_API_KEY ?? "",
  requestsEndpoint: process.env.NEXT_PUBLIC_SAFE_GUARDIAN_REQUESTS_ENDPOINT ?? "/api/tickets/open",
  respondEndpoint: process.env.NEXT_PUBLIC_SAFE_GUARDIAN_RESPOND_ENDPOINT ?? "/api/tickets/respond",
  resolveEndpoint: process.env.NEXT_PUBLIC_SAFE_GUARDIAN_RESOLVE_ENDPOINT ?? "/api/tickets/resolve",
};

const defaultConfig: GuardianConfig = {
  baseUrl: envConfig.baseUrl,
  apiKey: envConfig.apiKey,
  requestsEndpoint: envConfig.requestsEndpoint,
  respondEndpoint: envConfig.respondEndpoint,
  resolveEndpoint: envConfig.resolveEndpoint,
  autoResponderEnabled: true,
  autoResolve: false,
  maxParallel: 1,
};

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function GuardianDashboard() {
  const [config, setConfig] = useLocalStorage<GuardianConfig>("guardian-config", defaultConfig);
  const [tickets, setTickets] = useState<GuardianTicket[]>(sampleTickets);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(sampleTickets[0]?.id ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [automationRunning, setAutomationRunning] = useState(false);
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);
  const [customResponse, setCustomResponse] = useState("");
  const [customActions, setCustomActions] = useState("");

  const selectedTicket = useMemo(
    () => tickets.find((item) => item.id === selectedTicketId) ?? tickets[0] ?? null,
    [tickets, selectedTicketId],
  );

  const agentResult = useMemo<GuardianAgentResult | null>(
    () => (selectedTicket ? generateAgentResponse(selectedTicket) : null),
    [selectedTicket],
  );

  const stats = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter((item) => item.status === "open" || item.status === "in_progress").length;
    const urgent = tickets.filter((item) => item.priority === "urgent" || item.priority === "high").length;
    const awaitingCustomer = tickets.filter((item) => item.status === "awaiting_customer").length;
    return { total, open, urgent, awaitingCustomer };
  }, [tickets]);

  const pushActivity = useCallback((message: string, level: ActivityLevel = "info") => {
    setActivity((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        message,
        level,
      },
      ...prev.slice(0, 49),
    ]);
  }, []);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    pushActivity("Synchronisation avec Safe Guardian…");
    try {
      const response = await fetchTickets(config);
      if (!response.success) {
        pushActivity(response.error ?? "Impossible de charger les tickets", "error");
        if (response.data && Array.isArray(response.data)) {
          setTickets(response.data);
        }
        setError(response.error ?? "Synchronisation échouée");
      } else if (response.data) {
        setTickets(response.data);
        pushActivity(`Chargement de ${response.data.length} tickets réussi`, "success");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inattendue";
      setError(message);
      pushActivity(message, "error");
    } finally {
      setLoading(false);
    }
  }, [config, pushActivity]);

  useEffect(() => {
    handleRefresh();
  }, [handleRefresh]);

  useEffect(() => {
    if (!selectedTicketId && tickets.length > 0) {
      setSelectedTicketId(tickets[0].id);
    }
  }, [selectedTicketId, tickets]);

  const handleConfigChange = (key: keyof GuardianConfig, value: string | number | boolean) => {
    setConfig({
      ...config,
      [key]: value,
    });
  };

  const handleRespond = useCallback(
    async (ticket: GuardianTicket, result: GuardianAgentResult, overrides?: { message?: string; actions?: string[] }) => {
      pushActivity(`Préparation de la réponse pour ${ticket.id}`);
      const responseText = overrides?.message ?? result.responseDraft;
      const actionsList =
        overrides?.actions ??
        (result.suggestedActions.length > 0 ? result.suggestedActions : ["Assurer le suivi sous 24h"]);

      const payload = {
        ticketId: ticket.id,
        response: responseText,
        actions: actionsList,
        confidence: result.confidence,
        meta: {
          auto: overrides ? false : config.autoResponderEnabled,
          agent: "Guardian Autopilot",
          category: ticket.category,
        },
      };

      const response = await sendResponse(config, payload);
      if (!response.success) {
        pushActivity(response.error ?? "L'envoi de la réponse a échoué", "error");
        return false;
      }

      pushActivity(`Réponse envoyée pour ${ticket.id}`, "success");
      setTickets((prev) =>
        prev.map((item) =>
          item.id === ticket.id
            ? {
                ...item,
                status: item.status === "resolved" ? item.status : "in_progress",
                updatedAt: new Date().toISOString(),
                conversation: [
                  ...item.conversation,
                  {
                    role: "agent",
                    message: responseText,
                    timestamp: new Date().toISOString(),
                  },
                ],
              }
            : item,
        ),
      );
      return true;
    },
    [config, pushActivity],
  );

  const handleResolve = useCallback(
    async (ticket: GuardianTicket) => {
      pushActivity(`Clôture du ticket ${ticket.id} en cours…`);
      const response = await resolveTicket(config, {
        ticketId: ticket.id,
        meta: {
          resolvedBy: "Guardian Autopilot",
          closedAt: new Date().toISOString(),
        },
      });

      if (!response.success) {
        pushActivity(response.error ?? "Clôture impossible", "error");
        return false;
      }

      pushActivity(`Ticket ${ticket.id} clôturé`, "success");
      setTickets((prev) =>
        prev.map((item) => (item.id === ticket.id ? { ...item, status: "resolved", updatedAt: new Date().toISOString() } : item)),
      );
      return true;
    },
    [config, pushActivity],
  );

  const runAutomation = useCallback(async () => {
    if (automationRunning) return;
    setAutomationRunning(true);
    pushActivity("Début de l'automatisation Guardian Autopilot");
    try {
      for (const ticket of tickets) {
        if (ticket.status === "resolved") continue;
        if (!config.autoResponderEnabled) break;
        const result = generateAgentResponse(ticket);
        const success = await handleRespond(ticket, result);
        if (success && config.autoResolve) {
          await handleResolve(ticket);
        }
      }
      pushActivity("Cycle d'automatisation terminé", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur automation";
      pushActivity(message, "error");
    } finally {
      setAutomationRunning(false);
      await handleRefresh();
    }
  }, [automationRunning, config.autoResolve, config.autoResponderEnabled, handleRefresh, handleResolve, handleRespond, pushActivity, tickets]);

  const onSendManualResponse = async () => {
    if (!selectedTicket || !agentResult) return;
    const message = customResponse.trim() || agentResult.responseDraft;
    const actions =
      customActions
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean) || agentResult.suggestedActions;

    await handleRespond(selectedTicket, agentResult, {
      message,
      actions,
    });
    setCustomResponse("");
    setCustomActions("");
  };

  return (
    <div className="flex min-h-screen flex-col gap-6 bg-slate-950 p-6 text-slate-100">
      <header className="rounded-2xl border border-slate-800 bg-slate-900/70 px-6 py-5 shadow-lg shadow-slate-900/30 backdrop-blur">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-white">Safe Guardian Autopilot</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">
              IA opérationnelle temps-réel pour traiter automatiquement les demandes critiques, sans coût ni limite intégrée.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleRefresh()}
              className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-white"
              disabled={loading}
            >
              {loading ? "Synchronisation…" : "Rafraîchir"}
            </button>
            <button
              onClick={() => runAutomation()}
              className={classNames(
                "rounded-full px-4 py-2 text-sm font-medium transition",
                automationRunning
                  ? "cursor-not-allowed bg-slate-800 text-slate-400"
                  : "bg-emerald-400 text-slate-950 hover:bg-emerald-300",
              )}
              disabled={automationRunning}
            >
              {automationRunning ? "Autopilot en cours…" : "Lancer Autopilot"}
            </button>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <DashboardChip label="Tickets suivis" value={stats.total} />
          <DashboardChip label="En cours" value={stats.open} accent="bg-sky-500/10 text-sky-300" />
          <DashboardChip label="Urgent" value={stats.urgent} accent="bg-rose-500/10 text-rose-300" />
          <DashboardChip label="En attente client" value={stats.awaitingCustomer} accent="bg-amber-500/10 text-amber-200" />
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
        <section className="flex flex-col gap-6">
          <ConfigPanel config={config} onChange={handleConfigChange} />
          <TicketList
            tickets={tickets}
            selectedId={selectedTicket?.id ?? null}
            onSelect={setSelectedTicketId}
            loading={loading}
          />
          <ActivityFeed entries={activity} />
        </section>

        <section className="flex flex-col gap-6">
          {selectedTicket && agentResult ? (
            <div className="grid gap-6">
              <TicketOverview ticket={selectedTicket} />
              <AgentInsightCard result={agentResult} />
              <ResponseComposer
                ticket={selectedTicket}
                result={agentResult}
                customResponse={customResponse}
                customActions={customActions}
                onResponseChange={setCustomResponse}
                onActionsChange={setCustomActions}
                onSend={onSendManualResponse}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center text-sm text-slate-400">
              Aucun ticket sélectionné
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function DashboardChip({
  label,
  value,
  accent = "bg-slate-800 text-slate-100",
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className={classNames("rounded-xl px-4 py-3 text-sm", accent)}>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function ConfigPanel({
  config,
  onChange,
}: {
  config: GuardianConfig;
  onChange: (key: keyof GuardianConfig, value: string | number | boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="text-lg font-semibold text-white">Connexion Safe Guardian</h2>
      <p className="mt-1 text-xs text-slate-400">
        Configurez l&apos;adresse de votre panel et laissez l&apos;IA gérer le flux complet.
      </p>
      <div className="mt-4 flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase text-slate-400">Base URL</span>
          <input
            className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-600"
            placeholder="https://safe-guardian-ai-1a4c12be.base44.app"
            value={config.baseUrl}
            onChange={(event) => onChange("baseUrl", event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase text-slate-400">API Key / Token</span>
          <input
            className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-600"
            placeholder="Optionnel si session déjà authentifiée"
            value={config.apiKey}
            onChange={(event) => onChange("apiKey", event.target.value)}
          />
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <EndpointInput
            label="Liste des tickets"
            value={config.requestsEndpoint}
            onChange={(value) => onChange("requestsEndpoint", value)}
          />
          <EndpointInput
            label="Endpoint réponse"
            value={config.respondEndpoint}
            onChange={(value) => onChange("respondEndpoint", value)}
          />
          <EndpointInput
            label="Endpoint clôture"
            value={config.resolveEndpoint}
            onChange={(value) => onChange("resolveEndpoint", value)}
          />
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase text-slate-400">Sessions parallèles</span>
            <input
              type="number"
              min={1}
              max={5}
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-600"
              value={config.maxParallel}
              onChange={(event) => onChange("maxParallel", Number(event.target.value))}
            />
          </label>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200">
          <ToggleRow
            label="Auto-réponse directe"
            helper="Envoie la proposition IA automatiquement sans validation humaine."
            checked={config.autoResponderEnabled}
            onChange={(checked) => onChange("autoResponderEnabled", checked)}
          />
          <ToggleRow
            label="Auto-clôture après réponse"
            helper="Passe le ticket en résolu une fois la réponse envoyée."
            checked={config.autoResolve}
            onChange={(checked) => onChange("autoResolve", checked)}
          />
        </div>
      </div>
    </div>
  );
}

function EndpointInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase text-slate-400">{label}</span>
      <input
        className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-600"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ToggleRow({
  label,
  helper,
  checked,
  onChange,
}: {
  label: string;
  helper: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-3">
      <span>
        <span className="block text-sm font-medium text-slate-100">{label}</span>
        <span className="block text-xs text-slate-400">{helper}</span>
      </span>
      <input
        type="checkbox"
        className="h-5 w-5 rounded border-slate-700 bg-slate-900 text-emerald-400 focus:ring-emerald-500"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function TicketList({
  tickets,
  selectedId,
  onSelect,
  loading,
}: {
  tickets: GuardianTicket[];
  selectedId: string | null;
  onSelect: (ticketId: string) => void;
  loading: boolean;
}) {
  const statusColor: Record<GuardianTicket["status"], string> = {
    open: "bg-sky-500/15 text-sky-200",
    in_progress: "bg-violet-500/15 text-violet-200",
    awaiting_customer: "bg-amber-500/15 text-amber-200",
    resolved: "bg-emerald-500/15 text-emerald-200",
    escalated: "bg-rose-500/15 text-rose-200",
  };

  return (
    <div className="flex max-h-[520px] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-xs uppercase tracking-wide text-slate-400">
        <span>Tickets</span>
        {loading && <span className="text-slate-500">chargement…</span>}
      </div>
      <div className="flex-1 overflow-y-auto">
        {tickets.map((ticket) => (
          <button
            key={ticket.id}
            onClick={() => onSelect(ticket.id)}
            className={classNames(
              "w-full border-b border-slate-800 px-4 py-3 text-left transition",
              selectedId === ticket.id ? "bg-slate-800/60" : "hover:bg-slate-800/40",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-100">{ticket.subject}</p>
              <span className={classNames("rounded-full px-2 py-0.5 text-xs", statusColor[ticket.status])}>
                {ticket.status.replace("_", " ")}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400 line-clamp-2">{ticket.summary}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-300">{ticket.category}</span>
              <span className="rounded-full bg-slate-900 px-2 py-0.5 uppercase tracking-wide">{ticket.priority}</span>
              <span>{new Date(ticket.createdAt).toLocaleString("fr-FR")}</span>
            </div>
          </button>
        ))}
      </div>
      {tickets.length === 0 && (
        <div className="flex flex-1 items-center justify-center px-6 py-10 text-center text-sm text-slate-400">
          Aucun ticket détecté. Vérifiez la configuration et relancez une synchronisation.
        </div>
      )}
    </div>
  );
}

function ActivityFeed({ entries }: { entries: ActivityLogEntry[] }) {
  const colors: Record<ActivityLevel, string> = {
    info: "text-slate-300",
    success: "text-emerald-300",
    error: "text-rose-300",
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60">
      <div className="border-b border-slate-800 px-4 py-3 text-xs uppercase tracking-wide text-slate-400">
        Journal d&apos;activité
      </div>
      <ul className="max-h-64 space-y-2 overflow-y-auto px-4 py-3 text-xs">
        {entries.map((entry) => (
          <li key={entry.id} className={colors[entry.level]}>
            <span className="text-slate-500">
              {new Date(entry.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>{" "}
            {entry.message}
          </li>
        ))}
        {entries.length === 0 && (
          <li className="text-slate-500">Les événements en direct apparaîtront ici.</li>
        )}
      </ul>
    </div>
  );
}

function TicketOverview({ ticket }: { ticket: GuardianTicket }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">{ticket.subject}</h2>
          <p className="text-xs uppercase tracking-wide text-slate-400">#{ticket.id}</p>
        </div>
        <div className="text-right text-xs text-slate-400">
          <p>Créé : {new Date(ticket.createdAt).toLocaleString("fr-FR")}</p>
          <p>Mis à jour : {new Date(ticket.updatedAt).toLocaleString("fr-FR")}</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-200">{ticket.summary}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-200">{ticket.category}</span>
        <span className="rounded-full bg-slate-900 px-2 py-0.5 uppercase tracking-wide text-slate-200">{ticket.priority}</span>
        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-slate-400">
          SLA {ticket.slaMinutes} min
        </span>
      </div>
      <div className="mt-6 space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-300">
        <p className="text-slate-400">Historique client</p>
        {ticket.conversation.slice(-3).map((entry) => (
          <div key={entry.timestamp} className="rounded-lg bg-slate-900/80 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{entry.role}</p>
            <p className="mt-1 text-sm text-slate-200">{entry.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentInsightCard({ result }: { result: GuardianAgentResult }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <h3 className="text-lg font-semibold text-white">Analyse de l&apos;agent</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{result.analysis}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {result.insights.map((insight) => (
          <div key={insight.label} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs">
            <p className="font-medium text-slate-200">{insight.label}</p>
            <p className="mt-1 text-slate-400">{insight.explanation}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
        <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-200">
          Confiance {Math.round(result.confidence * 100)}%
        </span>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-200">
          Action prioritaire : {result.primaryAction}
        </span>
      </div>
      <div className="mt-5 space-y-2 text-sm text-slate-300">
        <p className="text-xs uppercase tracking-wide text-slate-500">Actions recommandées</p>
        <ul className="list-disc space-y-1 pl-4">
          {result.suggestedActions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ResponseComposer({
  ticket,
  result,
  customResponse,
  customActions,
  onResponseChange,
  onActionsChange,
  onSend,
}: {
  ticket: GuardianTicket;
  result: GuardianAgentResult;
  customResponse: string;
  customActions: string;
  onResponseChange: (value: string) => void;
  onActionsChange: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Réponse générée</h3>
        <span className="text-xs uppercase text-slate-500">ticket {ticket.id}</span>
      </div>
      <textarea
        className="mt-3 min-h-[180px] w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-600"
        value={customResponse || result.responseDraft}
        onChange={(event) => onResponseChange(event.target.value)}
      />
      <div className="mt-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">Actions associées</p>
        <textarea
          className="mt-2 min-h-[100px] w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-600"
          value={customActions || result.suggestedActions.join("\n")}
          onChange={(event) => onActionsChange(event.target.value)}
        />
        <p className="mt-1 text-[11px] text-slate-500">
          Une action par ligne (ex: &quot;Notifier l&apos;équipe sécurité&quot;)
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-400">
          Message préparé par Guardian Autopilot pour <span className="text-slate-200">{ticket.customerName}</span>
        </div>
        <button
          onClick={onSend}
          className="rounded-full bg-emerald-400 px-5 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-300"
        >
          Envoyer maintenant
        </button>
      </div>
    </div>
  );
}
