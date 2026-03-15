/**
 * Mock whale data.
 * In production replace fetchWhales() with a real API call to
 * Hyperliquid, dYdX, GMX, or an aggregator like Nansen / Arkham.
 *
 * Wallet links use Hyperliquid's public portfolio URL:
 *   https://app.hyperliquid.xyz/explorer/address/<wallet>
 */

const WHALES_RAW = [
  {
    wallet: "0xA1b2…9F3c",
    fullAddress: "0xA1b2C3d4E5f6A7B8C9D0E1F2A3B4C5D6E7F89F3c",
    style: "day",
    leverage: 25,
    winRate: 0.78,
    pnl24h: 142300,
    volume24h: 8_400_000,
    trades24h: 34,
    position: { side: "long",  asset: "BTC", size: "2.4 BTC",  entry: 68200, liq: 61800 },
  },
  {
    wallet: "0xB3f4…2A1d",
    fullAddress: "0xB3f4D5e6F7A8B9C0D1E2F3A4B5C6D7E8F9A02A1d",
    style: "swing",
    leverage: 10,
    winRate: 0.84,
    pnl24h: 89700,
    volume24h: 3_200_000,
    trades24h: 6,
    position: { side: "long",  asset: "ETH", size: "48 ETH",  entry: 3420, liq: 2990 },
  },
  {
    wallet: "0xC5d6…8B7e",
    fullAddress: "0xC5d6E7f8A9B0C1D2E3F4A5B6C7D8E9F0A1B28B7e",
    style: "day",
    leverage: 50,
    winRate: 0.71,
    pnl24h: -23100,
    volume24h: 12_700_000,
    trades24h: 61,
    position: { side: "short", asset: "SOL", size: "3200 SOL", entry: 162,  liq: 181  },
  },
  {
    wallet: "0xD7e8…4C3f",
    fullAddress: "0xD7e8F9A0B1C2D3E4F5A6B7C8D9E0F1A2B3C44C3f",
    style: "swing",
    leverage: 15,
    winRate: 0.91,
    pnl24h: 311000,
    volume24h: 6_900_000,
    trades24h: 9,
    position: { side: "long",  asset: "BTC", size: "5.1 BTC",  entry: 66900, liq: 59200 },
  },
  {
    wallet: "0xE9f0…6D5a",
    fullAddress: "0xE9f0A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D66D5a",
    style: "day",
    leverage: 20,
    winRate: 0.76,
    pnl24h: 54200,
    volume24h: 5_100_000,
    trades24h: 28,
    position: null,
  },
  {
    wallet: "0xF1a2…0E7b",
    fullAddress: "0xF1a2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E80E7b",
    style: "swing",
    leverage: 8,
    winRate: 0.88,
    pnl24h: 198400,
    volume24h: 2_800_000,
    trades24h: 4,
    position: { side: "short", asset: "ETH", size: "120 ETH", entry: 3550, liq: 3890 },
  },
  {
    wallet: "0xA3b4…1F8c",
    fullAddress: "0xA3b4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F01F8c",
    style: "day",
    leverage: 30,
    winRate: 0.69,
    pnl24h: 78900,
    volume24h: 9_300_000,
    trades24h: 47,
    position: { side: "long",  asset: "ARB", size: "200k ARB", entry: 1.24, liq: 1.08 },
  },
  {
    wallet: "0xB5c6…3A2d",
    fullAddress: "0xB5c6D7E8F9A0B1C2D3E4F5A6B7C8D9E0F1A23A2d",
    style: "swing",
    leverage: 12,
    winRate: 0.82,
    pnl24h: -11200,
    volume24h: 1_700_000,
    trades24h: 3,
    position: { side: "short", asset: "BTC", size: "1.8 BTC",  entry: 69100, liq: 75800 },
  },
];

/** Simulate live price jitter on PnL (±5 %) */
function jitter(val) {
  return val * (0.95 + Math.random() * 0.10);
}

function fetchWhales() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(
        WHALES_RAW.map((w) => ({
          ...w,
          pnl24h:    Math.round(jitter(w.pnl24h)),
          volume24h: Math.round(jitter(w.volume24h)),
        }))
      );
    }, 400);
  });
}
