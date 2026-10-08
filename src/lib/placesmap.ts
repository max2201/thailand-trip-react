import L from 'leaflet'
import type { Row } from './types'

/**
 * Карта для вкладок «Районы», «Что посмотреть», «Поездки», «События»: пронумерованные точки (и области районов),
 * номер совпадает с номером карточки в списке. Клик по точке — onPick (список прокручивается к карточке),
 * наведение на карточку — highlight (точка или район выделяются на карте). Не зависит от фреймворка.
 */
export type LatLng = [number, number]
export interface PlaceItem { id: string; n: number; name: string; ll?: LatLng; area?: LatLng[]; prio?: boolean }
export interface PlacesMap {
  set(items: PlaceItem[], anchor?: { ll: LatLng; name: string } | null): void
  highlight(id: string | null): void
  invalidate(): void
  destroy(): void
}

const cssVar = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888'

export function createPlacesMap(el: HTMLElement, onPick: (id: string) => void, onHover: (id: string | null) => void): PlacesMap {
  const map = L.map(el, { zoomControl: true, scrollWheelZoom: true }).setView([13.75, 100.5], 12)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map)
  const group = L.layerGroup().addTo(map)
  const layers = new Map<string, { pin: L.Marker; area?: L.Polygon; item: PlaceItem }>()
  let cur: string | null = null
  const areaStyle = (it: PlaceItem, on: boolean): L.PathOptions => {
    const c = it.prio ? cssVar('--accent') : cssVar('--c-pt')
    return { color: c, weight: on ? 3 : 1.5, opacity: on ? 1 : 0.7, fillColor: c, fillOpacity: on ? 0.28 : 0.1, dashArray: on ? undefined : '5 4' }
  }

  function set(items: PlaceItem[], anchor?: { ll: LatLng; name: string } | null) {
    group.clearLayers(); layers.clear(); cur = null
    const pts: L.LatLng[] = []
    // большие районы рисуем первыми, чтобы маленькие лежали поверх и их можно было навести и нажать
    const size = (it: PlaceItem) => { if (!it.area) return 0; const la = it.area.map((p) => p[0]), ln = it.area.map((p) => p[1]); return (Math.max(...la) - Math.min(...la)) * (Math.max(...ln) - Math.min(...ln)) }
    for (const it of [...items].sort((a, b) => size(b) - size(a))) {
      let area: L.Polygon | undefined
      let ll = it.ll
      if (it.area && it.area.length >= 3) {
        area = L.polygon(it.area, areaStyle(it, false)).addTo(group)
        area.on('click', () => onPick(it.id))
        area.on('mouseover', () => { highlight(it.id); onHover(it.id) })
        area.on('mouseout', () => { highlight(null); onHover(null) })
        if (!ll) { const c = area.getBounds().getCenter(); ll = [c.lat, c.lng] }
        area.getLatLngs().flat(2).forEach((p) => pts.push(p as L.LatLng))
      }
      if (!ll) continue
      const pin = L.marker(ll, {
        icon: L.divIcon({ className: 'pm-wrap', html: `<div class="pm-pin${it.prio ? ' prio' : ''}">${it.n}</div>`, iconSize: [24, 24], iconAnchor: [12, 12] }),
        keyboard: false, riseOnHover: true,
      }).addTo(group)
      pin.bindTooltip(it.name, { direction: 'top', offset: [0, -12] })
      pin.on('click', () => onPick(it.id))
      pin.on('mouseover', () => { highlight(it.id); onHover(it.id) })
      pin.on('mouseout', () => { highlight(null); onHover(null) })
      layers.set(it.id, { pin, area, item: it })
      pts.push(L.latLng(ll))
    }
    if (anchor) {
      L.marker(anchor.ll, { icon: L.divIcon({ className: 'pm-wrap', html: '<div class="pm-home" aria-hidden="true"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), keyboard: false, interactive: true, zIndexOffset: -1000 })
        .bindTooltip(anchor.name, { direction: 'top', offset: [0, -8] }).addTo(group)
      pts.push(L.latLng(anchor.ll))
    }
    if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [28, 28], maxZoom: 15 })
  }

  function mark(id: string, on: boolean) {
    const l = layers.get(id)
    if (!l) return
    l.pin.getElement()?.querySelector('.pm-pin')?.classList.toggle('hov', on)
    l.pin.setZIndexOffset(on ? 2000 : 0)
    // порядок слоёв не трогаем: вложенные районы всегда лежат поверх больших (см. сортировку в set),
    // иначе подсвеченный большой район поднимался наверх и перекрывал внутренние
    if (l.area) l.area.setStyle(areaStyle(l.item, on))
  }
  function highlight(id: string | null) {
    if (id === cur) return
    if (cur) mark(cur, false)
    cur = id
    if (!id) return
    mark(id, true)
    // если точка за краем карты (поездки бывают за 100 км) — подвинем карту, не меняя масштаб
    const l = layers.get(id)
    const b = l?.area ? l.area.getBounds() : l ? L.latLngBounds([l.pin.getLatLng()]) : null
    if (b && !map.getBounds().intersects(b)) map.panTo(b.getCenter())
  }

  return {
    set,
    highlight,
    invalidate: () => map.invalidateSize({ pan: false }),
    destroy: () => { map.remove(); layers.clear() },
  }
}

/**
 * Область района по отелям его зон: выпуклая оболочка их точек без дальних выбросов
 * (дальше 2,5 медианного расстояния от центра) и с небольшим запасом по краю.
 */
export function districtArea(rows: Row[], zones: string[]): LatLng[] | null {
  const pts = rows.filter((r) => r.la && r.ln && zones.includes(r.z)).map((r) => [r.la!, r.ln!] as LatLng)
  if (pts.length < 3) return null
  const cy = pts.reduce((a, p) => a + p[0], 0) / pts.length, cx = pts.reduce((a, p) => a + p[1], 0) / pts.length
  const k = Math.cos((cy * Math.PI) / 180)
  const d = (p: LatLng) => Math.hypot(p[0] - cy, (p[1] - cx) * k)
  const med = [...pts].map(d).sort((a, b) => a - b)[Math.floor(pts.length / 2)]
  const core = pts.filter((p) => d(p) <= Math.max(med * 2.5, 0.004))
  const hull = convexHull(core.length >= 3 ? core : pts)
  if (hull.length < 3) return null
  const pad = 0.0012 // ≈130 м
  return hull.map((p) => {
    const dy = p[0] - cy, dx = (p[1] - cx) * k, len = Math.hypot(dy, dx) || 1
    return [p[0] + (dy / len) * pad, p[1] + ((dx / len) * pad) / k] as LatLng
  })
}

function convexHull(points: LatLng[]): LatLng[] {
  const p = [...points].sort((a, b) => a[1] - b[1] || a[0] - b[0])
  const cross = (o: LatLng, a: LatLng, b: LatLng) => (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1])
  const lower: LatLng[] = [], upper: LatLng[] = []
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q) }
  for (const q of p.reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q) }
  return lower.slice(0, -1).concat(upper.slice(0, -1))
}

/** Прокрутить список к карточке и коротко подсветить её. */
export function scrollToCard(id: string) {
  const el = document.querySelector<HTMLElement>(`[data-place="${CSS.escape(id)}"]`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  // вспышка через Web Animations, а не класс: фреймворк перезаписывает className карточки при наведении
  const c = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#C8105F'
  el.animate([{ boxShadow: `0 0 0 3px ${c}` }, { boxShadow: `0 0 0 3px ${c}`, offset: 0.3 }, { boxShadow: '0 0 0 0 transparent' }], { duration: 1600, easing: 'ease-out' })
}
