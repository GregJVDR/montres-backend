function formatEUR(amount) {
  // amount peut être en euros (420) ou en centimes (42000) selon ton code
  // Ici on suppose que tu passes déjà des euros (420). Adapte si besoin.
  const value = Number(amount);
  return value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function prettyLabel(key) {
  const map = {
    carrure: "Carrure",
    cadran: "Cadran",
    aiguilles: "Aiguilles",
    bracelet: "Bracelet",
    fond: "Fond",
    remontoir: "Remontoir",
  };
  return map[key] || key;
}

function renderPiecesTable(elements = {}) {
  const keys = ["carrure","cadran","aiguilles","bracelet","fond","remontoir"];
  const rows = keys
    .filter((k) => elements[k] !== undefined && elements[k] !== null)
    .map((k) => `
      <tr>
        <td style="padding:8px 0;color:#6b7280;font-size:14px;width:160px;">${escapeHtml(prettyLabel(k))}</td>
        <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">${escapeHtml(elements[k])}</td>
      </tr>
    `)
    .join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${rows || `<tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Aucune pièce</td></tr>`}
    </table>
  `;
}

function buildOrderEmailHtml({
  brandName = "KairoMod",
  logoUrl = "https://kairomod.fr/images/logo.png", // mets TON URL de logo
  orderTitle = "Nouvelle commande payée",
  orderId = "",
  customerEmail = "",
  stripeSessionId = "",
  totalEUR = 0,
  items = [],
}) {
  const itemsHtml = items.map((item, idx) => {
    const model = item.type || item.modele || "Modèle";
    const img = item.image || "";
    const itemTotal = item.total ?? null;
    const elements = item.elements || {};

    return `
      <tr>
        <td style="padding:16px;border:1px solid #e5e7eb;border-radius:14px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td style="padding-bottom:10px;">
                <span style="display:inline-block;background:#111827;color:#ffffff;font-size:12px;font-weight:700;letter-spacing:.3px;padding:6px 10px;border-radius:999px;">
                  ARTICLE #${idx + 1}
                </span>
              </td>
            </tr>

            <tr>
              <td style="padding:0 0 12px 0;">
                <div style="font-size:18px;font-weight:800;color:#111827;margin-bottom:4px;">
                  ${escapeHtml(String(model).toUpperCase())}
                </div>
                ${itemTotal !== null ? `<div style="color:#6b7280;font-size:14px;">Sous-total : <strong style="color:#111827;">${formatEUR(itemTotal)}</strong></div>` : ""}
              </td>
            </tr>

            ${img ? `
            <tr>
              <td style="padding:0 0 12px 0;">
                <img src="${escapeHtml(img)}" alt="Montre" width="520" style="width:100%;max-width:520px;border-radius:12px;display:block;border:1px solid #e5e7eb;" />
              </td>
            </tr>` : ""}

            <tr>
              <td style="padding-top:4px;">
                <div style="font-size:14px;font-weight:800;color:#111827;margin-bottom:8px;">Détails des pièces</div>
                ${renderPiecesTable(elements)}
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr><td style="height:14px;line-height:14px;">&nbsp;</td></tr>
    `;
  }).join("");

  const safeCustomerEmail = customerEmail ? escapeHtml(customerEmail) : "—";
  const safeOrderId = orderId ? escapeHtml(orderId) : "—";
  const safeStripeSessionId = stripeSessionId ? escapeHtml(stripeSessionId) : "—";

  return `
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${escapeHtml(orderTitle)}</title>
  </head>

  <body style="margin:0;padding:0;background:#f6f7fb;">
    <center style="width:100%;background:#f6f7fb;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td align="center" style="padding:28px 16px;">
            <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="border-collapse:collapse;max-width:640px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb;">
              
              <!-- Header -->
              <tr>
                <td style="padding:22px 24px;background:#0b0b0d;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                    <tr>
                      <td align="left" style="vertical-align:middle;">
                        ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(brandName)}" height="34" style="height:34px;display:block;" />` : `<div style="color:#fff;font-weight:800;font-size:18px;">${escapeHtml(brandName)}</div>`}
                      </td>
                      <td align="right" style="vertical-align:middle;color:#fff;font-size:12px;opacity:.85;">
                        Paiement confirmé
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Title -->
              <tr>
                <td style="padding:22px 24px 8px 24px;">
                  <div style="font-size:22px;line-height:1.25;font-weight:900;color:#111827;">
                    ${escapeHtml(orderTitle)}
                  </div>
                  <div style="margin-top:6px;color:#6b7280;font-size:14px;line-height:1.4;">
                    Une commande vient d’être payée via Stripe Checkout.
                  </div>
                </td>
              </tr>

              <!-- Summary -->
              <tr>
                <td style="padding:10px 24px 16px 24px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:14px;">
                    <tr>
                      <td style="padding:14px 16px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                          <tr>
                            <td style="color:#6b7280;font-size:13px;">Email client</td>
                            <td align="right" style="color:#111827;font-size:13px;font-weight:700;">${safeCustomerEmail}</td>
                          </tr>
                          <tr>
                            <td style="color:#6b7280;font-size:13px;padding-top:8px;">Order ID (Supabase)</td>
                            <td align="right" style="color:#111827;font-size:13px;font-weight:700;padding-top:8px;">${safeOrderId}</td>
                          </tr>
                          <tr>
                            <td style="color:#6b7280;font-size:13px;padding-top:8px;">Session Stripe</td>
                            <td align="right" style="color:#111827;font-size:13px;font-weight:700;padding-top:8px;">${safeStripeSessionId}</td>
                          </tr>
                          <tr>
                            <td style="color:#6b7280;font-size:13px;padding-top:12px;">Total</td>
                            <td align="right" style="color:#111827;font-size:18px;font-weight:900;padding-top:12px;">
                              ${formatEUR(totalEUR)}
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Items -->
              <tr>
                <td style="padding:0 24px 10px 24px;">
                  <div style="font-size:14px;font-weight:900;color:#111827;margin:8px 0 10px 0;">
                    Récap des pièces
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding:0 24px 22px 24px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                    ${itemsHtml || `<tr><td style="padding:16px;border:1px solid #e5e7eb;border-radius:14px;color:#6b7280;">Aucun article</td></tr>`}
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding:18px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
                  <div style="color:#6b7280;font-size:12px;line-height:1.4;">
                    Cet email a été envoyé automatiquement par ${escapeHtml(brandName)}.
                  </div>
                </td>
              </tr>

            </table>

            <div style="color:#9ca3af;font-size:11px;margin-top:10px;">
              © ${new Date().getFullYear()} ${escapeHtml(brandName)}
            </div>

          </td>
        </tr>
      </table>
    </center>
  </body>
</html>
`;
}
