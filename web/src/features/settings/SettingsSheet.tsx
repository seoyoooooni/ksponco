import { ModalSheet } from '../../ui/ModalSheet'
import { Toggle } from '../../ui/Toggle'
import { BookIcon, ChevronRight, ClipboardIcon, ExternalIcon, HelpIcon, InfoIcon, MailIcon } from '../../ui/icons'
import { FEEDBACK_URL, type Quality, type ThemeMode } from './settings'

type Props = {
  open: boolean
  onClose: () => void
  theme: ThemeMode
  onTheme: (v: ThemeMode) => void
  quality: Quality
  onQuality: (v: Quality) => void
  onAbout: () => void
  operator: boolean
  onOperator: () => void
  onTour: (() => void) | null
  onSources: () => void
}

export function SettingsSheet(p: Props) {
  return (
    <ModalSheet label="설정" open={p.open} onClose={p.onClose} placement="center" closeButton>
      <div className="settings">
        <h2 className="settings__title">설정</h2>

        <div className="settings__group">
          <span className="settings__label">화면</span>
          <Toggle
            label="화면"
            value={p.theme}
            options={[
              { value: 'system', label: '시스템' },
              { value: 'light', label: '라이트' },
              { value: 'dark', label: '다크' },
            ]}
            onChange={p.onTheme}
          />
        </div>

        <div className="settings__group">
          <span className="settings__label">그래픽</span>
          <Toggle
            label="그래픽"
            value={p.quality}
            options={[
              { value: 'high', label: '높게' },
              { value: 'low', label: '가볍게' },
            ]}
            onChange={p.onQuality}
          />
        </div>

        <div className="settings__list">
          <button type="button" className="settings__row" onClick={p.onAbout}>
            <InfoIcon size={18} />
            <span className="settings__row-text">SunSeat 소개</span>
            <ChevronRight size={18} />
          </button>
          {p.onTour && (
            <button type="button" className="settings__row" onClick={p.onTour}>
              <HelpIcon size={18} />
              <span className="settings__row-text">사용법 다시 보기</span>
              <ChevronRight size={18} />
            </button>
          )}
          <button type="button" className="settings__row" onClick={p.onSources}>
            <BookIcon size={18} />
            <span className="settings__row-text">데이터 출처</span>
            <ChevronRight size={18} />
          </button>
          <button type="button" className="settings__row" onClick={p.onOperator}>
            <ClipboardIcon size={18} />
            <span className="settings__row-text">{p.operator ? '운영자 모드 끝내기' : '운영자 모드로 보기'}</span>
            <ChevronRight size={18} />
          </button>
          <a className="settings__row" href={FEEDBACK_URL}>
            <MailIcon size={18} />
            <span className="settings__row-text">의견 보내기</span>
            <ExternalIcon size={16} />
          </a>
        </div>
      </div>
    </ModalSheet>
  )
}
