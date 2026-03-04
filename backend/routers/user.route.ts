import { Router } from "express";
import { userController } from "../controllers/user.controller";
import { authentication } from "../middleware/auth.middleware";

const router = Router();

router.get("/me", authentication, userController.getMe);

router.patch("/me", authentication, userController.updateProfile);

router.get("/search", authentication, userController.search);

router.get("/quick-contacts", authentication, userController.getQuickContacts);

router.get("/handle/:handle", authentication, userController.getUserByHandle);

export default router;
