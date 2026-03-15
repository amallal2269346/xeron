const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../orders.db'));

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// ─── SCHEMA ────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id              TEXT PRIMARY KEY,
    email           TEXT NOT NULL,
    plan            TEXT NOT NULL,
    months          INTEGER NOT NULL,
    currency        TEXT NOT NULL,
    usd_amount      REAL NOT NULL,
    crypto_amount   TEXT NOT NULL,
    crypto_currency TEXT NOT NULL,
    payment_id      TEXT,
    payment_address TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',
    -- pending | awaiting | confirming | paid | fulfilled | expired | failed
    delivery_note   TEXT,
    created_at      INTEGER NOT NULL,
    paid_at         INTEGER,
    fulfilled_at    INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_orders_status    ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_email     ON orders(email);
  CREATE INDEX IF NOT EXISTS idx_orders_payment_id ON orders(payment_id);
`);

// ─── HELPERS ────────────────────────────────────────────────────────────────
const stmt = {
  create: db.prepare(`
    INSERT INTO orders (id, email, plan, months, currency, usd_amount, crypto_amount, crypto_currency, status, created_at)
    VALUES (@id, @email, @plan, @months, @currency, @usd_amount, @crypto_amount, @crypto_currency, 'pending', @created_at)
  `),

  setPayment: db.prepare(`
    UPDATE orders SET payment_id = @payment_id, payment_address = @payment_address, status = 'awaiting'
    WHERE id = @id
  `),

  setStatus: db.prepare(`
    UPDATE orders SET status = @status WHERE id = @id
  `),

  setPaid: db.prepare(`
    UPDATE orders SET status = 'paid', paid_at = @paid_at WHERE payment_id = @payment_id
  `),

  setFulfilled: db.prepare(`
    UPDATE orders SET status = 'fulfilled', delivery_note = @delivery_note, fulfilled_at = @fulfilled_at
    WHERE id = @id
  `),

  getById: db.prepare(`SELECT * FROM orders WHERE id = ?`),

  getByPaymentId: db.prepare(`SELECT * FROM orders WHERE payment_id = ?`),

  listAll: db.prepare(`SELECT * FROM orders ORDER BY created_at DESC`),

  listByStatus: db.prepare(`SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC`),
};

module.exports = {
  createOrder: (data) => stmt.create.run(data),
  setPayment:  (data) => stmt.setPayment.run(data),
  setStatus:   (id, status) => stmt.setStatus.run({ id, status }),
  setPaid:     (paymentId) => stmt.setPaid.run({ payment_id: paymentId, paid_at: Date.now() }),
  setFulfilled:(id, note) => stmt.setFulfilled.run({ id, delivery_note: note, fulfilled_at: Date.now() }),
  getById:     (id) => stmt.getById.get(id),
  getByPaymentId: (pid) => stmt.getByPaymentId.get(pid),
  listAll:     () => stmt.listAll.all(),
  listByStatus:(status) => stmt.listByStatus.all(status),
};
