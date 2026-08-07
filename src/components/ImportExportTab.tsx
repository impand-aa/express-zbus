import { Alert, Badge, Button, ButtonGroup, Card, Col, Form, Row, Stack } from 'react-bootstrap'

interface ImportExportTabProps {
  downloadName: string
  exportBlocked: boolean
  exportError: string
  importSource: string
  moduleName: string
  previewSource: string
  savedShiftModuleNames: string[]
  selectedSavedShiftModuleName: string
  validationErrors: string[]
  onChangeDownloadName: (value: string) => void
  onChangeImportSource: (value: string) => void
  onChangeModuleName: (value: string) => void
  onChangeSelectedSavedShiftModuleName: (value: string) => void
  onClearImportSource: () => void
  onCopyExport: () => void
  onDownloadExport: () => void
  onImportSavedShift: () => void
  onImportSource: () => void
  onLoadIntoImport: () => void
  onOpenLiveUpdate: () => void
  onSaveExportToMemory: () => void
}

export function ImportExportTab({
  downloadName,
  exportBlocked,
  exportError,
  importSource,
  moduleName,
  previewSource,
  savedShiftModuleNames,
  selectedSavedShiftModuleName,
  validationErrors,
  onChangeDownloadName,
  onChangeImportSource,
  onChangeModuleName,
  onChangeSelectedSavedShiftModuleName,
  onClearImportSource,
  onCopyExport,
  onDownloadExport,
  onImportSavedShift,
  onImportSource,
  onLoadIntoImport,
  onOpenLiveUpdate,
  onSaveExportToMemory,
}: ImportExportTabProps) {
  return (
    <Card className="workspace-panel border-0 code-panel">
      <Card.Body className="p-3 p-xl-3">
        {(validationErrors.length > 0 || exportError) ? (
          <Alert variant={validationErrors.length > 0 ? 'warning' : 'danger'} className="mb-3 compact-alert">
            {validationErrors.length > 0 ? (
              <>
                <div className="fw-semibold mb-2">Export is blocked.</div>
                <ul className="mb-0 ps-3">
                  {validationErrors.slice(0, 8).map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </>
            ) : exportError}
          </Alert>
        ) : null}

        <Row className="g-3 mb-3">
          <Col xl={6}>
            <Stack gap={2} className="compact-form">
              <div className="panel-toolbar panel-toolbar--dense">
                <div className="panel-label">Shift memory</div>
                <Badge bg="secondary" pill>{savedShiftModuleNames.length} saved</Badge>
              </div>

              <Form.Group>
                <Form.Label className="soft-label">Module name</Form.Label>
                <Form.Control
                  placeholder="e.g. 847"
                  size="sm"
                  value={moduleName}
                  onChange={(event) => onChangeModuleName(event.target.value)}
                />
                <Form.Text className="text-secondary">
                  Used to save or update the current shift in local memory when importing from source or exporting.
                </Form.Text>
              </Form.Group>
            </Stack>
          </Col>

          <Col xl={6}>
            <Stack gap={2} className="compact-form">
              <div className="panel-toolbar panel-toolbar--dense">
                <div className="panel-label">Import from memory</div>
                <Button size="sm" disabled={savedShiftModuleNames.length === 0} variant="outline-secondary" onClick={onImportSavedShift}>
                  Import saved shift
                </Button>
              </div>

              <Form.Select
                disabled={savedShiftModuleNames.length === 0}
                size="sm"
                value={selectedSavedShiftModuleName}
                onChange={(event) => onChangeSelectedSavedShiftModuleName(event.target.value)}
              >
                {savedShiftModuleNames.length === 0 ? (
                  <option value="">No saved shifts in memory</option>
                ) : null}

                {savedShiftModuleNames.map((savedShiftModuleName) => (
                  <option key={savedShiftModuleName} value={savedShiftModuleName}>
                    {savedShiftModuleName}
                  </option>
                ))}
              </Form.Select>
            </Stack>
          </Col>
        </Row>

        <Row className="g-3">
          <Col xl={6}>
            <Stack gap={2} className="compact-form">
              <div className="panel-toolbar panel-toolbar--dense">
                <div className="panel-label">Export</div>
                <ButtonGroup size="sm">
                  <Button variant="success" onClick={onSaveExportToMemory}>
                    Save to memory
                  </Button>
                  <Button variant="primary" onClick={onCopyExport}>
                    Copy
                  </Button>
                  <Button variant="outline-secondary" onClick={onDownloadExport}>
                    Download
                  </Button>
                  <Button disabled={exportBlocked} variant="outline-secondary" onClick={onOpenLiveUpdate}>
                    Live update
                  </Button>
                  <Button variant="outline-secondary" onClick={onLoadIntoImport}>
                    Load into import
                  </Button>
                </ButtonGroup>
              </div>

              <Form.Group>
                <Form.Label className="soft-label">Download name</Form.Label>
                <Form.Control size="sm" value={downloadName} onChange={(event) => onChangeDownloadName(event.target.value)} />
              </Form.Group>

              <Form.Control
                as="textarea"
                className="code-textarea"
                readOnly
                rows={26}
                spellCheck={false}
                value={previewSource}
              />
            </Stack>
          </Col>

          <Col xl={6}>
            <Stack gap={2} className="compact-form">
              <div className="panel-toolbar panel-toolbar--dense">
                <div className="panel-label">Import</div>
                <ButtonGroup size="sm">
                  <Button variant="success" onClick={onImportSource}>
                    Import
                  </Button>
                  <Button variant="outline-secondary" onClick={onClearImportSource}>
                    Clear
                  </Button>
                </ButtonGroup>
              </div>

              <Form.Control
                as="textarea"
                className="editor-textarea"
                placeholder="Paste a shift module here."
                rows={26}
                spellCheck={false}
                value={importSource}
                onChange={(event) => onChangeImportSource(event.target.value)}
              />

              <Form.Text className="text-secondary">
                Importing from source also saves or updates the shift in local memory under the module name above.
              </Form.Text>
            </Stack>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  )
}