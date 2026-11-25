import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js'

const SIZE = 256

let cached: HTMLCanvasElement | null = null

function grassCanvas() {
  if (cached) return cached
  let s = 20261126
  const noise = new SimplexNoise({
    random: () => {
      s = (s * 1664525 + 1013904223) >>> 0
      return s / 4294967296
    },
  })
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(SIZE, SIZE)
  const TAU = Math.PI * 2
  for (let j = 0; j < SIZE; j++) {
    for (let i = 0; i < SIZE; i++) {
      const a = (i / SIZE) * TAU
      const b = (j / SIZE) * TAU
      let v = 0
      let amp = 1
      let freq = 1
      let norm = 0
      for (let o = 0; o < 4; o++) {
        const r = freq / TAU
        v += amp * noise.noise4d(Math.cos(a) * r * 4, Math.sin(a) * r * 4, Math.cos(b) * r * 4, Math.sin(b) * r * 4)
        norm += amp
        amp *= 0.5
        freq *= 2.3
      }
      v /= norm
      const grain = (Math.random() - 0.5) * 0.04
      const k = Math.round(Math.min(1, Math.max(0, 0.93 + v * 0.07 + grain)) * 255)
      const p = (j * SIZE + i) * 4
      img.data[p] = k
      img.data[p + 1] = k
      img.data[p + 2] = k
      img.data[p + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  cached = canvas
  return canvas
}

export function grassTexture(repeatX: number, repeatY: number) {
  const tex = new CanvasTexture(grassCanvas())
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.repeat.set(repeatX, repeatY)
  tex.anisotropy = 4
  return tex
}
