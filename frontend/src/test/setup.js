import '@testing-library/jest-dom'

// Node.js 24+ defines a limited `localStorage` global that lacks the full
// Storage interface. Replace it with a proper in-memory implementation so
// all tests can rely on getItem / setItem / removeItem / clear.
//
// defineProperty rather than assignment: from vitest 5 the environment
// installs localStorage as a getter-only accessor, and plain assignment
// throws "Cannot set property localStorage of [object Window] which has only
// a getter" before any test runs.
let _store = {}
const _localStorage = {
  getItem: (key) => Object.prototype.hasOwnProperty.call(_store, key) ? _store[key] : null,
  setItem: (key, value) => { _store[key] = String(value) },
  removeItem: (key) => { delete _store[key] },
  clear: () => { _store = {} },
  get length() { return Object.keys(_store).length },
  key: (i) => Object.keys(_store)[i] ?? null,
}

Object.defineProperty(globalThis, 'localStorage', {
  value: _localStorage,
  configurable: true,
  writable: true,
})

afterEach(() => {
  _store = {}
})
