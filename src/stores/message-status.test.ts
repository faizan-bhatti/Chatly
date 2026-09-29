import { beforeEach, describe, expect, it, vi } from 'vitest'

const realtime = vi.hoisted(() => ({
  channel: vi.fn(),
  event: vi.fn(),
  status: vi.fn(),
  removeChannel: vi.fn(),
  from: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  requireSupabase: vi.fn(),
  supabase: {
    channel: realtime.channel,
    removeChannel: realtime.removeChannel,
    from: realtime.from,
  },
}))

import { requireSupabase } from '../lib/supabase'
import { useChatStore } from './chat-store'

const senderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const receiverId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const incomingMessage = {
  id: '11111111-1111-4111-8111-111111111111',
  sender_id: senderId,
  receiver_id: receiverId,
  body: 'status test',
  image_path: null,
  created_at: '2026-09-29T12:00:00.000Z',
  delivered_at: null,
  read_at: null,
}

describe('realtime message delivery and read receipts', () => {
  let updates: Record<string, string>[]
  let selectResults: { data: unknown[]; error: null }[]

  beforeEach(() => {
    updates = []
    selectResults = []

    const channel = {
      on: vi.fn((_type, _filter, callback) => {
        realtime.event(callback)
        return channel
      }),
      subscribe: vi.fn((callback) => {
        realtime.status(callback)
        return channel
      }),
    }
    realtime.channel.mockReturnValue(channel)
    realtime.event.mockReset()
    realtime.status.mockReset()
    realtime.removeChannel.mockReset()

    function createQuery() {
      let operation: 'select' | 'update' | null = null
      const query: Record<string, unknown> & { then: (resolve: (value: unknown) => unknown) => Promise<unknown> } = {
        select: vi.fn(() => { operation = 'select'; return query }),
        update: vi.fn((values: Record<string, string>) => { operation = 'update'; updates.push(values); return query }),
        eq: vi.fn(() => query),
        is: vi.fn(() => query),
        in: vi.fn(() => query),
        or: vi.fn(() => query),
        limit: vi.fn(() => query),
        order: vi.fn(() => query),
        then: (resolve) => {
          const result = operation === 'select'
            ? selectResults.shift() ?? { data: [], error: null }
            : { data: null, error: null }
          return Promise.resolve(result).then(resolve)
        },
      }
      return query
    }

    realtime.from.mockImplementation(() => createQuery())

    vi.mocked(requireSupabase).mockReturnValue({
      from: vi.fn(() => createQuery()),
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as never)

    useChatStore.setState({
      activeContactId: null,
      messages: [],
      loadingMessages: false,
      loadingContacts: false,
      error: null,
    })
  })

  it('marks a realtime message delivered without marking it read when chat is closed', async () => {
    useChatStore.getState().subscribeToMessages(receiverId)
    const onChange = realtime.event.mock.calls[0][0]

    await onChange({ eventType: 'INSERT', new: incomingMessage, old: {} })

    expect(updates).toHaveLength(1)
    expect(updates[0]).toHaveProperty('delivered_at')
    expect(updates[0]).not.toHaveProperty('read_at')
    expect(useChatStore.getState().activeContactId).toBeNull()
  })

  it('marks an incoming realtime message read only when its conversation is active', async () => {
    useChatStore.setState({ activeContactId: senderId })
    useChatStore.getState().subscribeToMessages(receiverId)
    const onChange = realtime.event.mock.calls[0][0]

    await onChange({ eventType: 'INSERT', new: incomingMessage, old: {} })

    expect(updates).toHaveLength(1)
    expect(updates[0]).toHaveProperty('delivered_at')
    expect(updates[0]).toHaveProperty('read_at')
    expect(useChatStore.getState().messages[0]).toMatchObject({
      delivered_at: expect.any(String),
      read_at: expect.any(String),
    })
  })

  it('marks incoming history delivered and read when the receiver opens that chat', async () => {
    selectResults.push({ data: [incomingMessage], error: null })
    useChatStore.setState({ activeContactId: senderId })

    await useChatStore.getState().loadMessages(receiverId, senderId)

    expect(updates).toHaveLength(1)
    expect(updates[0]).toHaveProperty('delivered_at')
    expect(updates[0]).toHaveProperty('read_at')
    expect(useChatStore.getState().messages[0]).toMatchObject({
      delivered_at: expect.any(String),
      read_at: expect.any(String),
    })
  })

  it('applies delivery/read UPDATE events to the sender message already in state', async () => {
    const sentMessage = { ...incomingMessage, sender_id: receiverId, receiver_id: senderId }
    const deliveredAt = '2026-09-29T12:01:00.000Z'
    useChatStore.setState({ activeContactId: receiverId, messages: [sentMessage] })
    useChatStore.getState().subscribeToMessages(senderId)
    const onChange = realtime.event.mock.calls[0][0]

    await onChange({
      eventType: 'UPDATE',
      new: { ...sentMessage, delivered_at: deliveredAt, read_at: null },
      old: sentMessage,
    })

    expect(useChatStore.getState().messages[0]).toMatchObject({
      delivered_at: deliveredAt,
      read_at: null,
    })
  })

  it('reconciles missed delivery receipts after realtime reconnect', async () => {
    selectResults.push({ data: [incomingMessage], error: null }, { data: [], error: null })
    useChatStore.getState().subscribeToMessages(receiverId)
    const onStatus = realtime.status.mock.calls[0][0]

    onStatus('SUBSCRIBED')
    await vi.waitFor(() => expect(updates).toHaveLength(1))

    expect(updates[0]).toHaveProperty('delivered_at')
    expect(updates[0]).not.toHaveProperty('read_at')
    expect(realtime.channel).toHaveBeenCalledOnce()
  })
})