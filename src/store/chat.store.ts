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

interface ChatState {
  conversations: ChatConversation[]
  conversationParticipants: Map<string, ChatConversationParticipant[]>
  messages: Map<string, ChatMessage[]>
  profiles: Map<string, ChatUser>
  deletedMessageIds: Set<string>
  activeConversationId: string | null
  loading: boolean
  error: string | null
  searchQuery: string
  searchedUsers: ChatUser[]
  searching: boolean
  searchError: string | null
  initialize: () => Promise<void>
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

function friendlyChatError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error)
  if (
    /function .*search_chat_users|search_chat_users|schema cache/i.test(message)
  ) {
    return new Error(
      'Falta la función de búsqueda del chat. Ejecuta nuevamente supabase/schema-chat-v2.sql en Supabase.',
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
  if (/row-level security|permission denied/i.test(message)) {
    return new Error(
      'Supabase bloqueó el chat. Verifica las políticas RLS de schema-chat.sql.',
    )
  }
  if (/failed to fetch|network/i.test(message)) {
    return new Error('No se pudo conectar con Supabase para usar el chat.')
  }
  return error instanceof Error ? error : new Error(message)
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

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  conversationParticipants: new Map(),
  messages: new Map(),
  profiles: new Map(),
  deletedMessageIds: new Set(),
  activeConversationId: null,
  loading: false,
  error: null,
  searchQuery: '',
  searchedUsers: [],
  searching: false,
  searchError: null,

  initialize: async () => {
    if (!isSupabaseConfigured) {
      set({ loading: false })
      return
    }
    const generation = sessionGeneration
    set({ loading: true, error: null })
    try {
      await requireUserId()
      if (!isCurrentSession(generation)) return
      const [convRes, partRes, msgRes, deletionRes] = await Promise.all([
        supabase
          .from('chat_conversations')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('chat_conversation_participants')
          .select('*')
          .order('created_at', { ascending: true }),
        supabase
          .from('chat_messages')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.from('chat_message_deletions').select('message_id'),
      ])
      if (!isCurrentSession(generation)) return
      const firstError =
        convRes.error ?? partRes.error ?? msgRes.error ?? deletionRes.error
      if (firstError) throw firstError

      const deletedMessageIds = new Set(
        ((deletionRes.data ?? []) as { message_id: string }[]).map(
          (row) => row.message_id,
        ),
      )

      const conversations = (convRes.data ?? []).map((row) =>
        mapConversation(row as ConversationRow),
      )
      const participants = new Map<string, ChatConversationParticipant[]>()
      for (const row of (partRes.data ?? []) as ParticipantRow[]) {
        const list = participants.get(row.conversation_id) ?? []
        list.push(mapParticipant(row))
        participants.set(row.conversation_id, list)
      }
      const messages = new Map<string, ChatMessage[]>()
      for (const row of (msgRes.data ?? []) as MessageRow[]) {
        if (deletedMessageIds.has(row.id)) continue
        const list = messages.get(row.conversation_id) ?? []
        list.push(mapMessage(row))
        messages.set(row.conversation_id, list)
      }
      for (const [conversationId, list] of messages)
        messages.set(conversationId, sortMessages(list))
      if (!isCurrentSession(generation)) return
      set({
        conversations,
        conversationParticipants: participants,
        messages,
        deletedMessageIds,
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
      loading: false,
      error: null,
      searchQuery: '',
      searchedUsers: [],
      searching: false,
      searchError: null,
    })
  },
  setActiveConversation: (conversationId) => {
    set({ activeConversationId: conversationId, error: null })
    if (conversationId) void get().loadMessages(conversationId)
  },

  loadConversations: async () => {
    if (!isSupabaseConfigured) return
    const generation = sessionGeneration
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
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
    const generation = sessionGeneration
    try {
      const [messageResult, deletionResult] = await Promise.all([
        supabase
          .from('chat_messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })
          .limit(200),
        supabase.from('chat_message_deletions').select('message_id'),
      ])
      if (!isCurrentSession(generation)) return
      if (messageResult.error) throw messageResult.error
      if (deletionResult.error) throw deletionResult.error
      const deletedIds = new Set(
        ((deletionResult.data ?? []) as { message_id: string }[]).map(
          (row) => row.message_id,
        ),
      )
      const messages = sortMessages(
        ((messageResult.data ?? []) as MessageRow[])
          .filter((row) => !deletedIds.has(row.id))
          .map((row) => mapMessage(row)),
      )
      set((state) => {
        const next = new Map(state.messages)
        const nextDeleted = new Set(state.deletedMessageIds)
        for (const id of deletedIds) nextDeleted.add(id)
        next.set(conversationId, messages)
        return { messages: next, deletedMessageIds: nextDeleted, error: null }
      })
      // Los remitentes pueden no estar todavía en conversationParticipants al
      // abrir una conversación existente; cargarlos desde los mensajes evita
      // mostrar temporalmente "Usuario".
      await get().loadProfiles(messages.map((message) => message.sender_id))
    } catch (error) {
      if (isCurrentSession(generation)) {
        set({ error: friendlyChatError(error).message })
      }
    }
  },

  loadProfiles: async (userIds) => {
    if (!isSupabaseConfigured) return
    const uniqueIds = [...new Set(userIds.filter(Boolean))]
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
              '[WorkVault] No se pudieron cargar perfiles de chat:',
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
      console.warn('[WorkVault] Fallo al cargar perfiles de chat:', error)
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
        .select('*')
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
          .select('*')
          .eq('id', conversationId)
          .single(),
        supabase
          .from('chat_conversation_participants')
          .select('*')
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
      const { data, error } = await supabase.rpc('search_chat_users', {
        search_term: trimmed,
        limit_count: 20,
      })
      if (error) throw error
      if (request !== searchRequest || !isCurrentSession(generation)) return
      const users: ChatUser[] = ((data ?? []) as SearchUserRow[]).map(
        (row) => ({
          id: row.id,
          email: row.email,
          name: row.name || row.email || 'Usuario',
          hasName: Boolean(row.name && row.name !== row.email),
          avatarColor: row.avatar_color || '',
          isOnline: row.is_online ?? false,
          lastSeenAt: row.last_seen_at ?? undefined,
        }),
      )
      set({ searchedUsers: users, searching: false, searchError: null })
    } catch (error) {
      if (request !== searchRequest || !isCurrentSession(generation)) return
      const message = friendlyChatError(error).message
      set({
        searchedUsers: [],
        searching: false,
        error: message,
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
    const chat = useChatStore.getState()
    chat.reset()
    if (userId) void chat.initialize()
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
