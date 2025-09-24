/**
 * Credit calculation utilities
 */

// Configuration
const TOKENS_PER_CREDIT = 1000;

/**
 * Calculate credit cost based on input and output tokens
 * @param inputTokens Number of input tokens
 * @param outputTokens Number of output tokens
 * @returns Number of credits required (rounded up)
 */
export function calculateCreditCost(inputTokens: number, outputTokens: number): number {
  const totalTokens = inputTokens + outputTokens;
  return Math.ceil(totalTokens / TOKENS_PER_CREDIT);
}

/**
 * Check if balance is considered low
 * @param balance Current balance
 * @param threshold Low balance threshold (default: 100)
 * @returns True if balance is low
 */
export function isBalanceLow(balance: number, threshold: number = 100): boolean {
  return balance <= threshold;
}

/**
 * Estimate tokens from text content
 * @param content Text content
 * @returns Estimated number of tokens
 */
export function estimateTokensFromContent(content: string): number {
  if (!content) return 0;
  
  // Rough estimation: ~4 characters per token for Portuguese
  const estimatedTokens = Math.ceil(content.length / 4);
  
  // Add system tokens (base prompt)
  const systemTokens = 50;
  
  return estimatedTokens + systemTokens;
}

/**
 * Convert credits to tokens
 * @param credits Number of credits
 * @returns Number of tokens
 */
export function creditsToTokens(credits: number): number {
  return credits * TOKENS_PER_CREDIT;
}

/**
 * Convert tokens to credits (rounded up)
 * @param tokens Number of tokens
 * @returns Number of credits
 */
export function tokensToCredits(tokens: number): number {
  return Math.ceil(tokens / TOKENS_PER_CREDIT);
}