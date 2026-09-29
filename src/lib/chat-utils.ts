export const MAX_IMAGE_SIZE = 5 * 1024 * 1024
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Choose a JPG, PNG, or WEBP image.'
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return 'Images must be 5 MB or smaller.'
  }

  return null
}

export function getDateHeading(date: string): string {
  const messageDate = new Date(date)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (messageDate.toDateString() === today.toDateString()) return 'Today'
  if (messageDate.toDateString() === yesterday.toDateString()) return 'Yesterday'

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: messageDate.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  }).format(messageDate)
}

export function formatMessageTime(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date))
}

export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?'
}