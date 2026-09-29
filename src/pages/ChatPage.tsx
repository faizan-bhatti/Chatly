import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../stores/auth-store'
import { useChatStore } from '../stores/chat-store'
import { AddContactDialog } from '../components/AddContactDialog'
import { ChatSidebar } from '../components/ChatSidebar'
import { ChatWindow } from '../components/ChatWindow'
import { WelcomeArt } from '../components/WelcomeArt'
import { LoadingScreen } from '../components/LoadingScreen'

type ChatPageProps = {
  darkMode: boolean
  onToggleTheme: () => void
}

export function ChatPage({ darkMode, onToggleTheme }: ChatPageProps) {
  const navigate = useNavigate()
  const { contactId } = useParams<{ contactId: string }>()
  const user = useAuthStore((state) => state.user)
  const profile = useAuthStore((state) => state.profile)
  const signOut = useAuthStore((state) => state.signOut)
  const contacts = useChatStore((state) => state.contacts)
  const activeContactId = useChatStore((state) => state.activeContactId)
  const messages = useChatStore((state) => state.messages)
  const loadingContacts = useChatStore((state) => state.loadingContacts)
  const loadingMessages = useChatStore((state) => state.loadingMessages)
  const sending = useChatStore((state) => state.sending)
  const error = useChatStore((state) => state.error)
  const loadContacts = useChatStore((state) => state.loadContacts)
  const loadMessages = useChatStore((state) => state.loadMessages)
  const markConversationSeen = useChatStore((state) => state.markConversationSeen)
  const selectContact = useChatStore((state) => state.selectContact)
  const sendMessage = useChatStore((state) => state.sendMessage)
  const subscribeToMessages = useChatStore((state) => state.subscribeToMessages)
  const [showAddContact, setShowAddContact] = useState(false)

  useEffect(() => {
    selectContact(contactId ?? null)
  }, [contactId, selectContact])

  useEffect(() => {
    if (!user) return
    void loadContacts()
    return subscribeToMessages(user.id)
  }, [loadContacts, subscribeToMessages, user])

  useEffect(() => {
    if (user && contactId) void loadMessages(user.id, contactId)
  }, [contactId, loadMessages, user])

  useEffect(() => {
    if (!user || !contactId) return

    const markWhenActive = () => {
      if (document.visibilityState === 'visible' && document.hasFocus()) {
        void markConversationSeen(user.id, contactId)
      }
    }

    markWhenActive()
    window.addEventListener('focus', markWhenActive)
    document.addEventListener('visibilitychange', markWhenActive)

    return () => {
      window.removeEventListener('focus', markWhenActive)
      document.removeEventListener('visibilitychange', markWhenActive)
    }
  }, [contactId, markConversationSeen, user])

  useEffect(() => {
    if (!user || !contactId) return

    const markVisibleConversationSeen = () => {
      if (document.visibilityState === 'visible' && document.hasFocus()) {
        void markConversationSeen(user.id, contactId)
      }
    }

    markVisibleConversationSeen()
    window.addEventListener('focus', markVisibleConversationSeen)
    document.addEventListener('visibilitychange', markVisibleConversationSeen)

    return () => {
      window.removeEventListener('focus', markVisibleConversationSeen)
      document.removeEventListener('visibilitychange', markVisibleConversationSeen)
    }
  }, [contactId, markConversationSeen, user])

  if (!user || !profile) return <LoadingScreen label="Opening your chats" />

  const userId = user.id
  const activeContact = contacts.find((contact) => contact.contact_id === activeContactId) ?? null

  function handleSend(body: string, image: File | null) {
    if (!activeContactId) return Promise.resolve()
    return sendMessage(userId, activeContactId, body, image)
  }

  function handleAdded(contactId: string) {
    navigate(`/chat/${encodeURIComponent(contactId)}`)
    setShowAddContact(false)
  }

  function handleSelectContact(selectedContactId: string) {
    navigate(`/chat/${encodeURIComponent(selectedContactId)}`)
  }

  return (
    <main className="chat-app h-[100dvh] overflow-hidden">
      <div className="flex h-full min-h-0 w-full">
        <div className={`h-full min-h-0 w-full md:flex md:w-auto ${activeContactId ? 'hidden' : 'flex'}`}>
          <ChatSidebar
            contacts={contacts}
            activeContactId={activeContactId}
            profile={profile}
            loading={loadingContacts}
            error={activeContactId ? null : error}
            onSelect={handleSelectContact}
            onAddContact={() => setShowAddContact(true)}
            onSignOut={() => { void signOut().catch(() => undefined) }}
            onToggleTheme={onToggleTheme}
            darkMode={darkMode}
          />
        </div>

        <div className={`min-h-0 min-w-0 flex-1 ${activeContactId ? 'flex' : 'hidden md:flex'}`}>
          {activeContact ? (
            <ChatWindow
              userId={user.id}
              contact={activeContact}
              messages={messages}
              loading={loadingMessages}
              sending={sending}
              darkMode={darkMode}
              error={error}
              onSend={handleSend}
              onBack={() => navigate('/chat')}
            />
          ) : (
            <section className="empty-conversation hidden min-h-0 flex-1 flex-col items-center justify-center gap-2 border-t-[3px] border-[#6eae87] bg-[#f3f6f4] text-center md:flex">
              <WelcomeArt />
              <p className="empty-conversation-brand mt-5 text-[10px] font-semibold uppercase text-[#4c8a70]">Chatly</p>
              <h2 className="mt-1 text-[21px] font-semibold tracking-normal text-[#40574a]">Your conversations, in one place</h2>
              <p className="max-w-sm text-sm leading-6 text-[#86948b]">Choose a conversation or find someone new to message.</p>
              <button className="empty-conversation-action mt-4 inline-flex h-10 items-center gap-2 rounded-[7px] bg-[#287553] px-4 text-xs font-semibold text-white transition hover:bg-[#1f6546]" type="button" onClick={() => setShowAddContact(true)}>Start a conversation</button>
              {loadingContacts && <span className="mt-2 text-[11px] text-[#8a9991]">Refreshing conversations…</span>}
            </section>
          )}
        </div>
      </div>

      {showAddContact && <AddContactDialog contacts={contacts} onClose={() => setShowAddContact(false)} onAdded={handleAdded} />}
    </main>
  )
}