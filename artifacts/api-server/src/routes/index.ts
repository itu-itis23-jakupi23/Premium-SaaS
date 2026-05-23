import { Router, type IRouter } from "express";
import authRouter from "./auth";
import databaseRouter from "./database";
import healthRouter from "./health";
import messagesRouter from "./messages";
import platformRouter from "./platform";
import workspaceRouter from "./workspace";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(databaseRouter);
router.use(messagesRouter);
router.use(platformRouter);
router.use(workspaceRouter);

export default router;
