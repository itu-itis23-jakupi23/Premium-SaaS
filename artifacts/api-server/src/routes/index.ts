import { Router, type IRouter } from "express";
import adminRouter from "./admin";
import authRouter from "./auth";
import billingRouter from "./billing";
import clientErrorsRouter from "./client-errors";
import crmRouter from "./crm";
import databaseRouter from "./database";
import documentsRouter from "./documents";
import exhibitionsRouter from "./exhibitions";
import healthRouter from "./health";
import invoicesRouter from "./invoices";
import leadsRouter from "./leads";
import messagesRouter from "./messages";
import platformRouter from "./platform";
import quotesRouter from "./quotes";
import workspaceRouter from "./workspace";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clientErrorsRouter);
router.use(leadsRouter);
// Mounted ahead of the routers that apply a blanket requireAuth to everything
// passing through them (crm, quotes, workspace): those would answer 401 for an
// unauthenticated caller before this router's own gate could answer 404, and
// the gate answering first is the point of it.
//
// Behind ADMIN_SURFACE_ENABLED, which is set nowhere.
router.use(adminRouter);
router.use(authRouter);
router.use(billingRouter);
router.use(databaseRouter);
router.use(documentsRouter);
router.use(messagesRouter);
router.use(platformRouter);
router.use(quotesRouter);
router.use(invoicesRouter);
// Mounted after platformRouter: this router applies requireAuth to every request
// that reaches it, and platformRouter registers public invitation routes first.
router.use(exhibitionsRouter);
router.use(crmRouter);
router.use(workspaceRouter);

export default router;
