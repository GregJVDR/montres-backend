import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { cartItems, origin } = body || {};

    if (!origin) return res.status(400).json({ error: "origin manquant" });
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ error: "Panier vide" });
    }

    // Recalcul serveur (anti-triche basique)
    const amountTotal = cartItems.reduce((sum, item) => {
      const price = Number(item?.total);
      if (!Number.isFinite(price) || price <= 0 || price > 20000) {
        throw new Error("Prix invalide");
      }
      return sum + Math.round(price * 100);
    }, 0);

    // 1️⃣ créer la commande en DB
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        amount_total: amountTotal,
        currency: "eur",
        status: "created",
        cart_json: cartItems
      })
      .select()
      .single();

    if (error) throw error;

    // 2️⃣ créer la session Stripe
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: amountTotal,
            product_data: {
              name: "Montre personnalisée"
            }
          }
        }
      ],
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancel.html`,
      metadata: { order_id: order.id }
    });

    // 3️⃣ lier Stripe à la commande
    await supabase
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", order.id);

    return res.status(200).json({ url: session.url });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || "Erreur serveur" });
  }
}
