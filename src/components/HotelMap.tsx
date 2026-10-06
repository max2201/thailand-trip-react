import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import L from 'leaflet'
import type { Row, Stop } from '../lib/types'
import { scoreColor } from '../lib/format'
import { boxStyle, canvasStyle, defaultMapSize, keyResize, loadMapSize, saveMapSize, startResize, type MapSize } from '../lib/mapsize'
import {
  LEGEND_MARK, LEGEND_SCORE, R_MAX, R_MIN, R_STEP, legendCounts, parseRadius, pinHtml, radiusText,
  shownOnMap, toggleKey, tooltipHtml, type LegendKey,
} from '../lib/maplegend'
import { useMarks } from '../hooks/useMarks'
import { useLegend } from '../hooks/useLegend'

const cssVar = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888'
const colorOf = (r: Row) => (r.anchor ? cssVar('--ink') : cssVar(scoreColor(r.my).slice(4, -1)))

interface Props { rows: Row[]; visible: Set<number>; stop: Stop; selected: number | null; onSelect: (id: number) => void }
interface Entry { layer: L.CircleMarker | L.Marker; kind: string; on: boolean }

export function HotelMap({ rows, visible, stop, selected, onSelect }: Props) {
  const store = useMarks()
  const dock = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLElement>(null)
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const group = useRef<L.LayerGroup | null>(null)
  const ring = useRef<L.Circle | null>(null)
  const entries = useRef(new Map<number, Entry>())
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  // Размер: свой (сохранённый) или по умолчанию. Тянем за уголок — см. lib/mapsize.ts.
  const [custom, setCustom] = useState<MapSize | null>(loadMapSize)
  const size = custom ?? defaultMapSize()
  const onResizeStart = (e: PointerEvent<HTMLButtonElement>) => {
    // currentTarget берём из React-события: у nativeEvent он указывает на корень приложения
    if (box.current && el.current) startResize(e.nativeEvent, e.currentTarget, box.current, el.current, setCustom, saveMapSize)
  }
  const onResizeKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const s = box.current && el.current && keyResize(e.nativeEvent, box.current, el.current)
    if (s) { setCustom(s); saveMapSize(s) }
  }
  const resetSize = () => { setCustom(null); saveMapSize(null) }

  // Легенда-пульт: меняет только то, что видно на карте (радиус ещё читает флажок «Только в радиусе»).
  const [legend, setLegend] = useLegend()
  const setRadius = (r: number) => setLegend({ off: legend.off.filter((k) => k !== 'ring'), r })
  // Радиус текстом: черновик живёт, пока поле в фокусе; Enter или уход из поля — применить, Esc — отмена.
  const [draft, setDraft] = useState<string | null>(null)
  const cancelDraft = useRef(false)
  const commitDraft = () => {
    if (!cancelDraft.current && draft != null) { const v = parseRadius(draft); if (v != null) setRadius(v) }
    cancelDraft.current = false
    setDraft(null)
  }
  const isOn = (k: LegendKey) => !legend.off.includes(k)
  const toggle = (k: LegendKey) => setLegend(toggleKey(legend, k))
  const counts = useMemo(() => legendCounts(rows, visible, (id) => store.mine(stop.id, id)),
    [rows, visible, store, store.version, stop.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Создаём карту один раз на остановку (аналог onMounted/onBeforeUnmount во Vue).
  useEffect(() => {
    if (!el.current) return
    const m = L.map(el.current, { preferCanvas: true }).setView([stop.alat, stop.alng], 15)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m)
    ring.current = L.circle([stop.alat, stop.alng], { radius: 1000, color: cssVar('--accent'), weight: 1.5, dashArray: '6 6', fill: false, interactive: false })
    group.current = L.layerGroup().addTo(m)
    map.current = m
    const es = entries.current
    return () => { m.remove(); es.clear(); map.current = null; group.current = null; ring.current = null }
  }, [rows, stop])

  // Точки: обычные на canvas, отмеченные — значками с «+»/«−». Перерисовываем при смене
  // фильтров таблицы, выбранного отеля, отметок и легенды (аналог watch во Vue).
  useEffect(() => {
    const m = map.current, g = group.current
    if (!m || !g) return
    const es = entries.current
    for (const r of rows) {
      if (!r.la || !r.ln) continue
      const mark = store.mine(stop.id, r.id)
      const sel = selected === r.id
      const kind = mark ? `${mark}${sel ? 's' : ''}` : '0'
      let e = es.get(r.id)
      if (e && e.kind !== kind) { g.removeLayer(e.layer); es.delete(r.id); e = undefined }
      if (!shownOnMap(r, mark, visible, legend.off, selected)) {
        if (e?.on) { g.removeLayer(e.layer); e.on = false }
        continue
      }
      if (!e) {
        const layer = mark
          ? L.marker([r.la, r.ln], { icon: L.divIcon({ className: 'mpin-wrap', html: pinHtml(mark, colorOf(r), sel), iconSize: [22, 22], iconAnchor: [11, 11] }), keyboard: false, riseOnHover: true, zIndexOffset: mark === 1 ? 500 : 0 })
          : L.circleMarker([r.la, r.ln], { radius: r.anchor ? 9 : 6, weight: 1.5, color: '#fff', fillColor: colorOf(r), fillOpacity: 0.95 })
        layer.bindTooltip('')
        layer.on('click', () => onSelectRef.current(r.id))
        e = { layer, kind, on: false }
        es.set(r.id, e)
      }
      if (!e.on) { g.addLayer(e.layer); e.on = true }
      if (e.layer instanceof L.CircleMarker) {
        e.layer.setStyle({ weight: sel ? 3 : 1.5, color: sel ? cssVar('--ink') : '#fff' })
        if (sel || r.anchor) e.layer.bringToFront()
      }
      const others = store.othersFor(stop.id, r.id).map(([u, v]) => [store.nameOf(u), v] as [string, number])
      e.layer.setTooltipContent(tooltipHtml(r, mark, others))
    }
    const c = ring.current
    if (c) {
      c.setRadius(legend.r)
      if (!legend.off.includes('ring')) { if (!m.hasLayer(c)) c.addTo(m) } else c.remove()
    }
  }, [rows, stop, visible, selected, legend, store, store.version])

  // Выбранный отель — к центру карты (отдельно, чтобы смена фильтров не двигала карту).
  useEffect(() => {
    const e = selected != null ? entries.current.get(selected) : null
    if (e && map.current) { map.current.panTo(e.layer.getLatLng()); e.layer.openTooltip() }
  }, [selected])

  // Высота «шапки» с картой нужна таблице: она занимает остаток экрана под картой.
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

  return (
    <div ref={dock} className="mapdock">
      <figure ref={box} className="mapbox" style={boxStyle(size)}>
        <div ref={el} className="mapcanvas" style={canvasStyle(size)} />
        <figcaption>
          <div className="lg" role="group" aria-label="Что показывать на карте (на выборку в таблице не влияет)">
            {LEGEND_SCORE.map(([k, label, c]) => (
              <button key={k} type="button" className="lgc" aria-pressed={isOn(k)} onClick={() => toggle(k)}>
                <i className="lgdot" style={{ background: `var(${c})` }} /><span className="lgl">{label}</span><small>{counts[k] ?? 0}</small>
              </button>
            ))}
            <span className="lgsep" aria-hidden="true" />
            {LEGEND_MARK.map(([k, label, m]) => (
              <button key={k} type="button" className="lgc" aria-pressed={isOn(k)} onClick={() => toggle(k)}>
                <i className={'lgpin lp' + m}>{m === 1 ? '+' : m === -1 ? '−' : ''}</i><span className="lgl">{label}</span><small>{counts[k] ?? 0}</small>
              </button>
            ))}
            <span className="lgsep" aria-hidden="true" />
            <button type="button" className="lgc" aria-pressed={isOn('anchor')} onClick={() => toggle('anchor')}>
              <i className="lgdot lgbig" style={{ background: 'var(--ink)' }} /><span className="lgl">«наш» отель</span>
            </button>
            <span className="lgring">
              <button type="button" className="lgc" aria-pressed={isOn('ring')} onClick={() => toggle('ring')}><i className="lgcirc" /><span className="lgl">радиус</span></button>
              <input type="range" min={R_MIN} max={R_MAX} step={R_STEP} value={legend.r} aria-label="Радиус круга вокруг «нашего» отеля"
                onChange={(e) => setRadius(+e.target.value)} />
              <input className="lgnum" type="text" inputMode="decimal" value={draft ?? radiusText(legend.r)} aria-label="Радиус текстом, например 1,5 или 800 м"
                title="Можно ввести: 1,5 · 1.5 км · 800 · 800 м (от 100 м до 5 км)" onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setDraft(e.target.value)} onBlur={commitDraft}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { cancelDraft.current = true; e.currentTarget.blur() } }} />
            </span>
            {legend.off.length > 0 && <button type="button" className="lglink" onClick={() => setLegend({ ...legend, off: [] })}>показать всё</button>}
          </div>
          {custom
            ? <button className="mreset" type="button" onClick={resetSize}>вернуть размер</button>
            : <span className="mhint">размер ↘</span>}
        </figcaption>
        <button className="mresize" type="button" aria-label="Изменить размер карты: тяните или используйте стрелки" title="Потяните, чтобы изменить размер. Двойной клик — вернуть как было"
          onPointerDown={onResizeStart} onKeyDown={onResizeKey} onDoubleClick={resetSize}>
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M11 3 3 11M11 7 7 11" /></svg>
        </button>
      </figure>
    </div>
  )
}
