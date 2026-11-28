import { MAT_TARGET, type TourStep } from './Tour'

const KEY = 'sunseat.tour.v1'
export const OP_TOUR_KEY = 'sunseat.tour.op.v1'

export function tourSeen(key = KEY): boolean {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return true
  }
}

export function markTourSeen(key = KEY) {
  try {
    window.localStorage.setItem(key, '1')
  } catch {
    return
  }
}

export function operatorTourSteps(wet: boolean): TourStep[] {
  return [
    {
      target: null,
      title: '운영자 모드예요',
      sheet: 1,
      body: '그늘막과 출입 통제를 설치하기 전에, 관객에게 어떤 효과가 있는지 숫자로 미리 봐요',
    },
    {
      target: '.op-tools',
      title: '도구 고르고 잔디 누르기',
      sheet: 1,
      body: wet
        ? '그늘막은 누르면 놓이고 끌어서 옮겨요. 출입 금지 구역과 야자매트는 두 꼭짓점을 눌러 그려요'
        : '그늘막은 누르면 놓이고 끌어서 옮겨요. 출입 금지 구역은 두 꼭짓점을 눌러 그려요',
    },
    {
      target: '.op-stats',
      title: '놓을 때마다 다시 계산해요',
      sheet: 1,
      body: '수용 상한, 그늘을 더 얻는 관객, 무대가 가려지는 관객이 바로 바뀌어요. 판매 예정 인원을 넣으면 초과 여부도 보여요',
    },
    {
      target: '[role="group"][aria-label="계획 안"]',
      title: 'A안 · B안 비교',
      sheet: 1,
      body: 'A안과 B안을 따로 꾸미고, 비교에서 두 안의 차이를 한 표로 봐요',
    },
    {
      target: '.op-suggest',
      title: '어디에 둘지 모르겠다면',
      sheet: 2,
      body: '그늘을 얻는 사람은 많고 무대가 가려지는 사람은 적은 자리를 골라 그늘막을 놓아 줘요',
    },
    {
      target: '.op-layers',
      title: '지도에서 확인',
      sheet: 2,
      body: '초록은 그늘이 새로 생기는 자리, 빨강은 무대가 가려지는 자리예요',
    },
    {
      target: '.op-share',
      title: '팀과 같은 계획 보기',
      sheet: 2,
      body: '링크나 파일로 내보내면 팀원이 같은 A안·B안을 열어 봐요. 숫자 계산 기준은 바로 아래에 있어요',
    },
  ]
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
      body: '다크 모드, 그래픽, 사용법 다시 보기, 운영자 모드는 여기 있어요',
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
