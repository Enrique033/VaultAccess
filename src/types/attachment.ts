/** Metadatos de una imagen cifrada guardada en Supabase Storage. */
export interface Attachment {
  id: string
  name: string
  mimeType: string
  size: number
}

export interface AttachmentChanges {
  newFiles: File[]
  removedIds: string[]
}

export type AttachmentDraft = AttachmentChanges
