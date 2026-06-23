/**
 * Shared utility functions for the renderer.
 *
 * Small, pure functions used across multiple components. Keep this file lean;
 * domain-specific helpers belong in their respective modules.
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind class names intelligently.
 *
 * Combines `clsx` (conditional classes) with `twMerge` (de-duplicates conflicting
 * Tailwind utilities so a later `p-4` correctly overrides an earlier `p-2`).
 *
 * @used-by Nearly every component in the UI
 * @param inputs — class names, arrays, or conditional objects
 * @returns merged class string
 *
 * @example
 *   cn('p-2', isLarge && 'p-4', className)
 *   // → 'p-4' if isLarge, otherwise 'p-2', plus any className
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
