import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { stopById, useTrip } from '../store/trip'
import type { Stop, StopRows } from '../lib/types'
import { dec1, fmt, plural } from '../lib/format'
import { tripLink } from '../lib/rows'
import { HotelsPane } from './HotelsPane'
import { DistrictsPane, ListPane } from './Panes'

export const TABS = ['hotels', 'districts', 'sights', 'trips', 'events'] as const
type Tab = (typeof TABS)[number]
const TAB_LABELS: Record<Tab, string> = { hotels: 'Отели', districts: 'Районы', sights: 'Что посмотреть', trips: 'Поездки до 2 часов', events: 'События на ваши даты' }

function PlanCard({ stop, data, id, who }: { stop: Stop; data: StopRows; id: number; who: string }) {
  const r = data.rows.find((x) => x.id === id)
  return (
    <div className="pcard">
      <div className="who">{who}</div>
      {r ? (
        <>
          <h3><a href={tripLink(id, stop)} target="_blank" rel="noopener">{r.nm}</a></h3>
          <div className="facts">
            <div><b>{dec1(r.my)}</b><span>моя оценка</span></div>
            <div><b>{dec1(r.sc)}</b><span>trip.com</span></div>
            <div><b>{r.night ? fmt(r.night) + ' ₽' : 'нет цены'}</b><span>за ночь</span></div>
            <div><b>{r.rank}</b><span>место из {data.rows.length}</span></div>
          </div>
          <p>Насекомые: {r.ins}, запах: {r.sm}, сырость: {r.dm} из {fmt(r.an)} отзывов. {r.co[0] ? r.co[0] + '.' : ''}</p>
        </>
      ) : (
        <><h3>{id === stop.anchor ? stop.anchorName : stop.proposedName}</h3><p>Нет данных на trip.com на эти даты.</p></>
      )}
    </div>
  )
}

export function StopView() {
  const { stop: stopId, tab: tabParam } = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const index = useTrip((s) => s.index)
  const ensureStop = useTrip((s) => s.ensureStop)
  const initFilters = useTrip((s) => s.initFilters)
  const setFilters = useTrip((s) => s.setFilters)
  const s = stopById(index, stopId)
  const data = useTrip((st) => (s ? st.rows[s.id] : undefined))
  const filters = useTrip((st) => (s ? st.filters[s.id] : undefined))
  const [error, setError] = useState('')
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : 'hotels'

  // Загрузка данных остановки (аналог watch(s, …, { immediate: true }) во Vue).
  useEffect(() => {
    if (!s) return
    setError('')
    ensureStop(s).then(() => initFilters(s, search.get('f'))).catch((e) => setError(String(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.id])

  if (!index) return null
  if (!s) return <Navigate to="/s1" replace />
  const guide = index.guides[s.city]
  const tabCount = (t: Tab) => ({ hotels: data?.rows.length ?? s.priceCount, districts: guide.districts.length, sights: guide.sights.length, trips: guide.trips.length, events: s.events.length })[t]
  const showZone = (z: string) => { setFilters(s.id, (f) => ({ ...f, zones: [z] })); navigate({ pathname: `/${s.id}/hotels`, search: search.toString() }) }

  return (
    <main className="stop">
      <div className="shead"><div>
        <h2><span className={`cityline c-${s.city}`} />{s.title}: {s.sub}</h2>
        <div className="sub">{s.days}, {s.nights} {plural(s.nights, 'ночь', 'ночи', 'ночей')}{s.together ? ', вместе' : ', живёте раздельно'}. В таблице — все отели города до {fmt(s.limit)} ₽ за ночь</div>
      </div></div>
      {error ? <div className="err">Не удалось загрузить данные: {error}</div>
        : !data || !filters ? <div className="loading">Загружаю отели…</div>
        : (
          <>
            <div className="planned">
              {s.anchor === s.proposed
                ? <PlanCard stop={s} data={data} id={s.anchor} who="Отель по плану — от него считаются расстояния" />
                : <>
                    <PlanCard stop={s} data={data} id={s.proposed} who="Предложен вам в плане" />
                    <PlanCard stop={s} data={data} id={s.anchor} who="«Наш отель» из плана — от него считаются расстояния" />
                  </>}
            </div>
            <p className="note">{s.note}</p>
            <nav className="tabs" role="tablist">
              {TABS.map((t) => (
                <Link key={t} to={{ pathname: `/${s.id}/${t}`, search: search.toString() }} className="tab" role="tab" aria-selected={tab === t}>
                  {TAB_LABELS[t]}<span className="n">{tabCount(t)}</span>
                </Link>
              ))}
            </nav>
            {tab === 'hotels' ? <HotelsPane stop={s} data={data} guide={guide} filters={filters} />
              : tab === 'districts' ? <DistrictsPane stop={s} data={data} guide={guide} onShowZone={showZone} />
              : <ListPane kind={tab} stop={s} guide={guide} index={index} />}
          </>
        )}
    </main>
  )
}
