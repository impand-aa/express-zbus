import { useLayoutEffect, useRef, useState, type DragEvent as ReactDragEvent } from 'react'
import { Button, ButtonGroup, Form } from 'react-bootstrap'

import {
  createAdvanceRow,
  createAnnouncementRow,
  createCustomRow,
  createJourneyArgument,
  createPanelRow,
  createStopRow,
} from '../lib/document'
import type { ImportedSoundDefinition, JourneyOrderArgument, JourneyOrderRow, ScalarKind } from '../types'

type JourneyRowKind = 'panel' | 'stop' | 'advance' | 'announcement' | 'custom'

interface JourneyOrderItemProps {
  importedSounds?: ImportedSoundDefinition[]
  isDragSource?: boolean
  isDropTargetAfter?: boolean
  isDropTargetBefore?: boolean
  muted?: boolean
  panelDestination?: string
  platformUsageHints?: string[]
  readOnly?: boolean
  row: JourneyOrderRow
  onChange?: (nextRow: JourneyOrderRow) => void
  onDragEnd?: () => void
  onDragHover?: (position: 'before' | 'after') => void
  onDragStart?: () => void
  onMove?: (direction: number) => void
  onDrop?: (position: 'before' | 'after') => void
  onRemove?: () => void
}

interface BubblePosition {
  left: number
  top: number
}

function createRowTemplate(kind: JourneyRowKind) {
  switch (kind) {
    case 'panel':
      return createPanelRow()
    case 'stop':
      return createStopRow('', 'A', '')
    case 'advance':
      return createAdvanceRow()
    case 'announcement':
      return createAnnouncementRow()
    case 'custom':
      return createCustomRow()
  }
}

function getKnownRowKind(type: string): JourneyRowKind {
  if (type === 'panel' || type === 'stop' || type === 'advance' || type === 'announcement') {
    return type
  }

  return 'custom'
}

export function JourneyOrderItem({
  importedSounds = [],
  isDragSource = false,
  isDropTargetAfter = false,
  isDropTargetBefore = false,
  muted = false,
  panelDestination = '',
  platformUsageHints = [],
  readOnly = false,
  row,
  onChange,
  onDragEnd,
  onDragHover,
  onDragStart,
  onMove,
  onDrop,
  onRemove,
}: JourneyOrderItemProps) {
  const [isPlatformFocused, setIsPlatformFocused] = useState(false)
  const [bubblePosition, setBubblePosition] = useState<BubblePosition | null>(null)
  const platformInputRef = useRef<HTMLInputElement | null>(null)
  const rowKind = getKnownRowKind(row.type)
  const panelDestinationText = `▸ ${panelDestination}`
  const showPanelDestinationWarning = rowKind === 'panel' && !panelDestination.trim()
  const missingAnnouncementSoundKeys = rowKind === 'announcement'
    ? (row.args[1]?.value ?? '')
      .split('/')
      .map((value) => value.trim())
      .filter(Boolean)
      .filter((soundKey, index, values) => values.indexOf(soundKey) === index)
      .filter((soundKey) => !importedSounds.some((sound) => sound.key === soundKey))
    : []
  const showAnnouncementSoundWarning = missingAnnouncementSoundKeys.length > 0
  const showPlatformBubble = rowKind === 'stop' && isPlatformFocused && platformUsageHints.length > 0

  function updateBubblePosition() {
    const input = platformInputRef.current
    if (!input) {
      return
    }

    const rect = input.getBoundingClientRect()
    const bubbleWidth = 320
    const bubbleHeight = 220
    const left = Math.min(Math.max(rect.left, 12), Math.max(window.innerWidth - bubbleWidth - 12, 12))
    const preferredTop = rect.bottom + 8
    const fallbackTop = rect.top - bubbleHeight - 8
    const top = preferredTop + bubbleHeight <= window.innerHeight - 12
      ? preferredTop
      : Math.max(fallbackTop, 12)

    setBubblePosition({ left, top })
  }

  useLayoutEffect(() => {
    if (!showPlatformBubble) {
      setBubblePosition(null)
      return
    }

    updateBubblePosition()

    function handleViewportChange() {
      updateBubblePosition()
    }

    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)

    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [showPlatformBubble])

  function emit(nextRow: JourneyOrderRow) {
    onChange?.(nextRow)
  }

  function updateArgument(index: number, kind: ScalarKind, value: string) {
    const nextArgs = [...row.args]
    const existing = nextArgs[index]

    if (!value && rowKind === 'stop' && index === 2) {
      emit({
        ...row,
        args: nextArgs.slice(0, 2),
      })
      return
    }

    nextArgs[index] = existing
      ? { ...existing, kind, value }
      : createJourneyArgument(kind, value)

    emit({
      ...row,
      args: nextArgs,
    })
  }

  function updateCustomArgument(index: number, argument: JourneyOrderArgument) {
    const nextArgs = row.args.map((currentArgument, currentIndex) => (
      currentIndex === index ? argument : currentArgument
    ))

    emit({
      ...row,
      args: nextArgs,
    })
  }

  function getDropPosition(event: ReactDragEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
  }

  function handleDragStart(event: ReactDragEvent<HTMLButtonElement>) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', row.id)
    onDragStart?.()
  }

  return (
    <div
      className={`order-row${muted ? ' is-muted' : ''}${readOnly ? ' is-readonly' : ''}${isDragSource ? ' is-drag-source' : ''}${isDropTargetBefore ? ' is-drop-target-before' : ''}${isDropTargetAfter ? ' is-drop-target-after' : ''}`}
      onDragOver={(event) => {
        if (readOnly || !onDrop) {
          return
        }

        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        onDragHover?.(getDropPosition(event))
      }}
      onDrop={(event) => {
        if (readOnly || !onDrop) {
          return
        }

        event.preventDefault()
        onDrop(getDropPosition(event))
      }}
    >
      {!readOnly ? (
        <Button
          size="sm"
          variant="outline-secondary"
          className="order-row__drag-handle"
          draggable
          onDragEnd={onDragEnd}
          onDragStart={handleDragStart}
        >
          {"-"}
        </Button>
      ) : null}

      <div className="order-row__scroll">
        <Form.Select
          size="sm"
          className="order-row__type"
          disabled={readOnly}
          value={rowKind}
          onChange={(event) => emit(createRowTemplate(event.target.value as JourneyRowKind))}
        >
          <option value="panel">panel</option>
          <option value="stop">stop</option>
          <option value="advance">advance</option>
          <option value="announcement">announcement</option>
          <option value="custom">custom</option>
        </Form.Select>

        {rowKind === 'panel' ? (
          <>
            <Form.Control
              size="sm"
              className="order-row__field order-row__field--small"
              disabled={readOnly}
              type="number"
              value={row.args[0]?.value ?? ''}
              onChange={(event) => updateArgument(0, 'number', event.target.value)}
            />
            <Form.Control
              size="sm"
              className={`order-row__field order-row__field--wide${showPanelDestinationWarning ? ' order-row__field--warning' : ''}`}
              placeholder="Panel destination"
              readOnly
              title={showPanelDestinationWarning ? 'Panel id is not defined in the imported Panels module.' : undefined}
              value={panelDestinationText}
            />
          </>
        ) : null}

        {rowKind === 'stop' ? (
          <>
            <Form.Control
              size="sm"
              className="order-row__field order-row__field--wide"
              disabled={readOnly}
              placeholder="Stop name"
              value={row.args[0]?.value ?? ''}
              onChange={(event) => updateArgument(0, 'string', event.target.value)}
            />
            <div className="order-row__field-stack order-row__field-stack--tiny">
              <Form.Control
                ref={platformInputRef}
                size="sm"
                className="order-row__field order-row__field--tiny"
                disabled={readOnly}
                placeholder="Pl."
                value={row.args[1]?.value ?? ''}
                onBlur={() => setIsPlatformFocused(false)}
                onChange={(event) => updateArgument(1, 'string', event.target.value)}
                onFocus={() => {
                  setIsPlatformFocused(true)
                  updateBubblePosition()
                }}
              />
              {showPlatformBubble && bubblePosition ? (
                <div
                  className="order-row__platform-bubble"
                  style={{
                    left: bubblePosition.left,
                    top: bubblePosition.top,
                  }}
                >
                  <div className="order-row__platform-bubble-title">Routes using this platform</div>
                  {platformUsageHints.map((hint) => (
                    <div className="order-row__platform-bubble-line" key={hint}>{hint}</div>
                  ))}
                </div>
              ) : null}
            </div>
            <Form.Control
              size="sm"
              className="order-row__field order-row__field--tiny"
              disabled={readOnly}
              placeholder="Minute"
              step="any"
              type="number"
              value={row.args[2]?.value ?? ''}
              onChange={(event) => updateArgument(2, 'number', event.target.value)}
            />
          </>
        ) : null}

        {rowKind === 'advance' ? (
          <div className="order-row__hint">No arguments</div>
        ) : null}

        {rowKind === 'announcement' ? (
          <>
            <Form.Select
              size="sm"
              className="order-row__field order-row__field--small"
              disabled={readOnly}
              value={row.args[0]?.value ?? 'new'}
              onChange={(event) => updateArgument(0, 'string', event.target.value)}
            >
              <option value="new">new</option>
              <option value="arrive">arrive</option>
              <option value="depart">depart</option>
            </Form.Select>
            <Form.Control
              size="sm"
              className={`order-row__field order-row__field--announcement${showAnnouncementSoundWarning ? ' order-row__field--warning' : ''}`}
              disabled={readOnly}
              placeholder="sound_a/sound_b/sound_c"
              title={showAnnouncementSoundWarning ? `Undefined sound key${missingAnnouncementSoundKeys.length === 1 ? '' : 's'}: ${missingAnnouncementSoundKeys.join(', ')}` : undefined}
              value={row.args[1]?.value ?? ''}
              onChange={(event) => updateArgument(1, 'string', event.target.value)}
            />
          </>
        ) : null}

        {rowKind === 'custom' ? (
          <>
            <Form.Control
              size="sm"
              className="order-row__field order-row__field--small"
              disabled={readOnly}
              placeholder="Export type"
              value={row.type}
              onChange={(event) => emit({ ...row, type: event.target.value })}
            />

            {row.args.map((argument, argumentIndex) => (
              <div className="order-row__argument" key={argument.id}>
                <Form.Select
                  size="sm"
                  className="order-row__field order-row__field--tiny"
                  disabled={readOnly}
                  value={argument.kind}
                  onChange={(event) => updateCustomArgument(argumentIndex, {
                    ...argument,
                    kind: event.target.value as ScalarKind,
                  })}
                >
                  <option value="string">string</option>
                  <option value="number">number</option>
                </Form.Select>
                <Form.Control
                  size="sm"
                  className="order-row__field order-row__field--small"
                  disabled={readOnly}
                  value={argument.value}
                  onChange={(event) => updateCustomArgument(argumentIndex, {
                    ...argument,
                    value: event.target.value,
                  })}
                />
                {!readOnly ? (
                  <Button
                    size="sm"
                    variant="outline-danger"
                    onClick={() => emit({
                      ...row,
                      args: row.args.filter((_, currentIndex) => currentIndex !== argumentIndex),
                    })}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            ))}

            {!readOnly ? (
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => emit({
                  ...row,
                  args: [...row.args, createJourneyArgument('string', '')],
                })}
              >
                Add arg
              </Button>
            ) : null}
          </>
        ) : null}
      </div>

      {!readOnly ? (
        <ButtonGroup size="sm" className="order-row__actions">
          <Button variant="outline-secondary" onClick={() => onMove?.(-1)}>
            Up
          </Button>
          <Button variant="outline-secondary" onClick={() => onMove?.(1)}>
            Down
          </Button>
          <Button variant="outline-danger" onClick={onRemove}>
            Remove
          </Button>
        </ButtonGroup>
      ) : null}
    </div>
  )
}