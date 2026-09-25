import { LayoutGrid, Columns3 } from 'lucide-react'
import { useUIStore, type VaultView } from '@/store/ui.store'
import { cn } from '@/lib/utils'

/**
 * Alterna entre la rejilla de tarjetas y el tablero por columnas.
 * La preferencia se guarda en `ui.store` para no perderla al navegar.
 */
export function ViewToggle({ className }: { className?: string }) {
  const view = useUIStore((s) => s.vaultView)
  const setVaultView = useUIStore((s) => s.setVaultView)

  const options: { value: VaultView; label: string; Icon: typeof LayoutGrid }[] =
    [
      { value: 'grid', label: 'Rejilla', Icon: LayoutGrid },
      { value: 'board', label: 'Tablero', Icon: Columns3 },
    ]

  return (
    <div
      role="group"
      aria-label="Modo de visualización"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-xl border border-border bg-surface/70 p-0.5',
        className,
      )}
    >
      {options.map(({ value, label, Icon }) => {
        const active = view === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => setVaultView(value)}
            aria-pressed={active}
            title={label}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[0.7rem] px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
              active
                ? 'bg-primary-soft text-primary'
                : 'text-muted hover:bg-elevated hover:text-foreground',
            )}
          >
            <Icon className="size-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
