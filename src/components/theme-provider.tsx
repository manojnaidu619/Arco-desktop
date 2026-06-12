/**
 * Wraps the app in `next-themes`, which manages the light/dark/system theme by
 * toggling a `.dark` class on <html>. Despite the package name it's not tied
 * to Next.js — it works in any React app, including this Vite renderer.
 */
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ReactNode } from 'react'

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  )
}
