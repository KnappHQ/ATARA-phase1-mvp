import { Router } from "express";
import { healthController } from "../controllers/health.controller";
import { authentication } from "../middleware/auth.middleware";

const router = Router();

// Public: this is the probe render.yaml points healthCheckPath at, and it
// touches nothing but process state.
router.get("/backend", healthController.backendHealth);

// Authenticated: every call runs a query against the database, so leaving it
// open let any caller consume connections from the pool.
router.get("/db", authentication, healthController.dbHealth);

export default router;
