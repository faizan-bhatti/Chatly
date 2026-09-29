import { create } from 'zustand'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { requireSupabase, supabase } from '../lib/supabase'
import { validateImageFile } from '../lib/chat-utils'
import type { ChatMessage, ContactPreview } from '../types/database'

export type DisplayMessage = ChatMessage & {
  image_url?: string | null
  sending?: boolean
}

type ContactSearchResult = {
  user_id: string
  display_name: string
  avatar_url: string | null
}

type ChatState = {
  contacts: ContactPreview[]
  activeContactId: string | null
  messages: DisplayMessage[]
  loadingContacts: boolean
  loadingMessages: boolean
  sending: boolean
  error: string | null
  loadContacts: () => Promise<void>
  searchProfiles: (query: string) => Promise<ContactSearchResult[]>
  addContact: (contactId: string) => Promise<void>
  removeContact: (contactId: string) => Promise<void>
  selectContact: (contactId: string | null) => void
  loadMessages: (userId: string, contactId: string) => Promise<void>
  markConversationSeen: (userId: string, contactId: string) => Promise<void>
  sendMessage: (userId: string, contactId: string, body: string, image: File | null) => Promise<void>
  subscribeToMessages: (userId: string) => () => void
}

async function hydrateMessage(message: ChatMessage): Promise<DisplayMessage> {
  if (!message.image_path) return message

  const { data, error } = await requireSupabase()
    .storage
    .from('chat-images')
    .createSignedUrl(message.image_path, 60 * 60)

  return { ...message, image_url: error ? null : data.signedUrl }
}

async function hydrateMessages(messages: ChatMessage[]) {
  return Promise.all(messages.map(hydrateMessage))
}

function orderMessages(messages: DisplayMessage[]) {
  return [...messages].sort((left, right) => left.created_at.localeCompare(right.created_at))
}

function isDocumentActive() {
  return typeof document !== 'undefined'
    && document.visibilityState === 'visible'
    && document.hasFocus()
}

function getStatusTimestamp(messages: Pick<ChatMessage, 'created_at' | 'delivered_at'>[]) {
  const latestStatus = messages.reduce((latest, message) => {
    const createdAt = Date.parse(message.created_at)
    const deliveredAt = message.delivered_at ? Date.parse(message.delivered_at) : 0
    return Math.max(latest, createdAt, deliveredAt)
  }, 0)

  return new Date(Math.max(Date.now(), latestStatus)).toISOString()
}

const seenRequests = new Map<string, Promise<void>>()

function describeSendError(error: unknown) {
  if (!import.meta.env.DEV) return 'Message could not be sent. Please try again.'

  if (!error || typeof error !== 'object') {
    return typeof error === 'string' ? error : 'Unknown message sending error.'
  }

  const fields = error as {
    message?: unknown
    code?: unknown
    details?: unknown
    hint?: unknown
  }
  const message = typeof fields.message === 'string' ? fields.message : 'Unknown message sending error.'

  return [
    message,
    fields.code ? `Code: ${String(fields.code)}` : null,
    fields.details ? `Details: ${String(fields.details)}` : null,
    fields.hint ? `Hint: ${String(fields.hint)}` : null,
  ].filter(Boolean).join('\n')
}

export const useChatStore = create<ChatState>((set, get) => ({
  contacts: [],
  activeContactId: null,
  messages: [],
  loadingContacts: false,
  loadingMessages: false,
  sending: false,
  error: null,

  loadContacts: async () => {
    set({ loadingContacts: true, error: null })
    const { data, error } = await requireSupabase().rpc('get_contact_list')
    if (error) {
      set({ loadingContacts: false, error: error.message })
      return
    }
    set({ contacts: data, loadingContacts: false })
  },

  searchProfiles: async (query) => {
    const normalized = query.trim()
    if (normalized.length < 3) return []

    const { data, error } = await requireSupabase().rpc('search_profiles', {
      search_query: normalized,
    })
    if (error) throw error
    return data
  },

  addContact: async (contactId) => {
    const user = (await requireSupabase().auth.getUser()).data.user
    if (!user) throw new Error('Sign in again to add a contact.')

    const { error } = await requireSupabase()
      .from('contacts')
      .insert({ user_id: user.id, contact_id: contactId })

    if (error && error.code !== '23505') throw error
    await get().loadContacts()
  },

  removeContact: async (contactId) => {
    const { error } = await requireSupabase()
      .from('contacts')
      .delete()
      .eq('contact_id', contactId)

    if (error) throw error
    set((state) => ({ contacts: state.contacts.filter((contact) => contact.contact_id !== contactId) }))
  },

  selectContact: (contactId) => {
    set({ activeContactId: contactId, messages: [], error: null })
  },

  loadMessages: async (userId, contactId) => {
    set({ loadingMessages: true, error: null })
    const { data, error } = await requireSupabase()
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${userId})`)
      .order('created_at', { ascending: true })
      .limit(300)

    if (error) {
      set({ loadingMessages: false, error: error.message })
      return
    }

    const hydrated = await hydrateMessages(data)
    if (get().activeContactId === contactId) {
      set({ messages: hydrated, loadingMessages: false })
    }

    void get().loadContacts()
  },

  markConversationSeen: async (userId, contactId) => {
    if (!contactId || get().activeContactId !== contactId || !isDocumentActive()) return

    const requestKey = `${userId}:${contactId}`
    const pendingRequest = seenRequests.get(requestKey)
    if (pendingRequest) return pendingRequest

    const request = (async () => {
      const client = requireSupabase()
      const { data: unreadMessages, error: queryError } = await client
        .from('messages')
        .select('id, created_at, delivered_at')
        .eq('sender_id', contactId)
        .eq('receiver_id', userId)
        .is('read_at', null)

      if (queryError) {
        set({ error: queryError.message })
        return
      }
      if (!unreadMessages?.length) return

      const timestamp = getStatusTimestamp(unreadMessages)
      const { data: newlyDelivered, error: deliveryError } = await client
        .from('messages')
        .update({ delivered_at: timestamp })
        .eq('sender_id', contactId)
        .eq('receiver_id', userId)
        .is('delivered_at', null)
        .is('read_at', null)
        .select('id')

      if (deliveryError) {
        set({ error: deliveryError.message })
        return
      }

      const { data: newlyRead, error: readError } = await client
        .from('messages')
        .update({ read_at: timestamp })
        .eq('sender_id', contactId)
        .eq('receiver_id', userId)
        .is('read_at', null)
        .select('id, delivered_at')

      if (readError) {
        set({ error: readError.message })
        return
      }

      const deliveredIds = new Set((newlyDelivered ?? []).map((message) => message.id))
      const readById = new Map((newlyRead ?? []).map((message) => [message.id, message.delivered_at]))
      const readIds = new Set(readById.keys())
      if (deliveredIds.size > 0 || readIds.size > 0) {
        set((state) => ({
          messages: state.messages.map((message) => ({
            ...message,
            ...(deliveredIds.has(message.id) ? { delivered_at: timestamp } : {}),
            ...(readIds.has(message.id) ? {
              delivered_at: readById.get(message.id) ?? (deliveredIds.has(message.id) ? timestamp : message.delivered_at),
              read_at: timestamp,
            } : {}),
          })),
        }))
      }

      void get().loadContacts()
    })()

    seenRequests.set(requestKey, request)
    try {
      await request
    } finally {
      if (seenRequests.get(requestKey) === request) seenRequests.delete(requestKey)
    }
  },

  sendMessage: async (userId, contactId, body, image) => {
    const text = body.trim()
    if (!text && !image) return
    if (!contactId || contactId === userId) {
      throw new Error('Choose another user before sending a message.')
    }
    if (image) {
      const validationError = validateImageFile(image)
      if (validationError) throw new Error(validationError)
    }

    const temporaryId = `optimistic-${crypto.randomUUID()}`
    let temporaryMessage: DisplayMessage | null = null
    let imagePath: string | null = null
    const client = requireSupabase()
    set({ sending: true, error: null })

    try {
      const { data: authData, error: authError } = await client.auth.getUser()
      if (authError) throw authError
      if (!authData.user) throw new Error('Your session has expired. Sign in again to send messages.')
      if (authData.user.id !== userId) {
        throw new Error('Your signed-in account changed. Refresh the chat and try again.')
      }

      const senderId = authData.user.id
      temporaryMessage = {
        id: temporaryId,
        sender_id: senderId,
        receiver_id: contactId,
        body: text || null,
        image_path: null,
        image_url: image ? URL.createObjectURL(image) : null,
        created_at: new Date().toISOString(),
        delivered_at: null,
        read_at: null,
        sending: true,
      }
      set((state) => ({ messages: orderMessages([...state.messages, temporaryMessage!]) }))

      if (image) {
        const extension = image.type === 'image/jpeg' ? 'jpg' : image.type.split('/')[1]
        imagePath = `${senderId}/${crypto.randomUUID()}.${extension}`
        const { error: uploadError } = await client
          .storage
          .from('chat-images')
          .upload(imagePath, image, { contentType: image.type, upsert: false })
        if (uploadError) throw uploadError
      }

      const { data, error } = await client
        .from('messages')
        .insert({
          sender_id: senderId,
          receiver_id: contactId,
          body: text || null,
          image_path: imagePath,
        })
        .select('*')
        .single()

      if (error) throw error
      const savedMessage = await hydrateMessage(data)
      set((state) => ({
        messages: orderMessages([
          ...state.messages.filter((message) => message.id !== temporaryId && message.id !== savedMessage.id),
          savedMessage,
        ]),
        sending: false,
      }))
      if (temporaryMessage.image_url) URL.revokeObjectURL(temporaryMessage.image_url)
      void get().loadContacts()
    } catch (error) {
      if (imagePath) {
        try {
          await client.storage.from('chat-images').remove([imagePath])
        } catch {
          // Preserve the original send error if cleanup is unavailable.
        }
      }
      if (temporaryMessage?.image_url) URL.revokeObjectURL(temporaryMessage.image_url)
      set((state) => ({
        messages: state.messages.filter((message) => message.id !== temporaryId),
        sending: false,
        error: describeSendError(error),
      }))
      throw error
    }
  },

  subscribeToMessages: (userId) => {
    if (!supabase) return () => undefined

    let channel: RealtimeChannel | null = null
    let reconciling = false

    async function reconcileStatuses() {
      if (reconciling) return
      reconciling = true

      try {
        const client = requireSupabase()
        const pendingOwnMessages = get().messages.filter(
          (message) => message.sender_id === userId && !message.sending
            && (!message.delivered_at || !message.read_at),
        )

        if (pendingOwnMessages.length > 0) {
          const { data, error } = await client
            .from('messages')
            .select('id, delivered_at, read_at')
            .in('id', pendingOwnMessages.map((message) => message.id))
            .eq('sender_id', userId)

          if (!error && data) {
            const statusById = new Map(data.map((message) => [message.id, {
              delivered_at: message.delivered_at,
              read_at: message.read_at,
            }]))
            set((state) => ({
              messages: state.messages.map((message) => ({
                ...message,
                ...(statusById.get(message.id) ?? {}),
              })),
            }))
          }
        }

        while (true) {
          const { data, error } = await client
            .from('messages')
            .select('id, sender_id, created_at, delivered_at')
            .eq('receiver_id', userId)
            .is('delivered_at', null)
            .limit(500)

          if (error || !data?.length) break

          let updatedCount = 0
          for (const message of data) {
            const deliveredAt = getStatusTimestamp([message])
            const { data: updatedRows, error: deliveryError } = await client
              .from('messages')
              .update({ delivered_at: deliveredAt })
              .eq('id', message.id)
              .eq('receiver_id', userId)
              .is('delivered_at', null)
              .select('id')

            if (deliveryError) return
            if (!updatedRows?.length) continue
            updatedCount += 1
            if (get().activeContactId === message.sender_id && isDocumentActive()) {
              await get().markConversationSeen(userId, message.sender_id)
            }
          }

          if (updatedCount === 0) break
        }
      } catch {
        // A later SUBSCRIBED event retries status reconciliation.
      } finally {
        reconciling = false
      }
    }

    channel = supabase
      .channel(`messages:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, async (payload) => {
        const message = payload.new as ChatMessage
        if (!message.id || (message.sender_id !== userId && message.receiver_id !== userId)) return

        const peerId = message.sender_id === userId ? message.receiver_id : message.sender_id
        if (payload.eventType === 'INSERT') {
          if (message.receiver_id === userId) {
            const deliveredAt = message.delivered_at ?? getStatusTimestamp([message])
            if (!message.delivered_at) {
              const { error: deliveryError } = await requireSupabase()
                .from('messages')
                .update({ delivered_at: deliveredAt })
                .eq('id', message.id)
                .eq('receiver_id', userId)
                .is('delivered_at', null)

              if (!deliveryError) message.delivered_at = deliveredAt
            }
            if (get().activeContactId === message.sender_id && isDocumentActive()) {
              await get().markConversationSeen(userId, message.sender_id)
            }
          }

          if (get().activeContactId === peerId) {
            const hydrated = await hydrateMessage(message)
            set((state) => ({
              messages: orderMessages([
                ...state.messages.filter((existing) => existing.id !== hydrated.id),
                hydrated,
              ]),
            }))
          }
          void get().loadContacts()
        } else if (get().activeContactId === peerId) {
          set((state) => ({
            messages: state.messages.map((existing) =>
              existing.id === message.id ? { ...existing, ...message } : existing,
            ),
          }))
          void get().loadContacts()
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void reconcileStatuses()
      })

    return () => {
      if (channel) void supabase?.removeChannel(channel)
    }
  },
}))