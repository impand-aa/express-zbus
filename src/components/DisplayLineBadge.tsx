import type { CSSProperties } from 'react'

import type { DisplayLinePreview } from '../types'

interface DisplayLineBadgeProps {
  className?: string
  forceSquare?: boolean
  preview: DisplayLinePreview | null
}

export function DisplayLineBadge({
  className,
  forceSquare = false,
  preview,
}: DisplayLineBadgeProps) {
  if (!preview) {
    return null
  }

  const text = preview.text.trim() || '/'

  const style = {
    backgroundColor: preview.backgroundColor,
    color: preview.textColor,
  } satisfies CSSProperties

  const badgeClassName = [
    'display-line-badge',
    preview.isRounded && !forceSquare ? 'is-pill' : '',
    text.length > 2 ? 'has-long-text' : '',
    className ?? '',
  ].filter(Boolean).join(' ')

  return (
    <div className={badgeClassName} style={style}>
      <span className="display-line-badge__text">{text}</span>
    </div>
  )
}