import type { CityId, Hotel, Prices, TripIndex } from './types'

const base = import.meta.env.BASE_URL
const cache = new Map<string, Promise<unknown>>()
function getJSON<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    cache.set(path, fetch(base + path).then((r) => {
      if (!r.ok) throw new Error(`${path}: ${r.status}`)
      return r.json()
    }).catch((e) => { cache.delete(path); throw e }))
  }
  return cache.get(path) as Promise<T>
}
export const loadIndex = () => getJSON<TripIndex>('data/index.json')
export const loadCity = (city: CityId) => getJSON<Hotel[]>(`data/cities/${city}.json`)
export const loadPrices = (stopId: string) => getJSON<Prices>(`data/prices/${stopId}.json`)
