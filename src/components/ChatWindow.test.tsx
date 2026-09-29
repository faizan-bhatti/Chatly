// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ContactPreview } from '../types/database'
import { ChatWindow } from './ChatWindow'

vi.mock('emoji-picker-react', () => ({
  default: ({ onEmojiClick }: { onEmojiClick: (data: { emoji: string }) => void }) => (
    <div>
      <input aria-label="Search emoji" placeholder="Search emoji" />
      <button type="button" onClick={() => onEmojiClick({ emoji: '😀' })}>Insert grin</button>
    </div>
  ),
}))

const contact: ContactPreview = {
  contact_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  display_name: 'Receiver',
  avatar_url: null,
  last_message: null,
  last_message_is_image: false,
  last_message_at: null,
  unread_count: 0,
}

const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL

function renderChat(onSend = vi.fn().mockResolvedValue(undefined)) {
  render(
    <ChatWindow
      userId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      contact={contact}
      messages={[]}
      loading={false}
      sending={false}
      darkMode={false}
      error={null}
      onSend={onSend}
      onBack={() => undefined}
    />,
  )
  return onSend
}

describe('ChatWindow composer', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    })
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:test-image-preview'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    })
  })

  afterEach(() => {
    cleanup()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectURL })
  })

  it('searches and inserts multiple emojis alongside text at the cursor', async () => {
    renderChat()
    const textarea = screen.getByRole('textbox', { name: 'Write a message' }) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'hi there' } })
    textarea.setSelectionRange(2, 2)
    fireEvent.select(textarea)

    fireEvent.click(screen.getByRole('button', { name: 'Insert emoji' }))
    expect(await screen.findByRole('textbox', { name: 'Search emoji' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Insert grin' }))
    expect(textarea.value).toBe('hi😀 there')

    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    fireEvent.select(textarea)
    fireEvent.click(screen.getByRole('button', { name: 'Insert emoji' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Insert grin' }))
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    fireEvent.select(textarea)
    fireEvent.click(screen.getByRole('button', { name: 'Insert emoji' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Insert grin' }))

    expect(textarea.value).toBe('hi😀 there😀😀')
  })

  it('previews, cancels, and sends an allowed image attachment', async () => {
    const onSend = renderChat()
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const image = new File([new Uint8Array([1, 2, 3])], 'photo.png', { type: 'image/png' })

    fireEvent.change(fileInput, { target: { files: [image] } })
    expect(await screen.findByAltText('Selected image preview')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Send message' }).hasAttribute('disabled')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Remove attachment' }))
    expect(screen.queryByAltText('Selected image preview')).toBeNull()

    fireEvent.change(fileInput, { target: { files: [image] } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    await waitFor(() => expect(onSend).toHaveBeenCalledWith('', image))
  })

  it('rejects unsupported image types', () => {
    renderChat()
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['not an image'], 'notes.txt', { type: 'text/plain' })

    fireEvent.change(fileInput, { target: { files: [file] } })
    expect(screen.getByRole('alert').textContent).toContain('Choose a JPG, PNG, or WEBP image.')
    expect(screen.queryByAltText('Selected image preview')).toBeNull()
  })
})