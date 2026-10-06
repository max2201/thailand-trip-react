import { useSyncExternalStore } from 'react'
import { legendStore } from '../lib/maplegend'

/**
 * Состояние легенды карты (что выключено, радиус круга) — общее для карты и фильтров.
 * Та же схема, что у useMarks: внешнее хранилище + useSyncExternalStore.
 */
export function useLegend() {
  const legend = useSyncExternalStore(legendStore.subscribe, legendStore.get)
  return [legend, legendStore.set] as const
}
