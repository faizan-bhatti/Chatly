import { useMemo, useState } from 'react'
import { Image, LogOut, MessageCircle, MessageSquarePlus, Moon, Search, Sun, X } from 'lucide-react'
import { Avatar } from './Avatar'
import { formatMessageTime } from '../lib/chat-utils'
import type { ContactPreview, Profile } from '../types/database'

type ChatSidebarProps = {
  contacts: ContactPreview[]
  activeContactId: string | null
  profile: Profile
  loading: boolean
  error: string | null
  onSelect: (contactId: string) => void
  onAddContact: () => void
  onSignOut: () => void
  onToggleTheme: () => void
  darkMode: boolean
}

export function ChatSidebar({
  contacts,
  activeContactId,
  profile,
  loading,
  error,
  onSelect,
  onAddContact,
  onSignOut,
  onToggleTheme,
  darkMode,
}: ChatSidebarProps) {
  const [query, setQuery] = useState('')
  const visibleContacts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return contacts
    return contacts.filter((contact) => contact.display_name.toLocaleLowerCase().includes(normalized))
  }, [contacts, query])

  return (
    <aside className="chat-sidebar flex h-full min-h-0 w-full flex-col border-r border-[#e3ebe5] bg-white md:w-[356px] md:shrink-0">
      <header className="sidebar-header flex items-center justify-between px-5 pb-4 pt-5">
        <div className="sidebar-brand flex items-center gap-3">
          <span className="sidebar-brand-icon grid size-11 place-items-center rounded-[12px] bg-[#e3f1e9] text-[#247257]"><MessageCircle className="size-5" aria-hidden="true" /></span>
          <div>
            <h1 className="sidebar-brand-name text-[17px] font-semibold leading-5 tracking-normal text-[#244137]">Chatly</h1>
            <p className="mt-1 text-[11px] text-[#8a9991]">Your space to talk</p>
          </div>
        </div>
        <button className="icon-button" type="button" title="Add a contact" aria-label="Add a contact" onClick={onAddContact}><MessageSquarePlus className="size-[18px]" /></button>
      </header>

      <div className="px-4 pb-3">
        <label className="search-field">
          <Search className="size-4 shrink-0 text-[#82948a]" aria-hidden="true" />
          <input aria-label="Search conversations" placeholder="Search conversations" value={query} onChange={(event) => setQuery(event.target.value)} />
          {query && <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="Clear search"><X className="size-3.5" aria-hidden="true" /></button>}
        </label>
      </div>

      <div className="chat-list-heading mb-2 flex items-end justify-between px-5 pt-1">
        <div>
          <p className="text-[10px] font-semibold uppercase text-[#91a097]">Workspace</p>
          <h2 className="mt-1 text-[15px] font-semibold tracking-normal text-[#31453b]">Messages</h2>
        </div>
        <span className="contact-count text-[11px] tabular-nums text-[#91a097]">{contacts.length}</span>
      </div>

      {error && <p className="mx-4 mb-2 rounded-[5px] border border-[#f0d4cf] bg-[#fff5f2] px-3 py-2 text-xs leading-5 text-[#a54040]" role="alert">{error}</p>}

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3" aria-label="Conversations">
        {visibleContacts.map((contact) => (
          <button
            key={contact.contact_id}
            className={`contact-row group ${activeContactId === contact.contact_id ? 'contact-row-active' : ''}`}
            type="button"
            onClick={() => onSelect(contact.contact_id)}
          >
            <span className="contact-row-avatar"><Avatar name={contact.display_name} src={contact.avatar_url} /></span>
            <span className="min-w-0 flex-1 text-left">
              <span className="flex items-center justify-between gap-2">
                <span className="contact-row-name truncate text-[14px] font-semibold text-[#31453b]">{contact.display_name}</span>
                {contact.last_message_at && <time className="contact-row-time shrink-0 text-[10px] text-[#8b9992]">{formatMessageTime(contact.last_message_at)}</time>}
              </span>
              <span className="contact-row-bottom mt-1 flex items-center justify-between gap-3">
                <span className="contact-row-preview truncate text-[12px] text-[#85938c]">
                  {contact.last_message_is_image ? <span className="inline-flex items-center gap-1.5"><Image className="size-3.5" aria-hidden="true" /> Photo</span> : contact.last_message || 'Start a conversation'}
                </span>
                {contact.unread_count > 0 && <span className="contact-unread grid min-h-5 min-w-5 place-items-center rounded-full bg-[#23845e] px-1 text-[10px] font-semibold text-white">{contact.unread_count > 99 ? '99+' : contact.unread_count}</span>}
              </span>
            </span>
          </button>
        ))}
        {visibleContacts.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-medium text-[#52665b]">{loading ? 'Loading conversations…' : query ? 'No matching conversations' : 'No conversations yet'}</p>
            {!loading && !query && <button className="mt-2 text-xs font-semibold text-[#267454] hover:underline" type="button" onClick={onAddContact}>Find someone to message</button>}
          </div>
        )}
      </nav>

      <footer className="sidebar-profile flex items-center gap-3 border-t border-[#e8eee9] px-4 py-3">
        <Avatar name={profile.display_name} src={profile.avatar_url} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-[#31453b]">{profile.display_name}</span>
          <span className="block truncate text-[11px] text-[#8a9991]">Your profile</span>
        </span>
        <button className="icon-button icon-button-small" type="button" title={darkMode ? 'Switch to light theme' : 'Switch to dark theme'} aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'} onClick={onToggleTheme}>{darkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}</button>
        <button className="icon-button icon-button-small" type="button" title="Sign out" aria-label="Sign out" onClick={onSignOut}><LogOut className="size-4" /></button>
      </footer>
    </aside>
  )
}