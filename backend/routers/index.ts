import express from "express";
const app = express();
import healthRouter from "./health.routes";

app.use("/", express.Router());
app.use("/health", healthRouter);

export default app;
