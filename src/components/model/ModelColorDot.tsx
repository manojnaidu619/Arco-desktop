/**
 * Colored dot used to identify a model in lists, dropdowns, and badges.
 */
import { cn } from '@/lib/utils'

interface Props {
  color: string
  size?: 'xs' | 'sm' | 'md'
  className?: string
}

const sizeClass = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5'
} as const

export function ModelColorDot({ color, size = 'sm', className }: Props) {
  return (
    <span
      className={cn('rounded-full shrink-0', sizeClass[size], className)}
      style={{ backgroundColor: color }}
    />
  )
}
