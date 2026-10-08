import { useMemo, useState } from 'react'
import type { Guide, Stop, StopRows, TripIndex } from '../lib/types'
import { cityCleanShare, zoneStats } from '../lib/rows'
import { fmt, plural } from '../lib/format'
import { districtArea, scrollToCard, type LatLng, type PlaceItem } from '../lib/placesmap'
import { PlacesMap } from './PlacesMap'

const anchorOf = (stop: Stop) => (stop.alat ? { ll: [stop.alat, stop.alng] as LatLng, name: 'Отель по плану: ' + stop.anchorName } : null)

export function DistrictsPane({ stop, data, guide, onShowZone }: { stop: Stop; data: StopRows; guide: Guide; onShowZone: (z: string) => void }) {
  const cc = cityCleanShare(data.rows)
  const cards = useMemo(() => [...guide.districts]
    .sort((a, b) => +stop.prio.includes(b.t) - +stop.prio.includes(a.t))
    .map((d, i) => ({ d, n: i + 1, prio: stop.prio.includes(d.t) })), [guide, stop])
  const cleanCls = (v: number | null) => (v == null ? '' : v >= cc + 8 ? 't-g' : v <= cc - 8 ? 't-b' : '')
  // Районы на карте — области по отелям их зон
  const items = useMemo<PlaceItem[]>(() => cards.map(({ d, n, prio }) => ({ id: d.t, n, name: d.t, area: districtArea(data.rows, [d.t, ...d.z]) ?? undefined, prio })), [cards, data])
  const anchor = useMemo(() => anchorOf(stop), [stop])
  const [hover, setHover] = useState<string | null>(null)
  return (
    <>
      <p className="intro">{guide.intro} «Чистые» — отели без единого упоминания насекомых, запаха и сырости; в среднем по городу на эти даты таких {cc}%.</p>
      <div className="pwrap">
        <div className="gcards">
          {cards.map(({ d, n, prio }) => {
            const st = zoneStats(data.rows, [d.t])
            return (
              <article key={d.t} data-place={d.t} className={`gcard ${prio ? 'prio' : ''} ${hover === d.t ? 'pm-on' : ''}`}
                onMouseEnter={() => setHover(d.t)} onMouseLeave={() => setHover(null)}>
                {prio && <div className="yours">Район из вашего плана</div>}
                <div><h4><span className={`pm-n ${prio ? 'prio' : ''}`}>{n}</span>{d.t}</h4><p className="tg">{d.tag}</p></div>
                <dl><dt>Что там</dt><dd>{d.what}</dd><dt className="dp">Плюсы</dt><dd>{d.pro}</dd><dt className="dm">Минусы</dt><dd>{d.con}</dd><dt>Кому</dt><dd>{d.who}</dd></dl>
                <div className="gstats">
                  <div><b>{st.n}</b><span>отелей</span></div>
                  <div><b>{st.med ? fmt(st.med) + ' ₽' : '—'}</b><span>медиана за ночь</span></div>
                  <div><b className={cleanCls(st.clean)}>{st.clean == null ? '—' : st.clean + '%'}</b><span>чистых</span></div>
                  {st.gems > 0 && <div><b>{st.gems}</b><span>{plural(st.gems, 'находка', 'находки', 'находок')}</span></div>}
                </div>
                {st.n > 0 && <button className="gbtn" type="button" onClick={() => onShowZone(d.t)}>Показать отели района</button>}
              </article>
            )
          })}
        </div>
        <PlacesMap items={items} anchor={anchor} hover={hover} onPick={scrollToCard} onHover={setHover} />
      </div>
    </>
  )
}

const STATUS: Record<string, string> = { 'подтверждено': 's-ok', 'ожидается': 's-exp', 'ориентировочно': 's-exp', 'каждую неделю': 's-week', 'каждый день': 's-week', 'праздник': 's-ok', 'совет': 's-week', 'скорее всего позже': 's-late', 'после отъезда': 's-late' }

export function ListPane({ kind, stop, guide, index }: { kind: 'sights' | 'trips' | 'events'; stop: Stop; guide: Guide; index: TripIndex }) {
  const sights = useMemo(() => [...guide.sights].sort((a, b) => +stop.prio.includes(b[1]) - +stop.prio.includes(a[1])), [guide, stop])
  // Места на карте: номер точки = номер карточки; у мест без координат (например, «День Конституции») номера нет
  const places = index.places?.[stop.city]?.[kind]
  const nums = useMemo(() => {
    const names = kind === 'sights' ? sights.map((s) => s[0]) : kind === 'trips' ? guide.trips.map((t) => t[0]) : stop.events.map((e) => e[1])
    const m: Record<string, number> = {}; let n = 0
    for (const nm of names) if (places?.[nm] && !(nm in m)) m[nm] = ++n
    return m
  }, [kind, sights, guide, stop, places])
  const items = useMemo<PlaceItem[]>(() => Object.entries(nums).map(([nm, n]) => ({
    id: nm, n, name: nm, ll: places![nm], prio: kind === 'sights' && stop.prio.includes(sights.find((s) => s[0] === nm)?.[1] ?? ''),
  })), [nums, places, kind, stop, sights])
  const anchor = useMemo(() => anchorOf(stop), [stop])
  const [hover, setHover] = useState<string | null>(null)
  const on = (id: string) => ({ 'data-place': id, onMouseEnter: () => setHover(id), onMouseLeave: () => setHover(null) })
  const num = (id: string, prio = false) => nums[id] ? <span className={`pm-n ${prio ? 'prio' : ''}`}>{nums[id]}</span> : null

  let body
  if (kind === 'sights') {
    body = (
      <>
        <p className="intro">Сначала — места в вашем районе.</p>
        <div className="list">{sights.map(([n, z, t]) => (
          <div key={n} {...on(n)} className={`item ${stop.prio.includes(z) ? 'hl' : ''} ${hover === n ? 'pm-on' : ''}`}>
            <div className="k">{num(n, stop.prio.includes(z))}{n}<small>{z}</small></div><p>{t}</p>
          </div>
        ))}</div>
      </>
    )
  } else if (kind === 'trips') {
    body = (
      <>
        <p className="intro">Время в одну сторону на машине или такси от центра.</p>
        <div className="list">{guide.trips.map(([n, time, t, tip]) => (
          <div key={n} {...on(n)} className={`item ${hover === n ? 'pm-on' : ''}`}>
            <div className="k">{num(n)}{n}<small>{time}</small></div><div><p>{t}</p><div className="tipline">{tip}</div></div>
          </div>
        ))}</div>
      </>
    )
  } else {
    body = (
      <>
        <div className="list">
          {stop.events.map(([date, title, place, st, note]) => (
            <div key={title} {...on(title)} className={`item ev ${hover === title ? 'pm-on' : ''}`}>
              <div><div className="date">{num(title)}{date}</div><span className={`status ${STATUS[st] || 's-week'}`}>{st}</span></div>
              <div><p><b>{title}</b>, {place}</p><div className="tipline">{note}</div></div>
            </div>
          ))}
        </div>
        <div className="wide"><h3>Крупные события рядом с маршрутом</h3>
          <div className="list">{index.tripwide.map(([d, t, p, s]) => <div key={t} className="item ev"><div className="date">{d}</div><p><b>{t}</b>, {p}. <span className="sub2">{s}</span></p></div>)}</div>
        </div>
      </>
    )
  }
  return (
    <div className="pwrap">
      <div className="plist">{body}</div>
      <PlacesMap items={items} anchor={anchor} hover={hover} onPick={scrollToCard} onHover={setHover} />
    </div>
  )
}
