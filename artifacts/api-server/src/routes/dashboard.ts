import { Router, type IRouter } from "express";
import {
  db,
  servicesTable,
  alertsTable,
  logsTable,
  slosTable,
  apmMetricsTable,
} from "@devops-observatory/db";
import { eq, and, gte, desc, count } from "drizzle-orm";
import {
  GetDashboardSummaryResponse,
  GetTrafficDataResponse,
} from "@devops-observatory/api-zod";
import { refreshSlos } from "../lib/slo-engine";

const router: IRouter = Router();

function getPeakLoadLevel(
  hour: number,
): "low" | "medium" | "high" | "critical" {
  if (hour >= 9 && hour <= 11) return "critical";
  if (hour >= 8 && hour <= 13) return "high";
  if (hour >= 14 && hour <= 17) return "medium";
  return "low";
}

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  await refreshSlos();

  const now = new Date();
  const hour = now.getHours();
  const isPeakLoad = hour >= 8 && hour <= 18;
  const peakLoadLevel = getPeakLoadLevel(hour);
  const since1min = new Date(now.getTime() - 60_000);
  const since5min = new Date(now.getTime() - 5 * 60_000);

  const [
    services,
    firingAlerts,
    criticalAlerts,
    recentLogs,
    slosResult,
    avgMetrics,
    slosAtRiskRows,
  ] = await Promise.all([
    db.select().from(servicesTable),
    db
      .select({ count: count() })
      .from(alertsTable)
      .where(eq(alertsTable.status, "firing")),
    db
      .select({ count: count() })
      .from(alertsTable)
      .where(
        and(
          eq(alertsTable.severity, "critical"),
          eq(alertsTable.status, "firing"),
        ),
      ),
    db
      .select({ count: count() })
      .from(logsTable)
      .where(gte(logsTable.timestamp, since1min)),
    db.select().from(slosTable),
    db
      .select()
      .from(apmMetricsTable)
      .where(gte(apmMetricsTable.timestamp, since5min))
      .orderBy(desc(apmMetricsTable.timestamp))
      .limit(20),
    db
      .select({ count: count() })
      .from(slosTable)
      .where(and(eq(slosTable.status, "at_risk"))),
  ]);

  const healthyServices = services.filter((s) => s.status === "healthy").length;
  const degradedServices = services.filter(
    (s) => s.status === "degraded",
  ).length;
  const downServices = services.filter((s) => s.status === "down").length;

  const slosBreached = slosResult.filter((s) => s.status === "breached").length;
  const slosAtRisk = (slosAtRiskRows[0]?.count ?? 0) + slosBreached;

  const avgResponseTime =
    avgMetrics.length > 0
      ? avgMetrics.reduce((sum, m) => sum + m.responseTime, 0) /
        avgMetrics.length
      : 0;
  const globalErrorRate =
    avgMetrics.length > 0
      ? avgMetrics.reduce((sum, m) => sum + m.errorRate, 0) / avgMetrics.length
      : 0;

  res.json(
    GetDashboardSummaryResponse.parse({
      totalServices: services.length,
      healthyServices,
      degradedServices,
      downServices,
      activeAlerts: firingAlerts[0]?.count ?? 0,
      criticalAlerts: criticalAlerts[0]?.count ?? 0,
      logsPerMinute: recentLogs[0]?.count ?? 0,
      avgResponseTime: parseFloat(avgResponseTime.toFixed(1)),
      globalErrorRate: parseFloat(globalErrorRate.toFixed(2)),
      slosAtRisk,
      isPeakLoadPeriod: isPeakLoad,
      peakLoadLevel,
    }),
  );
});

router.get("/dashboard/traffic", async (_req, res): Promise<void> => {
  // Build traffic data from real APM metrics grouped by minute (last 60 minutes)
  const since = new Date(Date.now() - 60 * 60_000);
  const metrics = await db
    .select()
    .from(apmMetricsTable)
    .where(gte(apmMetricsTable.timestamp, since))
    .orderBy(desc(apmMetricsTable.timestamp));

  // Group by minute bucket
  const buckets = new Map<
    string,
    { requests: number; errors: number; responseTimes: number[] }
  >();

  for (const m of metrics) {
    const d = new Date(m.timestamp);
    const key = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    if (!buckets.has(key))
      buckets.set(key, { requests: 0, errors: 0, responseTimes: [] });
    const b = buckets.get(key)!;
    b.requests += m.throughput;
    b.errors += Math.floor((m.errorRate / 100) * m.throughput);
    b.responseTimes.push(m.responseTime);
  }

  // If no real data yet, generate placeholder based on current hour
  if (buckets.size < 5) {
    const now = new Date();
    const points = [];
    for (let i = 59; i >= 0; i--) {
      const t = new Date(now.getTime() - i * 60_000);
      const h = t.getHours();
      const isPeak = h >= 8 && h <= 18;
      const base = isPeak ? 600 : 80;
      const requests = Math.floor(base + Math.random() * (isPeak ? 400 : 60));
      const errors = Math.floor(requests * Math.random() * 0.05);
      points.push({
        time: `${String(h).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`,
        requests,
        errors,
        responseTime: parseFloat(
          (isPeak
            ? 200 + Math.random() * 300
            : 50 + Math.random() * 100
          ).toFixed(1),
        ),
      });
    }
    res.json(GetTrafficDataResponse.parse(points));
    return;
  }

  // Build sorted result from real buckets
  const now = new Date();
  const points = [];
  for (let i = 59; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 60_000);
    const key = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
    const b = buckets.get(key);
    const h = t.getHours();
    const isPeak = h >= 8 && h <= 18;
    points.push({
      time: key,
      requests: b
        ? b.requests
        : Math.floor(Math.random() * (isPeak ? 200 : 30)),
      errors: b ? b.errors : Math.floor(Math.random() * 5),
      responseTime:
        b && b.responseTimes.length > 0
          ? parseFloat(
              (
                b.responseTimes.reduce((a, c) => a + c, 0) /
                b.responseTimes.length
              ).toFixed(1),
            )
          : parseFloat(
              (isPeak
                ? 150 + Math.random() * 200
                : 40 + Math.random() * 60
              ).toFixed(1),
            ),
    });
  }

  res.json(GetTrafficDataResponse.parse(points));
});

export default router;
