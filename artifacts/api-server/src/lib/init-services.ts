/**
 * Initialize service registry
 * Upserts the 6 monitored services into the DB on startup.
 * Does not generate fake logs or fake metrics — real data comes from the traffic generator.
 */
import {
  db,
  servicesTable,
  alertsTable,
  slosTable,
} from "@devops-observatory/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { SERVICES } from "./microservice-simulator";
import { isDemoModeEnabled } from "./runtime-config";

const SERVICE_META: Record<
  string,
  { team: string; description: string; version: string }
> = {
  "svc-api-gateway": {
    team: "Platform Team",
    description: "Primary entry point routing all client requests",
    version: "v3.1.2",
  },
  "svc-auth": {
    team: "Security Team",
    description: "OAuth2 / JWT authentication and authorization",
    version: "v2.4.0",
  },
  "svc-user": {
    team: "Core Team",
    description: "User account and profile management",
    version: "v1.9.3",
  },
  "svc-payment": {
    team: "Finance Team",
    description: "Payment processing and payment gateway integration",
    version: "v2.0.1",
  },
  "svc-notification": {
    team: "Core Team",
    description: "Multi-channel email, SMS, and push notifications",
    version: "v1.5.7",
  },
  "svc-analytics": {
    team: "Data Team",
    description: "Real-time business event collection and aggregation",
    version: "v1.2.4",
  },
};

export async function initServices(): Promise<void> {
  logger.info("Initializing service registry...");

  if (!isDemoModeEnabled()) {
    await Promise.all(
      SERVICES.map((svc) =>
        db
          .delete(servicesTable)
          .where(eq(servicesTable.id, svc.id))
          .catch(() => {}),
      ),
    );

    await db.delete(alertsTable).catch(() => {});
    await db.delete(slosTable).catch(() => {});

    logger.info(
      "Live mode enabled - waiting for external services to register through telemetry ingestion",
    );

    return;
  }

  for (const svc of SERVICES) {
    const meta = SERVICE_META[svc.id] ?? {
      team: "Platform Team",
      description: svc.name,
      version: "v1.0.0",
    };
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
      .onConflictDoUpdate({
        target: servicesTable.id,
        set: {
          name: svc.name,
          environment: "production",
          version: meta.version,
          team: meta.team,
          description: meta.description,
          updatedAt: new Date(),
        },
      });
  }

  // Clear old static alert/SLO seed data so the engines start fresh
  // Only delete rows that were created by the old seed (peakLoadPeriod=false AND status=resolved might be ok)
  // We simply delete and let the engines recreate them
  await db.delete(alertsTable).catch(() => {});
  await db.delete(slosTable).catch(() => {});

  logger.info(
    "Service registry initialized — alert and SLO engines will populate real data",
  );
}
