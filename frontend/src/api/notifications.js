import api from './client'

export const getVapidPublicKey = () => api.get('/notifications/vapid-public-key').then(r => r.data.public_key)

export const subscribeUser = (subscription) => api.post('/notifications/subscribe', {
  endpoint: subscription.endpoint,
  keys: {
    p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')))),
    auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')))),
  },
})

export const unsubscribeUser = (endpoint) => api.delete('/notifications/subscribe', { data: { endpoint } })
