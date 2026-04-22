/**
 * Traffic Generator
 *
 * Generates realistic traffic patterns against the microservices.
 * - Peak load: 08:00–18:00 → high request rate, more errors
 * - Off-peak: 18:00–08:00 → low request rate, fewer errors
 *
 * Also accumulates per-service metrics and flushes them every 60 seconds
 * to apm_metrics so the APM dashboard shows real data.
 */

import {
  SERVICES,
  simulateRequest,
  type ServiceConfig,
} from "./microservice-simulator";
import { flushApmMetrics } from "./instrumentation";
import { db, servicesTable } from "@devops-observatory/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

interface ServiceMetricsAccumulator {
  responseTimes: number[];
  errorCount: number;
  totalCount: number;
}

const accumulators = new Map<string, ServiceMetricsAccumulator>();

function getAccumulator(serviceId: string): ServiceMetricsAccumulator {
  if (!accumulators.has(serviceId)) {
    accumulators.set(serviceId, {
      responseTimes: [],
      errorCount: 0,
      totalCount: 0,
    });
  }
  return accumulators.get(serviceId)!;
}

function isPeakHour(): boolean {
  const h = new Date().getHours();
  return h >= 8 && h <= 18;
}

function getRequestsPerTick(): number {
  // Each tick = 2 seconds. Returns how many concurrent requests to fire.
  const peak = isPeakHour();
  if (peak) {
    // 08-11h: heavy surge, 11-14h: medium, 14-18h: sustained
    const h = new Date().getHours();
    if (h >= 9 && h <= 11) return Math.floor(Math.random() * 6) + 8; // 8-14 req/tick
    if (h >= 8 && h <= 13) return Math.floor(Math.random() * 4) + 4; // 4-8 req/tick
    return Math.floor(Math.random() * 3) + 2; // 2-5 req/tick
  }
  // Off-peak: occasional background requests
  return Math.random() < 0.3 ? Math.floor(Math.random() * 2) + 1 : 0;
}

function getSimulatedCpuUsage(svc: ServiceConfig): number {
  const peak = isPeakHour();
  const base = peak ? 55 : 20;
  const variance = peak ? 35 : 20;
  return Math.min(98, base + Math.random() * variance);
}

function getSimulatedMemoryUsage(svc: ServiceConfig): number {
  const peak = isPeakHour();
  const base = peak ? 60 : 35;
  const variance = peak ? 25 : 15;
  return Math.min(95, base + Math.random() * variance);
}

function getSimulatedConnections(svc: ServiceConfig): number {
  const peak = isPeakHour();
  return peak
    ? Math.floor(Math.random() * 150) + 40
    : Math.floor(Math.random() * 20) + 5;
}

/**
 * Single tick: fire N requests across a randomly selected service
 */
async function tick(): Promise<void> {
  const count = getRequestsPerTick();
  if (count === 0) return;

  const service = SERVICES[Math.floor(Math.random() * SERVICES.length)];
  const promises = Array.from({ length: count }, () =>
    simulateRequest(service),
  );
  const results = await Promise.allSettled(promises);

  const acc = getAccumulator(service.id);
  for (const r of results) {
    if (r.status === "fulfilled") {
      acc.totalCount++;
      acc.responseTimes.push(r.value.durationMs);
      if (r.value.isError) acc.errorCount++;
    }
  }
}

/**
 * Flush accumulated metrics to the APM table and reset accumulators.
 * Also update the services table with current health status.
 */
async function flushMetrics(): Promise<void> {
  for (const svc of SERVICES) {
    const acc = getAccumulator(svc.id);
    if (acc.totalCount === 0) continue;

    const cpu = getSimulatedCpuUsage(svc);
    const memory = getSimulatedMemoryUsage(svc);
    const connections = getSimulatedConnections(svc);

    await flushApmMetrics(
      svc.id,
      acc.responseTimes,
      acc.errorCount,
      acc.totalCount,
      cpu,
      memory,
      connections,
    );

    // Update service health status based on real error rate
    const errorRate = acc.errorCount / acc.totalCount;
    const avgResponse =
      acc.responseTimes.reduce((a, b) => a + b, 0) / acc.responseTimes.length;

    let status: "healthy" | "degraded" | "down" = "healthy";
    if (errorRate > 0.1 || avgResponse > 1000) status = "down";
    else if (errorRate > 0.05 || avgResponse > 500) status = "degraded";

    await db
      .update(servicesTable)
      .set({
        status,
        responseTime: parseFloat(avgResponse.toFixed(1)),
        errorRate: parseFloat((errorRate * 100).toFixed(2)),
        requestsPerMin: Math.floor(acc.totalCount * (60 / 60)), // per-minute estimate
        updatedAt: new Date(),
      })
      .where(eq(servicesTable.id, svc.id))
      .catch(() => {});

    // Reset accumulator
    accumulators.set(svc.id, {
      responseTimes: [],
      errorCount: 0,
      totalCount: 0,
    });
  }
}

/**
 * Start the traffic generator.
 * - Ticks every 2 seconds (fires real requests)
 * - Flushes APM metrics every 60 seconds
 */
export function startTrafficGenerator(): void {
  logger.info("Traffic generator started");

  // Fast tick: generate traffic every 2 seconds
  setInterval(async () => {
    try {
      await tick();
    } catch (err) {
      logger.error({ err }, "Traffic generator tick error");
    }
  }, 2000);

  // Slow flush: save APM metrics every 60 seconds
  setInterval(async () => {
    try {
      await flushMetrics();
      logger.info("APM metrics flushed");
    } catch (err) {
      logger.error({ err }, "APM metrics flush error");
    }
  }, 60_000);

  // First flush after 30 seconds to have initial data
  setTimeout(async () => {
    try {
      await flushMetrics();
    } catch (_) {}
  }, 30_000);
}
