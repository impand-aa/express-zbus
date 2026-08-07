export function decodeLuaString(raw: string) {
  if (raw.startsWith('[[') && raw.endsWith(']]')) {
    return raw.slice(2, -2)
  }

  const quote = raw[0]
  if ((quote !== '"' && quote !== "'") || raw.at(-1) !== quote) {
    return raw
  }

  const source = raw.slice(1, -1)
  let decoded = ''

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (character !== '\\') {
      decoded += character
      continue
    }

    index += 1
    const escape = source[index]
    if (!escape) {
      decoded += '\\'
      break
    }

    switch (escape) {
      case 'a':
        decoded += '\u0007'
        break
      case 'b':
        decoded += '\b'
        break
      case 'f':
        decoded += '\f'
        break
      case 'n':
        decoded += '\n'
        break
      case 'r':
        decoded += '\r'
        break
      case 't':
        decoded += '\t'
        break
      case 'v':
        decoded += '\u000b'
        break
      case '\\':
      case '"':
      case "'":
        decoded += escape
        break
      case '\n':
      case '\r':
        break
      case 'z':
        while (index + 1 < source.length && /\s/.test(source[index + 1]!)) {
          index += 1
        }
        break
      case 'x': {
        const hex = source.slice(index + 1, index + 3)
        if (/^[0-9a-fA-F]{2}$/.test(hex)) {
          decoded += String.fromCharCode(Number.parseInt(hex, 16))
          index += 2
          break
        }

        decoded += 'x'
        break
      }
      default: {
        if (/[0-9]/.test(escape)) {
          let digits = escape
          while (digits.length < 3 && index + 1 < source.length && /[0-9]/.test(source[index + 1]!)) {
            index += 1
            digits += source[index]!
          }

          decoded += String.fromCharCode(Number.parseInt(digits, 10))
          break
        }

        decoded += escape
      }
    }
  }

  return decoded
}