/**
 * Visual separator component for dividing content sections.
 *
 * Built on base-ui Separator primitive. Supports both horizontal (default)
 * and vertical orientations.
 *
 * @example
 *   <Separator />
 *   <Separator orientation="vertical" />
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
import { Separator as SeparatorPrimitive } from "@base-ui/react/separator"

import { cn } from "@/lib/utils"

/** Visual divider line between content sections. */
function Separator({
  className,
  orientation = "horizontal",
  ...props
}: SeparatorPrimitive.Props) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
