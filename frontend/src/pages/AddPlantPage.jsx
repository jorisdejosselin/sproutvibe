import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { createPlant, searchSpecies, getSpecies, getWikiDescription, getAiCare } from '../api/plants'
import { createSchedule } from '../api/watering'
import { resolveMediaUrl } from '../api/client'

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

const TASK_ICONS = { water: '💧', fertilize: '🌱', mist: '💨', repot: '🪴' }

const SOURCE_CONFIG = {
  perenual:    { label: 'Perenual',    cls: 'bg-blue-50 text-blue-500 dark:bg-blue-900/30 dark:text-blue-400' },
  floracodex:  { label: 'FloraCodex',  cls: 'bg-purple-50 text-purple-500 dark:bg-purple-900/30 dark:text-purple-400' },
  inaturalist: { label: 'iNaturalist', cls: 'bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400' },
}

// Suggested schedules based on species data — extend as needed
function buildSuggestedSchedules(species) {
  const schedules = []
  if (species.watering_days) {
    schedules.push({ task_type: 'water', frequency_days: species.watering_days, label: `every ${species.watering_days} days` })
  }
  return schedules
}

export default function AddPlantPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', species: '', location: '', notes: '', photo_url: null })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Species search
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [selected, setSelected] = useState(null)      // full species detail
  const [apiUnavailable, setApiUnavailable] = useState(false)
  const [schedules, setSchedules] = useState([])       // suggested care tasks
  const debouncedQuery = useDebounce(query, 400)

  useEffect(() => {
    if (!debouncedQuery.trim() || apiUnavailable) { setResults([]); return }
    setSearching(true)
    searchSpecies(debouncedQuery)
      .then(setResults)
      .catch((err) => {
        if (err.response?.status === 503) setApiUnavailable(true)
        setResults([])
      })
      .finally(() => setSearching(false))
  }, [debouncedQuery])

  const handleSelect = async (preview) => {
    setResults([])
    setQuery('')
    setLoadingDetails(true)
    try {
      // Try Perenual detail (has care data + description for paid plans)
      let species
      try {
        species = await getSpecies(preview.id, preview.source)
      } catch {
        // API failed (rate limit, key missing, etc.) — fall back to Wikipedia for description only
        const wiki = await getWikiDescription(preview.scientific_name).catch(() => ({}))
        species = { ...preview, description: wiki.description || null, thumbnail: wiki.thumbnail || preview.thumbnail }
      }
      setSelected(species)

      // Build schedules: start with anything Perenual gave us, then fill in with AI
      let tasks = buildSuggestedSchedules(species)
      if (tasks.length === 0) {
        // Try AI care recommendations as fallback
        try {
          const ai = await getAiCare(species.common_name, species.scientific_name)
          tasks = ai.tasks.map(t => ({
            task_type: t.task_type,
            frequency_days: t.frequency_days,
            label: `every ${t.frequency_days} day${t.frequency_days !== 1 ? 's' : ''}`,
            notes: t.notes,
          }))
          // If AI also gave a summary and we have no description yet, use it
          if (!species.description && ai.care_summary) {
            species = { ...species, description: ai.care_summary }
          }
        } catch {
          // AI not configured or failed — schedules stay empty, user can add manually
        }
      }
      setSchedules(tasks)

      setForm((f) => ({
        ...f,
        name: f.name || species.common_name,
        species: species.scientific_name || species.common_name,
        notes: f.notes || species.description || '',
        photo_url: f.photo_url || species.thumbnail || null,
      }))
    } catch {
      setSelected(preview)
      setForm((f) => ({
        ...f,
        name: f.name || preview.common_name,
        species: preview.scientific_name || preview.common_name,
        photo_url: f.photo_url || preview.thumbnail || null,
      }))
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const plant = await createPlant(form)
      // Auto-create suggested care schedules
      await Promise.all(schedules.map(s => createSchedule(plant.id, {
        task_type: s.task_type,
        frequency_days: s.frequency_days,
      }).catch(() => null))) // don't block plant creation if a schedule fails
      navigate(`/plants/${plant.id}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create plant')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="text-gray-400 hover:text-gray-600 text-lg">←</Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Add a plant</h1>
      </div>

      {/* Species search */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
        <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Search plant database</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Find your plant to auto-fill details and care schedule</p>

        {apiUnavailable ? (
          <div className="text-sm text-amber-700 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 flex items-center justify-between gap-3">
            <span>No plant database configured yet.</span>
            <Link to="/settings" className="font-medium text-amber-700 underline whitespace-nowrap">Go to Settings →</Link>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Monstera, Snake plant, Fiddle leaf fig…"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
            {(searching || loadingDetails) && (
              <span className="absolute right-3 top-2.5 text-gray-400 text-sm">
                {loadingDetails ? 'Loading details…' : 'Searching…'}
              </span>
            )}
            {results.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
                {results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelect(r)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 dark:hover:bg-green-900/20 text-left transition-colors"
                  >
                    {r.thumbnail ? (
                      <img src={r.thumbnail} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0 text-lg">🪴</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-800 dark:text-gray-100 text-sm truncate">{r.common_name || r.scientific_name}</p>
                        {(() => { const src = SOURCE_CONFIG[r.source] || { label: r.source, cls: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' }; return (
                          <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${src.cls}`}>{src.label}</span>
                        )})()}
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 italic truncate">{r.scientific_name}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selected species card */}
        {selected && (
          <div className="mt-4 bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
            <div className="flex gap-4 mb-3">
              {selected.thumbnail && (
                <img src={selected.thumbnail} className="w-16 h-16 rounded-xl object-cover shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-800 dark:text-gray-100">{selected.common_name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">{selected.scientific_name}</p>
              </div>
              <button type="button" onClick={() => { setSelected(null); setSchedules([]); setForm(f => ({ ...f, photo_url: null })) }}
                className="text-gray-300 dark:text-gray-600 hover:text-gray-500 self-start text-lg leading-none">×</button>
            </div>

            {selected.description && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 leading-relaxed">{selected.description}</p>
            )}

            {schedules.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Care schedules to create automatically</p>
                  <span className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-500 dark:text-purple-400 border border-purple-200 dark:border-purple-800 px-2 py-0.5 rounded-full">AI suggestion</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {schedules.map((s) => (
                    <span key={s.task_type} className="inline-flex items-center gap-1.5 bg-white dark:bg-gray-700 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-xs px-3 py-1.5 rounded-full font-medium">
                      {TASK_ICONS[s.task_type]} {s.task_type} {s.label}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">These are Claude AI suggestions — always verify with a reliable plant care source.</p>
              </div>
            )}

            {schedules.length === 0 && !selected.description && (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">No extra care data available for this species on the free plan.</p>
            )}
          </div>
        )}
      </div>

      {/* Plant form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h2 className="font-semibold text-gray-700 dark:text-gray-300">Plant details</h2>

        {/* Photo preview from species database */}
        {form.photo_url && (
          <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
            <img src={resolveMediaUrl(form.photo_url)} className="w-14 h-14 rounded-lg object-cover shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-green-700 dark:text-green-400">Photo from plant database</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">You can replace it after adding the plant</p>
            </div>
            <button type="button" onClick={() => setForm(f => ({ ...f, photo_url: null }))}
              className="text-gray-300 dark:text-gray-600 hover:text-gray-500 text-lg leading-none shrink-0">×</button>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nickname *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            placeholder="e.g. My Monstera"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Species</label>
          <input
            type="text"
            value={form.species}
            onChange={(e) => setForm({ ...form, species: e.target.value })}
            placeholder="e.g. Monstera deliciosa"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
          <input
            type="text"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="e.g. Living room window"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description / notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={4}
            placeholder="Fetched automatically when you pick a species, or write your own…"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white py-3 rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {loading
            ? 'Adding…'
            : schedules.length > 0
              ? `Add plant + ${schedules.length} care task${schedules.length > 1 ? 's' : ''}`
              : 'Add plant'}
        </button>
      </form>
    </div>
  )
}
