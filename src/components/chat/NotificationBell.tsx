import { useEffect } from 'react'
import { Bell, MessageCircle, Users2 } from 'lucide-react'
import { useNavigate } from 'react-router'
import {
  DropdownMenu,
  DropdownMenuSeparator,
} from '@/components/ui/DropdownMenu'
import { Button } from '@/components/ui/Button'
import { useChatStore } from '@/store/chat.store'
import { useNotificationStore } from '@/store/notification.store'
import { useWorkspaceStore } from '@/store/workspace.store'
import { useUIStore } from '@/store/ui.store'
import { cn } from '@/lib/utils'

const timeFormatter = new Intl.DateTimeFormat('es-ES', {
  hour: '2-digit',
  minute: '2-digit',
})

export function NotificationBell() {
  const navigate = useNavigate()
  const notifications = useNotificationStore((state) => state.notifications)
  const unreadCount = useNotificationStore((state) => state.unreadCount)
  const markAllRead = useNotificationStore((state) => state.markAllRead)
  const markRead = useNotificationStore((state) => state.markRead)
  const profiles = useChatStore((state) => state.profiles)
  const loadProfiles = useChatStore((state) => state.loadProfiles)
  const members = useWorkspaceStore((state) => state.members)
  const setActiveConversation = useChatStore(
    (state) => state.setActiveConversation,
  )
  const setChatOpen = useUIStore((state) => state.setChatOpen)

  useEffect(() => {
    const actorIds = notifications.flatMap((notification) =>
      notification.actor_id ? [notification.actor_id] : [],
    )
    void loadProfiles(actorIds)
  }, [loadProfiles, notifications])

  const openNotification = (
    notificationId: string,
    conversationId: string | null,
    workspaceId: string | null,
  ) => {
    void markRead(notificationId)
    if (conversationId) {
      setActiveConversation(conversationId)
      setChatOpen(true)
    } else if (workspaceId) {
      navigate('/workspaces')
    }
  }

  return (
    <DropdownMenu
      align="end"
      onOpenChange={(open) => {
        if (open) void markAllRead()
      }}
      trigger={
        <span className="relative inline-flex size-5 items-center justify-center">
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-2 -top-2 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-4 text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </span>
      }
    >
      <div className="w-[min(360px,calc(100vw-1.5rem))]">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <p className="text-xs font-semibold text-foreground">
            Notificaciones
          </p>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => void markAllRead()}
            >
              Marcar leídas
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-[min(420px,60vh)] overflow-y-auto p-1">
          {notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted">
              No tienes notificaciones pendientes.
            </p>
          ) : (
            notifications.map((notification) => {
              const actor = notification.actor_id
                ? profiles.get(notification.actor_id)
                : undefined
              const actorMember = notification.actor_id
                ? members.find(
                    (member) => member.userId === notification.actor_id,
                  )
                : undefined
              const Icon =
                notification.kind === 'message' ? MessageCircle : Users2
              const title =
                notification.kind === 'message'
                  ? `${actorMember?.displayName || actor?.name || 'Usuario'} envió un mensaje`
                  : `${actorMember?.displayName || actor?.name || 'El propietario'} actualizó el equipo`
              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() =>
                    openNotification(
                      notification.id,
                      notification.conversation_id,
                      notification.workspace_id,
                    )
                  }
                  className={cn(
                    'flex w-full gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-elevated',
                    !notification.read_at && 'bg-primary/5',
                  )}
                >
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-foreground">
                      {title}
                    </span>
                    {notification.preview && (
                      <span className="mt-0.5 block truncate text-[11px] text-muted">
                        {notification.preview}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-[9px] text-muted">
                    {timeFormatter.format(new Date(notification.created_at))}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </DropdownMenu>
  )
}
