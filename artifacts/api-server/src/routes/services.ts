import { Router, type IRouter } from "express";
import { db, servicesTable } from "@devops-observatory/db";
import { GetServicesResponse } from "@devops-observatory/api-zod";

const router: IRouter = Router();

router.get("/services", async (_req, res): Promise<void> => {
  const services = await db.select().from(servicesTable);

  const sortedServices = [...services].sort(
    (left, right) =>
      right.updatedAt.getTime() - left.updatedAt.getTime() ||
      left.name.localeCompare(right.name),
  );

  res.json(GetServicesResponse.parse(sortedServices));
});

export default router;
