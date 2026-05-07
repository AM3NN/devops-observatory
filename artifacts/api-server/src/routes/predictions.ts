import { Router, type IRouter } from "express";
import { getIncidentPredictions } from "../lib/incident-predictions";

const router: IRouter = Router();

router.get("/predictions/incidents", async (_req, res): Promise<void> => {
  const predictions = await getIncidentPredictions();

  res.json(predictions);
});

export default router;
