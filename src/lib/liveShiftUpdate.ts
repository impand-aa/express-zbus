function getLineLiteral(line: string) {
  const normalizedLine = line.trim()
  if (!normalizedLine) {
    throw new Error('Enter a line before generating live update code.')
  }

  return /^-?\d+(?:\.\d+)?$/.test(normalizedLine)
    ? normalizedLine
    : JSON.stringify(normalizedLine)
}

function stripReturnLine(source: string) {
  const normalizedSource = source.trimEnd()
  const strippedSource = normalizedSource.replace(/\r?\nreturn SHIFT\s*$/, '')

  if (strippedSource === normalizedSource) {
    throw new Error('The exported shift source must end with return SHIFT.')
  }

  return strippedSource
}

export function generateLiveShiftUpdateSource(shiftSource: string, line: string) {
  const planSource = stripReturnLine(shiftSource)
  const lineLiteral = getLineLiteral(line)

  return [
    planSource,
    '',
    `require(game:GetService("ReplicatedStorage").BUSEV3.Shifts):RegisterShift(SHIFT._plan, ${lineLiteral})`,
  ].join('\n')
}