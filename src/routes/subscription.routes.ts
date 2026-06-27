import { Router } from "express";
import express from "express";
import { SubscriptionController } from "../controllers/subscription.controller";
import { createVerifyTokenMiddleware } from "../middleware/token";

const SubscriptionRoutes = (): Router => {
  const router: Router = Router();
  const ctrl = new SubscriptionController();

  // Stripe webhook must receive raw body — register BEFORE json middleware
  router.post(
    "/webhook",
    express.raw({ type: "application/json" }),
    (req, res) => ctrl.webhook(req, res)
  );

  // Authenticated routes
  router.get("/status", createVerifyTokenMiddleware(), (req, res) => ctrl.getStatus(req, res));
  router.post("/checkout", createVerifyTokenMiddleware(), (req, res) => ctrl.createCheckout(req, res));
  router.post("/portal", createVerifyTokenMiddleware(), (req, res) => ctrl.createPortal(req, res));
  router.post("/cancel", createVerifyTokenMiddleware(), (req, res) => ctrl.cancel(req, res));

  return router;
};

export default SubscriptionRoutes;
