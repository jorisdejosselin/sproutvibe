import { useState } from 'react'
import {
  devForceAllDue, devResetAllDue, devSendTestPush, devTriggerNotifications,
  devNotifySchedule, devGetPlantsSchedules, devSetNotificationHour,
} from '../api/dev'

export default function DevToolbar({ onRefresh }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState(null)
  const [schedules, setSchedules] = useState(null)   // null = not loaded yet
  const [selectedSchedule, setSelectedSchedule] = useState('')
  const [notifHour, setNotifHour] = useState(8)

  const run = async (fn, label) => {
    setStatus('…')
    try {
      const result = await fn()
      const extra = result?.updated != null ? ` (${result.updated} tasks)` : ''
      setStatus(`${label}${extra}`)
      onRefresh?.()
    } catch {
      setStatus('Error — is DEV_MODE=true on the backend?')
    }
    setTimeout(() => setStatus(null), 3000)
  }

  const loadSchedules = async () => {
    if (schedules !== null) return
    const data = await devGetPlantsSchedules().catch(() => [])
    setSchedules(data)
    if (data.length > 0) setSelectedSchedule(data[0].id)
  }

  const handleOpen = () => {
    setOpen(o => !o)
    if (!open) loadSchedules()
  }

  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-50">
      {!open && (
        <button
          onClick={handleOpen}
          className="bg-gray-900 text-white text-xs px-3 py-2 rounded-xl shadow-lg border border-gray-700 font-mono"
        >
          DEV ▲
        </button>
      )}

      {open && (
        <div className="bg-gray-900 text-white text-xs rounded-xl shadow-lg border border-gray-700 w-72">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
            <span className="font-mono text-gray-400">DEV</span>
            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white">▼</button>
          </div>

          {/* Tasks section */}
          <div className="px-3 py-2 border-b border-gray-700 space-y-1.5">
            <p className="text-gray-500 uppercase tracking-wider text-[10px] mb-1.5">Tasks</p>
            <div className="flex gap-2">
              <button
                onClick={() => run(devForceAllDue, 'All overdue')}
                className="bg-orange-600 hover:bg-orange-500 px-2.5 py-1 rounded-lg font-medium transition-colors flex-1"
              >
                Make all overdue
              </button>
              <button
                onClick={() => run(devResetAllDue, 'Reset')}
                className="bg-gray-600 hover:bg-gray-500 px-2.5 py-1 rounded-lg font-medium transition-colors flex-1"
              >
                Reset all
              </button>
            </div>
          </div>

          {/* Notifications section */}
          <div className="px-3 py-2 space-y-2">
            <p className="text-gray-500 uppercase tracking-wider text-[10px] mb-1.5">Notifications</p>

            {/* Global actions */}
            <div className="flex gap-2">
              <button
                onClick={() => run(devSendTestPush, 'Test push sent')}
                className="bg-blue-700 hover:bg-blue-600 px-2.5 py-1 rounded-lg font-medium transition-colors flex-1"
              >
                Test push
              </button>
              <button
                onClick={() => run(devTriggerNotifications, 'Notifs triggered')}
                className="bg-green-700 hover:bg-green-600 px-2.5 py-1 rounded-lg font-medium transition-colors flex-1"
              >
                Trigger all due
              </button>
            </div>

            {/* Per-schedule notify */}
            {schedules?.length > 0 && (
              <div className="flex gap-1">
                <select
                  value={selectedSchedule}
                  onChange={e => setSelectedSchedule(Number(e.target.value))}
                  className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-2 py-1 text-xs text-gray-200 min-w-0"
                >
                  {schedules.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.plant_name} — {s.task_type}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => run(() => devNotifySchedule(selectedSchedule), 'Notif sent')}
                  className="bg-purple-700 hover:bg-purple-600 px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0"
                >
                  🔔
                </button>
              </div>
            )}
            {schedules?.length === 0 && (
              <p className="text-gray-500 text-[10px]">No schedules found</p>
            )}
            {schedules === null && (
              <p className="text-gray-500 text-[10px]">Loading…</p>
            )}

            {/* Notification hour */}
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-[10px] shrink-0">Notif hour:</span>
              <input
                type="number" min={0} max={23} value={notifHour}
                onChange={e => setNotifHour(Number(e.target.value))}
                className="w-14 bg-gray-800 border border-gray-600 rounded-lg px-2 py-1 text-xs text-center text-gray-200"
              />
              <button
                onClick={() => run(() => devSetNotificationHour(notifHour), `Hour set to ${notifHour}`)}
                className="bg-gray-600 hover:bg-gray-500 px-2.5 py-1 rounded-lg font-medium transition-colors flex-1"
              >
                Reschedule
              </button>
            </div>
          </div>

          {/* Status bar */}
          {status && (
            <div className="px-3 py-1.5 border-t border-gray-700 text-gray-300">
              {status}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
