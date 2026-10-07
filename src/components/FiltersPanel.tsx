import { useMemo, useRef, useState } from 'react'
import type { Guide, Row, Stop } from '../lib/types'
import { FLAG_LABELS, defaultFilters, type Filters, type FlagKey, type RangeKey } from '../lib/filters'
import { TYPES, TYPE_ORDER } from '../lib/rows'
import { TC_LABELS, tcHas, type TcKey } from '../lib/tcmarks'
import { plural } from '../lib/format'
import { useMarks } from '../hooks/useMarks'
import { useLegend } from '../hooks/useLegend'
import { radiusText } from '../lib/maplegend'

interface Props { filters: Filters; setFilters: (u: (f: Filters) => Filters) => void; rows: Row[]; stop: Stop; guide: Guide; shown: number; total: number }

const RANGES: [RangeKey, RangeKey | null, string, number][] = [
  ['pmin', 'pmax', 'Цена за ночь, ₽', 100], ['mmin', 'mmax', 'Моя оценка', 0.1], ['tmin', 'tmax', 'Оценка trip.com', 0.1],
  ['kmax', null, 'До «нашего» отеля, км', 0.1], ['rmin', null, 'Отзывов не меньше', 10],
]
const toggled = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

export function FiltersPanel({ filters: f, setFilters, rows, stop, guide, shown, total }: Props) {
  const store = useMarks()
  const [legend] = useLegend()
  // useMemo — аналог computed во Vue: пересчёт только при смене rows.
  const { zoneCounts, typeCounts, saved, bal, balRoom } = useMemo(() => {
    const zoneCounts: Record<string, number> = {}, typeCounts: Record<string, number> = {}
    let saved = 0, bal = 0, balRoom = 0
    for (const r of rows) {
      zoneCounts[r.z] = (zoneCounts[r.z] || 0) + 1
      typeCounts[r.tg] = (typeCounts[r.tg] || 0) + 1
      if (r.sv) saved++
      if (r.balcony) bal++
      if (r.balRoom) balRoom++
    }
    return { zoneCounts, typeCounts, saved, bal, balRoom }
  }, [rows])
  const zones = useMemo(() => {
    const order = guide.districts.map((d) => d.t)
    return Object.keys(zoneCounts).sort((a, b) => +stop.prio.includes(b) - +stop.prio.includes(a) || order.indexOf(a) - order.indexOf(b))
  }, [zoneCounts, guide, stop])
  const flags = FLAG_LABELS.filter(([k]) => k !== 'saved' || saved)
  // у «Только в радиусе» вместо числа — текущий радиус круга с карты
  const flagCount = (k: FlagKey) => (k === 'inradius' ? radiusText(legend.r) : k === 'balcony' ? bal : k === 'balroom' ? balRoom : k === 'saved' ? saved : null)

  const setRange = (k: RangeKey, v: string) => setFilters((x) => {
    const ranges = { ...x.ranges }
    const n = v.trim().replace(',', '.')
    if (n === '' || isNaN(+n)) delete ranges[k]; else ranges[k] = +n
    return { ...x, ranges }
  })

  const counts = store.counts(stop.id)
  const others = store.othersCounts(stop.id)
  const [clearLabel, setClearLabel] = useState('Очистить мои отметки остановки')
  const armed = useRef(false)
  const clearMarks = () => {
    const n = counts.p + counts.m
    const resetLabel = () => setClearLabel('Очистить мои отметки остановки')
    if (!n) { setClearLabel('Отметок пока нет'); setTimeout(resetLabel, 1500); return }
    if (armed.current) { store.clearStop(stop.id); armed.current = false; resetLabel(); return }
    armed.current = true
    setClearLabel(`Точно удалить ${n} ${plural(n, 'отметку', 'отметки', 'отметок')}? Нажмите ещё раз`)
    setTimeout(() => { if (armed.current) { armed.current = false; resetLabel() } }, 4000)
  }
  const tcCounts = useMemo(() => Object.fromEntries(TC_LABELS.map(([t]) => [t, rows.filter((r) => tcHas(r.tc, t)).length])) as Record<TcKey, number>, [rows])
  const typeTitle = (t: string) => (TYPES.find((x) => x[0] === t)?.[1] ?? ['без указанного типа']).join(', ')

  return (
    <div className="panel">
      <div className="prow">
        <label className="search"><span className="glabel">Поиск</span>
          <input type="search" placeholder="Название отеля" value={f.q} onChange={(e) => { const q = e.target.value; setFilters((x) => ({ ...x, q })) }} />
        </label>
        <div className="group">
          <span className="glabel">Районы {stop.prio.length > 0 && '(обведены районы из вашего плана)'}</span>
          <div className="zones">
            {zones.map((z) => (
              <button key={z} type="button" className={`chip ${stop.prio.includes(z) ? 'prio' : ''}`} aria-pressed={f.zones.includes(z)}
                onClick={() => setFilters((x) => ({ ...x, zones: toggled(x.zones, z) }))}>
                <span className="box">✓</span>{z} <span className="sub">{zoneCounts[z]}</span>
              </button>
            ))}
            <button className="link" type="button" onClick={() => setFilters((x) => ({ ...x, zones: [] }))}>Весь город</button>
          </div>
        </div>
      </div>
      <div className="prow">
        <div className="group">
          <span className="glabel">Тип жилья</span>
          <div className="zones">
            {TYPE_ORDER.filter((t) => typeCounts[t]).map((t) => (
              <button key={t} type="button" className="chip" title={typeTitle(t)} aria-pressed={f.types.includes(t)}
                onClick={() => setFilters((x) => ({ ...x, types: toggled(x.types, t) }))}>
                <span className="box">✓</span>{t} <span className="sub">{typeCounts[t]}</span>
              </button>
            ))}
            <button className="link" type="button" onClick={() => setFilters((x) => ({ ...x, types: [] }))}>Все типы</button>
          </div>
        </div>
        <div className="group">
          <span className="glabel">Отметки trip.com (есть хотя бы одна из выбранных)</span>
          <div className="zones">
            {TC_LABELS.filter(([k]) => tcCounts[k]).map(([k, label, title]) => (
              <button key={k} type="button" className="chip" title={title} aria-pressed={f.tcm.includes(k)}
                onClick={() => setFilters((x) => ({ ...x, tcm: toggled(x.tcm, k) as TcKey[] }))}>
                <span className="box">✓</span>{label} <span className="sub">{tcCounts[k]}</span>
              </button>
            ))}
            <button className="link" type="button" onClick={() => setFilters((x) => ({ ...x, tcm: [] }))}>Любые</button>
          </div>
          </div>
      </div>
      <div className="prow">
        {RANGES.map(([a, b, label, step]) => (
          <div key={a} className="group">
            <span className="glabel">{label}</span>
            <div className="pair">
              <input type="number" step={step} placeholder={b ? 'от' : a === 'rmin' ? '0' : 'до'} value={f.ranges[a] ?? ''} onChange={(e) => setRange(a, e.target.value)} />
              {b && <><span>—</span><input type="number" step={step} placeholder="до" value={f.ranges[b] ?? ''} onChange={(e) => setRange(b, e.target.value)} /></>}
            </div>
          </div>
        ))}
      </div>
      <div className="prow">
        {flags.map(([k, label]) => (
          <button key={k} type="button" className="chip fc" aria-pressed={f.flags.includes(k)}
            onClick={() => setFilters((x) => ({ ...x, flags: toggled(x.flags, k) as FlagKey[] }))}>
            <span className="box">✓</span>{label}{flagCount(k) != null && <span className="sub">{flagCount(k)}</span>}
          </button>
        ))}
        {f.area && (
          <button type="button" className="chip fc" aria-pressed="true" title="Отели внутри области, обведённой лассо на карте. Нажмите, чтобы убрать"
            onClick={() => setFilters((x) => ({ ...x, area: null }))}>
            <span className="box">✓</span>В обведённой области<span className="sub">✕</span>
          </button>
        )}
        <button className="link" type="button" onClick={() => setFilters(() => defaultFilters(stop))}>Сбросить фильтры</button>
        <button className="link" type="button" onClick={clearMarks}>{clearLabel}</button>
        <span className="count">
          Показано {shown} из {total}
          {(counts.p > 0 || counts.m > 0) && <>. Ваши отметки: +{counts.p}, −{counts.m}</>}
          {others.map((o) => <span key={o.uid}>; {o.name}: +{o.p}, −{o.m}</span>)}
        </span>
      </div>
    </div>
  )
}
