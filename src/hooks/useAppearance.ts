import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  loadAppearance,
  readWallpaperFile,
  saveAppearance,
  wallpaperCss,
  type AppearancePrefs,
  type ThemeMode,
  type WallpaperId,
} from '../lib/theme'

export function useAppearance() {
  const [prefs, setPrefs] = useState<AppearancePrefs>(() => loadAppearance())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    saveAppearance(prefs)
    document.documentElement.dataset.theme = prefs.mode
    document.body.dataset.theme = prefs.mode
  }, [prefs])

  const wallpaper = useMemo(() => wallpaperCss(prefs), [prefs])

  const setMode = useCallback((mode: ThemeMode) => {
    setPrefs((p) => ({ ...p, mode }))
  }, [])

  const toggleMode = useCallback(() => {
    setPrefs((p) => ({
      ...p,
      mode: p.mode === 'desk' ? 'aero' : 'desk',
    }))
  }, [])

  const setWallpaperId = useCallback((wallpaperId: WallpaperId) => {
    setError(null)
    setPrefs((p) => ({ ...p, wallpaperId }))
  }, [])

  const uploadWallpaper = useCallback(async (file: File) => {
    setError(null)
    try {
      const dataUrl = await readWallpaperFile(file)
      setPrefs((p) => ({
        ...p,
        wallpaperId: 'custom',
        customWallpaper: dataUrl,
      }))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      return false
    }
  }, [])

  const clearCustomWallpaper = useCallback(() => {
    setPrefs((p) => ({
      ...p,
      wallpaperId: p.wallpaperId === 'custom' ? 'none' : p.wallpaperId,
      customWallpaper: null,
    }))
  }, [])

  return {
    prefs,
    wallpaper,
    setMode,
    toggleMode,
    setWallpaperId,
    uploadWallpaper,
    clearCustomWallpaper,
    error,
    clearError: () => setError(null),
  }
}
