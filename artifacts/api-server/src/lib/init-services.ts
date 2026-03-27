/**
 * Initialize service registry
 * Upserts the 6 monitored services into the DB on startup.
 * Does not generate fake logs or fake metrics — real data comes from the traffic generator.
 */
import { db, servicesTable, alertsTable, slosTable } from "@workspace/db";
import { logger } from "./logger";
import { SERVICES } from "./microservice-simulator";

const SERVICE_META: Record<string, { team: string; description: string; version: string }> = {
  "svc-api-gateway": {
    team: "Platform Team",
    description: "Point d'entrée principal — routage de toutes les requêtes client",
    version: "v3.1.2",
  },
  "svc-auth": {
    team: "Security Team",
    description: "Authentification et autorisation OAuth2 / JWT",
    version: "v2.4.0",
  },
  "svc-user": {
    team: "Core Team",
    description: "Gestion des comptes et profils utilisateurs",
    version: "v1.9.3",
  },
  "svc-payment": {
    team: "Finance Team",
    description: "Traitement des paiements et intégration gateway bancaire",
    version: "v2.0.1",
  },
  "svc-notification": {
    team: "Core Team",
    description: "Envoi d'emails, SMS et notifications push multi-canal",
    version: "v1.5.7",
  },
  "svc-analytics": {
    team: "Data Team",
    description: "Collecte et agrégation des événements métier en temps réel",
    version: "v1.2.4",
  },
};

export async function initServices(): Promise<void> {
  logger.info("Initializing service registry...");

  for (const svc of SERVICES) {
    const meta = SERVICE_META[svc.id] ?? { team: "Platform Team", description: svc.name, version: "v1.0.0" };
    await db
      .insert(servicesTable)
      .values({
        id: svc.id,
        name: svc.name,
        environment: "production",
        status: "healthy",
        version: meta.version,
        uptime: 99.9,
        responseTime: svc.baseLatencyMs,
        errorRate: svc.baseErrorRate * 100,
        requestsPerMin: 0,
        team: meta.team,
        description: meta.description,
        updatedAt: new Date(),
      })
      .onConflictDoNothing();
  }

  // Clear old static alert/SLO seed data so the engines start fresh
  // Only delete rows that were created by the old seed (peakLoadPeriod=false AND status=resolved might be ok)
  // We simply delete and let the engines recreate them
  await db.delete(alertsTable).catch(() => {});
  await db.delete(slosTable).catch(() => {});

  logger.info("Service registry initialized — alert and SLO engines will populate real data");
}
