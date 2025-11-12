import { NextResponse } from "next/server";
import { sampleTickets } from "@/lib/sampleData";
import {
  GuardianApiResponse,
  GuardianResponsePayload,
  GuardianServerRequest,
  GuardianTicket,
} from "@/types/guardian";

function buildUrl(base: string, path: string) {
  try {
    return new URL(path, base).toString();
  } catch {
    return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  }
}

function normalizeTickets(raw: unknown): GuardianTicket[] {
  if (!Array.isArray(raw)) return sampleTickets;

  return raw.map((item, index) => {
    const fallback = sampleTickets[index % sampleTickets.length];
    const record = item as Record<string, unknown>;
    return {
      id: String(record.id ?? fallback.id ?? `TCK-${1000 + index}`),
      subject: String(record.subject ?? record.title ?? fallback.subject),
      category: String(record.category ?? record.type ?? fallback.category ?? "générique"),
      summary: String(record.summary ?? record.description ?? fallback.summary),
      status: (record.status as GuardianTicket["status"]) ?? fallback.status,
      priority: (record.priority as GuardianTicket["priority"]) ?? fallback.priority,
      customerName: String(record.customerName ?? record.requesterName ?? fallback.customerName),
      customerEmail: String(record.customerEmail ?? record.email ?? fallback.customerEmail),
      createdAt: String(record.createdAt ?? record.created_at ?? fallback.createdAt),
      updatedAt: String(record.updatedAt ?? record.updated_at ?? fallback.updatedAt),
      slaMinutes: Number(record.slaMinutes ?? record.sla ?? fallback.slaMinutes ?? 240),
      tags: Array.isArray(record.tags) ? (record.tags as string[]) : fallback.tags,
      metadata: (record.metadata as Record<string, unknown>) ?? fallback.metadata,
      conversation: Array.isArray(record.conversation)
        ? (record.conversation as GuardianTicket["conversation"])
        : fallback.conversation,
    };
  });
}

async function forwardRequest(
  url: string,
  method: "GET" | "POST",
  apiKey: string,
  body?: unknown
) {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    throw new Error(`Impossible d'appeler ${url} (${res.status})`);
  }

  if (method === "GET") {
    return res.json();
  }

  return { ok: true };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GuardianServerRequest;
    const { action, config, payload } = body;

    if (!config) {
      return NextResponse.json<GuardianApiResponse>({
        success: true,
        data: sampleTickets,
      });
    }

    if (action === "fetch") {
      if (!config.baseUrl) {
        return NextResponse.json<GuardianApiResponse<GuardianTicket[]>>({
          success: true,
          data: sampleTickets,
        });
      }

      const url = buildUrl(config.baseUrl, config.requestsEndpoint);
      try {
        const response = await forwardRequest(url, "GET", config.apiKey);
        const normalized = normalizeTickets(response);
        return NextResponse.json<GuardianApiResponse<GuardianTicket[]>>({
          success: true,
          data: normalized,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Lecture impossible";
        return NextResponse.json<GuardianApiResponse>({
          success: false,
          error: message,
          data: sampleTickets,
        });
      }
    }

    if (action === "respond" && payload) {
      if (!config.baseUrl) {
        return NextResponse.json<GuardianApiResponse>({
          success: true,
          data: payload,
        });
      }

      const url = buildUrl(config.baseUrl, config.respondEndpoint);
      try {
        await forwardRequest(url, "POST", config.apiKey, payload as GuardianResponsePayload);
        return NextResponse.json<GuardianApiResponse>({
          success: true,
          data: payload,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Réponse impossible";
        return NextResponse.json<GuardianApiResponse>({
          success: false,
          error: message,
        });
      }
    }

    if (action === "resolve" && payload) {
      if (!config.baseUrl) {
        return NextResponse.json<GuardianApiResponse>({
          success: true,
          data: payload,
        });
      }

      const url = buildUrl(config.baseUrl, config.resolveEndpoint);
      try {
        await forwardRequest(url, "POST", config.apiKey, payload);
        return NextResponse.json<GuardianApiResponse>({
          success: true,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Clôture impossible";
        return NextResponse.json<GuardianApiResponse>({
          success: false,
          error: message,
        });
      }
    }

    return NextResponse.json<GuardianApiResponse>({
      success: false,
      error: "Action non supportée",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inattendue";
    return NextResponse.json<GuardianApiResponse>({
      success: false,
      error: message,
    });
  }
}
