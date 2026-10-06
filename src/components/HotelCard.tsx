import type { Row, Stop } from '../lib/types'
import { AMENITY, consList, tripLink } from '../lib/rows'
import { dec, dec1, fmt } from '../lib/format'
import { MarkButton } from './MarkButton'
import { Badges, BriefBlock, FlagsBlock, ScoreChip } from './Bits'
import { useMarks } from '../hooks/useMarks'

export function HotelCard({ r, stop, selected }: { r: Row; stop: Stop; selected: boolean }) {
  const store = useMarks()
  const mark = store.mine(stop.id, r.id)
  const cls = ['hcard', r.anchor ? 'anchor' : '', mark === 1 ? 'plus' : mark === -1 ? 'minus' : '', selected ? 'sel' : ''].join(' ')
  return (
    <article id={'c' + r.id} className={cls}>
      <div className="hcard-top">
        <MarkButton stop={stop.id} id={r.id} />
        <div>
          <h3><a href={tripLink(r.id, stop)} target="_blank" rel="noopener">{r.nm}</a></h3>
          <div className="meta">#{r.rank}, {r.z}{r.yr && <>, открыт в {r.yr}</>}</div>
          <Badges row={r} stop={stop} />
        </div>
        <ScoreChip row={r} />
      </div>
      <div className="facts">
        <span><b>{r.night ? fmt(r.night) + ' ₽' : 'нет цены'}</b> за ночь</span>
        <span className={r.free ? 'free' : ''}>{r.free ? 'бесплатная отмена' : 'отмена платная'}</span>
        {!r.anchor && r.km != null && <span><b>{dec(r.km.toFixed(2))} км</b> до «нашего»</span>}
        <span>trip.com <b>{dec1(r.sc)}</b> ({fmt(r.rv)})</span>
      </div>
      <BriefBlock row={r} stop={stop} />
      <details>
        <summary>Подробнее: плюсы, минусы, флаги, удобства</summary>
        <div className="twocol">
          <ul className="pc pros">{r.pr.map((x) => <li key={x}>{x}</li>)}{!r.pr.length && <li className="sub2">мало данных</li>}</ul>
          <ul className="pc cons">{consList(r).map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
        <FlagsBlock row={r} />
        <div className="am" style={{ marginTop: 8, maxWidth: 'none' }}>{r.am.map((a) => <span key={a}>{AMENITY[a]}</span>)}</div>
        <div className="meta" style={{ marginTop: 6 }}>{r.room}</div>
      </details>
    </article>
  )
}
