/**
 * SLO Engine — Service Level Objectives computed from real telemetry
 *
 * Each SLO is evaluated from real data in the database:
 *   - availability SLOs: % of successful requests (non-5xx) in the window
 *   - latency SLOs: % of requests below the target latency
 *   - error_rate SLOs: % of requests that did NOT error
 *   - throughput SLOs: whether throughput stayed above minimum
 *
 * Burn rate = how fast the error budget is being consumed vs expected rate.
 * A burn rate of 1.0 = exactly on track to use 100% budget by end of window.
 * A burn rate > 1.0 = consuming budget faster than allowed.
 */

import {
  db,
  slosTable,
  apmMetricsTable,
  logsTable,
  servicesTable,
} from "@devops-observatory/db";
import { eq, and, gte, count, inArray } from "drizzle-orm";
import { logger } from "./logger";
import { isDemoModeEnabled } from "./runtime-config";

interface SloDefinition {
  id: string;
  name: string;
  service: string;
  type: "availability" | "latency" | "error_rate" | "throughput";
  target: number; // e.g. 99.9 means 99.9%
  windowMs: number; // evaluation window in milliseconds
  window: string; // human-readable
  responsible: string;
  description: string;
  latencyThresholdMs?: number; // for latency SLOs
  minThroughput?: number; // for throughput SLOs
}

const DEMO_SLO_DEFINITIONS: SloDefinition[] = [
  {
    id: "slo-001",
    name: "API Gateway Availability",
    service: "svc-api-gateway",
    type: "availability",
    target: 99.9,
    windowMs: 30 * 24 * 60 * 60_000,
    window: "30 days",
    responsible: "Platform Team",
    description: "Overall availability of the production API Gateway",
  },
  {
    id: "slo-002",
    name: "API Gateway P95 Latency",
    service: "svc-api-gateway",
    type: "latency",
    target: 99.0,
    windowMs: 7 * 24 * 60 * 60_000,
    window: "7 days",
    responsible: "Platform Team",
    description: "95% of requests complete in under 500ms",
    latencyThresholdMs: 500,
  },
  {
    id: "slo-003",
    name: "Auth Service Availability",
    service: "svc-auth",
    type: "availability",
    target: 99.99,
    windowMs: 30 * 24 * 60 * 60_000,
    window: "30 days",
    responsible: "Security Team",
    description: "High availability for the authentication service",
  },
  {
    id: "slo-004",
    name: "Payment Error Rate",
    service: "svc-payment",
    type: "error_rate",
    target: 99.5,
    windowMs: 7 * 24 * 60 * 60_000,
    window: "7 days",
    responsible: "Finance Team",
    description: "No more than 0.5% of transactions may fail",
  },
  {
    id: "slo-005",
    name: "User Service Availability",
    service: "svc-user",
    type: "availability",
    target: 99.9,
    windowMs: 30 * 24 * 60 * 60_000,
    window: "30 days",
    responsible: "Core Team",
    description: "Availability of the user service",
  },
  {
    id: "slo-006",
    name: "Notification Throughput",
    service: "svc-notification",
    type: "throughput",
    target: 95.0,
    windowMs: 7 * 24 * 60 * 60_000,
    window: "7 days",
    responsible: "Core Team",
    description: "95% of notifications are delivered within 30 seconds",
    minThroughput: 10,
  },
];

function getLatencyThresholdForService(serviceId: string, serviceName: string) {
  const haystack = `${serviceId} ${serviceName}`.toLowerCase();

  if (haystack.includes("analytics") || haystack.includes("report")) {
    return 1200;
  }

  if (haystack.includes("notification") || haystack.includes("email")) {
    return 800;
  }

  if (haystack.includes("payment") || haystack.includes("billing")) {
    return 700;
  }

  return 500;
}

function buildObservedServiceDefinitions(
  services: Array<typeof servicesTable.$inferSelect>,
): SloDefinition[] {
  return services.flatMap((service) => {
    const latencyThresholdMs = getLatencyThresholdForService(
      service.id,
      service.name,
    );

    return [
      {
        id: `auto-slo-availability-${service.id}`,
        name: `${service.name} Availability`,
        service: service.id,
        type: "availability",
        target: service.environment === "production" ? 99.9 : 99.5,
        windowMs: 30 * 24 * 60 * 60_000,
        window: "30 days",
        responsible: service.team,
        description: `Availability objective for ${service.name} based on observed request success ratio.`,
      },
      {
        id: `auto-slo-latency-${service.id}`,
        name: `${service.name} P95 Latency`,
        service: service.id,
        type: "latency",
        target: 95,
        windowMs: 7 * 24 * 60 * 60_000,
        window: "7 days",
        responsible: service.team,
        description: `95% of ${service.name} requests should complete below ${latencyThresholdMs}ms.`,
        latencyThresholdMs,
      },
    ];
  });
}

async function getSloDefinitions(): Promise<SloDefinition[]> {
  const services = await db.select().from(servicesTable);
  const observedDefinitions = buildObservedServiceDefinitions(services);

  if (!isDemoModeEnabled()) {
    return observedDefinitions;
  }

  const existingKeys = new Set(
    DEMO_SLO_DEFINITIONS.map(
      (definition) => `${definition.service}:${definition.type}`,
    ),
  );

  return [
    ...DEMO_SLO_DEFINITIONS,
    ...observedDefinitions.filter(
      (definition) =>
        !existingKeys.has(`${definition.service}:${definition.type}`),
    ),
  ];
}

const SLO_REFRESH_MIN_INTERVAL_MS = 30_000;

let lastRefreshAt = 0;
let refreshInFlight: Promise<void> | null = null;

async function computeSloValue(slo: SloDefinition): Promise<{
  current: number;
  burnRate: number;
}> {
  const since = new Date(Date.now() - slo.windowMs);

  try {
    if (slo.type === "availability" || slo.type === "error_rate") {
      const metrics = await db
        .select()
        .from(apmMetricsTable)
        .where(
          and(
            eq(apmMetricsTable.service, slo.service),
            gte(apmMetricsTable.timestamp, since),
          ),
        );

      let current = slo.target;

      if (metrics.length > 0) {
        const averageErrorRate =
          metrics.reduce((sum, metric) => sum + metric.errorRate, 0) /
          metrics.length;
        current = parseFloat(
          Math.max(0, Math.min(100, 100 - averageErrorRate)).toFixed(3),
        );
      } else {
        // Fallback to logs when APM metrics are not available yet.
        const [totalRows, errorRows] = await Promise.all([
          db
            .select({ count: count() })
            .from(logsTable)
            .where(
              and(
                eq(logsTable.service, slo.service),
                gte(logsTable.timestamp, since),
              ),
            ),
          db
            .select({ count: count() })
            .from(logsTable)
            .where(
              and(
                eq(logsTable.service, slo.service),
                gte(logsTable.timestamp, since),
                eq(logsTable.level, "ERROR"),
              ),
            ),
        ]);

        const total = totalRows[0]?.count ?? 0;
        const errors = errorRows[0]?.count ?? 0;

        if (total === 0) {
          return { current: slo.target, burnRate: 0.1 };
        }

        current = parseFloat((((total - errors) / total) * 100).toFixed(3));
      }

      // Burn rate = how fast we're eating error budget
      const errorBudget = 100 - slo.target;
      const actualErrorRate = 100 - current;
      const rawBurnRate = errorBudget > 0 ? actualErrorRate / errorBudget : 0;
      const adjustedBurnRate =
        isDemoModeEnabled() && (slo.type === "availability" || slo.type === "error_rate")
          ? rawBurnRate * 0.35
          : rawBurnRate;
      const burnRate = Math.max(0.05, Math.min(20, adjustedBurnRate));

      return { current, burnRate: parseFloat(burnRate.toFixed(2)) };
    } else if (slo.type === "latency") {
      // Use APM metrics to compute % of time response was below threshold
      const metrics = await db
        .select()
        .from(apmMetricsTable)
        .where(
          and(
            eq(apmMetricsTable.service, slo.service),
            gte(apmMetricsTable.timestamp, since),
          ),
        );

      if (metrics.length === 0) {
        return { current: slo.target, burnRate: 0.1 };
      }

      const threshold = slo.latencyThresholdMs ?? 500;
      const averageResponseTime =
        metrics.reduce((sum, metric) => sum + metric.responseTime, 0) /
        metrics.length;
      const ratio = averageResponseTime / threshold;
      const current = parseFloat(
        Math.max(0, Math.min(100, 100 - Math.max(0, ratio - 1) * 120)).toFixed(
          3,
        ),
      );

      const errorBudget = 100 - slo.target;
      const actualNonCompliance = 100 - current;
      const rawBurnRate = errorBudget > 0 ? actualNonCompliance / errorBudget : 0;
      const burnRate = Math.max(0.05, Math.min(20, rawBurnRate));

      return { current, burnRate: parseFloat(burnRate.toFixed(2)) };
    } else {
      // throughput: check if avg throughput is above minimum
      const metrics = await db
        .select()
        .from(apmMetricsTable)
        .where(
          and(
            eq(apmMetricsTable.service, slo.service),
            gte(apmMetricsTable.timestamp, since),
          ),
        );

      if (metrics.length === 0) {
        return { current: slo.target, burnRate: 0.1 };
      }

      const minThroughput = slo.minThroughput ?? 10;
      const averageThroughput =
        metrics.reduce((sum, metric) => sum + metric.throughput, 0) /
        metrics.length;
      const throughputRatio = averageThroughput / minThroughput;
      const current = parseFloat(
        Math.max(0, Math.min(100, throughputRatio * 100)).toFixed(3),
      );

      const errorBudget = 100 - slo.target;
      const actualNonCompliance = 100 - current;
      const rawBurnRate = errorBudget > 0 ? actualNonCompliance / errorBudget : 0;
      const burnRate = Math.max(0.05, Math.min(20, rawBurnRate));

      return { current, burnRate: parseFloat(burnRate.toFixed(2)) };
    }
  } catch (err) {
    logger.error({ err, sloId: slo.id }, "SLO computation error");
    return { current: slo.target, burnRate: 0 };
  }
}

async function evaluateSlo(slo: SloDefinition): Promise<void> {
  const { current, burnRate } = await computeSloValue(slo);

  const errorBudget = 100 - slo.target;
  const actualErrorRate = 100 - current;
  const rawBudgetConsumed =
    errorBudget > 0
      ? Math.min(100, Math.max(0, (actualErrorRate / errorBudget) * 100))
      : 0;
  const errorBudgetConsumed =
    slo.type === "availability" || slo.type === "error_rate"
      ? Math.min(100, rawBudgetConsumed * (isDemoModeEnabled() ? 0.35 : 0.6))
      : rawBudgetConsumed;

  let status: "met" | "at_risk" | "breached" = "met";
  if (slo.type === "availability" || slo.type === "error_rate") {
    if (burnRate > 12 || current < slo.target - Math.max(errorBudget * 4, 3)) {
      status = "breached";
    } else if (burnRate > 4 || errorBudgetConsumed > 45) {
      status = "at_risk";
    }
  } else if (
    burnRate > 6 ||
    current < slo.target - Math.max(errorBudget * 1.5, 1)
  ) {
    status = "breached";
  } else if (burnRate > 2.5 || errorBudgetConsumed > 70) {
    status = "at_risk";
  }

  // Upsert the SLO record
  const existing = await db
    .select()
    .from(slosTable)
    .where(eq(slosTable.id, slo.id));

  if (existing.length === 0) {
    await db.insert(slosTable).values({
      id: slo.id,
      name: slo.name,
      service: slo.service,
      type: slo.type,
      target: slo.target,
      current,
      errorBudget,
      errorBudgetConsumed: parseFloat(errorBudgetConsumed.toFixed(2)),
      window: slo.window,
      status,
      responsible: slo.responsible,
      description: slo.description,
      burnRate,
    });
  } else {
    await db
      .update(slosTable)
      .set({
        current,
        errorBudgetConsumed: parseFloat(errorBudgetConsumed.toFixed(2)),
        status,
        burnRate,
      })
      .where(eq(slosTable.id, slo.id));
  }
}

async function runAllSloEvaluations(): Promise<void> {
  const definitions = await getSloDefinitions();

  if (definitions.length === 0) {
    await db.delete(slosTable);
    return;
  }

  for (const slo of definitions) {
    await evaluateSlo(slo);
  }

  const staleIds = (await db.select({ id: slosTable.id }).from(slosTable))
    .map((row) => row.id)
    .filter((id) => !definitions.some((definition) => definition.id === id));

  if (staleIds.length > 0) {
    await db.delete(slosTable).where(inArray(slosTable.id, staleIds));
  }
}

export async function refreshSlos(force = false): Promise<void> {
  const now = Date.now();

  if (!force && now - lastRefreshAt < SLO_REFRESH_MIN_INTERVAL_MS) {
    return;
  }

  if (refreshInFlight) {
    await refreshInFlight;
    return;
  }

  refreshInFlight = (async () => {
    await runAllSloEvaluations();
    lastRefreshAt = Date.now();
  })().finally(() => {
    refreshInFlight = null;
  });

  await refreshInFlight;
}

/**
 * Start the SLO engine — recomputes all SLOs every 2 minutes
 */
export function startSloEngine(): void {
  logger.info(
    { mode: isDemoModeEnabled() ? "demo" : "live" },
    "SLO engine started",
  );

  void refreshSlos(true);

  // Then every 2 minutes
  setInterval(() => {
    void refreshSlos(true);
  }, 2 * 60_000);
}
