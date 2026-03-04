import { Router } from "express";
import { groupController } from "../controllers/group.controller";
import { authentication } from "../middleware/auth.middleware";

const router = Router();

router.use(authentication);

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
router.post("/e/:expenseId/settle", groupController.settleMyShare);

router.get("/:groupId/settle/:memberId", groupController.getSettleAllAmount);
router.post("/:groupId/settle/:memberId", groupController.settleAllWithMember);

export default router;
