/**
 * PostHog product analytics for the renderer process.
 *
 * The PostHog project API key is meant to be embedded in client code (it's
 * write-only), so it's safe to ship in the bundle via VITE_POSTHOG_KEY.
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
import { api } from '@/lib/api'
import posthog from 'posthog-js'

export function initAnalytics() {
  const apiKey = import.meta.env.VITE_POSTHOG_KEY
  const apiHost = import.meta.env.VITE_POSTHOG_HOST

  if (!apiKey) return

  posthog.init(apiKey, {
    api_host: apiHost || 'https://us.i.posthog.com',
    // Only our explicit posthog.capture() calls should send events — no
    // autocapture, pageviews, web vitals, or session recording.
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_performance: false,
    disable_session_recording: true
  })

  // Identify by the same hardware fingerprint used for license activation,
  // so events from this device stay tied to one PostHog person across
  // restarts and reinstalls (there's no account/sign-in to key off of).
  api.license
    .getDeviceId()
    .then((deviceId) => posthog.identify(deviceId))
    .catch(() => { })
}

export { posthog }
