import { describe, expect, it } from 'vitest'

import { getDutyPaperPageLayout, paginateDutyPaperRows } from './dutyPaperLayout'

describe('duty paper layout', () => {
  it('reduces page capacity when more than three stops are shown', () => {
    expect(getDutyPaperPageLayout(3, true)).toMatchObject({
      rowsPerPaper: 6,
      lastPageRowsPerPaper: 5,
    })
    expect(getDutyPaperPageLayout(6, false)).toMatchObject({
      rowsPerPaper: 4,
      lastPageRowsPerPaper: 4,
    })
  })

  it('fills earlier sheets before spilling onto later sheets while reserving space for final-page notes', () => {
    const pages = paginateDutyPaperRows(Array.from({ length: 12 }, (_, index) => index + 1), 6, 5)

    expect(pages.map((page) => page.length)).toEqual([6, 5, 1])
  })
})