import { Router, type IRouter } from "express";
import { db, slosTable } from "@devops-observatory/db";
import { GetSlosResponse } from "@devops-observatory/api-zod";
import { refreshSlos } from "../lib/slo-engine";

const router: IRouter = Router();

router.get("/slo", async (_req, res): Promise<void> => {
  await refreshSlos();

  const slos = await db.select().from(slosTable);
  const sortedSlos = [...slos].sort((left, right) => {
    const riskOrder = { breached: 0, at_risk: 1, met: 2 } as const;
    const statusDelta = riskOrder[left.status] - riskOrder[right.status];

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
