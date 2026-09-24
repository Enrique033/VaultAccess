import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '@/app/auth-context'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type { ChatUser } from '@/types/chat'

export const GLOBAL_PRESENCE_CHANNEL = 'online-users'

interface PresenceMeta {
  user_id?: string
  name?: string
  online?: boolean
  last_seen_at?: string
}

export interface PresenceValue {
  users: Map<string, ChatUser>
  isOnline: (userId: string) => boolean
  /** `null` mientras la RPC no autoriza al usuario o cuando no es el owner global. */
  globalOnline: number | null
  isGlobalOwner: boolean
}

/** El color nunca se toma de HTML: es un valor visual generado de forma determinista. */
export function getAvatarColor(value: string): string {
  const colors = [
    '#6366F1',
    '#8B5CF6',
    '#EC4444',
    '#F59E0B',
    '#10B981',
    '#3B82F6',
    '#EC4899',
  ]
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return colors[hash % colors.length] ?? colors[0]!
}

function readPresence(
  channel: ReturnType<typeof supabase.channel>,
): Map<string, ChatUser> {
  const state = channel.presenceState<PresenceMeta>()
  const users = new Map<string, ChatUser>()
  Object.values(state).forEach((metas) => {
    if (!Array.isArray(metas)) return
    metas.forEach((meta) => {
      if (!meta?.user_id || meta.online === false) return
      const name = meta.name?.trim() || 'Usuario'
      users.set(meta.user_id, {
        id: meta.user_id,
        email: null,
        name,
        hasName: true,
        avatarColor: getAvatarColor(meta.user_id),
        isOnline: true,
        lastSeenAt: meta.last_seen_at,
      })
    })
  })
  return users
}

/**
 * Presencia global de la plataforma. El contador global no se calcula ni se
 * entrega a la interfaz hasta que `is_global_owner()` lo autoriza en Supabase.
 * La UI nunca decide el permiso con el email que viene en el bundle.
 */
export function usePresence(): PresenceValue {
  const { user } = useAuth()
  const [users, setUsers] = useState<Map<string, ChatUser>>(() => new Map())
  const [isGlobalOwner, setIsGlobalOwner] = useState(false)
  const [globalOwnerUserId, setGlobalOwnerUserId] = useState<string | null>(
    null,
  )
  const userId = user?.id
  const metadata = user?.user_metadata
  const firstName =
    typeof metadata?.first_name === 'string' ? metadata.first_name.trim() : ''
  const lastName =
    typeof metadata?.last_name === 'string' ? metadata.last_name.trim() : ''
  const fullName =
    typeof metadata?.full_name === 'string' ? metadata.full_name.trim() : ''
  const profileName =
    typeof metadata?.name === 'string' ? metadata.name.trim() : ''
  const displayName =
    [firstName, lastName].filter(Boolean).join(' ') ||
    fullName ||
    profileName ||
    user?.email?.split('@')[0] ||
    'Usuario'

  useEffect(() => {
    if (!isSupabaseConfigured || !userId) {
      setUsers(new Map())
      setIsGlobalOwner(false)
      setGlobalOwnerUserId(null)
      return
    }

    let disposed = false
    const channel = supabase.channel(GLOBAL_PRESENCE_CHANNEL)
    const update = () => {
      if (!disposed) setUsers(readPresence(channel))
    }

    channel
      .on('presence', { event: 'sync' }, update)
      .on('presence', { event: 'join' }, update)
      .on('presence', { event: 'leave' }, update)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void channel.track({
            online: true,
            user_id: userId,
            name: displayName,
            last_seen_at: new Date().toISOString(),
          })
        }
      })

    void supabase.rpc('is_global_owner').then(
      ({ data, error }) => {
        if (disposed) return
        const authorized = !error && data === true
        setIsGlobalOwner(authorized)
        setGlobalOwnerUserId(authorized ? userId : null)
      },
      () => {
        if (!disposed) {
          setIsGlobalOwner(false)
          setGlobalOwnerUserId(null)
        }
      },
    )

    return () => {
      disposed = true
      void channel.untrack()
      supabase.removeChannel(channel)
    }
  }, [displayName, userId])

  const authorizedGlobalOwner = Boolean(
    userId && isGlobalOwner && globalOwnerUserId === userId,
  )

  return {
    users,
    isOnline: (userId) => users.has(userId),
    globalOnline: authorizedGlobalOwner ? users.size : null,
    isGlobalOwner: authorizedGlobalOwner,
  }
}

const PresenceContext = createContext<PresenceValue | null>(null)

export function PresenceProvider({ children }: { children: ReactNode }) {
  const value = usePresence()
  return createElement(PresenceContext.Provider, { value }, children)
}

export function usePresenceContext(): PresenceValue {
  const value = useContext(PresenceContext)
  if (!value)
    throw new Error('usePresenceContext debe usarse dentro de PresenceProvider')
  return value
}
