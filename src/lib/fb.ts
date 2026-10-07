import type { Firestore } from 'firebase/firestore'
import { FIREBASE } from './config'

/**
 * Одно подключение к Firestore на весь сайт: его используют и отметки «+/−», и отчёты.
 * Библиотеку Firebase грузим лениво, чтобы она не тормозила первую отрисовку.
 */
type FS = typeof import('firebase/firestore')
let ready: Promise<{ fs: FS; db: Firestore }> | null = null

export function firestore() {
  if (!ready) {
    ready = (async () => {
      const [{ initializeApp }, fs] = await Promise.all([import('firebase/app'), import('firebase/firestore')])
      const app = initializeApp(FIREBASE)
      let db: Firestore
      try { db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) }) }
      catch { db = fs.getFirestore(app) }
      return { fs, db }
    })()
    ready.catch(() => { ready = null })
  }
  return ready
}
