import api from './client'

export const getEntries = (plantId) => api.get(`/plants/${plantId}/journal/`).then(r => r.data)
export const createEntry = (plantId, data) => api.post(`/plants/${plantId}/journal/`, data).then(r => r.data)
export const updateEntry = (plantId, entryId, data) => api.patch(`/plants/${plantId}/journal/${entryId}`, data).then(r => r.data)
export const deleteEntry = (plantId, entryId) => api.delete(`/plants/${plantId}/journal/${entryId}`)
export const uploadEntryPhoto = (plantId, entryId, file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post(`/plants/${plantId}/journal/${entryId}/photo`, form).then(r => r.data)
}
