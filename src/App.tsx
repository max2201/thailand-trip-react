import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { useTrip } from './store/trip'
import { useMarks } from './hooks/useMarks'
import { AppHeader, MethodNotes, NameBar, RouteRibbon, WhoDialog } from './components/Chrome'
import { StopView } from './components/StopView'

/** Ключ по остановке — как :key="$route.params.stop" во Vue: при смене остановки состояние страницы сбрасывается. */
function StopPage() {
  const { stop } = useParams()
  return (
    <>
      <RouteRibbon />
      <StopView key={stop} />
    </>
  )
}

export default function App() {
  const index = useTrip((s) => s.index)
  const error = useTrip((s) => s.error)
  const init = useTrip((s) => s.init)
  const store = useMarks()
  const [whoOpen, setWhoOpen] = useState(false)
  const asked = useRef(false)
  const openWho = useCallback(() => setWhoOpen(true), [])
  const closeWho = useCallback(() => setWhoOpen(false), [])

  useEffect(() => { init() }, [init])
  // Спрашиваем имя, как только база ответила, — один раз за визит.
  useEffect(() => {
    if (!asked.current && store.mode === 'shared' && store.needName) { asked.current = true; setWhoOpen(true) }
  }, [store, store.version])

  return (
    <>
      <div className="wrap">
        <AppHeader />
        {error ? <div className="err">Не удалось загрузить данные: {error}</div>
          : !index ? <div className="loading">Загружаю маршрут…</div>
          : (
            <>
              <NameBar onWho={openWho} />
              <Routes>
                <Route path="/" element={<Navigate to="/s1" replace />} />
                <Route path="/:stop/:tab?" element={<StopPage />} />
              </Routes>
              <MethodNotes />
            </>
          )}
      </div>
      {whoOpen && <WhoDialog onClose={closeWho} />}
    </>
  )
}
