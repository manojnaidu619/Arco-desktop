/**
 * Plan badge shown next to the Arco logo in the sidebar header.
 * "Free" for default users; "Pro" after license activation.
 */
import { cn } from '@/lib/utils'

interface Props {
  isActivated: boolean
}

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
