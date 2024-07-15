/**
 * The default context window for chat models that are NOT Claude-3 Sonnet or Opus.
 */
export const CHAT_INPUT_TOKEN_BUDGET = 7000

/**
 * The default context window for fast chat models with a smaller context window.
 */
export const FAST_CHAT_INPUT_TOKEN_BUDGET = 4096

/**
 * The default output token limit for chat models.
 */
export const CHAT_OUTPUT_TOKEN_BUDGET = 4000

/**
 * The special output token limit for Claude 3.5 Sonnet only
 */
export const CHAT_OUTPUT_TOKEN_BUDGET_3_5_SONNET = 8000

/**
 * Enhanced context takes up to 60% of the total context window for chat.
 * The % is the same for both fast and regular chat models.
 */
export const ENHANCED_CONTEXT_ALLOCATION = 0.6

/**
 * NOTE: Reserved for models with large context windows and good recall.
 *
 * The total context window reserved for user added context (@-mention, right-click, etc.)
 */
export const EXTENDED_USER_CONTEXT_TOKEN_BUDGET = 30000

/**
 * NOTE: Reserved for models with large context windows and good recall.
 *
 * The total context window reserved for chat input.
 */
export const EXTENDED_CHAT_INPUT_TOKEN_BUDGET = 15000
