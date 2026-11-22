import { useEffect, useRef, useState } from 'react'
import {
  BUILTIN_WALLPAPERS,
  THEME_OPTIONS,
  type ThemeMode,
  type WallpaperId,
} from '../lib/theme'

type Props = {
  mode: ThemeMode
  wallpaperId: WallpaperId
  hasCustom: boolean
  onMode: (mode: ThemeMode) => void
  onWallpaper: (id: WallpaperId) => void
  onUpload: (file: File) => Promise<boolean>
  onClearCustom: () => void
  error: string | null
}

export function AppearanceControls({
  mode,
  wallpaperId,
  hasCustom,
  onMode,
  onWallpaper,
  onUpload,
  onClearCustom,
  error,
}: Props) {
  const [open, setOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="appearance-controls" ref={rootRef}>
      <div
        className="theme-switch"
        role="group"
        aria-label="UI theme"
      >
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`theme-switch-btn${mode === opt.id ? ' active' : ''}`}
            aria-pressed={mode === opt.id}
            title={opt.hint}
            onClick={() => onMode(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="wallpaper-menu">
        <button
          type="button"
          className={`pill pill-wall${open ? ' active' : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          Wallpaper
        </button>

        {open && (
          <div className="wallpaper-pop" role="dialog" aria-label="Wallpaper">
            <p className="wallpaper-pop-title">Background</p>
            <div className="wallpaper-grid">
              {BUILTIN_WALLPAPERS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  className={`wall-swatch${wallpaperId === w.id ? ' active' : ''}`}
                  onClick={() => onWallpaper(w.id)}
                >
                  <span
                    className={`wall-preview wall-${w.id}`}
                    aria-hidden
                    style={
                      w.css
                        ? {
                            backgroundImage: w.css,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }
                        : undefined
                    }
                  />
                  {w.label}
                </button>
              ))}
              <button
                type="button"
                className={`wall-swatch${wallpaperId === 'custom' ? ' active' : ''}`}
                onClick={() => fileRef.current?.click()}
              >
                <span className="wall-preview wall-custom" aria-hidden>
                  +
                </span>
                Upload
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void onUpload(file)
                e.target.value = ''
              }}
            />
            {hasCustom && (
              <button
                type="button"
                className="ghost-btn wall-clear"
                onClick={onClearCustom}
              >
                Clear uploaded image
              </button>
            )}
            {error && <p className="wall-error">{error}</p>}
            <p className="muted wall-hint">
              Theme + wallpaper save in localStorage. macOS Glass uses system
              fonts (−apple-system / SF Pro when available).
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
