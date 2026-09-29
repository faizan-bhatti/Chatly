import { lazy, Suspense, useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { ArrowLeft, MessagesSquare, Paperclip, Send, Smile, X } from 'lucide-react'
import { Avatar } from './Avatar'
import { MessageBubble } from './MessageBubble'
import { WelcomeArt } from './WelcomeArt'
import { formatMessageTime, getDateHeading, validateImageFile } from '../lib/chat-utils'
import type { Theme as EmojiTheme } from 'emoji-picker-react'
import type { DisplayMessage } from '../stores/chat-store'
import type { ContactPreview } from '../types/database'

const EmojiPicker = lazy(() => import('emoji-picker-react'))

type ChatWindowProps = {
  userId: string
  contact: ContactPreview
  messages: DisplayMessage[]
  loading: boolean
  sending: boolean
  darkMode: boolean
  error: string | null
  onSend: (body: string, image: File | null) => Promise<void>
  onBack: () => void
}

export function ChatWindow({ userId, contact, messages, loading, sending, darkMode, error, onSend, onBack }: ChatWindowProps) {
  const [draft, setDraft] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const [attachmentError, setAttachmentError] = useState('')
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null)
  const attachmentPreviewRef = useRef<string | null>(null)
  const [imageInFocus, setImageInFocus] = useState<string | null>(null)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const selectionRef = useRef({ start: 0, end: 0 })

  useEffect(() => () => {
    if (attachmentPreviewRef.current) URL.revokeObjectURL(attachmentPreviewRef.current)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  useEffect(() => {
    if (!emojiPickerOpen) return

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !emojiPickerRef.current?.contains(event.target)) {
        setEmojiPickerOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setEmojiPickerOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [emojiPickerOpen])

  function selectImage(file: File | undefined) {
    if (!file) return
    const validation = validateImageFile(file)
    if (validation) {
      setAttachmentError(validation)
      clearAttachment()
      return
    }
    setAttachmentError('')
    if (attachmentPreviewRef.current) URL.revokeObjectURL(attachmentPreviewRef.current)
    attachmentPreviewRef.current = URL.createObjectURL(file)
    setAttachmentPreview(attachmentPreviewRef.current)
    setAttachment(file)
  }

  function clearAttachment() {
    if (attachmentPreviewRef.current) URL.revokeObjectURL(attachmentPreviewRef.current)
    attachmentPreviewRef.current = null
    setAttachmentPreview(null)
    setAttachment(null)
  }

  function toggleEmojiPicker() {
    const textarea = textareaRef.current
    if (textarea) {
      selectionRef.current = {
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
      }
    }
    setEmojiPickerOpen((open) => !open)
  }

  function insertEmoji(emoji: string) {
    const start = Math.min(selectionRef.current.start, draft.length)
    const end = Math.min(selectionRef.current.end, draft.length)
    if (draft.length + emoji.length - (end - start) > 10000) return

    const nextDraft = `${draft.slice(0, start)}${emoji}${draft.slice(end)}`
    const nextCursor = start + emoji.length
    selectionRef.current = { start: nextCursor, end: nextCursor }
    setDraft(nextDraft)
    setEmojiPickerOpen(false)
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor)
    })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if ((!draft.trim() && !attachment) || sending) return

    try {
      await onSend(draft, attachment)
      setDraft('')
      clearAttachment()
      setAttachmentError('')
    } catch {
      // The store exposes the send error in the chat composer.
    }
  }

  function handleComposerKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <section className="chat-window flex min-h-0 min-w-0 flex-1 flex-col bg-[#f3f6f4]">
      <header className="chat-header flex h-[76px] shrink-0 items-center gap-3 border-b border-[#e3ebe5] bg-white px-3 sm:px-6">
        <button className="icon-button md:hidden" type="button" title="Back to conversations" aria-label="Back to conversations" onClick={onBack}><ArrowLeft className="size-[18px]" /></button>
        <Avatar name={contact.display_name} src={contact.avatar_url} size="sm" />
        <div className="chat-header-copy min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold tracking-normal text-[#2d4237]">{contact.display_name}</h2>
          <p className="chat-header-subline mt-1 text-[11px] text-[#8a9991]"><MessagesSquare className="size-3.5" aria-hidden="true" /> One-to-one conversation</p>
        </div>
      </header>

      <div className="chat-wallpaper min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-6 sm:py-7" aria-label={`Messages with ${contact.display_name}`}>
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-[#829188]">Loading conversation…</div>
        ) : messages.length === 0 ? (
          <div className="conversation-empty flex h-full flex-col items-center justify-center px-5 text-center">
            <WelcomeArt compact />
            <span className="conversation-empty-label mt-4 text-[10px] font-semibold uppercase text-[#4c8a70]">Chatly · private conversation</span>
            <p className="mt-4 text-sm font-semibold text-[#485d50]">A fresh conversation</p>
            <p className="mt-1 max-w-xs text-xs leading-5 text-[#87948d]">Send a note or a photo to get things started.</p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-[850px] flex-col gap-2">
            {messages.map((message, index) => {
              const date = new Date(message.created_at).toDateString()
              const previousMessage = messages[index - 1]
              const showDate = !previousMessage || date !== new Date(previousMessage.created_at).toDateString()
              return (
                <div key={message.id}>
                  {showDate && <div className="message-date-divider"><span>{getDateHeading(message.created_at)}</span></div>}
                  <MessageBubble message={message} own={message.sender_id === userId} onOpenImage={setImageInFocus} />
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="composer-area shrink-0 border-t border-[#e3ebe5] bg-white px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 sm:px-5">
        {attachmentPreview && (
          <div className="mx-auto mb-3 flex max-w-[850px] items-center gap-3 rounded-[7px] border border-[#dce8df] bg-[#f7faf8] p-2.5">
            <img className="size-12 rounded-[4px] object-cover" src={attachmentPreview} alt="Selected image preview" />
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-[#53665a]">{attachment?.name}</span>
            <button className="icon-button icon-button-small" type="button" aria-label="Remove attachment" onClick={clearAttachment}><X className="size-4" /></button>
          </div>
        )}
        {(attachmentError || error) && <p className="mx-auto mb-2 max-w-[850px] whitespace-pre-line text-xs text-[#a54040]" role="alert">{attachmentError || error}</p>}
        <form className="composer mx-auto flex max-w-[850px] items-end gap-2" onSubmit={(event) => void submit(event)}>
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            onChange={(event) => { selectImage(event.currentTarget.files?.[0]); event.currentTarget.value = '' }}
          />
          <button className="icon-button mb-1" type="button" title="Attach an image" aria-label="Attach an image" onClick={() => fileInputRef.current?.click()}><Paperclip className="size-[18px]" /></button>
          <div className="emoji-picker-anchor mb-1" ref={emojiPickerRef}>
            <button
              className="icon-button"
              type="button"
              title="Insert emoji"
              aria-label="Insert emoji"
              aria-expanded={emojiPickerOpen}
              aria-haspopup="dialog"
              onMouseDown={(event) => event.preventDefault()}
              onClick={toggleEmojiPicker}
            >
              <Smile className="size-[18px]" aria-hidden="true" />
            </button>
            {emojiPickerOpen && (
              <div className="emoji-picker-popover" role="dialog" aria-label="Choose an emoji">
                <Suspense fallback={<div className="emoji-picker-loading">Loading emoji…</div>}>
                  <EmojiPicker
                    theme={(darkMode ? 'dark' : 'light') as EmojiTheme}
                    width="min(352px, calc(100vw - 28px))"
                    height="min(380px, 55dvh)"
                    searchPlaceholder="Search emoji"
                    lazyLoadEmojis
                    onEmojiClick={(emojiData) => insertEmoji(emojiData.emoji)}
                  />
                </Suspense>
              </div>
            )}
          </div>
          <label className="sr-only" htmlFor="message-composer">Write a message</label>
          <textarea
            ref={textareaRef}
            id="message-composer"
            className="min-h-11 max-h-36 min-w-0 flex-1 resize-y rounded-[6px] border border-[#e1e9e3] bg-[#f8faf8] px-3.5 py-3 text-sm leading-5 text-[#30443a] outline-none placeholder:text-[#9aa69f] focus:border-[#8dbba0] focus:ring-2 focus:ring-[#cde4d5]/60"
            placeholder="Write a message"
            rows={1}
            maxLength={10000}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              selectionRef.current = {
                start: event.currentTarget.selectionStart,
                end: event.currentTarget.selectionEnd,
              }
            }}
            onSelect={(event) => {
              selectionRef.current = {
                start: event.currentTarget.selectionStart,
                end: event.currentTarget.selectionEnd,
              }
            }}
            onKeyDown={handleComposerKeyDown}
          />
          <button className="send-button mb-0.5" type="submit" disabled={sending || (!draft.trim() && !attachment)} aria-label="Send message" title="Send message">
            <Send className="size-[17px]" aria-hidden="true" />
          </button>
        </form>
      </div>

      {imageInFocus && (
        <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Full-size image" onMouseDown={(event) => { if (event.target === event.currentTarget) setImageInFocus(null) }}>
          <button className="image-lightbox-close" type="button" aria-label="Close image" onClick={() => setImageInFocus(null)}><X className="size-5" /></button>
          <img src={imageInFocus} alt="Full-size message attachment" />
        </div>
      )}
      <span className="sr-only">Latest message time {messages.at(-1) ? formatMessageTime(messages.at(-1)!.created_at) : ''}</span>
    </section>
  )
}