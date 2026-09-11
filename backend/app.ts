import express, { Application } from "express";
import "./utils/config";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors, { CorsOptions } from "cors";
import { CORS_ALLOWED_ORIGINS, JWT_SECRET, NODE_ENV } from "./utils/constants";
import rootRouter from "./routers";
import { errorMiddleware } from "./middleware/error.middleware";
import { ErrorHandler } from "./utils/errorHandler";
import associationRouter from "./routers/association.routes";

export const app: Application = express();

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

/** This service's own public origin, when it is deployed behind one. */
const selfOrigin = () =>
  (
    process.env.PUBLIC_PAYMENT_ORIGIN ||
    process.env.RENDER_EXTERNAL_URL ||
    ""
  ).replace(/\/$/, "");

const corsOptions: CorsOptions =
  NODE_ENV === "production"
    ? {
        origin: (origin, callback) => {
          // No Origin header means the caller is not a browser: the mobile app,
          // Render's health probe, a server-to-server call. CORS is a browser
          // control and cannot protect any of those - authentication does.
          // Refusing them here would only break them.
          if (!origin) {
            return callback(null, true);
          }

          // The public payment page is served by this same service, and a
          // same-origin POST still carries an Origin header. Without this, that
          // page's /confirm call is refused whenever CORS_ALLOWED_ORIGINS is
          // unset - which is how render.yaml deploys the service today.
          const self = selfOrigin();
          if (self && origin === self) {
            return callback(null, true);
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

// These files must live at the domain root for Apple/Android passkey trust.
app.use("/.well-known", associationRouter);
app.use("/api/v1", rootRouter);

app.use(errorMiddleware);

// Listening is server.ts's job. Keeping it out of here is what lets the test
// suite import the fully wired app and drive it over HTTP without binding a
// port.
export default app;
