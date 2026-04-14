import express, { Application } from "express";
import "./utils/config";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors, { CorsOptions } from "cors";
import {
  CORS_ALLOWED_ORIGINS,
  JWT_SECRET,
  NODE_ENV,
  PORT,
} from "./utils/constants";
import rootRouter from "./routers";
import { errorMiddleware } from "./middleware/error.middleware";
import { ErrorHandler } from "./utils/errorHandler";

const app: Application = express();

app.set("trust proxy", 1);

const validateRequiredEnv = () => {
  if (!JWT_SECRET.trim()) {
    console.error(
      "Startup Error: Missing required environment variable JWT_SECRET",
    );
    process.exit(1);
  }
};

validateRequiredEnv();

app.use(helmet());

const corsOptions: CorsOptions =
  NODE_ENV === "production"
    ? {
        origin: (origin, callback) => {
          // Allow requests without an Origin header (mobile apps, curl, server-to-server).
          if (!origin) return callback(null, true);

          if (CORS_ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, true);
          }

          return callback(new ErrorHandler("CORS: Origin not allowed", 403));
        },
      }
    : {
        origin: true,
      };

app.use(cors(corsOptions));

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

app.use(errorMiddleware);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
