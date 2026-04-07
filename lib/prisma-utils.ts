type DecimalLike =
  | { toNumber(): number }
  | number
  | string
  | null
  | undefined

export function decimalToNumber(value: DecimalLike, fallback = 0): number {
  if (value == null) return fallback
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return value.toNumber()
}

export function dateToISOString(value: Date | string | null | undefined): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}
