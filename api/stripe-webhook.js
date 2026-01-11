import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: { bodyParser: false } // IMPORTANT pour vérifier la signature Stripe
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
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
    // Paiement réussi
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // panier récupéré depuis metadata
      let cartItems = [];
      try {
        cartItems = JSON.parse(session?.metadata?.cart || "[]");
      } catch (_) {}

      const amountTotal = session.amount_total; // en centimes
      const currency = session.currency || "eur";
      const customerEmail = session.customer_details?.email || null;

      // Insert uniquement après paiement
      const { error } = await supabase.from("orders").insert({
        status: "paid",
        amount_total: amountTotal,
        currency,
        cart_json: cartItems,
        customer_email: customerEmail,
        stripe_session_id: session.id
      });

      if (error) throw error;
    }

    return res.json({ received: true });
  } catch (e) {
    console.error(e);
    return res.status(500).send("Webhook handler failed");
  }
}
