export type ThemeMode = 'desk' | 'aero'

export type WallpaperId =
  | 'none'
  | 'sierra'
  | 'sonoma'
  | 'harbor'
  | 'custom'

export type AppearancePrefs = {
  mode: ThemeMode
  wallpaperId: WallpaperId
  /** data: URL for uploaded image, if wallpaperId === 'custom' */
  customWallpaper: string | null
}

export const THEME_STORAGE_KEY = 'ashwick.appearance.v1'
export const MAX_WALLPAPER_BYTES = 1_800_000

export const BUILTIN_WALLPAPERS: {
  id: Exclude<WallpaperId, 'custom'>
  label: string
  /** CSS background-image value, or null for theme default atmosphere */
  css: string | null
}[] = [
  { id: 'none', label: 'Default', css: null },
  {
    id: 'sierra',
    label: 'Sierra',
    css: 'url(/wallpapers/sierra.svg)',
  },
  {
    id: 'sonoma',
    label: 'Sonoma',
    css: 'url(/wallpapers/sonoma.svg)',
  },
  {
    id: 'harbor',
    label: 'Harbor',
    css: 'url(/wallpapers/harbor.svg)',
  },
]

export function defaultAppearance(): AppearancePrefs {
  return {
    mode: 'desk',
    wallpaperId: 'none',
    customWallpaper: null,
  }
}

export function loadAppearance(): AppearancePrefs {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (!raw) return defaultAppearance()
    const parsed = JSON.parse(raw) as Partial<AppearancePrefs>
    const mode = parsed.mode === 'aero' ? 'aero' : 'desk'
    const wallpaperId =
      parsed.wallpaperId === 'sierra' ||
      parsed.wallpaperId === 'sonoma' ||
      parsed.wallpaperId === 'harbor' ||
      parsed.wallpaperId === 'custom'
        ? parsed.wallpaperId
        : 'none'
    const customWallpaper =
      typeof parsed.customWallpaper === 'string' ? parsed.customWallpaper : null
    return {
      mode,
      wallpaperId: wallpaperId === 'custom' && !customWallpaper ? 'none' : wallpaperId,
      customWallpaper,
    }
  } catch {
    return defaultAppearance()
  }
}

export function saveAppearance(prefs: AppearancePrefs): void {
  localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(prefs))
}

export function wallpaperCss(prefs: AppearancePrefs): string | null {
  if (prefs.wallpaperId === 'custom' && prefs.customWallpaper) {
    return `url("${prefs.customWallpaper}")`
  }
  const builtin = BUILTIN_WALLPAPERS.find((w) => w.id === prefs.wallpaperId)
  return builtin?.css ?? null
}

export function readWallpaperFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file.'))
      return
    }
    if (file.size > MAX_WALLPAPER_BYTES) {
      reject(new Error('Image too large — keep under ~1.8 MB.'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that image.'))
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Could not read that image.'))
        return
      }
      resolve(result)
    }
    reader.readAsDataURL(file)
  })
}
