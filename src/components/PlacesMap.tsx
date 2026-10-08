import { useEffect, useRef } from 'react'
import { createPlacesMap, type LatLng, type PlaceItem, type PlacesMap as PM } from '../lib/placesmap'

/** Карта рядом со списком карточек: номера точек = номера карточек. hover — какая карточка под курсором. */
export function PlacesMap({ items, anchor, hover, onPick, onHover }: {
  items: PlaceItem[]; anchor?: { ll: LatLng; name: string } | null; hover: string | null
  onPick: (id: string) => void; onHover: (id: string | null) => void
}) {
  const el = useRef<HTMLDivElement>(null)
  const pm = useRef<PM | null>(null)
  const cb = useRef({ onPick, onHover })
  cb.current = { onPick, onHover }
  useEffect(() => {
    if (!el.current) return
    const m = createPlacesMap(el.current, (id) => cb.current.onPick(id), (id) => cb.current.onHover(id))
    pm.current = m
    const ro = new ResizeObserver(() => m.invalidate())
    ro.observe(el.current)
    return () => { ro.disconnect(); m.destroy(); pm.current = null }
  }, [])
  useEffect(() => { pm.current?.set(items, anchor) }, [items, anchor])
  useEffect(() => { pm.current?.highlight(hover) }, [hover])
  return (
    <aside className="pmap">
      <div ref={el} className="pmap-canvas" />
      <p className="pmap-note"><span className="pm-dot" />номер на карте = номер карточки · <span className="pm-home-k" />отель по плану</p>
    </aside>
  )
}
