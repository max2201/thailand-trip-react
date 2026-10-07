/**
 * Закреплённые столбцы таблицы отелей. Какие столбцы закреплены — помним в браузере (общие для всех остановок).
 * Закреплённый столбец «прилипает» и к левому, и к правому краю: левее и правее него встают
 * остальные закреплённые, так что при прокрутке вбок он всегда на виду и стоит на своём месте.
 * Положение задаём сгенерированным CSS (nth-child), поэтому ячейкам не нужны ни классы, ни инлайн-стили —
 * одинаково для Vue- и React-версии.
 */
const KEY = 'thai-trip-pins-v1'
export const DEFAULT_PINS = ['mark', 'rank', 'name']

export function loadPins(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return v
  } catch { /* приватный режим */ }
  return [...DEFAULT_PINS]
}
export function savePins(p: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* ignore */ }
}

/** CSS для закреплённых столбцов: scope — селектор контейнера таблицы, widths — ширины всех столбцов. */
export function pinCss(scope: string, widths: number[], pinned: boolean[]) {
  const left: number[] = [], right: number[] = []
  let l = 0
  for (let i = 0; i < widths.length; i++) if (pinned[i]) { left[i] = l; l += widths[i] }
  let r = 0
  for (let i = widths.length - 1; i >= 0; i--) if (pinned[i]) { right[i] = r; r += widths[i] }
  const out: string[] = []
  pinned.forEach((on, i) => {
    if (!on) return
    const n = i + 1
    const td = `${scope} tbody tr:not(.spacer):not(.emptyrow)>td:nth-child(${n})`
    const th = `${scope} thead th:nth-child(${n})`
    out.push(`${td},${th}{position:sticky;left:${left[i]}px;right:${right[i]}px}`)
    out.push(`${td}{z-index:1}${th}{z-index:5}`)
    // линия по краю группы закреплённых столбцов (там, где под ними уезжают остальные);
    // :where — нулевая специфичность, чтобы не перебивать подсветку выбранной строки
    const sh = [i < widths.length - 1 && !pinned[i + 1] ? '1px 0 0 var(--line)' : '', i > 0 && !pinned[i - 1] ? '-1px 0 0 var(--line)' : ''].filter(Boolean)
    if (sh.length) out.push(`:where(${td}),:where(${th}){box-shadow:${sh.join(',')}}`)
  })
  return out.join('\n')
}

let seq = 0
/** Свой <style> на каждую таблицу. */
export function pinStyle() {
  const id = 'pt' + ++seq
  const el = document.createElement('style')
  document.head.appendChild(el)
  return {
    id,
    scope: `[data-pt="${id}"]`,
    set(css: string) {
      if (!el.isConnected) document.head.appendChild(el) // React StrictMode снимает и ставит эффекты дважды
      if (el.textContent !== css) el.textContent = css
    },
    destroy() { el.remove() },
  }
}

/** Ширины столбцов по заголовку таблицы. */
export function headWidths(table: HTMLTableElement) {
  return Array.from(table.querySelectorAll<HTMLElement>('thead th')).map((th) => th.getBoundingClientRect().width)
}
