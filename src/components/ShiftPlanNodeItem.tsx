import { type DragEvent as ReactDragEvent } from 'react'
import { Button, ButtonGroup, Form, InputGroup, Stack } from 'react-bootstrap'

import type { JourneyDurationInfo, JourneyNodeLoopSummary } from '../lib/shiftTiming'
import type { JourneyDefinition, ShiftPlanNode } from '../types'

interface ShiftPlanNodeItemProps {
  isDragSource?: boolean
  isDropTargetAfter?: boolean
  isDropTargetBefore?: boolean
  journeyDurations?: Array<JourneyDurationInfo | null>
  journeys: JourneyDefinition[]
  loopSummary?: JourneyNodeLoopSummary | null
  node: ShiftPlanNode
  onChange: (nextNode: ShiftPlanNode) => void
  onDragEnd?: () => void
  onDragHover?: (position: 'before' | 'after') => void
  onDragStart?: () => void
  onDrop?: (position: 'before' | 'after') => void
  onMove: (direction: number) => void
  onRemove: () => void
}

export function ShiftPlanNodeItem({
  isDragSource = false,
  isDropTargetAfter = false,
  isDropTargetBefore = false,
  journeyDurations = [],
  journeys,
  loopSummary = null,
  node,
  onChange,
  onDragEnd,
  onDragHover,
  onDragStart,
  onDrop,
  onMove,
  onRemove,
}: ShiftPlanNodeItemProps) {
  function formatDurationBreakdown(duration: JourneyDurationInfo) {
    return `${duration.travelMinutes}+${duration.pauseMinutes} (${duration.travelMinutes + duration.pauseMinutes}) min`
  }

  function getDropPosition(event: ReactDragEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
  }

  function handleDragStart(event: ReactDragEvent<HTMLButtonElement>) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', node.id)
    onDragStart?.()
  }

  return (
    <div
      className={`compact-card compact-form${isDragSource ? ' is-drag-source' : ''}${isDropTargetBefore ? ' is-drop-target-before' : ''}${isDropTargetAfter ? ' is-drop-target-after' : ''}`}
      onDragOver={(event) => {
        if (!onDrop) {
          return
        }

        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        onDragHover?.(getDropPosition(event))
      }}
      onDrop={(event) => {
        if (!onDrop) {
          return
        }

        event.preventDefault()
        onDrop(getDropPosition(event))
      }}
    >
      <div className={`compact-card__header${node.kind === 'time' ? ' compact-card__header--flush' : ''}`}>
        <div className="compact-card__header-start">
          <Button
            size="sm"
            variant="outline-secondary"
            className="compact-card__drag-handle"
            draggable
            onDragEnd={onDragEnd}
            onDragStart={handleDragStart}
          >
            {"-"}
          </Button>
          {node.kind === 'time' ? (
            <InputGroup size="sm" className="utility-input">
              <InputGroup.Text>Time</InputGroup.Text>
              <Form.Control
                type="time"
                value={node.time}
                onChange={(event) => onChange({ ...node, time: event.target.value })}
              />
            </InputGroup>
          ) : (
            <div className="compact-card__tag">journeys</div>
          )}
        </div>
        <ButtonGroup size="sm">
          <Button variant="outline-secondary" onClick={() => onMove(-1)}>
            Up
          </Button>
          <Button variant="outline-secondary" onClick={() => onMove(1)}>
            Down
          </Button>
          <Button variant="outline-danger" onClick={onRemove}>
            Remove
          </Button>
        </ButtonGroup>
      </div>

      {node.kind === 'time' ? null : (
        <Stack gap={2}>
          <div className="compact-card__footer compact-card__footer--spread">
            <Button
              size="sm"
              variant="outline-secondary"
              disabled={journeys.length === 0}
              onClick={() => onChange({
                ...node,
                journeyIds: [...node.journeyIds, journeys[0]?.id ?? ''],
              })}
            >
              Add journey
            </Button>

            <InputGroup size="sm" className="loop-input">
              <InputGroup.Text>Loop</InputGroup.Text>
              <Form.Control
                type="time"
                value={node.loopUntil}
                onChange={(event) => onChange({ ...node, loopUntil: event.target.value })}
              />
            </InputGroup>
          </div>

          {journeys.length === 0 ? (
            <div className="compact-card__hint">Add at least one journey before creating a journey sequence node.</div>
          ) : null}

          {node.journeyIds.map((journeyId, journeyIndex) => (
            <InputGroup key={`${node.id}-${journeyIndex}`} size="sm">
              <Form.Select
                value={journeyId}
                onChange={(event) => onChange({
                  ...node,
                  journeyIds: node.journeyIds.map((currentJourneyId, currentIndex) => (
                    currentIndex === journeyIndex ? event.target.value : currentJourneyId
                  )),
                })}
              >
                {journeys.map((journey) => (
                  <option key={journey.id} value={journey.id}>
                    {journey.key} | {journey.lineDisplay.kind === 'nil' ? 'nil' : journey.lineDisplay.value} | {journey.from || '*'} {'->'} {journey.to || '*'}
                  </option>
                ))}
              </Form.Select>
              {journeyDurations[journeyIndex] ? (
                <InputGroup.Text className="journey-duration-chip">
                  {formatDurationBreakdown(journeyDurations[journeyIndex])}
                </InputGroup.Text>
              ) : null}
              <Button
                variant="outline-secondary"
                onClick={() => {
                  const targetIndex = journeyIndex - 1
                  if (targetIndex < 0) {
                    return
                  }

                  const nextJourneyIds = [...node.journeyIds]
                  const [currentJourneyId] = nextJourneyIds.splice(journeyIndex, 1)
                  nextJourneyIds.splice(targetIndex, 0, currentJourneyId!)
                  onChange({
                    ...node,
                    journeyIds: nextJourneyIds,
                  })
                }}
              >
                Up
              </Button>
              <Button
                variant="outline-secondary"
                onClick={() => {
                  const targetIndex = journeyIndex + 1
                  if (targetIndex >= node.journeyIds.length) {
                    return
                  }

                  const nextJourneyIds = [...node.journeyIds]
                  const [currentJourneyId] = nextJourneyIds.splice(journeyIndex, 1)
                  nextJourneyIds.splice(targetIndex, 0, currentJourneyId!)
                  onChange({
                    ...node,
                    journeyIds: nextJourneyIds,
                  })
                }}
              >
                Down
              </Button>
              <Button
                variant="outline-danger"
                onClick={() => onChange({
                  ...node,
                  journeyIds: node.journeyIds.filter((_, currentIndex) => currentIndex !== journeyIndex),
                })}
              >
                Remove
              </Button>
            </InputGroup>
          ))}

          {loopSummary ? (
            <div className="compact-card__hint journey-loop-summary">
              Total {loopSummary.totalDurationMinutes} min{loopSummary.estimatedEndTime ? ` | ends ${loopSummary.estimatedEndTime}` : ''}
            </div>
          ) : null}
        </Stack>
      )}
    </div>
  )
}