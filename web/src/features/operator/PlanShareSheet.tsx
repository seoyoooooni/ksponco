import { useEffect, useRef, useState } from 'react'
import { ModalSheet } from '../../ui/ModalSheet'
import { CheckIcon, DownloadIcon, LinkIcon, ShareIcon, UploadIcon } from '../../ui/icons'
import { canNativeShare, copyLink, nativeShare, OG_TITLE } from '../../lib/share'
import { downloadText, emptyPlan, parsePlanFile, planFileName, planFileText, planUrl, type PlanFile, type SharedPlan } from '../../lib/planShare'

type Props = {
  open: boolean
  onClose: () => void
  file: PlanFile
  placeLabel: string
  onImport: (f: PlanFile) => void
  onNotice: (text: string) => void
}

function summary(p: SharedPlan): string {
  if (emptyPlan(p)) return '비어 있어요'
  const parts = [`그늘막 ${p.tents.length}개`, `출입 금지 ${p.zones.length}곳`]
  if (p.palms.length) parts.push(`야자매트 ${p.palms.length}곳`)
  return parts.join(' · ')
}

export function PlanShareSheet({ open, onClose, file, placeLabel, onImport, onNotice }: Props) {
  const [copied, setCopied] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const native = canNativeShare()
  const empty = emptyPlan(file.plans.A) && emptyPlan(file.plans.B) && file.sold === null

  useEffect(() => {
    if (open) setCopied(false)
  }, [open])

  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(t)
  }, [copied])

  const url = planUrl(file)
  const message = `${placeLabel} 운영 계획이에요`

  const toCopy = async () => {
    if (await copyLink(url)) setCopied(true)
    else onNotice('링크를 복사하지 못했어요')
  }

  const toOther = async () => {
    const r = await nativeShare(url, OG_TITLE, message)
    if (r === 'shared') onClose()
    else if (r === 'failed') onNotice('보내지 못했어요')
  }

  const toFile = () => {
    downloadText(planFileName(file), planFileText(file))
    onNotice('계획 파일을 저장했어요')
  }

  const fromFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const plan = f.size < 1_000_000 ? parsePlanFile(await f.text()) : null
    if (!plan) return onNotice('SunSeat 운영 계획 파일이 아니에요')
    onImport(plan)
    onClose()
  }

  return (
    <ModalSheet label="운영 계획 보내기·저장" open={open} onClose={onClose} placement="center" closeButton>
      <div className="share">
        <div className="share__head">
          <h2 className="share__title">운영 계획 보내기·저장</h2>
          <p className="share__desc">{placeLabel}의 <br/>A안·B안과 판매 예정 인원을 같이 보내요</p>
        </div>

        <dl className="plan-summary">
          <div>
            <dt>A안</dt>
            <dd>{summary(file.plans.A)}</dd>
          </div>
          <div>
            <dt>B안</dt>
            <dd>{summary(file.plans.B)}</dd>
          </div>
          <div>
            <dt>판매 예정</dt>
            <dd>{file.sold === null ? '입력 안 함' : `${file.sold.toLocaleString('ko-KR')}명`}</dd>
          </div>
        </dl>

        <div className="share__apps share__apps--tight">
          <button type="button" className="share__app" onClick={toCopy} disabled={empty}>
            <span className="share__icon">{copied ? <CheckIcon size={20} /> : <LinkIcon size={20} />}</span>
            {copied ? '복사했어요' : '링크 복사'}
          </button>
          {native && (
            <button type="button" className="share__app" onClick={toOther} disabled={empty}>
              <span className="share__icon">
                <ShareIcon size={20} />
              </span>
              보내기
            </button>
          )}
          <button type="button" className="share__app" onClick={toFile} disabled={empty}>
            <span className="share__icon">
              <DownloadIcon size={20} />
            </span>
            파일 저장
          </button>
          <button type="button" className="share__app" onClick={() => input.current?.click()}>
            <span className="share__icon">
              <UploadIcon size={20} />
            </span>
            파일 열기
          </button>
        </div>
        <input ref={input} type="file" accept="application/json,.json" hidden onChange={fromFile} />

        {empty && <p className="plan-note">아직 보낼 계획이 없어요. 파일 열기로 받은 계획을 불러올 수는 있어요.</p>}
      </div>
    </ModalSheet>
  )
}
