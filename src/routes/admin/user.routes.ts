import { Router } from "express";
import UserController from "../../controllers/users.controller";

const UserRoutes = (): Router => {
  const router: Router = Router();
  const userController = new UserController();

  router.post("/register_super_user",(req,res) => userController.registerSuperUsers(req,res));
  router.get("/intro", (req, res) => userController.get_all_users_intro(req, res));
  router.get("/",(req, res) => userController.get_all_users_offset(req,res)); // take a ?offset=10
  router.patch("/:userId",(req,res) => userController.ban_user(req,res))

  return router;
};

export default UserRoutes;
