import { Router } from "express";
import { authentication } from "../middleware/auth.middleware";
import { subscriptionController } from "../controllers/subscription.controller";

const router = Router();
// Authentication is per route, not router-wide: this router is mounted at the
// root, and a router-wide check would answer 401 for every unknown path.
//
// Read-only on purpose: no route here can change anyone's offer. An offer only
// changes when a verified billing event updates it on the server (see
// docs/MONETIZATION_AND_CARD_PLAN.md §5).
router.get("/plans", authentication, subscriptionController.plans);
router.get("/subscription/me", authentication, subscriptionController.me);
router.get("/card/status", authentication, subscriptionController.cardStatus);
router.post("/card/waitlist", authentication, subscriptionController.joinWaitlist);

export default router;
