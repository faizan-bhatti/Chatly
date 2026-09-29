// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useChatStore } from '../stores/chat-store'
import { ChatPage } from './ChatPage'

const statusMocks = vi.hoisted(() => ({
  markConversationSeen: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../stores/auth-store', async () => {
  const { create } = await import('zustand')
  return {
    useAuthStore: create(() => ({
      user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
      profile: {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        display_name: 'Test Sender',
        avatar_url: null,
        profile_setup_completed_at: '2026-09-29T00:00:00.000Z',
        created_at: '2026-09-29T00:00:00.000Z',
        updated_at: '2026-09-29T00:00:00.000Z',
      },
      signOut: vi.fn().mockResolvedValue(undefined),
    })),
  }
})

vi.mock('../stores/chat-store', async () => {
  const { create } = await import('zustand')
  const contacts = [
    {
      contact_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      display_name: 'Receiver One',
      avatar_url: null,
      last_message: null,
      last_message_is_image: false,
      last_message_at: null,
      unread_count: 0,
    },
    {
      contact_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      display_name: 'Receiver Two',
      avatar_url: null,
      last_message: null,
      last_message_is_image: false,
      last_message_at: null,
      unread_count: 0,
    },
  ]

  return {
    useChatStore: create((set) => ({
      contacts,
      activeContactId: null,
      messages: [],
      loadingContacts: false,
      loadingMessages: false,
      sending: false,
      error: null,
      loadContacts: vi.fn().mockResolvedValue(undefined),
      searchProfiles: vi.fn().mockResolvedValue([]),
      addContact: vi.fn().mockResolvedValue(undefined),
      removeContact: vi.fn().mockResolvedValue(undefined),
      selectContact: (contactId: string | null) => set({ activeContactId: contactId, messages: [], error: null }),
      loadMessages: vi.fn().mockResolvedValue(undefined),
      markConversationSeen: statusMocks.markConversationSeen,
      sendMessage: vi.fn().mockResolvedValue(undefined),
      subscribeToMessages: vi.fn().mockReturnValue(() => undefined),
    })),
  }
})

vi.mock('../components/ChatWindow', async () => {
  const React = await import('react')
  return {
    ChatWindow: ({ contact, onBack }: { contact: { display_name: string }; onBack: () => void }) =>
      React.createElement(
        'section',
        { 'data-testid': 'active-chat' },
        React.createElement('h2', null, contact.display_name),
        React.createElement('button', { type: 'button', onClick: onBack }, 'Back to conversations'),
      ),
  }
})

function RouterHarness() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <>
      <output data-testid="current-path">{location.pathname}</output>
      <button type="button" onClick={() => navigate(-1)}>Browser back</button>
      <button type="button" onClick={() => navigate(1)}>Browser forward</button>
      <Routes>
        <Route path="/chat" element={<ChatPage darkMode={false} onToggleTheme={() => undefined} />} />
        <Route path="/chat/:contactId" element={<ChatPage darkMode={false} onToggleTheme={() => undefined} />} />
      </Routes>
    </>
  )
}

describe('chat route selection', () => {
  beforeEach(() => {
    statusMocks.markConversationSeen.mockClear()
    useChatStore.setState({ activeContactId: null, messages: [], error: null })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('marks a directly opened route as seen when its tab is visible and focused', async () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })

    render(
      <MemoryRouter initialEntries={['/chat/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']}>
        <RouterHarness />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Receiver One' })).toBeTruthy()
    await waitFor(() => {
      expect(statusMocks.markConversationSeen).toHaveBeenCalledWith(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      )
    })

    fireEvent.focus(window)
    fireEvent(document, new Event('visibilitychange'))
    expect(statusMocks.markConversationSeen.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('opens the same contact again after back and supports browser back/forward', async () => {
    render(
      <MemoryRouter initialEntries={['/chat']}>
        <RouterHarness />
      </MemoryRouter>,
    )

    const path = () => screen.getByTestId('current-path').textContent
    const contact = screen.getByRole('button', { name: /Receiver One/ })

    fireEvent.click(contact)
    expect(await screen.findByTestId('active-chat')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Receiver One' })).toBeTruthy()
    expect(path()).toBe('/chat/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
    expect(useChatStore.getState().activeContactId).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')

    fireEvent.click(screen.getByRole('button', { name: 'Back to conversations' }))
    await waitFor(() => expect(path()).toBe('/chat'))
    await waitFor(() => expect(useChatStore.getState().activeContactId).toBeNull())

    fireEvent.click(screen.getByRole('button', { name: /Receiver One/ }))
    expect(await screen.findByTestId('active-chat')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Receiver One' })).toBeTruthy()
    expect(path()).toBe('/chat/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')

    fireEvent.click(screen.getByRole('button', { name: 'Browser back' }))
    await waitFor(() => expect(path()).toBe('/chat'))
    await waitFor(() => expect(useChatStore.getState().activeContactId).toBeNull())

    fireEvent.click(screen.getByRole('button', { name: 'Browser forward' }))
    await waitFor(() => expect(path()).toBe('/chat/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'))
    await waitFor(() => expect(useChatStore.getState().activeContactId).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'))
    expect(screen.getByRole('heading', { name: 'Receiver One' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Browser back' }))
    await waitFor(() => expect(path()).toBe('/chat'))
    fireEvent.click(screen.getByRole('button', { name: /Receiver Two/ }))
    await waitFor(() => expect(path()).toBe('/chat/cccccccc-cccc-4ccc-8ccc-cccccccccccc'))
    expect(await screen.findByRole('heading', { name: 'Receiver Two' })).toBeTruthy()
    expect(useChatStore.getState().activeContactId).toBe('cccccccc-cccc-4ccc-8ccc-cccccccccccc')
  })
})