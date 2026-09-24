import { useEffect } from 'react'
import { create } from 'zustand'
import { useAuth } from '@/app/auth-context'
import { isSupabaseConfigured, requireUserId, supabase } from '@/lib/supabase'
import type { ChatNotification } from '@/types/chat'

type NotificationRow = ChatNotification

interface NotificationState {
  notifications: ChatNotification[]
  unreadCount: number
  loading: boolean
  error: string | null
  load: () => Promise<void>
  markAllRead: () => Promise<void>
  markRead: (notificationId: string) => Promise<void>
  markConversationRead: (conversationId: string) => Promise<void>
  reset: () => void
}

let notificationChannel: ReturnType<typeof supabase.channel> | null = null
let notificationGeneration = 0

function mapNotification(row: NotificationRow): ChatNotification {
  return {
    id: row.id,
    recipient_id: row.recipient_id,
    actor_id: row.actor_id,
    conversation_id: row.conversation_id,
    message_id: row.message_id,
    workspace_id: row.workspace_id,
    kind: row.kind,
    preview: row.preview,
    created_at: row.created_at,
    read_at: row.read_at,
  }
}

function removeNotificationChannel() {
  if (!notificationChannel) return
  supabase.removeChannel(notificationChannel)
  notificationChannel = null
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,

  load: async () => {
    if (!isSupabaseConfigured) return
    const generation = notificationGeneration
    set({ loading: true, error: null })
    try {
      const userId = await requireUserId()
      if (generation !== notificationGeneration) return
      const { data, error } = await supabase
        .from('chat_notifications')
        .select('*')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (generation !== notificationGeneration) return
      if (error) throw error
      const notifications = ((data ?? []) as NotificationRow[]).map(
        mapNotification,
      )
      set({
        notifications,
        unreadCount: notifications.filter((item) => !item.read_at).length,
        loading: false,
        error: null,
      })
    } catch (error) {
      if (generation !== notificationGeneration) return
      set({
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : 'No se pudieron cargar las notificaciones',
      })
    }
  },

  markAllRead: async () => {
    if (!isSupabaseConfigured) return
    const generation = notificationGeneration
    try {
      const userId = await requireUserId()
      if (generation !== notificationGeneration) return
      const { error } = await supabase
        .from('chat_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('recipient_id', userId)
        .is('read_at', null)
      if (error) throw error
      if (generation !== notificationGeneration) return
      set((state) => ({
        notifications: state.notifications.map((item) => ({
          ...item,
          read_at: item.read_at ?? new Date().toISOString(),
        })),
        unreadCount: 0,
      }))
    } catch {
      // La UI conserva el estado local si la red falla.
    }
  },

  markRead: async (notificationId) => {
    if (!isSupabaseConfigured) return
    const generation = notificationGeneration
    const readAt = new Date().toISOString()
    try {
      const { error } = await supabase
        .from('chat_notifications')
        .update({ read_at: readAt })
        .eq('id', notificationId)
        .is('read_at', null)
      if (error) throw error
      if (generation !== notificationGeneration) return
      set((state) => {
        const wasUnread = state.notifications.some(
          (item) => item.id === notificationId && !item.read_at,
        )
        return {
          notifications: state.notifications.map((item) =>
            item.id === notificationId ? { ...item, read_at: readAt } : item,
          ),
          unreadCount: wasUnread
            ? Math.max(0, state.unreadCount - 1)
            : state.unreadCount,
        }
      })
    } catch {
      // La lista seguirá visible aunque el servidor no responda.
    }
  },

  markConversationRead: async (conversationId) => {
    if (!isSupabaseConfigured) return
    const generation = notificationGeneration
    try {
      const userId = await requireUserId()
      if (generation !== notificationGeneration) return
      const readAt = new Date().toISOString()
      const { error } = await supabase
        .from('chat_notifications')
        .update({ read_at: readAt })
        .eq('recipient_id', userId)
        .eq('conversation_id', conversationId)
        .is('read_at', null)
      if (error) throw error
      if (generation !== notificationGeneration) return
      set((state) => ({
        notifications: state.notifications.map((item) =>
          item.conversation_id === conversationId
            ? { ...item, read_at: item.read_at ?? readAt }
            : item,
        ),
        unreadCount: state.notifications.filter(
          (item) => item.conversation_id !== conversationId && !item.read_at,
        ).length,
      }))
    } catch {
      // La lectura de una conversación no debe bloquear el chat.
    }
  },

  reset: () => {
    notificationGeneration += 1
    removeNotificationChannel()
    set({ notifications: [], unreadCount: 0, loading: false, error: null })
  },
}))

/** Carga y suscribe notificaciones mientras la sesión está activa. */
export function useNotificationSync() {
  const { user } = useAuth()
  const userId = user?.id
  useEffect(() => {
    const store = useNotificationStore.getState()
    store.reset()
    if (!userId) return
    void store.load()
    const channel = supabase
      .channel(`chat-notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const notification = mapNotification(payload.new as NotificationRow)
          useNotificationStore.setState((state) => ({
            notifications: [notification, ...state.notifications].slice(0, 50),
            unreadCount: state.unreadCount + 1,
          }))
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const updated = mapNotification(payload.new as NotificationRow)
          useNotificationStore.setState((state) => ({
            notifications: state.notifications.map((item) =>
              item.id === updated.id ? updated : item,
            ),
            unreadCount: state.notifications.filter(
              (item) => item.id !== updated.id && !item.read_at,
            ).length,
          }))
        },
      )
      .subscribe()
    notificationChannel = channel
    return () => {
      if (notificationChannel === channel) removeNotificationChannel()
    }
  }, [userId])
}
