// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { requireSupabase } from '../lib/supabase'
import { useChatStore } from './chat-store'
import type { ChatMessage } from '../types/database'

const realtimeMocks = vi.hoisted(() => ({
  channel: vi.fn(),
  removeChannel: vi.fn(),
  eventHandler: null as ((payload: unknown) => Promise<void>) | null,
  statusHandler: null as ((status: string) => void) | null,
}))

vi.mock('../lib/supabase', () => ({
  requireSupabase: vi.fn(),
  supabase: {
    channel: realtimeMocks.channel,
    removeChannel: realtimeMocks.removeChannel,
  },
}))

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const contactId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const messageId = '11111111-1111-4111-8111-111111111111'

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: messageId,
    sender_id: contactId,
    receiver_id: userId,
    body: 'status test',
    image_path: null,
    created_at: '2026-09-29T12:00:00.000Z',
    delivered_at: null,
    read_at: null,
    ...overrides,
  }
}

type DbRow = Record<string, unknown>
type DbResult = { data: DbRow[] | null; error: { message: string } | null }
type Query = PromiseLike<DbResult> & {
  select: (columns: string) => Query
  update: (values: Record<string, string>) => Query
  eq: (column: string, value: string) => Query
  is: (column: string, value: null) => Query
  in: (column: string, values: string[]) => Query
  limit: (value: number) => Query
}

describe('message delivery and seen status', () => {
  let rows: ChatMessage[]
  let updateLog: Array<{ values: Record<string, string>; filters: Record<string, unknown> }>
  let client: { from: ReturnType<typeof vi.fn>; rpc: ReturnType<typeof vi.fn> }
  let removeFocusSpy: (() => void) | undefined

  beforeEach(() => {
    rows = []
    updateLog = []
    realtimeMocks.eventHandler = null
    realtimeMocks.statusHandler = null
    realtimeMocks.channel.mockReset()
    realtimeMocks.removeChannel.mockReset()

    const channel = {
      on: vi.fn((_type: string, _filter: unknown, callback: (payload: unknown) => Promise<void>) => {
        realtimeMocks.eventHandler = callback
        return channel
      }),
      subscribe: vi.fn((callback: (status: string) => void) => {
        realtimeMocks.statusHandler = callback
        return channel
      }),
    }
    realtimeMocks.channel.mockReturnValue(channel)

    function createQuery(): Query {
      let columns = '*'
      let updateValues: Record<string, string> | null = null
      const filters: Record<string, unknown> = {}
      let maxRows: number | null = null
      const query = {} as Query

      query.select = (selectedColumns) => { columns = selectedColumns; return query }
      query.update = (values) => { updateValues = values; return query }
      query.eq = (column, value) => { filters[column] = value; return query }
      query.is = (column, value) => { filters[column] = value; return query }
      query.in = (column, values) => { filters[column] = values; return query }
      query.limit = (value) => { maxRows = value; return query }
      query.then = (resolve, reject) => Promise.resolve().then(() => {
        let matching = rows.filter((row) => Object.entries(filters).every(([column, value]) => {
          const actual = row[column as keyof ChatMessage]
          if (value === null) return actual === null
          if (Array.isArray(value)) return value.includes(String(actual))
          return actual === value
        }))
        if (maxRows !== null) matching = matching.slice(0, maxRows)

        if (updateValues) {
          updateLog.push({ values: updateValues, filters: { ...filters } })
          matching.forEach((row) => Object.assign(row, updateValues))
        }

        const fields = columns.split(',').map((column) => column.trim())
        const data = matching.map((row) => Object.fromEntries(fields.map((field) => [field, row[field as keyof ChatMessage]])))
        return { data, error: null }
      }).then(resolve, reject)
      return query
    }

    client = {
      from: vi.fn(() => createQuery()),
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    vi.mocked(requireSupabase).mockReturnValue(client as never)
    useChatStore.setState({
      contacts: [],
      activeContactId: null,
      messages: [],
      loadingContacts: false,
      loadingMessages: false,
      error: null,
    })

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    const focusSpy = vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    removeFocusSpy = () => focusSpy.mockRestore()
  })

  afterEach(() => removeFocusSpy?.())

  it('marks incoming messages seen only while their chat and tab are active', async () => {
    const received = makeMessage()
    rows = [received]
    useChatStore.setState({ activeContactId: contactId, messages: [{ ...received }] })

    await useChatStore.getState().markConversationSeen(userId, contactId)

    expect(updateLog).toHaveLength(2)
    expect(updateLog[0].values).toHaveProperty('delivered_at')
    expect(updateLog[0].values).not.toHaveProperty('read_at')
    expect(updateLog[1].values).toHaveProperty('read_at')
    expect(rows[0].read_at).toBeTruthy()
    expect(useChatStore.getState().messages[0].read_at).toBe(rows[0].read_at)
  })

  it('does not mark a background tab as seen', async () => {
    const received = makeMessage()
    rows = [received]
    useChatStore.setState({ activeContactId: contactId, messages: [{ ...received }] })
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })

    await useChatStore.getState().markConversationSeen(userId, contactId)

    expect(updateLog).toHaveLength(0)
    expect(rows[0].read_at).toBeNull()
  })

  it('marks a realtime arrival delivered when chat is closed and seen when visible chat is active', async () => {
    const received = makeMessage()
    rows = [received]
    useChatStore.getState().subscribeToMessages(userId)
    await realtimeMocks.eventHandler?.({ eventType: 'INSERT', new: received, old: {} })

    expect(updateLog.map((entry) => entry.values)).toEqual([{ delivered_at: expect.any(String) }])
    expect(rows[0].delivered_at).toBeTruthy()
    expect(rows[0].read_at).toBeNull()

    rows = [makeMessage({ id: '22222222-2222-4222-8222-222222222222' })]
    updateLog = []
    useChatStore.setState({ activeContactId: contactId, messages: [{ ...rows[0] }] })
    await realtimeMocks.eventHandler?.({ eventType: 'INSERT', new: rows[0], old: {} })

    expect(rows[0].delivered_at).toBeTruthy()
    expect(rows[0].read_at).toBeTruthy()
  })

  it('reconciles pending delivery on channel resubscription without creating another listener', async () => {
    const received = makeMessage()
    rows = [received]
    useChatStore.getState().subscribeToMessages(userId)
    expect(realtimeMocks.channel).toHaveBeenCalledOnce()
    realtimeMocks.statusHandler?.('SUBSCRIBED')

    await vi.waitFor(() => expect(rows[0].delivered_at).toBeTruthy())
    expect(rows[0].read_at).toBeNull()
    expect(realtimeMocks.channel).toHaveBeenCalledOnce()
  })

  it('refreshes the sender state from persisted status updates', async () => {
    const sent = makeMessage({ sender_id: userId, receiver_id: contactId, delivered_at: null, read_at: null })
    const updated = { ...sent, delivered_at: '2026-09-29T12:01:00.000Z', read_at: null }
    rows = [updated]
    useChatStore.setState({ activeContactId: contactId, messages: [{ ...sent }] })
    useChatStore.getState().subscribeToMessages(userId)
    await realtimeMocks.eventHandler?.({ eventType: 'UPDATE', new: updated, old: sent })

    expect(useChatStore.getState().messages[0].delivered_at).toBe(updated.delivered_at)
    expect(useChatStore.getState().messages[0].read_at).toBeNull()
  })
})
