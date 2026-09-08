import { Router } from "express";
import { authentication } from "../middleware/auth.middleware";
const router = Router();
router.use(authentication);
// Legacy local TOTP/recovery codes did not secure the wallet signing provider.
// Stop enrolling users into a false protection; the app now uses Privy's verified MFA.
router.use((_req, res) => res.status(410).json({ success: false, message: "Update ATARA and manage security through the wallet provider. Legacy ATARA recovery codes cannot recover wallet keys." }));
export default router;
