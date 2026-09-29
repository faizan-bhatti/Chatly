import { useEffect, useState } from 'react'
import { Check, LoaderCircle, Search, UserRoundPlus, X } from 'lucide-react'
import { Avatar } from './Avatar'
import { useChatStore } from '../stores/chat-store'
import type { ContactPreview } from '../types/database'

type AddContactDialogProps = {
  contacts: ContactPreview[]
  onClose: () => void
  onAdded: (contactId: string) => void
}

export function AddContactDialog({ contacts, onClose, onAdded }: AddContactDialogProps) {
  const searchProfiles = useChatStore((state) => state.searchProfiles)
  const addContact = useChatStore((state) => state.addContact)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchProfiles>>>([])
  const [loading, setLoading] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const normalized = query.trim()
    if (normalized.length < 3) return

    let isCurrent = true
    const timer = window.setTimeout(() => {
      void searchProfiles(normalized)
        .then((profiles) => { if (isCurrent) setResults(profiles) })
        .catch((caught: unknown) => {
          if (isCurrent) setError(caught instanceof Error ? caught.message : 'Search is unavailable.')
        })
        .finally(() => { if (isCurrent) setLoading(false) })
    }, 300)

    return () => {
      isCurrent = false
      window.clearTimeout(timer)
    }
  }, [query, searchProfiles])

  async function handleAdd(contactId: string) {
    setAddingId(contactId)
    setError('')
    try {
      await addContact(contactId)
      onAdded(contactId)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add this contact.')
    } finally {
      setAddingId(null)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="contact-dialog" role="dialog" aria-modal="true" aria-labelledby="add-contact-title">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase text-[#4c8a70]">New conversation</p>
            <h2 id="add-contact-title" className="mt-1 text-xl font-semibold tracking-normal text-[#243832]">Find a person</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Close" onClick={onClose}><X className="size-4" /></button>
        </header>
        <p className="mt-2 text-sm leading-5 text-[#78877f]">Search by the exact email address or phone number they registered with.</p>
        <label className="search-field mt-5">
          <Search className="size-4 shrink-0 text-[#82948a]" aria-hidden="true" />
          <input autoFocus aria-label="Email or phone number" placeholder="Email address or phone" value={query} onChange={(event) => { const value = event.target.value; setQuery(value); setLoading(value.trim().length >= 3); setError('') }} />
          {loading && query.trim().length >= 3 && <LoaderCircle className="size-4 animate-spin text-[#398362]" aria-label="Searching" />}
        </label>

        <div className="mt-4 min-h-28">
          {error && <p className="auth-error" role="alert">{error}</p>}
          {!error && query.trim().length < 3 && <p className="px-1 py-5 text-center text-xs text-[#89968f]">Enter at least 3 characters to search.</p>}
          {!error && !loading && query.trim().length >= 3 && results.length === 0 && <p className="px-1 py-5 text-center text-sm text-[#89968f]">No account matched that email or phone.</p>}
          <ul className="divide-y divide-[#edf1ee]">
            {(query.trim().length >= 3 ? results : []).map((result) => {
              const existing = contacts.some((contact) => contact.contact_id === result.user_id)
              return (
                <li key={result.user_id} className="flex items-center gap-3 py-3">
                  <Avatar name={result.display_name} src={result.avatar_url} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#31453b]">{result.display_name}</span>
                  <button className={`contact-add-button ${existing ? 'contact-add-button-done' : ''}`} type="button" disabled={existing || addingId !== null} onClick={() => void handleAdd(result.user_id)}>
                    {existing ? <><Check className="size-3.5" /> Added</> : addingId === result.user_id ? <LoaderCircle className="size-4 animate-spin" /> : <><UserRoundPlus className="size-3.5" /> Add</>}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </section>
    </div>
  )
}