const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST || 'smtp.gmail.com',
      port:   parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

const PLAN_LABELS = { pro: 'Claude Pro', max5: 'Claude Max 5x', max20: 'Claude Max 20x' };

// ─── SEND PAYMENT RECEIVED ─────────────────────────────────────────────────
async function sendPaymentReceived(order) {
  const planLabel = PLAN_LABELS[order.plan] || order.plan;
  const months = order.months === 1 ? '1 month' : `${order.months} months`;

  await getTransporter().sendMail({
    from:    process.env.EMAIL_FROM,
    to:      order.email,
    subject: `✓ Payment received — Order #${order.id.slice(0,8).toUpperCase()}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="background:#08080f;color:#ffffff;font-family:Inter,Arial,sans-serif;margin:0;padding:0;">
  <div style="max-width:560px;margin:40px auto;background:#111120;border:1px solid rgba(255,255,255,0.1);border-radius:16px;overflow:hidden;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#f97316,#fb923c);padding:28px 32px;">
      <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,0.8);">CLAUDE WITH CRYPTO</p>
      <h1 style="margin:8px 0 0;font-size:24px;font-weight:800;color:#fff;">Payment Received ✓</h1>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="color:#7878a0;font-size:15px;margin-top:0;">Hi there,</p>
      <p style="color:#c0c0d0;font-size:15px;line-height:1.7;">
        We've confirmed your crypto payment. Your order is now being processed and you'll receive your
        <strong style="color:#ffffff;">${planLabel}</strong> subscription within a few hours.
      </p>

      <!-- Order details -->
      <div style="background:#0d0d1a;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin:24px 0;">
        <p style="margin:0 0 14px;font-size:11px;font-weight:700;letter-spacing:2px;color:#f97316;">ORDER DETAILS</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="color:#7878a0;padding:5px 0;">Order ID</td><td style="color:#fff;text-align:right;">#${order.id.slice(0,8).toUpperCase()}</td></tr>
          <tr><td style="color:#7878a0;padding:5px 0;">Plan</td><td style="color:#fff;text-align:right;">${planLabel}</td></tr>
          <tr><td style="color:#7878a0;padding:5px 0;">Duration</td><td style="color:#fff;text-align:right;">${months}</td></tr>
          <tr><td style="color:#7878a0;padding:5px 0;">Amount paid</td><td style="color:#f97316;text-align:right;font-weight:700;">${order.crypto_amount} ${order.crypto_currency.toUpperCase()}</td></tr>
          <tr><td style="color:#7878a0;padding:5px 0;">USD value</td><td style="color:#fff;text-align:right;">$${Number(order.usd_amount).toFixed(2)}</td></tr>
        </table>
      </div>

      <p style="color:#7878a0;font-size:13px;line-height:1.7;">
        ⏱ <strong style="color:#c0c0d0;">Estimated delivery:</strong> 2–4 hours after this email.<br/>
        If you have questions, reach us on Telegram with your order ID.
      </p>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid rgba(255,255,255,0.06);padding:18px 32px;text-align:center;">
      <p style="color:#4a4a68;font-size:12px;margin:0;">Unofficial reseller. Not affiliated with Anthropic.</p>
    </div>
  </div>
</body>
</html>`,
  });
}

// ─── SEND SUBSCRIPTION DELIVERY ───────────────────────────────────────────
async function sendSubscriptionDelivery(order, deliveryNote) {
  const planLabel = PLAN_LABELS[order.plan] || order.plan;

  await getTransporter().sendMail({
    from:    process.env.EMAIL_FROM,
    to:      order.email,
    subject: `🎉 Your ${planLabel} subscription is ready — Order #${order.id.slice(0,8).toUpperCase()}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="background:#08080f;color:#ffffff;font-family:Inter,Arial,sans-serif;margin:0;padding:0;">
  <div style="max-width:560px;margin:40px auto;background:#111120;border:1px solid rgba(255,255,255,0.1);border-radius:16px;overflow:hidden;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#22c55e,#16a34a);padding:28px 32px;">
      <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,0.8);">CLAUDE WITH CRYPTO</p>
      <h1 style="margin:8px 0 0;font-size:24px;font-weight:800;color:#fff;">Your Subscription is Ready 🎉</h1>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="color:#7878a0;font-size:15px;margin-top:0;">Hi there,</p>
      <p style="color:#c0c0d0;font-size:15px;line-height:1.7;">
        Your <strong style="color:#ffffff;">${planLabel}</strong> subscription has been activated.
        Here are your access details:
      </p>

      <!-- Credentials box -->
      <div style="background:#0a2a1a;border:1px solid rgba(34,197,94,0.25);border-radius:12px;padding:24px;margin:24px 0;">
        <p style="margin:0 0 14px;font-size:11px;font-weight:700;letter-spacing:2px;color:#22c55e;">ACCESS DETAILS</p>
        <div style="font-family:'Courier New',monospace;font-size:14px;color:#fff;white-space:pre-wrap;line-height:1.8;">${deliveryNote}</div>
      </div>

      <div style="background:#1a1a08;border:1px solid rgba(245,158,11,0.2);border-radius:10px;padding:16px;margin-bottom:20px;">
        <p style="margin:0;font-size:13px;color:#f59e0b;line-height:1.7;">
          ⚠ <strong>Important:</strong> Do not change the account password or enable 2FA.
          Do not share these credentials with anyone else.
        </p>
      </div>

      <p style="color:#7878a0;font-size:13px;line-height:1.7;">
        Thank you for your order. If you have any issues accessing your account,
        contact us on Telegram within 24 hours with order ID <strong style="color:#c0c0d0;">#${order.id.slice(0,8).toUpperCase()}</strong>.
      </p>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid rgba(255,255,255,0.06);padding:18px 32px;text-align:center;">
      <p style="color:#4a4a68;font-size:12px;margin:0;">Unofficial reseller. Not affiliated with Anthropic.</p>
    </div>
  </div>
</body>
</html>`,
  });
}

// ─── SEND ADMIN ALERT ─────────────────────────────────────────────────────
async function sendAdminAlert(order) {
  const planLabel = PLAN_LABELS[order.plan] || order.plan;
  const months = order.months === 1 ? '1 month' : `${order.months} months`;

  await getTransporter().sendMail({
    from:    process.env.EMAIL_FROM,
    to:      process.env.SMTP_USER, // send to yourself
    subject: `🔔 NEW ORDER — ${planLabel} × ${months} — $${order.usd_amount}`,
    html: `
<div style="font-family:monospace;background:#000;color:#0f0;padding:20px;border-radius:8px;">
  <h2 style="color:#f97316;">New Order Needs Fulfillment</h2>
  <p>Order ID: <strong>${order.id}</strong></p>
  <p>Email: <strong>${order.email}</strong></p>
  <p>Plan: <strong>${planLabel} — ${months}</strong></p>
  <p>Paid: <strong>${order.crypto_amount} ${order.crypto_currency.toUpperCase()} (~$${order.usd_amount})</strong></p>
  <hr style="border-color:#333;"/>
  <p>1. Go to <a href="https://claude.ai" style="color:#f97316;">claude.ai</a> and buy the subscription</p>
  <p>2. Then call the fulfill API:</p>
  <pre style="background:#111;padding:12px;border-radius:6px;color:#0ff;">
POST /api/admin/fulfill
Authorization: Bearer YOUR_ADMIN_SECRET
{
  "orderId": "${order.id}",
  "deliveryNote": "Email: customer@example.com\\nPassword: xxxxx\\nSubscription active until: ..."
}
  </pre>
</div>`,
  });
}

module.exports = { sendPaymentReceived, sendSubscriptionDelivery, sendAdminAlert };
