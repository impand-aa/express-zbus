export type ScalarKind = 'string' | 'number'
export type NullableScalarKind = ScalarKind | 'nil'

export interface ScalarValue {
  kind: ScalarKind
  value: string
}

export interface NullableScalarValue {
  kind: NullableScalarKind
  value: string
}

export interface JourneyOrderArgument {
  id: string
  kind: ScalarKind
  value: string
}

export interface JourneyOrderRow {
  id: string
  type: string
  args: JourneyOrderArgument[]
}

export interface JourneyDefinition {
  id: string
  key: string
  lineDisplay: NullableScalarValue
  from: string
  to: string
  pauseBeforeJourney: string
  pauseAfterJourney: string
  orders: JourneyOrderRow[]
}

export interface TimePlanNode {
  id: string
  kind: 'time'
  time: string
  allowBackwardTime?: boolean
}

export interface JourneyPlanNode {
  id: string
  kind: 'journeys'
  journeyIds: string[]
  loopUntil: string
}

export type ShiftPlanNode = TimePlanNode | JourneyPlanNode

export interface ShiftOrder {
  id: string
  orderNumber: number
  nodes: ShiftPlanNode[]
}

export interface ShiftDocument {
  journeys: JourneyDefinition[]
  shiftOrders: ShiftOrder[]
}

export interface DocumentValidationResult {
  valid: boolean
  errors: string[]
}

export interface RgbColor {
  r: number
  g: number
  b: number
}

export interface ImportedPanelDefinition {
  id: number
  destination: string
}

export interface ImportedSoundDefinition {
  key: string
  assetId: string
}

export interface ImportedRouteDefinition {
  id: string
  lineDisplay: NullableScalarValue
  lineDisplayColor: RgbColor | null
  lineDisplayBgColor: RgbColor | null
  orders: JourneyOrderRow[]
  firstStopName: string
  lastStopName: string
}

export interface RouteMatchResult {
  route: ImportedRouteDefinition
  mode: 'source' | 'fallback'
}

export interface DisplayLinePreview {
  text: string
  textColor: string
  backgroundColor: string
  isRounded: boolean
}