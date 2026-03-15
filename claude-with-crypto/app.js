/* ─── PRICING ($USD) ─────────────────────────────────────────────────────────── */
const PRICES = {
  pro:   { 1: 130,  3: 360,  6: 670,   12: 1260 },
  max5:  { 1: 200,  3: 560,  6: 1050,  12: 1960 },
  max20: { 1: 250,  3: 705,  6: 1380,  12: 2580 },
};

// SOL_PRICE is approximate; production would fetch live price
const SOL_PRICE_USD = 155;

const PLAN_LABELS = { pro: 'Pro', max5: 'Max 5x', max20: 'Max 20x' };
const CURRENCY_LABELS = { usdc: 'USDC', usdt: 'USDT', sol: 'SOL' };

const ADDRESSES = {
  solana:   'BvW7GQ3XHjXz8YrxC9tMk2nJpLqFzKdW5sRbUePoT4ah',
  ethereum: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
  polygon:  '0x3A5C2E9b4F1D7e8B06c3D9A2f5E4C1B8d7A6e9F2',
};

/* ─── STATE ──────────────────────────────────────────────────────────────────── */
const state = { plan: 'max5', months: 6, currency: 'usdc', network: 'solana' };

/* ─── HELPERS ────────────────────────────────────────────────────────────────── */
function usdPrice()    { return PRICES[state.plan][state.months]; }
function fmtUsd(n)     { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function cryptoAmount() {
  const usd = usdPrice();
  if (state.currency === 'sol') return (usd / SOL_PRICE_USD).toFixed(3);
  return usd.toFixed(2);
}

/* ─── RENDER SUMMARY ─────────────────────────────────────────────────────────── */
function renderSummary() {
  const sym = CURRENCY_LABELS[state.currency];
  const months = state.months === 1 ? '1 month' : `${state.months} months`;
  document.getElementById('sumPlan').textContent     = PLAN_LABELS[state.plan];
  document.getElementById('sumDuration').textContent = months;
  document.getElementById('sumCurrency').textContent = sym;
  document.getElementById('sumTotal').textContent    = fmtUsd(usdPrice());
  document.getElementById('sumCrypto').textContent   = `${cryptoAmount()} ${sym}`;
}

/* ─── PLAN CARDS ─────────────────────────────────────────────────────────────── */
document.querySelectorAll('.plan-card').forEach(btn => {
  btn.addEventListener('click', () => {
    state.plan = btn.dataset.plan;
    document.querySelectorAll('.plan-card').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderSummary();
  });
});
// Set initial active
document.querySelector('.plan-card[data-plan="max5"]').classList.add('active');

/* ─── DURATION ───────────────────────────────────────────────────────────────── */
document.querySelectorAll('.dur-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.months = parseInt(btn.dataset.months, 10);
    document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderSummary();
  });
});

/* ─── CURRENCY ───────────────────────────────────────────────────────────────── */
document.querySelectorAll('.cur-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.currency = btn.dataset.currency;
    document.querySelectorAll('.cur-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderSummary();
    // Auto-switch modal network if open
    if (state.currency === 'sol') setNetwork('solana');
    else setNetwork('ethereum');
  });
});

/* ─── FAQ ACCORDION ──────────────────────────────────────────────────────────── */
document.querySelectorAll('.faq-q').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const open = item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
    if (!open) item.classList.add('open');
  });
});

/* ─── MODAL ──────────────────────────────────────────────────────────────────── */
const overlay     = document.getElementById('modalOverlay');
const modalClose  = document.getElementById('modalClose');
const checkoutBtn = document.getElementById('checkoutBtn');
let timer = null;
let qrInstance = null;

function openModal() {
  const email = document.getElementById('emailInput').value.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const inp = document.getElementById('emailInput');
    inp.focus();
    inp.style.borderColor = '#f87171';
    inp.style.boxShadow = '0 0 0 3px rgba(248,113,113,0.18)';
    setTimeout(() => { inp.style.borderColor = ''; inp.style.boxShadow = ''; }, 2200);
    return;
  }

  // Update modal content
  const sym = CURRENCY_LABELS[state.currency];
  document.getElementById('modalAmount').textContent = `${cryptoAmount()} ${sym}`;

  // Reset tracker steps
  ['ts1','ts2','ts3'].forEach((id, i) => {
    document.getElementById(id).classList.toggle('active', i === 0);
  });

  // Set network from currency
  const net = state.currency === 'sol' ? 'solana' : 'ethereum';
  setNetwork(net);

  startCountdown(30 * 60);
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  overlay.classList.remove('open');
  document.body.style.overflow = '';
  if (timer) { clearInterval(timer); timer = null; }
}

checkoutBtn.addEventListener('click', openModal);
modalClose.addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ─── NETWORK TABS ───────────────────────────────────────────────────────────── */
document.querySelectorAll('.net-tab').forEach(btn => {
  btn.addEventListener('click', () => setNetwork(btn.dataset.net));
});

function setNetwork(net) {
  state.network = net;
  document.querySelectorAll('.net-tab').forEach(b => b.classList.toggle('active', b.dataset.net === net));
  document.getElementById('depositAddr').textContent = ADDRESSES[net];
  buildQR(ADDRESSES[net]);
}

/* ─── QR CODE ────────────────────────────────────────────────────────────────── */
function buildQR(text) {
  const container = document.getElementById('qrCanvas');
  container.innerHTML = '';
  if (typeof QRCode !== 'undefined') {
    qrInstance = new QRCode(container, {
      text: text,
      width: 140,
      height: 140,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M,
    });
  } else {
    // Fallback if library fails to load
    container.style.width = '140px';
    container.style.height = '140px';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.fontSize = '12px';
    container.style.color = '#666';
    container.textContent = 'QR unavailable';
  }
}

/* ─── COPY ADDRESS ───────────────────────────────────────────────────────────── */
document.getElementById('copyBtn').addEventListener('click', () => {
  const addr = ADDRESSES[state.network];
  const btn = document.getElementById('copyBtn');
  navigator.clipboard.writeText(addr).then(() => {
    btn.textContent = '✓ Copied';
    btn.style.background = '#22c55e';
    setTimeout(() => { btn.textContent = 'Copy'; btn.style.background = ''; }, 2200);
  }).catch(() => {
    // Fallback for browsers without clipboard API
    const ta = document.createElement('textarea');
    ta.value = addr;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    btn.textContent = '✓ Copied';
    btn.style.background = '#22c55e';
    setTimeout(() => { btn.textContent = 'Copy'; btn.style.background = ''; }, 2200);
  });
});

/* ─── COUNTDOWN ──────────────────────────────────────────────────────────────── */
function startCountdown(secs) {
  if (timer) clearInterval(timer);
  let remaining = secs;
  const el = document.getElementById('countdown');

  function tick() {
    if (remaining < 0) {
      clearInterval(timer);
      el.textContent = 'Expired';
      el.style.color = '#f87171';
      return;
    }
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    remaining--;
  }
  tick();
  timer = setInterval(tick, 1000);
}

/* ─── INIT ───────────────────────────────────────────────────────────────────── */
renderSummary();
