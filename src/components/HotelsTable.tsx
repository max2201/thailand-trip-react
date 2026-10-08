import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Row, Stop } from '../lib/types'
import { ASC_FIRST, type Filters, type SortKey } from '../lib/filters'
import { plural } from '../lib/format'
import { HotelCells } from './HotelCells'
import { useMarks } from '../hooks/useMarks'
import { headWidths, loadPins, loadRowPins, pinCss, pinStyle, rowTops, saveRowPins, savePins } from '../lib/pins'

const COLS: [SortKey, string, string][] = [
  ['mark', '±', ''], ['rank', '#', ''], ['name', 'Отель', ''], ['my', 'Моя оценка', 'из 10'],
  ['night', 'Цена за ночь', ''], ['free', 'Отмена', ''], ['km', 'До «нашего» отеля', 'по прямой'],
  ['brief', 'Коротко об отеле', 'чем известен, осторожно, где'], ['pr', 'Хвалят', ''], ['co', 'Жалуются', ''],
  ['flag', 'Красные флаги', 'отзывов с упоминанием'], ['sc', 'Trip.com', 'оценка, отзывов'], ['tcm', 'Отметки Trip.com', 'значки, рейтинги, акции'],
  ['cl', 'Чистота', ''], ['fa', 'Удобства', 'оценка гостей'], ['lo', 'Расположение', ''], ['se', 'Сервис', ''],
  ['amn', 'Что есть в отеле', ''], ['st', 'Тип', 'и звёзды'], ['yr', 'Открыт', 'год'], ['ry', 'Ремонт', 'год последнего'], ['ng', 'Негатив', 'оценки 6 и ниже'], ['ns', 'Шум', 'доля отзывов'],
]

interface Props {
  list: Row[]; all: Row[]; stop: Stop; filters: Filters; selected: number | null
  onSort: (k: SortKey, dir: 1 | -1) => void; onSelect: (id: number) => void
}

export function HotelsTable({ list, all, stop, filters, selected, onSort, onSelect }: Props) {
  const store = useMarks()
  const box = useRef<HTMLDivElement>(null)
  const table = useRef<HTMLTableElement>(null)
  const [headH, setHeadH] = useState(52)
  // Закреплённые столбцы: булавка в заголовке, положение считаем по реальным ширинам (lib/pins.ts).
  const [pins, setPins] = useState<string[]>(loadPins)
  const [ps] = useState(pinStyle)
  const pinsRef = useRef(pins)
  pinsRef.current = pins

  // Закреплённые строки: всегда сверху под заголовком, при любых фильтрах; остальные — ниже, без них.
  const [rowPins, setRowPins] = useState<number[]>(() => loadRowPins(stop.id))
  useEffect(() => { setRowPins(loadRowPins(stop.id)) }, [stop.id])
  const pinnedRows = useMemo(() => { const by = new Map(all.map((r) => [r.id, r])); return rowPins.map((id) => by.get(id)).filter((r): r is Row => !!r) }, [all, rowPins])
  const body = useMemo(() => { const p = new Set(rowPins); return p.size ? list.filter((r) => !p.has(r.id)) : list }, [list, rowPins])
  const [pinTops, setPinTops] = useState<number[]>([])
  const [pinH, setPinH] = useState(0)
  const toggleRow = (id: number) => {
    const next = rowPins.includes(id) ? rowPins.filter((x) => x !== id) : [...rowPins, id]
    saveRowPins(stop.id, next)
    setRowPins(next)
  }

  // Виртуальный скролл: рендерим только видимые строки (как в Vue-версии, но через хук).
  const virt = useVirtualizer({
    count: body.length,
    getScrollElement: () => box.current,
    estimateSize: () => 190,
    overscan: 6,
    paddingStart: headH + pinH,
    getItemKey: (i) => body[i]?.id ?? i,
  })
  const items = virt.getVirtualItems()
  const padTop = items.length ? items[0].start - headH - pinH : 0
  const padBottom = items.length ? virt.getTotalSize() - items[items.length - 1].end : 0

  const measure = useRef(() => {})
  measure.current = () => {
    const t = table.current
    if (!t) return
    ps.set(pinCss(ps.scope, headWidths(t), COLS.map(([k]) => pinsRef.current.includes(k))))
    const hh = Math.round(t.querySelector('thead')?.getBoundingClientRect().height ?? 52)
    setHeadH(hh)
    const { tops, total } = rowTops(hh, Array.from(t.querySelectorAll<HTMLElement>('tbody tr.pinrow')).map((tr) => tr.getBoundingClientRect().height))
    setPinTops((prev) => (prev.join() === tops.join() ? prev : tops))
    setPinH(total)
  }
  useLayoutEffect(() => {
    const t = table.current
    if (!t) return
    const ro = new ResizeObserver(() => measure.current())
    ro.observe(t)
    measure.current()
    return () => { ro.disconnect(); ps.destroy() }
  }, [ps])
  useLayoutEffect(() => { measure.current() }, [pins, rowPins])
  const togglePin = (k: string) => {
    const next = pins.includes(k) ? pins.filter((x) => x !== k) : [...pins, k]
    savePins(next)
    setPins(next)
  }

  useEffect(() => {
    if (selected == null) return
    const i = body.findIndex((r) => r.id === selected)
    if (i >= 0) virt.scrollToIndex(i, { align: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])
  // Наверх — только когда меняются фильтры или сортировка (объект filters новый при каждом изменении).
  // Отметки сюда не попадают: даже если «Скрыть с минусом» убрал строку, таблица остаётся на месте.
  useEffect(() => { box.current?.scrollTo({ top: 0 }) }, [filters])

  const sortBy = (k: SortKey) => {
    if (filters.sort === k) onSort(k, filters.dir === 1 ? -1 : 1)
    else onSort(k, ASC_FIRST.includes(k) ? 1 : -1)
  }
  const rowClass = (r: Row) => {
    const m = store.mine(stop.id, r.id)
    return [r.anchor ? 'anchorrow' : '', r.proposed ? 'mark' : '', m === 1 ? 'plus' : m === -1 ? 'minus' : '', selected === r.id ? 'sel' : ''].join(' ')
  }
  const nightsLabel = `за ${stop.nights} ${plural(stop.nights, 'ночь', 'ночи', 'ночей')} ниже`

  return (
    <div ref={box} className="tablebox vtable" data-pt={ps.id}>
      <table ref={table}>
        <thead>
          <tr>
            {COLS.map(([k, t, s], i) => (
              <th key={k} className={['mkc', 'rank', 'name'][i] ?? ''}
                aria-sort={filters.sort === k ? (filters.dir > 0 ? 'ascending' : 'descending') : undefined}>
                <button type="button" onClick={() => sortBy(k)}>
                  <span>{t}{(s || k === 'night') && <small>{k === 'night' ? nightsLabel : s}</small>}</span><span className="arr">↕</span>
                </button>
                <button type="button" className="pinb" aria-pressed={pins.includes(k)} onClick={() => togglePin(k)}
                  title={pins.includes(k) ? 'Открепить столбец' : 'Закрепить столбец: останется на виду при прокрутке вбок'}
                  aria-label={`${pins.includes(k) ? 'Открепить' : 'Закрепить'} столбец «${t}»`}>
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 1.5h4l-.6 4.2 2.6 2.3v1.3H8.7V15L8 15.8 7.3 15V9.3H4V8l2.6-2.3z" /></svg>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pinnedRows.map((r, i) => (
            <tr key={'p' + r.id} className={`${rowClass(r)} pinrow${i === pinnedRows.length - 1 ? ' plast' : ''}`}
              style={{ '--pt': (pinTops[i] ?? headH) + 'px' } as CSSProperties} onClick={() => onSelect(r.id)}>
              <HotelCells r={r} stop={stop} rowPinned onPin={() => toggleRow(r.id)} />
            </tr>
          ))}
          {padTop > 0 && <tr className="spacer"><td colSpan={23} style={{ height: padTop }} /></tr>}
          {items.map((it) => {
            const r = body[it.index]
            return (
              <tr key={it.key} ref={virt.measureElement} data-index={it.index} className={rowClass(r)} onClick={() => onSelect(r.id)}>
                <HotelCells r={r} stop={stop} rowPinned={false} onPin={() => toggleRow(r.id)} />
              </tr>
            )
          })}
          {padBottom > 0 && <tr className="spacer"><td colSpan={23} style={{ height: padBottom }} /></tr>}
          {!body.length && <tr className="emptyrow"><td colSpan={23} className="empty">Под эти фильтры ничего не подходит. Снимите один из фильтров или нажмите «Весь город».</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
