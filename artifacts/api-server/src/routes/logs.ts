import { Router, type IRouter } from "express";
import { db, logsTable } from "@devops-observatory/db";
import { desc, eq, ilike, and, type SQL } from "drizzle-orm";
import { GetLogsResponse, IngestLogBody } from "@devops-observatory/api-zod";
import { randomUUID } from "crypto";
import { ensureObservedService } from "../lib/service-registry";
import { indexLogDocument, searchLogDocuments } from "../lib/elasticsearch";

const router: IRouter = Router();

router.get("/logs", async (req, res): Promise<void> => {
  const {
    level,
    service,
    search,
    limit = "50",
    offset = "0",
  } = req.query as Record<string, string>;

  const conditions: SQL[] = [];

  if (level) conditions.push(eq(logsTable.level, level));
  if (service) conditions.push(eq(logsTable.service, service));
  if (search) conditions.push(ilike(logsTable.message, `%${search}%`));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const limitNum = Math.min(parseInt(limit, 10) || 50, 500);
  const offsetNum = parseInt(offset, 10) || 0;

  const elasticsearchResult = await searchLogDocuments({
    level,
    service,
    search,
    limit: limitNum,
    offset: offsetNum,
  });

  if (elasticsearchResult) {
    res.json(
      GetLogsResponse.parse({
        logs: elasticsearchResult.logs.map((log) => ({
          id: log.id,
          timestamp: log.timestamp,
          level: log.level,
          service: log.service,
          message: log.message,
          environment: log.environment,
          traceId: log.traceId,
          spanId: log.spanId,
          metadata:
            log.metadata && typeof log.metadata === "object"
              ? (log.metadata as Record<string, unknown>)
              : undefined,
        })),
        total: elasticsearchResult.total,
        offset: offsetNum,
        limit: limitNum,
      }),
    );
    return;
  }

  const [logs, countResult] = await Promise.all([
    db
      .select()
      .from(logsTable)
      .where(whereClause)
      .orderBy(desc(logsTable.timestamp))
      .limit(limitNum)
      .offset(offsetNum),
    db.select().from(logsTable).where(whereClause),
  ]);

  res.json(
    GetLogsResponse.parse({
      logs: logs.map((l) => ({
        id: l.id,
        timestamp: l.timestamp.toISOString(),
        level: l.level,
        service: l.service,
        message: l.message,
        environment: l.environment,
        traceId: l.traceId ?? undefined,
        spanId: l.spanId ?? undefined,
        metadata: l.metadata ?? undefined,
      })),
      total: countResult.length,
      offset: offsetNum,
      limit: limitNum,
    }),
  );
});

router.post("/logs", async (req, res): Promise<void> => {
  const parsed = IngestLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;

  await ensureObservedService({
    serviceId: data.service,
    environment: data.environment,
  });

  const [log] = await db
    .insert(logsTable)
    .values({
      id: data.id ?? randomUUID(),
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      level: data.level,
      service: data.service,
      message: data.message,
      traceId: data.traceId,
      spanId: data.spanId,
      environment: data.environment,
      metadata: data.metadata ?? null,
    })
    .returning();

  await indexLogDocument({
    id: log.id,
    timestamp: log.timestamp.toISOString(),
    level: log.level,
    service: log.service,
    message: log.message,
    environment: log.environment,
    traceId: log.traceId ?? undefined,
    spanId: log.spanId ?? undefined,
    metadata: log.metadata ?? undefined,
  });

  res.status(201).json({
    ...log,
    timestamp: log.timestamp.toISOString(),
  });
});

export default router;
