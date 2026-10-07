import { useEffect, useMemo, useRef, useState } from 'react'
import type { Row, Stop } from '../lib/types'
import { DUTY_TEXT, errorText, isOpen, onDuty, statusText, whenText, type ReportDoc } from '../lib/reports'
import { plural } from '../lib/format'
import { useReports } from '../hooks/useReports'
import { useMarks } from '../hooks/useMarks'
import { ReportView } from './ReportView'

const MAX = 15

/** Окно отчётов: заказать новый по своим плюсам, следить за готовностью, читать готовые. */
export function ReportDialog({ stop, rows, openId, onClose }: { stop: Stop; rows: Row[]; openId?: string | null; onClose: () => void }) {
  const reports = useReports(stop.id)
  const store = useMarks()

  // Мои плюсы на этой остановке + «наш» отель для сравнения (по умолчанию не выбран, если он не в плюсах).
  const plus = rows.filter((r) => store.mine(stop.id, r.id) === 1)
  const anchor = rows.find((r) => r.anchor)
  const choices = anchor && !plus.some((r) => r.id === anchor.id) ? [...plus, anchor] : plus
  const [off, setOff] = useState<Set<number>>(() => new Set(rows.filter((r) => r.anchor && store.mine(stop.id, r.id) !== 1).map((r) => r.id)))
  const picked = choices.filter((r) => !off.has(r.id)).map((r) => r.id)
  const toggle = (id: number) => setOff((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const docs = reports.docs
  const same = store.myName ? reports.findSame(picked, store.myName) : null
  const [current, setCurrent] = useState<string | null>(openId ?? null)
  const doc = docs.find((d) => d.id === current) ?? null
  const report = doc ? reports.report(doc) : null
  const nameOf = useMemo(() => new Map(rows.map((r) => [r.id, r.nm])), [rows])
  const names = (d: ReportDoc) => d.hotels.map((id) => nameOf.get(id) ?? `#${id}`)

  const [name, setName] = useState('')
  const [sending, setSending] = useState(false)
  const [sendErr, setSendErr] = useState('')
  const canSend = store.mode === 'shared' && !store.needName && picked.length > 0 && picked.length <= MAX && !sending
  const send = async () => {
    if (!canSend || !store.myName) return
    setSending(true); setSendErr('')
    try { setCurrent(await reports.request(stop.id, picked, store.myName)) }
    catch (e) { setSendErr(errorText((e as { code?: string }).code || String(e))) }
    finally { setSending(false) }
  }
  const cancel = async (d: ReportDoc) => {
    try { await reports.cancel(d.id); if (current === d.id) setCurrent(null) }
    catch (e) { setSendErr(errorText((e as { code?: string }).code || String(e))) }
  }
  const saveName = () => { if (name.trim()) store.setName(name) }

  // Esc: из отчёта — к списку, из списка — закрыть окно. Последние значения держим в ref, чтобы подписаться один раз.
  const live = useRef({ current, onClose })
  live.current = { current, onClose }
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; if (live.current.current) setCurrent(null); else live.current.onClose() }
    document.addEventListener('keydown', esc)
    document.body.classList.add('modal-open')
    return () => { document.removeEventListener('keydown', esc); document.body.classList.remove('modal-open') }
  }, [])

  return (
    <div className="who-overlay rp-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rp-dialog" role="dialog" aria-modal="true" aria-labelledby="rptitle">
        <header className="rp-top">
          {current && <button type="button" className="link rp-back" onClick={() => setCurrent(null)}>← все отчёты</button>}
          <h2 id="rptitle">{report ? `Отчёт: ${report.title}` : `Подробные отчёты · ${stop.title}`}</h2>
          <button type="button" className="rp-x" aria-label="Закрыть" onClick={onClose}>×</button>
        </header>

        <div className="rp-body">
          {report ? <ReportView report={report} /> : doc ? (
            <div className="rp-wait">
              <p className={'rp-status ' + doc.status}><b>Отчёт {statusText(doc.status)}</b>{doc.prog && <> — {doc.prog}</>}</p>
              {doc.status === 'error' && <p className="rp-err">{doc.err || 'Что-то пошло не так.'}</p>}
              {doc.status === 'queued' && (onDuty()
                ? <p className="rp-note">Заявку возьмут в работу в течение минуты.</p>
                : <p className="rp-note">Сейчас ночь: заявку возьмут в работу после 8:00 по времени Таиланда.</p>)}
              <p className="rp-note">{names(doc).join(', ')}</p>
              <p className="rp-note">{DUTY_TEXT}</p>
              {doc.status === 'queued' && doc.name === store.myName && <button type="button" className="link" onClick={() => cancel(doc)}>отменить заявку</button>}
            </div>
          ) : (
            <>
              <section className="rp-new">
                <h3>Новый отчёт по моим плюсам</h3>
                <p className="rp-note">Claude прочитает <b>все</b> отзывы этих отелей на trip.com и их карточки и разложит, что говорят люди, по темам с цитатами. Он сравнит удобства, завтраки, бассейны, спортзалы и номера, отметит фишки и риски и напишет общий вывод.</p>
                {store.needName && (
                  <div className="rp-name">
                    <span>Чтобы заказать отчёт, представьтесь:</span>
                    <input value={name} maxLength={30} placeholder="Ваше имя" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveName() }} />
                    <button type="button" className="who-ok" onClick={saveName}>Готово</button>
                  </div>
                )}
                {!choices.length
                  ? <p className="rp-empty">На этой остановке у вас пока нет отелей с плюсом. Отметьте понравившиеся «+» в таблице — и возвращайтесь.</p>
                  : (
                    <ul className="rp-pick">
                      {choices.map((r) => (
                        <li key={r.id}>
                          <label><input type="checkbox" checked={!off.has(r.id)} onChange={() => toggle(r.id)} />
                            <span>{r.nm}</span><small>{[r.anchor ? '«наш» отель' : '', store.mine(stop.id, r.id) === 1 ? 'ваш плюс' : ''].filter(Boolean).join(', ')}{r.rv ? <> · {r.rv} отз.</> : null}</small></label>
                        </li>
                      ))}
                    </ul>
                  )}
                {picked.length > MAX && <p className="rp-err">Не больше {MAX} отелей в одном отчёте.</p>}
                {same && isOpen(same) ? (
                  <div className="rp-same">По этим отелям отчёт уже {statusText(same.status)}. <button type="button" className="link" onClick={() => setCurrent(same.id)}>Посмотреть</button></div>
                ) : (
                  <div className="rp-actions">
                    <button type="button" className="who-ok" disabled={!canSend} onClick={send}>
                      {sending ? 'Отправляю…' : `Заказать отчёт · ${picked.length} ${plural(picked.length, 'отель', 'отеля', 'отелей')}`}
                    </button>
                    {same && <span className="rp-note">Отчёт по этим отелям уже есть — от {whenText(same.t)}. <button type="button" className="link" onClick={() => setCurrent(same.id)}>Открыть</button></span>}
                  </div>
                )}
                {sendErr && <p className="rp-err">{sendErr}</p>}
                {store.mode === 'error' && <p className="rp-err">{errorText(store.error)}</p>}
                <p className="rp-note small">{DUTY_TEXT}</p>
              </section>

              <section className="rp-list">
                <h3>Отчёты по этой остановке</h3>
                {reports.state === 'loading' ? <p className="rp-note">Загружаю…</p>
                  : reports.state === 'error' ? <p className="rp-err">{errorText(reports.error)}</p>
                  : !docs.length ? <p className="rp-note">Пока ни одного.</p>
                  : (
                    <ul>
                      {docs.map((d) => (
                        <li key={d.id}>
                          <button type="button" className="rp-item" onClick={() => setCurrent(d.id)}>
                            <span className="rp-when">{whenText(d.t)} · {d.name || 'кто-то'}</span>
                            <span className="rp-hs">{names(d).join(', ')}</span>
                            <span className={'rp-chip ' + d.status}>{statusText(d.status)}{isOpen(d) && d.prog ? ` · ${d.prog}` : ''}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
