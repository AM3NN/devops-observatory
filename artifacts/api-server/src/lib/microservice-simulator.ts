/**
 * Microservice Simulator
 *
 * Simulates 6 real microservices. Each service has:
 *   - Real endpoint handlers (that can be called via HTTP)
 *   - Its own error rate, latency profile, and behavior
 *   - Auto-instrumentation sending data to the observatory
 *
 * Services:
 *   svc-api-gateway    — Routes all client requests
 *   svc-auth           — OAuth2 / JWT authentication
 *   svc-user           — User account management
 *   svc-payment        — Payment processing
 *   svc-notification   — Email / SMS / Push
 *   svc-analytics      — Event collection & reporting
 */

import { randomUUID } from "crypto";
import { recordLog, recordTrace, type LogLevel } from "./instrumentation";

export interface ServiceConfig {
  id: string;
  name: string;
  baseLatencyMs: number;       // normal latency
  peakLatencyMs: number;       // latency under peak load
  baseErrorRate: number;       // normal error rate (0-1)
  peakErrorRate: number;       // error rate during peak load
  operations: string[];        // list of operation names
}

export const SERVICES: ServiceConfig[] = [
  {
    id: "svc-api-gateway",
    name: "API Gateway",
    baseLatencyMs: 45,
    peakLatencyMs: 280,
    baseErrorRate: 0.01,
    peakErrorRate: 0.04,
    operations: ["routeRequest", "rateLimitCheck", "authValidation", "responseAggregation"],
  },
  {
    id: "svc-auth",
    name: "Auth Service",
    baseLatencyMs: 60,
    peakLatencyMs: 150,
    baseErrorRate: 0.005,
    peakErrorRate: 0.02,
    operations: ["login", "tokenRefresh", "logout", "validateToken", "revokeToken"],
  },
  {
    id: "svc-user",
    name: "User Service",
    baseLatencyMs: 80,
    peakLatencyMs: 320,
    baseErrorRate: 0.02,
    peakErrorRate: 0.06,
    operations: ["getProfile", "updateProfile", "listUsers", "deleteUser", "searchUsers"],
  },
  {
    id: "svc-payment",
    name: "Payment Service",
    baseLatencyMs: 200,
    peakLatencyMs: 850,
    baseErrorRate: 0.03,
    peakErrorRate: 0.08,
    operations: ["processPayment", "refund", "getInvoice", "validateCard", "checkBalance"],
  },
  {
    id: "svc-notification",
    name: "Notification Service",
    baseLatencyMs: 120,
    peakLatencyMs: 400,
    baseErrorRate: 0.015,
    peakErrorRate: 0.05,
    operations: ["sendEmail", "sendSMS", "pushNotification", "getBatchStatus", "retryFailed"],
  },
  {
    id: "svc-analytics",
    name: "Analytics Service",
    baseLatencyMs: 150,
    peakLatencyMs: 600,
    baseErrorRate: 0.01,
    peakErrorRate: 0.03,
    operations: ["trackEvent", "aggregateMetrics", "generateReport", "getStats", "exportData"],
  },
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function jitter(base: number, factor = 0.4): number {
  return base + (Math.random() - 0.5) * base * factor;
}

function isPeakHour(): boolean {
  const h = new Date().getHours();
  return h >= 8 && h <= 18;
}

const SUCCESS_MESSAGES: Record<string, string[]> = {
  login: [
    "Authentification réussie pour l'utilisateur",
    "Token JWT émis avec succès (exp: 3600s)",
    "Session créée — IP: 192.168.1.x",
  ],
  tokenRefresh: [
    "Token rafraîchi avec succès",
    "Refresh token valide, nouveau access token généré",
  ],
  validateToken: [
    "Token JWT valide — claims vérifiés",
    "Signature token vérifiée avec succès",
  ],
  getProfile: [
    "Profil utilisateur récupéré depuis le cache",
    "Profil utilisateur chargé depuis la base de données",
    "Cache HIT — user:profile:*",
  ],
  updateProfile: [
    "Profil mis à jour avec succès",
    "Données utilisateur sauvegardées en base",
  ],
  processPayment: [
    "Paiement traité avec succès — Transaction ID: TXN-*",
    "Autorisation bancaire reçue (code 00)",
    "Paiement validé — montant débité",
  ],
  refund: [
    "Remboursement initié avec succès",
    "Reversal envoyé à la banque",
  ],
  sendEmail: [
    "Email envoyé avec succès — SMTP 250 OK",
    "Email mis en file d'attente pour envoi",
  ],
  sendSMS: [
    "SMS envoyé avec succès — status: delivered",
    "SMS transmis à l'opérateur",
  ],
  trackEvent: [
    "Événement enregistré dans le flux Kafka",
    "Event batché — flush dans 5s",
    "Événement analytique persisté",
  ],
  routeRequest: [
    "Requête routée vers le service cible",
    "Route résolue — latence proxy: *ms",
  ],
  default: [
    "Opération complétée avec succès",
    "Traitement terminé",
    "Réponse envoyée au client",
  ],
};

const WARN_MESSAGES: string[] = [
  "Latence élevée détectée: *ms > seuil 500ms",
  "Tentative de reconnexion à Redis (tentative 2/3)",
  "Quota rate-limiting proche: 82% utilisé",
  "Temps de réponse dégradé — pool de connexions saturé",
  "Retry sur l'appel sortant (tentative 2/3)",
  "Cache manqué — fallback base de données",
  "Mémoire heap proche du maximum: 87%",
  "Certificat TLS expirant dans 12 jours",
];

const ERROR_MESSAGES: Record<string, string[]> = {
  processPayment: [
    "Paiement refusé — code: insufficient_funds",
    "Timeout gateway bancaire après 3000ms",
    "Erreur validation CVV — carte invalide",
    "Connexion Stripe échouée: Network Error",
  ],
  login: [
    "Échec authentification — mot de passe incorrect",
    "Compte verrouillé après 5 tentatives",
    "Token CSRF invalide",
  ],
  validateToken: [
    "Token JWT expiré — signature invalide",
    "Audience invalide dans le token",
  ],
  sendSMS: [
    "Quota SMS mensuel dépassé",
    "Numéro de téléphone invalide",
    "Opérateur SMS indisponible",
  ],
  default: [
    "Erreur interne du service",
    "Connexion base de données échouée: timeout",
    "Exception non gérée: NullPointerException",
    "Service dépendant indisponible — circuit breaker ouvert",
    "Timeout sur l'appel externe après 5000ms",
  ],
};

function resolveMessage(templates: string[], seed = ""): string {
  const msg = pickRandom(templates);
  return msg
    .replace("*", Math.floor(Math.random() * 900 + 100).toString())
    .replace("*", seed || randomUUID().substring(0, 8));
}

/**
 * Simulate one request to a service and record all telemetry
 */
export async function simulateRequest(service: ServiceConfig): Promise<{
  durationMs: number;
  isError: boolean;
  statusCode: number;
}> {
  const isPeak = isPeakHour();
  const operation = pickRandom(service.operations);
  const traceId = randomUUID();
  const spanId = randomUUID();

  // Compute realistic latency with jitter
  const targetLatency = isPeak ? service.peakLatencyMs : service.baseLatencyMs;
  const durationMs = Math.max(5, Math.floor(jitter(targetLatency)));

  // Determine if this request fails
  const errorRate = isPeak ? service.peakErrorRate : service.baseErrorRate;
  const isError = Math.random() < errorRate;
  const isTimeout = durationMs > 2000;

  const statusCode = isError ? (isTimeout ? 504 : pickRandom([400, 500, 502, 503])) : 200;
  const traceStatus: "ok" | "error" | "timeout" = isTimeout ? "timeout" : (isError ? "error" : "ok");

  // Determine log level
  let level: LogLevel = "INFO";
  let message: string;

  if (isError) {
    level = durationMs > 1500 ? "FATAL" : "ERROR";
    const errorPool = ERROR_MESSAGES[operation] ?? ERROR_MESSAGES["default"];
    message = resolveMessage(errorPool);
  } else if (durationMs > 500) {
    level = "WARN";
    message = resolveMessage(WARN_MESSAGES);
  } else if (Math.random() < 0.1) {
    level = "DEBUG";
    message = `[DEBUG] ${operation} — durée: ${durationMs}ms, trace: ${traceId.substring(0, 8)}`;
  } else {
    const pool = SUCCESS_MESSAGES[operation] ?? SUCCESS_MESSAGES["default"];
    message = resolveMessage(pool);
  }

  // Fire-and-forget: record telemetry without blocking the simulation
  Promise.all([
    recordLog(service.id, level, message, traceId, spanId, {
      operation,
      durationMs,
      statusCode,
      isPeak,
    }),
    recordTrace(service.id, operation, durationMs, traceStatus, traceId, spanId, undefined, {
      "http.status_code": statusCode,
      "http.method": pickRandom(["GET", "POST", "PUT", "DELETE"]),
      "service.version": "v2.3.1",
      "peak.hour": isPeak,
    }),
  ]).catch(() => {});

  return { durationMs, isError, statusCode };
}
