import { useSyncExternalStore } from 'react'
import { marksStore } from '../lib/marks'

/**
 * Подписка компонента на внешнее хранилище отметок.
 * useSyncExternalStore перерисует компонент, когда изменится version.
 * (Во Vue-версии то же делает shallowRef + subscribe в composable.)
 */
export function useMarks() {
  useSyncExternalStore(marksStore.subscribe, marksStore.getVersion)
  return marksStore
}
