import { Router, type IRouter } from "express";
import authRouter from "./auth";
import billingRouter from "./billing";
import databaseRouter from "./database";
import documentsRouter from "./documents";
import healthRouter from "./health";
import messagesRouter from "./messages";
import platformRouter from "./platform";
import workspaceRouter from "./workspace";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(billingRouter);
router.use(databaseRouter);
router.use(documentsRouter);
router.use(messagesRouter);
router.use(platformRouter);
router.use(workspaceRouter);

export default router;
