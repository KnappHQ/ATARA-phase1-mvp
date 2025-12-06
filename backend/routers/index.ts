import express from "express";
const app = express();
import healthRouter from "./health.routes";
import priceRouter from "./price.routes";
import transactionRouter from "./transaction.routes";
import authRouter from "./auth.routes";

app.use("/", express.Router());
app.use("/health", healthRouter);
app.use("/price", priceRouter);
app.use("/transaction", transactionRouter);
app.use("/auth", authRouter);
app.use("/wallet", transactionRouter);

export default app;
