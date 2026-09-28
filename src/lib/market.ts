import type { SymbolItem, PriceTick } from "@/types/trading";
export const INSTRUMENTS: SymbolItem[] = [
  {
    id: "XAUUSD",
    symbol: "XAUUSD",
    name: "Gold / US dollar",
    category: "Metals",
    digits: 2,
    contractSize: 100,
  },
  {
    id: "EURUSD",
    symbol: "EURUSD",
    name: "Euro / US dollar",
    category: "Forex",
    digits: 5,
    contractSize: 100000,
  },
  {
    id: "GBPUSD",
    symbol: "GBPUSD",
    name: "British pound / US dollar",
    category: "Forex",
    digits: 5,
    contractSize: 100000,
  },
  {
    id: "USDJPY",
    symbol: "USDJPY",
    name: "US dollar / Japanese yen",
    category: "Forex",
    digits: 3,
    contractSize: 100000,
  },
  {
    id: "BTCUSD",
    symbol: "BTCUSD",
    name: "Bitcoin / US dollar",
    category: "Crypto",
    digits: 2,
    contractSize: 1,
  },
  {
    id: "ETHUSD",
    symbol: "ETHUSD",
    name: "Ethereum / US dollar",
    category: "Crypto",
    digits: 2,
    contractSize: 1,
  },
  {
    id: "AUDUSD",
    symbol: "AUDUSD",
    name: "Australian dollar / US dollar",
    category: "Forex",
    digits: 5,
    contractSize: 100000,
  },
  {
    id: "XAGUSD",
    symbol: "XAGUSD",
    name: "Silver / US dollar",
    category: "Metals",
    digits: 3,
    contractSize: 5000,
  },
];
export const instrument = (symbol: string) =>
  INSTRUMENTS.find((i) => i.symbol === symbol) ||
  ({
    id: symbol,
    symbol,
    name: symbol,
    category: "All",
    digits: 5,
  } as SymbolItem);
export const formatPrice = (value: number | undefined, symbol: string) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-US", {
        minimumFractionDigits: instrument(symbol).digits,
        maximumFractionDigits: instrument(symbol).digits,
      })
    : "—";
export const number = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
export const SAMPLE_QUOTES: Record<string, PriceTick> = Object.fromEntries(
  [
    ["XAUUSD", 2674.38, 2674.64, 0.42],
    ["EURUSD", 1.11642, 1.11654, 0.18],
    ["GBPUSD", 1.33762, 1.33777, -0.24],
    ["USDJPY", 144.326, 144.341, -0.32],
    ["BTCUSD", 64218.52, 64225.14, 1.27],
    ["ETHUSD", 2643.72, 2644.38, 0.83],
    ["AUDUSD", 0.68324, 0.68338, 0.16],
    ["XAGUSD", 31.624, 31.652, 0.62],
  ].map(([symbol, bid, ask, change24h]) => [
    symbol,
    { symbol, bid, ask, change24h },
  ]),
) as Record<string, PriceTick>;
export const TIMEFRAMES: Record<string, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1D": 86400,
};
// Preview data is used only without a configured feed or an authenticated account.
export const PREVIEW_FEED = !process.env.NEXT_PUBLIC_WS_URL;
export const CLIENT_PORTAL =
  process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL || "https://my.movementmarkets.com";
export const errorMessage = (error: unknown, fallback: string) => {
  const e = error as { data?: { message?: string }; message?: string };
  return e?.data?.message || e?.message || fallback;
};

export const DEVELOPMENT_FEED =
  process.env.NEXT_PUBLIC_WS_URL?.includes("mock-ws") ?? false;
export const TRADING_ENABLED =
  process.env.NEXT_PUBLIC_TRADING_ENABLED === "true" && !DEVELOPMENT_FEED;
