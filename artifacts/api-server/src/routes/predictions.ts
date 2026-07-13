import { Router, type IRouter } from "express";
import {
  getIncidentPredictionHistory,
  getIncidentPredictions,
} from "../lib/incident-predictions";
import { db, incidentPredictionsTable } from "@devops-observatory/db";

const router: IRouter = Router();

router.get("/predictions/incidents", async (_req, res): Promise<void> => {
  const predictions = await getIncidentPredictions();

  res.json(predictions);
});

router.get(
  "/predictions/incidents/history",
  async (req, res): Promise<void> => {
    const service =
      typeof req.query.service === "string" ? req.query.service : undefined;
    const rawLimit =
      typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const history = await getIncidentPredictionHistory({
      service,
      limit: Number.isFinite(rawLimit) ? rawLimit : undefined,
    });

    res.json(history);
  },
);

router.delete("/predictions/incidents", async (_req, res): Promise<void> => {
  await db.delete(incidentPredictionsTable);
  res.json({ deleted: true });
});

export default router;
