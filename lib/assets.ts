export const ASSETS = [
  { symbol: 'BTC', name: 'Bitcoin', id: 'bitcoin', coinbase: 'BTC-USD', kraken: 'XBTUSD', color: '#f7931a' },
  { symbol: 'ETH', name: 'Ethereum', id: 'ethereum', coinbase: 'ETH-USD', kraken: 'ETHUSD', color: '#8b9cf5' },
  { symbol: 'SOL', name: 'Solana', id: 'solana', coinbase: 'SOL-USD', kraken: 'SOLUSD', color: '#9c7af7' },
  { symbol: 'XRP', name: 'XRP', id: 'ripple', coinbase: 'XRP-USD', kraken: 'XRPUSD', color: '#acbfd1' },
  { symbol: 'DOGE', name: 'Dogecoin', id: 'dogecoin', coinbase: 'DOGE-USD', kraken: 'DOGEUSD', color: '#c6a858' },
  { symbol: 'ADA', name: 'Cardano', id: 'cardano', coinbase: 'ADA-USD', kraken: 'ADAUSD', color: '#477af0' },
] as const;

export type AssetSymbol = typeof ASSETS[number]['symbol'];
