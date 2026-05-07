import {
  alertsTable,
  apmMetricsTable,
  db,
  logsTable,
  servicesTable,
  slosTable,
} from "@devops-observatory/db";
import { and, desc, eq, gte, inArray } from "drizzle-orm";

type RiskLevel = "low" | "medium" | "high";

export type IncidentPrediction = {
  service: string;
  serviceName: string;
  score: number;
  level: RiskLevel;
  horizonMinutes: number;
  confidence: number;
  reasons: string[];
  signals: {
    latencyTrendPct: number;
    errorRateTrendPct: number;
    cpuUsage: number;
    memoryUsage: number;
    sloBurnRate: number;
    recentErrorLogs: number;
  };
  generatedAt: string;
};

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function trendPct(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getLevel(score: number): RiskLevel {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function getHorizonMinutes(score: number) {
  if (score >= 85) return 15;
  if (score >= 70) return 30;
  if (score >= 40) return 60;
  return 120;
}

export async function getIncidentPredictions(): Promise<IncidentPrediction[]> {
  const now = new Date();
  const since60min = new Date(now.getTime() - 60 * 60_000);
  const since30min = new Date(now.getTime() - 30 * 60_000);
  const since15min = new Date(now.getTime() - 15 * 60_000);

  const [services, metrics, slos, firingAlerts, recentErrorLogs] =
    await Promise.all([
      db.select().from(servicesTable),
      db
        .select()
        .from(apmMetricsTable)
        .where(gte(apmMetricsTable.timestamp, since60min))
        .orderBy(desc(apmMetricsTable.timestamp)),
      db.select().from(slosTable),
      db.select().from(alertsTable).where(eq(alertsTable.status, "firing")),
      db
        .select()
        .from(logsTable)
        .where(
          and(
            gte(logsTable.timestamp, since15min),
            inArray(logsTable.level, ["ERROR", "FATAL"]),
          ),
        ),
    ]);

  const generatedAt = now.toISOString();

  return services
    .map((service) => {
      const serviceMetrics = metrics.filter(
        (metric) => metric.service === service.id,
      );
      const recentMetrics = serviceMetrics.filter(
        (metric) => metric.timestamp >= since15min,
      );
      const previousMetrics = serviceMetrics.filter(
        (metric) =>
          metric.timestamp < since15min && metric.timestamp >= since30min,
      );
      const serviceSlos = slos.filter((slo) => slo.service === service.id);
      const serviceAlerts = firingAlerts.filter(
        (alert) => alert.service === service.id,
      );
      const errorLogCount = recentErrorLogs.filter(
        (log) => log.service === service.id,
      ).length;

      const recentLatency = average(
        recentMetrics.map((metric) => metric.responseTime),
      );
      const previousLatency = average(
        previousMetrics.map((metric) => metric.responseTime),
      );
      const recentErrorRate = average(
        recentMetrics.map((metric) => metric.errorRate),
      );
      const previousErrorRate = average(
        previousMetrics.map((metric) => metric.errorRate),
      );
      const cpuUsage = average(recentMetrics.map((metric) => metric.cpuUsage));
      const memoryUsage = average(
        recentMetrics.map((metric) => metric.memoryUsage),
      );
      const maxBurnRate = Math.max(
        0,
        ...serviceSlos.map((slo) => slo.burnRate),
      );
      const latencyTrend = trendPct(recentLatency, previousLatency);
      const errorRateTrend = trendPct(recentErrorRate, previousErrorRate);

      let score = 0;
      const reasons: string[] = [];

      if (latencyTrend >= 25 && recentLatency >= 250) {
        score += 25;
        reasons.push("Latency is increasing compared with the previous window");
      }

      if (errorRateTrend >= 20 && recentErrorRate >= 2) {
        score += 25;
        reasons.push("Error rate is trending upward");
      }

      if (maxBurnRate >= 2) {
        score += maxBurnRate >= 5 ? 25 : 15;
        reasons.push("SLO burn rate is above the safe threshold");
      }

      if (cpuUsage >= 85 || memoryUsage >= 90) {
        score += 20;
        reasons.push("Resource saturation is approaching a critical level");
      }

      if (errorLogCount >= 5) {
        score += errorLogCount >= 15 ? 20 : 10;
        reasons.push("Recent application logs contain repeated errors");
      }

      if (service.status === "degraded") {
        score += 15;
        reasons.push("Service registry already reports degradation");
      } else if (service.status === "down") {
        score += 35;
        reasons.push("Service registry reports the service as down");
      }

      if (serviceAlerts.length > 0) {
        score += serviceAlerts.some((alert) => alert.severity === "critical")
          ? 15
          : 8;
        reasons.push("Active alerts are already firing for this service");
      }

      const finalScore = Math.round(clamp(score, 0, 100));
      const hasRecentData = recentMetrics.length > 0 || errorLogCount > 0;

      return {
        service: service.id,
        serviceName: service.name,
        score: finalScore,
        level: getLevel(finalScore),
        horizonMinutes: getHorizonMinutes(finalScore),
        confidence: hasRecentData
          ? clamp(65 + recentMetrics.length * 2, 65, 95)
          : 40,
        reasons:
          reasons.length > 0
            ? reasons
            : [
                "No significant degradation trend detected in the latest window",
              ],
        signals: {
          latencyTrendPct: Number(latencyTrend.toFixed(1)),
          errorRateTrendPct: Number(errorRateTrend.toFixed(1)),
          cpuUsage: Number(cpuUsage.toFixed(1)),
          memoryUsage: Number(memoryUsage.toFixed(1)),
          sloBurnRate: Number(maxBurnRate.toFixed(2)),
          recentErrorLogs: errorLogCount,
        },
        generatedAt,
      } satisfies IncidentPrediction;
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.serviceName.localeCompare(right.serviceName),
    );
}
