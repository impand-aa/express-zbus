import { Alert, Badge, Button, ButtonGroup, Card, Col, Form, Row, Stack } from 'react-bootstrap'

interface ModuleSourcesTabProps {
  importedNumsCount: number
  importedPanelsCount: number
  importedRoutesCount: number
  importedSoundsCount: number
  numsError: string
  numsSource: string
  panelsError: string
  panelsSource: string
  routesError: string
  routesSource: string
  soundsError: string
  soundsSource: string
  onChangeNumsSource: (value: string) => void
  onChangePanelsSource: (value: string) => void
  onChangeRoutesSource: (value: string) => void
  onChangeSoundsSource: (value: string) => void
  onClearNumsSource: () => void
  onClearPanelsSource: () => void
  onClearRoutesSource: () => void
  onClearSoundsSource: () => void
  onImportNums: () => void
  onImportPanels: () => void
  onImportRoutes: () => void
  onImportSounds: () => void
}

export function ModuleSourcesTab({
  importedNumsCount,
  importedPanelsCount,
  importedRoutesCount,
  importedSoundsCount,
  numsError,
  numsSource,
  panelsError,
  panelsSource,
  routesError,
  routesSource,
  soundsError,
  soundsSource,
  onChangeNumsSource,
  onChangePanelsSource,
  onChangeRoutesSource,
  onChangeSoundsSource,
  onClearNumsSource,
  onClearPanelsSource,
  onClearRoutesSource,
  onClearSoundsSource,
  onImportNums,
  onImportPanels,
  onImportRoutes,
  onImportSounds,
}: ModuleSourcesTabProps) {
  return (
    <Card className="workspace-panel border-0 code-panel module-sources-tab">
      <Card.Body className="p-2 p-xl-3">
        <div className="module-sources-tab__intro">
          <div>
            <div className="panel-label">Reference module imports</div>
            <div className="module-sources-tab__note">Paste one source per box. Routes are used immediately; panels and nums are available for temporary display imports; sounds are stored for announcement work.</div>
          </div>
        </div>

        <Row className="g-3">
          <Col xl={3}>
            <Stack gap={2} className="compact-form">
              <div className="panel-toolbar panel-toolbar--dense">
                <div className="panel-label">Routes source</div>
                <Badge bg="secondary" pill>{importedRoutesCount} imported</Badge>
              </div>

              {routesError ? (
                <Alert variant="danger" className="mb-0 compact-alert">
                  {routesError}
                </Alert>
              ) : null}

              <Form.Control
                as="textarea"
                className="editor-textarea"
                placeholder="Paste the Routes module source here."
                rows={14}
                spellCheck={false}
                value={routesSource}
                onChange={(event) => onChangeRoutesSource(event.target.value)}
              />

              <ButtonGroup size="sm">
                <Button variant="primary" onClick={onImportRoutes}>
                  Import routes
                </Button>
                <Button variant="outline-secondary" onClick={onClearRoutesSource}>
                  Clear
                </Button>
              </ButtonGroup>
            </Stack>
          </Col>

          <Col xl={3}>
            <Stack gap={2} className="compact-form">
              <div className="panel-toolbar panel-toolbar--dense">
                <div className="panel-label">Panels variant source</div>
                <Badge bg="secondary" pill>{importedPanelsCount} imported</Badge>
              </div>

              {panelsError ? (
                <Alert variant="danger" className="mb-0 compact-alert">
                  {panelsError}
                </Alert>
              ) : null}

              <Form.Control
                as="textarea"
                className="editor-textarea"
                placeholder="Paste one Panels variant module source here (for example Panels/Color/moduleScript.luau)."
                rows={14}
                spellCheck={false}
                value={panelsSource}
                onChange={(event) => onChangePanelsSource(event.target.value)}
              />

              <ButtonGroup size="sm">
                <Button variant="primary" onClick={onImportPanels}>
                  Import panels
                </Button>
                <Button variant="outline-secondary" onClick={onClearPanelsSource}>
                  Clear
                </Button>
              </ButtonGroup>
            </Stack>
          </Col>

          <Col xl={3}>
            <Stack gap={2} className="compact-form">
              <div className="panel-toolbar panel-toolbar--dense">
                <div className="panel-label">Nums variant source</div>
                <Badge bg="secondary" pill>{importedNumsCount} imported</Badge>
              </div>

              {numsError ? (
                <Alert variant="danger" className="mb-0 compact-alert">
                  {numsError}
                </Alert>
              ) : null}

              <Form.Control
                as="textarea"
                className="editor-textarea"
                placeholder="Paste one Nums variant module source here (for example Nums/Color/moduleScript.luau)."
                rows={14}
                spellCheck={false}
                value={numsSource}
                onChange={(event) => onChangeNumsSource(event.target.value)}
              />

              <ButtonGroup size="sm">
                <Button variant="primary" onClick={onImportNums}>
                  Import nums
                </Button>
                <Button variant="outline-secondary" onClick={onClearNumsSource}>
                  Clear
                </Button>
              </ButtonGroup>
            </Stack>
          </Col>

          <Col xl={3}>
            <Stack gap={2} className="compact-form">
              <div className="panel-toolbar panel-toolbar--dense">
                <div className="panel-label">Sounds source</div>
                <Badge bg="secondary" pill>{importedSoundsCount} imported</Badge>
              </div>

              {soundsError ? (
                <Alert variant="danger" className="mb-0 compact-alert">
                  {soundsError}
                </Alert>
              ) : null}

              <Form.Control
                as="textarea"
                className="editor-textarea"
                placeholder="Paste the Sounds module source here (for example Sounds/moduleScript.luau)."
                rows={14}
                spellCheck={false}
                value={soundsSource}
                onChange={(event) => onChangeSoundsSource(event.target.value)}
              />

              <ButtonGroup size="sm">
                <Button variant="primary" onClick={onImportSounds}>
                  Import sounds
                </Button>
                <Button variant="outline-secondary" onClick={onClearSoundsSource}>
                  Clear
                </Button>
              </ButtonGroup>
            </Stack>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  )
}