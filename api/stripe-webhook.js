import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { buildOrderEmailHtml } from "./email-template";

export const config = {
  api: { bodyParser: false } // IMPORTANT pour vérifier la signature Stripe
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function formatPieces(cartItems) {
  const items = Array.isArray(cartItems) ? cartItems : [cartItems];

  return items
    .map((item, idx) => {
      const el = item?.elements || item || {};
      return [
        `Article #${idx + 1}`,
        `Modèle: ${item?.type || "?"}`,
        `Total: ${item?.total ? item.total + " €" : "?"}`,
        `Carrure: ${el.carrure || "?"}`,
        `Cadran: ${el.cadran || "?"}`,
        `Aiguilles: ${el.aiguilles || "?"}`,
        `Bracelet: ${el.bracelet || "?"}`,
        `Fond: ${el.fond || "?"}`,
        `Remontoir: ${el.remontoir || "?"}`
      ].join("\n");
    })
    .join("\n\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed.", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      let cartItems = [];
      try {
        cartItems = JSON.parse(session?.metadata?.cart || "[]");
      } catch (_) {}

      const amountTotal = session.amount_total; // centimes
      const currency = (session.currency || "eur").toUpperCase();
      const customerEmail = session.customer_details?.email || null;

      // 1) Insert Supabase (commande payée)
      const { error } = await supabase.from("orders").insert({
        status: "paid",
        amount_total: amountTotal,
        currency: currency.toLowerCase(),
        cart_json: cartItems,
        customer_email: customerEmail,
        stripe_session_id: session.id
      });

      if (error) throw error;

      // 2) Email admin
      const html = buildOrderEmailHtml({
  brandName: "KairoMod",
  logoUrl: "https://kairomod.fr/images/logo.png", // adapte si besoin
  orderId: session.id,
  customerEmail,
  currency,
  totalEUR: amountTotal / 100, // ✅ CORRECT
  items: Array.isArray(cartItems) ? cartItems : [cartItems]
});

try {
  await resend.emails.send({
    from: process.env.EMAIL_FROM || "KairoMod <contact@kairomod.fr>",
    to: (process.env.EMAIL_TO || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    subject: `Nouvelle commande payée – ${amountTotal / 100} ${currency}`,
    html
  });
} catch (emailError) {
  console.error("EMAIL FAILED", emailError);
  // ⚠️ on NE throw PAS
}
    }

    return res.json({ received: true });
  } catch (e) {
    console.error(e);
    return res.status(500).send("Webhook handler failed");
  }
}
