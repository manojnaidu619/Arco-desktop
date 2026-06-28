/**
 * Plan badge shown next to the Arco logo in the sidebar header.
 *
 * Displays the user's current license tier:
 *   - "Free" (muted styling) for users without an activated license
 *   - "Pro" (primary accent styling) for an activated 1-year license
 *   - "Unlimited" (primary accent styling) for an activated lifetime license
 *
 * @used-by Sidebar header section
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
import { cn } from '@/lib/utils'
import type { LicenseType } from '@shared/api-contract'

interface Props {
  /** Whether the user has an activated license. */
  isActivated: boolean
  /** Tier of the active license; ignored when isActivated is false. Defaults to 'pro'. */
  licenseType?: LicenseType
}

/**
 * Badge component displaying the current license tier.
 *
 * @param isActivated — false renders "FREE" badge
 * @param licenseType — 'unlimited' renders "UNLIMITED", anything else (including
 *   undefined) renders "PRO".
 */
export function LicenseBadge({ isActivated, licenseType }: Props) {
  const label = !isActivated ? 'FREE' : licenseType === 'unlimited' ? 'UNLIMITED' : 'PRO'

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center h-5 leading-none text-[10px] font-semibold tracking-wide px-1.5 rounded shrink-0',
        isActivated
          ? 'bg-primary/20 text-primary'
          : 'bg-muted text-muted-foreground'
      )}
    >
      {label}
    </span>
  )
}
