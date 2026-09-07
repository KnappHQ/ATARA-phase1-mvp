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
          // A missing Origin used to be waved through, which made the
          // allow-list meaningless for every non-browser caller. The mobile app
          // issues native requests and is not subject to browser CORS at all,
          // so refusing here costs it nothing.
          if (!origin) {
            return callback(new ErrorHandler("CORS: Origin required", 403));
          }

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

// Explicit rather than relying on body-parser's implicit 100kb default.
app.use(express.json({ limit: "100kb" }));

app.use("/api/v1", rootRouter);

app.use(errorMiddleware);

app.listen(PORT, "0.0.0.0", () => {
  if (NODE_ENV !== "production") {
    console.log(`Server running on port ${PORT}`);
  }
});
