import { Router } from "express";
import { groupController } from "../controllers/group.controller";
import { authentication } from "../middleware/auth.middleware";

const router = Router();

router.use(authentication);

router.get("/contacts/:address/balances", groupController.contactBalances);
router.patch("/e/:expenseId/decision", groupController.decideSplit);
router.post("/:groupId/settle/:memberId/quote", groupController.createSettlementIntent);

router.post("/", groupController.createGroup);
router.get("/", groupController.getMyGroups);
router.get("/:groupId", groupController.getGroupDetails);
router.patch("/:groupId", groupController.updateGroup);
router.delete("/:groupId", groupController.deleteGroup);

router.post("/:groupId/members", groupController.addMembers);
router.delete("/:groupId/members/:memberId", groupController.removeMember);

router.post("/:groupId/expenses", groupController.addExpense);
router.get("/:groupId/expenses", groupController.getExpenses);
// /e/ prefix avoids ambiguity with /:groupId
router.delete("/e/:expenseId", groupController.deleteExpense);

router.get("/:groupId/settle/:memberId", groupController.getSettleAllAmount);
router.post(
  "/:groupId/settle/:memberId/by-tx",
  groupController.settleByInternalTx,
);

export default router;
