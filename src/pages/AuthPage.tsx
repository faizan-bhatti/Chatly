import { useState, type FormEvent } from 'react'
import { ArrowRight, Check, LockKeyhole, Mail, MessageCircle, Phone, ShieldCheck } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { requireSupabase } from '../lib/supabase'

type AuthMethod = 'email' | 'phone'
type AuthMode = 'login' | 'signup'

export function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [method, setMethod] = useState<AuthMethod>('email')
  const [mode, setMode] = useState<AuthMode>('login')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const finishSignIn = () => {
    const destination = (location.state as { from?: string } | null)?.from ?? '/chat'
    navigate(destination, { replace: true })
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (mode === 'signup' && displayName.trim().length === 0) {
      setError('Enter the name you want people to see.')
      return
    }

    if (mode === 'signup' && password.length < 8) {
      setError('Use a password with at least 8 characters.')
      return
    }

    setBusy(true)
    try {
      const client = requireSupabase()
      if (mode === 'signup') {
        const { data, error: authError } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() },
            emailRedirectTo: `${window.location.origin}/chat`,
          },
        })
        if (authError) throw authError
        if (data.session) finishSignIn()
        else setNotice('Check your email for a confirmation link to finish creating your account.')
      } else {
        const { error: authError } = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (authError) throw authError
        finishSignIn()
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign in right now.')
    } finally {
      setBusy(false)
    }
  }

  async function submitPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!/^\+[1-9]\d{7,14}$/.test(phone.trim())) {
      setError('Enter your number in international format, for example +14155550123.')
      return
    }

    if (mode === 'signup' && displayName.trim().length === 0) {
      setError('Enter the name you want people to see.')
      return
    }

    setBusy(true)
    try {
      const client = requireSupabase()
      if (!otpSent) {
        const { error: authError } = await client.auth.signInWithOtp({
          phone: phone.trim(),
          options: {
            shouldCreateUser: mode === 'signup',
            data: mode === 'signup' ? { display_name: displayName.trim() } : undefined,
          },
        })
        if (authError) throw authError
        setOtpSent(true)
        setNotice('A verification code has been sent to your phone.')
      } else {
        const { error: authError } = await client.auth.verifyOtp({
          phone: phone.trim(),
          token: token.trim(),
          type: 'sms',
        })
        if (authError) throw authError
        finishSignIn()
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to verify this number.')
    } finally {
      setBusy(false)
    }
  }

  const isSignup = mode === 'signup'

  return (
    <main className="auth-background auth-layout flex min-h-screen items-center justify-center px-5 py-10 text-[#243832]">
      <section className="auth-panel grid w-full max-w-[1060px] overflow-hidden rounded-[10px] bg-white shadow-[0_28px_90px_rgba(26,58,46,0.14)] md:min-h-[650px] md:grid-cols-[0.95fr_1.05fr]">
        <aside className="auth-brand-panel relative hidden flex-col justify-between overflow-hidden p-10 text-white md:flex lg:p-12">
          <a className="relative flex items-center gap-3 font-semibold tracking-normal" href="/auth">
            <span className="auth-brand-mark grid size-11 place-items-center rounded-[13px] bg-[#a8d7bb] text-[#174b3d]">
              <MessageCircle className="size-5" aria-hidden="true" />
            </span>
            <span className="text-[17px]">Chatly</span>
          </a>
          <div className="auth-brand-copy relative max-w-[380px] pb-4">
            <p className="mb-4 text-[11px] font-semibold uppercase text-[#bce2c6]">Conversations, made closer</p>
            <h1 className="mb-5 text-[40px] font-semibold leading-[1.06] tracking-normal lg:text-[44px]">
              Good conversations, right where you left them.
            </h1>
            <p className="max-w-[310px] text-sm leading-6 text-white/75">
              Your messages stay between you and the people you choose.
            </p>
          </div>
          <div className="auth-conversation-art" aria-hidden="true">
            <div className="auth-art-header">
              <span className="auth-art-avatar">M</span>
              <span className="auth-art-contact"><strong>Morgan Lee</strong><small>Conversation preview</small></span>
              <ShieldCheck className="size-4 text-[#bce2c6]" />
            </div>
            <div className="auth-art-messages">
              <span className="auth-art-bubble auth-art-bubble-in">Made it home. Thanks for today.</span>
              <span className="auth-art-bubble auth-art-bubble-out">Already looking forward to next time.</span>
              <span className="auth-art-time"><Check className="size-3" /> Just now</span>
            </div>
          </div>
          <div className="auth-brand-foot relative flex items-center gap-2 text-xs text-white/65">
            <span className="size-1.5 rounded-full bg-[#9ed5ad]" aria-hidden="true" />
            Private one-to-one messaging
          </div>
        </aside>

        <div className="auth-form-column flex flex-col justify-center px-6 py-9 sm:px-12 md:px-14">
          <div className="auth-mobile-brand mb-8 md:hidden">
            <span className="auth-brand-mark-mobile grid size-11 place-items-center rounded-[13px] bg-[#e3f1e9] text-[#247257]">
              <MessageCircle className="size-5" aria-hidden="true" />
            </span>
            <span><strong>Chatly</strong><small>Conversations, made closer</small></span>
          </div>
          <p className="mb-2 text-xs font-semibold uppercase text-[#4c8a70]">
            {isSignup ? 'Join Chatly' : 'Welcome back'}
          </p>
          <h2 className="mb-2 text-[28px] font-semibold tracking-normal text-[#243832]">
            {isSignup ? 'Create your account' : 'Sign in to your account'}
          </h2>
          <p className="mb-7 text-sm text-[#78877f]">
            {isSignup ? 'A name and a way to reach you is all you need.' : 'Pick up the conversation.'}
          </p>

          <div className="auth-method-tabs mb-6 grid grid-cols-2 rounded-[7px] bg-[#f1f5f2] p-1" role="tablist" aria-label="Sign-in method">
            <button
              type="button"
              role="tab"
              aria-selected={method === 'email'}
              className={`flex h-10 items-center justify-center gap-2 rounded-[5px] text-sm font-medium transition ${method === 'email' ? 'bg-white text-[#245c49] shadow-sm' : 'text-[#718078] hover:text-[#314b3f]'}`}
              onClick={() => { setMethod('email'); setError(''); setNotice('') }}
            >
              <Mail className="size-4" aria-hidden="true" /> Email
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={method === 'phone'}
              className={`flex h-10 items-center justify-center gap-2 rounded-[5px] text-sm font-medium transition ${method === 'phone' ? 'bg-white text-[#245c49] shadow-sm' : 'text-[#718078] hover:text-[#314b3f]'}`}
              onClick={() => { setMethod('phone'); setOtpSent(false); setError(''); setNotice('') }}
            >
              <Phone className="size-4" aria-hidden="true" /> Phone
            </button>
          </div>

          {method === 'email' ? (
            <form className="space-y-4" onSubmit={submitEmail}>
              {isSignup && (
                <label className="auth-label">
                  Display name
                  <input className="auth-input" autoComplete="name" maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
                </label>
              )}
              <label className="auth-label">
                Email address
                <span className="auth-input-wrap auth-input-icon-wrap"><Mail className="auth-field-icon" aria-hidden="true" /><input className="auth-input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></span>
              </label>
              <label className="auth-label">
                Password
                <span className="auth-input-wrap auth-input-icon-wrap"><LockKeyhole className="auth-field-icon" aria-hidden="true" /><input className="auth-input" type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} minLength={isSignup ? 8 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} required /></span>
              </label>
              <AuthFeedback error={error} notice={notice} />
              <button className="auth-submit" type="submit" disabled={busy}>
                {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
                {!busy && <ArrowRight className="size-4" aria-hidden="true" />}
              </button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={submitPhone}>
              {isSignup && !otpSent && (
                <label className="auth-label">
                  Display name
                  <input className="auth-input" autoComplete="name" maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
                </label>
              )}
              <label className="auth-label">
                Phone number
                <span className="auth-input-wrap auth-input-icon-wrap"><Phone className="auth-field-icon" aria-hidden="true" /><input className="auth-input" type="tel" autoComplete="tel" placeholder="+14155550123" value={phone} onChange={(event) => setPhone(event.target.value)} required disabled={otpSent} /></span>
              </label>
              {otpSent && (
                <label className="auth-label">
                  Verification code
                  <input className="auth-input tracking-[0.2em]" inputMode="numeric" autoComplete="one-time-code" value={token} onChange={(event) => setToken(event.target.value)} required />
                </label>
              )}
              <AuthFeedback error={error} notice={notice} />
              <button className="auth-submit" type="submit" disabled={busy}>
                {busy ? 'Please wait…' : otpSent ? 'Verify code' : 'Send verification code'}
                {!busy && <ArrowRight className="size-4" aria-hidden="true" />}
              </button>
              {otpSent && <button className="mx-auto block text-xs font-semibold text-[#4c8a70] hover:underline" type="button" onClick={() => { setOtpSent(false); setToken(''); setNotice(''); setError('') }}>Use another number</button>}
            </form>
          )}

          <p className="mt-7 text-center text-sm text-[#78877f]">
            {isSignup ? 'Already have an account?' : 'New to Chatly?'}{' '}
            <button className="font-semibold text-[#267454] hover:underline" type="button" onClick={() => { setMode(isSignup ? 'login' : 'signup'); setOtpSent(false); setError(''); setNotice('') }}>
              {isSignup ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </div>
      </section>
    </main>
  )
}

function AuthFeedback({ error, notice }: { error: string; notice: string }) {
  if (error) return <p className="auth-error" role="alert">{error}</p>
  if (notice) return <p className="auth-notice" role="status">{notice}</p>
  return null
}