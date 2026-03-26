import { Router, type IRouter } from "express";
import { db, slosTable } from "@workspace/db";
import { GetSlosResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/slo", async (_req, res): Promise<void> => {
  const slos = await db.select().from(slosTable);
  res.json(GetSlosResponse.parse(slos));
});

export default router;
