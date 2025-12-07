import express from "express";
const app = express();
import healthRouter from "./health.routes";
import transactionRouter from "./transaction.routes";
import authRouter from "./auth.routes";
import walletRouter from "./wallet.routes";
import userRouter from "./user.route";

app.use("/", express.Router());
app.use("/health", healthRouter);
app.use("/transaction", transactionRouter);
app.use("/auth", authRouter);
app.use("/wallet", walletRouter);
app.use("/user", userRouter);

export default app;
