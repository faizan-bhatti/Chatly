import { useState, type FormEvent } from 'react'
import { ArrowRight, LogOut, MessageCircle } from 'lucide-react'
import { useAuthStore } from '../stores/auth-store'
import { Avatar } from '../components/Avatar'

export function ProfileSetupPage() {
  const { profile, user, saveProfile, signOut } = useAuthStore((state) => state)
  const initialName = profile?.display_name === 'New user'
    ? String(user?.user_metadata.display_name ?? '')
    : profile?.display_name ?? ''
  const [displayName, setDisplayName] = useState(initialName)
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const name = displayName.trim()
    if (!name || name.length > 80) {
      setError('Choose a display name between 1 and 80 characters.')
      return
    }

    let photo: string | null = null
    if (avatarUrl.trim()) {
      try {
        const parsedUrl = new URL(avatarUrl.trim())
        if (!['https:', 'http:'].includes(parsedUrl.protocol)) throw new Error()
        if (avatarUrl.trim().length > 2048) throw new Error()
        photo = parsedUrl.toString()
      } catch {
        setError('Enter a valid HTTP or HTTPS avatar URL.')
        return
      }
    }

    setBusy(true)
    try {
      await saveProfile(name, photo)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save your profile.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-background flex min-h-screen items-center justify-center px-5 py-10 text-[#243832]">
      <section className="profile-panel w-full max-w-[500px] rounded-[10px] bg-white p-7 shadow-[0_28px_90px_rgba(26,58,46,0.14)] sm:p-10">
        <div className="profile-brand mb-8 flex items-center gap-3">
          <span className="auth-brand-mark-mobile grid size-11 place-items-center rounded-[13px] bg-[#e3f1e9] text-[#247257]"><MessageCircle className="size-5" aria-hidden="true" /></span>
          <span className="text-[17px] font-semibold">Chatly</span>
        </div>
        <p className="mb-2 text-xs font-semibold uppercase text-[#4c8a70]">One last thing</p>
        <h1 className="mb-2 text-[28px] font-semibold tracking-normal">Set up your profile</h1>
        <p className="mb-7 text-sm leading-6 text-[#78877f]">Choose how you’ll appear to people you connect with.</p>
        <form className="space-y-5" onSubmit={submit}>
          <div className="flex items-center gap-4">
            <Avatar name={displayName || 'You'} src={avatarUrl || null} size="lg" />
            <p className="text-xs leading-5 text-[#78877f]">An avatar URL is optional. Your initials appear when it’s blank.</p>
          </div>
          <label className="auth-label">
            Display name
            <input className="auth-input" autoComplete="name" maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
          </label>
          <label className="auth-label">
            Avatar URL <span className="font-normal text-[#8a9891]">Optional</span>
            <input className="auth-input" type="url" inputMode="url" placeholder="https://example.com/photo.jpg" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} />
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          {!profile && <p className="auth-error" role="alert">Your profile record is missing. Confirm the profile-creation trigger is installed, then sign out and sign in again.</p>}
          <button className="auth-submit" type="submit" disabled={busy || !profile}>
            {busy ? 'Saving…' : 'Continue to chats'}
            {!busy && <ArrowRight className="size-4" aria-hidden="true" />}
          </button>
        </form>
        <button className="mt-5 flex w-full items-center justify-center gap-2 text-sm font-medium text-[#77857e] hover:text-[#314b3f]" type="button" onClick={() => void signOut()}>
          <LogOut className="size-4" aria-hidden="true" /> Sign out
        </button>
      </section>
    </main>
  )
}