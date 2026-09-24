import { Moon, Sun } from 'lucide-react'
import { useUIStore } from '@/store/ui.store'
import { cn } from '@/lib/utils'

/** Botón sol/luna para alternar entre tema claro y oscuro. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useUIStore((s) => s.theme)
  const toggleTheme = useUIStore((s) => s.toggleTheme)

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={
        theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'
      }
      aria-label={
        theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'
      }
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-xl text-muted transition-all hover:bg-primary-soft hover:text-primary',
        className,
      )}
    >
      {theme === 'dark' ? (
        <Moon className="size-4" />
      ) : (
        <Sun className="size-4" />
      )}
    </button>
  )
}
