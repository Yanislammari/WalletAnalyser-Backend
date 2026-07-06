import { Request, Response } from "express";
import { StripeService } from "../services/stripe.service";
import { User } from "../db_schema/users/users";

export class SubscriptionController {
  private readonly stripeService: StripeService;

  constructor() {
    this.stripeService = new StripeService();
  }

  /** GET /subscription/status — current plan + Stripe details */
  public async getStatus(req: Request, res: Response): Promise<Response> {
    try {
      const user = (req as any).user as User;
      // Auto-heal: if Stripe and DB are out of sync (e.g. webhook missed), fix it now
      await this.stripeService.syncSubscriptionFromStripe(user);
      const details = await this.stripeService.getSubscriptionDetails(user);
      return res.json({
        isPro: user.subscribe,
        subscribe: user.subscribe,
        ...details,
      });
    } catch (err) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  /** POST /subscription/checkout — redirect URL to Stripe Checkout */
  public async createCheckout(req: Request, res: Response): Promise<Response> {
    try {
      const user = (req as any).user as User;
      const url = await this.stripeService.createCheckoutSession(user);
      return res.json({ url });
    } catch (err) {
      console.error("[Stripe] createCheckout error:", err);
      return res.status(500).json({ message: "Failed to create checkout session" });
    }
  }

  /** POST /subscription/portal — redirect URL to Stripe Customer Portal */
  public async createPortal(req: Request, res: Response): Promise<Response> {
    try {
      const user = (req as any).user as User;
      const url = await this.stripeService.createPortalSession(user);
      return res.json({ url });
    } catch (err: any) {
      if (err?.message === "NO_CUSTOMER") {
        return res.status(400).json({ message: "No billing account found" });
      }
      return res.status(500).json({ message: "Failed to create portal session" });
    }
  }

  /** POST /subscription/cancel — immediately cancel subscription */
  public async cancel(req: Request, res: Response): Promise<Response> {
    try {
      const user = (req as any).user as User;
      await this.stripeService.cancelSubscription(user);
      return res.json({ success: true });
    } catch (err: any) {
      if (err?.message === "NO_SUBSCRIPTION") {
        return res.status(400).json({ message: "No active subscription found" });
      }
      return res.status(500).json({ message: "Failed to cancel subscription" });
    }
  }

  /** POST /subscription/webhook — Stripe webhook (no auth) */
  public async webhook(req: Request, res: Response): Promise<Response> {
    const signature = req.headers["stripe-signature"] as string;
    try {
      await this.stripeService.handleWebhook(req.body as Buffer, signature);
      return res.json({ received: true });
    } catch (err: any) {
      console.error("[Stripe] Webhook error:", err?.message);
      return res.status(400).json({ message: err?.message ?? "Webhook error" });
    }
  }
}
