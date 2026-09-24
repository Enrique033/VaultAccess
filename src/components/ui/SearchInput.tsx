import { forwardRef } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, placeholder = 'Buscar...', className }, ref) => {
    return (
      <div
        className={cn(
          'flex h-11 items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 text-muted shadow-sm transition-all duration-150 hover:border-primary/30 focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/10',
          'lg:h-10',
          className,
        )}
      >
        <Search className="size-3.5 shrink-0 text-muted" />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-base text-foreground placeholder:text-muted focus:outline-none lg:text-[13px]"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="rounded p-0.5 text-muted transition-colors duration-150 hover:text-foreground"
            aria-label="Limpiar búsqueda"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    )
  },
)

SearchInput.displayName = 'SearchInput'
