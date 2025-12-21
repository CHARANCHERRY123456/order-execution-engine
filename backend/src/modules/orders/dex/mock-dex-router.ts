import { DexQuote, SwapResult, OrderInput } from './dex.types.js';
import { logger } from '../../../config/logger.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateMockTxHash(): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let hash = '';
  for (let i = 0; i < 64; i++) {
    hash += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return hash;
}

export class MockDexRouter {
  private basePrice: number;

  constructor(basePrice: number = 100) {
    this.basePrice = basePrice;
  }

  /**
   * Simulate Raydium quote fetching
   * Price variance: 2-4% around base
   * Fee: 0.3%
   */
  async getRaydiumQuote(order: OrderInput): Promise<DexQuote> {
    // Simulate network delay
    await sleep(150 + Math.random() * 100); // 150-250ms

    const priceVariance = 0.98 + Math.random() * 0.04; // 0.98 to 1.02 (±2%)
    const price = this.basePrice * priceVariance;
    const fee = 0.003; // 0.3%
    const priceImpact = 0.001 + Math.random() * 0.002; // 0.1-0.3%

    const outputAmount = order.amount * price * (1 - fee) * (1 - priceImpact);

    logger.info({
      dex: 'Raydium',
      price,
      outputAmount,
      fee,
      priceImpact
    }, `\[ROUTER\] Raydium quote: price=${price.toFixed(2)} fee=${fee}`);

    return {
      dexName: 'Raydium',
      inputAmount: order.amount,
      outputAmount,
      price,
      fee,
      priceImpact
    };
  }

  /**
   * Simulate Meteora quote fetching
   * Price variance: 3-5% around base (slightly more volatile)
   * Fee: 0.2% (cheaper than Raydium)
   */
  async getMeteorQuote(order: OrderInput): Promise<DexQuote> {
    // Simulate network delay
    await sleep(150 + Math.random() * 100); // 150-250ms

    const priceVariance = 0.97 + Math.random() * 0.05; // 0.97 to 1.02 (±3-5%)
    const price = this.basePrice * priceVariance;
    const fee = 0.002; // 0.2% (lower fee)
    const priceImpact = 0.002 + Math.random() * 0.003; // 0.2-0.5%

    const outputAmount = order.amount * price * (1 - fee) * (1 - priceImpact);

    logger.info({
      dex: 'Meteora',
      price,
      outputAmount,
      fee,
      priceImpact
    }, `\[ROUTER\] Meteora quote: price=${price.toFixed(2)} fee=${fee}`);

    return {
      dexName: 'Meteora',
      inputAmount: order.amount,
      outputAmount,
      price,
      fee,
      priceImpact
    };
  }

  /**
   * Compare quotes and select the best one (highest output amount)
   */
  selectBestQuote(raydiumQuote: DexQuote, meteoraQuote: DexQuote): DexQuote {
    const bestQuote = raydiumQuote.outputAmount > meteoraQuote.outputAmount
      ? raydiumQuote
      : meteoraQuote;

    const priceDifference = Math.abs(
      raydiumQuote.outputAmount - meteoraQuote.outputAmount
    );
    const percentageDiff = (priceDifference / Math.max(
      raydiumQuote.outputAmount,
      meteoraQuote.outputAmount
    )) * 100;

    logger.info({
      raydium: raydiumQuote.outputAmount,
      meteora: meteoraQuote.outputAmount,
      selected: bestQuote.dexName,
      savingsPercent: percentageDiff.toFixed(2)
    }, `\[ROUTER\] Selected DEX: ${bestQuote.dexName} (savings=${percentageDiff.toFixed(2)}%)`);

    return bestQuote;
  }

  /**
   * Simulate swap execution on selected DEX
   * Takes 2-3 seconds (realistic blockchain transaction time)
   */
  async executeSwap(quote: DexQuote, order: OrderInput): Promise<SwapResult> {
    // Simulate transaction submission and confirmation
    const executionTime = 2000 + Math.random() * 1000; // 2-3 seconds
    await sleep(executionTime);

    // Small execution variance (±0.1%)
    const executionVariance = 0.999 + Math.random() * 0.002;
    const finalOutputAmount = quote.outputAmount * executionVariance;
    const executedPrice = finalOutputAmount / order.amount;

    const txHash = generateMockTxHash();

    logger.info({
      dex: quote.dexName,
      txHash,
      executedPrice,
      outputAmount: finalOutputAmount,
      executionTimeMs: executionTime
    }, `\[EXECUTION\] Swap executed: txHash=${txHash} price=${executedPrice.toFixed(2)}`);

    return {
      txHash,
      dexUsed: quote.dexName,
      inputAmount: order.amount,
      outputAmount: finalOutputAmount,
      executedPrice,
      fee: quote.fee
    };
  }

  /**
   * Full routing flow: get quotes, compare, and route to best DEX
   */
  async routeOrder(order: OrderInput): Promise<{
    raydiumQuote: DexQuote;
    meteoraQuote: DexQuote;
    selectedQuote: DexQuote;
  }> {
    // Fetch both quotes in parallel for speed
    const [raydiumQuote, meteoraQuote] = await Promise.all([
      this.getRaydiumQuote(order),
      this.getMeteorQuote(order)
    ]);

    const selectedQuote = this.selectBestQuote(raydiumQuote, meteoraQuote);

    return {
      raydiumQuote,
      meteoraQuote,
      selectedQuote
    };
  }
}
