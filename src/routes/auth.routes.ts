import { Router } from "express";
import AuthController from "../controllers/auth.controller";
import { RegisterSchema } from "../validators/register.validator";
import { ValidatorMiddleware } from "../middleware/validator.middleware";
import { createVerifyTokenAdminMiddleware } from "../middleware/token";

const AuthRoutes = (): Router => {
  const router: Router = Router();
  const authController = new AuthController();

  router.post("/register", ValidatorMiddleware(RegisterSchema), (req, res) => authController.register(req, res));
  router.post("/login", (req, res) => authController.login(req, res));
  router.post("/login_admin",(req, res) => authController.loginAdmin(req,res));
  router.post("/login_admin_2FA",(req,res)=> authController.login2FaAdmin(req,res));
  router.post("/resend_code_admin_2FA",(req,res) => authController.resendCode2FaAdmin(req,res));
  router.post("/google", (req, res) => authController.authWithGoogle(req, res));
  router.post("/check-email", async (req, res) => authController.checkEmailAvailability(req, res));
  router.post("/send-reset-password-email", async (req, res) => authController.sendResetPasswordEmail(req, res));
  router.post("/reset-password", async (req, res) => authController.resetPassword(req, res));
  router.post("/admin-change-password",createVerifyTokenAdminMiddleware(),async (req, res) => authController.changePasswordAdmin(req, res));
  router.post("/verify-token", async (req, res) => authController.verifyToken(req, res));
  router.post("/send-activate-account-email", async (req, res) => authController.sendActivateAccountEmail(req, res));
  router.post("/activate-account", async (req, res) => authController.activateAccount(req, res));
  router.post("/verify-token-admin", async (req, res) => authController.verifyTokenAdmin(req, res));

  return router;
};

export default AuthRoutes;
