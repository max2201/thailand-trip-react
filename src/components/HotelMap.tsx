import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import L from 'leaflet'
import type { Row, Stop } from '../lib/types'
import { dec, dec1, fmt, scoreColor } from '../lib/format'
import { defaultMapSize, keyResize, loadMapSize, saveMapSize, sizeStyle, startResize, type MapSize } from '../lib/mapsize'

const cssVar = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888'

interface Props { rows: Row[]; visible: Set<number>; stop: Stop; selected: number | null; onSelect: (id: number) => void }

export function HotelMap({ rows, visible, stop, selected, onSelect }: Props) {
  const dock = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLElement>(null)
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const markers = useRef(new Map<number, L.CircleMarker>())
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  // Размер: свой (сохранённый) или по умолчанию. Тянем за уголок — см. lib/mapsize.ts.
  const [custom, setCustom] = useState<MapSize | null>(loadMapSize)
  const size = custom ?? defaultMapSize()
  const onResizeStart = (e: PointerEvent<HTMLButtonElement>) => {
    // currentTarget берём из React-события: у nativeEvent он указывает на корень приложения
    if (box.current) startResize(e.nativeEvent, e.currentTarget, box.current, setCustom, saveMapSize)
  }
  const onResizeKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const s = box.current && keyResize(e.nativeEvent, box.current)
    if (s) { setCustom(s); saveMapSize(s) }
  }
  const resetSize = () => { setCustom(null); saveMapSize(null) }

  // Создаём карту один раз на остановку (аналог onMounted/onBeforeUnmount во Vue).
  useEffect(() => {
    if (!el.current) return
    const m = L.map(el.current, { preferCanvas: true }).setView([stop.alat, stop.alng], 15)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m)
    L.circle([stop.alat, stop.alng], { radius: 1000, color: cssVar('--accent'), weight: 1.5, dashArray: '6 6', fill: false, interactive: false }).addTo(m)
    const ms = markers.current
    for (const r of rows) {
      if (!r.la || !r.ln) continue
      const mk = L.circleMarker([r.la, r.ln], { radius: r.anchor ? 9 : 6, weight: 1.5, color: '#fff', fillColor: r.anchor ? cssVar('--ink') : cssVar(scoreColor(r.my).slice(4, -1)), fillOpacity: 0.95 })
        .bindTooltip(`${r.nm}: ${r.my == null ? 'нет оценки' : dec1(r.my)}${r.km != null && !r.anchor ? ', ' + dec(r.km.toFixed(1)) + ' км' : ''}${r.night ? ', ' + fmt(r.night) + ' ₽' : ''}`)
        .on('click', () => onSelectRef.current(r.id))
        .addTo(m)
      ms.set(r.id, mk)
    }
    map.current = m
    return () => { m.remove(); ms.clear(); map.current = null }
  }, [rows, stop])

  // Высота «шапки» с картой нужна таблице: она занимает остаток экрана под залипшей картой.
  // При любом изменении размера Leaflet должен пересчитать своё полотно.
  useEffect(() => {
    const d = dock.current
    const parent = d?.parentElement
    if (!d || !parent) return
    let raf = 0
    const ro = new ResizeObserver(() => {
      parent.style.setProperty('--dockh', d.offsetHeight + 'px')
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => map.current?.invalidateSize({ pan: false }))
    })
    ro.observe(d)
    if (box.current) ro.observe(box.current)
    return () => { ro.disconnect(); cancelAnimationFrame(raf); parent.style.removeProperty('--dockh') }
  }, [])

  // Подсветка видимых по фильтрам и выбранного отеля.
  useEffect(() => {
    for (const [id, mk] of markers.current) {
      const r = rows.find((x) => x.id === id)
      const on = visible.has(id) || r?.anchor
      mk.setStyle({ fillOpacity: on ? 0.95 : 0.12, opacity: on ? 1 : 0.15, weight: selected === id ? 3 : 1.5, color: selected === id ? cssVar('--ink') : '#fff' })
      if (on) mk.bringToFront()
    }
  }, [visible, selected, rows])
  // Выбранный отель — к центру карты (отдельно, чтобы смена фильтров не двигала карту).
  useEffect(() => {
    const sel = selected != null ? markers.current.get(selected) : null
    if (sel && map.current) { map.current.panTo(sel.getLatLng()); sel.openTooltip() }
  }, [selected])

  return (
    <div ref={dock} className="mapdock">
      <figure ref={box} className="mapbox" style={sizeStyle(size)}>
        <div ref={el} className="mapcanvas" />
        <figcaption>
          <span><i style={{ background: 'var(--good)' }} />9+</span><span><i style={{ background: 'var(--warn)' }} />8–8,9</span>
          <span><i style={{ background: 'var(--bad)' }} />ниже 8</span><span><i style={{ background: 'var(--ink)' }} />«наш» отель</span><span>пунктир — 1 км</span>
          {custom
            ? <button className="mreset" type="button" onClick={resetSize}>вернуть размер</button>
            : <span className="mhint">размер — потяни за уголок</span>}
        </figcaption>
        <button className="mresize" type="button" aria-label="Изменить размер карты: тяните или используйте стрелки" title="Потяните, чтобы изменить размер. Двойной клик — вернуть как было"
          onPointerDown={onResizeStart} onKeyDown={onResizeKey} onDoubleClick={resetSize}>
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M11 3 3 11M11 7 7 11" /></svg>
        </button>
      </figure>
    </div>
  )
}
