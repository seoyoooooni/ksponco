import { MAT_TARGET, type TourStep } from './Tour'

const KEY = 'sunseat.tour.v1'

export function tourSeen(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    return true
  }
}

export function markTourSeen() {
  try {
    window.localStorage.setItem(KEY, '1')
  } catch {
    return
  }
}

export function tourSteps(event: boolean): TourStep[] {
  const touch = window.matchMedia('(pointer: coarse)').matches
  return [
    {
      target: null,
      title: '여기 앉아도 될까?',
      sheet: 0,
      body: '앉기 전에 그늘과 무대가 어떻게 보일지 미리 확인해요',
    },
    {
      target: '.placechip',
      title: '장소와 날짜 고르기',
      sheet: 0,
      body: '공연 있는 날엔 달력에 노란 점이 찍혀 있어요',
    },
    {
      target: '.icon-chip[aria-label="설정"]',
      title: '설정',
      sheet: 0,
      body: '다크 모드, 그래픽, 사용법 다시 보기는 여기 있어요',
    },
    {
      target: ['h1.headline', MAT_TARGET],
      title: '잔디를 눌러 자리 잡기',
      sheet: 1,
      body: touch
        ? '돗자리를 옮길 때마다 이 자리가 어떤지 바로 알려줘요. 두 손가락으로 돌려 볼 수도 있어요'
        : '돗자리를 옮길 때마다 이 자리가 어떤지 바로 알려줘요. 끌어서 돌려 볼 수도 있어요',
    },
    {
      target: '[role="group"][aria-label="찾는 자리"]',
      title: '그늘 / 볕 고르기',
      sheet: 2,
      body: '날씨 보고 골라 뒀어요. 마음대로 바꿔도 돼요',
    },
    event
      ? {
          target: '.fabs [aria-label="좋은 자리"]',
          title: '명당 한눈에 보기',
      sheet: 1,
          body: '무대가 잘 보이고 쾌적한 곳일수록 진한 파랑이에요',
        }
      : {
          target: '[role="group"][aria-label="머무는 시간"]',
          title: '얼마나 있을 거예요?',
      sheet: 2,
          body: '머무는 동안 해가 어떻게 움직이는지까지 계산해요',
        },
    {
      target: '.fabs [aria-label="내 시점으로 보기"]',
      title: '앉아서 보면 이래요',
      sheet: 1,
      body: '돗자리에 앉은 눈높이로 무대를 확인해요',
    },
    {
      target: '.fabs [aria-label="자리 공유"]',
      title: '친구 부르기',
      sheet: 1,
      body: '링크 하나면 친구도 같은 자리를 봐요',
    },
  ]
}
