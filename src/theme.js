// Material 3 dynamic color, the Material You way: the whole tonal palette
// system is derived from a single seed color using Google's
// @material/material-color-utilities (the same engine Android's Monet uses —
// tonal-spot scheme: chroma 36/16/24 for primary/secondary/tertiary, 4/8 for
// neutral/neutral-variant). The error palette stays at spec baseline, as on
// Android. These palettes are applied through the library's reference-token
// system, so every component inherits the generated tones in light AND dark.
import { createTheme } from '@language-lit/material3-expressive/theme'
import { PALETTE_TOKEN_NAMES } from '@language-lit/material3-expressive/tokens'
import { argbFromHex, hexFromArgb, Hct, TonalPalette } from '@material/material-color-utilities'

export const SEED = '#6750A4' // M3 baseline seed — set anything here later
const BASELINE = '#6750a4'
const CHROMA = { primary: 36, secondary: 16, tertiary: 24, neutral: 4, 'neutral-variant': 8 }

export const buildTheme = seed => {
  // The spec's baseline palette is hand-tuned; its tone-40 literally equals the
  // seed hex. Computed HCT tones would drift slightly — so at baseline, keep
  // the library's exact spec tokens and only generate for custom seeds.
  if (seed.toLowerCase() === BASELINE) return createTheme()
  const hue = Hct.fromInt(argbFromHex(seed)).hue
  const palettes = new Map(
    Object.entries(CHROMA).map(([group, chroma]) => [group, TonalPalette.fromHueAndChroma(hue, chroma)]),
  )
  const palette = {}
  for (const name of PALETTE_TOKEN_NAMES) {
    const cut = name.lastIndexOf('-')
    const source = palettes.get(name.slice(0, cut))
    if (source) palette[name] = hexFromArgb(source.tone(Number(name.slice(cut + 1))))
  }
  return createTheme({ reference: { palette } })
}

export const appTheme = buildTheme(SEED)
