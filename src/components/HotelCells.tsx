import type { Row, Stop } from '../lib/types'
import { AMENITY, consList, tripLink } from '../lib/rows'
import { dec, dec1, fmt } from '../lib/format'
import { MarkButton } from './MarkButton'
import { hoverHotel } from '../lib/hover'
import { Badges, BriefBlock, FlagsBlock, ScoreChip, SubBar, TcMarksBlock } from './Bits'

/** Ячейки одной строки (фрагмент из 23 <td>); <tr> рисует родитель. */
export function HotelCells({ r, stop, rowPinned = false, onPin }: { r: Row; stop: Stop; rowPinned?: boolean; onPin?: () => void }) {
  return (
    <>
      <td className="mkc"><MarkButton stop={stop.id} id={r.id} /></td>
      <td className="rank">{r.rank}<button type="button" className="rpin" aria-pressed={rowPinned}
        title={rowPinned ? 'Открепить строку' : 'Закрепить строку: останется сверху таблицы при прокрутке и при любых фильтрах'}
        aria-label={`${rowPinned ? 'Открепить' : 'Закрепить'} строку «${r.nm}»`} onClick={(e) => { e.stopPropagation(); onPin?.() }}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 1.5h4l-.6 4.2 2.6 2.3v1.3H8.7V15L8 15.8 7.3 15V9.3H4V8l2.6-2.3z" /></svg></button></td>
      <td className="name" onMouseEnter={() => hoverHotel.set(r.id)} onMouseLeave={() => hoverHotel.set(null)}>
        <a href={tripLink(r.id, stop)} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>{r.nm}</a>
        <div className="meta">{r.z}{r.yr && <>, открыт в {r.yr}</>}</div>
        <Badges row={r} stop={stop} />
        <div className="meta">{r.room}</div>
        {r.anchor && <div className="meta">{stop.anchor === stop.proposed ? 'ваш отель по плану' : 'отель ребят по плану'} на {stop.days} — от него считаются расстояния</div>}
      </td>
      <td><ScoreChip row={r} /></td>
      <td className="num"><b>{r.night ? fmt(r.night) + ' ₽' : 'нет цены'}</b><div className="sub2">{r.total ? fmt(r.total) + ' ₽' : ''}</div></td>
      <td className={r.free ? 'free' : 'sub2'}>{r.free ? 'Бесплатная' : 'Платная'}</td>
      <td className="num">{r.anchor ? <b style={{ color: 'var(--accent)' }}>это он</b> : r.km == null ? '—' : dec(r.km.toFixed(2)) + ' км'}</td>
      <td><BriefBlock row={r} stop={stop} /></td>
      <td><ul className="pc pros">{r.pr.map((x) => <li key={x}>{x}</li>)}{!r.pr.length && <li className="sub2">мало данных</li>}</ul></td>
      <td><ul className="pc cons">{consList(r).map((x) => <li key={x}>{x}</li>)}</ul></td>
      <td><FlagsBlock row={r} /></td>
      <td className="num"><b>{dec1(r.sc)}</b><div className="sub2">{fmt(r.rv)} отзывов</div></td>
      <td><TcMarksBlock tc={r.tc} /></td>
      <td><SubBar v={r.cl} /></td>
      <td><SubBar v={r.fa} /></td>
      <td><SubBar v={r.lo} /></td>
      <td><SubBar v={r.se} /></td>
      <td>
        <div className="am">{r.am.map((a) => <span key={a}>{AMENITY[a]}</span>)}{!r.am.length && <span style={{ background: 'none', color: 'var(--muted)', padding: 0 }}>почти ничего</span>}</div>
        <div className="sub2" style={{ marginTop: 4 }}>всего {r.amn}</div>
      </td>
      <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
        {r.tg}{r.cat && r.cat !== 'Отель' && r.cat !== r.tg && <div className="sub2">{r.cat}</div>}
        <div style={{ color: 'var(--warn)' }}>{r.st ? '★'.repeat(r.st) : <span className="sub2">без звёзд</span>}</div>
      </td>
      <td className="num">{r.yr || '—'}</td>
      <td className="num">{r.ry || '—'}</td>
      <td className="num">{r.ng == null ? '—' : dec(r.ng) + '%'}</td>
      <td className="num">{r.ns == null ? '—' : dec(r.ns) + '%'}</td>
    </>
  )
}
