/**
 * Plan badge shown next to the Arco logo in the sidebar header.
 *
 * Displays the user's current license tier:
 *   - "Free" (muted styling) for users without a Pro license
 *   - "Pro" (primary accent styling) after successful license activation
 *
 * @used-by Sidebar header section
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
import { cn } from '@/lib/utils'

interface Props {
  /** Whether the user has an activated Pro license. */
  isActivated: boolean
}

/**
 * Badge component displaying the current license tier.
 *
 * @param isActivated — true renders "Pro" badge, false renders "Free" badge
 */
export function LicenseBadge({ isActivated }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center h-5 leading-none text-[10px] font-semibold uppercase tracking-wide px-1.5 rounded shrink-0',
        isActivated
          ? 'bg-primary/20 text-primary'
          : 'bg-muted text-muted-foreground'
      )}
    >
      {isActivated ? 'Pro' : 'Free'}
    </span>
  )
}
