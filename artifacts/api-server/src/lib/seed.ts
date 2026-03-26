import { db } from "@workspace/db";
import {
  servicesTable,
  logsTable,
  apmMetricsTable,
  tracesTable,
  alertsTable,
  slosTable,
} from "@workspace/db";
import { logger } from "./logger";

function randomBetween(min: number, max: number, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomId() {
  return Math.random().toString(36).substring(2, 10);
}

const SERVICES = [
  { id: "svc-api-gateway", name: "API Gateway", team: "Platform", description: "Point d'entrée principal pour toutes les requêtes clients" },
  { id: "svc-auth", name: "Auth Service", team: "Security", description: "Authentification et autorisation OAuth2/OIDC" },
  { id: "svc-user", name: "User Service", team: "Core", description: "Gestion des comptes et profils utilisateurs" },
  { id: "svc-payment", name: "Payment Service", team: "Finance", description: "Traitement des paiements et facturation" },
  { id: "svc-notification", name: "Notification Service", team: "Core", description: "Envoi d'emails, SMS et notifications push" },
  { id: "svc-analytics", name: "Analytics Service", team: "Data", description: "Collecte et analyse des événements métier" },
  { id: "svc-storage", name: "Storage Service", team: "Platform", description: "Gestion des fichiers et objets binaires" },
  { id: "svc-scheduler", name: "Job Scheduler", team: "Platform", description: "Orchestration des tâches planifiées" },
];

const LOG_MESSAGES = {
  INFO: [
    "Requête traitée avec succès",
    "Connexion établie avec la base de données",
    "Cache invalidé pour la clé user:profile",
    "Tâche planifiée exécutée: cleanup_sessions",
    "Nouveau token JWT émis pour l'utilisateur",
    "Déploiement de la version v2.3.1 complété",
    "Health check réussi",
    "Synchronisation des données terminée",
  ],
  WARN: [
    "Latence élevée détectée: 850ms > seuil 500ms",
    "Quota de rate limiting proche: 85% utilisé",
    "Tentative de reconnexion à Redis (tentative 2/3)",
    "Certificat SSL expire dans 15 jours",
    "Mémoire cache proche de la limite: 89%",
    "Pic de trafic détecté: +340% vs baseline",
  ],
  ERROR: [
    "Connexion à la base de données échouée: timeout",
    "Erreur de validation du token JWT: signature invalide",
    "Échec du paiement: carte refusée (code: insufficient_funds)",
    "Timeout sur l'appel externe à l'API Stripe",
    "Dépassement de quota pour le service SMS",
    "Erreur 500: NullPointerException dans UserService.getProfile()",
  ],
  DEBUG: [
    "Résolution DNS: api.stripe.com -> 3.33.15.1",
    "Pool de connexions: 8/20 actives",
    "Cache HIT pour la clé: products:featured",
    "Requête SQL: SELECT * FROM users WHERE id = ? (2ms)",
  ],
  FATAL: [
    "Espace disque critique: 2% restant",
    "Out of memory: le processus va être redémarré",
    "Impossible de se connecter au cluster Redis: toutes les connexions refusées",
  ],
};

const OPERATIONS = [
  "GET /api/users",
  "POST /api/auth/login",
  "GET /api/products",
  "POST /api/payments/charge",
  "GET /api/analytics/events",
  "PUT /api/users/:id",
  "DELETE /api/sessions/:id",
  "POST /api/notifications/send",
];

export async function seedDatabase() {
  try {
    const existingServices = await db.select().from(servicesTable).limit(1);
    if (existingServices.length > 0) {
      logger.info("Database already seeded, skipping");
      return;
    }

    logger.info("Seeding database...");

    const environments = ["production", "staging", "development"] as const;
    const statuses = ["healthy", "healthy", "healthy", "degraded", "down"] as const;

    for (const svc of SERVICES) {
      await db.insert(servicesTable).values({
        id: svc.id,
        name: svc.name,
        environment: randomItem([...environments]),
        status: randomItem([...statuses]),
        version: `v${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 20)}`,
        uptime: randomBetween(95, 99.99),
        responseTime: randomBetween(20, 450),
        errorRate: randomBetween(0.01, 2.5),
        requestsPerMin: randomBetween(100, 5000, 0),
        team: svc.team,
        description: svc.description,
      }).onConflictDoNothing();
    }

    const levels = ["DEBUG", "INFO", "INFO", "INFO", "WARN", "ERROR", "FATAL"] as const;
    const now = new Date();

    for (let i = 0; i < 200; i++) {
      const level = randomItem([...levels]);
      const messages = LOG_MESSAGES[level];
      const svc = randomItem(SERVICES);
      const tsOffset = Math.floor(Math.random() * 3600000);
      await db.insert(logsTable).values({
        id: `log-${randomId()}`,
        timestamp: new Date(now.getTime() - tsOffset),
        level,
        service: svc.id,
        message: randomItem(messages),
        traceId: `trace-${randomId()}`,
        spanId: `span-${randomId()}`,
        environment: randomItem(["production", "staging"]),
        metadata: { host: `node-${Math.floor(Math.random() * 10) + 1}`, pid: Math.floor(Math.random() * 30000) + 1000 },
      }).onConflictDoNothing();
    }

    for (const svc of SERVICES) {
      for (let i = 0; i < 24; i++) {
        const tsOffset = i * 3600000;
        const isPeak = i >= 8 && i <= 12;
        await db.insert(apmMetricsTable).values({
          id: `apm-${svc.id}-${i}`,
          service: svc.id,
          timestamp: new Date(now.getTime() - tsOffset),
          responseTime: randomBetween(isPeak ? 200 : 50, isPeak ? 800 : 300),
          throughput: randomBetween(isPeak ? 500 : 100, isPeak ? 2000 : 600),
          errorRate: randomBetween(isPeak ? 1 : 0.1, isPeak ? 5 : 1),
          cpuUsage: randomBetween(isPeak ? 60 : 20, isPeak ? 95 : 60),
          memoryUsage: randomBetween(isPeak ? 55 : 30, isPeak ? 85 : 65),
          activeConnections: randomBetween(isPeak ? 50 : 10, isPeak ? 200 : 80, 0),
        }).onConflictDoNothing();
      }
    }

    for (let i = 0; i < 50; i++) {
      const traceId = `trace-${randomId()}`;
      const svc = randomItem(SERVICES);
      await db.insert(tracesTable).values({
        traceId,
        spanId: `span-${randomId()}`,
        service: svc.id,
        operation: randomItem(OPERATIONS),
        duration: randomBetween(5, 2000),
        status: randomItem(["ok", "ok", "ok", "error", "timeout"]),
        timestamp: new Date(now.getTime() - Math.floor(Math.random() * 3600000)),
        tags: { "http.method": "GET", "http.status_code": 200 },
      }).onConflictDoNothing();
    }

    const alertDefs = [
      { id: "alert-001", title: "Latence élevée API Gateway", description: "Le temps de réponse moyen dépasse 800ms (seuil: 500ms) depuis 5 minutes", severity: "critical", service: "svc-api-gateway", peakLoadPeriod: true, runbook: "https://wiki.internal/runbooks/high-latency" },
      { id: "alert-002", title: "Taux d'erreur Payment Service élevé", description: "Taux d'erreur à 4.2% (seuil: 2%) - vérifier la connexion Stripe", severity: "critical", service: "svc-payment", peakLoadPeriod: true, runbook: "https://wiki.internal/runbooks/payment-errors" },
      { id: "alert-003", title: "Quota SMS proche", description: "85% du quota mensuel SMS consommé - 15 jours restants dans le mois", severity: "warning", service: "svc-notification", peakLoadPeriod: false, runbook: "https://wiki.internal/runbooks/sms-quota" },
      { id: "alert-004", title: "Certificat SSL expirant", description: "Le certificat SSL de auth.internal expire dans 14 jours", severity: "warning", service: "svc-auth", peakLoadPeriod: false, runbook: null },
      { id: "alert-005", title: "Job Scheduler injoignable", description: "Le service de planification ne répond plus depuis 2 minutes", severity: "critical", service: "svc-scheduler", peakLoadPeriod: false, runbook: "https://wiki.internal/runbooks/scheduler-down" },
      { id: "alert-006", title: "Pic de charge Analytics", description: "Throughput x3 par rapport à la baseline habituelle pour cette période", severity: "info", service: "svc-analytics", peakLoadPeriod: true, runbook: null },
    ];

    for (const alert of alertDefs) {
      await db.insert(alertsTable).values({
        ...alert,
        status: randomItem(["firing", "firing", "acknowledged", "resolved"]),
        firedAt: new Date(now.getTime() - Math.floor(Math.random() * 7200000)),
        labels: { team: "ops", env: "production" },
      }).onConflictDoNothing();
    }

    const sloDefs = [
      { id: "slo-001", name: "API Gateway Disponibilité", service: "svc-api-gateway", type: "availability", target: 99.9, current: 99.94, window: "30 jours", responsible: "Platform Team", description: "Disponibilité globale de l'API Gateway en production", burnRate: 0.12 },
      { id: "slo-002", name: "API Gateway Latence P99", service: "svc-api-gateway", type: "latency", target: 99.0, current: 96.2, window: "7 jours", responsible: "Platform Team", description: "95% des requêtes traitées en moins de 500ms", burnRate: 3.8 },
      { id: "slo-003", name: "Auth Service Disponibilité", service: "svc-auth", type: "availability", target: 99.99, current: 99.99, window: "30 jours", responsible: "Security Team", description: "Haute disponibilité de l'authentification", burnRate: 0.01 },
      { id: "slo-004", name: "Payment Taux d'Erreur", service: "svc-payment", type: "error_rate", target: 99.5, current: 95.8, window: "7 jours", responsible: "Finance Team", description: "Maximum 0.5% de transactions en erreur", burnRate: 7.4 },
      { id: "slo-005", name: "User Service Disponibilité", service: "svc-user", type: "availability", target: 99.9, current: 99.92, window: "30 jours", responsible: "Core Team", description: "Disponibilité du service utilisateurs", burnRate: 0.18 },
      { id: "slo-006", name: "Notification Throughput", service: "svc-notification", type: "throughput", target: 95.0, current: 93.1, window: "7 jours", responsible: "Core Team", description: "95% des notifications envoyées dans les 30 secondes", burnRate: 2.9 },
    ];

    for (const slo of sloDefs) {
      const errorBudget = 100 - slo.target;
      const errorBudgetConsumed = Math.max(0, ((slo.target - slo.current) / errorBudget) * 100);
      let status: "met" | "at_risk" | "breached" = "met";
      if (slo.burnRate > 5) status = "breached";
      else if (slo.burnRate > 2) status = "at_risk";

      await db.insert(slosTable).values({
        ...slo,
        errorBudget,
        errorBudgetConsumed,
        status,
      }).onConflictDoNothing();
    }

    logger.info("Database seeded successfully");
  } catch (err) {
    logger.error({ err }, "Failed to seed database");
  }
}
