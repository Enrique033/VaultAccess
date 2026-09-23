import { CredentialCard } from './CredentialCard'
import type { Credential } from '@/types'

interface CredentialGridProps {
  credentials: Credential[]
  onEdit: (credential: Credential) => void
  onDelete: (credential: Credential) => void
}

export function CredentialGrid({
  credentials,
  onEdit,
  onDelete,
}: CredentialGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {credentials.map((credential, index) => (
        <div
          key={credential.id}
          className="animate-fade-up h-full"
          // Entrada escalonada (máx. 8 pasos) para que el grid no "salte".
          style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
        >
          <CredentialCard
            credential={credential}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      ))}
    </div>
  )
}