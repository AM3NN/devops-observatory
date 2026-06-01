import { Router, type IRouter } from "express";
import {
  alertsTable,
  apmMetricsTable,
  db,
  incidentPredictionsTable,
  logsTable,
  servicesTable,
  slosTable,
} from "@devops-observatory/db";
import { desc, eq, gte } from "drizzle-orm";

const router: IRouter = Router();

function label(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function metricLine(
  name: string,
  labels: Record<string, string>,
  value: number,
) {
  const renderedLabels = Object.entries(labels)
    .map(([key, labelValue]) => `${key}="${label(labelValue)}"`)
    .join(",");

  return `${name}{${renderedLabels}} ${Number.isFinite(value) ? value : 0}`;
}

router.get("/metrics", async (_req, res): Promise<void> => {
  const now = new Date();
  const since1min = new Date(now.getTime() - 60_000);

  const [services, alerts, logsLastMinute, apmMetrics, slos, predictions] =
    await Promise.all([
      db.select().from(servicesTable),
      db.select().from(alertsTable).where(eq(alertsTable.status, "firing")),
      db.select().from(logsTable).where(gte(logsTable.timestamp, since1min)),
      db
        .select()
        .from(apmMetricsTable)
        .orderBy(desc(apmMetricsTable.timestamp))
        .limit(100),
      db.select().from(slosTable),
      db
        .select()
        .from(incidentPredictionsTable)
        .orderBy(desc(incidentPredictionsTable.generatedAt))
        .limit(100),
    ]);

  const latestApmByService = new Map<string, (typeof apmMetrics)[number]>();
  for (const metric of apmMetrics) {
    if (!latestApmByService.has(metric.service)) {
      latestApmByService.set(metric.service, metric);
    }
  }

  const latestPredictionByService = new Map<
    string,
    (typeof predictions)[number]
  >();
  for (const prediction of predictions) {
    if (!latestPredictionByService.has(prediction.service)) {
      latestPredictionByService.set(prediction.service, prediction);
    }
  }

  const lines = [
    "# HELP observatory_services_total Number of services by health status.",
    "# TYPE observatory_services_total gauge",
  ];

  for (const status of ["healthy", "degraded", "down"]) {
    lines.push(
      metricLine(
        "observatory_services_total",
        { status },
        services.filter((service) => service.status === status).length,
      ),
    );
  }

  lines.push(
    "# HELP observatory_alerts_active_total Number of active alerts by severity.",
    "# TYPE observatory_alerts_active_total gauge",
  );
  for (const severity of ["critical", "warning", "info"]) {
    lines.push(
      metricLine(
        "observatory_alerts_active_total",
        { severity },
        alerts.filter((alert) => alert.severity === severity).length,
      ),
    );
  }

  lines.push(
    "# HELP observatory_logs_last_minute_total Number of logs ingested in the last minute.",
    "# TYPE observatory_logs_last_minute_total gauge",
    `observatory_logs_last_minute_total ${logsLastMinute.length}`,
    "# HELP observatory_apm_response_time_ms Latest service response time in milliseconds.",
    "# TYPE observatory_apm_response_time_ms gauge",
  );

  for (const metric of latestApmByService.values()) {
    lines.push(
      metricLine(
        "observatory_apm_response_time_ms",
        { service: metric.service },
        metric.responseTime,
      ),
      metricLine(
        "observatory_apm_error_rate_percent",
        { service: metric.service },
        metric.errorRate,
      ),
      metricLine(
        "observatory_apm_cpu_usage_percent",
        { service: metric.service },
        metric.cpuUsage,
      ),
      metricLine(
        "observatory_apm_memory_usage_percent",
        { service: metric.service },
        metric.memoryUsage,
      ),
      metricLine(
        "observatory_apm_throughput_rpm",
        { service: metric.service },
        metric.throughput,
      ),
    );
  }

  lines.push(
    "# HELP observatory_slo_burn_rate Current SLO burn rate.",
    "# TYPE observatory_slo_burn_rate gauge",
  );
  for (const slo of slos) {
    lines.push(
      metricLine(
        "observatory_slo_burn_rate",
        { service: slo.service, slo: slo.name, status: slo.status },
        slo.burnRate,
      ),
      metricLine(
        "observatory_slo_error_budget_consumed_percent",
        { service: slo.service, slo: slo.name, status: slo.status },
        slo.errorBudgetConsumed,
      ),
    );
  }

  lines.push(
    "# HELP observatory_ai_incident_risk_score Latest AI incident risk score.",
    "# TYPE observatory_ai_incident_risk_score gauge",
  );
  for (const prediction of latestPredictionByService.values()) {
    lines.push(
      metricLine(
        "observatory_ai_incident_risk_score",
        { service: prediction.service, level: prediction.level },
        prediction.score,
      ),
      metricLine(
        "observatory_ai_incident_confidence_percent",
        { service: prediction.service, level: prediction.level },
        prediction.confidence,
      ),
    );
  }

  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(`${lines.join("\n")}\n`);
});

export default router;
