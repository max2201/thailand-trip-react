# Таиланд, 6–26 декабря — React-версия

Тот же сайт, что и `thailand-trip-vue`, но на **React 19 + TypeScript + Vite 8**: Zustand, react-router (hash), TanStack Virtual, Leaflet + OpenStreetMap, Firebase Firestore, vite-plugin-pwa.

## Запуск

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # сборка в dist/
npm run typecheck  # tsc
```

Деплой — GitHub Actions при пуше в `main` (`.github/workflows/deploy.yml`). В настройках репозитория: **Settings → Pages → Source: GitHub Actions**.

## Структура

```
src/
  lib/                 бизнес-логика без фреймворка — та же копия, что во Vue-версии
  store/trip.ts        Zustand: индекс маршрута, строки отелей, фильтры по остановкам
  hooks/useMarks.ts    подписка на хранилище отметок через useSyncExternalStore
  components/          UI
public/data/           данные по городам и остановкам
```

## Шпаргалка Vue → React на примере этого проекта

| Во Vue-версии | Здесь, в React | Где посмотреть |
|---|---|---|
| Pinia `defineStore`, мутируем `state` напрямую | Zustand `create`, иммутабельные обновления `set(s => ({...}))` | `store/trip.ts` |
| `computed(() => …)` | `useMemo(() => …, [deps])` — зависимости перечисляем сами | `FiltersPanel.tsx`, `HotelsPane.tsx` |
| `watch(src, cb, { immediate: true })` | `useEffect(cb, [deps])` | `StopView.tsx` — загрузка остановки |
| `onMounted` / `onBeforeUnmount` | `useEffect(() => { …; return cleanup }, [])` | `HotelMap.tsx` |
| `ref()` на DOM-элемент | `useRef()` | `HotelsTable.tsx` |
| `ref()` для значения | `useState()`; если перерисовка не нужна — `useRef()` | `FiltersPanel.tsx` (armed) |
| composable `useMarks()` + `shallowRef` | хук `useMarks()` + `useSyncExternalStore` | `hooks/useMarks.ts` |
| `v-model` | `value` + `onChange` | поля фильтров |
| `v-if` / `v-for` | `&&`, тернарник / `.map()` с `key` | везде |
| `:key="$route.params.stop"` на `<RouterView>` | `key={stop}` на компоненте | `App.tsx` |
| `emit('select', id)` | колбэк в пропсах `onSelect(id)` | `HotelsTable.tsx` |
| `<template>`-фрагмент | `<>…</>` | `HotelCells.tsx` |
| `@click.stop` | `e.stopPropagation()` | `MarkButton.tsx` |

Главная разница, которую видно в коде: во Vue реактивность «сама» отслеживает зависимости, а в React компонент — это функция, которая перезапускается целиком, и зависимости `useMemo`/`useEffect` перечисляются руками. Отсюда же `useCallback` в `App.tsx`: без него в окно «Кто вы?» каждую перерисовку уходила бы новая функция, и эффект с фокусом перезапускался бы.
