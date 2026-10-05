import type { Guide, Stop, StopRows, TripIndex } from '../lib/types'
import { cityCleanShare, zoneStats } from '../lib/rows'
import { fmt, plural } from '../lib/format'

export function DistrictsPane({ stop, data, guide, onShowZone }: { stop: Stop; data: StopRows; guide: Guide; onShowZone: (z: string) => void }) {
  const cc = cityCleanShare(data.rows)
  const cards = [...guide.districts].sort((a, b) => +stop.prio.includes(b.t) - +stop.prio.includes(a.t))
  const cleanCls = (v: number | null) => (v == null ? '' : v >= cc + 8 ? 't-g' : v <= cc - 8 ? 't-b' : '')
  return (
    <>
      <p className="intro">{guide.intro} «Чистые» — отели без единого упоминания насекомых, запаха и сырости; в среднем по городу на эти даты таких {cc}%.</p>
      <div className="gcards">
        {cards.map((d) => {
          const st = zoneStats(data.rows, [d.t])
          const prio = stop.prio.includes(d.t)
          return (
            <article key={d.t} className={`gcard ${prio ? 'prio' : ''}`}>
              {prio && <div className="yours">Район из вашего плана</div>}
              <div><h4>{d.t}</h4><p className="tg">{d.tag}</p></div>
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
    </>
  )
}

const STATUS: Record<string, string> = { 'подтверждено': 's-ok', 'ожидается': 's-exp', 'ориентировочно': 's-exp', 'каждую неделю': 's-week', 'каждый день': 's-week', 'праздник': 's-ok', 'совет': 's-week', 'скорее всего позже': 's-late', 'после отъезда': 's-late' }

export function ListPane({ kind, stop, guide, index }: { kind: 'sights' | 'trips' | 'events'; stop: Stop; guide: Guide; index: TripIndex }) {
  if (kind === 'sights') {
    const sights = [...guide.sights].sort((a, b) => +stop.prio.includes(b[1]) - +stop.prio.includes(a[1]))
    return (
      <>
        <p className="intro">Сначала — места в вашем районе.</p>
        <div className="list">{sights.map(([n, z, t]) => <div key={n} className={`item ${stop.prio.includes(z) ? 'hl' : ''}`}><div className="k">{n}<small>{z}</small></div><p>{t}</p></div>)}</div>
      </>
    )
  }
  if (kind === 'trips') {
    return (
      <>
        <p className="intro">Время в одну сторону на машине или такси от центра.</p>
        <div className="list">{guide.trips.map(([n, time, t, tip]) => <div key={n} className="item"><div className="k">{n}<small>{time}</small></div><div><p>{t}</p><div className="tipline">{tip}</div></div></div>)}</div>
      </>
    )
  }
  return (
    <>
      <div className="list">
        {stop.events.map(([date, title, place, st, note]) => (
          <div key={title} className="item ev">
            <div><div className="date">{date}</div><span className={`status ${STATUS[st] || 's-week'}`}>{st}</span></div>
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
