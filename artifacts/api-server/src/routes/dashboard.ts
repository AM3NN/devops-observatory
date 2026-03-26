import { Router, type IRouter } from "express";
import { db, servicesTable, alertsTable, logsTable, slosTable, apmMetricsTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import { GetDashboardSummaryResponse, GetTrafficDataResponse } from "@workspace/api-zod";

const router: IRouter = Router();

function getPeakLoadLevel(hour: number): "low" | "medium" | "high" | "critical" {
  if (hour >= 9 && hour <= 11) return "critical";
  if (hour >= 8 && hour <= 13) return "high";
  if (hour >= 14 && hour <= 17) return "medium";
  return "low";
}

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const now = new Date();
  const hour = now.getHours();
  const isPeakLoad = hour >= 8 && hour <= 18;
  const peakLoadLevel = getPeakLoadLevel(hour);

  const [services, firingAlerts, criticalAlerts, recentLogs, slosResult, avgMetrics] = await Promise.all([
    db.select().from(servicesTable),
    db.select().from(alertsTable).where(eq(alertsTable.status, "firing")),
    db.select().from(alertsTable).where(and(eq(alertsTable.severity, "critical"), eq(alertsTable.status, "firing"))),
    db.select().from(logsTable).where(gte(logsTable.timestamp, new Date(now.getTime() - 60000))),
    db.select().from(slosTable),
    db.select().from(apmMetricsTable).orderBy(desc(apmMetricsTable.timestamp)).limit(10),
  ]);

  const healthyServices = services.filter(s => s.status === "healthy").length;
  const degradedServices = services.filter(s => s.status === "degraded").length;
  const downServices = services.filter(s => s.status === "down").length;
  const slosAtRisk = slosResult.filter(s => s.status !== "met").length;
  const avgResponseTime = avgMetrics.length > 0
    ? avgMetrics.reduce((sum, m) => sum + m.responseTime, 0) / avgMetrics.length
    : 0;
  const globalErrorRate = avgMetrics.length > 0
    ? avgMetrics.reduce((sum, m) => sum + m.errorRate, 0) / avgMetrics.length
    : 0;

  res.json(GetDashboardSummaryResponse.parse({
    totalServices: services.length,
    healthyServices,
    degradedServices,
    downServices,
    activeAlerts: firingAlerts.length,
    criticalAlerts: criticalAlerts.length,
    logsPerMinute: recentLogs.length + Math.floor(Math.random() * 20),
    avgResponseTime: parseFloat(avgResponseTime.toFixed(1)),
    globalErrorRate: parseFloat(globalErrorRate.toFixed(2)),
    slosAtRisk,
    isPeakLoadPeriod: isPeakLoad,
    peakLoadLevel,
  }));
});

router.get("/dashboard/traffic", async (_req, res): Promise<void> => {
  const now = new Date();
  const points = [];
  for (let i = 59; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 60000);
    const hour = t.getHours();
    const isPeak = hour >= 8 && hour <= 18;
    const base = isPeak ? 800 : 200;
    const variance = isPeak ? 400 : 100;
    const requests = Math.floor(base + Math.random() * variance);
    const errors = Math.floor(requests * (Math.random() * 0.05));
    const responseTime = parseFloat((isPeak ? 200 + Math.random() * 400 : 50 + Math.random() * 150).toFixed(1));
    points.push({
      time: `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`,
      requests,
      errors,
      responseTime,
    });
  }
  res.json(GetTrafficDataResponse.parse(points));
});

export default router;
