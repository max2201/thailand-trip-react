import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Guide, Stop, StopRows } from '../lib/types'
import { applyFilters, encodeFilters, type Filters } from '../lib/filters'
import { useMarks } from '../hooks/useMarks'
import { useTrip } from '../store/trip'
import { FiltersPanel } from './FiltersPanel'
import { HotelsTable } from './HotelsTable'
import { HotelCard } from './HotelCard'
import { HotelMap } from './HotelMap'

const VKEY = 'thai-trip-view'
const narrow = () => window.matchMedia('(max-width: 760px)').matches

export function HotelsPane({ stop, data, guide, filters }: { stop: Stop; data: StopRows; guide: Guide; filters: Filters }) {
  const store = useMarks()
  const setFiltersFor = useTrip((s) => s.setFilters)
  const setFilters = (u: (f: Filters) => Filters) => setFiltersFor(stop.id, u)
  const [, setSearch] = useSearchParams()

  // Список зависит и от отметок (фильтры «с плюсом»), поэтому учитываем version хранилища.
  const list = useMemo(() => applyFilters(data.rows, filters, {
    mine: (id) => store.mine(stop.id, id), anyPlus: (id) => store.anyPlus(stop.id, id),
  }), [data.rows, filters, store, store.version, stop.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const pin = useMemo(() => data.rows.find((r) => r.anchor), [data.rows])
  const visible = useMemo(() => new Set(list.map((r) => r.id)), [list])

  const [view, setView] = useState<'table' | 'cards'>(() => {
    try { const v = localStorage.getItem(VKEY); if (v === 'table' || v === 'cards') return v } catch { /* ignore */ }
    return narrow() ? 'cards' : 'table'
  })
  useEffect(() => { try { localStorage.setItem(VKEY, view) } catch { /* ignore */ } }, [view])
  const [showMap, setShowMap] = useState(() => !narrow())
  const [cardLimit, setCardLimit] = useState(40)
  useEffect(() => setCardLimit(40), [filters])
  const [selected, setSelected] = useState<number | null>(null)

  const select = (id: number) => {
    setSelected(id)
    if (view === 'cards') {
      const i = list.findIndex((r) => r.id === id)
      if (i >= cardLimit) setCardLimit(i + 10)
      setTimeout(() => document.getElementById('c' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
    }
  }

  // Фильтры → адрес страницы (?f=…), чтобы ссылкой можно было поделиться.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch((prev) => {
        const next = new URLSearchParams(prev)
        const f = encodeFilters(filters, stop)
        if (f) next.set('f', f); else next.delete('f')
        return next
      }, { replace: true })
    }, 300)
    return () => clearTimeout(t)
  }, [filters, stop, setSearch])

  return (
    <>
      <FiltersPanel filters={filters} setFilters={setFilters} rows={data.rows} stop={stop} guide={guide} shown={list.length} total={data.rows.length} />
      <div className="viewbar">
        <div className="seg-toggle" role="group" aria-label="Вид">
          <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>Таблица</button>
          <button type="button" aria-pressed={view === 'cards'} onClick={() => setView('cards')}>Карточки</button>
        </div>
        <button className="link" type="button" onClick={() => setShowMap((v) => !v)}>{showMap ? 'Скрыть карту' : 'Показать карту'}</button>
      </div>
      <div className={showMap ? 'hgrid2' : ''} style={showMap ? undefined : { marginTop: 12 }}>
        <div>
          {view === 'table' ? (
            <HotelsTable list={list} pin={pin} stop={stop} filters={filters} selected={selected} onSelect={select}
              onSort={(sort, dir) => setFilters((x) => ({ ...x, sort, dir }))} />
          ) : (
            <div className="cards">
              {pin && <HotelCard r={pin} stop={stop} selected={selected === pin.id} />}
              {list.slice(0, cardLimit).map((r) => <HotelCard key={r.id} r={r} stop={stop} selected={selected === r.id} />)}
              {list.length > cardLimit && <button className="more" type="button" onClick={() => setCardLimit((n) => n + 40)}>Показать ещё {Math.min(40, list.length - cardLimit)}</button>}
              {!list.length && <p className="empty">Под эти фильтры ничего не подходит.</p>}
            </div>
          )}
        </div>
        {showMap && <HotelMap rows={data.rows} visible={visible} stop={stop} selected={selected} onSelect={select} />}
      </div>
    </>
  )
}
