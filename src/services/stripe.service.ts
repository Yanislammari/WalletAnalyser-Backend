import Stripe from "stripe";
import { User } from "../db_schema/users/users";
import dotenv from "dotenv";

dotenv.config();

const STRIPE_SECRET = process.env.STRIPE_API_KEY_SECRET as string;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET as string | undefined;
const FRONTEND_URL = process.env.FRONTEND_URL_PROD ?? "http://localhost:5173";

// 29.99€/month — create this price inline via Stripe API on first use
const PRODUCT_NAME = "WalletAnalyser Pro";
const PRICE_AMOUNT = 2999; // cents
const PRICE_CURRENCY = "eur";

export class StripeService {
  private readonly stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(STRIPE_SECRET);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async getOrCreateCustomer(user: User): Promise<string> {
    if (user.stripe_customer_id) {
      return user.stripe_customer_id;
    }

    const customer = await this.stripe.customers.create({
      email: user.email,
      name: `${user.first_name} ${user.last_name}`,
      metadata: { userId: user.id },
    });

    await user.update({ stripe_customer_id: customer.id });
    return customer.id;
  }

  private async getOrCreateMonthlyPrice(): Promise<string> {
    // Look for existing active price with our metadata tag
    const prices = await this.stripe.prices.list({ active: true, limit: 100 });
    const existing = prices.data.find(
      (p) => p.metadata?.walletanalyser === "pro_monthly"
    );
    if (existing) return existing.id;

    // Create product + price once
    const product = await this.stripe.products.create({ name: PRODUCT_NAME });
    const price = await this.stripe.prices.create({
      product: product.id,
      unit_amount: PRICE_AMOUNT,
      currency: PRICE_CURRENCY,
      recurring: { interval: "month" },
      metadata: { walletanalyser: "pro_monthly" },
    });
    return price.id;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  public async createCheckoutSession(user: User): Promise<string> {
    const customerId = await this.getOrCreateCustomer(user);
    const priceId = await this.getOrCreateMonthlyPrice();

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${FRONTEND_URL}/home/subscription?success=1`,
      cancel_url: `${FRONTEND_URL}/home/subscription?canceled=1`,
      metadata: { userId: user.id },
    });

    return session.url!;
  }

  public async createPortalSession(user: User): Promise<string> {
    if (!user.stripe_customer_id) {
      throw new Error("NO_CUSTOMER");
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${FRONTEND_URL}/home/subscription`,
    });

    return session.url;
  }

  public async cancelSubscription(user: User): Promise<void> {
    if (!user.stripe_subscription_id) {
      throw new Error("NO_SUBSCRIPTION");
    }

    await this.stripe.subscriptions.cancel(user.stripe_subscription_id);
    await user.update({ subscribe: false, stripe_subscription_id: null });
  }

  public async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    let event: Stripe.Event;

    if (STRIPE_WEBHOOK_SECRET) {
      event = this.stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
    } else {
      // Dev mode without webhook secret — parse raw payload
      event = JSON.parse(payload.toString()) as Stripe.Event;
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const subscriptionId = session.subscription as string;

        if (userId && subscriptionId) {
          await User.update(
            { subscribe: true, stripe_subscription_id: subscriptionId },
            { where: { id: userId } }
          );
        }
        break;
      }

      case "customer.subscription.deleted":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const isActive = sub.status === "active" || sub.status === "trialing";

        await User.update(
          { subscribe: isActive, stripe_subscription_id: isActive ? sub.id : null },
          { where: { stripe_subscription_id: sub.id } }
        );
        break;
      }

      default:
        break;
    }
  }

  /**
   * Pull the latest subscription from Stripe and update the DB if needed.
   * Called from getStatus() so a webhook miss (e.g. localhost dev) is self-healing.
   */
  public async syncSubscriptionFromStripe(user: User): Promise<void> {
    if (!user.stripe_customer_id) return;

    const subscriptions = await this.stripe.subscriptions.list({
      customer: user.stripe_customer_id,
      status: "active",
      limit: 1,
    });

    const activeSub = subscriptions.data[0] ?? null;

    if (activeSub && (!user.subscribe || !user.stripe_subscription_id)) {
      // Stripe has an active sub but DB doesn't reflect it — fix it
      await User.update(
        { subscribe: true, stripe_subscription_id: activeSub.id },
        { where: { id: user.id } }
      );
      user.subscribe = true;
      user.stripe_subscription_id = activeSub.id;
    } else if (!activeSub && user.subscribe) {
      // Stripe has no active sub but DB thinks there is one — fix it
      await User.update(
        { subscribe: false, stripe_subscription_id: null },
        { where: { id: user.id } }
      );
      user.subscribe = false;
      user.stripe_subscription_id = null;
    }
  }

  public async getSubscriptionDetails(user: User): Promise<{
    active: boolean;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  }> {
    if (!user.stripe_subscription_id) {
      return { active: false, currentPeriodEnd: null, cancelAtPeriodEnd: false };
    }

    try {
      const sub = await this.stripe.subscriptions.retrieve(user.stripe_subscription_id);
      return {
        active: sub.status === "active" || sub.status === "trialing",
        currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      };
    } catch {
      return { active: false, currentPeriodEnd: null, cancelAtPeriodEnd: false };
    }
  }
}
