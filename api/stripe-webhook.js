import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);

function formatOrderText(cartItems) {
  // ton cart_json ressemble à un tableau avec 1 objet, mais on gère les 2 cas
  const items = Array.isArray(cartItems) ? cartItems : [cartItems];

  return items.map((item, idx) => {
    const lines = [];
    lines.push(`Article #${idx + 1}`);
    lines.push(`Modèle: ${item.type || item.model || "?"}`);
    lines.push(`Total: ${item.total ? item.total + " €" : "?"}`);
    const el = item.elements || item; // selon ton json
    lines.push(`Carrure: ${el.carrure || "?"}`);
    lines.push(`Cadran: ${el.cadran || "?"}`);
    lines.push(`Aiguilles: ${el.aiguilles || "?"}`);
    lines.push(`Bracelet: ${el.bracelet || "?"}`);
    lines.push(`Fond: ${el.fond || "?"}`);
    lines.push(`Remontoir: ${el.remontoir || "?"}`);
    return lines.join("\n");
  }).join("\n\n");
}

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
  const summary = formatOrderText(cartItems);

await resend.emails.send({
  from: process.env.EMAIL_FROM || "KairoMod <onboarding@resend.dev>",
  to: (process.env.EMAIL_TO || "").split(",").map(s => s.trim()).filter(Boolean),
  subject: `Nouvelle commande payée - ${amountTotal / 100} ${currency.toUpperCase()}`,
  text:
`Paiement confirmé.

Email client: ${customerEmail || "non fourni"}
Session Stripe: ${session.id}

Récap des pièces:
${summary}
`
});
}
