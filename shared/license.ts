/**
 * License tier limits shared between main process and renderer.
 *
 * Phase 1 enforces the session cap in the UI when creating conversations;
 * Pro users have no cap.
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */

/** Max saved conversations on the free plan. */
export const FREE_TIER_SESSION_LIMIT = 2
