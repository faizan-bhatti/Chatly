import { MessageCircle } from 'lucide-react'

export function LoadingScreen({ label = 'Opening your chats' }: { label?: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f3f6f4] text-[#243832]">
      <div className="flex items-center gap-3 text-sm font-medium">
        <MessageCircle className="size-5 animate-pulse text-[#178b67]" aria-hidden="true" />
        <span>{label}</span>
      </div>
    </main>
  )
}