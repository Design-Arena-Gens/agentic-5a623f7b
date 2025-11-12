import { GuardianTicket } from "@/types/guardian";

export const sampleTickets: GuardianTicket[] = [
  {
    id: "TCK-10294",
    subject: "Impossible de réinitialiser mon mot de passe",
    category: "authentification",
    summary:
      "L'utilisateur ne reçoit pas l'email de réinitialisation et ne peut pas accéder au tableau de bord administratif.",
    status: "open",
    priority: "urgent",
    customerName: "Samira Haddad",
    customerEmail: "samira.haddad@example.com",
    createdAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    slaMinutes: 60,
    tags: ["password", "critical"],
    conversation: [
      {
        role: "user",
        message:
          "Bonjour, j'ai essayé trois fois de réinitialiser mon mot de passe mais je ne reçois aucun email. Pouvez-vous résoudre ça rapidement ?",
        timestamp: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
      },
    ],
  },
  {
    id: "TCK-10271",
    subject: "Alertes d'anomalies inexactes",
    category: "monitoring",
    summary:
      "Des notifications d'incident sont envoyées alors que les métriques sont stables. Possibilité d'un seuil mal configuré.",
    status: "in_progress",
    priority: "high",
    customerName: "Rania Benali",
    customerEmail: "rania.benali@example.com",
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
    slaMinutes: 240,
    tags: ["alerting", "monitoring"],
    metadata: {
      service: "guardian-core",
      threshold: 85,
      metric: "cpu_usage",
    },
    conversation: [
      {
        role: "user",
        message:
          "Nous recevons des alertes CPU toutes les 10 minutes alors que la charge reste inférieure à 40%.",
        timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      },
      {
        role: "agent",
        message:
          "Merci du signalement. Je vérifie les règles d'alerte et je reviens vers vous rapidement.",
        timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      },
    ],
  },
  {
    id: "TCK-10240",
    subject: "Demande d'accès à l'API Safe Guardian",
    category: "intégration",
    summary:
      "Nouveau partenaire souhaite activer l'accès API pour consultation des événements.",
    status: "awaiting_customer",
    priority: "medium",
    customerName: "Youssef Rahmani",
    customerEmail: "youssef.rahmani@example.com",
    createdAt: new Date(Date.now() - 1000 * 60 * 600).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 200).toISOString(),
    slaMinutes: 720,
    tags: ["api", "onboarding"],
    metadata: {
      organization: "Rahmani Consulting",
      useCase: "audit_compliance",
    },
    conversation: [
      {
        role: "user",
        message:
          "Bonjour, nous aurions besoin d'un accès API pour intégrer Safe Guardian à notre SIEM.",
        timestamp: new Date(Date.now() - 1000 * 60 * 600).toISOString(),
      },
      {
        role: "agent",
        message:
          "Merci pour votre intérêt. Pourriez-vous nous préciser le périmètre des données souhaitées ?",
        timestamp: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
      },
    ],
  },
];

