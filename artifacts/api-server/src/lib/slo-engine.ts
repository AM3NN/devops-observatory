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

import { db, slosTable, apmMetricsTable, logsTable } from "@workspace/db";
import { eq, and, gte, count } from "drizzle-orm";
import { logger } from "./logger";

interface SloDefinition {
  id: string;
  name: string;
  service: string;
  type: "availability" | "latency" | "error_rate" | "throughput";
  target: number;        // e.g. 99.9 means 99.9%
  windowMs: number;      // evaluation window in milliseconds
  window: string;        // human-readable
  responsible: string;
  description: string;
  latencyThresholdMs?: number;  // for latency SLOs
  minThroughput?: number;       // for throughput SLOs
}

const SLO_DEFINITIONS: SloDefinition[] = [
  {
    id: "slo-001",
    name: "API Gateway Disponibilité",
    service: "svc-api-gateway",
    type: "availability",
    target: 99.9,
    windowMs: 30 * 24 * 60 * 60_000,
    window: "30 jours",
    responsible: "Platform Team",
    description: "Disponibilité globale de l'API Gateway en production",
  },
  {
    id: "slo-002",
    name: "API Gateway Latence P95",
    service: "svc-api-gateway",
    type: "latency",
    target: 99.0,
    windowMs: 7 * 24 * 60 * 60_000,
    window: "7 jours",
    responsible: "Platform Team",
    description: "95% des requêtes traitées en moins de 500ms",
    latencyThresholdMs: 500,
  },
  {
    id: "slo-003",
    name: "Auth Service Disponibilité",
    service: "svc-auth",
    type: "availability",
    target: 99.99,
    windowMs: 30 * 24 * 60 * 60_000,
    window: "30 jours",
    responsible: "Security Team",
    description: "Haute disponibilité du service d'authentification",
  },
  {
    id: "slo-004",
    name: "Payment Taux d'Erreur",
    service: "svc-payment",
    type: "error_rate",
    target: 99.5,
    windowMs: 7 * 24 * 60 * 60_000,
    window: "7 jours",
    responsible: "Finance Team",
    description: "Maximum 0.5% de transactions en erreur",
  },
  {
    id: "slo-005",
    name: "User Service Disponibilité",
    service: "svc-user",
    type: "availability",
    target: 99.9,
    windowMs: 30 * 24 * 60 * 60_000,
    window: "30 jours",
    responsible: "Core Team",
    description: "Disponibilité du service utilisateurs",
  },
  {
    id: "slo-006",
    name: "Notification Throughput",
    service: "svc-notification",
    type: "throughput",
    target: 95.0,
    windowMs: 7 * 24 * 60 * 60_000,
    window: "7 jours",
    responsible: "Core Team",
    description: "95% des notifications envoyées dans les 30 secondes",
    minThroughput: 10,
  },
];

async function computeSloValue(slo: SloDefinition): Promise<{
  current: number;
  burnRate: number;
}> {
  const since = new Date(Date.now() - slo.windowMs);

  try {
    if (slo.type === "availability" || slo.type === "error_rate") {
      // Count total logs vs error logs for this service in the window
      const [totalRows, errorRows] = await Promise.all([
        db.select({ count: count() }).from(logsTable).where(
          and(eq(logsTable.service, slo.service), gte(logsTable.timestamp, since))
        ),
        db.select({ count: count() }).from(logsTable).where(
          and(
            eq(logsTable.service, slo.service),
            gte(logsTable.timestamp, since),
            eq(logsTable.level, "ERROR"),
          )
        ),
      ]);

      const total = totalRows[0]?.count ?? 0;
      const errors = errorRows[0]?.count ?? 0;

      if (total === 0) {
        // No data yet — return the target as current (optimistic)
        return { current: slo.target, burnRate: 0.1 };
      }

      const successRate = ((total - errors) / total) * 100;
      const current = Math.min(100, parseFloat(successRate.toFixed(3)));

      // Burn rate = how fast we're eating error budget
      const errorBudget = 100 - slo.target;
      const actualErrorRate = 100 - current;
      const burnRate = errorBudget > 0 ? actualErrorRate / errorBudget : 0;

      return { current, burnRate: parseFloat(burnRate.toFixed(2)) };

    } else if (slo.type === "latency") {
      // Use APM metrics to compute % of time response was below threshold
      const metrics = await db
        .select()
        .from(apmMetricsTable)
        .where(and(eq(apmMetricsTable.service, slo.service), gte(apmMetricsTable.timestamp, since)));

      if (metrics.length === 0) {
        return { current: slo.target, burnRate: 0.1 };
      }

      const threshold = slo.latencyThresholdMs ?? 500;
      const compliant = metrics.filter((m) => m.responseTime <= threshold).length;
      const current = parseFloat(((compliant / metrics.length) * 100).toFixed(3));

      const errorBudget = 100 - slo.target;
      const actualNonCompliance = 100 - current;
      const burnRate = errorBudget > 0 ? actualNonCompliance / errorBudget : 0;

      return { current, burnRate: parseFloat(burnRate.toFixed(2)) };

    } else {
      // throughput: check if avg throughput is above minimum
      const metrics = await db
        .select()
        .from(apmMetricsTable)
        .where(and(eq(apmMetricsTable.service, slo.service), gte(apmMetricsTable.timestamp, since)));

      if (metrics.length === 0) {
        return { current: slo.target, burnRate: 0.1 };
      }

      const minThroughput = slo.minThroughput ?? 10;
      const compliant = metrics.filter((m) => m.throughput >= minThroughput).length;
      const current = parseFloat(((compliant / metrics.length) * 100).toFixed(3));

      const errorBudget = 100 - slo.target;
      const actualNonCompliance = 100 - current;
      const burnRate = errorBudget > 0 ? actualNonCompliance / errorBudget : 0;

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
  const errorBudgetConsumed = errorBudget > 0
    ? Math.min(100, (actualErrorRate / errorBudget) * 100)
    : 0;

  let status: "met" | "at_risk" | "breached" = "met";
  if (burnRate > 5 || current < slo.target - (100 - slo.target)) {
    status = "breached";
  } else if (burnRate > 2 || errorBudgetConsumed > 50) {
    status = "at_risk";
  }

  // Upsert the SLO record
  const existing = await db.select().from(slosTable).where(eq(slosTable.id, slo.id));

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
    await db.update(slosTable).set({
      current,
      errorBudgetConsumed: parseFloat(errorBudgetConsumed.toFixed(2)),
      status,
      burnRate,
    }).where(eq(slosTable.id, slo.id));
  }
}

/**
 * Start the SLO engine — recomputes all SLOs every 2 minutes
 */
export function startSloEngine(): void {
  logger.info("SLO engine started");

  const runAll = async () => {
    for (const slo of SLO_DEFINITIONS) {
      await evaluateSlo(slo);
    }
  };

  // First computation after 15 seconds
  setTimeout(runAll, 15_000);

  // Then every 2 minutes
  setInterval(runAll, 2 * 60_000);
}
