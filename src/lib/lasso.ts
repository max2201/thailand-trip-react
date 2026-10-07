/**
 * Лассо на карте: произвольная область, по которой фильтруется таблица.
 * Область хранится в фильтрах как список точек [широта, долгота] (замкнутый многоугольник).
 */
export type Area = [number, number][]

/** Лежит ли точка внутри многоугольника (метод лучей; для масштабов города плоской геометрии достаточно). */
export function inArea(lat: number, lng: number, area: Area) {
  let inside = false
  for (let i = 0, j = area.length - 1; i < area.length; j = i++) {
    const [yi, xi] = area[i], [yj, xj] = area[j]
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/**
 * Упрощаем нарисованную линию до maxPts точек (Рамер — Дуглас — Пекер с подбором допуска)
 * и округляем координаты до 5 знаков (~1 м), чтобы область коротко помещалась в ссылку.
 */
export function simplifyArea(pts: Area, maxPts = 60): Area {
  const round = (p: [number, number]): [number, number] => [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5]
  if (pts.length <= maxPts) return pts.map(round)
  const dist = (p: [number, number], a: [number, number], b: [number, number]) => {
    const dx = b[1] - a[1], dy = b[0] - a[0]
    const len = dx * dx + dy * dy
    if (!len) return Math.hypot(p[1] - a[1], p[0] - a[0])
    const t = Math.max(0, Math.min(1, ((p[1] - a[1]) * dx + (p[0] - a[0]) * dy) / len))
    return Math.hypot(p[1] - (a[1] + t * dx), p[0] - (a[0] + t * dy))
  }
  const rdp = (list: Area, eps: number): Area => {
    let idx = 0, max = 0
    for (let i = 1; i < list.length - 1; i++) { const d = dist(list[i], list[0], list[list.length - 1]); if (d > max) { max = d; idx = i } }
    if (max <= eps) return [list[0], list[list.length - 1]]
    const left = rdp(list.slice(0, idx + 1), eps), right = rdp(list.slice(idx), eps)
    return [...left.slice(0, -1), ...right]
  }
  let eps = 1e-5, out = pts
  for (let k = 0; k < 30 && out.length > maxPts; k++) { out = rdp(pts, eps); eps *= 1.6 }
  return out.map(round)
}

/** Для ссылки: [[lat,lng],…] ↔ плоский список чисел. */
export const flatArea = (a: Area) => a.flatMap((p) => p)
export function unflatArea(v: unknown): Area | null {
  if (!Array.isArray(v) || v.length < 6 || v.length % 2 || v.some((x) => typeof x !== 'number')) return null
  const out: Area = []
  for (let i = 0; i < v.length; i += 2) out.push([v[i], v[i + 1]])
  return out
}
