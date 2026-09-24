import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '@/app/auth-context'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { getAvatarColor } from '@/lib/avatar'
import type { ChatUser } from '@/types/chat'

const HEARTBEAT_MS = 30_000
const LEGACY_CHANNEL = 'online-users'

export interface PresenceValue {
  users: Map<string, ChatUser>
  isOnline: (userId: string) => boolean
  globalOnline: number | null
  isGlobalOwner: boolean
  /** Actualiza solo los usuarios visibles cuando el chat/equipo está abierto. */
  refreshPresence: (userIds: string[]) => Promise<void>
}

function isMissingRpc(message: string): boolean {
  return /PGRST202|schema cache|function .*does not exist|could not find the function/i.test(
    message,
  )
}

function readLegacy(
  channel: ReturnType<typeof supabase.channel>,
): PresenceValue['users'] {
  const users: PresenceValue['users'] = new Map()
  for (const metas of Object.values(
    channel.presenceState<{
      user_id?: string
      name?: string
      online?: boolean
      last_seen_at?: string
    }>(),
  )) {
    if (!Array.isArray(metas)) continue
    for (const meta of metas) {
      if (!meta?.user_id || meta.online === false) continue
      users.set(meta.user_id, {
        id: meta.user_id,
        email: null,
        name: meta.name?.trim() || 'Usuario',
        hasName: true,
        avatarColor: getAvatarColor(meta.user_id),
        isOnline: true,
        lastSeenAt: meta.last_seen_at,
      })
    }
  }
  return users
}

export function usePresence(): PresenceValue {
  const { user } = useAuth()
  const [users, setUsers] = useState<PresenceValue['users']>(() => new Map())
  const [owner, setOwner] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const [mode, setMode] = useState<'checking' | 'heartbeat' | 'legacy'>(
    'checking',
  )
  const userId = user?.id
  const meta = user?.user_metadata
  const name =
    [
      typeof meta?.first_name === 'string' ? meta.first_name.trim() : '',
      typeof meta?.last_name === 'string' ? meta.last_name.trim() : '',
    ]
      .filter(Boolean)
      .join(' ') ||
    (typeof meta?.full_name === 'string' ? meta.full_name.trim() : '') ||
    (typeof meta?.name === 'string' ? meta.name.trim() : '') ||
    user?.email?.split('@')[0] ||
    'Usuario'

  useEffect(() => {
    setUsers(new Map())
    setOwner(false)
    setCount(null)
    setMode('checking')
    if (!isSupabaseConfigured || !userId) return

    let disposed = false
    let legacyStarted = false
    const channel = supabase.channel(LEGACY_CHANNEL)
    const startLegacy = () => {
      if (disposed || legacyStarted) return
      legacyStarted = true
      setMode('legacy')
      const update = () => {
        if (!disposed) setUsers(readLegacy(channel))
      }
      channel
        .on('presence', { event: 'sync' }, update)
        .on('presence', { event: 'join' }, update)
        .on('presence', { event: 'leave' }, update)
        .subscribe((status) => {
          if (status !== 'SUBSCRIBED') return
          void channel.track({
            online: true,
            user_id: userId,
            name,
            last_seen_at: new Date().toISOString(),
          })
        })
    }
    const checkOwner = async () => {
      const result = await supabase.rpc('is_global_owner')
      if (!disposed) setOwner(!result.error && result.data === true)
    }
    const touch = async () => {
      const result = await supabase.rpc('touch_user_presence')
      if (disposed) return
      if (result.error) {
        if (isMissingRpc(result.error.message)) startLegacy()
        return
      }
      setMode('heartbeat')
      setUsers((current) => {
        const next = new Map(current)
        next.set(userId, {
          id: userId,
          email: user?.email ?? null,
          name,
          hasName: true,
          avatarColor: getAvatarColor(userId),
          isOnline: true,
          lastSeenAt: new Date().toISOString(),
        })
        return next
      })
    }

    void checkOwner()
    void touch()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void touch()
    }, HEARTBEAT_MS)
    const visible = () => {
      if (document.visibilityState !== 'visible') return
      void checkOwner()
      void touch()
    }
    document.addEventListener('visibilitychange', visible)
    return () => {
      disposed = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', visible)
      if (legacyStarted) {
        void channel.untrack()
        supabase.removeChannel(channel)
      }
    }
  }, [name, user?.email, userId])

  useEffect(() => {
    if (mode !== 'heartbeat' || !owner) return
    let disposed = false
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return
      const result = await supabase.rpc('get_global_presence_count')
      if (disposed || result.error) return
      setCount(
        typeof result.data === 'number'
          ? result.data
          : Number(result.data ?? 0),
      )
    }
    void refresh()
    const timer = window.setInterval(refresh, HEARTBEAT_MS)
    const visible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', visible)
    return () => {
      disposed = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [mode, owner])

  const refreshPresence = useCallback(
    async (requestedIds: string[]) => {
      if (mode !== 'heartbeat' || !userId) return
      const ids = [...new Set(requestedIds.filter(Boolean))].slice(0, 200)
      if (ids.length === 0) return
      const result = await supabase.rpc('get_presence_snapshot', {
        profile_ids: ids,
      })
      if (result.error) return
      const rows = (result.data ?? []) as Array<{
        user_id: string
        is_online: boolean
        last_seen_at: string | null
      }>
      setUsers((current) => {
        const next = new Map(current)
        for (const id of ids) {
          if (id !== userId) next.delete(id)
        }
        for (const row of rows) {
          if (!row.is_online) continue
          const previous = next.get(row.user_id)
          next.set(row.user_id, {
            id: row.user_id,
            email: previous?.email ?? null,
            name: previous?.name ?? 'Usuario',
            hasName: previous?.hasName ?? true,
            avatarColor: previous?.avatarColor ?? getAvatarColor(row.user_id),
            isOnline: true,
            lastSeenAt: row.last_seen_at ?? undefined,
          })
        }
        return next
      })
    },
    [mode, userId],
  )

  return {
    users,
    isOnline: (id) => users.has(id),
    globalOnline: owner ? (mode === 'legacy' ? users.size : count) : null,
    isGlobalOwner: owner,
    refreshPresence,
  }
}

const PresenceContext = createContext<PresenceValue | null>(null)
export function PresenceProvider({ children }: { children: ReactNode }) {
  const value = usePresence()
  return createElement(PresenceContext.Provider, { value }, children)
}
export function usePresenceContext(): PresenceValue {
  const value = useContext(PresenceContext)
  if (!value) throw new Error('Presencia fuera de PresenceProvider')
  return value
}
