import React, { useState } from 'react'

export function DhiyuLogo({
  size = 'sm',
  className = '',
}: {
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}) {
  const [imgFailed, setImgFailed] = useState(false)

  const dims: Record<'xs' | 'sm' | 'md' | 'lg', { box: string; img: string; text: string }> = {
    xs: { box: 'h-6 w-[56px]', img: 'h-6 w-full scale-[1.45]', text: 'text-xs' },
    sm: { box: 'h-7 w-[68px]', img: 'h-7 w-full scale-[1.45]', text: 'text-sm' },
    md: { box: 'h-9 w-[88px]', img: 'h-9 w-full scale-[1.42]', text: 'text-base' },
    lg: { box: 'h-12 w-[128px]', img: 'h-12 w-full scale-[1.38]', text: 'text-xl' },
  }

  const current = dims[size]

  if (imgFailed) {
    return (
      <span
        className={`inline-flex items-center justify-center font-extrabold text-[#625346] tracking-tight ${current.text} ${className}`}
      >
        Dhiyu
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center justify-center bg-transparent overflow-hidden shrink-0 ${current.box} ${className}`}
    >
      <img
        src="/assets/aistudio/image_d72ca97f.png"
        alt="Dhiyu Fleet Management AI"
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className={`${current.img} object-contain brightness-[1.04] contrast-[1.06] mix-blend-multiply select-none`}
        draggable={false}
      />
    </span>
  )
}

export function DhiyuAvatarMark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#EEE8F7] border border-[#DDD3ED] overflow-hidden shrink-0 ${className}`}
      aria-hidden="true"
    >
      <img
        src="/assets/aistudio/image_d72ca97f.png"
        alt=""
        className="w-6 h-6 object-contain scale-[1.9] brightness-[1.04] contrast-[1.06] mix-blend-multiply select-none"
        draggable={false}
      />
    </span>
  )
}
