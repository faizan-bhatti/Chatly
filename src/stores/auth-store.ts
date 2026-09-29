import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import { requireSupabase, supabase } from '../lib/supabase'
import type { Profile } from '../types/database'

type AuthState = {
  user: User | null
  profile: Profile | null
  initialized: boolean
  profileLoading: boolean
  error: string | null
  initialize: () => Promise<void>
  loadProfile: () => Promise<void>
  saveProfile: (displayName: string, avatarUrl: string | null) => Promise<Profile>
  signOut: () => Promise<void>
}

let unsubscribeAuth: (() => void) | null = null

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  initialized: false,
  profileLoading: false,
  error: null,

  initialize: async () => {
    if (!supabase) {
      set({ initialized: true })
      return
    }

    if (!unsubscribeAuth) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        const user = session?.user ?? null
        set({ user, profile: user ? get().profile : null })

        if (user) {
          set({ profileLoading: true })
          window.setTimeout(() => void get().loadProfile(), 0)
        } else {
          set({ profileLoading: false, profile: null })
        }
      })

      unsubscribeAuth = () => data.subscription.unsubscribe()
    }

    const { data, error } = await requireSupabase().auth.getSession()
    if (error) set({ error: error.message })
    set({ user: data.session?.user ?? null, initialized: true })

    if (data.session?.user) await get().loadProfile()
  },

  loadProfile: async () => {
    const user = get().user
    if (!user) {
      set({ profile: null, profileLoading: false })
      return
    }

    set({ profileLoading: true, error: null })
    const { data, error } = await requireSupabase()
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    set({
      profile: data,
      profileLoading: false,
      error: error?.message ?? null,
    })
  },

  saveProfile: async (displayName, avatarUrl) => {
    const user = get().user
    if (!user) throw new Error('Sign in before setting up your profile.')

    const { data, error } = await requireSupabase()
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        avatar_url: avatarUrl,
        profile_setup_completed_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('*')
      .single()

    if (error) throw error
    set({ profile: data })
    return data
  },

  signOut: async () => {
    const { error } = await requireSupabase().auth.signOut()
    if (error) throw error
  },
}))