export interface ActiveVaultSession {
  userId: string
  vaultKey: CryptoKey
  privateKey: CryptoKey
  publicKey: string
}

let activeSession: ActiveVaultSession | null = null
let sessionGeneration = 0

export function getVaultSessionGeneration(): number {
  return sessionGeneration
}

export function setActiveVaultSession(session: ActiveVaultSession | null): void {
  if (!session) sessionGeneration += 1
  activeSession = session
}

export function getActiveVaultSession(): ActiveVaultSession | null {
  return activeSession
}

export function requireActiveVaultSession(): ActiveVaultSession {
  if (!activeSession) {
    throw new Error('Desbloquea el Vault para continuar.')
  }
  return activeSession
}

export function clearActiveVaultSession(): void {
  setActiveVaultSession(null)
}
