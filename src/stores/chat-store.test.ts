import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({
  requireSupabase: vi.fn(),
  supabase: null,
}))

import { requireSupabase } from '../lib/supabase'
import { useChatStore } from './chat-store'

const authenticatedUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const selectedContactId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const savedMessage = {
  id: '11111111-1111-4111-8111-111111111111',
  sender_id: authenticatedUserId,
  receiver_id: selectedContactId,
  body: 'hello from the authenticated user',
  image_path: null,
  created_at: '2026-09-28T12:00:00.000Z',
  delivered_at: null,
  read_at: null,
}

describe('sendMessage', () => {
  let getUser: ReturnType<typeof vi.fn>
  let insert: ReturnType<typeof vi.fn>
  let single: ReturnType<typeof vi.fn>
  let rpc: ReturnType<typeof vi.fn>

  beforeEach(() => {
    getUser = vi.fn().mockResolvedValue({
      data: { user: { id: authenticatedUserId } },
      error: null,
    })
    single = vi.fn().mockResolvedValue({ data: savedMessage, error: null })
    const select = vi.fn(() => ({ single }))
    insert = vi.fn(() => ({ select }))
    rpc = vi.fn().mockResolvedValue({ data: [], error: null })
    vi.mocked(requireSupabase).mockReturnValue({
      auth: { getUser },
      from: vi.fn(() => ({ insert })),
      rpc,
    } as never)

    useChatStore.setState({
      messages: [],
      sending: false,
      error: null,
    })
  })

  it('inserts body with the session user and selected contact IDs', async () => {
    await useChatStore.getState().sendMessage(
      authenticatedUserId,
      selectedContactId,
      '  hello from the authenticated user  ',
      null,
    )

    expect(getUser).toHaveBeenCalledOnce()
    expect(insert).toHaveBeenCalledWith({
      sender_id: authenticatedUserId,
      receiver_id: selectedContactId,
      body: 'hello from the authenticated user',
      image_path: null,
    })
    expect(useChatStore.getState().messages).toContainEqual(savedMessage)
    expect(useChatStore.getState().sending).toBe(false)
  })

  it('keeps the PostgREST error details visible in development', async () => {
    single.mockResolvedValue({
      data: null,
      error: {
        message: 'new row violates row-level security policy',
        code: '42501',
        details: 'sender_id does not match auth.uid()',
        hint: 'Sign in again and retry.',
      },
    })

    await expect(useChatStore.getState().sendMessage(
      authenticatedUserId,
      selectedContactId,
      'hello',
      null,
    )).rejects.toMatchObject({ code: '42501' })

    expect(useChatStore.getState().error).toContain('new row violates row-level security policy')
    expect(useChatStore.getState().error).toContain('Code: 42501')
    expect(useChatStore.getState().error).toContain('sender_id does not match auth.uid()')
    expect(useChatStore.getState().error).toContain('Sign in again and retry.')
    expect(useChatStore.getState().messages).toHaveLength(0)
    expect(useChatStore.getState().sending).toBe(false)
  })

  it('does not insert when the app user differs from the session user', async () => {
    await expect(useChatStore.getState().sendMessage(
      selectedContactId,
      authenticatedUserId,
      'hello',
      null,
    )).rejects.toThrow('Your signed-in account changed')

    expect(insert).not.toHaveBeenCalled()
    expect(useChatStore.getState().messages).toHaveLength(0)
  })
})