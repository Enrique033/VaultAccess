import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Loader2,
  MessageCircle,
  MoreVertical,
  Pencil,
  Search,
  Send,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '@/app/auth-context'
import { isSupabaseConfigured } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/DropdownMenu'
import { SearchInput } from '@/components/ui/SearchInput'
import { Textarea } from '@/components/ui/Textarea'
import { Skeleton } from '@/components/ui/Skeleton'
import { getAvatarColor } from '@/lib/avatar'
import { usePresenceContext } from '@/hooks/usePresence'
import {
  useChatStore,
  useConversationsWithLastMessage,
} from '@/store/chat.store'
import { useUIStore, toast } from '@/store/ui.store'
import { useNotificationStore } from '@/store/notification.store'
import { useWorkspaceStore } from '@/store/workspace.store'
import type { ChatMessage, ChatUser } from '@/types/chat'
import type { WorkspaceMember } from '@/types'

const timeFormatter = new Intl.DateTimeFormat('es-ES', {
  hour: '2-digit',
  minute: '2-digit',
})

function formatTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : timeFormatter.format(date)
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? '')
      .join('')
      .toUpperCase() || '?'
  )
}

interface PersonRowProps {
  id: string
  name: string
  email: string | null
  avatarColor: string
  online: boolean
  disabled?: boolean
  busy?: boolean
  onClick?: () => void
  trailingLabel?: string
}

function PersonRow({
  id,
  name,
  email,
  avatarColor,
  online,
  disabled = false,
  busy = false,
  onClick,
  trailingLabel,
}: PersonRowProps) {
  return (
    <button
      type="button"
      data-user-id={id}
      disabled={disabled || !onClick}
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-all hover:border-border hover:bg-elevated disabled:cursor-default disabled:opacity-60 enabled:hover:border-primary/20 enabled:hover:bg-primary-soft/60"
    >
      <span className="relative shrink-0">
        <span
          className="flex size-9 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: avatarColor }}
          aria-hidden="true"
        >
          {initials(name)}
        </span>
        <span
          className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface ${online ? 'bg-emerald-500' : 'bg-muted'}`}
          aria-label={online ? 'Activo' : 'Desconectado'}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-foreground">
          {name}
        </span>
        {email && email !== name && (
          <span className="block truncate text-[11px] text-muted">{email}</span>
        )}
      </span>
      {busy ? (
        <Loader2 className="size-3.5 animate-spin text-primary" />
      ) : trailingLabel ? (
        <span className="text-[11px] text-muted">{trailingLabel}</span>
      ) : (
        <ChevronRight className="size-3.5 -translate-x-1 text-muted opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
      )}
    </button>
  )
}

function memberToChatUser(
  member: WorkspaceMember,
  profile: ChatUser | undefined,
  isOnline: boolean,
): ChatUser {
  const id = member.userId ?? member.displayName
  return {
    id,
    email: member.email,
    name: profile?.name || member.displayName,
    hasName: member.displayName !== member.email,
    avatarColor: profile?.avatarColor || getAvatarColor(id),
    isOnline,
    lastSeenAt: profile?.lastSeenAt,
  }
}

export function ChatDrawer() {
  const { user } = useAuth()
  const open = useUIStore((state) => state.chatOpen)
  const setOpen = useUIStore((state) => state.setChatOpen)
  const workspaces = useWorkspaceStore((state) => state.workspaces)
  const members = useWorkspaceStore((state) => state.members)
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeId)
  const { users: onlineUsers, isOnline, refreshPresence } = usePresenceContext()
  const conversations = useConversationsWithLastMessage()
  const activeConversationId = useChatStore(
    (state) => state.activeConversationId,
  )
  const setActiveConversation = useChatStore(
    (state) => state.setActiveConversation,
  )
  const messagesByConversation = useChatStore((state) => state.messages)
  const profiles = useChatStore((state) => state.profiles)
  const participantsByConversation = useChatStore(
    (state) => state.conversationParticipants,
  )
  const loadMessages = useChatStore((state) => state.loadMessages)
  const loadProfiles = useChatStore((state) => state.loadProfiles)
  const sendMessage = useChatStore((state) => state.sendMessage)
  const editMessage = useChatStore((state) => state.editMessage)
  const deleteMessageForMe = useChatStore((state) => state.deleteMessageForMe)
  const deleteMessageForEveryone = useChatStore(
    (state) => state.deleteMessageForEveryone,
  )
  const createDirectConversation = useChatStore(
    (state) => state.createDirectConversation,
  )
  const searchUsers = useChatStore((state) => state.searchUsers)
  const searchedUsers = useChatStore((state) => state.searchedUsers)
  const searching = useChatStore((state) => state.searching)
  const clearSearch = useChatStore((state) => state.clearSearch)
  const searchError = useChatStore((state) => state.searchError)
  const subscribeToMessages = useChatStore((state) => state.subscribeToMessages)
  const chatError = useChatStore((state) => state.error)
  const loading = useChatStore((state) => state.loading)
  const initializeChat = useChatStore((state) => state.initialize)
  const chatInitialized = useChatStore((state) => state.initialized)
  const chatLoading = useChatStore((state) => state.loading)
  const loadedConversationIds = useChatStore(
    (state) => state.loadedConversationIds,
  )
  const messagesLoading = useChatStore((state) => state.messagesLoading)
  const messageLoadFailed = useChatStore((state) => state.messageLoadFailed)
  const activeMessageLoading = activeConversationId
    ? messagesLoading.has(activeConversationId)
    : false
  const markConversationRead = useNotificationStore(
    (state) => state.markConversationRead,
  )

  const [tab, setTab] = useState<'team' | 'search'>('team')
  const [searchInput, setSearchInput] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    scope: 'me' | 'everyone'
  } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatInitializationRequested = useRef<string | null>(null)

  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null
  const activeMessages = useMemo(
    () =>
      activeConversationId
        ? (messagesByConversation.get(activeConversationId) ?? [])
        : [],
    [activeConversationId, messagesByConversation],
  )
  const activeParticipants = useMemo(
    () =>
      activeConversationId
        ? (participantsByConversation.get(activeConversationId) ?? [])
        : [],
    [activeConversationId, participantsByConversation],
  )
  const partnerId = activeParticipants.find(
    (participant) => participant.user_id !== user?.id,
  )?.user_id
  const partner = partnerId
    ? (profiles.get(partnerId) ?? onlineUsers.get(partnerId))
    : undefined
  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  )
  const conversationTitle =
    activeConversation?.team_id === activeWorkspace?.id
      ? activeWorkspace?.name || 'Equipo'
      : partner?.name || 'Conversación privada'
  const teamMembers = useMemo(
    () =>
      members.filter(
        (member) => member.workspaceId === activeWorkspaceId && member.userId,
      ),
    [activeWorkspaceId, members],
  )
  const visiblePresenceIds = useMemo(
    () =>
      [
        ...new Set([
          ...teamMembers.flatMap((member) =>
            member.userId ? [member.userId] : [],
          ),
          ...activeParticipants.map((participant) => participant.user_id),
          ...[...profiles.keys()],
          ...searchedUsers.map((searched) => searched.id),
        ]),
      ].slice(0, 200),
    [activeParticipants, profiles, searchedUsers, teamMembers],
  )
  const presenceKey = visiblePresenceIds.join(',')
  const teamOnline =
    user &&
    activeWorkspace &&
    (activeWorkspace.ownerId === user.id ||
      teamMembers.some(
        (member) => member.userId === user.id && member.role === 'owner',
      ))
      ? teamMembers.filter((member) => member.userId && isOnline(member.userId))
          .length
      : 0
  const isTeamOwner = Boolean(
    user &&
    activeWorkspace &&
    (activeWorkspace.ownerId === user.id ||
      teamMembers.some(
        (member) => member.userId === user.id && member.role === 'owner',
      )),
  )

  const recentConversations = useMemo(
    () =>
      [...conversations].sort((a, b) =>
        (b.lastMessage?.created_at ?? b.created_at).localeCompare(
          a.lastMessage?.created_at ?? a.created_at,
        ),
      ),
    [conversations],
  )
  const getConversationTitle = (
    conversation: (typeof conversations)[number],
  ) => {
    if (conversation.team_id) {
      return (
        workspaces.find((workspace) => workspace.id === conversation.team_id)
          ?.name ?? 'Equipo'
      )
    }
    const otherId = conversation.participants.find(
      (participant) => participant.user_id !== user?.id,
    )?.user_id
    return otherId
      ? (profiles.get(otherId)?.name ??
          onlineUsers.get(otherId)?.name ??
          'Conversación privada')
      : 'Conversación privada'
  }
  const getConversationUserId = (
    conversation: (typeof conversations)[number],
  ) =>
    conversation.participants.find(
      (participant) => participant.user_id !== user?.id,
    )?.user_id
  const isConversationOnline = (
    conversation: (typeof conversations)[number],
  ) => {
    const otherId = getConversationUserId(conversation)
    return otherId ? isOnline(otherId) : false
  }

  const getConversationPreview = (
    conversation: (typeof conversations)[number],
  ) => {
    const lastMessage = conversation.lastMessage
    if (!lastMessage) return 'Aún no hay mensajes'
    if (lastMessage.deleted_at) return 'Mensaje eliminado'
    return lastMessage.sender_id === user?.id
      ? `Tú: ${lastMessage.content}`
      : lastMessage.content
  }
  const safeSearchError =
    typeof searchError === 'string' && searchError.trim()
      ? searchError
      : searchError
        ? 'No se pudo completar la búsqueda de personas.'
        : null
  const safeChatError =
    typeof chatError === 'string' && chatError.trim()
      ? chatError
      : chatError
        ? 'No se pudo completar la operación del chat.'
        : null

  useEffect(() => {
    if (!open || !presenceKey) return
    const ids = presenceKey.split(',').filter(Boolean)
    void refreshPresence(ids)
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshPresence(ids)
    }, 30_000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refreshPresence(ids)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [open, presenceKey, refreshPresence])

  useEffect(() => {
    chatInitializationRequested.current = null
  }, [user?.id])

  useEffect(() => {
    if (!open) {
      chatInitializationRequested.current = null
      return
    }
    if (
      !user?.id ||
      chatInitialized ||
      chatLoading ||
      chatInitializationRequested.current === user.id
    ) {
      return
    }
    chatInitializationRequested.current = user.id
    void initializeChat(user.id)
  }, [chatInitialized, chatLoading, initializeChat, open, user?.id])

  useEffect(() => {
    if (!open || !chatInitialized || !activeConversationId) return
    if (
      loadedConversationIds.has(activeConversationId) ||
      messagesLoading.has(activeConversationId) ||
      messageLoadFailed.has(activeConversationId)
    ) {
      return
    }
    void loadMessages(activeConversationId)
  }, [
    activeConversationId,
    chatInitialized,
    loadedConversationIds,
    loadMessages,
    messageLoadFailed,
    messagesLoading,
    open,
  ])

  useEffect(() => {
    if (!open || !chatInitialized || !activeConversationId) return
    return subscribeToMessages(activeConversationId)
  }, [activeConversationId, chatInitialized, open, subscribeToMessages])

  useEffect(() => {
    if (!activeConversationId) return
    const profileIds = activeParticipants.map(
      (participant) => participant.user_id,
    )
    void loadProfiles(profileIds)
  }, [activeConversationId, activeParticipants, loadProfiles])

  useEffect(() => {
    if (activeMessages.length === 0) return
    void loadProfiles(activeMessages.map((message) => message.sender_id))
  }, [activeMessages, loadProfiles])

  useEffect(() => {
    if (!open || !activeConversationId) return
    void markConversationRead(activeConversationId)
  }, [activeConversationId, markConversationRead, open])

  useEffect(() => {
    const teamProfileIds = teamMembers.flatMap((member) =>
      member.userId ? [member.userId] : [],
    )
    void loadProfiles(teamProfileIds)
  }, [loadProfiles, teamMembers])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages.length, open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, setOpen])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (searchInput.trim()) void searchUsers(searchInput)
      else clearSearch()
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [clearSearch, searchInput, searchUsers])

  const openConversation = async (otherUserId: string) => {
    if (!otherUserId || otherUserId === user?.id || openingId) return
    setOpeningId(otherUserId)
    try {
      const conversationId = await createDirectConversation(otherUserId)
      if (conversationId) {
        setActiveConversation(conversationId)
        setSearchInput('')
        clearSearch()
      }
    } finally {
      setOpeningId(null)
    }
  }

  const beginEdit = (message: ChatMessage) => {
    setEditingMessageId(message.id)
    setEditDraft(message.content)
  }

  const saveEdit = async () => {
    if (!editingMessageId || !editDraft.trim() || savingEdit) return
    setSavingEdit(true)
    try {
      await editMessage(editingMessageId, editDraft)
      setEditingMessageId(null)
      setEditDraft('')
    } catch {
      toast.error('No se pudo editar el mensaje')
    } finally {
      setSavingEdit(false)
    }
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    const action =
      deleteTarget.scope === 'me'
        ? deleteMessageForMe(deleteTarget.id)
        : deleteMessageForEveryone(deleteTarget.id)
    void action.catch(() => toast.error('No se pudo eliminar el mensaje'))
    setDeleteTarget(null)
  }

  const submitMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeConversationId || !message.trim() || sending) return
    setSending(true)
    try {
      await sendMessage(activeConversationId, message)
      setMessage('')
    } catch {
      toast.error('No se pudo enviar el mensaje')
    } finally {
      setSending(false)
    }
  }

  const onMessageKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-label="Cerrar chat"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-drawer-title"
        className="chat-panel animate-fade-in absolute inset-y-0 right-0 flex w-full max-w-5xl flex-col"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-border/80 bg-surface/80 px-5 py-4">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <MessageCircle className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="chat-drawer-title"
              className="text-base font-bold tracking-[-0.02em] text-foreground"
            >
              Chat interno
            </h2>
            <p className="truncate text-[11px] text-muted">
              Mensajería en tiempo real
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-elevated hover:text-foreground"
            aria-label="Cerrar chat"
          >
            <X className="size-4" />
          </button>
        </header>

        <div
          className={`grid min-h-0 flex-1 lg:grid-cols-[minmax(270px,0.9fr)_minmax(0,1.7fr)] lg:grid-rows-[auto_minmax(0,1fr)] ${
            activeConversationId
              ? 'grid-rows-[minmax(0,1fr)]'
              : 'grid-rows-[auto_minmax(0,1fr)]'
          }`}
        >
          <div
            className={`grid shrink-0 grid-cols-2 border-b border-border/80 p-1.5 lg:col-start-1 lg:row-start-1 ${
              activeConversationId ? 'hidden lg:grid' : 'grid'
            }`}
          >
            <button
              type="button"
              onClick={() => setTab('team')}
              className={`chat-tab flex items-center justify-center gap-2 px-3 py-2 ${tab === 'team' ? 'chat-tab-active' : ''}`}
            >
              <Users className="size-3.5" /> Equipo
            </button>
            <button
              type="button"
              onClick={() => setTab('search')}
              className={`chat-tab flex items-center justify-center gap-2 px-3 py-2 ${tab === 'search' ? 'chat-tab-active' : ''}`}
            >
              <Search className="size-3.5" /> Búsqueda
            </button>
          </div>

          <div
            className={`min-h-0 overflow-y-auto lg:col-start-1 lg:row-start-2 ${
              activeConversationId ? 'hidden lg:block' : 'block'
            }`}
          >
            {tab === 'team' ? (
              <section className="p-3">
                <div className="mb-2 flex items-center justify-between gap-3 px-1">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {activeWorkspace?.name || 'Equipo'}
                    </p>
                    <p className="text-[11px] text-muted">
                      Miembros aceptados del equipo activo
                    </p>
                  </div>
                  {isTeamOwner && activeWorkspace && (
                    <span className="rounded-full border border-success/25 bg-success/10 px-2.5 py-1 text-[10px] font-semibold text-success">
                      [Equipo Online: {teamOnline}/{teamMembers.length}]
                    </span>
                  )}
                </div>
                {teamMembers.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                    <p className="text-sm font-medium text-foreground">
                      No hay miembros disponibles
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Crea o selecciona un equipo con miembros registrados.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {teamMembers.map((member) => {
                      const memberId = member.userId
                      if (!memberId) return null
                      const profile = profiles.get(memberId)
                      const person = memberToChatUser(
                        member,
                        profile ?? onlineUsers.get(memberId),
                        isOnline(memberId),
                      )
                      const isMe = memberId === user?.id
                      return (
                        <PersonRow
                          key={member.id}
                          id={person.id}
                          name={person.name}
                          email={person.email}
                          avatarColor={person.avatarColor}
                          online={person.isOnline}
                          disabled={isMe || openingId !== null}
                          onClick={() => void openConversation(memberId)}
                          trailingLabel={isMe ? 'Tú' : undefined}
                        />
                      )
                    })}
                  </div>
                )}
              </section>
            ) : (
              <section className="p-3">
                <div className="relative" aria-busy={searching}>
                  <SearchInput
                    value={searchInput}
                    onChange={setSearchInput}
                    placeholder="Buscar por nombre o correo..."
                  />
                  {searching && (
                    <Loader2
                      className="pointer-events-none absolute right-10 top-1/2 size-4 -translate-y-1/2 animate-spin text-primary"
                      aria-label="Buscando personas"
                    />
                  )}
                </div>
                {safeSearchError && (
                  <p
                    role="alert"
                    className="mt-2 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2.5 text-[11px] leading-relaxed text-danger"
                  >
                    {safeSearchError}
                  </p>
                )}
                <div className="mt-2 min-h-24">
                  {searching && (
                    <div className="space-y-2 p-1">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  )}
                  {!searching &&
                    !safeSearchError &&
                    searchInput.trim().length >= 2 &&
                    searchedUsers.length === 0 && (
                      <p className="px-2 py-6 text-center text-xs text-muted">
                        No encontramos usuarios.
                      </p>
                    )}
                  {!searching && searchInput.trim().length < 2 && (
                    <p className="px-2 py-6 text-center text-xs text-muted">
                      Escribe al menos 2 caracteres para buscar.
                    </p>
                  )}
                  <div className="space-y-0.5">
                    {searchedUsers.map((result) => (
                      <PersonRow
                        key={result.id}
                        id={result.id}
                        name={result.name}
                        email={result.email}
                        avatarColor={
                          result.avatarColor || getAvatarColor(result.id)
                        }
                        online={isOnline(result.id)}
                        disabled={openingId !== null}
                        busy={openingId === result.id}
                        onClick={() => void openConversation(result.id)}
                      />
                    ))}
                  </div>
                </div>
              </section>
            )}

            {recentConversations.length > 0 && (
              <section className="border-t border-border/80 p-3">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="eyebrow">Conversaciones</span>
                  <span className="text-[10px] font-semibold text-muted">
                    {recentConversations.length}
                  </span>
                </div>
                <div className="space-y-1">
                  {recentConversations.slice(0, 6).map((conversation) => {
                    const title = getConversationTitle(conversation)
                    const otherId = getConversationUserId(conversation)
                    const online = isConversationOnline(conversation)
                    const lastMessage = conversation.lastMessage
                    return (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() => {
                          setActiveConversation(conversation.id)
                          setSearchInput('')
                          clearSearch()
                        }}
                        className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all hover:bg-elevated ${
                          activeConversationId === conversation.id
                            ? 'bg-primary-soft ring-1 ring-primary/20'
                            : ''
                        }`}
                      >
                        <span
                          className="relative flex size-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold text-white"
                          style={{
                            backgroundColor: getAvatarColor(
                              otherId ?? conversation.id,
                            ),
                          }}
                          aria-hidden="true"
                        >
                          {initials(title)}
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface ${
                              online ? 'bg-success' : 'bg-muted'
                            }`}
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-foreground">
                            {title}
                          </span>
                          <span className="block truncate text-[10px] text-muted">
                            {getConversationPreview(conversation)}
                          </span>
                        </span>
                        <span className="shrink-0 text-[9px] text-muted">
                          {formatTime(
                            lastMessage?.created_at ?? conversation.created_at,
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )}
          </div>

          <section
            className={`min-h-0 flex-col border-t border-border/80 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:flex lg:border-l lg:border-t-0 ${
              activeConversationId ? 'flex border-t-0' : 'hidden'
            }`}
          >
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              {activeConversationId && (
                <button
                  type="button"
                  onClick={() => setActiveConversation(null)}
                  className="rounded-md p-1 text-muted hover:bg-elevated hover:text-foreground"
                  aria-label="Cerrar conversación activa"
                >
                  <ArrowLeft className="size-4" />
                </button>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">
                  {activeConversationId
                    ? conversationTitle
                    : 'Selecciona una conversación'}
                </p>
                <p className="text-[10px] text-muted">
                  Los mensajes se muestran como texto seguro
                </p>
              </div>
              {(loading || activeMessageLoading) && (
                <Loader2 className="size-3.5 animate-spin text-muted" />
              )}
            </div>
            <div className="min-h-40 flex-1 space-y-3 overflow-y-auto bg-elevated/20 p-4 sm:p-5">
              {activeMessages.length === 0 ? (
                <div className="flex min-h-36 flex-col items-center justify-center text-center">
                  <MessageCircle className="size-7 text-muted/60" />
                  <p className="mt-2 text-xs text-muted">
                    Esta conversación todavía no tiene mensajes. Envía el
                    primero.
                  </p>
                </div>
              ) : (
                activeMessages.map((item: ChatMessage) => {
                  const own = item.sender_id === user?.id
                  const senderProfile = profiles.get(item.sender_id)
                  const senderMember = members.find(
                    (member) => member.userId === item.sender_id,
                  )
                  const senderName = own
                    ? 'Tú'
                    : senderMember?.displayName ||
                      senderProfile?.name ||
                      onlineUsers.get(item.sender_id)?.name ||
                      'Usuario'
                  const deleted = Boolean(item.deleted_at)
                  const editing = editingMessageId === item.id
                  return (
                    <div
                      key={item.id}
                      className={`flex ${own ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`chat-bubble max-w-[88%] ${own ? 'chat-bubble-own rounded-br-md' : 'chat-bubble-incoming rounded-bl-md'}`}
                      >
                        {!own && (
                          <p className="mb-0.5 text-[10px] font-semibold opacity-70">
                            {senderName}
                          </p>
                        )}
                        {editing ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editDraft}
                              onChange={(event) =>
                                setEditDraft(event.target.value)
                              }
                              maxLength={2000}
                              rows={3}
                              autoFocus
                              aria-label="Editar mensaje"
                            />
                            <div className="flex justify-end gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingMessageId(null)
                                  setEditDraft('')
                                }}
                              >
                                Cancelar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="primary"
                                disabled={savingEdit || !editDraft.trim()}
                                onClick={() => void saveEdit()}
                              >
                                {savingEdit ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Check className="size-3.5" />
                                )}
                                Guardar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">
                              {deleted ? 'Mensaje eliminado' : item.content}
                            </p>
                            <div className="mt-1 flex items-center justify-end gap-1">
                              <span
                                className={`text-[9px] ${own ? 'text-white/65' : 'text-muted'}`}
                              >
                                {formatTime(item.created_at)}
                                {item.edited_at && !deleted ? ' · editado' : ''}
                              </span>
                              {own && !deleted && (
                                <DropdownMenu
                                  align="end"
                                  trigger={
                                    <MoreVertical className="size-3.5" />
                                  }
                                >
                                  <DropdownMenuItem
                                    onClick={() => beginEdit(item)}
                                  >
                                    <Pencil className="size-3.5" /> Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    variant="danger"
                                    onClick={() =>
                                      setDeleteTarget({
                                        id: item.id,
                                        scope: 'me',
                                      })
                                    }
                                  >
                                    <Trash2 className="size-3.5" /> Eliminar
                                    para mí
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    variant="danger"
                                    onClick={() =>
                                      setDeleteTarget({
                                        id: item.id,
                                        scope: 'everyone',
                                      })
                                    }
                                  >
                                    <Trash2 className="size-3.5" /> Eliminar
                                    para todos
                                  </DropdownMenuItem>
                                </DropdownMenu>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>
            {safeChatError && (
              <p
                role="alert"
                className="mx-4 mb-3 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2.5 text-[11px] leading-relaxed text-danger"
              >
                {safeChatError}
              </p>
            )}
            {activeConversationId && (
              <form
                onSubmit={submitMessage}
                className="border-t border-border/80 bg-surface/80 p-3"
              >
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={onMessageKeyDown}
                  placeholder="Escribe un mensaje..."
                  maxLength={2000}
                  rows={2}
                  disabled={sending || !isSupabaseConfigured}
                  aria-label="Mensaje"
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted">
                    {message.length}/2000 · Enter envía · Shift+Enter salta de
                    línea
                  </span>
                  <Button
                    type="submit"
                    size="sm"
                    variant="primary"
                    disabled={
                      sending || !message.trim() || !isSupabaseConfigured
                    }
                    aria-label="Enviar mensaje"
                  >
                    {sending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Send className="size-3.5" />
                    )}
                    Enviar
                  </Button>
                </div>
              </form>
            )}
          </section>
        </div>
        <ConfirmDialog
          open={deleteTarget !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setDeleteTarget(null)
          }}
          title={
            deleteTarget?.scope === 'everyone'
              ? '¿Eliminar para todos?'
              : '¿Eliminar para mí?'
          }
          description={
            deleteTarget?.scope === 'everyone'
              ? 'El mensaje se mostrará como eliminado para todos los participantes.'
              : 'El mensaje solo desaparecerá de tu vista; los demás podrán verlo.'
          }
          confirmLabel="Eliminar"
          onConfirm={confirmDelete}
        />
      </aside>
    </div>
  )
}
