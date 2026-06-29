import app from "./app";
import { logger } from "./lib/logger";
import { initServices } from "./lib/init-services";
import { startTrafficGenerator } from "./lib/traffic-generator";
import { startAlertEngine } from "./lib/alert-engine";
import { startSloEngine } from "./lib/slo-engine";
import { isDemoModeEnabled } from "./lib/runtime-config";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function main() {
  const demoModeEnabled = isDemoModeEnabled();

  // 1. Initialize service registry (upsert the 6 services into the DB)
  await initServices();

  // 2. Start background engines
  if (demoModeEnabled) {
    startTrafficGenerator(); // generates simulated requests every 2 seconds
    startAlertEngine(); // evaluates alert rules every 30 seconds
    startSloEngine(); // recomputes SLOs every 2 minutes
  } else {
    logger.info("Live mode enabled - demo simulators are disabled");
  }

  // 3. Start HTTP server
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "DevOps Observatory API server running");
  });
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
