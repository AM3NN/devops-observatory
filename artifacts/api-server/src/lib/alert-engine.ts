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

import {
  db,
  alertsTable,
  logsTable,
  apmMetricsTable,
  servicesTable,
} from "@devops-observatory/db";
import { eq, and, gte, desc, count } from "drizzle-orm";
import { logger } from "./logger";

interface AlertRule {
  id: string;
  title: string;
  description: (value: number) => string;
  severity: "critical" | "warning" | "info";
  service: string;
  peakLoadPeriod: boolean;
  runbook: string | null;
  check: () => Promise<{ firing: boolean; value: number; service?: string }>;
}

type EscalationLevel = "n1" | "n2" | "n3" | "management";

function getEscalationForAlert(
  severity: "critical" | "warning" | "info",
  firedAt: Date,
): { level: EscalationLevel; team: string; minutesOpen: number } {
  const minutesOpen = Math.max(
    0,
    Math.floor((Date.now() - firedAt.getTime()) / 60_000),
  );

  if (severity === "critical") {
    if (minutesOpen >= 60) {
      return { level: "management", team: "Management", minutesOpen };
    }

    if (minutesOpen >= 30) {
      return { level: "n3", team: "DevOps / Engineering", minutesOpen };
    }

    if (minutesOpen >= 15) {
      return { level: "n2", team: "Support N2", minutesOpen };
    }

    return { level: "n1", team: "Support N1", minutesOpen };
  }

  if (minutesOpen >= 30) {
    return { level: "n3", team: "DevOps / Engineering", minutesOpen };
  }

  if (minutesOpen >= 15) {
    return { level: "n2", team: "Support N2", minutesOpen };
  }

  return { level: "n1", team: "Support N1", minutesOpen };
}

function buildAlertLabels(
  baseLabels: Record<string, unknown>,
  severity: "critical" | "warning" | "info",
  firedAt: Date,
) {
  const escalation = getEscalationForAlert(severity, firedAt);

  return {
    ...baseLabels,
    escalationLevel: escalation.level,
    escalationTeam: escalation.team,
    minutesOpen: escalation.minutesOpen,
  };
}

function isPeakHour(): boolean {
  const h = new Date().getHours();
  return h >= 8 && h <= 18;
}

const ALERT_RULES: AlertRule[] = [
  {
    id: "alert-generic-error",
    title: "High Error Rate Detected",
    description: (v) =>
      `Error rate: ${v.toFixed(1)}% (threshold: 5%) across services`,
    severity: "critical",
    service: "any",
    peakLoadPeriod: true,
    runbook: null,
    check: async () => {
      const since = new Date(Date.now() - 10 * 60_000);
      const metrics = await db
        .select()
        .from(apmMetricsTable)
        .where(gte(apmMetricsTable.timestamp, since))
        .orderBy(desc(apmMetricsTable.timestamp))
        .limit(50);
      if (metrics.length === 0) return { firing: false, value: 0 };
      const byService = new Map<string, number[]>();
      for (const m of metrics) {
        if (!byService.has(m.service)) byService.set(m.service, []);
        byService.get(m.service)!.push(m.errorRate);
      }
      for (const [service, rates] of byService) {
        const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
        if (avg > 5) return { firing: true, value: avg, service };
      }
      return { firing: false, value: 0 };
    },
  },
  {
    id: "alert-001",
    title: "High API Gateway Latency",
    description: (v) =>
      `Average response time: ${v.toFixed(0)}ms (threshold: 500ms) over the last 5 minutes`,
    severity: "critical",
    service: "svc-api-gateway",
    peakLoadPeriod: true,
    runbook: "https://wiki.internal/runbooks/high-latency",
    check: async () => {
      const since = new Date(Date.now() - 5 * 60_000);
      const metrics = await db
        .select()
        .from(apmMetricsTable)
        .where(
          and(
            eq(apmMetricsTable.service, "svc-api-gateway"),
            gte(apmMetricsTable.timestamp, since),
          ),
        )
        .orderBy(desc(apmMetricsTable.timestamp))
        .limit(5);
      if (metrics.length === 0) return { firing: false, value: 0 };
      const avg =
        metrics.reduce((s, m) => s + m.responseTime, 0) / metrics.length;
      return { firing: avg > 500, value: avg };
    },
  },
  {
    id: "alert-002",
    title: "High Payment Service Error Rate",
    description: (v) =>
      `Error rate: ${v.toFixed(1)}% (threshold: 5%) - check the payment gateway connection`,
    severity: "critical",
    service: "svc-payment",
    peakLoadPeriod: true,
    runbook: "https://wiki.internal/runbooks/payment-errors",
    check: async () => {
      const since = new Date(Date.now() - 10 * 60_000);
      const metrics = await db
        .select()
        .from(apmMetricsTable)
        .where(
          and(
            eq(apmMetricsTable.service, "svc-payment"),
            gte(apmMetricsTable.timestamp, since),
          ),
        )
        .orderBy(desc(apmMetricsTable.timestamp))
        .limit(5);
      if (metrics.length === 0) return { firing: false, value: 0 };
      const avg = metrics.reduce((s, m) => s + m.errorRate, 0) / metrics.length;
      return { firing: avg > 5, value: avg };
    },
  },
  {
    id: "alert-003",
    title: "High CPU - User Service",
    description: (v) => `CPU usage: ${v.toFixed(0)}% (threshold: 85%)`,
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
    title: "High Global Error Rate",
    description: (v) =>
      `Error log rate (FATAL+ERROR): ${v} occurrences in 5 minutes`,
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
          and(gte(logsTable.timestamp, since), eq(logsTable.level, "ERROR")),
        );
      const errCount = rows[0]?.count ?? 0;
      return { firing: errCount > 10, value: errCount };
    },
  },
  {
    id: "alert-005",
    title: "Degraded Analytics Service",
    description: (v) =>
      `Analytics response time: ${v.toFixed(0)}ms (threshold: 1000ms)`,
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
      const avg =
        metrics.reduce((s, m) => s + m.responseTime, 0) / metrics.length;
      return { firing: avg > 1000, value: avg };
    },
  },
  {
    id: "alert-006",
    title: "Peak Load Detected",
    description: (_v) =>
      `A peak traffic period is active - increased monitoring is enabled`,
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
    const { firing, value, service: checkService } = await rule.check();
    const serviceName = checkService ?? rule.service;

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
        service: serviceName,
        firedAt: firing ? new Date() : new Date(0),
          resolvedAt: firing ? null : new Date(),
          peakLoadPeriod: rule.peakLoadPeriod && isPeakHour(),
          runbook: rule.runbook,
          labels: buildAlertLabels(
            { env: "production", team: "ops", auto: true, source: "rule-engine" },
            rule.severity,
            firing ? new Date() : new Date(0),
          ),
        });
        return;
      }

    const isCurrentlyFiring = existing.status === "firing";
    const isAcknowledged = existing.status === "acknowledged";

    if (firing && !isCurrentlyFiring) {
      // Transition: resolved → firing
      await db
        .update(alertsTable)
        .set({
          status: "firing",
          firedAt: new Date(),
          resolvedAt: null,
          acknowledgedAt: null,
          acknowledgedBy: null,
          description: rule.description(value),
          peakLoadPeriod: rule.peakLoadPeriod && isPeakHour(),
          labels: buildAlertLabels(
            { env: "production", team: "ops", auto: true, source: "rule-engine" },
            rule.severity,
            new Date(),
          ),
        })
        .where(eq(alertsTable.id, rule.id));

      logger.warn({ alertId: rule.id, value }, `Alert fired: ${rule.title}`);
    } else if (!firing && isCurrentlyFiring) {
      // Transition: firing → resolved
      await db
        .update(alertsTable)
        .set({
          status: "resolved",
          resolvedAt: new Date(),
        })
        .where(eq(alertsTable.id, rule.id));

      logger.info({ alertId: rule.id }, `Alert resolved: ${rule.title}`);
    } else if (firing && isCurrentlyFiring) {
      // Still firing — update description with latest value
      await db
        .update(alertsTable)
        .set({
          description: rule.description(value),
          labels: buildAlertLabels(
            ((existing.labels as Record<string, unknown> | null) ?? {
              env: "production",
              team: "ops",
              auto: true,
              source: "rule-engine",
            }) as Record<string, unknown>,
            rule.severity,
            existing.firedAt,
          ),
        })
        .where(eq(alertsTable.id, rule.id));
    }
  } catch (err) {
    logger.error({ err, ruleId: rule.id }, "Alert rule evaluation failed");
  }
}

async function syncServiceStatusAlerts(): Promise<void> {
  try {
    const services = await db.select().from(servicesTable);

    for (const service of services) {
      const alertId = `service-status-${service.id}`;
      const shouldFire =
        service.status === "degraded" || service.status === "down";
      const severity = service.status === "down" ? "critical" : "warning";
      const description =
        service.status === "down"
          ? `${service.name} is down. Latest response time is ${service.responseTime}ms with an error rate of ${service.errorRate}%.`
          : `${service.name} is degraded. Latest response time is ${service.responseTime}ms with an error rate of ${service.errorRate}%.`;

      const [existing] = await db
        .select()
        .from(alertsTable)
        .where(eq(alertsTable.id, alertId));

      if (!existing && shouldFire) {
        await db.insert(alertsTable).values({
          id: alertId,
          title: `${service.name} ${service.status === "down" ? "Down" : "Degraded"}`,
          description,
          severity,
          status: "firing",
          service: service.id,
          firedAt: new Date(),
          resolvedAt: null,
          acknowledgedAt: null,
          acknowledgedBy: null,
          peakLoadPeriod: false,
          runbook: null,
          labels: buildAlertLabels(
            {
              env: service.environment,
              team: service.team,
              auto: true,
              source: "service-registry",
            },
            severity,
            new Date(),
          ),
        });

        logger.warn(
          { alertId, service: service.id },
          "Service status alert fired",
        );
        continue;
      }

      if (!existing) {
        continue;
      }

      if (shouldFire) {
        await db
          .update(alertsTable)
          .set({
            title: `${service.name} ${service.status === "down" ? "Down" : "Degraded"}`,
            description,
            severity,
            status:
              existing.status === "acknowledged" ? existing.status : "firing",
            resolvedAt: null,
            peakLoadPeriod: false,
            labels: buildAlertLabels(
              {
                env: service.environment,
                team: service.team,
                auto: true,
                source: "service-registry",
              },
              severity,
              existing.firedAt,
            ),
          })
          .where(eq(alertsTable.id, alertId));

        continue;
      }

      if (existing.status !== "resolved") {
        await db
          .update(alertsTable)
          .set({
            status: "resolved",
            resolvedAt: new Date(),
          })
          .where(eq(alertsTable.id, alertId));

        logger.info(
          { alertId, service: service.id },
          "Service status alert resolved",
        );
      }
    }
  } catch (err) {
    logger.error({ err }, "Service status alert sync failed");
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

    await syncServiceStatusAlerts();
  };

  // Run immediately on start
  setTimeout(runAllRules, 5_000);

  // Then every 30 seconds
  setInterval(runAllRules, 30_000);
}
