import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import { useAuth } from '@/app/auth-context'
import { isSupabaseConfigured, requireUserId, supabase } from '@/lib/supabase'
import { sanitizeChatInput } from '@/lib/sanitize'
import type {
  ChatConversation,
  ChatConversationParticipant,
  ChatMessage,
  ChatUser,
} from '@/types/chat'

interface ConversationRow {
  id: string
  created_at: string
  is_group: boolean
  team_id: string | null
}

interface ParticipantRow {
  conversation_id: string
  user_id: string
  last_read_at: string | null
  created_at: string
}

interface MessageRow {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  edited_at?: string | null
  deleted_at?: string | null
  deleted_by?: string | null
}

interface SearchUserRow {
  id: string
  email: string | null
  name: string | null
  avatar_color: string | null
  is_online: boolean | null
  last_seen_at: string | null
}

interface ProfileRow {
  id: string
  name: string
  email: string | null
  avatar_color: string | null
  is_online: boolean | null
  last_seen_at: string | null
  has_name: boolean
}

interface ChatSnapshotPayload {
  conversations?: ConversationRow[]
  participants?: ParticipantRow[]
  last_messages?: MessageRow[]
  deleted_message_ids?: string[]
}

interface ConversationMessagesPayload {
  messages?: MessageRow[]
  deleted_message_ids?: string[]
}

interface ChatState {
  conversations: ChatConversation[]
  conversationParticipants: Map<string, ChatConversationParticipant[]>
  messages: Map<string, ChatMessage[]>
  profiles: Map<string, ChatUser>
  deletedMessageIds: Set<string>
  activeConversationId: string | null
  loadedConversationIds: Set<string>
  messagesLoading: Set<string>
  messageLoadFailed: Set<string>
  /** Usuario propietario de este estado; evita mezclar sesiones. */
  sessionUserId: string | null
  initialized: boolean
  loading: boolean
  error: string | null
  searchQuery: string
  searchedUsers: ChatUser[]
  searching: boolean
  searchError: string | null
  initialize: (knownUserId?: string) => Promise<void>
  reset: () => void
  setActiveConversation: (conversationId: string | null) => void
  loadConversations: () => Promise<void>
  loadMessages: (conversationId: string) => Promise<void>
  loadProfiles: (userIds: string[]) => Promise<void>
  sendMessage: (conversationId: string, content: string) => Promise<void>
  editMessage: (messageId: string, content: string) => Promise<void>
  deleteMessageForMe: (messageId: string) => Promise<void>
  deleteMessageForEveryone: (messageId: string) => Promise<void>
  createDirectConversation: (otherUserId: string) => Promise<string | null>
  searchUsers: (query: string) => Promise<void>
  clearSearch: () => void
  subscribeToMessages: (conversationId: string) => () => void
  clearError: () => void
}

let messageChannel: ReturnType<typeof supabase.channel> | null = null
let messageSubscriptionId = 0
let searchRequest = 0
let sessionGeneration = 0

function isCurrentSession(generation: number): boolean {
  return generation === sessionGeneration
}

type ErrorLike = {
  message?: unknown
  details?: unknown
  hint?: unknown
  code?: unknown
  error?: unknown
  cause?: unknown
  data?: unknown
}

function stringifyErrorPart(value: unknown, depth = 0): string {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  if (depth >= 2) return ''
  if (Array.isArray(value)) {
    return value
      .map((part) => stringifyErrorPart(part, depth + 1))
      .filter(Boolean)
      .join(' · ')
  }
  if (typeof value === 'object') {
    const object = value as ErrorLike
    return [
      object.message,
      object.details,
      object.hint,
      object.code,
      object.error,
      object.cause,
      object.data,
    ]
      .map((part) => stringifyErrorPart(part, depth + 1))
      .filter(Boolean)
      .join(' · ')
  }
  return ''
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return stringifyErrorPart(error.message) || error.name
  }
  return stringifyErrorPart(error)
}

function friendlyChatError(error: unknown): Error {
  const message = errorMessage(error)
  if (
    /PGRST202|schema cache|function .*does not exist|could not find the function/i.test(
      message,
    )
  ) {
    return new Error(
      'La búsqueda de usuarios no está disponible. Ejecuta nuevamente supabase/schema-chat-v3.sql en Supabase.',
    )
  }
  if (/relation .* does not exist/i.test(message)) {
    if (/chat_message_deletions|chat_notifications/i.test(message)) {
      return new Error(
        'Falta la ampliación de chat. Ejecuta supabase/schema-chat-v2.sql.',
      )
    }
    return new Error(
      'Faltan las tablas de chat. Ejecuta supabase/schema-chat.sql en Supabase.',
    )
  }
  if (/row-level security|permission denied|jwt/i.test(message)) {
    return new Error(
      'Supabase bloqueó la operación. Verifica tu sesión y las políticas RLS del chat.',
    )
  }
  if (/failed to fetch|network|fetch failed/i.test(message)) {
    return new Error('No se pudo conectar con Supabase para usar el chat.')
  }
  return new Error(message || 'No se pudo completar la operación del chat.')
}

const CHAT_CONVERSATION_COLUMNS = 'id, created_at, is_group, team_id'
const CHAT_PARTICIPANT_COLUMNS =
  'conversation_id, user_id, last_read_at, created_at'
const CHAT_MESSAGE_COLUMNS =
  'id, conversation_id, sender_id, content, created_at, edited_at, deleted_at, deleted_by'
const CHAT_DELETION_COLUMNS = 'message_id'

function groupMessages(
  rows: MessageRow[],
  deletedIds: Set<string>,
): Map<string, ChatMessage[]> {
  const grouped = new Map<string, ChatMessage[]>()
  for (const row of rows) {
    if (deletedIds.has(row.id)) continue
    const list = grouped.get(row.conversation_id) ?? []
    list.push(mapMessage(row))
    grouped.set(row.conversation_id, list)
  }
  for (const [conversationId, list] of grouped) {
    grouped.set(conversationId, sortMessages(list))
  }
  return grouped
}

function isMissingSnapshotRpc(message: string): boolean {
  return /PGRST202|schema cache|function .*does not exist|could not find the function/i.test(
    message,
  )
}

function mapConversation(row: ConversationRow): ChatConversation {
  return {
    id: row.id,
    created_at: row.created_at,
    is_group: row.is_group,
    team_id: row.team_id,
  }
}

function mapParticipant(row: ParticipantRow): ChatConversationParticipant {
  return {
    conversation_id: row.conversation_id,
    user_id: row.user_id,
    last_read_at: row.last_read_at,
    created_at: row.created_at,
  }
}

function mapMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    content: sanitizeChatInput(row.content),
    created_at: row.created_at,
    edited_at: row.edited_at ?? null,
    deleted_at: row.deleted_at ?? null,
    deleted_by: row.deleted_by ?? null,
  }
}

function mapProfile(row: ProfileRow): ChatUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    hasName: row.has_name,
    avatarColor: row.avatar_color || '',
    isOnline: row.is_online ?? false,
    lastSeenAt: row.last_seen_at ?? undefined,
  }
}

function sortMessages(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at))
}

function removeMessageChannel() {
  if (!messageChannel) return
  supabase.removeChannel(messageChannel)
  messageChannel = null
}

const SEARCH_RPCS = [
  'search_chat_users_v3',
  'search_chat_users_v2',
  'search_chat_users',
  'search_users',
] as const

function isMissingSearchRpcError(message: string): boolean {
  return /PGRST202|schema cache|function .*does not exist|could not find the function/i.test(
    message,
  )
}

async function searchUsersRpc(query: string): Promise<SearchUserRow[]> {
  let missingFunctionError: unknown = null

  for (const rpcName of SEARCH_RPCS) {
    const result = await supabase.rpc(rpcName, {
      search_term: query,
      limit_count: 20,
    })
    if (!result.error) {
      if (!Array.isArray(result.data)) {
        throw new Error('La búsqueda devolvió una respuesta inesperada.')
      }
      const rows = result.data.filter(
        (row): row is SearchUserRow =>
          Boolean(row) && typeof row === 'object' && typeof row.id === 'string',
      )
      if (rows.length !== result.data.length) {
        throw new Error(
          'La búsqueda devolvió usuarios con un formato inválido.',
        )
      }
      return rows
    }

    const message = errorMessage(result.error)
    missingFunctionError = result.error
    if (!isMissingSearchRpcError(message)) {
      throw result.error
    }
    console.warn(`[VaultAccess] RPC de búsqueda no disponible: ${rpcName}`)
  }

  throw missingFunctionError ?? new Error('No se encontró la RPC de búsqueda.')
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  conversationParticipants: new Map(),
  messages: new Map(),
  profiles: new Map(),
  deletedMessageIds: new Set(),
  activeConversationId: null,
  loadedConversationIds: new Set(),
  messagesLoading: new Set(),
  messageLoadFailed: new Set(),
  sessionUserId: null,
  initialized: false,
  loading: false,
  error: null,
  searchQuery: '',
  searchedUsers: [],
  searching: false,
  searchError: null,

  initialize: async (knownUserId) => {
    if (get().initialized || get().loading) return
    if (!isSupabaseConfigured) {
      set({ loading: false, initialized: true })
      return
    }
    const generation = sessionGeneration
    set({ loading: true, error: null })
    try {
      const sessionUserId = knownUserId ?? (await requireUserId())
      if (!isCurrentSession(generation)) return
      const snapshotResult = await supabase.rpc('get_chat_snapshot')
      let conversations: ChatConversation[]
      let participants: Map<string, ChatConversationParticipant[]>
      let messages: Map<string, ChatMessage[]>
      let deletedMessageIds: Set<string>

      if (snapshotResult.error) {
        if (!isMissingSnapshotRpc(snapshotResult.error.message)) {
          throw snapshotResult.error
        }
        const [convRes, partRes, msgRes, deletionRes] = await Promise.all([
          supabase
            .from('chat_conversations')
            .select(CHAT_CONVERSATION_COLUMNS)
            .order('created_at', { ascending: false })
            .limit(100),
          supabase
            .from('chat_conversation_participants')
            .select(CHAT_PARTICIPANT_COLUMNS)
            .order('created_at', { ascending: true }),
          supabase
            .from('chat_messages')
            .select(CHAT_MESSAGE_COLUMNS)
            .order('created_at', { ascending: false })
            .limit(500),
          supabase.from('chat_message_deletions').select(CHAT_DELETION_COLUMNS),
        ])
        const firstError =
          convRes.error ?? partRes.error ?? msgRes.error ?? deletionRes.error
        if (firstError) throw firstError
        deletedMessageIds = new Set(
          ((deletionRes.data ?? []) as { message_id: string }[]).map(
            (row) => row.message_id,
          ),
        )
        conversations = (convRes.data ?? []).map((row) =>
          mapConversation(row as ConversationRow),
        )
        participants = new Map()
        for (const row of (partRes.data ?? []) as ParticipantRow[]) {
          const list = participants.get(row.conversation_id) ?? []
          list.push(mapParticipant(row))
          participants.set(row.conversation_id, list)
        }
        messages = groupMessages(
          (msgRes.data ?? []) as MessageRow[],
          deletedMessageIds,
        )
      } else {
        const payload = snapshotResult.data as ChatSnapshotPayload | null
        if (
          !payload ||
          !Array.isArray(payload.conversations) ||
          !Array.isArray(payload.participants) ||
          !Array.isArray(payload.last_messages)
        ) {
          throw new Error('El snapshot de chat tiene un formato inválido.')
        }
        deletedMessageIds = new Set(payload.deleted_message_ids ?? [])
        conversations = payload.conversations.map((row) => mapConversation(row))
        participants = new Map()
        for (const row of payload.participants) {
          const list = participants.get(row.conversation_id) ?? []
          list.push(mapParticipant(row))
          participants.set(row.conversation_id, list)
        }
        messages = groupMessages(payload.last_messages, deletedMessageIds)
      }
      if (!isCurrentSession(generation)) return
      set({
        conversations,
        conversationParticipants: participants,
        messages,
        deletedMessageIds,
        loadedConversationIds: new Set(),
        messagesLoading: new Set(),
        messageLoadFailed: new Set(),
        sessionUserId,
        initialized: true,
        loading: false,
        error: null,
      })
      const participantIds = [...participants.values()].flatMap((list) =>
        list.map((participant) => participant.user_id),
      )
      await get().loadProfiles(participantIds)
    } catch (error) {
      if (isCurrentSession(generation)) {
        set({ loading: false, error: friendlyChatError(error).message })
      }
    }
  },

  reset: () => {
    sessionGeneration += 1
    messageSubscriptionId += 1
    searchRequest += 1
    removeMessageChannel()
    set({
      conversations: [],
      conversationParticipants: new Map(),
      messages: new Map(),
      profiles: new Map(),
      deletedMessageIds: new Set(),
      activeConversationId: null,
      loadedConversationIds: new Set(),
      messagesLoading: new Set(),
      messageLoadFailed: new Set(),
      sessionUserId: null,
      initialized: false,
      loading: false,
      error: null,
      searchQuery: '',
      searchedUsers: [],
      searching: false,
      searchError: null,
    })
  },
  setActiveConversation: (conversationId) => {
    // La carga del historial la dispara ChatDrawer cuando está abierto. Evita
    // que un clic y el effect posterior descarguen la misma conversación dos veces.
    set((state) => {
      const nextFailed = new Set(state.messageLoadFailed)
      if (conversationId) nextFailed.delete(conversationId)
      return {
        activeConversationId: conversationId,
        messageLoadFailed: nextFailed,
        error: null,
      }
    })
  },

  loadConversations: async () => {
    if (!isSupabaseConfigured) return
    const generation = sessionGeneration
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select(CHAT_CONVERSATION_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(100)
      if (!isCurrentSession(generation)) return
      if (error) throw error
      set({
        conversations: (data ?? []).map((row) =>
          mapConversation(row as ConversationRow),
        ),
        error: null,
      })
    } catch (error) {
      if (isCurrentSession(generation)) {
        set({ error: friendlyChatError(error).message })
      }
    }
  },

  loadMessages: async (conversationId) => {
    if (!isSupabaseConfigured) return
    const state = get()
    if (
      state.loadedConversationIds.has(conversationId) ||
      state.messagesLoading.has(conversationId)
    ) {
      return
    }
    const generation = sessionGeneration
    set((current) => {
      const nextLoading = new Set(current.messagesLoading)
      nextLoading.add(conversationId)
      return { messagesLoading: nextLoading, error: null }
    })
    try {
      const result = await supabase.rpc('get_conversation_messages', {
        target_conversation_id: conversationId,
        message_limit: 200,
      })
      let messageRows: MessageRow[]
      let deletedIds: Set<string>
      if (result.error) {
        if (!isMissingSnapshotRpc(result.error.message)) throw result.error
        const messageResult = await supabase
          .from('chat_messages')
          .select(CHAT_MESSAGE_COLUMNS)
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(200)
        if (messageResult.error) throw messageResult.error
        messageRows = (messageResult.data ?? []) as MessageRow[]
        const messageIds = messageRows.map((row) => row.id)
        const deletionResult = messageIds.length
          ? await supabase
              .from('chat_message_deletions')
              .select(CHAT_DELETION_COLUMNS)
              .in('message_id', messageIds)
          : { data: [], error: null }
        if (deletionResult.error) throw deletionResult.error
        deletedIds = new Set(
          ((deletionResult.data ?? []) as { message_id: string }[]).map(
            (row) => row.message_id,
          ),
        )
      } else {
        const payload = result.data as ConversationMessagesPayload | null
        if (
          !payload ||
          !Array.isArray(payload.messages) ||
          !Array.isArray(payload.deleted_message_ids)
        ) {
          throw new Error(
            'El historial de la conversación tiene un formato inválido.',
          )
        }
        messageRows = payload.messages
        deletedIds = new Set(payload.deleted_message_ids)
      }
      if (!isCurrentSession(generation)) return
      const messages =
        groupMessages(messageRows, deletedIds).get(conversationId) ?? []
      set((current) => {
        const nextMessages = new Map(current.messages)
        nextMessages.set(conversationId, messages)
        const nextDeleted = new Set(current.deletedMessageIds)
        for (const id of deletedIds) nextDeleted.add(id)
        const nextLoaded = new Set(current.loadedConversationIds)
        nextLoaded.add(conversationId)
        const nextFailed = new Set(current.messageLoadFailed)
        nextFailed.delete(conversationId)
        const nextLoading = new Set(current.messagesLoading)
        nextLoading.delete(conversationId)
        return {
          messages: nextMessages,
          deletedMessageIds: nextDeleted,
          loadedConversationIds: nextLoaded,
          messageLoadFailed: nextFailed,
          messagesLoading: nextLoading,
          error: null,
        }
      })
      await get().loadProfiles(messages.map((message) => message.sender_id))
    } catch (error) {
      if (isCurrentSession(generation)) {
        set((current) => {
          const nextLoading = new Set(current.messagesLoading)
          nextLoading.delete(conversationId)
          const nextFailed = new Set(current.messageLoadFailed)
          nextFailed.add(conversationId)
          return {
            messagesLoading: nextLoading,
            messageLoadFailed: nextFailed,
            error: friendlyChatError(error).message,
          }
        })
      }
    }
  },

  loadProfiles: async (userIds) => {
    if (!isSupabaseConfigured) return
    const uniqueIds = [...new Set(userIds.filter(Boolean))].filter(
      (id) => !get().profiles.has(id),
    )
    if (uniqueIds.length === 0) return
    const generation = sessionGeneration
    try {
      // La RPC v2 está aislada del nombre antiguo para no depender de la
      // caché de PostgREST de una versión previa de la migración.
      const result = await supabase.rpc('get_chat_user_profiles_v2', {
        profile_ids: uniqueIds,
      })
      if (result.error || !isCurrentSession(generation)) {
        if (result.error) {
          // Mantenemos compatibilidad con una base que aún no tenga la RPC v2;
          // el fallback de miembros/presencia sigue funcionando en paralelo.
          const legacy = await supabase.rpc('get_chat_user_profiles', {
            profile_ids: uniqueIds,
          })
          if (!legacy.error && isCurrentSession(generation)) {
            const legacyProfiles = (legacy.data ?? []) as ProfileRow[]
            set((state) => {
              const next = new Map(state.profiles)
              for (const row of legacyProfiles)
                next.set(row.id, mapProfile(row))
              return { profiles: next }
            })
          } else {
            console.warn(
              '[VaultAccess] No se pudieron cargar perfiles de chat:',
              result.error.message,
            )
          }
        }
        return
      }
      const profiles = (result.data ?? []) as ProfileRow[]
      set((state) => {
        const next = new Map(state.profiles)
        for (const row of profiles) next.set(row.id, mapProfile(row))
        return { profiles: next }
      })
    } catch (error) {
      // La lista de equipo y la presencia siguen permitiendo renderizar el
      // mensaje aunque la RPC de perfiles no esté disponible todavía.
      console.warn('[VaultAccess] Fallo al cargar perfiles de chat:', error)
    }
  },

  sendMessage: async (conversationId, content) => {
    if (!isSupabaseConfigured) return
    if (content.trim().length > 2000)
      throw new Error('El mensaje no puede superar 2000 caracteres.')
    const clean = sanitizeChatInput(content)
    if (!clean) return
    const generation = sessionGeneration
    try {
      const senderId = await requireUserId()
      if (!isCurrentSession(generation)) return
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          content: clean,
        })
        .select(CHAT_MESSAGE_COLUMNS)
        .single()
      if (!isCurrentSession(generation)) return
      if (error) throw error
      if (!data) return
      const message = mapMessage(data as MessageRow)
      set((state) => {
        const next = new Map(state.messages)
        const current = next.get(conversationId) ?? []
        if (current.some((item) => item.id === message.id))
          return { messages: next, error: null }
        next.set(conversationId, sortMessages([...current, message]))
        return { messages: next, error: null }
      })
    } catch (error) {
      if (!isCurrentSession(generation)) return
      const friendly = friendlyChatError(error)
      set({ error: friendly.message })
      throw friendly
    }
  },

  editMessage: async (messageId, content) => {
    if (!isSupabaseConfigured) return
    const clean = sanitizeChatInput(content)
    if (!clean) return
    const generation = sessionGeneration
    try {
      const { error } = await supabase.rpc('edit_chat_message', {
        target_message_id: messageId,
        new_content: clean,
      })
      if (error) throw error
      if (!isCurrentSession(generation)) return
      set((state) => {
        const next = new Map(state.messages)
        for (const [conversationId, list] of next) {
          next.set(
            conversationId,
            list.map((message) =>
              message.id === messageId
                ? {
                    ...message,
                    content: clean,
                    edited_at: new Date().toISOString(),
                  }
                : message,
            ),
          )
        }
        return { messages: next, error: null }
      })
    } catch (error) {
      if (isCurrentSession(generation)) {
        const friendly = friendlyChatError(error)
        set({ error: friendly.message })
        throw friendly
      }
    }
  },

  deleteMessageForMe: async (messageId) => {
    if (!isSupabaseConfigured) return
    const generation = sessionGeneration
    try {
      const { error } = await supabase.rpc('delete_chat_message_for_me', {
        target_message_id: messageId,
      })
      if (error) throw error
      if (!isCurrentSession(generation)) return
      set((state) => {
        const deletedMessageIds = new Set(state.deletedMessageIds)
        deletedMessageIds.add(messageId)
        const messages = new Map(state.messages)
        for (const [conversationId, list] of messages) {
          messages.set(
            conversationId,
            list.filter((message) => message.id !== messageId),
          )
        }
        return { messages, deletedMessageIds, error: null }
      })
    } catch (error) {
      if (isCurrentSession(generation)) {
        const friendly = friendlyChatError(error)
        set({ error: friendly.message })
        throw friendly
      }
    }
  },

  deleteMessageForEveryone: async (messageId) => {
    if (!isSupabaseConfigured) return
    const generation = sessionGeneration
    try {
      const userId = await requireUserId()
      if (!isCurrentSession(generation)) return
      const { error } = await supabase.rpc('delete_chat_message_for_everyone', {
        target_message_id: messageId,
      })
      if (error) throw error
      if (!isCurrentSession(generation)) return
      const deletedAt = new Date().toISOString()
      set((state) => {
        const messages = new Map(state.messages)
        for (const [conversationId, list] of messages) {
          messages.set(
            conversationId,
            list.map((message) =>
              message.id === messageId
                ? {
                    ...message,
                    content: '[Mensaje eliminado]',
                    deleted_at: deletedAt,
                    deleted_by: userId,
                    edited_at: null,
                  }
                : message,
            ),
          )
        }
        return { messages, error: null }
      })
    } catch (error) {
      if (isCurrentSession(generation)) {
        const friendly = friendlyChatError(error)
        set({ error: friendly.message })
        throw friendly
      }
    }
  },

  createDirectConversation: async (otherUserId) => {
    if (!isSupabaseConfigured) return null
    const generation = sessionGeneration
    try {
      const { data, error } = await supabase.rpc(
        'get_or_create_direct_conversation',
        {
          other_user_id: otherUserId,
        },
      )
      if (error) throw error
      if (!isCurrentSession(generation)) return null
      const conversationId = typeof data === 'string' ? data : null
      if (!conversationId)
        throw new Error('La conversación no tiene un identificador válido.')
      const [convRes, partRes] = await Promise.all([
        supabase
          .from('chat_conversations')
          .select(CHAT_CONVERSATION_COLUMNS)
          .eq('id', conversationId)
          .single(),
        supabase
          .from('chat_conversation_participants')
          .select(CHAT_PARTICIPANT_COLUMNS)
          .eq('conversation_id', conversationId),
      ])
      if (!isCurrentSession(generation)) return null
      if (convRes.error) throw convRes.error
      if (partRes.error) throw partRes.error
      if (!convRes.data)
        throw new Error('No se pudo cargar la conversación creada.')
      const conversation = mapConversation(convRes.data as ConversationRow)
      const participants = (partRes.data ?? []).map((row) =>
        mapParticipant(row as ParticipantRow),
      )
      set((state) => {
        const nextConversations = [
          conversation,
          ...state.conversations.filter((item) => item.id !== conversationId),
        ]
        const nextParticipants = new Map(state.conversationParticipants)
        nextParticipants.set(conversationId, participants)
        return {
          conversations: nextConversations,
          conversationParticipants: nextParticipants,
          error: null,
        }
      })
      await get().loadProfiles(
        participants.map((participant) => participant.user_id),
      )
      return conversationId
    } catch (error) {
      if (isCurrentSession(generation)) {
        set({ error: friendlyChatError(error).message })
      }
      return null
    }
  },
  searchUsers: async (query) => {
    const trimmed = query.trim()
    const request = ++searchRequest
    const generation = sessionGeneration
    if (!isSupabaseConfigured || trimmed.length < 2) {
      set({
        searchedUsers: [],
        searching: false,
        searchQuery: trimmed,
        searchError: null,
      })
      return
    }
    set({
      searching: true,
      searchQuery: trimmed,
      error: null,
      searchError: null,
    })
    try {
      const rows = await searchUsersRpc(trimmed)
      if (request !== searchRequest || !isCurrentSession(generation)) return
      const users: ChatUser[] = rows.map((row) => ({
        id: row.id,
        email: row.email,
        name: row.name || row.email || 'Usuario',
        hasName: Boolean(row.name && row.name !== row.email),
        avatarColor: row.avatar_color || '',
        isOnline: row.is_online ?? false,
        lastSeenAt: row.last_seen_at ?? undefined,
      }))
      set({ searchedUsers: users, searching: false, searchError: null })
    } catch (error) {
      if (request !== searchRequest || !isCurrentSession(generation)) return
      const message = friendlyChatError(error).message
      set({
        searchedUsers: [],
        searching: false,
        searchError: message,
      })
    }
  },

  clearSearch: () => {
    searchRequest += 1
    set({
      searchQuery: '',
      searchedUsers: [],
      searching: false,
      searchError: null,
    })
  },

  subscribeToMessages: (conversationId) => {
    if (!isSupabaseConfigured) return () => {}
    removeMessageChannel()
    const generation = sessionGeneration
    const subscriptionId = ++messageSubscriptionId
    const applyRealtimeMessage = (payload: {
      new: Record<string, unknown>
    }) => {
      if (
        !isCurrentSession(generation) ||
        subscriptionId !== messageSubscriptionId
      )
        return
      const row = payload.new as unknown as MessageRow
      if (row.conversation_id !== conversationId) return
      const message = mapMessage(row)
      set((state) => {
        if (state.deletedMessageIds.has(message.id)) return state
        const current = state.messages.get(conversationId) ?? []
        const index = current.findIndex((item) => item.id === message.id)
        const nextList =
          index >= 0
            ? current.map((item, itemIndex) =>
                itemIndex === index ? message : item,
              )
            : [...current, message]
        const next = new Map(state.messages)
        next.set(conversationId, sortMessages(nextList))
        return { messages: next }
      })
      void get().loadProfiles([message.sender_id])
    }
    const channel = supabase
      .channel(`chat-messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        applyRealtimeMessage,
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        applyRealtimeMessage,
      )
      .subscribe((status) => {
        if (
          !isCurrentSession(generation) ||
          subscriptionId !== messageSubscriptionId
        )
          return
        if (status === 'SUBSCRIBED') {
          set({ error: null })
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          set({
            error:
              'Se perdió la conexión de chat. Reintentando automáticamente.',
          })
        }
      })
    messageChannel = channel
    return () => {
      if (
        messageChannel === channel &&
        subscriptionId === messageSubscriptionId
      )
        removeMessageChannel()
    }
  },

  clearError: () => set({ error: null }),
}))

export function useChatSync() {
  const { user } = useAuth()
  const userId = user?.id
  useEffect(() => {
    const state = useChatStore.getState()
    if (!userId) {
      if (state.sessionUserId) state.reset()
      return
    }
    if (state.sessionUserId === userId) return
    // Una notificación puede seleccionar una conversación antes de que el
    // drawer lazy se monte. Ese estado pendiente se conserva; cualquier otro
    // estado pertenece a una sesión anterior y debe limpiarse.
    if (state.sessionUserId === null && state.activeConversationId) {
      useChatStore.setState({ sessionUserId: userId })
      return
    }
    state.reset()
  }, [userId])
}

export function useConversationsWithLastMessage() {
  const conversations = useChatStore((state) => state.conversations)
  const messagesMap = useChatStore((state) => state.messages)
  const participantsMap = useChatStore(
    (state) => state.conversationParticipants,
  )
  return useMemo(
    () =>
      conversations.map((conversation) => {
        const messages = messagesMap.get(conversation.id) ?? []
        return {
          ...conversation,
          lastMessage:
            messages.length > 0
              ? (messages[messages.length - 1] ?? null)
              : null,
          participants: participantsMap.get(conversation.id) ?? [],
        }
      }),
    [conversations, messagesMap, participantsMap],
  )
}

export function useActiveConversationMessages() {
  return useChatStore((state) => {
    const convId = state.activeConversationId
    if (!convId) return []
    return state.messages.get(convId) || []
  })
}

export function useActiveConversationParticipants() {
  return useChatStore((state) => {
    const convId = state.activeConversationId
    if (!convId) return []
    return state.conversationParticipants.get(convId) || []
  })
}
