const express = require('express');
const db = require('../services/db');
const { verifyWebhookSignature } = require('../services/payments');
const { sendPaymentReceived, sendAdminAlert } = require('../services/email');

const router = express.Router();

// NOWPayments sends IPN webhooks here when payment status changes
// Docs: https://documenter.getpostman.com/view/7907941/2s93JqTRWN#callbacks

router.post('/nowpayments', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    const rawBody  = req.body.toString();
    const sig      = req.headers['x-nowpayments-sig'];
    const payload  = JSON.parse(rawBody);

    console.log('NOWPayments IPN received:', payload.payment_status, payload.payment_id);

    // Verify signature
    if (sig && !verifyWebhookSignature(rawBody, sig)) {
      console.warn('Invalid IPN signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { payment_id, payment_status, order_id } = payload;

    // Get order — try by payment_id first, fall back to order_id
    let order = db.getByPaymentId(String(payment_id));
    if (!order && order_id) order = db.getById(order_id);
    if (!order) {
      console.warn('Order not found for payment_id:', payment_id);
      return res.status(200).json({ received: true }); // always 200 to NOWPayments
    }

    // NOWPayments statuses:
    // waiting → confirming → confirmed → sending → partially_paid → finished → failed → refunded → expired
    switch (payment_status) {
      case 'waiting':
        db.setStatus(order.id, 'awaiting');
        break;

      case 'confirming':
      case 'confirmed':
      case 'sending':
        db.setStatus(order.id, 'confirming');
        break;

      case 'finished':
        if (order.status !== 'paid' && order.status !== 'fulfilled') {
          db.setPaid(String(payment_id));

          // Refresh order after update
          const paidOrder = db.getById(order.id);

          // Email customer: payment confirmed
          await sendPaymentReceived(paidOrder).catch(e =>
            console.error('Failed to send payment email:', e.message)
          );

          // Email admin: new order needs fulfillment
          await sendAdminAlert(paidOrder).catch(e =>
            console.error('Failed to send admin alert:', e.message)
          );

          console.log(`Order ${order.id} marked as PAID`);
        }
        break;

      case 'partially_paid':
        db.setStatus(order.id, 'confirming');
        console.warn(`Order ${order.id} partially paid — manual review needed`);
        break;

      case 'failed':
      case 'refunded':
        db.setStatus(order.id, 'failed');
        break;

      case 'expired':
        db.setStatus(order.id, 'expired');
        break;
    }

    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('Webhook error:', err.message);
    // Still return 200 — NOWPayments retries on non-200
    return res.status(200).json({ received: true });
  }
});

module.exports = router;
