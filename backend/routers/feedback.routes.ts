import { Router } from "express";
import { feedbackController } from "../controllers/feedback.controller";
import { authentication } from "../middleware/auth.middleware";

const feedbackRouter = Router();

feedbackRouter.post("/", authentication, feedbackController.submit);

export default feedbackRouter;
