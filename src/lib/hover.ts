import L from 'leaflet'

/**
 * Наведение на название отеля в таблице → его точка на карте подрастает и выходит на передний план.
 * Таблица и карта — соседние компоненты, поэтому связь через крошечное общее хранилище без фреймворка.
 */
let cur: number | null = null
const listeners = new Set<(id: number | null, prev: number | null) => void>()
export const hoverHotel = {
  get: () => cur,
  set(id: number | null) {
    if (id === cur) return
    const prev = cur
    cur = id
    listeners.forEach((f) => f(id, prev))
  },
  on(f: (id: number | null, prev: number | null) => void) { listeners.add(f); return () => { listeners.delete(f) } },
}

/** Подсветить или вернуть точку. Обычная точка (canvas) увеличивается и получает тёмную обводку, значок «+/−» — класс hov. */
export function setPointHover(layer: L.Layer | undefined, on: boolean, ink: string) {
  if (!layer) return
  if (layer instanceof L.CircleMarker) {
    const o = layer.options as L.CircleMarkerOptions & { _r?: number; _c?: string; _w?: number }
    if (on) {
      if (o._r == null) { o._r = layer.getRadius(); o._c = o.color; o._w = o.weight }
      layer.setRadius(o._r + 5)
      layer.setStyle({ color: ink, weight: 3 })
      layer.bringToFront()
    } else if (o._r != null) {
      layer.setRadius(o._r)
      layer.setStyle({ color: o._c, weight: o._w })
      delete o._r; delete o._c; delete o._w
    }
  } else if (layer instanceof L.Marker) {
    const el = layer.getElement()
    el?.querySelector('.mpin')?.classList.toggle('hov', on)
    const o = layer.options as L.MarkerOptions & { _z?: number }
    if (on) { if (o._z == null) o._z = o.zIndexOffset ?? 0; layer.setZIndexOffset(3000) }
    else if (o._z != null) { layer.setZIndexOffset(o._z); delete o._z }
  }
}
