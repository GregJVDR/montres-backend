import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // ✅ CORS (indispensable pour appeler depuis IONOS)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

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

    // ✅ On calcule le total à partir de ton panier
    const amountTotal = cartItems.reduce((sum, item) => {
      const price = Number(item?.total);
      if (!Number.isFinite(price) || price <= 0) throw new Error("Prix invalide");
      return sum + Math.round(price * 100);
    }, 0);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: amountTotal,
            product_data: { name: "Montre personnalisée" }
          }
        }
      ],
      success_url: `${origin}/success.html`,
      cancel_url: `${origin}/cancel.html`
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || "Erreur serveur" });
  }
}
