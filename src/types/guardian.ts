export type GuardianTicketStatus = "open" | "in_progress" | "awaiting_customer" | "resolved" | "escalated";

export type GuardianPriority = "low" | "medium" | "high" | "urgent";

export interface GuardianTicket {
  id: string;
  subject: string;
  category: string;
  summary: string;
  status: GuardianTicketStatus;
  priority: GuardianPriority;
  customerName: string;
  customerEmail: string;
  createdAt: string;
  updatedAt: string;
  slaMinutes: number;
  tags: string[];
  metadata?: Record<string, unknown>;
  conversation: Array<{
    role: "user" | "agent" | "system";
    message: string;
    timestamp: string;
  }>;
}

export interface GuardianConfig {
  baseUrl: string;
  apiKey: string;
  requestsEndpoint: string;
  respondEndpoint: string;
  resolveEndpoint: string;
  autoResponderEnabled: boolean;
  autoResolve: boolean;
  maxParallel: number;
}

export interface GuardianResponsePayload {
  ticketId: string;
  response: string;
  actions: string[];
  confidence: number;
  meta?: Record<string, unknown>;
}

export interface GuardianServerRequest {
  action: "fetch" | "respond" | "resolve";
  config: GuardianConfig;
  payload?: Partial<GuardianResponsePayload> & { ticketId: string };
}

export interface GuardianApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface GuardianAgentInsight {
  score: number;
  label: string;
  explanation: string;
}

export interface GuardianAgentResult {
  analysis: string;
  primaryAction: string;
  suggestedActions: string[];
  responseDraft: string;
  confidence: number;
  insights: GuardianAgentInsight[];
}

