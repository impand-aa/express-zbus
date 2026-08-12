import { useState } from 'react'
import { Badge, Button, ButtonGroup, Card, Form, Modal, Stack, Table } from 'react-bootstrap'

import type { PublishRequestRecord, PublishRequestStatus, PublishRequestType } from '../lib/publishRequestApi'

interface PublishesTabProps {
  currentUsername: string
  creatingRequest: boolean
  isAdmin: boolean
  requests: PublishRequestRecord[]
  updatingRequestId: string | null
  onCreateRequest: (request: { type: PublishRequestType; objectId: string | null; description: string; data: string }) => void
  onDeleteRequest: (id: string) => void
  onSetStatus: (id: string, status: PublishRequestStatus) => void
}

const PUBLISH_TYPES: PublishRequestType[] = ['shift', 'route', 'panel']
const PUBLISH_STATUSES: PublishRequestStatus[] = ['pending', 'complete']

function formatUpdatedAt(updatedAt: string) {
  const parsed = new Date(updatedAt)
  return Number.isNaN(parsed.getTime()) ? '?' : parsed.toLocaleString()
}

function sortRequests(requests: PublishRequestRecord[]) {
  return [...requests].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
}

export function PublishesTab({
  currentUsername,
  creatingRequest,
  isAdmin,
  requests,
  updatingRequestId,
  onCreateRequest,
  onDeleteRequest,
  onSetStatus,
}: PublishesTabProps) {
  const [type, setType] = useState<PublishRequestType>('shift')
  const [objectId, setObjectId] = useState('')
  const [description, setDescription] = useState('')
  const [data, setData] = useState('')
  const [viewedRequest, setViewedRequest] = useState<PublishRequestRecord | null>(null)

  const requiresObjectId = type === 'shift'

  function submitRequest() {
    onCreateRequest({ type, objectId: requiresObjectId ? objectId : null, description, data })
    setObjectId('')
    setDescription('')
    setData('')
  }

  const sortedRequests = sortRequests(requests)

  return (
    <Card className="workspace-panel border-0 code-panel">
      <Card.Body className="p-3 p-xl-3">
        <Stack gap={2} className="compact-form mb-3">
          <div className="panel-toolbar panel-toolbar--dense">
            <div className="panel-label">Request a publish</div>
            <Button
              disabled={creatingRequest || (requiresObjectId && !objectId.trim()) || !description.trim() || !data.trim()}
              size="sm"
              variant="success"
              onClick={submitRequest}
            >
              {creatingRequest ? 'Submitting…' : 'Submit request'}
            </Button>
          </div>

          <Form.Group>
            <Form.Label className="soft-label">Type</Form.Label>
            <Form.Select size="sm" value={type} onChange={(event) => setType(event.target.value as PublishRequestType)}>
              {PUBLISH_TYPES.map((publishType) => (
                <option key={publishType} value={publishType}>
                  {publishType}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          {requiresObjectId ? (
            <Form.Group>
              <Form.Label className="soft-label">Object ID</Form.Label>
              <Form.Control
                placeholder="e.g. 847"
                size="sm"
                value={objectId}
                onChange={(event) => setObjectId(event.target.value)}
              />
            </Form.Group>
          ) : null}

          <Form.Group>
            <Form.Label className="soft-label">Description</Form.Label>
            <Form.Control
              placeholder="Briefly describe what is being published"
              size="sm"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Form.Group>

          <Form.Group>
            <Form.Label className="soft-label">Data</Form.Label>
            <Form.Control
              as="textarea"
              className="editor-textarea"
              placeholder="Paste the Luau source to publish."
              rows={10}
              spellCheck={false}
              value={data}
              onChange={(event) => setData(event.target.value)}
            />
          </Form.Group>
        </Stack>

        <div className="panel-toolbar panel-toolbar--dense mb-2">
          <div className="panel-label">Requested publishes</div>
          <Badge bg="secondary" pill>{sortedRequests.length}</Badge>
        </div>

        {sortedRequests.length === 0 ? (
          <p className="text-secondary mb-0">No publishes have been requested yet.</p>
        ) : (
          <Table hover responsive size="sm" variant="dark">
            <thead>
              <tr>
                <th>Type</th>
                <th>Object ID</th>
                <th>Description</th>
                <th>Requester</th>
                <th>Updated at</th>
                <th>Status</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRequests.map((request) => {
                const canDelete = isAdmin || (request.requester === currentUsername && request.status === 'pending')
                const isUpdating = updatingRequestId === request.id

                return (
                  <tr key={request.id}>
                    <td>{request.type}</td>
                    <td>{request.objectId ?? '—'}</td>
                    <td>{request.description}</td>
                    <td>{request.requester}</td>
                    <td>{formatUpdatedAt(request.updatedAt)}</td>
                    <td>
                      {isAdmin ? (
                        <Form.Select
                          disabled={isUpdating}
                          size="sm"
                          value={request.status}
                          onChange={(event) => onSetStatus(request.id, event.target.value as PublishRequestStatus)}
                        >
                          {PUBLISH_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </Form.Select>
                      ) : (
                        <Badge bg={request.status === 'complete' ? 'success' : 'warning'}>
                          {request.status}
                        </Badge>
                      )}
                    </td>
                    <td className="text-end">
                      <ButtonGroup size="sm">
                        <Button variant="outline-secondary" onClick={() => setViewedRequest(request)}>
                          View
                        </Button>
                        {canDelete ? (
                          <Button
                            disabled={isUpdating}
                            variant="outline-danger"
                            onClick={() => onDeleteRequest(request.id)}
                          >
                            Delete
                          </Button>
                        ) : null}
                      </ButtonGroup>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </Card.Body>

      <Modal centered show={viewedRequest !== null} size="lg" onHide={() => setViewedRequest(null)}>
        <Modal.Header closeButton>
          <Modal.Title>
            {viewedRequest ? `${viewedRequest.type} publish request` : 'Publish request'}
          </Modal.Title>
        </Modal.Header>
        {viewedRequest ? (
          <Modal.Body>
            <Stack gap={2} className="compact-form">
              <div><strong>Object ID:</strong> {viewedRequest.objectId ?? '—'}</div>
              <div><strong>Description:</strong> {viewedRequest.description}</div>
              <div><strong>Requester:</strong> {viewedRequest.requester}</div>
              <div><strong>Updated at:</strong> {formatUpdatedAt(viewedRequest.updatedAt)}</div>
              <div><strong>Status:</strong> {viewedRequest.status}</div>
              <Form.Group>
                <Form.Label className="soft-label">Data</Form.Label>
                <Form.Control
                  as="textarea"
                  className="editor-textarea"
                  readOnly
                  rows={12}
                  spellCheck={false}
                  value={viewedRequest.data}
                />
              </Form.Group>
            </Stack>
          </Modal.Body>
        ) : null}
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setViewedRequest(null)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </Card>
  )
}
