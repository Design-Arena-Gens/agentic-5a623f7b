import { GuardianAgentResult, GuardianAgentInsight, GuardianTicket } from "@/types/guardian";

const KNOWLEDGE_BASE: Record<
  string,
  {
    description: string;
    defaultAction: string;
    remediation: string[];
    responseTemplate: (ticket: GuardianTicket) => string;
  }
> = {
  authentification: {
    description:
      "Incidents liés aux accès, mots de passe, MFA et sessions utilisateur.",
    defaultAction:
      "Vérifier l'état du service d'authentification et relancer le processus de réinitialisation sécurisé.",
    remediation: [
      "Analyser les logs d'envoi d'emails pour détecter les erreurs SMTP",
      "Déclencher une régénération de lien sécurisé de réinitialisation",
      "Notifier l'équipe sécurité en cas de blocage suspect",
    ],
    responseTemplate: (ticket) =>
      `Bonjour ${ticket.customerName},

Nous avons bien reçu votre demande concernant la réinitialisation du mot de passe. Nous venons de régénérer un lien sécurisé et vérifié l'état du service d'envoi d'emails. Si vous ne recevez rien d'ici quelques minutes, pensez à vérifier votre dossier spam ou à utiliser l'option "réenvoyer" depuis la page de connexion.

Notre équipe garde un œil sur ce ticket jusqu'à confirmation de votre accès.

Bien cordialement,
Équipe Safe Guardian IA`,
  },
  monitoring: {
    description:
      "Anomalies de détection, faux positifs et configuration des alertes.",
    defaultAction:
      "Recalibrer les seuils et vérifier la cohérence des métriques collectées.",
    remediation: [
      "Comparer la métrique brute à la fenêtre de lissage configurée",
      "Ajuster temporairement les seuils pour éviter les faux positifs",
      "Taguer l'incident pour suivi dans le rapport hebdomadaire",
    ],
    responseTemplate: (ticket) =>
      `Bonjour ${ticket.customerName},

Merci pour votre retour. Nous avons analysé les alertes envoyées et comparé les métriques réelles. Un recalibrage automatique des seuils vient d'être appliqué pour éviter les faux positifs.

Nous surveillons les prochaines heures et vous tiendrons informé avant clôture définitive.

À votre disposition,
Équipe Safe Guardian IA`,
  },
  intégration: {
    description:
      "Onboarding de partenaires, provisionnement d'accès et webhooks.",
    defaultAction:
      "Collecter les informations nécessaires et préparer un jeu de clés API temporaires.",
    remediation: [
      "Valider le contrat d'utilisation de l'API et la période de rétention",
      "Générer une clé API avec périmètre restreint",
      "Programmer une session de vérification post-intégration",
    ],
    responseTemplate: (ticket) =>
      `Bonjour ${ticket.customerName},

Merci pour votre intérêt. Nous pouvons activer l'accès API pour votre intégration. Afin de finaliser cela, pourriez-vous nous confirmer :
- L'adresse IP ou plage autorisée
- Le périmètre de données exact nécessaire
- La personne référente côté sécurité ?

Dès réception, nous provisionnons une clé API chiffrée que vous recevrez via canal sécurisé.

Bien à vous,
Équipe Safe Guardian IA`,
  },
};

const STATUS_WEIGHTS: Record<string, number> = {
  open: 0.6,
  in_progress: 0.4,
  awaiting_customer: 0.2,
  escalated: 0.8,
  resolved: 0.1,
};

const PRIORITY_WEIGHTS: Record<string, number> = {
  low: 0.2,
  medium: 0.4,
  high: 0.7,
  urgent: 0.9,
};

const SLA_THRESHOLDS = {
  critical: 60,
  warning: 120,
};

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} minutes`;
  if (mins === 0) return `${hours} heures`;
  return `${hours}h${mins.toString().padStart(2, "0")}`;
}

function extractLatestCustomerMessage(ticket: GuardianTicket) {
  const reversed = [...ticket.conversation].reverse();
  const message = reversed.find((entry) => entry.role === "user");
  return message?.message ?? ticket.summary;
}

function buildInsights(ticket: GuardianTicket): GuardianAgentInsight[] {
  const now = Date.now();
  const updatedAt = new Date(ticket.updatedAt).getTime();
  const ageMinutes = Math.max(1, Math.round((now - updatedAt) / (1000 * 60)));
  const slaRemaining = Math.max(0, ticket.slaMinutes - ageMinutes);

  const insights: GuardianAgentInsight[] = [
    {
      label: "Priorité",
      score: PRIORITY_WEIGHTS[ticket.priority] ?? 0.4,
      explanation: `Ticket classé ${ticket.priority.toUpperCase()}; traitement prioritaire recommandé.`,
    },
    {
      label: "Avancement",
      score: STATUS_WEIGHTS[ticket.status] ?? 0.3,
      explanation: `Statut actuel : ${ticket.status.replace("_", " ")}.`,
    },
    {
      label: "SLA",
      score: slaRemaining <= SLA_THRESHOLDS.critical ? 0.9 : slaRemaining <= SLA_THRESHOLDS.warning ? 0.6 : 0.3,
      explanation: slaRemaining > 0
        ? `Temps restant avant SLA : ${formatMinutes(slaRemaining)}.`
        : "SLA dépassé, intervention immédiate nécessaire.",
    },
  ];

  if (ticket.metadata) {
    insights.push({
      label: "Métadonnées",
      score: 0.4,
      explanation: `Informations complémentaires détectées (${Object.keys(ticket.metadata).join(", ")}).`,
    });
  }

  return insights;
}

export function generateAgentResponse(ticket: GuardianTicket): GuardianAgentResult {
  const knowledge = KNOWLEDGE_BASE[ticket.category] ?? {
    description: "Cas générique",
    defaultAction: "Collecter davantage d'informations et assurer un suivi client.",
    remediation: [
      "Analyser les logs récents",
      "Vérifier l'état des services dépendants",
      "Programmer un rappel automatique au client",
    ],
    responseTemplate: (current: GuardianTicket) =>
      `Bonjour ${current.customerName},

Nous avons bien reçu votre demande concernant "${current.subject}". Notre IA a commencé l'analyse et reviendra vers vous rapidement avec une solution détaillée.

En attendant, n'hésitez pas à ajouter toute information complémentaire directement sur ce ticket.

Bien cordialement,
Équipe Safe Guardian IA`,
  };

  const latestMessage = extractLatestCustomerMessage(ticket);
  const insights = buildInsights(ticket);
  const score =
    (PRIORITY_WEIGHTS[ticket.priority] ?? 0.4) * 0.5 +
    (STATUS_WEIGHTS[ticket.status] ?? 0.3) * 0.3 +
    insights.reduce((acc, item) => acc + item.score, 0) / (insights.length * 10);

  const analysis = [
    `Résumé: ${ticket.summary}`,
    `Dernier message client: "${latestMessage}"`,
    `Catégorie détectée: ${ticket.category}`,
    `Recommandation: ${knowledge.defaultAction}`,
  ].join("\n");

  const primaryAction = knowledge.defaultAction;
  const responseDraft = knowledge.responseTemplate(ticket);

  const suggestedActions = [
    ...knowledge.remediation,
    `Mettre à jour le statut du ticket ${ticket.id} en fonction de la progression`,
  ];

  return {
    analysis,
    primaryAction,
    suggestedActions,
    responseDraft,
    confidence: Math.min(1, Math.max(0.35, Number(score.toFixed(2)))),
    insights,
  };
}

