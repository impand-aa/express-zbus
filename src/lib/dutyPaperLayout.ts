const MAX_DUTY_PAPER_SHEET_HEIGHT_REM = 42
const DUTY_PAPER_HEADER_HEIGHT_REM = 8.7
const DUTY_PAPER_SUMMARY_HEIGHT_REM = 4.2
const DUTY_PAPER_ROWS_PADDING_REM = 2.3
const DUTY_PAPER_ROW_GAP_REM = 0.75
const DUTY_PAPER_ROW_BASE_HEIGHT_REM = 0.78
const DUTY_PAPER_STOP_HEIGHT_REM = 1.04
const DUTY_PAPER_NOTES_HEIGHT_REM = 4.1

export interface DutyPaperPageLayout {
  lastPageRowsPerPaper: number
  rowsPerPaper: number
  sheetMinHeightRem: number
}

function getRowSetHeightRem(stopCount: number) {
  const safeStopCount = Math.max(stopCount, 1)
  return DUTY_PAPER_ROW_BASE_HEIGHT_REM + (safeStopCount * DUTY_PAPER_STOP_HEIGHT_REM)
}

function getRowsPerBudget(budgetRem: number, rowSetHeightRem: number) {
  return Math.max(1, Math.floor((budgetRem + DUTY_PAPER_ROW_GAP_REM) / (rowSetHeightRem + DUTY_PAPER_ROW_GAP_REM)))
}

function getTotalCapacity(pageCount: number, rowsPerPaper: number, lastPageRowsPerPaper: number) {
  if (pageCount <= 0) {
    return 0
  }

  return ((pageCount - 1) * rowsPerPaper) + lastPageRowsPerPaper
}

export function getDutyPaperPageLayout(stopCount: number, hasNotes: boolean): DutyPaperPageLayout {
  const rowSetHeightRem = getRowSetHeightRem(stopCount)
  const regularRowsBudgetRem = MAX_DUTY_PAPER_SHEET_HEIGHT_REM - DUTY_PAPER_HEADER_HEIGHT_REM - DUTY_PAPER_ROWS_PADDING_REM
  const rowsPerPaper = getRowsPerBudget(regularRowsBudgetRem, rowSetHeightRem)
  const lastPageRowsPerPaper = hasNotes
    ? Math.min(rowsPerPaper, getRowsPerBudget(regularRowsBudgetRem - DUTY_PAPER_NOTES_HEIGHT_REM, rowSetHeightRem))
    : rowsPerPaper

  const sheetMinHeightRem = DUTY_PAPER_HEADER_HEIGHT_REM
    + DUTY_PAPER_SUMMARY_HEIGHT_REM
    + DUTY_PAPER_ROWS_PADDING_REM
    + (rowsPerPaper * rowSetHeightRem)
    + (Math.max(0, rowsPerPaper - 1) * DUTY_PAPER_ROW_GAP_REM)

  return {
    lastPageRowsPerPaper,
    rowsPerPaper,
    sheetMinHeightRem: Number(sheetMinHeightRem.toFixed(2)),
  }
}

export function paginateDutyPaperRows<T>(rows: T[], rowsPerPaper: number, lastPageRowsPerPaper: number): T[][] {
  if (rows.length === 0) {
    return []
  }

  let pageCount = 1
  while (getTotalCapacity(pageCount, rowsPerPaper, lastPageRowsPerPaper) < rows.length) {
    pageCount += 1
  }

  const pages: T[][] = []
  let currentIndex = 0
  let remainingRows = rows.length

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const remainingPages = pageCount - pageIndex
    const isLastPage = pageIndex === pageCount - 1
    const currentCapacity = isLastPage ? lastPageRowsPerPaper : rowsPerPaper
    const currentPageSize = isLastPage
      ? remainingRows
      : Math.min(currentCapacity, remainingRows - remainingPages + 1)

    pages.push(rows.slice(currentIndex, currentIndex + currentPageSize))
    currentIndex += currentPageSize
    remainingRows -= currentPageSize
  }

  return pages
}