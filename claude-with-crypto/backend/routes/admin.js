/**
 * Admin routes — protected by ADMIN_SECRET token
 * Use these to view orders and mark them as fulfilled after
 * manually purchasing the Claude subscription.
 */
const express = require('express');
const db = require('../services/db');
const { sendSubscriptionDelivery } = require('../services/email');

const router = express.Router();

// ─── AUTH MIDDLEWARE ────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token || token !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.use(requireAdmin);

// ─── GET /api/admin/orders ──────────────────────────────────────────────────
router.get('/orders', (req, res) => {
  const { status } = req.query;
  const orders = status ? db.listByStatus(status) : db.listAll();
  res.json(orders);
});

// ─── GET /api/admin/orders/:id ──────────────────────────────────────────────
router.get('/orders/:id', (req, res) => {
  const order = db.getById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  res.json(order);
});

// ─── POST /api/admin/fulfill ────────────────────────────────────────────────
// Called after you've purchased the Claude subscription manually.
// Body: { orderId, deliveryNote }
// deliveryNote = plain text with credentials, e.g.:
//   "Email: user@example.com\nPassword: Abc123!\nActive until: 2025-09-01"
router.post('/fulfill', async (req, res) => {
  const { orderId, deliveryNote } = req.body;

  if (!orderId || !deliveryNote) {
    return res.status(400).json({ error: 'orderId and deliveryNote are required' });
  }

  const order = db.getById(orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status === 'fulfilled') {
    return res.status(409).json({ error: 'Order already fulfilled' });
  }
  if (!['paid', 'confirming'].includes(order.status)) {
    return res.status(400).json({ error: `Cannot fulfill order with status: ${order.status}` });
  }

  // Mark fulfilled in DB
  db.setFulfilled(orderId, deliveryNote);

  // Send subscription email to customer
  const updated = db.getById(orderId);
  await sendSubscriptionDelivery(updated, deliveryNote);

  console.log(`Order ${orderId} fulfilled and delivery email sent to ${order.email}`);
  res.json({ success: true, message: `Delivery email sent to ${order.email}` });
});

// ─── POST /api/admin/resend ─────────────────────────────────────────────────
// Resend delivery email in case customer lost it
router.post('/resend', async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ error: 'orderId required' });

  const order = db.getById(orderId);
  if (!order) return res.status(404).json({ error: 'Not found' });
  if (order.status !== 'fulfilled' || !order.delivery_note) {
    return res.status(400).json({ error: 'Order not fulfilled yet' });
  }

  await sendSubscriptionDelivery(order, order.delivery_note);
  res.json({ success: true, message: `Resent to ${order.email}` });
});

module.exports = router;
