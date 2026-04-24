import { Router, type IRouter } from "express";
import { db, slosTable } from "@devops-observatory/db";
import { GetSlosResponse } from "@devops-observatory/api-zod";
import { refreshSlos } from "../lib/slo-engine";

const router: IRouter = Router();

router.get("/slo", async (_req, res): Promise<void> => {
  await refreshSlos();

  const slos = await db.select().from(slosTable);
  const sortedSlos = [...slos].sort((left, right) => {
    const riskOrder: Record<string, number> = { breached: 0, at_risk: 1, met: 2 };
    const statusDelta = (riskOrder[left.status] ?? 3) - (riskOrder[right.status] ?? 3);

    if (statusDelta !== 0) {
      return statusDelta;
    }

    return (
      left.service.localeCompare(right.service) ||
      left.name.localeCompare(right.name)
    );
  });

  res.json(GetSlosResponse.parse(sortedSlos));
});

export default router;
