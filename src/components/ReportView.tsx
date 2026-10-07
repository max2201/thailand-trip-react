import { useMemo, useState } from 'react'
import type { Report } from '../lib/reports'
import { catBar, monthText } from '../lib/reports'
import { dec, dec1, fmt, kmText } from '../lib/format'

const sign = (s: string) => (s === '+' ? 'хвалят' : s === '-' ? 'ругают' : 'по-разному')

/** Готовый отчёт: вкладка «Сравнение» и по вкладке на каждый отель. */
export function ReportView({ report }: { report: Report }) {
  const [tab, setTab] = useState<'sum' | number>('sum')
  const hotel = tab === 'sum' ? null : report.hotels.find((h) => h.id === tab) ?? null
  const made = useMemo(() => {
    const d = new Date(report.made)
    return isNaN(+d) ? '' : d.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })
  }, [report.made])
  const totalRead = report.hotels.reduce((s, h) => s + (h.analyzed || 0), 0)
  // Строки сравнения с заголовками групп
  const groups = useMemo(() => {
    const out: { group: string; rows: Report['compare'] }[] = []
    for (const r of report.compare) {
      const last = out[out.length - 1]
      if (last && last.group === r.group) last.rows.push(r)
      else out.push({ group: r.group, rows: [r] })
    }
    return out
  }, [report.compare])
  const open = (id: number) => { setTab(id); document.querySelector('.rp-body')?.scrollTo({ top: 0 }) }

  return (
    <div className="rp-report">
      <p className="rp-meta">Составлен {made} · прочитано {fmt(totalRead)} отзывов и карточки отелей на trip.com{report.by && <> · заказал {report.by}</>}</p>
      <div className="rp-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'sum'} onClick={() => setTab('sum')}>Сравнение</button>
        {report.hotels.map((h) => <button key={h.id} type="button" role="tab" aria-selected={tab === h.id} onClick={() => open(h.id)}>{h.name}</button>)}
      </div>

      {tab === 'sum' && (
        <section className="rp-sum">
          {report.summary.map((p, i) => <p key={i} className="rp-par">{p}</p>)}
          {report.picks.length > 0 && (
            <div className="rp-picks">{report.picks.map((p) => <div key={p.title} className="rp-pk"><b>{p.title}</b><span>{p.text}</span></div>)}</div>
          )}
          <div className="rp-cmpwrap">
            <table className="rp-cmp">
              <thead><tr><th />{report.cols.map((c) => <th key={c.id}><button type="button" className="link" onClick={() => open(c.id)}>{c.name}</button></th>)}</tr></thead>
              {groups.map((g) => (
                <tbody key={g.group}>
                  <tr className="rp-grp"><th colSpan={report.cols.length + 1}>{g.group}</th></tr>
                  {g.rows.map((r) => (
                    <tr key={r.label}>
                      <th scope="row">{r.label}</th>
                      {r.cells.map((c, i) => <td key={i} className={r.best?.includes(i) ? 'best' : undefined}>{c}</td>)}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </section>
      )}

      {hotel && (
        <section className="rp-hotel">
          <div className="rp-hhead">
            <h3>{hotel.name}{hotel.stars ? <small> {'★'.repeat(hotel.stars)}</small> : null}</h3>
            {hotel.url && <a href={hotel.url} target="_blank" rel="noopener">открыть на trip.com ↗</a>}
          </div>
          <p className="rp-facts">
            {hotel.score ? <span>оценка trip.com <b>{dec(hotel.score)}</b></span> : null}
            {hotel.recentAvg ? <span>за последний год <b>{dec(hotel.recentAvg)}</b> ({hotel.recentN} отз.)</span> : null}
            <span>прочитано <b>{fmt(hotel.analyzed)}</b> из {fmt(hotel.reviews)} отзывов{hotel.period && <>, {hotel.period}</>}</span>
            {hotel.low != null && <span>низких оценок (6 и ниже) {dec(hotel.low)} %</span>}
            {hotel.night ? <span><b>{fmt(hotel.night)} ₽</b> за ночь</span> : null}
            {hotel.anchor ? <span>это «наш» отель</span> : hotel.km != null ? <span>{kmText(hotel.km)} до «нашего»</span> : null}
            {hotel.open && <span>открыт в {hotel.open}{hotel.renov && <>, ремонт {hotel.renov}</>}</span>}
          </p>
          {hotel.sub && Object.keys(hotel.sub).length > 0 && (
            <p className="rp-subs">{Object.entries(hotel.sub).map(([k, v]) => <span key={k}>{k} <b>{dec(v)}</b></span>)}</p>
          )}
          <p className="rp-verdict">{hotel.verdict}</p>
          {(hotel.fit || hotel.unfit) && (
            <div className="rp-fit">
              {hotel.fit && <div><b>Подойдёт</b>{hotel.fit}</div>}
              {hotel.unfit && <div><b>Не подойдёт</b>{hotel.unfit}</div>}
            </div>
          )}
          <div className="rp-pc">
            <div><h4 className="good">Плюсы</h4><ul>{hotel.pros.map((x) => <li key={x}>{x}</li>)}</ul></div>
            <div><h4 className="bad">Минусы и риски</h4><ul>{hotel.cons.map((x) => <li key={x}>{x}</li>)}</ul></div>
          </div>

          <h4 className="rp-h">Что говорят гости — по темам</h4>
          <p className="rp-hint">Сколько отзывов упоминают тему и как: <i className="sw pos" />хвалят <i className="sw mix" />по-разному <i className="sw neg" />ругают. Нажмите на тему — подробности и цитаты.</p>
          <div className="rp-cats">
            {hotel.cats.map((c) => {
              const b = catBar(c)
              return (
                <details key={c.key} className="rp-cat">
                  <summary>
                    <span className="rp-ct">{c.title}</span>
                    <span className="rp-cn">{fmt(c.n)} отз. · {dec(c.share)} %</span>
                    <span className="rp-bar" title={`хвалят ${c.pos}, по-разному ${c.mix}, ругают ${c.neg}`}>
                      <i className="pos" style={{ width: b.pos + '%' }} /><i className="mix" style={{ width: b.mix + '%' }} /><i className="neg" style={{ width: b.neg + '%' }} />
                    </span>
                    <span className="rp-cy"><b className="good">+{c.pos}</b> <b className="bad">−{c.neg}</b>{c.rn ? <small> · за год +{c.rpos} −{c.rneg}</small> : null}</span>
                  </summary>
                  <div className="rp-cbody">
                    {c.good.length > 0 && <div><h5 className="good">Хвалят</h5><ul>{c.good.map((x) => <li key={x}>{x}</li>)}</ul></div>}
                    {c.bad.length > 0 && <div><h5 className="bad">Ругают</h5><ul>{c.bad.map((x) => <li key={x}>{x}</li>)}</ul></div>}
                    {c.quotes.map((q, i) => (
                      <blockquote key={i} className={'q' + (q.s === '+' ? 'p' : q.s === '-' ? 'n' : 'm')}>
                        «{q.t}»<small>{sign(q.s)}{q.r ? <> · оценка {dec(q.r)}/10</> : null}{q.d ? <> · {monthText(q.d)}</> : null}</small>
                      </blockquote>
                    ))}
                  </div>
                </details>
              )
            })}
          </div>

          <div className="rp-secs">
            {hotel.sections.map((s) => (
              <section key={s.title} className="rp-sec">
                <h4>{s.title}</h4>
                {s.text && <p>{s.text}</p>}
                {s.items?.length ? <ul>{s.items.map((x) => <li key={x}>{x}</li>)}</ul> : null}
              </section>
            ))}
          </div>
          <p className="rp-foot">Средняя оценка прочитанных отзывов {dec1(hotel.avg ?? null)}. Числа в скобках — сколько отзывов говорят об этом.</p>
        </section>
      )}
    </div>
  )
}
