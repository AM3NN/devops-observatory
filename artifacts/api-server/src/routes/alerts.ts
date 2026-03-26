import { Router, type IRouter } from "express";
import { db, alertsTable } from "@workspace/db";
import { desc, eq, and, type SQL } from "drizzle-orm";
import { GetAlertsResponse, AcknowledgeAlertResponse } from "@workspace/api-zod";

const router: IRouter = Router();

function formatAlert(a: typeof alertsTable.$inferSelect) {
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    severity: a.severity,
    status: a.status,
    service: a.service,
    firedAt: a.firedAt.toISOString(),
    peakLoadPeriod: a.peakLoadPeriod ?? false,
    ...(a.resolvedAt ? { resolvedAt: a.resolvedAt.toISOString() } : {}),
    ...(a.acknowledgedAt ? { acknowledgedAt: a.acknowledgedAt.toISOString() } : {}),
    ...(a.acknowledgedBy ? { acknowledgedBy: a.acknowledgedBy } : {}),
    ...(a.runbook ? { runbook: a.runbook } : {}),
    ...(a.labels ? { labels: a.labels as Record<string, unknown> } : {}),
  };
}

router.get("/alerts", async (req, res): Promise<void> => {
  const { status, severity } = req.query as Record<string, string>;

  const conditions: SQL[] = [];
  if (status) conditions.push(eq(alertsTable.status, status));
  if (severity) conditions.push(eq(alertsTable.severity, severity));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const alerts = await db
    .select()
    .from(alertsTable)
    .where(whereClause)
    .orderBy(desc(alertsTable.firedAt));

  res.json(GetAlertsResponse.parse(alerts.map(formatAlert)));
});

router.post("/alerts/:id/acknowledge", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [alert] = await db
    .update(alertsTable)
    .set({
      status: "acknowledged",
      acknowledgedAt: new Date(),
      acknowledgedBy: "support-team",
    })
    .where(eq(alertsTable.id, raw))
    .returning();

  if (!alert) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }

  res.json(AcknowledgeAlertResponse.parse(formatAlert(alert)));
});

export default router;
