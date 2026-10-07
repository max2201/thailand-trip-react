import { useEffect, useSyncExternalStore } from 'react'
import { reportsStore } from '../lib/reports'

/**
 * Заявки на отчёты по остановке: подписка на общее хранилище (как useMarks)
 * и слежение за остановкой, пока компонент на экране. (Во Vue-версии — composables/useReports.)
 */
export function useReports(stopId: string) {
  useSyncExternalStore(reportsStore.subscribe, reportsStore.getVersion)
  useEffect(() => reportsStore.watch(stopId), [stopId])
  return reportsStore
}
