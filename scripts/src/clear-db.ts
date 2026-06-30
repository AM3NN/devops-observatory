import { db, sql } from "@devops-observatory/db";
await db.execute(sql`TRUNCATE TABLE services, logs, apm_metrics, traces, alerts, slos, ingestion_agents, incident_predictions CASCADE`);
console.log("All tables cleared");
process.exit(0);
