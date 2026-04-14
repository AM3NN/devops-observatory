/**
 * Instrumentation module — auto-sends logs, APM metrics and traces
 * to the observatory database for every operation performed by the microservices.
 */
import {
  db,
  logsTable,
  apmMetricsTable,
  tracesTable,
} from "@devops-observatory/db";
import { logger } from "./logger";
import { randomUUID } from "crypto";
import { indexLogDocument } from "./elasticsearch";

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";

export interface InstrumentedRequest {
  serviceId: string;
  operation: string;
  method: string;
  path: string;
  traceId?: string;
}

export interface InstrumentedResponse {
  statusCode: number;
  durationMs: number;
  error?: string;
}

/**
 * Record a single log entry from a real microservice operation
 */
export async function recordLog(
  serviceId: string,
  level: LogLevel,
  message: string,
  traceId?: string,
  spanId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const id = randomUUID();
  const timestamp = new Date();

  try {
    await db.insert(logsTable).values({
      id,
      timestamp,
      level,
      service: serviceId,
      message,
      traceId: traceId ?? null,
      spanId: spanId ?? null,
      environment: "production",
      metadata: metadata ?? null,
    });

    await indexLogDocument({
      id,
      timestamp: timestamp.toISOString(),
      level,
      service: serviceId,
      message,
      environment: "production",
      traceId: traceId ?? undefined,
      spanId: spanId ?? undefined,
      metadata: metadata ?? undefined,
    });
  } catch (err) {
    logger.error({ err }, "Failed to record log");
  }
}

/**
 * Record a distributed trace span from a real operation
 */
export async function recordTrace(
  serviceId: string,
  operation: string,
  durationMs: number,
  status: "ok" | "error" | "timeout",
  traceId: string,
  spanId: string,
  parentSpanId?: string,
  tags?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(tracesTable).values({
      traceId,
      spanId,
      service: serviceId,
      operation,
      duration: durationMs,
      status,
      timestamp: new Date(),
      parentSpanId: parentSpanId ?? null,
      tags: tags ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Failed to record trace");
  }
}

/**
 * Flush accumulated metrics for a service into apm_metrics
 */
export async function flushApmMetrics(
  serviceId: string,
  responseTimes: number[],
  errorCount: number,
  totalCount: number,
  cpuUsage: number,
  memoryUsage: number,
  activeConnections: number,
): Promise<void> {
  if (totalCount === 0) return;

  const avgResponseTime =
    responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  const errorRate = totalCount > 0 ? (errorCount / totalCount) * 100 : 0;
  const throughput = totalCount; // requests in this window

  try {
    await db.insert(apmMetricsTable).values({
      id: randomUUID(),
      service: serviceId,
      timestamp: new Date(),
      responseTime: parseFloat(avgResponseTime.toFixed(2)),
      throughput,
      errorRate: parseFloat(errorRate.toFixed(2)),
      cpuUsage: parseFloat(cpuUsage.toFixed(2)),
      memoryUsage: parseFloat(memoryUsage.toFixed(2)),
      activeConnections,
    });
  } catch (err) {
    logger.error({ err }, "Failed to flush APM metrics");
  }
}
