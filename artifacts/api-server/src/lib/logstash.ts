import net from "node:net";
import { logger } from "./logger";

const logstashHost = process.env.LOGSTASH_HOST?.trim();
const logstashPort = Number(process.env.LOGSTASH_PORT?.trim() || "5000");
const logstashTimeoutMs = Number(
  process.env.LOGSTASH_TIMEOUT_MS?.trim() || "2000",
);

export type LogstashLogEvent = {
  id: string;
  timestamp: string;
  level: string;
  service: string;
  message: string;
  environment: string;
  traceId?: string;
  spanId?: string;
  metadata?: unknown;
};

export function isLogstashEnabled() {
  return (
    Boolean(logstashHost) && Number.isFinite(logstashPort) && logstashPort > 0
  );
}

function sendPayload(payload: string) {
  return new Promise<void>((resolve, reject) => {
    if (!logstashHost) {
      resolve();
      return;
    }

    const socket = net.createConnection({
      host: logstashHost,
      port: logstashPort,
    });

    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };

    socket.setTimeout(logstashTimeoutMs);

    socket.once("connect", () => {
      socket.end(`${payload}\n`);
    });

    socket.once("timeout", () => {
      cleanup();
      reject(new Error("Timed out while forwarding log to Logstash"));
    });

    socket.once("error", (error) => {
      cleanup();
      reject(error);
    });

    socket.once("close", () => {
      resolve();
    });
  });
}

export async function forwardLogToLogstash(event: LogstashLogEvent) {
  if (!isLogstashEnabled()) {
    return;
  }

  try {
    await sendPayload(JSON.stringify(event));
  } catch (error) {
    logger.warn(
      {
        err: error,
        host: logstashHost,
        port: logstashPort,
        logId: event.id,
        service: event.service,
      },
      "Failed to forward log to Logstash",
    );
  }
}

export async function forwardLogsToLogstash(events: LogstashLogEvent[]) {
  if (!isLogstashEnabled() || events.length === 0) {
    return;
  }

  for (const event of events) {
    await forwardLogToLogstash(event);
  }
}
