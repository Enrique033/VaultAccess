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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {credentials.map((credential) => (
        <CredentialCard
          key={credential.id}
          credential={credential}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}