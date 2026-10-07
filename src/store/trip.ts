import { create } from 'zustand'
import type { Stop, StopRows, TripIndex } from '../lib/types'
import { loadCity, loadIndex, loadPrices } from '../lib/data'
import { buildRows } from '../lib/rows'
import { marksStore } from '../lib/marks'
import { type Filters, decodeFilters } from '../lib/filters'

/**
 * Глобальное состояние на Zustand (аналог Pinia-стора во Vue-версии).
 * В React состояние иммутабельное: фильтры обновляем через setFilters(stopId, f => ({ ...f, ... })).
 */
interface TripState {
  index: TripIndex | null
  error: string
  rows: Record<string, StopRows>
  filters: Record<string, Filters>
  init: () => Promise<void>
  ensureStop: (stop: Stop) => Promise<void>
  initFilters: (stop: Stop, raw: string | null) => void
  setFilters: (stopId: string, update: (f: Filters) => Filters) => void
}

export const useTrip = create<TripState>((set, get) => ({
  index: null,
  error: '',
  rows: {},
  filters: {},
  init: async () => {
    try {
      const index = await loadIndex()
      marksStore.setMerges(Object.fromEntries(index.stops.filter((x) => x.merge?.length).map((x) => [x.id, x.merge!])))
      set({ index })
    } catch (e) { set({ error: String(e) }) }
  },
  ensureStop: async (stop) => {
    if (get().rows[stop.id]) return
    const [hotels, prices] = await Promise.all([loadCity(stop.city), loadPrices(stop.id)])
    set((s) => ({ rows: { ...s.rows, [stop.id]: buildRows(stop, hotels, prices) } }))
  },
  initFilters: (stop, raw) => {
    if (raw == null && get().filters[stop.id]) return
    set((s) => ({ filters: { ...s.filters, [stop.id]: decodeFilters(raw, stop) } }))
  },
  setFilters: (stopId, update) => set((s) => ({ filters: { ...s.filters, [stopId]: update(s.filters[stopId]) } })),
}))

export const stopById = (index: TripIndex | null, id: string | undefined) => index?.stops.find((s) => s.id === id)
