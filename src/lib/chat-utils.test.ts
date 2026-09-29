import { describe, expect, it } from 'vitest'
import { getDateHeading, getInitials, MAX_IMAGE_SIZE, validateImageFile } from './chat-utils'

describe('validateImageFile', () => {
  it('accepts supported image types up to 5 MB', () => {
    const file = new File([new Uint8Array(MAX_IMAGE_SIZE)], 'photo.webp', { type: 'image/webp' })
    expect(validateImageFile(file)).toBeNull()
  })

  it('rejects unsupported media types', () => {
    const file = new File(['not an image'], 'notes.txt', { type: 'text/plain' })
    expect(validateImageFile(file)).toMatch(/JPG, PNG, or WEBP/)
  })

  it('rejects images larger than 5 MB', () => {
    const file = new File([new Uint8Array(MAX_IMAGE_SIZE + 1)], 'large.png', { type: 'image/png' })
    expect(validateImageFile(file)).toMatch(/5 MB or smaller/)
  })
})

describe('chat formatting', () => {
  it('uses today and yesterday headings', () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    expect(getDateHeading(today.toISOString())).toBe('Today')
    expect(getDateHeading(yesterday.toISOString())).toBe('Yesterday')
  })

  it('creates initials from at most two name parts', () => {
    expect(getInitials('  Malia   Chen  ')).toBe('MC')
    expect(getInitials('')).toBe('?')
  })
})