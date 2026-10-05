import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTrip } from '../store/trip'
import { useMarks } from '../hooks/useMarks'
import { DOW, fmt, plural } from '../lib/format'

export function AppHeader() {
  const index = useTrip((s) => s.index)
  const toggleTheme = () => {
    const root = document.documentElement
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme:dark)').matches
    root.dataset.theme = dark ? 'light' : 'dark'
    try { localStorage.setItem('theme', root.dataset.theme) } catch { /* ignore */ }
  }
  return (
    <div className="top">
      <div>
        <h1>Таиланд, 6–26 декабря</h1>
        <p className="lede">Маршрут из вашего плана: 7 остановок, 20 ночей. Для каждой — все отели города до 5&nbsp;000&nbsp;₽ за ночь на ваши даты (в Чиангмае — до 7&nbsp;000&nbsp;₽), разбор отзывов, районы, что посмотреть, куда съездить за 2 часа и что будет происходить в эти дни.{index && <> Всего прочитано <b>{fmt(index.reviews)} отзывов</b>.</>}</p>
      </div>
      <div className="top-right"><span className="fw-badge react">React 19</span><button className="theme" type="button" onClick={toggleTheme}>Тема</button></div>
    </div>
  )
}

const START = new Date('2026-12-06T00:00:00')
const dayIdx = (d: string) => Math.round((+new Date(d + 'T00:00:00') - +START) / 864e5)
const DAYS = Array.from({ length: 20 }, (_, i) => { const dt = new Date(+START + i * 864e5); return { d: dt.getDate(), w: dt.getDay(), i } })

export function RouteRibbon() {
  const stops = useTrip((s) => s.index?.stops ?? [])
  const store = useMarks()
  const { stop: active, tab = 'hotels' } = useParams()
  const nav = useRef<HTMLElement>(null)
  // На узком экране лента прокручивается — показываем активную остановку.
  useEffect(() => {
    nav.current?.querySelector<HTMLElement>('.seg[aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [active])
  return (
    <nav ref={nav} className="route" aria-label="Маршрут">
      <div className="ribbon">
        {DAYS.map((d) => <div key={d.i} className={`day ${d.w === 0 || d.w === 6 ? 'we' : ''}`} style={{ gridColumn: d.i + 1, gridRow: 1 }}><b>{d.d}</b>{DOW[d.w]}</div>)}
        {stops.map((s) => {
          const plus = store.counts(s.id).p
          return (
            <Link key={s.id} to={`/${s.id}/${tab}`} className={`seg c-${s.city} ${s.nights < 2 ? 'narrow' : ''}`} style={{ gridColumn: `${dayIdx(s.ci) + 1}/${dayIdx(s.co) + 1}` }}
              aria-pressed={active === s.id} title={`${s.title}: ${s.sub}, ${s.days}`}>
              <strong lang="ru">{s.title}</strong>
              <small>{s.nights >= 2 && <>{s.sub}<br /></>}{s.nights} {plural(s.nights, 'ночь', 'ночи', 'ночей')}</small>
              {plus > 0 && <span className="mk">+{plus}</span>}
            </Link>
          )
        })}
      </div>
      <div className="legend-route"><span><i className="c-bkk" />Бангкок</span><span><i className="c-cm" />Чиангмай</span><span><i className="c-cr" />Чианграй</span><span><i className="c-pt" />Ко Лан и Паттайя</span><span>Розовые числа — выходные</span></div>
    </nav>
  )
}

export function NameBar({ onWho }: { onWho: () => void }) {
  const store = useMarks()
  if (store.mode === 'connecting') return null
  if (store.mode === 'error') return <div className="namebar err">Нет связи с общей базой отметок ({store.error}). Отметки сохраняются только в этом браузере. Если вы в России, попробуйте открыть сайт через VPN.</div>
  if (store.needName) return <div className="namebar ask"><b>Представьтесь, чтобы отмечать отели вместе с ребятами.</b> Имя увидят остальные рядом с вашими «+/−». <button className="who-ok" type="button" onClick={onWho}>Представиться</button></div>
  return <div className="namebar ok">Вы отмечаете как <b>{store.myName}</b>: ваши «+/−» видят все, у кого есть ссылка. <button className="link" type="button" onClick={onWho}>Сменить имя</button></div>
}

export function WhoDialog({ onClose }: { onClose: () => void }) {
  const store = useMarks()
  const [had] = useState(() => !!store.myName)
  const [name, setName] = useState(store.myName || '')
  const input = useRef<HTMLInputElement>(null)
  const known = store.knownNames()
  const done = (v: string) => { v = v.trim(); if (!v) { input.current?.focus(); return } store.setName(v); onClose() }
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    const t = setTimeout(() => input.current?.focus(), 30)
    return () => { document.removeEventListener('keydown', esc); clearTimeout(t) }
  }, [onClose])
  return (
    <div className="who-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="who-dialog" role="dialog" aria-modal="true" aria-labelledby="whotitle">
        <h2 id="whotitle">Кто вы?</h2>
        <p>Имя подпишет ваши отметки «+/−», его увидят остальные. Запомнится в этом браузере.</p>
        {known.length > 0 && <div className="who-known"><span>Уже отмечали:</span>{known.map((n) => <button key={n} type="button" className="who-pick" onClick={() => done(n)}>Я — {n}</button>)}</div>}
        <label className="who-field"><span>Ваше имя</span>
          <input ref={input} value={name} maxLength={30} autoComplete="given-name" placeholder="Например, Максим" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') done(name) }} />
        </label>
        <div className="who-actions"><button className="who-ok" type="button" onClick={() => done(name)}>Готово</button><button className="link" type="button" onClick={onClose}>{had ? 'Отмена' : 'Пока без имени'}</button></div>
        {!had && <p className="who-note">Без имени отметки сохраняются только в этом браузере, и никто их не видит.</p>}
      </div>
    </div>
  )
}

export function MethodNotes() {
  return (
    <>
      <div className="method">
        <section><h3>Как считается моя оценка</h3><ul>
          <li><b>Основа</b> — оценка гостей trip.com, подтянутая к средней по городу, если отзывов мало.</li>
          <li><b>Насекомые, запах, сырость</b> — штраф до −2. Тараканы и клопы весят втрое больше муравьёв и комаров.</li>
          <li><b>Близость к «нашему» отелю остановки</b> — от +0,4 рядом до −0,5 далеко.</li>
          <li><b>Цена</b> относительно медианы этой остановки — до ±0,4.</li>
          <li><b>Доля негативных отзывов и свежая динамика</b>.</li></ul></section>
        <section><h3>Как читались отзывы</h3><p>Все отзывы на trip.com, включая переведённые с других языков. Для отелей, у которых их больше тысячи, — 1000 самых свежих. Плюсы, минусы и «Коротко об отеле» собраны автоматически: что здесь хвалят и на что жалуются заметно чаще, чем в среднем по городу.</p></section>
        <section><h3>Что учесть</h3><ul>
          <li>Цены сняты 2 октября 2026 для каждой остановки на её даты, для самого дешёвого номера.</li>
          <li>Отели из вашего плана показаны всегда, даже если дороже лимита остановки.</li>
          <li>Отметки «+/−» общие для всех, у кого есть ссылка. Сайт работает и без интернета: данные сохраняются на устройстве.</li>
          <li>События со статусом «ожидается» — ежегодные, но даты 2026 года ещё не объявлены.</li></ul></section>
      </div>
      <footer>Данные: trip.com, OpenStreetMap и открытые источники, 2 октября 2026.</footer>
    </>
  )
}
