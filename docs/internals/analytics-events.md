# Analytics events

PostHog is initialized in [src/lib/analytics.ts](../../src/lib/analytics.ts) and
identifies each install by the same hardware fingerprint used for license
activation (`node-machine-id`, via `api.license.getDeviceId()`) — there's no
sign-in to key off of, so one device maps to one PostHog person.

Keep this list in sync whenever an event is added, removed, or its properties
change. Capture only what's listed under "Properties" — no extra fields,
no raw user input (keys, model names selected, message content, etc.).

| Event | Trigger | Properties | Location |
|---|---|---|---|
| `onboarding_key_saved` | OpenRouter API key validated and saved during onboarding | — | [Onboarding.tsx](../../src/components/Onboarding.tsx) |
| `onboarding_models_saved` | User finishes model-selection step and completes onboarding | `models` (OpenRouter model IDs saved) | [Onboarding.tsx](../../src/components/Onboarding.tsx) |
| `new_conversation_started` | First message sent in a newly started conversation | `id` (session id), `models` (OpenRouter model IDs the message was sent to) | [useChat.ts](../../src/hooks/useChat.ts) |
| `conversation_deleted` | A conversation/session is deleted | `id` (session id) | [useChat.ts](../../src/hooks/useChat.ts) |
| `upgrade_clicked` | "Unlock Pro" clicked in the upgrade modal (opens the pricing page) | — | [LicenseModal.tsx](../../src/components/license/LicenseModal.tsx) |
| `license_activated` | License key activation attempted | `status` (`'success'` \| `'failure'`) | [LicenseModal.tsx](../../src/components/license/LicenseModal.tsx) |
| `api_key_removed` | "Remove API key" clicked in Settings | — | [SettingsDialog.tsx](../../src/components/settings/SettingsDialog.tsx) |
