// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Radix UI / shadcn Select relies on ResizeObserver (not available in JSDOM by default)
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = ResizeObserverMock
}

// matchMedia (Radix UI / responsive hooks)
if (typeof window !== 'undefined' && typeof window.matchMedia === 'undefined') {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

// IntersectionObserver (often used by virtualized components / Next patterns)
if (typeof global.IntersectionObserver === 'undefined') {
  global.IntersectionObserver = class IntersectionObserverMock {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
}

// scrollTo (jsdom doesn't implement)
if (typeof window !== 'undefined' && typeof window.scrollTo === 'undefined') {
  window.scrollTo = () => {}
}








