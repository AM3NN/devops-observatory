/**
 * External Ingestion API
 *
 * Allows any external service/machine to push logs, metrics and traces
 * to the observatory using an API key.
 *
 * Authentication: X-API-Key header
 * Demo key: obs-key-pfe-demo-2024
 *
 * Endpoints:
 *   POST /ingest/logs     — batch log ingestion
 *   POST /ingest/metrics  — APM metrics snapshot
 *   POST /ingest/traces   — distributed trace spans
 *   POST /ingest/heartbeat — keep agent alive
 *   GET  /ingest/agents   — list connected agents
 *   POST /ingest/agents   — register a new agent
 */

import {
  Router,
  type Request,
  type Response,
  type NextFunction,
  type IRouter,
} from "express";
import {
  db,
  logsTable,
  apmMetricsTable,
  tracesTable,
  ingestionAgentsTable,
} from "@devops-observatory/db";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger";
import {
  ensureObservedService,
  updateObservedServiceSnapshot,
} from "../lib/service-registry";

const router: IRouter = Router();

const DEMO_KEY = "obs-key-pfe-demo-2024";
const VALID_LEVELS = new Set(["DEBUG", "INFO", "WARN", "ERROR", "FATAL"]);
const VALID_STATUSES = new Set(["ok", "error", "timeout"]);

// ─── Middleware: API key authentication ─────────────────────────────────────

async function requireApiKey(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const key = req.headers["x-api-key"] as string | undefined;
  if (!key) {
    res.status(401).json({ error: "Missing X-API-Key header" });
    return;
  }

  if (key === DEMO_KEY) {
    (req as any).agentId = "demo-agent";
    next();
    return;
  }

  const [agent] = await db
    .select()
    .from(ingestionAgentsTable)
    .where(eq(ingestionAgentsTable.apiKey, key));
  if (!agent || agent.status !== "active") {
    res.status(403).json({ error: "Invalid or revoked API key" });
    return;
  }

  (req as any).agentId = agent.id;
  next();
}

// ─── Validation helpers ───────────────────────────────────────────────────────

function validateLogEntry(entry: any): string | null {
  if (!entry || typeof entry !== "object")
    return "Each log entry must be an object";
  if (!entry.service || typeof entry.service !== "string")
    return "log.service is required";
  if (!entry.message || typeof entry.message !== "string")
    return "log.message is required";
  if (entry.level && !VALID_LEVELS.has(entry.level))
    return `log.level must be one of: ${[...VALID_LEVELS].join(", ")}`;
  return null;
}

function validateMetric(body: any): string | null {
  if (!body || typeof body !== "object") return "Body must be an object";
  if (!body.service || typeof body.service !== "string")
    return "service is required";
  if (typeof body.responseTime !== "number")
    return "responseTime must be a number";
  if (typeof body.throughput !== "number") return "throughput must be a number";
  if (typeof body.errorRate !== "number") return "errorRate must be a number";
  if (typeof body.cpuUsage !== "number") return "cpuUsage must be a number";
  if (typeof body.memoryUsage !== "number")
    return "memoryUsage must be a number";
  if (typeof body.activeConnections !== "number")
    return "activeConnections must be a number";
  return null;
}

function validateSpan(span: any): string | null {
  if (!span || typeof span !== "object") return "Each span must be an object";
  if (!span.traceId || typeof span.traceId !== "string")
    return "span.traceId is required";
  if (!span.spanId || typeof span.spanId !== "string")
    return "span.spanId is required";
  if (!span.service || typeof span.service !== "string")
    return "span.service is required";
  if (!span.operation || typeof span.operation !== "string")
    return "span.operation is required";
  if (typeof span.duration !== "number")
    return "span.duration must be a number";
  if (span.status && !VALID_STATUSES.has(span.status))
    return "span.status must be ok|error|timeout";
  return null;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// POST /ingest/logs
router.post(
  "/ingest/logs",
  requireApiKey,
  async (req: Request, res: Response): Promise<void> => {
    const body = req.body;
    if (!body || !Array.isArray(body.logs) || body.logs.length === 0) {
      res
        .status(400)
        .json({ error: "Body must have a non-empty 'logs' array" });
      return;
    }
    if (body.logs.length > 500) {
      res.status(400).json({ error: "Maximum 500 log entries per request" });
      return;
    }

    for (const entry of body.logs) {
      const err = validateLogEntry(entry);
      if (err) {
        res.status(400).json({ error: err });
        return;
      }
    }

    const agentId = (req as any).agentId as string;
    const rows = body.logs.map((entry: any) => ({
      id: randomUUID(),
      timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
      level: (entry.level as string) || "INFO",
      service: entry.service as string,
      message: entry.message as string,
      traceId: (entry.traceId as string) ?? null,
      spanId: (entry.spanId as string) ?? null,
      environment: (entry.environment as string) || "production",
      metadata: entry.metadata
        ? { ...entry.metadata, _agent: agentId }
        : { _agent: agentId },
    }));

    const observedServices = new Map<string, string>();
    for (const entry of body.logs) {
      observedServices.set(
        entry.service as string,
        typeof entry.environment === "string"
          ? entry.environment
          : "production",
      );
    }

    await Promise.all(
      [...observedServices.entries()].map(([serviceId, environment]) =>
        ensureObservedService({ serviceId, environment }),
      ),
    );

    await db.insert(logsTable).values(rows);

    if (agentId !== "demo-agent") {
      await db
        .update(ingestionAgentsTable)
        .set({
          lastSeen: new Date(),
          totalLogs: sql`total_logs + ${rows.length}`,
        })
        .where(eq(ingestionAgentsTable.id, agentId));
    }

    res
      .status(201)
      .json({ ingested: rows.length, ids: rows.map((r: any) => r.id) });
  },
);

// POST /ingest/metrics
router.post(
  "/ingest/metrics",
  requireApiKey,
  async (req: Request, res: Response): Promise<void> => {
    const body = req.body;
    const err = validateMetric(body);
    if (err) {
      res.status(400).json({ error: err });
      return;
    }

    const agentId = (req as any).agentId as string;

    await updateObservedServiceSnapshot({
      serviceId: body.service,
      environment:
        typeof body.environment === "string" ? body.environment : "production",
      responseTime: body.responseTime,
      errorRate: body.errorRate,
      requestsPerMin: body.throughput,
    });

    await db.insert(apmMetricsTable).values({
      id: randomUUID(),
      service: body.service,
      timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
      responseTime: body.responseTime,
      throughput: body.throughput,
      errorRate: body.errorRate,
      cpuUsage: body.cpuUsage,
      memoryUsage: body.memoryUsage,
      activeConnections: body.activeConnections,
    });

    if (agentId !== "demo-agent") {
      await db
        .update(ingestionAgentsTable)
        .set({ lastSeen: new Date(), totalMetrics: sql`total_metrics + 1` })
        .where(eq(ingestionAgentsTable.id, agentId));
    }

    res.status(201).json({ ingested: 1 });
  },
);

// POST /ingest/traces
router.post(
  "/ingest/traces",
  requireApiKey,
  async (req: Request, res: Response): Promise<void> => {
    const body = req.body;
    if (!body || !Array.isArray(body.spans) || body.spans.length === 0) {
      res
        .status(400)
        .json({ error: "Body must have a non-empty 'spans' array" });
      return;
    }
    if (body.spans.length > 200) {
      res.status(400).json({ error: "Maximum 200 spans per request" });
      return;
    }

    for (const span of body.spans) {
      const err = validateSpan(span);
      if (err) {
        res.status(400).json({ error: err });
        return;
      }
    }

    const agentId = (req as any).agentId as string;
    const rows = body.spans.map((span: any) => ({
      traceId: span.traceId as string,
      spanId: span.spanId as string,
      service: span.service as string,
      operation: span.operation as string,
      duration: span.duration as number,
      status: (span.status as string) || "ok",
      timestamp: span.timestamp ? new Date(span.timestamp) : new Date(),
      parentSpanId: (span.parentSpanId as string) ?? null,
      tags: span.tags ? { ...span.tags, _agent: agentId } : { _agent: agentId },
    }));

    const observedServices = new Map<string, string>();
    for (const span of body.spans) {
      observedServices.set(
        span.service as string,
        typeof span.environment === "string" ? span.environment : "production",
      );
    }

    await Promise.all(
      [...observedServices.entries()].map(([serviceId, environment]) =>
        ensureObservedService({ serviceId, environment }),
      ),
    );

    await db.insert(tracesTable).values(rows).onConflictDoNothing();

    if (agentId !== "demo-agent") {
      await db
        .update(ingestionAgentsTable)
        .set({
          lastSeen: new Date(),
          totalTraces: sql`total_traces + ${rows.length}`,
        })
        .where(eq(ingestionAgentsTable.id, agentId));
    }

    res.status(201).json({ ingested: rows.length });
  },
);

// POST /ingest/heartbeat
router.post(
  "/ingest/heartbeat",
  requireApiKey,
  async (req: Request, res: Response): Promise<void> => {
    const agentId = (req as any).agentId as string;
    if (agentId !== "demo-agent") {
      await db
        .update(ingestionAgentsTable)
        .set({ lastSeen: new Date() })
        .where(eq(ingestionAgentsTable.id, agentId));
    }
    res.json({ ok: true, serverTime: new Date().toISOString() });
  },
);

// GET /ingest/agents
router.get(
  "/ingest/agents",
  async (_req: Request, res: Response): Promise<void> => {
    const agents = await db
      .select()
      .from(ingestionAgentsTable)
      .orderBy(ingestionAgentsTable.createdAt);

    // Always include the demo agent entry
    const demoAgent = {
      id: "demo-agent",
      name: "Demo Agent (global key)",
      description: "Demo key for quick ingestion tests",
      apiKey: DEMO_KEY,
      status: "active",
      host: null,
      language: null,
      lastSeen: new Date().toISOString(),
      totalLogs: 0,
      totalMetrics: 0,
      totalTraces: 0,
      createdAt: new Date().toISOString(),
    };

    res.json([
      demoAgent,
      ...agents.map((a) => ({
        ...a,
        lastSeen: a.lastSeen?.toISOString() ?? null,
        createdAt: a.createdAt.toISOString(),
      })),
    ]);
  },
);

// POST /ingest/agents — register a new agent and get a unique API key
router.post(
  "/ingest/agents",
  async (req: Request, res: Response): Promise<void> => {
    const body = req.body;
    if (
      !body ||
      typeof body.name !== "string" ||
      body.name.trim().length === 0
    ) {
      res.status(400).json({ error: "Field 'name' is required" });
      return;
    }

    const id = randomUUID();
    const apiKey = `obs-key-${randomUUID().replace(/-/g, "").substring(0, 20)}`;

    const [agent] = await db
      .insert(ingestionAgentsTable)
      .values({
        id,
        name: body.name.trim(),
        description:
          typeof body.description === "string" ? body.description : "",
        apiKey,
        host: typeof body.host === "string" ? body.host : null,
        language: typeof body.language === "string" ? body.language : null,
        status: "active",
        createdAt: new Date(),
      })
      .returning();

    logger.info(
      { agentId: id, name: body.name },
      "New ingestion agent registered",
    );

    res.status(201).json({
      ...agent,
      lastSeen: agent.lastSeen?.toISOString() ?? null,
      createdAt: agent.createdAt.toISOString(),
    });
  },
);

export default router;
