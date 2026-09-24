/** Conversación de chat interno. */
export interface ChatConversation {
  id: string
  created_at: string
  is_group: boolean
  team_id: string | null
}

/** Participante de una conversación. */
export interface ChatConversationParticipant {
  conversation_id: string
  user_id: string
  last_read_at: string | null
  created_at: string
}

/** Mensaje de chat; los borrados/eliminaciones son locales o globales. */
export interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  edited_at: string | null
  deleted_at: string | null
  deleted_by: string | null
}

/** Usuario visible según la política de privacidad del chat. */
export interface ChatUser {
  id: string
  /** NULL cuando el usuario registró un nombre y no es el owner global. */
  email: string | null
  name: string
  hasName: boolean
  avatarColor: string
  isOnline: boolean
  lastSeenAt?: string
}

export type ChatNotificationKind = 'message' | 'team_update'

/** Notificación persistente y visible solo para su destinatario. */
export interface ChatNotification {
  id: string
  recipient_id: string
  actor_id: string | null
  conversation_id: string | null
  message_id: string | null
  workspace_id: string | null
  kind: ChatNotificationKind
  preview: string
  created_at: string
  read_at: string | null
}
