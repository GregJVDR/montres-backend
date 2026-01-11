import Stripe from "stripe";
import { buffer } from "micro";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { buildOrderEmailHtml } from "./email-template";

export const config = {
  api: { bodyParser: false }
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  let event;
  try {
    const rawBody = await buffer(req);
    const sig = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Signature error:", err.message);
    return res.status(400).send(`Webhook Error`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const { data: existing } = await supabase
        .from("orders")
        .select("id")
        .eq("stripe_session_id", session.id)
        .maybeSingle();

      if (existing) {
        return res.status(200).json({ received: true });
      }

      const cartItems = JSON.parse(session.metadata?.cart || "[]");
      const amountTotal = session.amount_total;
      const currency = session.currency;
      const customerEmail = session.customer_details?.email || null;

      const { error } = await supabase.from("orders").insert({
        status: "paid",
        amount_total: amountTotal,
        currency,
        cart_json: cartItems,
        customer_email: customerEmail,
        stripe_session_id: session.id
      });

      if (error) throw error;

      const html = buildOrderEmailHtml({
        brandName: "KairoMod",
        logoUrl: "https://kairomod.fr/images/logo.png",
        orderId: session.id,
        customerEmail,
        currency: currency.toUpperCase(),
        totalEUR: amountTotal / 100,
        items: cartItems
      });

      resend.emails.send({
        from: "KairoMod <contact@kairomod.fr>",
        to: process.env.EMAIL_TO.split(","),
        subject: `Nouvelle commande – ${amountTotal / 100}€`,
        html
      }).catch(() => {});
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook processing failed:", err);
    return res.status(500).end();
  }
}
