import api from './client'

export const getPlants = () => api.get('/plants/').then(r => r.data)
export const getHealthSummary = () => api.get('/plants/health-summary').then(r => r.data)
export const getPlant = (id) => api.get(`/plants/${id}`).then(r => r.data)
export const createPlant = (data) => api.post('/plants/', data).then(r => r.data)
export const updatePlant = (id, data) => api.patch(`/plants/${id}`, data).then(r => r.data)
export const deletePlant = (id) => api.delete(`/plants/${id}`)
export const uploadPlantPhoto = (id, file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post(`/plants/${id}/photo`, form).then(r => r.data)
}

export const searchSpecies = (q) => api.get('/plants/species/search', { params: { q } }).then(r => r.data)
export const getSpecies = (id, source = 'perenual') => api.get(`/plants/species/${id}`, { params: { source } }).then(r => r.data)
export const getWikiDescription = (scientificName) =>
  api.get('/plants/species/wiki-description', { params: { scientific_name: scientificName } }).then(r => r.data)

export const getAiCare = (commonName, scientificName) =>
  api.post('/plants/species/ai-care', { common_name: commonName, scientific_name: scientificName }).then(r => r.data)
