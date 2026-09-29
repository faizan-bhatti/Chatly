import { getInitials } from '../lib/chat-utils'

type AvatarProps = {
  name: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'size-10 text-xs',
  md: 'size-12 text-sm',
  lg: 'size-16 text-lg',
}

export function Avatar({ name, src, size = 'md' }: AvatarProps) {
  if (src) {
    return (
      <img
        className={`${sizeClasses[size]} shrink-0 rounded-full object-cover ring-1 ring-black/5`}
        src={src}
        alt=""
        loading="lazy"
      />
    )
  }

  return (
    <span
      className={`avatar-fallback ${sizeClasses[size]} grid shrink-0 place-items-center rounded-full bg-[#d9e9e2] font-semibold text-[#27634f]`}
      aria-label={name}
    >
      {getInitials(name)}
    </span>
  )
}