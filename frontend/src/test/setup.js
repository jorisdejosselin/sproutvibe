import '@testing-library/jest-dom'

// Node.js 24+ defines a limited `localStorage` global that lacks the full
// Storage interface. Replace it with a proper in-memory implementation so
// all tests can rely on getItem / setItem / removeItem / clear.
let _store = {}
globalThis.localStorage = {
  getItem: (key) => Object.prototype.hasOwnProperty.call(_store, key) ? _store[key] : null,
  setItem: (key, value) => { _store[key] = String(value) },
  removeItem: (key) => { delete _store[key] },
  clear: () => { _store = {} },
  get length() { return Object.keys(_store).length },
  key: (i) => Object.keys(_store)[i] ?? null,
}

afterEach(() => {
  _store = {}
})
