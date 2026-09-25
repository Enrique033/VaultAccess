import {
  decryptJson,
  encryptJson,
  personalRecordAad,
  workspaceRecordAad,
  type VaultRecordKind,
} from './vault-crypto'

export interface SectionPayload {
  name: string
}

export interface CategoryPayload {
  name: string
}

export interface AttachmentMetadata {
  id: string
  name: string
  mimeType: string
  size: number
}

export interface CredentialPayload {
  title: string
  username: string
  password: string
  url?: string
  notes?: string
  attachments?: AttachmentMetadata[]
}

export interface LinkPayload {
  title: string
  url: string
  description?: string
  attachments?: AttachmentMetadata[]
}

export interface NotePayload {
  title: string
  content: string
  comments?: string
  attachments?: AttachmentMetadata[]
}

export interface HistoryPayload {
  password: string
}

export interface WorkspaceItemPayload {
  title: string
  username: string
  password: string
  url?: string
  notes?: string
}

export async function encryptPersonal<T>(
  kind: VaultRecordKind,
  recordId: string,
  userId: string,
  key: CryptoKey,
  payload: T,
): Promise<string> {
  return encryptJson(payload, key, personalRecordAad(kind, userId, recordId))
}

export async function decryptPersonal<T>(
  kind: VaultRecordKind,
  recordId: string,
  userId: string,
  key: CryptoKey,
  encryptedPayload: string,
): Promise<T> {
  return decryptJson(
    encryptedPayload,
    key,
    personalRecordAad(kind, userId, recordId),
  )
}

export async function encryptWorkspace<T>(
  workspaceId: string,
  recordId: string,
  key: CryptoKey,
  payload: T,
): Promise<string> {
  return encryptJson(payload, key, workspaceRecordAad(workspaceId, recordId))
}

export async function decryptWorkspace<T>(
  workspaceId: string,
  recordId: string,
  key: CryptoKey,
  encryptedPayload: string,
): Promise<T> {
  return decryptJson(
    encryptedPayload,
    key,
    workspaceRecordAad(workspaceId, recordId),
  )
}
