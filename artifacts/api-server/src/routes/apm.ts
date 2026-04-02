import { Router, type IRouter } from "express";
import { db, apmMetricsTable, tracesTable } from "@devops-observatory/db";
import { desc, eq, and, gte, lte, type SQL } from "drizzle-orm";
import {
  GetApmMetricsResponse,
  GetTracesResponse,
} from "@devops-observatory/api-zod";

const router: IRouter = Router();

router.get("/apm/metrics", async (req, res): Promise<void> => {
  const { service, from, to } = req.query as Record<string, string>;

  const conditions: SQL[] = [];
  if (service) conditions.push(eq(apmMetricsTable.service, service));
  if (from) conditions.push(gte(apmMetricsTable.timestamp, new Date(from)));
  if (to) conditions.push(lte(apmMetricsTable.timestamp, new Date(to)));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const metrics = await db
    .select()
    .from(apmMetricsTable)
    .where(whereClause)
    .orderBy(desc(apmMetricsTable.timestamp))
    .limit(200);

  res.json(
    GetApmMetricsResponse.parse(
      metrics.map((m) => ({
        ...m,
        timestamp: m.timestamp.toISOString(),
      })),
    ),
  );
});

router.get("/apm/traces", async (req, res): Promise<void> => {
  const { service, limit = "50" } = req.query as Record<string, string>;

  const conditions: SQL[] = [];
  if (service) conditions.push(eq(tracesTable.service, service));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const limitNum = Math.min(parseInt(limit, 10) || 50, 200);
  const traces = await db
    .select()
    .from(tracesTable)
    .where(whereClause)
    .orderBy(desc(tracesTable.timestamp))
    .limit(limitNum);

  res.json(
    GetTracesResponse.parse(
      traces.map((t) => ({
        ...t,
        timestamp: t.timestamp.toISOString(),
      })),
    ),
  );
});

export default router;
