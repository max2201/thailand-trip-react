import L from 'leaflet'
import { simplifyArea, type Area } from './lasso'

/**
 * Режим «лассо» для карты Leaflet: пока он включён, карта не двигается, а движение с зажатой
 * кнопкой мыши (или пальцем) рисует линию. Отпустили — линия замыкается в область и уходит в onDone.
 * Не зависит от фреймворка: Vue- и React-версии карты подключают его одинаково.
 */
export interface Lasso { set(on: boolean): void; destroy(): void }

export function attachLasso(map: L.Map, color: string, onDone: (a: Area) => void, onState: (on: boolean) => void): Lasso {
  const c = map.getContainer()
  let on = false
  let pts: L.LatLng[] = []
  let line: L.Polyline | null = null
  let last: L.Point | null = null
  let pid = -1
  const stop = (e: Event) => { e.stopPropagation(); e.preventDefault() }
  const clear = () => { line?.remove(); line = null; pts = []; last = null; pid = -1 }

  const down = (e: PointerEvent) => {
    if (!on || (e.pointerType === 'mouse' && e.button !== 0)) return
    stop(e)
    pid = e.pointerId
    try { c.setPointerCapture(pid) } catch { /* не страшно */ }
    last = map.mouseEventToContainerPoint(e)
    pts = [map.containerPointToLatLng(last)]
    line = L.polyline(pts, { color, weight: 2.5, dashArray: '5 5', interactive: false }).addTo(map)
  }
  const move = (e: PointerEvent) => {
    if (!on || !line || e.pointerId !== pid) return
    stop(e)
    const p = map.mouseEventToContainerPoint(e)
    if (last && p.distanceTo(last) < 4) return
    last = p
    const ll = map.containerPointToLatLng(p)
    pts.push(ll)
    line.addLatLng(ll)
  }
  const up = (e: PointerEvent) => {
    if (!on || !line || e.pointerId !== pid) return
    stop(e)
    const drawn = pts.map((p) => [p.lat, p.lng] as [number, number])
    clear()
    set(false)
    if (drawn.length >= 3) onDone(simplifyArea(drawn))
  }
  const cancel = () => { if (line) clear() }
  // Пока лассо включено, клики и касания не доходят до Leaflet и точек на карте.
  const block = (e: Event) => { if (on) e.stopPropagation() }
  const key = (e: KeyboardEvent) => { if (on && e.key === 'Escape') set(false) }
  const BLOCKED = ['mousedown', 'mouseup', 'click', 'dblclick', 'touchstart', 'touchmove', 'touchend', 'contextmenu']

  function set(v: boolean) {
    if (v === on) return
    on = v
    for (const h of [map.dragging, map.touchZoom, map.doubleClickZoom, map.boxZoom]) { if (v) h.disable(); else h.enable() }
    c.classList.toggle('lasso-on', v)
    if (!v) clear()
    onState(v)
  }

  c.addEventListener('pointerdown', down, true)
  c.addEventListener('pointermove', move, true)
  c.addEventListener('pointerup', up, true)
  c.addEventListener('pointercancel', cancel, true)
  BLOCKED.forEach((t) => c.addEventListener(t, block, true))
  document.addEventListener('keydown', key)
  return {
    set,
    destroy() {
      c.removeEventListener('pointerdown', down, true)
      c.removeEventListener('pointermove', move, true)
      c.removeEventListener('pointerup', up, true)
      c.removeEventListener('pointercancel', cancel, true)
      BLOCKED.forEach((t) => c.removeEventListener(t, block, true))
      document.removeEventListener('keydown', key)
      clear()
    },
  }
}

/** Нарисовать обведённую область (или убрать, если её нет). Возвращает новый слой. */
export function drawArea(map: L.Map, area: Area | null, color: string, prev: L.Polygon | null) {
  prev?.remove()
  if (!area || area.length < 3) return null
  return L.polygon(area, { color, weight: 2, dashArray: '6 4', fillColor: color, fillOpacity: 0.07, interactive: false }).addTo(map)
}
