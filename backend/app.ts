import express, { Application } from "express";
import "./utils/config";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import { PORT } from "./utils/constants";
import rootRouter from "./routers";
import { errorMiddleware } from "./middleware/errorMiddleware";

const app: Application = express();

app.use(helmet());
app.use(cors());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message: "Too many requests, please try again later.",
  standardHeaders: "draft-7",
  legacyHeaders: false,
});
app.use(limiter);

app.use(express.json());

app.use("/api/v1", rootRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
app.use(errorMiddleware);
