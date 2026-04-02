import { db, servicesTable } from "@devops-observatory/db";
import { eq } from "drizzle-orm";

type EnsureObservedServiceInput = {
  serviceId: string;
  environment?: string | null;
};

type UpdateObservedServiceSnapshotInput = EnsureObservedServiceInput & {
  responseTime: number;
  errorRate: number;
  requestsPerMin: number;
};

function humanizeServiceId(serviceId: string): string {
  return serviceId
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function deriveServiceStatus(responseTime: number, errorRate: number) {
  if (errorRate > 10 || responseTime > 1000) {
    return "down" as const;
  }

  if (errorRate > 5 || responseTime > 500) {
    return "degraded" as const;
  }

  return "healthy" as const;
}

export async function ensureObservedService({
  serviceId,
  environment,
}: EnsureObservedServiceInput): Promise<void> {
  const normalizedEnvironment = environment?.trim() || "production";
  const now = new Date();
  const displayName = humanizeServiceId(serviceId);

  await db
    .insert(servicesTable)
    .values({
      id: serviceId,
      name: displayName,
      environment: normalizedEnvironment,
      status: "healthy",
      version: "external",
      uptime: 100,
      responseTime: 0,
      errorRate: 0,
      requestsPerMin: 0,
      team: "Observed Services",
      description: `Auto-discovered from live telemetry for ${displayName}`,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: servicesTable.id,
      set: {
        environment: normalizedEnvironment,
        updatedAt: now,
      },
    });
}

export async function updateObservedServiceSnapshot({
  serviceId,
  environment,
  responseTime,
  errorRate,
  requestsPerMin,
}: UpdateObservedServiceSnapshotInput): Promise<void> {
  await ensureObservedService({ serviceId, environment });

  await db
    .update(servicesTable)
    .set({
      environment: environment?.trim() || "production",
      status: deriveServiceStatus(responseTime, errorRate),
      responseTime: parseFloat(responseTime.toFixed(2)),
      errorRate: parseFloat(errorRate.toFixed(2)),
      requestsPerMin: Math.max(0, Math.round(requestsPerMin)),
      updatedAt: new Date(),
    })
    .where(eq(servicesTable.id, serviceId));
}
