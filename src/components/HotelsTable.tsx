import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Row, Stop } from '../lib/types'
import { ASC_FIRST, type Filters, type SortKey } from '../lib/filters'
import { plural } from '../lib/format'
import { HotelCells } from './HotelCells'
import { useMarks } from '../hooks/useMarks'
import { headWidths, loadPins, pinCss, pinStyle, savePins } from '../lib/pins'

const COLS: [SortKey, string, string][] = [
  ['mark', '±', ''], ['rank', '#', ''], ['name', 'Отель', ''], ['my', 'Моя оценка', 'из 10'],
  ['night', 'Цена за ночь', ''], ['free', 'Отмена', ''], ['km', 'До «нашего» отеля', 'по прямой'],
  ['brief', 'Коротко об отеле', 'чем известен, осторожно, где'], ['pr', 'Хвалят', ''], ['co', 'Жалуются', ''],
  ['flag', 'Красные флаги', 'отзывов с упоминанием'], ['sc', 'Trip.com', 'оценка, отзывов'], ['tcm', 'Отметки Trip.com', 'значки, рейтинги, акции'],
  ['cl', 'Чистота', ''], ['fa', 'Удобства', 'оценка гостей'], ['lo', 'Расположение', ''], ['se', 'Сервис', ''],
  ['amn', 'Что есть в отеле', ''], ['st', 'Тип', 'и звёзды'], ['yr', 'Открыт', 'год'], ['ry', 'Ремонт', 'год последнего'], ['ng', 'Негатив', 'оценки 6 и ниже'], ['ns', 'Шум', 'доля отзывов'],
]

interface Props {
  list: Row[]; stop: Stop; filters: Filters; selected: number | null
  onSort: (k: SortKey, dir: 1 | -1) => void; onSelect: (id: number) => void
}

export function HotelsTable({ list, stop, filters, selected, onSort, onSelect }: Props) {
  const store = useMarks()
  const box = useRef<HTMLDivElement>(null)
  const table = useRef<HTMLTableElement>(null)
  const [headH, setHeadH] = useState(52)
  // Закреплённые столбцы: булавка в заголовке, положение считаем по реальным ширинам (lib/pins.ts).
  const [pins, setPins] = useState<string[]>(loadPins)
  const [ps] = useState(pinStyle)
  const pinsRef = useRef(pins)
  pinsRef.current = pins

  // Виртуальный скролл: рендерим только видимые строки (как в Vue-версии, но через хук).
  const virt = useVirtualizer({
    count: list.length,
    getScrollElement: () => box.current,
    estimateSize: () => 190,
    overscan: 6,
    paddingStart: headH,
    getItemKey: (i) => list[i]?.id ?? i,
  })
  const items = virt.getVirtualItems()
  const padTop = items.length ? items[0].start - headH : 0
  const padBottom = items.length ? virt.getTotalSize() - items[items.length - 1].end : 0

  const measure = useRef(() => {})
  measure.current = () => {
    const t = table.current
    if (!t) return
    ps.set(pinCss(ps.scope, headWidths(t), COLS.map(([k]) => pinsRef.current.includes(k))))
    setHeadH(Math.round(t.querySelector('thead')?.getBoundingClientRect().height ?? 52))
  }
  useLayoutEffect(() => {
    const t = table.current
    if (!t) return
    const ro = new ResizeObserver(() => measure.current())
    ro.observe(t)
    measure.current()
    return () => { ro.disconnect(); ps.destroy() }
  }, [ps])
  useLayoutEffect(() => { measure.current() }, [pins])
  const togglePin = (k: string) => {
    const next = pins.includes(k) ? pins.filter((x) => x !== k) : [...pins, k]
    savePins(next)
    setPins(next)
  }

  useEffect(() => {
    if (selected == null) return
    const i = list.findIndex((r) => r.id === selected)
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
          {padTop > 0 && <tr className="spacer"><td colSpan={23} style={{ height: padTop }} /></tr>}
          {items.map((it) => {
            const r = list[it.index]
            return (
              <tr key={it.key} ref={virt.measureElement} data-index={it.index} className={rowClass(r)} onClick={() => onSelect(r.id)}>
                <HotelCells r={r} stop={stop} />
              </tr>
            )
          })}
          {padBottom > 0 && <tr className="spacer"><td colSpan={23} style={{ height: padBottom }} /></tr>}
          {!list.length && <tr className="emptyrow"><td colSpan={23} className="empty">Под эти фильтры ничего не подходит. Снимите один из фильтров или нажмите «Весь город».</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
