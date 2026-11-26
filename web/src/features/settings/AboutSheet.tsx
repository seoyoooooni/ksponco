import { ModalSheet } from '../../ui/ModalSheet'
import { BrandMark } from '../../ui/BrandMark'

type Props = {
  open: boolean
  onClose: () => void
}

const HOW = [
  '잔디와 나무, 무대는 실측 3D 점군과 위성 영상으로 만들었어요',
  '고른 날짜·시각의 실제 해 위치로 나무와 무대 그림자를 계산해요',
  '앉은 눈높이에서 앞사람과 나무에 가리는 부분을 빼고, 무대가 몇 % 보이는지 알려줘요',
  '날씨는 기상청 예보, 공연 일정은 KOPIS 자료를 매일 받아 와요',
]

export function AboutSheet({ open, onClose }: Props) {
  return (
    <ModalSheet label="SunSeat 소개" open={open} onClose={onClose} placement="center" closeButton>
      <div className="about">
        <div className="about__head">
          <span className="about__logo">
            <BrandMark size={44} />
          </span>
          <h2 className="about__name">SunSeat</h2>
          <p className="about__lead">피크닉부터 페스티벌까지, 올림픽공원 잔디에 앉기 전 <br></br>자리를 미리 확인해보는 서비스이에요</p>
        </div>
        <section className="about__section" aria-label="어떻게 계산하나요">
          <h3>어떻게 계산하나요</h3>
          <ul>
            {HOW.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
        <p className="about__foot">2026 공공데이터 활용 경진대회 출품작</p>
      </div>
    </ModalSheet>
  )
}
