export default function handler(req, res) {
  const key = process.env.STRIPE_SECRET_KEY || "";

  // On ne renvoie PAS la clé. Juste des infos non sensibles.
  res.status(200).json({
    hasKey: Boolean(key),
    startsWith: key.slice(0, 7),       // ex: "sk_tes"
    length: key.length,               // longueur
    last4: key.slice(-4),             // 4 derniers caractères
    hasSpaces: /\s/.test(key)         // true si espace/retour ligne caché
  });
}
