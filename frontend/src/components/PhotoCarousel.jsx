import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { format } from 'date-fns'

/**
 * Horizontal scrollable photo strip. Tapping a photo opens a fullscreen lightbox
 * where you can swipe between all photos.
 *
 * Props:
 *   photos  — array of { url: string, date: string, entryId: number }
 */
export default function PhotoCarousel({ photos }) {
  const [lightbox, setLightbox] = useState(null)
  const stripRef = useRef(null)
  const drag = useRef(null) // { startX, scrollLeft, moved }

  if (!photos.length) return null

  const onMouseDown = (e) => {
    drag.current = { startX: e.pageX, scrollLeft: stripRef.current.scrollLeft, moved: false }
    stripRef.current.style.cursor = 'grabbing'
  }
  const onMouseMove = (e) => {
    if (!drag.current) return
    const dx = e.pageX - drag.current.startX
    if (Math.abs(dx) > 4) drag.current.moved = true
    stripRef.current.scrollLeft = drag.current.scrollLeft - dx
  }
  const onMouseUp = () => {
    stripRef.current.style.cursor = ''
    // keep `moved` readable for the click handler, then clear after a tick
    setTimeout(() => { drag.current = null }, 0)
  }

  return (
    <>
      {/* ── Strip ── */}
      <div
        ref={stripRef}
        className="overflow-x-auto flex gap-2 px-4 pb-1 scrollbar-none cursor-grab select-none"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {photos.map((photo, i) => (
          <button
            key={photo.entryId}
            onClick={() => { if (!drag.current?.moved) setLightbox(i) }}
            className="shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800"
          >
            <img src={photo.url} className="w-full h-full object-cover" loading="lazy" draggable={false} />
          </button>
        ))}
      </div>

      {/* ── Lightbox ── */}
      {lightbox !== null && (
        <Lightbox photos={photos} initialIndex={lightbox} onClose={() => setLightbox(null)} />
      )}
    </>
  )
}

function Lightbox({ photos, initialIndex, onClose }) {
  const [index, setIndex] = useState(initialIndex)
  const [offset, setOffset] = useState(0)   // live drag in px
  const [sliding, setSliding] = useState(false)
  const [slideWidth, setSlideWidth] = useState(0)
  const wrapperRef = useRef(null)
  const pointerStart = useRef(null) // { x, y }

  // Measure the wrapper once and keep it up to date on resize
  useLayoutEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    setSlideWidth(el.offsetWidth)
    const ro = new ResizeObserver(() => setSlideWidth(el.offsetWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const goTo = (next) => {
    setIndex(Math.max(0, Math.min(next, photos.length - 1)))
    setOffset(0)
    setSliding(true)
  }

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight') goTo(index + 1)
      if (e.key === 'ArrowLeft')  goTo(index - 1)
      if (e.key === 'Escape')     onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [index])

  const onPointerDown = (e) => {
    if (e.button > 0) return
    pointerStart.current = { x: e.clientX, y: e.clientY }
    setSliding(false)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e) => {
    if (!pointerStart.current) return
    const dx = e.clientX - pointerStart.current.x
    // Rubber-band resistance at the edges
    const atStart = index === 0 && dx > 0
    const atEnd   = index === photos.length - 1 && dx < 0
    setOffset(atStart || atEnd ? dx * 0.2 : dx)
  }

  const onPointerUp = (e) => {
    if (!pointerStart.current) return
    const dx = e.clientX - pointerStart.current.x
    const dy = e.clientY - pointerStart.current.y
    pointerStart.current = null
    // Ignore vertical-dominant gestures so the page can scroll
    if (Math.abs(dy) > Math.abs(dx)) { setOffset(0); setSliding(true); return }
    const threshold = slideWidth * 0.25
    if      (dx < -threshold) goTo(index + 1)
    else if (dx >  threshold) goTo(index - 1)
    else { setOffset(0); setSliding(true) }
  }

  const photo = photos[index]
  const tx = slideWidth ? -index * slideWidth + offset : 0

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-white/60 text-sm">{index + 1} / {photos.length}</span>
        <span className="text-white/60 text-sm">
          {photo.date ? format(new Date(photo.date), 'MMM d, yyyy') : ''}
        </span>
        <button onClick={onClose} className="text-white/60 hover:text-white text-2xl leading-none">×</button>
      </div>

      {/* Slider wrapper — overflow hidden clips the adjacent photos.
          Handlers go here (full visible area) not on the inner track. */}
      <div
        ref={wrapperRef}
        className="flex-1 overflow-hidden min-h-0 relative"
        style={{ touchAction: 'pan-y', overscrollBehaviorX: 'contain' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="flex h-full"
          style={{
            width: `${photos.length * slideWidth}px`,
            transform: `translateX(${tx}px)`,
            transition: sliding ? 'transform 0.3s ease' : 'none',
            willChange: 'transform',
          }}
          onTransitionEnd={() => setSliding(false)}
        >
          {photos.map((p) => (
            <div
              key={p.entryId}
              style={{ width: slideWidth }}
              className="shrink-0 flex items-center justify-center px-4 h-full"
            >
              <img
                src={p.url}
                className="max-w-full max-h-full object-contain rounded-xl select-none"
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Arrow buttons (desktop) */}
      {index > 0 && (
        <button
          onClick={() => goTo(index - 1)}
          className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full w-10 h-10 items-center justify-center text-lg"
        >‹</button>
      )}
      {index < photos.length - 1 && (
        <button
          onClick={() => goTo(index + 1)}
          className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full w-10 h-10 items-center justify-center text-lg"
        >›</button>
      )}

      {/* Dot indicators */}
      {photos.length > 1 && (
        <div className="flex justify-center gap-1.5 py-4 shrink-0">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${i === index ? 'bg-white' : 'bg-white/30'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
