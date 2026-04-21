import { Router } from "express";
import UserController from "../controllers/users.controller";
import { createVerifyTokenAdminMiddleware } from "../middleware/token";

const UserRoutes = (): Router => {
  const router: Router = Router();
  const userController = new UserController();

  router.get("/users", createVerifyTokenAdminMiddleware, (req, res) => userController.get_all_users_paginated(req, res)); // take a ?offset=10

  return router;
};

export default UserRoutes;
