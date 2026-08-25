import { useState } from 'react'
import { Alert, Button, Card, Col, Form, InputGroup, Row, Stack } from 'react-bootstrap'

import { GenerateCopiesModal } from './GenerateCopiesModal'
import { ShiftOrderDutyPaperModal } from './ShiftOrderDutyPaperModal'
import { ShiftOrdersTimelineModal } from './ShiftOrdersTimelineModal'
import { ShiftPlanNodeItem } from './ShiftPlanNodeItem'
import { createJourneyNode, createTimeNode } from '../lib/document'
import { getShiftOrderTimingPreviews } from '../lib/shiftTiming'
import type { ImportedPanelDefinition, ImportedRouteDefinition, JourneyDefinition, ShiftOrder } from '../types'

interface ShiftOrdersPanelProps {
  importedPanels: ImportedPanelDefinition[]
  importedRoutes: ImportedRouteDefinition[]
  journeys: JourneyDefinition[]
  selectedShiftOrderId: string | null
  shiftOrders: ShiftOrder[]
  onAddShiftOrder: () => void
  onCloneOrderSeries: (orderId: string, copies: number, minuteStep: number) => void
  onDeleteShiftOrder: (orderId: string) => void
  onSelectShiftOrder: (orderId: string) => void
  onUpdateShiftOrder: (orderId: string, updater: (order: ShiftOrder) => ShiftOrder) => void
}

export function ShiftOrdersPanel({
  importedPanels,
  importedRoutes,
  journeys,
  selectedShiftOrderId,
  shiftOrders,
  onAddShiftOrder,
  onCloneOrderSeries,
  onDeleteShiftOrder,
  onSelectShiftOrder,
  onUpdateShiftOrder,
}: ShiftOrdersPanelProps) {
  const [showGenerateCopiesModal, setShowGenerateCopiesModal] = useState(false)
  const [showDutyPaperModal, setShowDutyPaperModal] = useState(false)
  const [showTimelineModal, setShowTimelineModal] = useState(false)
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ nodeId: string, position: 'before' | 'after' } | null>(null)
  const sortedShiftOrders = [...shiftOrders].sort((left, right) => left.orderNumber - right.orderNumber)
  const selectedShiftOrder = sortedShiftOrders.find((order) => order.id === selectedShiftOrderId) ?? sortedShiftOrders[0] ?? null
  const timingPreviews = selectedShiftOrder
    ? getShiftOrderTimingPreviews(selectedShiftOrder, journeys, importedRoutes)
    : []

  function clearDragState() {
    setDraggedNodeId(null)
    setDropTarget(null)
  }

  function moveShiftPlanNode(orderId: string, nodeIndex: number, targetIndex: number) {
    onUpdateShiftOrder(orderId, (currentOrder) => {
      if (
        nodeIndex < 0 ||
        nodeIndex >= currentOrder.nodes.length ||
        targetIndex < 0 ||
        targetIndex >= currentOrder.nodes.length ||
        nodeIndex === targetIndex
      ) {
        return currentOrder
      }

      const nextNodes = [...currentOrder.nodes]
      const [movedNode] = nextNodes.splice(nodeIndex, 1)
      nextNodes.splice(targetIndex, 0, movedNode!)

      return {
        ...currentOrder,
        nodes: nextNodes,
      }
    })
  }

  return (
    <Card className="workspace-panel border-0">
      <Card.Body className="p-3 p-xl-3">
        <Row className="g-3 align-items-start">
          <Col xl={3} lg={4}>
            <div className="panel-toolbar">
              <div className="panel-label">Shift orders</div>
              <Button variant="outline-secondary" size="sm" onClick={onAddShiftOrder}>
                New
              </Button>
            </div>

            <div className="entity-list">
              {sortedShiftOrders.map((order) => (
                <button
                  className={`entity-button${selectedShiftOrder?.id === order.id ? ' is-active' : ''}`}
                  key={order.id}
                  type="button"
                  onClick={() => onSelectShiftOrder(order.id)}
                >
                  <span className="entity-button__title">Order {order.orderNumber}</span>
                  <span className="entity-button__meta">{order.nodes.length} node{order.nodes.length === 1 ? '' : 's'}</span>
                </button>
              ))}
            </div>
          </Col>

          <Col xl={9} lg={8}>
            {selectedShiftOrder ? (
              <div className="editor-shell compact-form">
                <div className="editor-toolbar editor-toolbar--wrap">
                  <InputGroup size="sm" className="utility-input">
                    <InputGroup.Text>Order</InputGroup.Text>
                    <Form.Control
                      type="number"
                      min={1}
                      value={String(selectedShiftOrder.orderNumber)}
                      onChange={(event) => onUpdateShiftOrder(selectedShiftOrder.id, (currentOrder) => ({
                        ...currentOrder,
                        orderNumber: Number(event.target.value || 0),
                      }))}
                    />
                  </InputGroup>

                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={() => setShowGenerateCopiesModal(true)}
                  >
                    Generate copies
                  </Button>

                  <Button size="sm" variant="outline-secondary" onClick={() => setShowTimelineModal(true)}>
                    Timeline
                  </Button>

                  <Button size="sm" variant="outline-secondary" onClick={() => setShowDutyPaperModal(true)}>
                    Schedule paper
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={() => onUpdateShiftOrder(selectedShiftOrder.id, (currentOrder) => ({
                      ...currentOrder,
                      nodes: [...currentOrder.nodes, createTimeNode('04:30')],
                    }))}
                  >
                    Add time
                  </Button>

                  <Button
                    size="sm"
                    variant="outline-secondary"
                    disabled={journeys.length === 0}
                    onClick={() => onUpdateShiftOrder(selectedShiftOrder.id, (currentOrder) => ({
                      ...currentOrder,
                      nodes: [...currentOrder.nodes, createJourneyNode(journeys[0] ? [journeys[0].id] : [])],
                    }))}
                  >
                    Add sequence
                  </Button>

                  <Button size="sm" variant="outline-danger" onClick={() => onDeleteShiftOrder(selectedShiftOrder.id)}>
                    Delete order
                  </Button>
                </div>

                <Stack gap={2}>
                  {selectedShiftOrder.nodes.map((node, nodeIndex) => (
                    <ShiftPlanNodeItem
                      key={node.id}
                      isDragSource={draggedNodeId === node.id}
                      isDropTargetAfter={dropTarget?.nodeId === node.id && dropTarget.position === 'after'}
                      isDropTargetBefore={dropTarget?.nodeId === node.id && dropTarget.position === 'before'}
                      journeyDurations={timingPreviews[nodeIndex]?.journeyDurations.map((journeyDuration) => (
                        journeyDuration.isDisplayable ? journeyDuration : null
                      ))}
                      journeys={journeys}
                      loopSummary={timingPreviews[nodeIndex]?.loopSummary ?? null}
                      node={node}
                      onChange={(nextNode) => onUpdateShiftOrder(selectedShiftOrder.id, (currentOrder) => ({
                        ...currentOrder,
                        nodes: currentOrder.nodes.map((currentNode, currentIndex) => (
                          currentIndex === nodeIndex ? nextNode : currentNode
                        )),
                      }))}
                      onDragEnd={clearDragState}
                      onDragHover={(position) => {
                        if (!draggedNodeId || draggedNodeId === node.id) {
                          setDropTarget(null)
                          return
                        }

                        setDropTarget({ nodeId: node.id, position })
                      }}
                      onDragStart={() => {
                        setDraggedNodeId(node.id)
                        setDropTarget(null)
                      }}
                      onDrop={(position) => {
                        if (!draggedNodeId || draggedNodeId === node.id) {
                          clearDragState()
                          return
                        }

                        const sourceIndex = selectedShiftOrder.nodes.findIndex((currentNode) => currentNode.id === draggedNodeId)
                        const hoveredIndex = selectedShiftOrder.nodes.findIndex((currentNode) => currentNode.id === node.id)
                        if (sourceIndex < 0 || hoveredIndex < 0) {
                          clearDragState()
                          return
                        }

                        let targetIndex = hoveredIndex
                        if (position === 'after') {
                          targetIndex = hoveredIndex + 1
                        }
                        if (sourceIndex < targetIndex) {
                          targetIndex -= 1
                        }

                        moveShiftPlanNode(selectedShiftOrder.id, sourceIndex, targetIndex)
                        clearDragState()
                      }}
                      onMove={(direction) => onUpdateShiftOrder(selectedShiftOrder.id, (currentOrder) => {
                        const targetIndex = nodeIndex + direction
                        if (targetIndex < 0 || targetIndex >= currentOrder.nodes.length) {
                          return currentOrder
                        }

                        const nextNodes = [...currentOrder.nodes]
                        const [currentNode] = nextNodes.splice(nodeIndex, 1)
                        nextNodes.splice(targetIndex, 0, currentNode!)
                        return {
                          ...currentOrder,
                          nodes: nextNodes,
                        }
                      })}
                      onRemove={() => onUpdateShiftOrder(selectedShiftOrder.id, (currentOrder) => ({
                        ...currentOrder,
                        nodes: currentOrder.nodes.filter((_, currentIndex) => currentIndex !== nodeIndex),
                      }))}
                    />
                  ))}

                  {selectedShiftOrder.nodes.length === 0 ? (
                    <Alert variant="warning" className="mb-0 compact-alert">
                      Add a time or a journey sequence to start building this order.
                    </Alert>
                  ) : null}
                </Stack>

                <GenerateCopiesModal
                  orderNumber={selectedShiftOrder.orderNumber}
                  show={showGenerateCopiesModal}
                  onClose={() => setShowGenerateCopiesModal(false)}
                  onConfirm={(copies, minuteStep) => {
                    onCloneOrderSeries(selectedShiftOrder.id, copies, minuteStep)
                    setShowGenerateCopiesModal(false)
                  }}
                />

                {showTimelineModal ? (
                  <ShiftOrdersTimelineModal
                    importedPanels={importedPanels}
                    importedRoutes={importedRoutes}
                    journeys={journeys}
                    selectedShiftOrderId={selectedShiftOrderId}
                    shiftOrders={shiftOrders}
                    onClose={() => setShowTimelineModal(false)}
                  />
                ) : null}

                {showDutyPaperModal ? (
                  <ShiftOrderDutyPaperModal
                    importedRoutes={importedRoutes}
                    journeys={journeys}
                    shiftOrder={selectedShiftOrder}
                    show={showDutyPaperModal}
                    onClose={() => setShowDutyPaperModal(false)}
                  />
                ) : null}
              </div>
            ) : (
              <Alert variant="light" className="mb-0 compact-alert">
                Create a shift order to start building SHIFT._plan.
              </Alert>
            )}
          </Col>
        </Row>
      </Card.Body>
    </Card>
  )
}