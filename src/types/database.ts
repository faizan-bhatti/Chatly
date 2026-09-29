export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Profile = {
  id: string
  display_name: string
  avatar_url: string | null
  profile_setup_completed_at: string | null
  created_at: string
  updated_at: string
}

export type ContactPreview = {
  contact_id: string
  display_name: string
  avatar_url: string | null
  last_message: string | null
  last_message_is_image: boolean
  last_message_at: string | null
  unread_count: number
}

export type ChatMessage = {
  id: string
  sender_id: string
  receiver_id: string
  body: string | null
  image_path: string | null
  created_at: string
  delivered_at: string | null
  read_at: string | null
}

type Table<Row, Insert, Update> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export type Database = {
  __InternalSupabase: { PostgrestVersion: '14.1' }
  public: {
    Tables: {
      profiles: Table<
        Profile,
        Pick<Profile, 'id'> & Partial<Omit<Profile, 'id'>>,
        Partial<Omit<Profile, 'id' | 'created_at'>>
      >
      contacts: Table<
        { id: string; user_id: string; contact_id: string; created_at: string },
        { id?: string; user_id: string; contact_id: string; created_at?: string },
        never
      >
      messages: Table<
        ChatMessage,
        {
          id?: string
          sender_id: string
          receiver_id: string
          body?: string | null
          image_path?: string | null
          created_at?: string
          delivered_at?: string | null
          read_at?: string | null
        },
        { delivered_at?: string | null; read_at?: string | null }
      >
    }
    Views: Record<string, never>
    Functions: {
      search_profiles: {
        Args: { search_query: string }
        Returns: (Pick<Profile, 'display_name' | 'avatar_url'> & { user_id: string })[]
      }
      get_contact_list: {
        Args: Record<PropertyKey, never>
        Returns: ContactPreview[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}