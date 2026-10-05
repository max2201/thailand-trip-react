import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { Row, Stop } from '../lib/types'
import { dec, dec1, fmt, scoreColor } from '../lib/format'

const cssVar = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888'

interface Props { rows: Row[]; visible: Set<number>; stop: Stop; selected: number | null; onSelect: (id: number) => void }

export function HotelMap({ rows, visible, stop, selected, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const markers = useRef(new Map<number, L.CircleMarker>())
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

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
    <figure className="mapbox">
      <div ref={el} />
      <figcaption>
        <span><i style={{ background: 'var(--good)' }} />9+</span><span><i style={{ background: 'var(--warn)' }} />8–8,9</span>
        <span><i style={{ background: 'var(--bad)' }} />ниже 8</span><span><i style={{ background: 'var(--ink)' }} />«наш» отель</span><span>пунктир — 1 км</span>
      </figcaption>
    </figure>
  )
}
