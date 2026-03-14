'use strict';

// ── Constants ──────────────────────────────────────────────────────────────────
const HELIUS_API_KEY    = '7f2e566e-0976-4e44-8a73-918f69f6690a';
const MAINNET_RPC       = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const DEVNET_RPC        = `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const PLATFORM_WALLET   = '21r2FRqdnjDM6NwmXN4MBynRaY4ygSUNigVFS3ny347G';
const PLATFORM_FEE_SOL  = 0.05;
const PLATFORM_FEE_SM   = 0.01; // small fee for manager actions

const TOKEN_PROGRAM_ID         = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const ASSOCIATED_TOKEN_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bS7';
const METADATA_PROGRAM_ID      = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
const SYSTEM_PROGRAM_ID        = '11111111111111111111111111111111';
const RENT_SYSVAR              = 'SysvarRent111111111111111111111111111111111';

// ── Solana web3 ────────────────────────────────────────────────────────────────
const {
  Connection, PublicKey, Transaction, SystemProgram,
  LAMPORTS_PER_SOL, Keypair, TransactionInstruction,
} = solanaWeb3;

// ── State ──────────────────────────────────────────────────────────────────────
const state = {
  wallet: null,       // PublicKey
  provider: null,
  connection: null,
  tokenInfo: null,    // loaded token info for manager
  genWallets: [],
};

function getConn() {
  if (!state.connection) state.connection = new Connection(MAINNET_RPC, 'confirmed');
  return state.connection;
}

// ── Encoding helpers ───────────────────────────────────────────────────────────
const u8    = v => new Uint8Array([v & 0xff]);
const u16LE = v => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, true); return b; };
const u64LE = v => {
  const b = new Uint8Array(8);
  let n = BigInt(v);
  for (let i = 0; i < 8; i++) { b[i] = Number(n & 0xffn); n >>= 8n; }
  return b;
};
const concat = (...as) => {
  const t = as.reduce((s, a) => s + a.length, 0);
  const o = new Uint8Array(t); let f = 0;
  for (const a of as) { o.set(a, f); f += a.length; }
  return o;
};
const borshStr = s => {
  const e = new TextEncoder().encode(s);
  const b = new Uint8Array(4 + e.length);
  new DataView(b.buffer).setUint32(0, e.length, true);
  b.set(e, 4); return b;
};
const pk = addr => new PublicKey(addr);
const pkb = pubkey => new Uint8Array(pubkey.toBuffer());

// Convert human amount + decimals to raw BigInt
function toRaw(amount, decimals) {
  const s = amount.toString().trim();
  const [int, frac = ''] = s.split('.');
  const fracPadded = frac.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(int + fracPadded);
}

// ── PDA helpers ────────────────────────────────────────────────────────────────
async function findATA(owner, mint, tokenProgramId = TOKEN_PROGRAM_ID) {
  const [ata] = await PublicKey.findProgramAddress(
    [owner.toBuffer(), pk(tokenProgramId).toBuffer(), mint.toBuffer()],
    pk(ASSOCIATED_TOKEN_PROGRAM)
  );
  return ata;
}

async function findMetadataPDA(mint) {
  const [pda] = await PublicKey.findProgramAddress(
    [new TextEncoder().encode('metadata'), pk(METADATA_PROGRAM_ID).toBuffer(), mint.toBuffer()],
    pk(METADATA_PROGRAM_ID)
  );
  return pda;
}

// ── Instruction builders ───────────────────────────────────────────────────────
function ixCreateAccount(payer, newAccount, space, lamports, programId) {
  return SystemProgram.createAccount({ fromPubkey: payer, newAccountPubkey: newAccount, space, lamports, programId });
}

function ixInitMint(mint, authority, decimals) {
  return new TransactionInstruction({
    keys: [
      { pubkey: mint,         isSigner: false, isWritable: true },
      { pubkey: pk(RENT_SYSVAR), isSigner: false, isWritable: false },
    ],
    programId: pk(TOKEN_PROGRAM_ID),
    // InitializeMint: [0, decimals, mintAuth(32), 1(Some), freezeAuth(32)]
    data: concat(u8(0), u8(decimals), pkb(authority), u8(1), pkb(authority)),
  });
}

function ixCreateATA(payer, ata, owner, mint) {
  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true,  isWritable: true  },
      { pubkey: ata,   isSigner: false, isWritable: true  },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint,  isSigner: false, isWritable: false },
      { pubkey: pk(SYSTEM_PROGRAM_ID), isSigner: false, isWritable: false },
      { pubkey: pk(TOKEN_PROGRAM_ID),  isSigner: false, isWritable: false },
    ],
    programId: pk(ASSOCIATED_TOKEN_PROGRAM),
    data: new Uint8Array([1]), // idempotent — won't fail if already exists
  });
}

function ixMintTo(mint, dest, authority, rawAmount) {
  return new TransactionInstruction({
    keys: [
      { pubkey: mint,      isSigner: false, isWritable: true  },
      { pubkey: dest,      isSigner: false, isWritable: true  },
      { pubkey: authority, isSigner: true,  isWritable: false },
    ],
    programId: pk(TOKEN_PROGRAM_ID),
    data: concat(u8(7), u64LE(rawAmount)), // MintTo
  });
}

function ixTransfer(src, dst, owner, rawAmount) {
  return new TransactionInstruction({
    keys: [
      { pubkey: src,   isSigner: false, isWritable: true  },
      { pubkey: dst,   isSigner: false, isWritable: true  },
      { pubkey: owner, isSigner: true,  isWritable: false },
    ],
    programId: pk(TOKEN_PROGRAM_ID),
    data: concat(u8(3), u64LE(rawAmount)), // Transfer
  });
}

function ixBurn(account, mint, owner, rawAmount) {
  return new TransactionInstruction({
    keys: [
      { pubkey: account, isSigner: false, isWritable: true  },
      { pubkey: mint,    isSigner: false, isWritable: true  },
      { pubkey: owner,   isSigner: true,  isWritable: false },
    ],
    programId: pk(TOKEN_PROGRAM_ID),
    data: concat(u8(8), u64LE(rawAmount)), // Burn
  });
}

// authorityType: 0=MintTokens, 1=FreezeAccount   newAuthority: null to revoke
function ixSetAuthority(account, currentAuth, authorityType, newAuthority) {
  const data = newAuthority
    ? concat(u8(6), u8(authorityType), u8(1), pkb(newAuthority))
    : concat(u8(6), u8(authorityType), u8(0));
  return new TransactionInstruction({
    keys: [
      { pubkey: account,     isSigner: false, isWritable: true  },
      { pubkey: currentAuth, isSigner: true,  isWritable: false },
    ],
    programId: pk(TOKEN_PROGRAM_ID),
    data,
  });
}

async function ixCreateMetadata(mint, mintAuthority, payer, name, symbol, uri) {
  const metadataPDA = await findMetadataPDA(mint);
  // CreateMetadataAccountV3 (instruction 33) — Borsh encoded
  const data = concat(
    u8(33),
    borshStr(name), borshStr(symbol), borshStr(uri),
    u16LE(0), // seller_fee_basis_points
    u8(0),    // creators: None
    u8(0),    // collection: None
    u8(0),    // uses: None
    u8(1),    // is_mutable
    u8(0),    // collection_details: None
  );
  return new TransactionInstruction({
    keys: [
      { pubkey: metadataPDA,           isSigner: false, isWritable: true  },
      { pubkey: mint,                  isSigner: false, isWritable: false },
      { pubkey: mintAuthority,         isSigner: true,  isWritable: false },
      { pubkey: payer,                 isSigner: true,  isWritable: true  },
      { pubkey: mintAuthority,         isSigner: false, isWritable: false }, // update authority
      { pubkey: pk(SYSTEM_PROGRAM_ID), isSigner: false, isWritable: false },
    ],
    programId: pk(METADATA_PROGRAM_ID),
    data,
  });
}

async function ixUpdateMetadata(mint, updateAuthority, name, symbol, uri) {
  const metadataPDA = await findMetadataPDA(mint);
  // UpdateMetadataAccountV2 (instruction 15)
  const data = concat(
    u8(15),
    u8(1),              // data: Some
    borshStr(name), borshStr(symbol), borshStr(uri),
    u16LE(0), u8(0), u8(0), u8(0), // fees, creators, collection, uses: None
    u8(0),              // update_authority: None
    u8(0),              // primary_sale_happened: None
    u8(0),              // is_mutable: None
  );
  return new TransactionInstruction({
    keys: [
      { pubkey: metadataPDA,    isSigner: false, isWritable: true  },
      { pubkey: updateAuthority, isSigner: true, isWritable: false },
    ],
    programId: pk(METADATA_PROGRAM_ID),
    data,
  });
}

function ixPlatformFee(payer, lamports) {
  return SystemProgram.transfer({ fromPubkey: payer, toPubkey: pk(PLATFORM_WALLET), lamports });
}

// ── Transaction helpers ────────────────────────────────────────────────────────
async function buildTx(instructions) {
  const conn = getConn();
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
  const tx = new Transaction({ recentBlockhash: blockhash, feePayer: state.wallet });
  instructions.forEach(ix => tx.add(ix));
  return { tx, blockhash, lastValidBlockHeight };
}

async function signAndSend(tx, extraSigners = []) {
  const conn = getConn();
  if (extraSigners.length) tx.partialSign(...extraSigners);
  const signed = await state.provider.signTransaction(tx);
  const raw = signed.serialize();
  const txId = await conn.sendRawTransaction(raw, { skipPreflight: false });
  return txId;
}

async function confirmTx(txId, blockhash, lastValidBlockHeight) {
  const conn = getConn();
  const result = await conn.confirmTransaction({ signature: txId, blockhash, lastValidBlockHeight });
  if (result.value.err) throw new Error('Transaction failed: ' + JSON.stringify(result.value.err));
  return txId;
}

// ── Wallet connection ──────────────────────────────────────────────────────────
async function connectWallet() {
  try {
    if (!window.solana?.isPhantom && !window.solana) {
      showToast('Phantom wallet not found. Please install it.', 'error'); return;
    }
    const resp = await window.solana.connect();
    state.wallet   = resp.publicKey;
    state.provider = window.solana;
    updateWalletUI();
    showToast('Wallet connected!', 'success');
  } catch (e) {
    showToast('Connection cancelled.', 'info');
  }
}

function disconnectWallet() {
  state.wallet = null; state.provider = null;
  document.getElementById('connectBtn').classList.remove('hidden');
  document.getElementById('walletInfo').classList.add('hidden');
}

async function updateWalletUI() {
  const addr = state.wallet.toString();
  document.getElementById('connectBtn').classList.add('hidden');
  document.getElementById('walletInfo').classList.remove('hidden');
  document.getElementById('walletAddr').textContent = addr.slice(0,4) + '…' + addr.slice(-4);
  try {
    const bal = await getConn().getBalance(state.wallet);
    document.getElementById('walletBal').textContent = (bal / LAMPORTS_PER_SOL).toFixed(3) + ' SOL';
  } catch (_) {}
}

// ── Token Creator ──────────────────────────────────────────────────────────────
async function handleCreateToken() {
  if (!state.wallet) { showToast('Connect wallet first.', 'error'); return; }

  const name        = document.getElementById('tokName').value.trim();
  const symbol      = document.getElementById('tokSymbol').value.trim();
  const decimals    = parseInt(document.getElementById('tokDecimals').value);
  const supplyRaw   = document.getElementById('tokSupply').value.trim();
  const uri         = document.getElementById('tokUri').value.trim();
  const revokeMint  = document.getElementById('tokRevokeMint').checked;
  const revFreeze   = document.getElementById('tokRevokeFreeze').checked;

  if (!name || !symbol || !supplyRaw) { showToast('Name, symbol and supply are required.', 'error'); return; }

  const btn = document.getElementById('createTokenBtn');
  btn.disabled = true; btn.textContent = 'Creating…';
  setResult('createResult', '', '');

  try {
    const conn      = getConn();
    const payer     = state.wallet;
    const mintKp    = Keypair.generate();
    const mintPk    = mintKp.publicKey;
    const supply    = toRaw(supplyRaw, decimals);
    const mintRent  = await conn.getMinimumBalanceForRentExemption(82);
    const userATA   = await findATA(payer, mintPk);

    const instructions = [];

    // 1. Create + init mint account
    instructions.push(ixCreateAccount(payer, mintPk, 82, mintRent, pk(TOKEN_PROGRAM_ID)));
    instructions.push(ixInitMint(mintPk, payer, decimals));

    // 2. Create user ATA (idempotent)
    instructions.push(ixCreateATA(payer, userATA, payer, mintPk));

    // 3. Mint supply to user's wallet
    instructions.push(ixMintTo(mintPk, userATA, payer, supply));

    // 4. On-chain metadata (if name provided)
    if (name) {
      instructions.push(await ixCreateMetadata(mintPk, payer, payer, name, symbol, uri));
    }

    // 5. Revoke authorities if requested
    if (revokeMint)  instructions.push(ixSetAuthority(mintPk, payer, 0, null));
    if (revFreeze)   instructions.push(ixSetAuthority(mintPk, payer, 1, null));

    // 6. Platform service fee (transparent — shown in UI)
    instructions.push(ixPlatformFee(payer, Math.round(PLATFORM_FEE_SOL * LAMPORTS_PER_SOL)));

    const { tx, blockhash, lastValidBlockHeight } = await buildTx(instructions);
    const txId = await signAndSend(tx, [mintKp]);
    await confirmTx(txId, blockhash, lastValidBlockHeight);

    setResult('createResult', 'success',
      `✅ Token created!<br>` +
      `<strong>Mint:</strong> <a href="https://explorer.solana.com/address/${mintPk}" target="_blank">${mintPk}</a><br>` +
      `<strong>Tx:</strong> <a href="https://explorer.solana.com/tx/${txId}" target="_blank">${txId.slice(0,20)}…</a>`
    );
    updateWalletUI();
  } catch (e) {
    setResult('createResult', 'error', '❌ ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = '🚀 Create Token';
  }
}

// ── Airdrop ────────────────────────────────────────────────────────────────────
function parseAirdrop() {
  const lines = document.getElementById('airRecipients').value.trim().split('\n').filter(l => l.trim());
  const recipients = [];

  for (const line of lines) {
    const [addr, amt] = line.split(',').map(s => s.trim());
    if (!addr || !amt || isNaN(parseFloat(amt))) continue;
    try { new PublicKey(addr); recipients.push({ address: addr, amount: amt }); }
    catch (_) { showToast(`Invalid address: ${addr.slice(0,10)}…`, 'error'); return; }
  }

  if (!recipients.length) { showToast('No valid recipients found.', 'error'); return; }

  state.parsedRecipients = recipients;
  const total = recipients.reduce((s, r) => s + parseFloat(r.amount), 0);
  const batches = Math.ceil(recipients.length / (parseInt(document.getElementById('airBatch').value) || 5));
  const fee = (batches * PLATFORM_FEE_SM).toFixed(3);

  document.getElementById('airCount').value = recipients.length;
  document.getElementById('airSumCount').textContent  = recipients.length;
  document.getElementById('airSumTokens').textContent = total.toLocaleString();
  document.getElementById('airSumFee').textContent    = fee + ' SOL';
  document.getElementById('airSummary').classList.remove('hidden');
  document.getElementById('startAirdropBtn').classList.remove('hidden');
  showToast(`${recipients.length} recipients parsed.`, 'success');
}

async function startAirdrop() {
  if (!state.wallet) { showToast('Connect wallet first.', 'error'); return; }
  if (!state.parsedRecipients?.length) { showToast('Parse recipients first.', 'error'); return; }

  const mintAddr = document.getElementById('airMint').value.trim();
  if (!mintAddr) { showToast('Enter mint address.', 'error'); return; }

  let mintPk;
  try { mintPk = new PublicKey(mintAddr); } catch { showToast('Invalid mint address.', 'error'); return; }

  const conn      = getConn();
  const payer     = state.wallet;
  const batchSize = parseInt(document.getElementById('airBatch').value) || 5;
  const recipients = state.parsedRecipients;

  // Get mint decimals from account data
  let decimals = 9;
  try {
    const info = await conn.getAccountInfo(mintPk);
    if (info) decimals = info.data[44];
  } catch (_) {}

  const senderATA = await findATA(payer, mintPk);

  // Check sender has enough tokens
  try {
    const bal = await conn.getTokenAccountBalance(senderATA);
    const totalNeeded = recipients.reduce((s, r) => s + parseFloat(r.amount), 0);
    if (parseFloat(bal.value.uiAmountString) < totalNeeded) {
      showToast(`Insufficient token balance. Have ${bal.value.uiAmountString}, need ${totalNeeded}`, 'error');
      return;
    }
  } catch (e) {
    showToast('Could not verify token balance: ' + e.message, 'error'); return;
  }

  const btn = document.getElementById('startAirdropBtn');
  btn.disabled = true; btn.textContent = 'Sending…';

  const progress = document.getElementById('airProgress');
  const log      = document.getElementById('airLog');
  progress.classList.remove('hidden');
  log.classList.remove('hidden');
  log.innerHTML = '';

  const batches = [];
  for (let i = 0; i < recipients.length; i += batchSize) {
    batches.push(recipients.slice(i, i + batchSize));
  }

  let done = 0;
  for (const batch of batches) {
    try {
      const instructions = [];

      for (const { address, amount } of batch) {
        const recipPk  = new PublicKey(address);
        const recipATA = await findATA(recipPk, mintPk);
        instructions.push(ixCreateATA(payer, recipATA, recipPk, mintPk));
        instructions.push(ixTransfer(senderATA, recipATA, payer, toRaw(amount, decimals)));
      }

      // Platform fee per batch
      instructions.push(ixPlatformFee(payer, Math.round(PLATFORM_FEE_SM * LAMPORTS_PER_SOL)));

      const { tx, blockhash, lastValidBlockHeight } = await buildTx(instructions);
      const txId = await signAndSend(tx);
      await confirmTx(txId, blockhash, lastValidBlockHeight);

      done += batch.length;
      const pct = Math.round((done / recipients.length) * 100);
      document.getElementById('airBar').style.width = pct + '%';
      document.getElementById('airStatus').textContent = `${done} / ${recipients.length} recipients`;
      log.innerHTML += `<div class="log-ok">✅ Batch ${batches.indexOf(batch)+1}: <a href="https://explorer.solana.com/tx/${txId}" target="_blank">${txId.slice(0,20)}…</a></div>`;
      log.scrollTop = log.scrollHeight;
    } catch (e) {
      log.innerHTML += `<div class="log-err">❌ Batch failed: ${e.message}</div>`;
      log.scrollTop = log.scrollHeight;
    }
  }

  showToast('Airdrop complete!', 'success');
  btn.disabled = false; btn.textContent = '🪂 Start Airdrop';
}

// ── Token Manager ──────────────────────────────────────────────────────────────
async function lookupToken() {
  const mintAddr = document.getElementById('mgMint').value.trim();
  if (!mintAddr) { showToast('Enter a mint address.', 'error'); return; }

  let mintPk;
  try { mintPk = new PublicKey(mintAddr); } catch { showToast('Invalid address.', 'error'); return; }

  try {
    const conn = getConn();
    const info = await conn.getAccountInfo(mintPk);
    if (!info) { showToast('Account not found.', 'error'); return; }

    // Parse mint account data (82 bytes)
    const data     = info.data;
    const decimals = data[44];
    const mintAuthFlag = data[36]; // 0=uninitialized, 1=initialized
    const supply   = new DataView(data.buffer).getBigUint64(36 + 4 + 32, true); // supply at offset ~45
    const mintAuth = mintAuthFlag === 1
      ? new PublicKey(data.slice(0, 32)).toString()
      : 'None';
    const freezeFlag = data[82 - 36] ?? 0;

    // Try supply from RPC
    let uiSupply = '—';
    try {
      const s = await conn.getTokenSupply(mintPk);
      uiSupply = parseFloat(s.value.uiAmountString).toLocaleString();
    } catch (_) {}

    document.getElementById('mgName').textContent      = 'Token';
    document.getElementById('mgSymbol').textContent    = mintAddr.slice(0, 6) + '…';
    document.getElementById('mgSupply').textContent    = uiSupply;
    document.getElementById('mgDecimals').textContent  = decimals;
    document.getElementById('mgMintAuth').textContent  = mintAuth.slice(0, 20) + (mintAuth.length > 20 ? '…' : '');
    document.getElementById('mgFreezeAuth').textContent = 'See explorer';

    state.tokenInfo = { mintPk, decimals };

    document.getElementById('mgTokenInfo').classList.remove('hidden');
    document.getElementById('mgActions').classList.remove('hidden');
    // Pre-fill update fields
    document.getElementById('updName').value   = '';
    document.getElementById('updSymbol').value = '';
    document.getElementById('updUri').value    = '';
    showToast('Token loaded.', 'success');
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

async function revokeAuthorities() {
  if (!state.wallet || !state.tokenInfo) { showToast('Load a token first.', 'error'); return; }
  const revMint   = document.getElementById('revokeMintCb').checked;
  const revFreeze = document.getElementById('revokeFreezeCb').checked;
  if (!revMint && !revFreeze) { showToast('Select at least one authority to revoke.', 'error'); return; }

  const { mintPk } = state.tokenInfo;
  const payer = state.wallet;
  const instructions = [];

  if (revMint)   instructions.push(ixSetAuthority(mintPk, payer, 0, null));
  if (revFreeze) instructions.push(ixSetAuthority(mintPk, payer, 1, null));
  instructions.push(ixPlatformFee(payer, Math.round(PLATFORM_FEE_SM * LAMPORTS_PER_SOL)));

  await runManagerTx(instructions, 'mgResult', 'Authorities revoked!');
}

async function burnTokens() {
  if (!state.wallet || !state.tokenInfo) { showToast('Load a token first.', 'error'); return; }
  const amtStr = document.getElementById('burnAmt').value.trim();
  if (!amtStr) { showToast('Enter amount.', 'error'); return; }

  const { mintPk, decimals } = state.tokenInfo;
  const payer    = state.wallet;
  const userATA  = await findATA(payer, mintPk);
  const raw      = toRaw(amtStr, decimals);
  const instructions = [
    ixBurn(userATA, mintPk, payer, raw),
    ixPlatformFee(payer, Math.round(PLATFORM_FEE_SM * LAMPORTS_PER_SOL)),
  ];

  await runManagerTx(instructions, 'mgResult', `${amtStr} tokens burned!`);
}

async function mintMore() {
  if (!state.wallet || !state.tokenInfo) { showToast('Load a token first.', 'error'); return; }
  const amtStr = document.getElementById('mintAmt').value.trim();
  if (!amtStr) { showToast('Enter amount.', 'error'); return; }

  const { mintPk, decimals } = state.tokenInfo;
  const payer   = state.wallet;
  const userATA = await findATA(payer, mintPk);
  const raw     = toRaw(amtStr, decimals);
  const instructions = [
    ixCreateATA(payer, userATA, payer, mintPk),
    ixMintTo(mintPk, userATA, payer, raw),
    ixPlatformFee(payer, Math.round(PLATFORM_FEE_SM * LAMPORTS_PER_SOL)),
  ];

  await runManagerTx(instructions, 'mgResult', `${amtStr} tokens minted!`);
}

async function updateMetadata() {
  if (!state.wallet || !state.tokenInfo) { showToast('Load a token first.', 'error'); return; }
  const name   = document.getElementById('updName').value.trim();
  const symbol = document.getElementById('updSymbol').value.trim();
  const uri    = document.getElementById('updUri').value.trim();
  if (!name && !symbol && !uri) { showToast('Fill at least one field.', 'error'); return; }

  const { mintPk } = state.tokenInfo;
  const payer = state.wallet;
  const instructions = [
    await ixUpdateMetadata(mintPk, payer, name, symbol, uri),
    ixPlatformFee(payer, Math.round(PLATFORM_FEE_SM * LAMPORTS_PER_SOL)),
  ];

  await runManagerTx(instructions, 'mgResult', 'Metadata updated!');
}

async function runManagerTx(instructions, resultId, successMsg) {
  setResult(resultId, '', '');
  try {
    const { tx, blockhash, lastValidBlockHeight } = await buildTx(instructions);
    const txId = await signAndSend(tx);
    await confirmTx(txId, blockhash, lastValidBlockHeight);
    setResult(resultId, 'success',
      `✅ ${successMsg}<br><a href="https://explorer.solana.com/tx/${txId}" target="_blank">${txId.slice(0,30)}…</a>`
    );
    showToast(successMsg, 'success');
    updateWalletUI();
  } catch (e) {
    setResult(resultId, 'error', '❌ ' + e.message);
    showToast(e.message, 'error');
  }
}

// ── Wallet Generator ───────────────────────────────────────────────────────────
function generateWallets() {
  const count = Math.min(parseInt(document.getElementById('genCount').value) || 5, 50);
  state.genWallets = [];
  const tbody = document.getElementById('walletTbody');
  tbody.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const kp     = Keypair.generate();
    const pub    = kp.publicKey.toString();
    const priv   = Buffer.from(kp.secretKey).toString('hex');
    state.genWallets.push({ pub, priv });

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="mono">${pub.slice(0,10)}… <button class="btn-copy" onclick="copyText('${pub}')">Copy</button></td>
      <td class="mono">${priv.slice(0,10)}… <button class="btn-copy" onclick="copyText('${priv}')">Copy</button></td>
      <td id="wbal-${i}">— <button class="btn-copy" onclick="fetchBal(${i},'${pub}')">↻</button></td>
    `;
    tbody.appendChild(tr);
  }

  document.getElementById('walletTable').classList.remove('hidden');
  document.getElementById('genActions').classList.remove('hidden');
  showToast(`${count} wallets generated.`, 'success');
}

async function fetchBal(idx, pubkey) {
  try {
    const bal = await getConn().getBalance(new PublicKey(pubkey));
    document.getElementById(`wbal-${idx}`).textContent = (bal / LAMPORTS_PER_SOL).toFixed(4) + ' SOL';
  } catch (_) {}
}

function exportWallets(format) {
  if (!state.genWallets.length) return;
  let content, type, name;
  if (format === 'csv') {
    content = 'index,public_key,private_key\n' + state.genWallets.map((w, i) => `${i+1},${w.pub},${w.priv}`).join('\n');
    type = 'text/csv'; name = 'wallets.csv';
  } else {
    content = JSON.stringify(state.genWallets.map((w, i) => ({ index: i+1, public_key: w.pub, private_key: w.priv })), null, 2);
    type = 'application/json'; name = 'wallets.json';
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name; a.click();
}

// ── UI Helpers ─────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

function setResult(id, type, html) {
  const el = document.getElementById(id);
  el.className = 'result' + (type ? ' result-' + type : '');
  el.innerHTML = html;
  if (html) el.classList.remove('hidden'); else el.classList.add('hidden');
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => showToast('Copied!', 'success'));
}

// ── Tab switching ──────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.remove('hidden');
  });
});
