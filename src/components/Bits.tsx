import type { Row, Stop, TcMarks } from '../lib/types'
import { dec1, fmt, scoreClass, subColor } from '../lib/format'
import { badges, brief, partsTitle } from '../lib/rows'
import { awardText, awardTitle, medalText, medalTitle, promoText, reviewText } from '../lib/tcmarks'

export function ScoreChip({ row }: { row: Row }) {
  return <span className={`my ${scoreClass(row.my)}`} title={partsTitle(row)}>{row.my == null ? 'нет' : dec1(row.my)}</span>
}

export function SubBar({ v }: { v: number | null }) {
  if (v == null) return <span className="sub2">—</span>
  return (
    <>
      <span className="num">{dec1(v)}</span>
      <span className="bar" style={{ color: subColor(v) }}><i style={{ width: Math.max(0, ((v - 6) / 4) * 100) + '%' }} /></span>
    </>
  )
}

export function BriefBlock({ row, stop }: { row: Row; stop: Stop }) {
  const b = brief(row, stop)
  return (
    <div className="brief">
      {b.known.length > 0 && <p><b className="bk-good">Чем известен:</b> {b.known.join('; ')}.</p>}
      {b.warn.length > 0 ? <p><b className="bk-bad">Осторожно:</b> {b.warn.join('; ')}.</p>
        : b.reputation === 'ok' ? <p><b className="bk-good">Репутация:</b> серьёзных проблем в отзывах не видно.</p>
        : <p><b className="bk-muted">Репутация:</b> отзывов мало, она ещё не сложилась.</p>}
      <p><b className="bk-muted">Где:</b> {b.where}. {b.anchorLine}</p>
    </div>
  )
}

export function FlagsBlock({ row }: { row: Row }) {
  if (!row.an) return <span className="sub2">отзывов нет</span>
  return (
    <>
      <div className="flags">
        <span className={row.insLvl}>Насекомые: {row.ins}{row.ins > 0 && <em> ({row.insr})</em>}</span>
        {row.ins > 0 && <small>тараканы, клопы {row.ro}; муравьи, комары {row.at}</small>}
        <span className={row.smLvl}>Запах: {row.sm}{row.sm > 0 && <em> ({row.smr})</em>}</span>
        <span className={row.dmLvl}>Сырость: {row.dm}{row.dm > 0 && <em> ({row.dmr})</em>}</span>
      </div>
      <div className="sub2" style={{ marginTop: 4 }}>из {fmt(row.an)} прочитанных{row.tot > row.an && <> (всего {fmt(row.tot)})</>}</div>
    </>
  )
}

export function Badges({ row, stop }: { row: Row; stop: Stop }) {
  const list = badges(row, stop)
  if (!list.length) return null
  return <div className="badges">{list.map((b) => <span key={b.text} className={'bg-' + b.cls} title={b.title}>{b.text}</span>)}</div>
}

/** Отметки самого trip.com: рейтинг, значок партнёра, «новый / после ремонта», реклама, акции, выводы из отзывов. */
export function TcMarksBlock({ tc, quiet }: { tc: TcMarks | null; quiet?: boolean }) {
  if (!tc) return quiet ? null : <span className="sub2">нет отметок</span>
  return (
    <div className="tcm">
      {(tc.a || tc.m || !!tc.n?.length || tc.ad) && (
        <div className="tcchips">
          {tc.a && <span className="tcc tc-award" title={awardTitle(tc.a)}>{awardText(tc.a)}</span>}
          {tc.m && <span className="tcc tc-partner" title={medalTitle(tc.m)}>{medalText(tc.m)}</span>}
          {(tc.n ?? []).map((n) => <span key={n} className="tcc tc-new">{n}</span>)}
          {tc.ad && <span className="tcc tc-ad" title="Отель оплатил место в выдаче trip.com">реклама</span>}
        </div>
      )}
      {(!!tc.p?.length || !!tc.d) && <div className="tcline"><b>Акция:</b> {promoText(tc)}</div>}
      {!!tc.r?.length && <div className="tcline"><b>В отзывах:</b> {reviewText(tc)}</div>}
    </div>
  )
}
