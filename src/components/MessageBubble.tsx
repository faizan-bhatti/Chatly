import { Check, CheckCheck, Clock3 } from 'lucide-react'
import { formatMessageTime } from '../lib/chat-utils'
import type { DisplayMessage } from '../stores/chat-store'

type MessageBubbleProps = {
  message: DisplayMessage
  own: boolean
  onOpenImage: (src: string) => void
}

export function MessageBubble({ message, own, onOpenImage }: MessageBubbleProps) {
  return (
    <article className={`message-row ${own ? 'message-row-own' : 'message-row-other'}`}>
      <div className={`message-bubble ${own ? 'message-bubble-own' : 'message-bubble-other'}`}>
        {message.image_url && (
          <button className="message-image-button" type="button" onClick={() => onOpenImage(message.image_url!)} aria-label="Open full-size image">
            <img className="message-image" src={message.image_url} alt="Image attachment" loading="lazy" />
          </button>
        )}
        {message.image_path && !message.image_url && <p className="mb-1 text-xs text-[#7a8981]">Image unavailable</p>}
        {message.body && <p className="message-copy">{message.body}</p>}
        <footer className={`message-meta ${own ? 'message-meta-own' : 'message-meta-other'}`}>
          <time dateTime={message.created_at}>{formatMessageTime(message.created_at)}</time>
          {own && <MessageStatus message={message} />}
        </footer>
      </div>
    </article>
  )
}

function MessageStatus({ message }: { message: DisplayMessage }) {
  if (message.sending) return <Clock3 className="size-3.5 text-[#82968a]" aria-label="Sending" />
  if (message.read_at) return <CheckCheck className="size-3.5 text-[#2897b6]" aria-label="Read" />
  if (message.delivered_at) return <CheckCheck className="size-3.5 text-[#6b8275]" aria-label="Delivered" />
  return <Check className="size-3.5 text-[#6b8275]" aria-label="Sent" />
}