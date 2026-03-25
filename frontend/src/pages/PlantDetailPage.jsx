import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getPlant, updatePlant, deletePlant, uploadPlantPhoto } from '../api/plants'
import { getSchedules, createSchedule, updateSchedule, markDone, deleteSchedule } from '../api/watering'
import { resolveMediaUrl } from '../api/client'
import { getEntries } from '../api/journal'
import { formatDistanceToNow, format } from 'date-fns'
import PhotoCarousel from '../components/PhotoCarousel'

const TASK_ICONS = { water: '💧', fertilize: '🌱', mist: '💨', repot: '🪴' }
const TASK_TYPES = ['water', 'fertilize', 'mist', 'repot']

export default function PlantDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const cameraRef = useRef()
  const libraryRef = useRef()

  const [plant, setPlant] = useState(null)
  const [schedules, setSchedules] = useState([])
  const [entries, setEntries] = useState([])
  const [tab, setTab] = useState(() => ['care', 'journal'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'care')
  const [showAddSchedule, setShowAddSchedule] = useState(false)
  const [newSchedule, setNewSchedule] = useState({ task_type: 'water', frequency_days: 7, notify_days_before: 0 })
  const [justDone, setJustDone] = useState({})
  const [editingScheduleId, setEditingScheduleId] = useState(null)
  const [editScheduleValues, setEditScheduleValues] = useState({})
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState(null)

  const load = async () => {
    const [p, s, e] = await Promise.all([getPlant(id), getSchedules(id), getEntries(id)])
    setPlant(p)
    setSchedules(s)
    setEntries(e)
    setEditForm({ name: p.name, species: p.species || '', location: p.location || '', notes: p.notes || '' })
  }

  useEffect(() => {
    load()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [id])

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPhotoUploading(true)
    setPhotoError(null)
    try {
      const updated = await uploadPlantPhoto(id, file)
      setPlant(updated)
    } catch {
      setPhotoError('Upload failed — check file size (max 10 MB)')
    } finally {
      setPhotoUploading(false)
    }
  }

  const handleMarkDone = async (schedule) => {
    const updated = await markDone(id, schedule.id)
    setSchedules((prev) => prev.map((s) => s.id === updated.id ? updated : s))
    setJustDone((prev) => ({ ...prev, [schedule.id]: true }))
    setTimeout(() => setJustDone((prev) => ({ ...prev, [schedule.id]: false })), 2000)
  }

  const handleAddSchedule = async () => {
    const s = await createSchedule(id, newSchedule)
    setSchedules((prev) => [...prev, s])
    setShowAddSchedule(false)
    setNewSchedule({ task_type: 'water', frequency_days: 7, notify_days_before: 0 })
  }

  const handleDeleteSchedule = async (scheduleId) => {
    await deleteSchedule(id, scheduleId)
    setSchedules((prev) => prev.filter((s) => s.id !== scheduleId))
  }

  const startEditSchedule = (s) => {
    setEditingScheduleId(s.id)
    setEditScheduleValues({ frequency_days: s.frequency_days, notify_days_before: s.notify_days_before })
  }

  const handleUpdateSchedule = async (scheduleId) => {
    const updated = await updateSchedule(id, scheduleId, editScheduleValues)
    setSchedules((prev) => prev.map((s) => s.id === updated.id ? updated : s))
    setEditingScheduleId(null)
  }

  const handleSave = async () => {
    const updated = await updatePlant(id, editForm)
    setPlant(updated)
    setEditing(false)
  }

  const handleDelete = async () => {
    if (!confirm(`Delete ${plant.name}? This cannot be undone.`)) return
    await deletePlant(id)
    navigate('/')
  }

  if (!plant) return <p className="text-center py-20 text-gray-400">Loading…</p>

  return (
    <div className="max-w-lg mx-auto">
      {/* Hero photo */}
      <div className="relative w-full aspect-square bg-green-100 dark:bg-green-900/30 flex items-center justify-center overflow-hidden">
        {plant.photo_url ? (
          <img src={resolveMediaUrl(plant.photo_url)} className="w-full h-full object-cover" />
        ) : (
          <span className="text-8xl">🪴</span>
        )}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
        <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
        <div className="absolute bottom-3 right-3 flex gap-1.5">
          <button
            onClick={() => cameraRef.current.click()}
            disabled={photoUploading}
            className="bg-white/80 backdrop-blur rounded-full p-2 shadow text-gray-700 hover:bg-white disabled:opacity-50 text-sm"
            title="Take photo"
          >
            {photoUploading ? '⏳' : '📷'}
          </button>
          <button
            onClick={() => libraryRef.current.click()}
            disabled={photoUploading}
            className="bg-white/80 backdrop-blur rounded-full p-2 shadow text-gray-700 hover:bg-white disabled:opacity-50 text-sm"
            title="Choose from library"
          >
            🖼️
          </button>
        </div>
        <Link to="/" className="absolute top-3 left-3 bg-white/80 backdrop-blur rounded-full p-2 shadow text-gray-700 hover:bg-white">←</Link>
      </div>
      {photoError && (
        <p className="text-xs text-red-500 text-center py-2 px-4">{photoError}</p>
      )}

      <div className="p-4">
        {editing ? (
          <div className="space-y-3 mb-4">
            <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" placeholder="Name" />
            <input value={editForm.species} onChange={e => setEditForm({ ...editForm, species: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" placeholder="Species" />
            <input value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" placeholder="Location" />
            <textarea value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" rows={3} placeholder="Notes" />
            <div className="flex gap-2">
              <button onClick={handleSave} className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium">Save</button>
              <button onClick={() => setEditing(false)} className="flex-1 border border-gray-300 dark:border-gray-600 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{plant.name}</h1>
                {plant.species && <p className="text-gray-500 dark:text-gray-400 text-sm italic">{plant.species}</p>}
                {plant.location && <p className="text-gray-400 dark:text-gray-500 text-sm">📍 {plant.location}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-gray-600">✏️</button>
                <button onClick={handleDelete} className="text-gray-400 hover:text-red-500">🗑️</button>
              </div>
            </div>
            {plant.notes && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{plant.notes}</p>}
          </div>
        )}

        {/* Photo carousel */}
        {(() => {
          const photos = entries
            .filter(e => e.photo_url)
            .map(e => ({ url: resolveMediaUrl(e.photo_url), date: e.entry_date, entryId: e.id }))
          return photos.length > 0 ? (
            <div className="mb-4 -mx-4">
              <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide px-4 mb-2">Photos</h3>
              <PhotoCarousel photos={photos} />
            </div>
          ) : null
        })()}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
          {['care', 'journal'].map((t) => (
            <button key={t} onClick={() => { setTab(t); location.hash = t }}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${tab === t ? 'border-green-600 text-green-700 dark:text-green-400' : 'border-transparent text-gray-500 dark:text-gray-400'}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'care' && (
          <div className="space-y-3">
            {schedules.map((s) => {
              const isDue = s.next_due_at && new Date(s.next_due_at) <= new Date()
              const isEditing = editingScheduleId === s.id
              return (
                <div key={s.id} className={`rounded-xl border p-4 ${isDue ? 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{TASK_ICONS[s.task_type] || '📋'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 dark:text-gray-100 capitalize">{s.task_type}</p>
                      <button onClick={() => startEditSchedule(s)} className="text-left">
                        <p className="text-xs text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors">
                          Every {s.frequency_days} day{s.frequency_days !== 1 ? 's' : ''}
                          {s.notify_days_before > 0 ? ` · notify ${s.notify_days_before}d early` : ''}
                        </p>
                      </button>
                      {s.next_due_at && (
                        <p className={`text-xs ${isDue ? 'text-orange-600 dark:text-orange-400 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                          {isDue ? 'Overdue' : 'Due'} {formatDistanceToNow(new Date(s.next_due_at), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                    <button onClick={() => handleMarkDone(s)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0 ${
                        justDone[s.id]
                          ? 'bg-green-600 text-white'
                          : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                      }`}>
                      {justDone[s.id] ? '✓ Done!' : 'Done'}
                    </button>
                    <button onClick={() => handleDeleteSchedule(s.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-400 text-lg shrink-0">×</button>
                  </div>

                  {isEditing && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500 dark:text-gray-400 w-14 shrink-0">Every</label>
                        <input
                          type="number" min={1}
                          value={editScheduleValues.frequency_days}
                          onChange={e => setEditScheduleValues(v => ({ ...v, frequency_days: parseInt(e.target.value) || 1 }))}
                          className="w-16 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400">days</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500 dark:text-gray-400 w-14 shrink-0">Notify</label>
                        <select
                          value={editScheduleValues.notify_days_before}
                          onChange={e => setEditScheduleValues(v => ({ ...v, notify_days_before: parseInt(e.target.value) }))}
                          className="border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        >
                          <option value={0}>on the due day</option>
                          {[1,2,3,4,5,6,7].map(d => (
                            <option key={d} value={d}>{d} day{d > 1 ? 's' : ''} early</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => handleUpdateSchedule(s.id)} className="flex-1 bg-green-600 text-white py-1.5 rounded-lg text-xs font-medium">Save</button>
                        <button onClick={() => setEditingScheduleId(null)} className="flex-1 border border-gray-300 dark:border-gray-600 py-1.5 rounded-lg text-xs text-gray-700 dark:text-gray-300">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {showAddSchedule ? (
              <div className="border border-green-200 dark:border-green-800 rounded-xl p-4 space-y-3 bg-green-50 dark:bg-green-900/20">
                <div className="flex flex-wrap gap-2">
                  {TASK_TYPES.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewSchedule({ ...newSchedule, task_type: t })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        newSchedule.task_type === t
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-green-400'
                      }`}
                    >
                      {TASK_ICONS[t]} {t}
                    </button>
                  ))}
                </div>
                <input
                  value={TASK_TYPES.includes(newSchedule.task_type) ? '' : newSchedule.task_type}
                  onChange={e => setNewSchedule({ ...newSchedule, task_type: e.target.value })}
                  placeholder="Or type a custom task…"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-300">Every</label>
                  <input type="number" min={1} value={newSchedule.frequency_days}
                    onChange={e => setNewSchedule({ ...newSchedule, frequency_days: parseInt(e.target.value) })}
                    className="w-20 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                  <label className="text-sm text-gray-600 dark:text-gray-300">days</label>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-300">Notify</label>
                  <select value={newSchedule.notify_days_before}
                    onChange={e => setNewSchedule({ ...newSchedule, notify_days_before: parseInt(e.target.value) })}
                    className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                    <option value={0}>on the due day</option>
                    {[1,2,3,4,5,6,7].map(d => (
                      <option key={d} value={d}>{d} day{d > 1 ? 's' : ''} early</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddSchedule} className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium">Add</button>
                  <button onClick={() => setShowAddSchedule(false)} className="flex-1 border border-gray-300 dark:border-gray-600 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddSchedule(true)}
                className="w-full border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl py-3 text-sm text-gray-400 dark:text-gray-500 hover:border-green-400 hover:text-green-600 transition-colors">
                + Add care task
              </button>
            )}
          </div>
        )}

        {tab === 'journal' && (
          <div className="space-y-3">
            <Link to={`/plants/${id}/journal/new`}
              className="block w-full text-center bg-green-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-green-700">
              + New entry
            </Link>
            {entries.length === 0 && (
              <p className="text-center text-gray-400 py-8 text-sm">No journal entries yet</p>
            )}
            {entries.map((entry) => (
              <Link key={entry.id} to={`/plants/${id}/journal/${entry.id}`}
                className="block bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex gap-3">
                  {entry.photo_url && (
                    <img src={resolveMediaUrl(entry.photo_url)} className="w-16 h-16 rounded-lg object-cover shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs text-gray-400 dark:text-gray-500">{format(new Date(entry.entry_date), 'MMM d, yyyy')}</p>
                      {entry.health && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                          entry.health === 'thriving' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' :
                          entry.health === 'good'     ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                          entry.health === 'okay'     ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' :
                          entry.health === 'poor'     ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' :
                                                        'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                        }`}>{entry.health}</span>
                      )}
                    </div>
                    {entry.title && <p className="font-medium text-gray-800 dark:text-gray-100 truncate">{entry.title}</p>}
                    {entry.body && <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{entry.body}</p>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
