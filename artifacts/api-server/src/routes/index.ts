import { Router, type IRouter } from "express";
import healthRouter from "./health";
import servicesRouter from "./services";
import logsRouter from "./logs";
import apmRouter from "./apm";
import alertsRouter from "./alerts";
import sloRouter from "./slo";
import dashboardRouter from "./dashboard";
import ingestRouter from "./ingest";

const router: IRouter = Router();

router.use(healthRouter);
router.use(servicesRouter);
router.use(logsRouter);
router.use(apmRouter);
router.use(alertsRouter);
router.use(sloRouter);
router.use(dashboardRouter);
router.use(ingestRouter);

export default router;
