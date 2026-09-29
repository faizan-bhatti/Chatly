import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { AuthPage } from './pages/AuthPage'
import { ChatPage } from './pages/ChatPage'
import { ProfileSetupPage } from './pages/ProfileSetupPage'
import { LoadingScreen } from './components/LoadingScreen'
import { ProfileReadyRoute, ProtectedRoute } from './components/ProtectedRoute'
import { isSupabaseConfigured } from './lib/supabase'
import { useAuthStore } from './stores/auth-store'

function AuthEntry() {
  const { initialized, profile, profileLoading, user } = useAuthStore((state) => state)

  if (!initialized || (user && profileLoading)) return <LoadingScreen />
  if (user) {
    return <Navigate to={profile?.profile_setup_completed_at ? '/chat' : '/setup'} replace />
  }

  return <AuthPage />
}

function ProfileSetupEntry() {
  const { profile, profileLoading } = useAuthStore((state) => state)

  if (profileLoading) return <LoadingScreen label="Loading your profile" />
  if (profile?.profile_setup_completed_at) return <Navigate to="/chat" replace />

  return <ProfileSetupPage />
}

function EnvironmentNotice() {
  return (
    <main className="auth-background grid min-h-screen place-items-center px-5 py-10 text-[#243832]">
      <section className="w-full min-w-0 max-w-[520px] rounded-[10px] bg-white p-8 shadow-[0_28px_90px_rgba(26,58,46,0.14)] sm:p-10">
        <span className="mb-6 grid size-11 place-items-center rounded-[9px] bg-[#e3f1e9] text-[#247257]"><MessageCircle className="size-5" aria-hidden="true" /></span>
        <p className="mb-2 text-xs font-semibold uppercase text-[#4c8a70]">Chatly · setup needed</p>
        <h1 className="mb-3 text-[28px] font-semibold tracking-normal">Connect your Supabase project</h1>
        <p className="mb-5 text-sm leading-6 text-[#78877f]">The app is ready, but this workspace has no Supabase project credentials yet. Add your project URL and public anon/publishable key to a local <code className="rounded bg-[#f1f5f2] px-1.5 py-0.5 text-xs">.env.local</code> file, then restart the dev server.</p>
        <pre className="min-w-0 max-w-full overflow-x-auto break-all rounded-[6px] bg-[#183c32] p-4 text-xs leading-6 text-[#dbefe4]">VITE_SUPABASE_URL=https://your-project.supabase.co{'\n'}VITE_SUPABASE_ANON_KEY=your-public-key</pre>
        <p className="mt-4 text-xs leading-5 text-[#78877f]">Use the project’s public anon/publishable key only. Never put a service-role key in this app. The workspace includes an <code className="rounded bg-[#f1f5f2] px-1.5 py-0.5 text-xs">.env.example</code> template.</p>
      </section>
    </main>
  )
}

export default function App() {
  const initialize = useAuthStore((state) => state.initialize)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('common-theme') === 'dark')

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    localStorage.setItem('common-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  return (
    <div className={`application-root ${darkMode ? 'theme-dark' : ''}`}>
      {!isSupabaseConfigured ? <EnvironmentNotice /> : (
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthEntry />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/setup" element={<ProfileSetupEntry />} />
              <Route element={<ProfileReadyRoute />}>
                <Route path="/chat" element={<ChatPage darkMode={darkMode} onToggleTheme={() => setDarkMode((current) => !current)} />} />
                <Route path="/chat/:contactId" element={<ChatPage darkMode={darkMode} onToggleTheme={() => setDarkMode((current) => !current)} />} />
              </Route>
            </Route>
            <Route path="/" element={<Navigate to="/chat" replace />} />
            <Route path="*" element={<Navigate to="/chat" replace />} />
          </Routes>
        </BrowserRouter>
      )}
    </div>
  )
}
