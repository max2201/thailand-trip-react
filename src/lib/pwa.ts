import { registerSW } from 'virtual:pwa-register'

/**
 * Обновление сайта, установленного как приложение (PWA).
 * Новая версия проверяется при запуске и каждый раз, когда вкладка снова становится активной.
 * Если она есть, страница перезагружается сама; фильтры живут в адресе, отметки и настройки карты —
 * в хранилище, так что после перезагрузки всё остаётся на месте.
 */
export function setupUpdates() {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      if (!reg) return
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => { /* нет сети — проверим позже */ })
      })
    },
  })
}
