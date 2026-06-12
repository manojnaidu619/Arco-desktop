import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind class names intelligently — `clsx` handles conditional
 * classes, `twMerge` de-duplicates conflicting Tailwind utilities (so a later
 * `p-4` correctly overrides an earlier `p-2`). Used throughout the UI.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
