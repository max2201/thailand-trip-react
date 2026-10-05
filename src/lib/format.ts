export const fmt = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString('ru-RU'))
export const dec = (n: number | string | null | undefined) => (n == null ? '—' : String(n).replace('.', ','))
export const dec1 = (n: number | null | undefined) => (n == null ? '—' : Number(n).toFixed(1).replace('.', ','))
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export function plural(n: number, one: string, few: string, many: string) {
  n = Math.abs(n) % 100
  const n1 = n % 10
  if (n > 10 && n < 20) return many
  if (n1 === 1) return one
  if (n1 >= 2 && n1 <= 4) return few
  return many
}
/** Расстояние по прямой, км. */
export function hav(a: number, b: number, c: number, d: number) {
  const p = Math.PI / 180, R = 6371
  return 2 * R * Math.asin(Math.sqrt(Math.sin(((c - a) * p) / 2) ** 2 + Math.cos(a * p) * Math.cos(c * p) * Math.sin(((d - b) * p) / 2) ** 2))
}
export const scoreClass = (s: number | null) => (s == null ? 'none' : s >= 9 ? 'g' : s >= 8 ? 'w' : 'b')
export const scoreColor = (s: number | null) => (s == null ? 'var(--muted)' : `var(--${s >= 9 ? 'good' : s >= 8 ? 'warn' : 'bad'})`)
export const subColor = (v: number) => `var(--${v >= 9 ? 'good' : v >= 8.3 ? 'warn' : 'bad'})`
export const kmText = (km: number) => (km < 1 ? `${Math.round(km * 100) * 10} м` : `${dec(km.toFixed(1))} км`)
export const DOW = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
