export interface DexQuote {
  dexName: 'Raydium' | 'Meteora';
  inputAmount: number;
  outputAmount: number;
  price: number;           // Price per token
  fee: number;             // Trading fee (0.003 = 0.3%)
  priceImpact: number;     // Slippage/price impact
}

export interface SwapResult {
  txHash: string;
  dexUsed: 'Raydium' | 'Meteora';
  inputAmount: number;
  outputAmount: number;
  executedPrice: number;
  fee: number;
}

export interface OrderInput {
  tokenIn: string;
  tokenOut: string;
  amount: number;
  slippage?: number;  // Optional, defaults to 1%
}
