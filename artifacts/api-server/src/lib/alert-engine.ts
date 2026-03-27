/**
 * Alert Engine
 *
 * Real alerting system that evaluates metrics every 30 seconds.
 * Rules are defined as functions that query the database and
 * return whether an alert should be firing.
 *
 * Each rule:
 *   - Has a unique ID (matches a row in the alerts table)
 *   - Evaluates based on real data from logs / apm_metrics / services
 *   - Auto-fires when threshold exceeded
 *   - Auto-resolves when the condition clears
 */

import { db, alertsTable, logsTable, apmMetricsTable, servicesTable } from "@workspace/db";
import { eq, and, gte, desc, count } from "drizzle-orm";
import { logger } from "./logger";
import { randomUUID } from "crypto";

interface AlertRule {
  id: string;
  title: string;
  description: (value: number) => string;
  severity: "critical" | "warning" | "info";
  service: string;
  peakLoadPeriod: boolean;
  runbook: string | null;
  check: () => Promise<{ firing: boolean; value: number }>;
}

function isPeakHour(): boolean {
  const h = new Date().getHours();
  return h >= 8 && h <= 18;
}

const ALERT_RULES: AlertRule[] = [
  {
    id: "alert-001",
    title: "Latence élevée API Gateway",
    description: (v) => `Temps de réponse moyen: ${v.toFixed(0)}ms (seuil: 500ms) sur les 5 dernières minutes`,
    severity: "critical",
    service: "svc-api-gateway",
    peakLoadPeriod: true,
    runbook: "https://wiki.internal/runbooks/high-latency",
    check: async () => {
      const since = new Date(Date.now() - 5 * 60_000);
      const metrics = await db
        .select()
        .from(apmMetricsTable)
        .where(and(eq(apmMetricsTable.service, "svc-api-gateway"), gte(apmMetricsTable.timestamp, since)))
        .orderBy(desc(apmMetricsTable.timestamp))
        .limit(5);
      if (metrics.length === 0) return { firing: false, value: 0 };
      const avg = metrics.reduce((s, m) => s + m.responseTime, 0) / metrics.length;
      return { firing: avg > 500, value: avg };
    },
  },
  {
    id: "alert-002",
    title: "Taux d'erreur Payment Service élevé",
    description: (v) => `Taux d'erreur: ${v.toFixed(1)}% (seuil: 5%) — vérifier la connexion gateway`,
    severity: "critical",
    service: "svc-payment",
    peakLoadPeriod: true,
    runbook: "https://wiki.internal/runbooks/payment-errors",
    check: async () => {
      const since = new Date(Date.now() - 10 * 60_000);
      const metrics = await db
        .select()
        .from(apmMetricsTable)
        .where(and(eq(apmMetricsTable.service, "svc-payment"), gte(apmMetricsTable.timestamp, since)))
        .orderBy(desc(apmMetricsTable.timestamp))
        .limit(5);
      if (metrics.length === 0) return { firing: false, value: 0 };
      const avg = metrics.reduce((s, m) => s + m.errorRate, 0) / metrics.length;
      return { firing: avg > 5, value: avg };
    },
  },
  {
    id: "alert-003",
    title: "CPU élevé — User Service",
    description: (v) => `Utilisation CPU: ${v.toFixed(0)}% (seuil: 85%)`,
    severity: "warning",
    service: "svc-user",
    peakLoadPeriod: false,
    runbook: null,
    check: async () => {
      const metrics = await db
        .select()
        .from(apmMetricsTable)
        .where(eq(apmMetricsTable.service, "svc-user"))
        .orderBy(desc(apmMetricsTable.timestamp))
        .limit(3);
      if (metrics.length === 0) return { firing: false, value: 0 };
      const avg = metrics.reduce((s, m) => s + m.cpuUsage, 0) / metrics.length;
      return { firing: avg > 85, value: avg };
    },
  },
  {
    id: "alert-004",
    title: "Taux d'erreur global élevé",
    description: (v) => `Taux d'erreur logs (FATAL+ERROR): ${v} occurrences en 5 minutes`,
    severity: "warning",
    service: "svc-api-gateway",
    peakLoadPeriod: false,
    runbook: null,
    check: async () => {
      const since = new Date(Date.now() - 5 * 60_000);
      const rows = await db
        .select({ count: count() })
        .from(logsTable)
        .where(
          and(
            gte(logsTable.timestamp, since),
            eq(logsTable.level, "ERROR"),
          ),
        );
      const errCount = rows[0]?.count ?? 0;
      return { firing: errCount > 10, value: errCount };
    },
  },
  {
    id: "alert-005",
    title: "Service Analytics dégradé",
    description: (v) => `Temps de réponse Analytics: ${v.toFixed(0)}ms (seuil: 1000ms)`,
    severity: "critical",
    service: "svc-analytics",
    peakLoadPeriod: false,
    runbook: "https://wiki.internal/runbooks/analytics-degraded",
    check: async () => {
      const metrics = await db
        .select()
        .from(apmMetricsTable)
        .where(eq(apmMetricsTable.service, "svc-analytics"))
        .orderBy(desc(apmMetricsTable.timestamp))
        .limit(3);
      if (metrics.length === 0) return { firing: false, value: 0 };
      const avg = metrics.reduce((s, m) => s + m.responseTime, 0) / metrics.length;
      return { firing: avg > 1000, value: avg };
    },
  },
  {
    id: "alert-006",
    title: "Pic de charge détecté",
    description: (_v) => `Période de montée en charge active — surveillance renforcée`,
    severity: "info",
    service: "svc-api-gateway",
    peakLoadPeriod: true,
    runbook: null,
    check: async () => {
      const peak = isPeakHour();
      return { firing: peak, value: peak ? 1 : 0 };
    },
  },
];

async function evaluateRule(rule: AlertRule): Promise<void> {
  try {
    const { firing, value } = await rule.check();

    const [existing] = await db
      .select()
      .from(alertsTable)
      .where(eq(alertsTable.id, rule.id));

    if (!existing) {
      // Insert new alert row
      await db.insert(alertsTable).values({
        id: rule.id,
        title: rule.title,
        description: rule.description(value),
        severity: rule.severity,
        status: firing ? "firing" : "resolved",
        service: rule.service,
        firedAt: firing ? new Date() : new Date(0),
        resolvedAt: firing ? null : new Date(),
        peakLoadPeriod: rule.peakLoadPeriod && isPeakHour(),
        runbook: rule.runbook,
        labels: { env: "production", team: "ops", auto: true },
      });
      return;
    }

    const isCurrentlyFiring = existing.status === "firing";
    const isAcknowledged = existing.status === "acknowledged";

    if (firing && !isCurrentlyFiring && !isAcknowledged) {
      // Transition: resolved → firing
      await db.update(alertsTable).set({
        status: "firing",
        firedAt: new Date(),
        resolvedAt: null,
        acknowledgedAt: null,
        acknowledgedBy: null,
        description: rule.description(value),
        peakLoadPeriod: rule.peakLoadPeriod && isPeakHour(),
      }).where(eq(alertsTable.id, rule.id));

      logger.warn({ alertId: rule.id, value }, `Alert fired: ${rule.title}`);
    } else if (!firing && isCurrentlyFiring) {
      // Transition: firing → resolved
      await db.update(alertsTable).set({
        status: "resolved",
        resolvedAt: new Date(),
      }).where(eq(alertsTable.id, rule.id));

      logger.info({ alertId: rule.id }, `Alert resolved: ${rule.title}`);
    } else if (firing && isCurrentlyFiring) {
      // Still firing — update description with latest value
      await db.update(alertsTable).set({
        description: rule.description(value),
      }).where(eq(alertsTable.id, rule.id));
    }
  } catch (err) {
    logger.error({ err, ruleId: rule.id }, "Alert rule evaluation failed");
  }
}

/**
 * Start the alert engine — evaluates all rules every 30 seconds
 */
export function startAlertEngine(): void {
  logger.info("Alert engine started");

  const runAllRules = async () => {
    for (const rule of ALERT_RULES) {
      await evaluateRule(rule);
    }
  };

  // Run immediately on start
  setTimeout(runAllRules, 5_000);

  // Then every 30 seconds
  setInterval(runAllRules, 30_000);
}
