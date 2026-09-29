import { MessageCircle, MessagesSquare } from 'lucide-react'

type WelcomeArtProps = {
  compact?: boolean
}

export function WelcomeArt({ compact = false }: WelcomeArtProps) {
  return (
    <div className={`welcome-art ${compact ? 'welcome-art-compact' : ''}`} aria-hidden="true">
      <div className="welcome-art-thread">
        <div className="welcome-art-bubble welcome-art-bubble-in">
          <span className="welcome-art-line welcome-art-line-long" />
          <span className="welcome-art-line welcome-art-line-short" />
        </div>
        <div className="welcome-art-bubble welcome-art-bubble-out">
          <span className="welcome-art-line welcome-art-line-long" />
          <span className="welcome-art-line welcome-art-line-medium" />
        </div>
        <div className="welcome-art-brand">
          <span className="welcome-art-brand-icon"><MessageCircle className="size-6" /></span>
          <span className="welcome-art-brand-mark"><MessagesSquare className="size-5" /></span>
        </div>
        <div className="welcome-art-bubble welcome-art-bubble-in welcome-art-bubble-last">
          <span className="welcome-art-line welcome-art-line-medium" />
        </div>
      </div>
    </div>
  )
}
