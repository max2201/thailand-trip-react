import { useMarks } from '../hooks/useMarks'

const LABEL = { 0: 'Без отметки. Нажмите, чтобы поставить плюс', 1: 'Плюс. Нажмите, чтобы поставить минус', [-1]: 'Минус. Нажмите, чтобы убрать отметку' } as const
const SYM = { 0: '', 1: '+', [-1]: '−' } as const

export function MarkButton({ stop, id }: { stop: string; id: number }) {
  const store = useMarks()
  const mark = store.mine(stop, id)
  const others = store.othersFor(stop, id).slice(0, 4)
  return (
    <div className="mk-wrap">
      <button type="button" className={`tri t${mark}`} aria-label={LABEL[mark]} title={LABEL[mark]}
        onClick={(e) => { e.stopPropagation(); store.cycle(stop, id) }}>{SYM[mark]}</button>
      {others.length > 0 && (
        <div className="om">
          {others.map(([u, v]) => (
            <span key={u} className={`oc ${v === 1 ? 'op' : 'on'}`} title={`${store.nameOf(u)}: ${v === 1 ? 'плюс' : 'минус'}`}>
              {store.nameOf(u).slice(0, 1).toUpperCase()}{v === 1 ? '+' : '−'}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
