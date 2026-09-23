import type { Category } from '@/types'
import { cn } from '@/lib/utils'

interface CategoryBadgeProps {
  category?: Category
  className?: string
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  if (!category) return null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md bg-elevated px-1.5 py-0.5 text-[11px] font-medium text-muted',
        className,
      )}
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: category.color }}
        aria-hidden="true"
      />
      {category.name}
    </span>
  )
}