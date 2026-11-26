import { useEffect, useState } from 'react'
import { ModalSheet } from '../../ui/ModalSheet'
import { BubbleIcon, CheckIcon, LinkIcon, ShareIcon } from '../../ui/icons'
import { canNativeShare, copyLink, kakaoShare, nativeShare, OG_TITLE, preloadKakao } from '../../lib/share'

type Props = {
  open: boolean
  onClose: () => void
  url: string
  message: string
  onNotice: (text: string) => void
}

export function ShareSheet({ open, onClose, url, message, onNotice }: Props) {
  const [copied, setCopied] = useState(false)
  const native = canNativeShare()

  useEffect(() => {
    if (!open) return
    setCopied(false)
    preloadKakao()
  }, [open])

  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(t)
  }, [copied])

  const toKakao = async () => {
    const r = await kakaoShare(url, OG_TITLE, message)
    if (r === 'shared') onClose()
    else if (r === 'copied') onNotice('메시지와 링크를 복사했어요. 카카오톡에 붙여 넣어 주세요')
    else if (r === 'failed') onNotice('카카오톡을 열지 못했어요')
  }

  const toCopy = async () => {
    if (await copyLink(url)) setCopied(true)
    else onNotice('링크를 복사하지 못했어요')
  }

  const toOther = async () => {
    const r = await nativeShare(url, OG_TITLE, message)
    if (r === 'shared') onClose()
    else if (r === 'failed') onNotice('공유하지 못했어요')
  }

  return (
    <ModalSheet label="이 자리 보내기" open={open} onClose={onClose} placement="center" closeButton>
      <div className="share">
        <div className="share__head">
          <h2 className="share__title">이 자리 보내기</h2>
          <p className="share__desc">받은 친구도 같은 자리, 같은 시간으로 보여요</p>
        </div>

        <div className="share__apps">
          <button type="button" className="share__app" onClick={toKakao}>
            <span className="share__icon share__icon--kakao">
              <BubbleIcon size={22} />
            </span>
            카카오톡
          </button>
          <button type="button" className="share__app" onClick={toCopy}>
            <span className="share__icon">{copied ? <CheckIcon size={20} /> : <LinkIcon size={20} />}</span>
            {copied ? '복사했어요' : '링크 복사'}
          </button>
          {native && (
            <button type="button" className="share__app" onClick={toOther}>
              <span className="share__icon">
                <ShareIcon size={20} />
              </span>
              더보기
            </button>
          )}
        </div>
      </div>
    </ModalSheet>
  )
}
