/**
 * csv.js
 * Simple CSV parser. Expects first row to be headers.
 * Returns an array of objects keyed by header names.
 */

export function parseCSV(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  const headers = parseLine(lines[0])

  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = parseLine(line)
    const obj = {}
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i].trim()] = (values[i] || '').trim()
    }
    return obj
  })
}

// Handle quoted fields with commas inside them
function parseLine(line) {
  const fields = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}
