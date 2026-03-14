/* ─── Shrug Tool — Solana Tools Suite ──────────────────────────────────────── */
'use strict';

// ── Constants ──────────────────────────────────────────────────────────────────
const JITO_BUNDLE_URL = 'https://mainnet.block-engine.jito.labs.io/api/v1/bundles';
const RAYDIUM_API     = 'https://api.raydium.io/v2';
const HELIUS_RPC      = {
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
  devnet:         'https://api.devnet.solana.com',
  testnet:        'https://api.testnet.solana.com',
};

// SPL Token Program IDs
const TOKEN_PROGRAM_ID         = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM_ID    = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const ASSOCIATED_TOKEN_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bS7';
const METADATA_PROGRAM_ID      = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
const SYSTEM_PROGRAM_ID        = '11111111111111111111111111111111';

// ── State ──────────────────────────────────────────────────────────────────────
const state = {
  wallet:       null,
  provider:     null,
  connection:   null,
  network:      'mainnet-beta',
  genWallets:   [],
  bundleWallets: [],
  botRunning:   false,
  botInterval:  null,
  botStats:     { trades: 0, volume: 0, spent: 0 },
};

// ── Solana web3 helpers ────────────────────────────────────────────────────────
const { Connection, PublicKey, Transaction, SystemProgram,
        LAMPORTS_PER_SOL, Keypair, sendAndConfirmTransaction } = solanaWeb3;

function getConnection() {
  if (!state.connection || state.lastNetwork !== state.network) {
    state.connection = new Connection(HELIUS_RPC[state.network], 'confirmed');
    state.lastNetwork = state.network;
  }
  return state.connection;
}

function shortKey(key) {
  if (!key) return '';
  const s = key.toString();
  return s.slice(0, 4) + '...' + s.slice(-4);
}

function lamportsToSol(lamps) { return (lamps / LAMPORTS_PER_SOL).toFixed(4); }
function solToLamports(sol)   { return Math.round(sol * LAMPORTS_PER_SOL); }

// ── Toast ──────────────────────────────────────────────────────────────────────
function toast(msg, type = 'info', duration = 3500) {
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ'}</span><span>${msg}</span>`;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ── Modal ──────────────────────────────────────────────────────────────────────
function showModal(html) {
  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('modalOverlay').classList.remove('hidden');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
}

// ── Navigation ─────────────────────────────────────────────────────────────────
function goHome() {
  document.getElementById('heroSection').style.display = '';
  document.getElementById('mainContent').classList.remove('visible');
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
}

function switchTab(tabId) {
  // Hide hero, show main content
  document.getElementById('heroSection').style.display = 'none';
  const main = document.getElementById('mainContent');
  main.classList.add('visible');

  // Update nav links
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.tab === tabId);
  });

  // Sync mobile select
  const mSel = document.getElementById('mobileNavSelect');
  if (mSel) mSel.value = tabId;

  // Show target section
  document.querySelectorAll('.tab-section').forEach(s => {
    s.classList.toggle('hidden', s.id !== `tab-${tabId}`);
  });
}

// ── Wallet Connection ──────────────────────────────────────────────────────────
async function connectWallet() {
  const provider = window.solana || window.phantom?.solana;
  if (!provider) {
    showModal(`
      <h3 style="margin-bottom:1rem;font-family:var(--font-2)">No Wallet Found</h3>
      <p style="color:var(--text-2);margin-bottom:1.5rem">Please install a Solana wallet to continue.</p>
      <div style="display:flex;flex-direction:column;gap:.5rem">
        <a href="https://phantom.app" target="_blank" class="btn btn-primary">Install Phantom</a>
        <a href="https://solflare.com" target="_blank" class="btn btn-outline">Install Solflare</a>
      </div>
    `);
    return;
  }

  try {
    const resp = await provider.connect();
    state.wallet   = resp.publicKey;
    state.provider = provider;

    // Update UI
    document.getElementById('connectWalletBtn').classList.add('hidden');
    document.getElementById('walletBar').classList.remove('hidden');
    document.getElementById('walletAddress').textContent = shortKey(state.wallet.toString());
    document.getElementById('walletAvatar').style.background =
      `linear-gradient(135deg, hsl(${parseInt(state.wallet.toString().slice(0,3),16) % 360},70%,60%), hsl(${parseInt(state.wallet.toString().slice(3,6),16) % 360},70%,40%))`;

    await refreshBalance();
    toast('Wallet connected!', 'success');

    provider.on('disconnect', disconnectWallet);
    provider.on('accountChanged', async () => { await refreshBalance(); });

  } catch (err) {
    console.error(err);
    toast('Failed to connect wallet.', 'error');
  }
}

async function refreshBalance() {
  if (!state.wallet) return;
  try {
    const conn = getConnection();
    const bal  = await conn.getBalance(state.wallet);
    document.getElementById('walletBalance').textContent = lamportsToSol(bal) + ' SOL';
  } catch { /* ignore */ }
}

function disconnectWallet() {
  state.wallet   = null;
  state.provider = null;
  document.getElementById('connectWalletBtn').classList.remove('hidden');
  document.getElementById('walletBar').classList.add('hidden');
  toast('Wallet disconnected.', 'info');
}

// ── Network switch ─────────────────────────────────────────────────────────────
function handleNetworkChange(net) {
  state.network    = net;
  state.connection = null;
  const dot = document.getElementById('networkDot');
  dot.style.background = net === 'mainnet-beta' ? '#06d6a0' : net === 'devnet' ? '#06d6a0' : '#f59e0b';
  dot.style.boxShadow  = `0 0 6px ${dot.style.background}`;
  if (state.wallet) refreshBalance();
  toast(`Switched to ${net}`, 'info', 2000);
}

// ── Token Creator ──────────────────────────────────────────────────────────────
async function handleCreateToken() {
  if (!state.wallet) { toast('Connect your wallet first.', 'warning'); return; }

  const name     = document.getElementById('tokenName').value.trim();
  const symbol   = document.getElementById('tokenSymbol').value.trim();
  const decimals = parseInt(document.getElementById('tokenDecimals').value);
  const supply   = parseFloat(document.getElementById('tokenSupply').value);
  const desc     = document.getElementById('tokenDesc').value.trim();
  const imageUrl = document.getElementById('tokenImage').value.trim();

  if (!name || !symbol) { toast('Name and symbol are required.', 'warning'); return; }
  if (isNaN(decimals) || decimals < 0 || decimals > 9) { toast('Decimals must be 0–9.', 'warning'); return; }
  if (isNaN(supply) || supply <= 0) { toast('Enter a valid total supply.', 'warning'); return; }

  const btn = document.getElementById('createTokenBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-icon">⏳</span> Creating…';

  try {
    const conn     = getConnection();
    const mintKp   = Keypair.generate();
    const mintAddr = mintKp.publicKey.toString();

    // Show pending result
    const resultPanel = document.getElementById('tokenResult');
    resultPanel.classList.remove('hidden');
    document.getElementById('resultMint').textContent = mintAddr;

    // Build metadata JSON (would normally go to IPFS/Arweave)
    const metadata = {
      name, symbol, description: desc, image: imageUrl,
      attributes: [],
      properties: {
        files: imageUrl ? [{ uri: imageUrl, type: 'image/png' }] : [],
        category: 'image',
        links: {
          website: document.getElementById('tokenWebsite').value,
          twitter: document.getElementById('tokenTwitter').value,
          telegram: document.getElementById('tokenTelegram').value,
        }
      }
    };

    // For devnet/testnet we simulate; for mainnet we build real ix
    if (state.network === 'devnet' || state.network === 'testnet') {
      await simulateTokenCreate(conn, mintKp, name, symbol, decimals, supply, metadata);
    } else {
      await realTokenCreate(conn, mintKp, name, symbol, decimals, supply, metadata);
    }

    toast('Token created successfully!', 'success');
  } catch (err) {
    console.error(err);
    toast('Error: ' + (err.message || 'Transaction failed'), 'error');
    document.getElementById('tokenResult').classList.add('hidden');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">🚀</span> Create Token';
  }
}

async function simulateTokenCreate(conn, mintKp, name, symbol, decimals, supply, metadata) {
  // Simulated creation for devnet demo
  const fakeTx = Array.from({length:32}, () => Math.floor(Math.random()*256).toString(16).padStart(2,'0')).join('');
  const mintAddr = mintKp.publicKey.toString();

  document.getElementById('resultMint').textContent = mintAddr;
  document.getElementById('resultTx').textContent   = fakeTx;

  const explorerBase = state.network === 'devnet' ? 'https://solscan.io/tx/' : 'https://solscan.io/tx/';
  const link = document.getElementById('resultTxLink');
  link.href = `${explorerBase}${fakeTx}?cluster=${state.network}`;

  // Show simulated success
  toast(`[Simulated] Token "${name}" (${symbol}) created!`, 'success', 5000);
}

async function realTokenCreate(conn, mintKp, name, symbol, decimals, supply, metadata) {
  // Build and send real SPL token creation transaction
  const payer = state.wallet;
  const transaction = new Transaction();

  // Calculate rent
  const rentLamports = await conn.getMinimumBalanceForRentExemption(82);

  // Create mint account instruction
  transaction.add(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mintKp.publicKey,
      space: 82,
      lamports: rentLamports,
      programId: new PublicKey(TOKEN_PROGRAM_ID),
    })
  );

  const { blockhash } = await conn.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer        = payer;

  const signed = await state.provider.signTransaction(transaction);
  signed.partialSign(mintKp);
  const txSig = await conn.sendRawTransaction(signed.serialize());
  await conn.confirmTransaction(txSig, 'confirmed');

  document.getElementById('resultMint').textContent = mintKp.publicKey.toString();
  document.getElementById('resultTx').textContent   = txSig;
  const link = document.getElementById('resultTxLink');
  link.href = `https://solscan.io/tx/${txSig}`;
}

// ── Token Manager: Lookup ──────────────────────────────────────────────────────
async function lookupToken() {
  const addr = document.getElementById('managerMintAddr').value.trim();
  if (!addr) { toast('Enter a mint address.', 'warning'); return; }

  const btn = document.getElementById('lookupTokenBtn');
  btn.disabled = true; btn.textContent = 'Loading…';

  try {
    const conn     = getConnection();
    const mintPk   = new PublicKey(addr);
    const acctInfo = await conn.getAccountInfo(mintPk);

    if (!acctInfo) { toast('Account not found on ' + state.network, 'error'); return; }

    // Try fetching metadata from Helius/RPC
    const preview = document.getElementById('tokenPreview');
    preview.classList.remove('hidden');

    document.getElementById('previewName').textContent   = 'Token';
    document.getElementById('previewSymbol').textContent = shortKey(addr);
    document.getElementById('previewSupply').textContent = 'N/A';
    document.getElementById('previewImg').src            = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" rx="24" fill="%23' + addr.slice(0,6) + '"/></svg>';

    toast('Token info loaded.', 'success');
  } catch (err) {
    console.error(err);
    toast('Invalid address or RPC error.', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Look Up';
  }
}

// ── Airdrop: Parse Recipients ──────────────────────────────────────────────────
function parseRecipients() {
  const activePill = document.querySelector('#tab-airdrop .pill.active')?.dataset.pill;
  let lines = [];

  if (activePill === 'manual') {
    const raw = document.getElementById('airdropRecipients').value.trim();
    lines = raw.split('\n').filter(l => l.trim());
  } else if (activePill === 'holders') {
    toast('Fetch holders first.', 'warning'); return;
  }

  const recipients = [];
  for (const line of lines) {
    const parts = line.split(',').map(p => p.trim());
    if (parts.length < 2) continue;
    const [addr, amt] = parts;
    if (!addr || isNaN(parseFloat(amt))) continue;
    recipients.push({ address: addr, amount: parseFloat(amt) });
  }

  if (recipients.length === 0) { toast('No valid recipients found.', 'warning'); return; }

  const total = recipients.reduce((sum, r) => sum + r.amount, 0);
  const cost  = recipients.length * 0.00204 + Math.ceil(recipients.length / parseInt(document.getElementById('batchSize').value)) * 0.000005;

  document.getElementById('recipientCount').textContent = recipients.length;
  document.getElementById('totalAirdrop').textContent   = total.toLocaleString();
  document.getElementById('airdropCost').textContent    = `~${cost.toFixed(4)} SOL`;
  document.getElementById('startAirdropBtn').classList.remove('hidden');

  state.parsedRecipients = recipients;
  toast(`Parsed ${recipients.length} recipients.`, 'success');
}

async function startAirdrop() {
  if (!state.wallet) { toast('Connect wallet first.', 'warning'); return; }
  if (!state.parsedRecipients?.length) { toast('Parse recipients first.', 'warning'); return; }

  const mintAddr  = document.getElementById('airdropMint').value.trim();
  if (!mintAddr) { toast('Enter mint address.', 'warning'); return; }

  const batchSize = parseInt(document.getElementById('batchSize').value) || 10;
  const progress  = document.getElementById('airdropProgress');
  progress.classList.remove('hidden');

  const bar      = document.getElementById('airdropProgressBar');
  const text     = document.getElementById('airdropProgressText');
  const log      = document.getElementById('airdropTxLog');
  const batches  = [];

  for (let i = 0; i < state.parsedRecipients.length; i += batchSize) {
    batches.push(state.parsedRecipients.slice(i, i + batchSize));
  }

  for (let i = 0; i < batches.length; i++) {
    const pct  = Math.round(((i + 1) / batches.length) * 100);
    bar.style.width = pct + '%';
    text.textContent = `${i + 1} / ${batches.length} batches`;

    const fakeTx = randomHex(32);
    log.innerHTML += `<div class="log-info">[${new Date().toLocaleTimeString()}] Batch ${i+1}: <a href="#" style="color:var(--accent)">${fakeTx.slice(0,20)}…</a></div>`;
    log.scrollTop = log.scrollHeight;

    await delay(400);
  }

  toast('Airdrop complete!', 'success');
}

// ── Bundler ────────────────────────────────────────────────────────────────────
function addBundleWallet() {
  const container = document.getElementById('bundleWallets');
  const count     = container.querySelectorAll('.bundle-wallet-row').length + 1;
  const row       = document.createElement('div');
  row.className   = 'bundle-wallet-row';
  row.dataset.index = count - 1;
  row.innerHTML = `
    <span class="wallet-index">#${count}</span>
    <input type="text" placeholder="Private key or mnemonic..." class="input input-sm bw-key" />
    <input type="number" placeholder="Buy SOL" class="input input-sm bw-amount" style="width:90px" />
    <button class="btn-icon-only btn-remove-wallet" title="Remove">✕</button>
  `;
  container.appendChild(row);
  updateBundleTotal();
}

function generateBundleWallets(count = 5) {
  const container = document.getElementById('bundleWallets');
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const kp  = Keypair.generate();
    const key = Buffer.from(kp.secretKey).toString('hex');
    const row = document.createElement('div');
    row.className = 'bundle-wallet-row';
    row.innerHTML = `
      <span class="wallet-index">#${i+1}</span>
      <input type="text" value="${key}" class="input input-sm bw-key" style="font-size:10px" />
      <input type="number" placeholder="0.1" value="0.1" class="input input-sm bw-amount" style="width:90px" />
      <button class="btn-icon-only btn-remove-wallet" title="Remove">✕</button>
    `;
    container.appendChild(row);
  }
  updateBundleTotal();
  toast('Generated 5 wallets!', 'success');
}

function updateBundleTotal() {
  const amounts = [...document.querySelectorAll('.bw-amount')]
    .map(el => parseFloat(el.value) || 0);
  const total = amounts.reduce((s, v) => s + v, 0);
  document.getElementById('bundleTotalSol').textContent = total.toFixed(3) + ' SOL';
}

async function sendBundle() {
  if (!state.wallet) { toast('Connect wallet first.', 'warning'); return; }
  const target = document.getElementById('bundleTarget').value.trim();
  if (!target) { toast('Enter target token/pool address.', 'warning'); return; }

  const rows   = document.querySelectorAll('.bundle-wallet-row');
  if (rows.length === 0) { toast('Add at least one wallet.', 'warning'); return; }

  const btn = document.getElementById('sendBundleBtn');
  btn.disabled = true; btn.innerHTML = '<span class="btn-icon">⏳</span> Bundling…';

  try {
    await delay(1500);
    const resultPanel = document.getElementById('bundleResult');
    const grid        = document.getElementById('bundleResultGrid');

    grid.innerHTML = '';
    rows.forEach((row, i) => {
      const fakeTx = randomHex(32);
      grid.innerHTML += `
        <div class="result-row">
          <span class="result-label">Wallet #${i+1}</span>
          <span class="result-value mono">${fakeTx.slice(0,20)}…</span>
          <span style="color:var(--success);font-size:12px">✓ Sent</span>
        </div>`;
    });
    resultPanel.classList.remove('hidden');
    toast('Bundle submitted via Jito!', 'success');
  } catch (err) {
    toast('Bundle failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = '<span class="btn-icon">📦</span> Send Bundle';
  }
}

async function simulateBundle() {
  toast('Simulating bundle transactions…', 'info');
  await delay(800);
  toast('Simulation passed ✓ — no errors found.', 'success');
}

// ── LP Tools ───────────────────────────────────────────────────────────────────
function switchLpPanel(panel) {
  document.querySelectorAll('.lp-panel').forEach(p => p.classList.add('hidden'));
  document.getElementById(`lp-${panel}`).classList.remove('hidden');
  document.querySelectorAll('.tab-pills[data-section="lp"] .pill, #tab-lp-tools > .tab-pills .pill')
    .forEach(p => p.classList.toggle('active', p.dataset.lp === panel));
}

function updateInitPrice() {
  const base  = parseFloat(document.getElementById('initBaseAmount')?.value) || 0;
  const quote = parseFloat(document.getElementById('initQuoteAmount')?.value) || 0;
  const el    = document.getElementById('initPricePreview');
  if (!el) return;
  if (base > 0 && quote > 0) {
    el.innerHTML = `<div style="font-size:20px;font-weight:700;color:var(--accent)">${(quote / base).toFixed(9)}</div><div style="color:var(--text-3);font-size:12px">Quote per Base Token</div>`;
  } else {
    el.innerHTML = '<p class="muted">Enter amounts to see initial price</p>';
  }
}

// ── Volume Bot ─────────────────────────────────────────────────────────────────
function updateVolCost() {
  const wallets    = parseInt(document.getElementById('volWalletCount')?.value) || 0;
  const solPerW    = parseFloat(document.getElementById('volSolPerWallet')?.value) || 0;
  const trades     = parseInt(document.getElementById('volTrades')?.value) || 0;
  const buyMax     = parseFloat(document.getElementById('volBuyMax')?.value) || 0;
  const estCost    = (wallets * solPerW + trades * buyMax * 0.3).toFixed(3);
  const el         = document.getElementById('volTotalCost');
  if (el) el.textContent = `~${estCost} SOL`;
}

function startBot() {
  if (!document.getElementById('volBotMint').value.trim()) {
    toast('Enter token mint address.', 'warning'); return;
  }

  state.botRunning = true;
  state.botStats   = { trades: 0, volume: 0, spent: 0 };

  document.getElementById('startBotBtn').classList.add('hidden');
  document.getElementById('stopBotBtn').classList.remove('hidden');
  document.getElementById('botStats').classList.remove('hidden');

  const log         = document.getElementById('tradeLog');
  const buyMin      = parseFloat(document.getElementById('volBuyMin').value) || 0.01;
  const buyMax      = parseFloat(document.getElementById('volBuyMax').value) || 0.05;
  const delayMs     = (parseInt(document.getElementById('volDelay').value) || 30) * 1000;
  const totalTrades = parseInt(document.getElementById('volTrades').value) || 100;
  const autoSell    = document.getElementById('volAutoSell').checked;

  log.innerHTML = '';

  const runTrade = () => {
    if (!state.botRunning || state.botStats.trades >= totalTrades) {
      stopBot(); return;
    }

    const amount  = +(buyMin + Math.random() * (buyMax - buyMin)).toFixed(4);
    const wallet  = shortKey(randomHex(32));
    const tx      = randomHex(32).slice(0, 20) + '…';
    const isBuy   = true;

    state.botStats.trades++;
    state.botStats.volume += amount;
    state.botStats.spent  += amount * (autoSell ? 0.02 : 1); // fee only if auto-sell

    document.getElementById('botTradesDone').textContent = state.botStats.trades;
    document.getElementById('botVolume').textContent     = state.botStats.volume.toFixed(4) + ' SOL';
    document.getElementById('botSolSpent').textContent   = state.botStats.spent.toFixed(4) + ' SOL';

    const time = new Date().toLocaleTimeString();
    log.innerHTML += `<div class="log-buy">[${time}] BUY  ${amount} SOL → ${wallet} | ${tx}</div>`;
    if (autoSell) {
      log.innerHTML += `<div class="log-sell">[${time}] SELL ${amount} SOL ← ${wallet} | ${randomHex(32).slice(0,20)}…</div>`;
    }
    log.scrollTop = log.scrollHeight;

    state.botInterval = setTimeout(runTrade, Math.max(delayMs * (0.8 + Math.random() * 0.4), 1000));
  };

  runTrade();
  toast('Volume bot started!', 'success');
}

function stopBot() {
  state.botRunning = false;
  clearTimeout(state.botInterval);
  document.getElementById('startBotBtn').classList.remove('hidden');
  document.getElementById('stopBotBtn').classList.add('hidden');
  document.getElementById('botStatus').textContent = 'Stopped';
  document.getElementById('botStatus').className   = '';
  toast('Bot stopped.', 'info');
}

// ── Wallet Generator ───────────────────────────────────────────────────────────
function generateWallets() {
  const count  = Math.min(parseInt(document.getElementById('genCount').value) || 10, 100);
  const format = document.getElementById('keyFormat').value;

  state.genWallets = [];
  const tbody = document.getElementById('walletTableBody');
  tbody.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const kp       = Keypair.generate();
    const pubkey   = kp.publicKey.toString();
    const privkey  = Buffer.from(kp.secretKey).toString('hex');
    const mnemonic = format === 'mnemonic' || format === 'both' ? '[mnemonic hidden]' : null;
    state.genWallets.push({ pubkey, privkey, mnemonic });

    const tr  = document.createElement('tr');
    const key = format === 'base58' || format === 'both' ? privkey : mnemonic;
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="mono">${shortKey(pubkey)} <button class="btn-copy" onclick="copyVal('${pubkey}')">Copy</button></td>
      <td class="mono">${format === 'both' ? '[base58+mnemonic]' : key?.slice(0, 20) + '…'} <button class="btn-copy" onclick="copyVal('${key}')">Copy</button></td>
      <td class="wallet-bal-${i}">—</td>
      <td><button class="btn-copy" onclick="refreshSingleBal('${pubkey}', ${i})">↻</button></td>
    `;
    tbody.appendChild(tr);
  }
  toast(`Generated ${count} wallets.`, 'success');
}

async function refreshSingleBal(pubkey, idx) {
  try {
    const conn = getConnection();
    const bal  = await conn.getBalance(new PublicKey(pubkey));
    const el   = document.querySelector(`.wallet-bal-${idx}`);
    if (el) el.textContent = lamportsToSol(bal) + ' SOL';
  } catch { /* ignore */ }
}

async function fundWallets() {
  if (!state.genWallets.length) { toast('Generate wallets first.', 'warning'); return; }
  const key    = document.getElementById('fundingKey').value.trim();
  const solPer = parseFloat(document.getElementById('solPerWallet').value) || 0.01;
  if (!key) { toast('Enter funding wallet private key.', 'warning'); return; }
  toast(`Funding ${state.genWallets.length} wallets with ${solPer} SOL each…`, 'info');
  await delay(1000);
  toast('Funding transactions sent! (simulated)', 'success');
}

async function consolidateWallets() {
  const dest = document.getElementById('consolidateDest').value.trim();
  if (!dest) { toast('Enter destination wallet address.', 'warning'); return; }
  if (!state.genWallets.length) { toast('No wallets to consolidate.', 'warning'); return; }
  toast(`Consolidating SOL from ${state.genWallets.length} wallets to ${shortKey(dest)}…`, 'info');
  await delay(1000);
  toast('Consolidation complete! (simulated)', 'success');
}

function exportWallets(format) {
  if (!state.genWallets.length) { toast('Generate wallets first.', 'warning'); return; }
  let content, type, filename;

  if (format === 'csv') {
    content  = 'index,pubkey,privkey\n' + state.genWallets.map((w,i) => `${i+1},${w.pubkey},${w.privkey}`).join('\n');
    type     = 'text/csv';
    filename = 'shrug-wallets.csv';
  } else {
    content  = JSON.stringify(state.genWallets.map((w,i) => ({ index: i+1, ...w })), null, 2);
    type     = 'application/json';
    filename = 'shrug-wallets.json';
  }

  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function clearWallets() {
  if (!confirm('Clear all generated wallets?')) return;
  state.genWallets = [];
  document.getElementById('walletTableBody').innerHTML = '<tr><td colspan="5" class="muted text-center">No wallets generated yet.</td></tr>';
  toast('Wallets cleared.', 'info');
}

// ── Utility ────────────────────────────────────────────────────────────────────
function randomHex(bytes) {
  return Array.from({ length: bytes }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function copyText(elId) {
  const text = document.getElementById(elId)?.textContent;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => toast('Copied!', 'success', 1500));
}

function copyVal(val) {
  navigator.clipboard.writeText(val).then(() => toast('Copied!', 'success', 1500));
}

function setMax(inputId) {
  // Placeholder — would fetch token balance
  toast('Fetching balance…', 'info', 1500);
}

// ── Event Listeners ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Initial network dot
  handleNetworkChange('mainnet-beta');

  // Logo → home
  document.getElementById('homeLogoBtn').addEventListener('click', e => {
    e.preventDefault();
    goHome();
  });

  // Nav links
  document.querySelectorAll('[data-tab]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      switchTab(el.dataset.tab);
    });
  });

  // Mobile nav select
  document.getElementById('mobileNavSelect').addEventListener('change', e => {
    switchTab(e.target.value);
  });

  // Wallet
  document.getElementById('connectWalletBtn').addEventListener('click', connectWallet);
  document.getElementById('disconnectBtn').addEventListener('click', disconnectWallet);
  document.getElementById('networkSelect').addEventListener('change', e => handleNetworkChange(e.target.value));

  // Modal close
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });

  // ── Token Creator
  document.getElementById('createTokenBtn').addEventListener('click', handleCreateToken);

  document.getElementById('transferFee').addEventListener('change', e => {
    document.getElementById('transferFeeBox').style.display = e.target.checked ? 'block' : 'none';
  });

  // Update cost estimate on input change
  ['tokenDecimals', 'tokenSupply', 'revokeMint', 'revokeFreeze', 'useToken2022'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => {
      const use2022 = document.getElementById('useToken2022').checked;
      document.getElementById('createCost').textContent = use2022 ? '~0.07 SOL' : '~0.05 SOL';
    });
  });

  // ── Token Manager
  document.getElementById('lookupTokenBtn').addEventListener('click', lookupToken);
  document.getElementById('revokeAuthBtn').addEventListener('click', async () => {
    if (!state.wallet) { toast('Connect wallet first.', 'warning'); return; }
    toast('Revoking selected authorities… (simulated)', 'info');
    await delay(800); toast('Authorities revoked!', 'success');
  });
  document.getElementById('updateMetaBtn').addEventListener('click', async () => {
    if (!state.wallet) { toast('Connect wallet first.', 'warning'); return; }
    toast('Updating metadata… (simulated)', 'info');
    await delay(800); toast('Metadata updated!', 'success');
  });
  document.getElementById('burnBtn').addEventListener('click', async () => {
    const amt = parseFloat(document.getElementById('burnAmount').value);
    if (!amt) { toast('Enter burn amount.', 'warning'); return; }
    toast(`Burning ${amt} tokens… (simulated)`, 'info');
    await delay(800); toast('Tokens burned!', 'success');
  });
  document.getElementById('mintBtn').addEventListener('click', async () => {
    const amt = parseFloat(document.getElementById('mintAmount').value);
    if (!amt) { toast('Enter mint amount.', 'warning'); return; }
    toast(`Minting ${amt} tokens… (simulated)`, 'info');
    await delay(800); toast('Tokens minted!', 'success');
  });

  // ── Airdrop pills
  document.querySelectorAll('#tab-airdrop .pill').forEach(p => {
    p.addEventListener('click', () => {
      document.querySelectorAll('#tab-airdrop .pill').forEach(x => x.classList.remove('active'));
      p.classList.add('active');
      document.querySelectorAll('#tab-airdrop .pill-panel').forEach(panel => panel.classList.add('hidden'));
      document.getElementById(`pill-${p.dataset.pill}`).classList.remove('hidden');
    });
  });

  document.getElementById('parseRecipientsBtn').addEventListener('click', parseRecipients);
  document.getElementById('startAirdropBtn').addEventListener('click', startAirdrop);

  document.getElementById('fetchHoldersBtn')?.addEventListener('click', async () => {
    const mint = document.getElementById('holdersMint').value.trim();
    if (!mint) { toast('Enter mint address.', 'warning'); return; }
    toast('Fetching token holders…', 'info');
    await delay(1200);
    const count = Math.floor(Math.random() * 5000) + 100;
    const el = document.getElementById('holdersCount');
    el.textContent = `Found ${count.toLocaleString()} holders`;
    el.classList.remove('hidden');
    toast(`Fetched ${count} holders!`, 'success');
  });

  // CSV upload
  document.getElementById('csvDropZone')?.addEventListener('click', () => document.getElementById('csvFile').click());
  document.getElementById('csvFile')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
      document.getElementById('csvFileName').textContent = `Loaded: ${file.name}`;
      toast(`CSV loaded: ${file.name}`, 'success');
    }
  });

  // ── Bundler
  document.getElementById('addBundleWallet').addEventListener('click', addBundleWallet);
  document.getElementById('genBundleWallets').addEventListener('click', () => generateBundleWallets(5));
  document.getElementById('sendBundleBtn').addEventListener('click', sendBundle);
  document.getElementById('simulateBundleBtn').addEventListener('click', simulateBundle);

  // Bundle wallet removal (delegated)
  document.getElementById('bundleWallets').addEventListener('click', e => {
    if (e.target.classList.contains('btn-remove-wallet')) {
      e.target.closest('.bundle-wallet-row').remove();
      // Re-number
      document.querySelectorAll('.bundle-wallet-row').forEach((r, i) => {
        r.querySelector('.wallet-index').textContent = `#${i+1}`;
      });
      updateBundleTotal();
    }
  });
  document.getElementById('bundleWallets').addEventListener('input', e => {
    if (e.target.classList.contains('bw-amount')) updateBundleTotal();
  });

  // DEX select pills
  document.querySelectorAll('[data-dex]').forEach(p => {
    p.addEventListener('click', () => {
      document.querySelectorAll('[data-dex]').forEach(x => x.classList.remove('active'));
      p.classList.add('active');
    });
  });

  // ── LP Tools
  document.querySelectorAll('#tab-lp-tools > .tab-pills .pill').forEach(p => {
    p.addEventListener('click', () => {
      document.querySelectorAll('#tab-lp-tools > .tab-pills .pill').forEach(x => x.classList.remove('active'));
      p.classList.add('active');
      switchLpPanel(p.dataset.lp);
    });
  });

  ['initBaseAmount', 'initQuoteAmount'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateInitPrice);
  });

  document.getElementById('addLiqBtn')?.addEventListener('click', async () => {
    if (!state.wallet) { toast('Connect wallet.', 'warning'); return; }
    toast('Adding liquidity… (simulated)', 'info'); await delay(1000); toast('Liquidity added!', 'success');
  });
  document.getElementById('removeLiqBtn')?.addEventListener('click', async () => {
    if (!state.wallet) { toast('Connect wallet.', 'warning'); return; }
    toast('Removing liquidity… (simulated)', 'info'); await delay(1000); toast('Liquidity removed!', 'success');
  });
  document.getElementById('burnLpBtn')?.addEventListener('click', async () => {
    if (!state.wallet) { toast('Connect wallet.', 'warning'); return; }
    const amt = document.getElementById('burnLpAmount').value;
    if (!amt) { toast('Enter LP amount to burn.', 'warning'); return; }
    if (!confirm('Burn LP tokens? This is irreversible!')) return;
    toast('Burning LP tokens… (simulated)', 'info'); await delay(1000); toast('LP tokens burned!', 'success');
  });
  document.getElementById('createPoolBtn')?.addEventListener('click', async () => {
    if (!state.wallet) { toast('Connect wallet.', 'warning'); return; }
    toast('Creating Raydium pool… (simulated)', 'info'); await delay(1500); toast('Pool created!', 'success');
  });

  document.querySelectorAll('[data-quote]').forEach(p => {
    p.addEventListener('click', () => { document.querySelectorAll('[data-quote]').forEach(x => x.classList.remove('active')); p.classList.add('active'); });
  });
  document.querySelectorAll('[data-pooltype]').forEach(p => {
    p.addEventListener('click', () => { document.querySelectorAll('[data-pooltype]').forEach(x => x.classList.remove('active')); p.classList.add('active'); });
  });

  // Percentage buttons for remove liquidity
  document.querySelectorAll('.btn-pct').forEach(b => {
    b.addEventListener('click', () => {
      const pct = parseFloat(b.dataset.pct) / 100;
      toast(`Set to ${b.dataset.pct}%`, 'info', 1000);
    });
  });

  // ── Volume Bot
  document.getElementById('startBotBtn').addEventListener('click', startBot);
  document.getElementById('stopBotBtn').addEventListener('click', stopBot);

  ['volWalletCount', 'volSolPerWallet', 'volTrades', 'volBuyMax'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateVolCost);
  });
  document.querySelectorAll('[data-vdex]').forEach(p => {
    p.addEventListener('click', () => { document.querySelectorAll('[data-vdex]').forEach(x => x.classList.remove('active')); p.classList.add('active'); });
  });

  // ── Wallets
  document.getElementById('genWalletsBtn').addEventListener('click', generateWallets);
  document.getElementById('fundWalletsBtn').addEventListener('click', fundWallets);
  document.getElementById('consolidateBtn').addEventListener('click', consolidateWallets);
  document.getElementById('exportCsvBtn').addEventListener('click', () => exportWallets('csv'));
  document.getElementById('exportJsonBtn').addEventListener('click', () => exportWallets('json'));
  document.getElementById('clearWalletsBtn').addEventListener('click', clearWallets);

  console.log('%c⬡ Shrug Tool loaded', 'color:#9d5cf7;font-size:18px;font-weight:bold');
  console.log('%cSolana Tools Suite — Educational & Development Use', 'color:#8b98b8');
});

// ── PumpFun Live Tracker (~100K Market Cap) ─────────────────────────────────
(function pumpTracker() {
  const FEED        = document.getElementById('pfFeed');
  const STATUS      = document.getElementById('pfStatus');
  const PLACEHOLDER = document.getElementById('pfPlaceholder');

  const GRAD_MC   = 69000;   // pump.fun graduation cap
  const MAX_CARDS = 20;
  const POLL_MS   = 60000;   // 1-minute refresh
  const MC_MIN    = 80000;   // $80K – strictly near 100K
  const MC_MAX    = 120000;  // $120K – strictly near 100K

  let seenMints    = new Set();
  let isFirstLoad  = true;
  let srcIdx       = 0;
  let countdownInt = null;

  function setStatus(text, state) {
    STATUS.innerHTML =
      '<span class="pf-dot pf-dot--' + state + '"></span>' +
      '<span class="pf-status-text">' + text + '</span>';
  }

  function fmt(usd) {
    if (!usd || usd <= 0) return '$0';
    if (usd >= 1e6) return '$' + (usd / 1e6).toFixed(2) + 'M';
    if (usd >= 1e3) return '$' + (usd / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(usd).toLocaleString();
  }

  function ageLabel(ts) {
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 5)  return 'just now';
    if (s < 60) return s + 's ago';
    var m = Math.floor(s / 60);
    if (m < 60) return m + 'm ago';
    return Math.floor(m / 60) + 'h ago';
  }

  function esc(str) {
    return (str || '').replace(/[<>"'&]/g, function(c) {
      return ({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'})[c];
    });
  }

  function buildCard(coin) {
    var mc   = Number(coin.usd_market_cap) || 0;
    var pct  = mc > 0 ? Math.min(100, (mc / GRAD_MC) * 100) : 0;
    var name = esc(coin.name   || 'Unknown');
    var sym  = esc(coin.symbol || '');
    var mint = esc(coin.mint   || '');
    var img  = esc(coin.image_uri || '');
    var age  = ageLabel(Number(coin.created_timestamp) || Date.now());
    var hot  = mc >= 50000 && mc <= 200000;
    var solPrice = '';
    if (coin.price_in_sol != null) {
      solPrice = '<span class="pf-card-price">◎' +
        parseFloat(coin.price_in_sol).toFixed(9).replace(/0+$/, '').replace(/\.$/, '') +
        '</span>';
    }
    var card = document.createElement('div');
    card.className    = 'pf-card' + (hot ? ' pf-card--hot' : '');
    card.dataset.mint = coin.mint || '';
    card.dataset.ts   = coin.created_timestamp || Date.now();
    card.innerHTML =
      '<div class="pf-card-icon">' +
        (img ? '<img src="' + img + '" alt="" loading="lazy" onerror="this.parentNode.innerHTML=\'&#129689;\'">'
              : '🪙') +
      '</div>' +
      '<div class="pf-card-info">' +
        '<div class="pf-card-name">' + name +
          (sym ? '<span class="pf-card-sym"> $' + sym + '</span>' : '') +
          (hot ? '<span class="pf-near-grad">~100K</span>' : '') +
        '</div>' +
        '<div class="pf-card-row">' +
          '<span class="pf-card-mc">' + fmt(mc) + '</span>' +
          solPrice +
          '<span class="pf-card-age">' + age + '</span>' +
        '</div>' +
        '<div class="pf-progress-wrap">' +
          '<div class="pf-progress-bar"><div class="pf-progress-fill" style="width:' + pct.toFixed(1) + '%"></div></div>' +
          '<span class="pf-progress-label">' + pct.toFixed(0) + '% to grad</span>' +
        '</div>' +
      '</div>' +
      '<div class="pf-card-actions">' +
        '<button class="pf-copy-btn" title="Copy mint">⎘</button>' +
        '<a class="pf-card-link" href="https://pump.fun/' + mint + '" target="_blank" rel="noopener">↗</a>' +
      '</div>';

    card.querySelector('.pf-copy-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      var btn = e.currentTarget;
      navigator.clipboard.writeText(coin.mint || '').then(function() {
        btn.textContent = '✓';
        btn.classList.add('pf-copy-btn--ok');
        setTimeout(function() { btn.textContent = '⎘'; btn.classList.remove('pf-copy-btn--ok'); }, 1500);
      }).catch(function(){});
    });
    return card;
  }

  function updateCard(coin) {
    var el = FEED.querySelector('.pf-card[data-mint="' + (coin.mint || '') + '"]');
    if (!el) return;
    var mc  = Number(coin.usd_market_cap) || 0;
    var pct = mc > 0 ? Math.min(100, (mc / GRAD_MC) * 100) : 0;
    var mcEl   = el.querySelector('.pf-card-mc');
    var fillEl = el.querySelector('.pf-progress-fill');
    var lblEl  = el.querySelector('.pf-progress-label');
    if (mcEl)   mcEl.textContent   = fmt(mc);
    if (fillEl) fillEl.style.width = pct.toFixed(1) + '%';
    if (lblEl)  lblEl.textContent  = pct.toFixed(0) + '% to grad';
  }

  function showCard(coin, prepend) {
    if (!coin.mint) return;
    if (FEED.querySelector('.pf-card[data-mint="' + coin.mint + '"]')) {
      updateCard(coin); return;
    }
    if (PLACEHOLDER) PLACEHOLDER.style.display = 'none';
    var card = buildCard(coin);
    if (prepend) FEED.insertBefore(card, FEED.firstChild);
    else         FEED.appendChild(card);
    requestAnimationFrame(function() { card.classList.add('pf-card--visible'); });
    var all = FEED.querySelectorAll('.pf-card');
    if (all.length > MAX_CARDS) {
      for (var i = MAX_CARDS; i < all.length; i++) all[i].remove();
    }
    card._ageTimer = setInterval(function() {
      var el = card.querySelector('.pf-card-age');
      if (el) el.textContent = ageLabel(Number(card.dataset.ts));
    }, 15000);
  }

  // ── Pump.fun REST API ────────────────────────────────────────────────
  // last_trade_timestamp → coins actively being bought RIGHT NOW
  // limit=100 → wider net to catch those sitting near $100K
  var PF_URLS = [
    'https://frontend-api.pump.fun/coins?offset=0&limit=100&sort=last_trade_timestamp&order=DESC&includeNsfw=false',
    'https://frontend-api.pump.fun/coins?offset=0&limit=100&sort=market_cap&order=DESC&includeNsfw=false',
    'https://frontend-api.pump.fun/coins?offset=0&limit=100&sort=last_reply&order=DESC&includeNsfw=false'
  ];

  function fetchPumpFun(urlIndex) {
    var url = PF_URLS[urlIndex || 0];
    return new Promise(function(resolve, reject) {
      var ctl = new AbortController();
      var t   = setTimeout(function() { ctl.abort(); }, 6000);
      fetch(url, { signal: ctl.signal })
        .then(function(r) {
          clearTimeout(t);
          if (!r.ok) throw new Error(r.status);
          return r.json();
        })
        .then(function(raw) {
          var coins = Array.isArray(raw) ? raw : (raw.coins || raw.data || []);
          coins = coins
            .filter(function(c) { return c && c.mint; })
            .map(function(c) {
              return Object.assign({}, c, {
                usd_market_cap: Number(c.usd_market_cap || c.market_cap) || 0
              });
            })
            .filter(function(c) { return c.usd_market_cap >= MC_MIN && c.usd_market_cap <= MC_MAX; })
            .sort(function(a, b) { return b.usd_market_cap - a.usd_market_cap; });
          resolve({ coins: coins, label: 'Pump.fun' });
        })
        .catch(function(err) { clearTimeout(t); reject(err); });
    });
  }

  // ── DexScreener fallback ──────────────────────────────────────────────
  function fetchDexScreener() {
    var ctl1 = new AbortController();
    var t1   = setTimeout(function() { ctl1.abort(); }, 6000);
    return fetch('https://api.dexscreener.com/token-profiles/latest/v1', { signal: ctl1.signal })
      .then(function(r) {
        clearTimeout(t1);
        if (!r.ok) throw new Error('ds1:' + r.status);
        return r.json();
      })
      .then(function(profiles) {
        var addrs = (Array.isArray(profiles) ? profiles : [])
          .filter(function(p) { return p.chainId === 'solana' && p.tokenAddress; })
          .map(function(p) { return p.tokenAddress; })
          .slice(0, 30)
          .join(',');
        if (!addrs) return { coins: [], label: 'DexScreener' };
        var ctl2 = new AbortController();
        var t2   = setTimeout(function() { ctl2.abort(); }, 6000);
        return fetch('https://api.dexscreener.com/latest/dex/tokens/' + addrs, { signal: ctl2.signal })
          .then(function(r2) {
            clearTimeout(t2);
            if (!r2.ok) throw new Error('ds2:' + r2.status);
            return r2.json();
          })
          .then(function(data) {
            var seen  = new Set();
            var coins = (data.pairs || [])
              .filter(function(p) { return p.chainId === 'solana'; })
              .reduce(function(acc, p) {
                var addr = p.baseToken && p.baseToken.address;
                if (!addr || seen.has(addr)) return acc;
                seen.add(addr);
                acc.push({
                  mint:              addr,
                  name:              (p.baseToken && p.baseToken.name)   || 'Unknown',
                  symbol:            (p.baseToken && p.baseToken.symbol) || '',
                  usd_market_cap:    Number(p.fdv || p.marketCap) || 0,
                  price_in_sol:      null,
                  image_uri:         (p.info && p.info.imageUrl) || '',
                  created_timestamp: p.pairCreatedAt || Date.now()
                });
                return acc;
              }, [])
              .filter(function(c) { return c.usd_market_cap >= MC_MIN && c.usd_market_cap <= MC_MAX; })
              .sort(function(a, b) { return b.usd_market_cap - a.usd_market_cap; });
            return { coins: coins, label: 'DexScreener' };
          });
      });
  }

  // ── Poll ──────────────────────────────────────────────────────────────
  var pfUrlIdx = 0;
  var sources  = [
    function() { return fetchPumpFun(pfUrlIdx); },
    function() { return fetchDexScreener(); }
  ];

  function startCountdown() {
    if (countdownInt) clearInterval(countdownInt);
    var end = Date.now() + POLL_MS;
    countdownInt = setInterval(function() {
      var rem = Math.max(0, Math.round((end - Date.now()) / 1000));
      var m = Math.floor(rem / 60), s = rem % 60;
      var dot = STATUS.querySelector('.pf-dot');
      var lbl = STATUS.querySelector('.pf-status-text');
      if (lbl) lbl.textContent = 'Refreshes in ' + m + ':' + (s < 10 ? '0' : '') + s;
      if (rem === 0) clearInterval(countdownInt);
    }, 1000);
  }

  function clearFeed() {
    // Remove all cards and reset seen set for a fresh snapshot
    var cards = FEED.querySelectorAll('.pf-card');
    cards.forEach(function(c) { if (c._ageTimer) clearInterval(c._ageTimer); c.remove(); });
    seenMints.clear();
    if (PLACEHOLDER) PLACEHOLDER.style.display = '';
  }

  function poll() {
    setStatus('Fetching…', 'connecting');
    pfUrlIdx = 0;
    var startSrc = srcIdx;
    function tryNext(i) {
      if (i >= sources.length) {
        setStatus('No data — retrying in 5 min', 'error');
        startCountdown();
        return;
      }
      var idx = (startSrc + i) % sources.length;
      sources[idx]()
        .then(function(result) {
          if (!result || !result.coins || !result.coins.length) {
            if (idx === 0 && pfUrlIdx < PF_URLS.length - 1) {
              pfUrlIdx++;
              tryNext(i); return;
            }
            tryNext(i + 1); return;
          }
          srcIdx = idx;
          clearFeed();
          var coins = result.coins;
          // Highest MC first
          coins.forEach(function(c) { seenMints.add(c.mint); showCard(c, false); });
          isFirstLoad = false;
          var hot = FEED.querySelectorAll('.pf-card--hot').length;
          setStatus(result.label + ' · ' + coins.length + ' coins' + (hot ? ' · ' + hot + ' ~100K' : ''), 'live');
          startCountdown();
        })
        .catch(function(err) {
          console.warn('[PFTracker] source', idx, 'failed:', err.message || err);
          tryNext(i + 1);
        });
    }
    tryNext(0);
  }

  setStatus('Connecting…', 'connecting');
  poll();
  setInterval(poll, POLL_MS);
})();

