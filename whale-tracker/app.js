'use strict';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = {
  usd: (n) => {
    const abs = Math.abs(n);
    const s = abs >= 1e6 ? `$${(abs / 1e6).toFixed(2)}M`
             : abs >= 1e3 ? `$${(abs / 1e3).toFixed(1)}K`
             : `$${abs.toFixed(0)}`;
    return (n < 0 ? '-' : '+') + s;
  },
  vol: (n) => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${(n / 1e3).toFixed(0)}K`,
  pct: (n) => `${(n * 100).toFixed(1)}%`,
  lev: (n) => `${n}×`,
};

const HL_BASE = 'https://app.hyperliquid.xyz/explorer/address/';

function shortWallet(addr) {
  return addr.length > 12 ? addr.slice(0, 6) + '…' + addr.slice(-4) : addr;
}

function wrClass(r) {
  return r >= 0.80 ? 'wr-high' : r >= 0.65 ? 'wr-mid' : 'wr-low';
}

// ── State ─────────────────────────────────────────────────────────────────────

let allWhales = [];
let activeFilter = 'all';
let sortCol = 'winRate';
let sortDir = -1;          // -1 = desc

// ── Render ────────────────────────────────────────────────────────────────────

function renderTable(whales) {
  const tbody = document.getElementById('whale-body');
  if (!whales.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="loading">No whales match filter.</td></tr>';
    return;
  }

  tbody.innerHTML = whales.map((w, i) => {
    const pnlClass = w.pnl24h >= 0 ? 'pnl-pos' : 'pnl-neg';
    const styleClass = w.style === 'day' ? 'badge-day' : 'badge-swing';

    const posCell = w.position
      ? `<div class="pos-cell">
           <span class="pos-side pos-${w.position.side}">${w.position.side.toUpperCase()}</span>
           <span>${w.position.asset} ${w.position.size}</span>
         </div>`
      : `<span class="pos-none">— no open pos</span>`;

    return `<tr data-wallet="${w.fullAddress}">
      <td>${i + 1}</td>
      <td><span class="wallet-pill">${shortWallet(w.wallet)}</span></td>
      <td><span class="badge ${styleClass}">${w.style}</span></td>
      <td><span class="leverage">${fmt.lev(w.leverage)}</span></td>
      <td>
        <div class="winrate-wrap">
          <span>${fmt.pct(w.winRate)}</span>
          <div class="winrate-bar">
            <div class="winrate-fill ${wrClass(w.winRate)}" style="width:${w.winRate * 100}%"></div>
          </div>
        </div>
      </td>
      <td class="${pnlClass}">${fmt.usd(w.pnl24h)}</td>
      <td>${fmt.vol(w.volume24h)}</td>
      <td>${w.trades24h}</td>
      <td>${posCell}</td>
      <td><a class="link-btn" href="${HL_BASE}${w.fullAddress}" target="_blank" rel="noopener">View ↗</a></td>
    </tr>`;
  }).join('');
}

function renderCards(whales) {
  const grid = document.getElementById('position-cards');
  const active = whales.filter((w) => w.position);

  if (!active.length) {
    grid.innerHTML = '';
    return;
  }

  grid.innerHTML = active.map((w) => {
    const p = w.position;
    const pnlClass = w.pnl24h >= 0 ? 'pnl-pos' : 'pnl-neg';
    return `
    <div class="card">
      <div class="card-header">
        <span class="card-wallet">${shortWallet(w.wallet)}</span>
        <span class="badge ${w.style === 'day' ? 'badge-day' : 'badge-swing'}">${w.style}</span>
      </div>
      <div class="card-body">
        <div class="card-stat">
          <div class="k">Asset</div>
          <div class="v">${p.asset}</div>
        </div>
        <div class="card-stat">
          <div class="k">Side</div>
          <div class="v pos-side pos-${p.side}" style="display:inline-block">${p.side.toUpperCase()}</div>
        </div>
        <div class="card-stat">
          <div class="k">Size</div>
          <div class="v">${p.size}</div>
        </div>
        <div class="card-stat">
          <div class="k">Leverage</div>
          <div class="v" style="color:var(--yellow)">${fmt.lev(w.leverage)}</div>
        </div>
        <div class="card-stat">
          <div class="k">Entry</div>
          <div class="v">$${p.entry.toLocaleString()}</div>
        </div>
        <div class="card-stat">
          <div class="k">Liq Price</div>
          <div class="v" style="color:var(--red)">$${p.liq.toLocaleString()}</div>
        </div>
      </div>
      <div class="card-footer">
        <span class="${pnlClass}">PnL 24h: ${fmt.usd(w.pnl24h)}</span>
        <a class="link-btn" href="${HL_BASE}${w.fullAddress}" target="_blank" rel="noopener">View ↗</a>
      </div>
    </div>`;
  }).join('');
}

function renderStats(whales) {
  if (!whales.length) return;
  const avgWR = whales.reduce((s, w) => s + w.winRate, 0) / whales.length;
  const totalVol = whales.reduce((s, w) => s + w.volume24h, 0);
  const activePosCount = whales.filter((w) => w.position).length;

  document.getElementById('total-whales').textContent = whales.length;
  document.getElementById('avg-winrate').textContent  = fmt.pct(avgWR);
  document.getElementById('total-volume').textContent  = fmt.vol(totalVol);
  document.getElementById('active-pos').textContent   = activePosCount;
}

function applyFilterAndSort() {
  let data = activeFilter === 'all'
    ? allWhales
    : allWhales.filter((w) => w.style === activeFilter);

  data = [...data].sort((a, b) => {
    let av = a[sortCol], bv = b[sortCol];
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    return av < bv ? sortDir : av > bv ? -sortDir : 0;
  });

  renderTable(data);
  renderCards(data);
  renderStats(data);
}

// ── Load & refresh ────────────────────────────────────────────────────────────

async function load() {
  allWhales = await fetchWhales();
  applyFilterAndSort();
}

// ── Event listeners ───────────────────────────────────────────────────────────

document.querySelectorAll('.filter-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    applyFilterAndSort();
  });
});

document.querySelectorAll('thead th').forEach((th, idx) => {
  const colMap = [null, 'wallet', 'style', 'leverage', 'winRate', 'pnl24h', 'volume24h', 'trades24h', null, null];
  th.addEventListener('click', () => {
    const col = colMap[idx];
    if (!col) return;
    if (sortCol === col) sortDir *= -1;
    else { sortCol = col; sortDir = -1; }
    applyFilterAndSort();
  });
});

// ── Init ──────────────────────────────────────────────────────────────────────

load();
setInterval(load, 30_000);   // refresh every 30 s
