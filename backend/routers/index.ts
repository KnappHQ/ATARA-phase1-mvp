import express from "express";
const app = express();
import healthRouter from "./health.routes";
import transactionRouter from "./transaction.routes";
import authRouter from "./auth.routes";
import walletRouter from "./wallet.routes";
import userRouter from "./user.route";
import groupRouter from "./group.routes";
import feedbackRouter from "./feedback.routes";
import vaultRouter from "./vault.routes";
import paymentRequestRouter from "./paymentRequest.routes";
import securityRouter from "./security.routes";
import legalRouter from "./legal.routes";

app.use("/", express.Router());
app.use("/health", healthRouter);
app.use("/transaction", transactionRouter);
app.use("/auth", authRouter);
app.use("/wallet", walletRouter);
app.use("/user", userRouter);
app.use("/groups", groupRouter);
app.use("/feedback", feedbackRouter);
app.use("/vaults", vaultRouter);
app.use("/security", securityRouter);
app.use("/requests", paymentRequestRouter);
app.use("/legal", legalRouter);

export default app;
