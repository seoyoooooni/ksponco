export type PersonStyleId = 'basic' | 'chibi' | 'pawn' | 'bean'

export type PersonStyle = {
  label: string
  body: { kind: 'cylinder'; top: number; bottom: number; segments: number } | { kind: 'capsule'; radius: number; length: number }
  bodyUnit: number
  span: (seated: boolean) => [number, number]
  head: { radius: number; y: (seated: boolean) => number; color: string | null } | null
}

export const personStyles: Record<PersonStyleId, PersonStyle> = {
  basic: {
    label: '기본',
    body: { kind: 'cylinder', top: 0.17, bottom: 0.2, segments: 6 },
    bodyUnit: 1,
    span: (s) => (s ? [0.12, 0.62] : [0.1, 1.42]),
    head: { radius: 0.12, y: (s) => (s ? 0.86 : 1.6), color: '#4a403a' },
  },
  chibi: {
    label: '꼬마',
    body: { kind: 'capsule', radius: 0.2, length: 0.4 },
    bodyUnit: 0.8,
    span: (s) => (s ? [0.06, 0.5] : [0.06, 0.92]),
    head: { radius: 0.27, y: (s) => (s ? 0.74 : 1.18), color: '#f1d9c4' },
  },
  pawn: {
    label: '게임 말',
    body: { kind: 'cylinder', top: 0.07, bottom: 0.27, segments: 14 },
    bodyUnit: 1,
    span: (s) => (s ? [0, 0.55] : [0, 1.1]),
    head: { radius: 0.17, y: (s) => (s ? 0.68 : 1.24), color: null },
  },
  bean: {
    label: '젤리빈',
    body: { kind: 'capsule', radius: 0.23, length: 0.6 },
    bodyUnit: 1.06,
    span: (s) => (s ? [0, 0.72] : [0, 1.3]),
    head: null,
  },
}

export const personStyleIds = Object.keys(personStyles) as PersonStyleId[]
