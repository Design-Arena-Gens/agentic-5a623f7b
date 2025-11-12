import {
  GuardianApiResponse,
  GuardianConfig,
  GuardianResponsePayload,
  GuardianTicket,
} from "@/types/guardian";

async function requestGuardianApi<T>(body: Record<string, unknown>): Promise<GuardianApiResponse<T>> {
  const res = await fetch("/api/guardian", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return {
      success: false,
      error: `Requête API échouée (${res.status})`,
    };
  }

  return res.json();
}

export async function fetchTickets(config: GuardianConfig) {
  return requestGuardianApi<GuardianTicket[]>({
    action: "fetch",
    config,
  });
}

export async function sendResponse(config: GuardianConfig, payload: GuardianResponsePayload) {
  return requestGuardianApi({
    action: "respond",
    config,
    payload,
  });
}

export async function resolveTicket(
  config: GuardianConfig,
  payload: Pick<GuardianResponsePayload, "ticketId" | "meta">
) {
  return requestGuardianApi({
    action: "resolve",
    config,
    payload,
  });
}

