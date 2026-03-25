import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDueTasks, markDone, getScheduleSummary } from '../api/watering'
import { getPlants, getHealthSummary } from '../api/plants'
import { getVapidPublicKey, subscribeUser } from '../api/notifications'
import { useAuth } from '../hooks/useAuth'
import { formatDistanceToNow } from 'date-fns'
import { resolveMediaUrl } from '../api/client'

const TASK_ICONS = { water: '💧', fertilize: '🌱', mist: '💨', repot: '🪴' }

function buildSummaryMap(summary) {
  const map = {}
  for (const s of summary) {
    if (!map[s.plant_id]) map[s.plant_id] = []
    map[s.plant_id].push(s)
  }
  return map
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

function SchedulePill({ task_type, days_until }) {
  const icon = TASK_ICONS[task_type] || '📋'
  let label, cls
  if (days_until <= 0) {
    label = days_until < 0 ? 'overdue' : 'today'
    cls = 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400'
  } else if (days_until <= 3) {
    label = `in ${days_until}d`
    cls = 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
  } else {
    label = `in ${days_until}d`
    cls = 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
  }
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium ${cls}`}>
      {icon} {label}
    </span>
  )
}

function PlantScheduleBadges({ schedules }) {
  if (!schedules?.length) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {schedules.map((s, i) => (
        <SchedulePill key={i} task_type={s.task_type} days_until={s.days_until} />
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [dueTasks, setDueTasks] = useState([])
  const [plants, setPlants] = useState([])
  const [summaryMap, setSummaryMap] = useState({})
  const [healthMap, setHealthMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [notifBanner, setNotifBanner] = useState(false)
  const [notifSubscribing, setNotifSubscribing] = useState(false)

  const load = async () => {
    const [tasks, plantList, summary, health] = await Promise.all([
      getDueTasks(),
      getPlants(),
      getScheduleSummary().catch(() => []),
      getHealthSummary().catch(() => []),
    ])
    setDueTasks(tasks)
    setPlants(plantList)
    setSummaryMap(buildSummaryMap(summary))
    setHealthMap(Object.fromEntries(health.map(h => [h.plant_id, h.health])))
    setLoading(false)
  }

  useEffect(() => {
    load()
    // Show notification banner if permission not yet decided and push is available
    if ('Notification' in window && 'serviceWorker' in navigator && window.isSecureContext && Notification.permission === 'default') {
      setNotifBanner(true)
    }
  }, [])

  const handleDone = async (task) => {
    await markDone(task.plant_id, task.id)
    setDueTasks((prev) => prev.filter((t) => t.id !== task.id))
    // Refresh summary so badges update
    getScheduleSummary().catch(() => []).then(summary => setSummaryMap(buildSummaryMap(summary)))
  }

  const handleEnableNotifications = async () => {
    setNotifSubscribing(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setNotifBanner(false); return }
      const vapidKey = await getVapidPublicKey()
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      await subscribeUser(sub)
      setNotifBanner(false)
    } catch (err) {
      console.error('Notification subscribe failed:', err)
    } finally {
      setNotifSubscribing(false)
    }
  }

  const plantMap = Object.fromEntries(plants.map((p) => [p.id, p]))

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {notifBanner && (
        <div className="mb-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-green-800 dark:text-green-300">
            🔔 Get watering reminders even when the app is closed
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleEnableNotifications}
              disabled={notifSubscribing}
              className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {notifSubscribing ? 'Enabling…' : 'Enable'}
            </button>
            <button
              onClick={() => setNotifBanner(false)}
              className="text-gray-400 hover:text-gray-600 text-xs px-2"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          Hello, {user?.name?.split(' ')[0]} 👋
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Here's what needs attention today</p>
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-12">Loading…</p>
      ) : (
        <div className="grid md:grid-cols-3 gap-8">

          {/* Due tasks column */}
          <div className="md:col-span-1">
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Due tasks</h3>
            {dueTasks.length === 0 ? (
              <div className="bg-green-50 dark:bg-green-900/30 rounded-2xl p-6 text-center">
                <div className="text-3xl mb-2">✅</div>
                <p className="font-medium text-green-700 dark:text-green-400 text-sm">All caught up!</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">No tasks due right now.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dueTasks.map((task) => {
                  const plant = plantMap[task.plant_id]
                  return (
                    <div key={task.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-3 flex items-center gap-3">
                      {plant?.photo_url ? (
                        <img src={resolveMediaUrl(plant.photo_url)} className="w-10 h-10 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xl shrink-0">🪴</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 dark:text-gray-100 text-sm truncate">{plant?.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {TASK_ICONS[task.task_type]} {task.task_type} · {formatDistanceToNow(new Date(task.next_due_at))} ago
                        </p>
                      </div>
                      <button
                        onClick={() => handleDone(task)}
                        className="shrink-0 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs px-2.5 py-1.5 rounded-lg font-medium hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Plants grid */}
          <div className="md:col-span-2">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300">My plants ({plants.length})</h3>
              <Link to="/plants/new" className="text-sm text-green-600 font-medium hover:text-green-700">
                + Add plant
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {plants.map((plant) => (
                <Link
                  key={plant.id}
                  to={`/plants/${plant.id}`}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-3 hover:shadow-md transition-shadow"
                >
                  <div className="w-full aspect-square rounded-lg bg-green-50 dark:bg-green-900/30 mb-2 overflow-hidden flex items-center justify-center">
                    {plant.photo_url ? (
                      <img src={resolveMediaUrl(plant.photo_url)} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl">🪴</span>
                    )}
                  </div>
                  <p className="font-medium text-gray-800 dark:text-gray-100 text-sm truncate">{plant.name}</p>
                  {plant.species && <p className="text-xs text-gray-400 dark:text-gray-500 truncate italic">{plant.species}</p>}
                  {healthMap[plant.id] && (
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full capitalize mt-1 ${
                      healthMap[plant.id] === 'thriving' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' :
                      healthMap[plant.id] === 'good'     ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                      healthMap[plant.id] === 'okay'     ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' :
                      healthMap[plant.id] === 'poor'     ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' :
                                                           'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                    }`}>{healthMap[plant.id]}</span>
                  )}
                  <PlantScheduleBadges schedules={summaryMap[plant.id]} />
                </Link>
              ))}
              <Link
                to="/plants/new"
                className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-3 flex flex-col items-center justify-center hover:border-green-400 hover:text-green-600 transition-colors aspect-square text-gray-300 dark:text-gray-600"
              >
                <span className="text-3xl">+</span>
                <p className="text-xs mt-1">Add plant</p>
              </Link>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
