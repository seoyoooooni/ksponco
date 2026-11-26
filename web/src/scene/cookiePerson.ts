import { Matrix4 } from 'three'

export const COOKIE = {
  headR: 0.24,
  torsoR: 0.2,
  torsoLen: 0.24,
  limbR: 0.095,
  limbLen: 0.24,
  skin: '#f1d9c4',
}

export type CookieParts = {
  head: Matrix4
  torso: Matrix4
  limbs: [Matrix4, Matrix4, Matrix4, Matrix4]
}

export function cookieParts(): CookieParts {
  return { head: new Matrix4(), torso: new Matrix4(), limbs: [new Matrix4(), new Matrix4(), new Matrix4(), new Matrix4()] }
}

const base = new Matrix4()
const a = new Matrix4()
const b = new Matrix4()
const LIMB_HALF = COOKIE.limbLen / 2 + COOKIE.limbR

function limb(out: Matrix4, x: number, y: number, tiltZ: number, swingX: number, scale: number) {
  out.copy(base)
  out.multiply(a.makeTranslation(x, y, 0))
  if (tiltZ) out.multiply(b.makeRotationZ(tiltZ))
  if (swingX) out.multiply(b.makeRotationX(swingX))
  out.multiply(a.makeTranslation(0, -LIMB_HALF * scale, 0))
  if (scale !== 1) out.multiply(b.makeScale(scale, scale, scale))
}

export function poseCookie(out: CookieParts, x: number, y: number, z: number, yaw: number, seated: boolean, swing: number) {
  base.makeTranslation(x, y, z).multiply(a.makeRotationY(yaw))
  if (seated) {
    out.torso.copy(base).multiply(a.makeTranslation(0, 0.42, 0))
    out.head.copy(base).multiply(a.makeTranslation(0, 0.84, 0))
    limb(out.limbs[0], -0.11, 0.2, 0, -Math.PI / 2 + 0.15, 1)
    limb(out.limbs[1], 0.11, 0.2, 0, -Math.PI / 2 + 0.15, 1)
    limb(out.limbs[2], -0.25, 0.56, -0.45, -0.3, 0.85)
    limb(out.limbs[3], 0.25, 0.56, 0.45, -0.3, 0.85)
    return
  }
  out.torso.copy(base).multiply(a.makeTranslation(0, 0.66, 0))
  out.head.copy(base).multiply(a.makeTranslation(0, 1.08, 0))
  limb(out.limbs[0], -0.11, 0.44, 0, swing, 1)
  limb(out.limbs[1], 0.11, 0.44, 0, -swing, 1)
  limb(out.limbs[2], -0.25, 0.82, -0.5, -swing * 0.8, 0.85)
  limb(out.limbs[3], 0.25, 0.82, 0.5, swing * 0.8, 0.85)
}
