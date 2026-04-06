import { Router } from "express";
import AuthController from "../controllers/auth.controller";
import { RegisterSchema } from "../validators/register.validator";
import { ValidatorMiddleware } from "../middleware/validator.middleware";

const AuthRoutes = (): Router => {
  const router: Router = Router();
  const authController = new AuthController();

  router.post("/register", ValidatorMiddleware(RegisterSchema), (req, res) => authController.register(req, res));

  return router;
}

export default AuthRoutes;
