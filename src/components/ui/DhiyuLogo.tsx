import React, { useState } from 'react'

export function DhiyuLogo({
  size = 'sm',
  className = '',
}: {
  size?: 'xs' | 'sm' | 'md'
  className?: string
}) {
  const [imgFailed, setImgFailed] = useState(false)

  const dims: Record<'xs' | 'sm' | 'md', { box: string; img: string; text: string }> = {
    xs: { box: 'px-2 py-1 rounded-[8px]', img: 'h-4 w-auto', text: 'text-xs' },
    sm: { box: 'px-2.5 py-1 rounded-[10px]', img: 'h-5 w-auto', text: 'text-sm' },
    md: { box: 'px-3 py-1.5 rounded-[10px]', img: 'h-6 w-auto', text: 'text-base' },
  }

  const current = dims[size]

  if (imgFailed) {
    return (
      <span
        className={`inline-flex items-center justify-center bg-[#FFFFFF] border border-[#DDD3ED] font-extrabold text-[#625346] tracking-tight ${current.box} ${current.text} ${className}`}
      >
        Dhiyu
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center justify-center bg-[#FFFFFF] border border-[#DDD3ED] overflow-hidden shrink-0 ${current.box} ${className}`}
    >
      <img
        src="/assets/aistudio/image_d72ca97f.png"
        alt="Dhiyu Fleet Management AI"
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className={`${current.img} object-contain mix-blend-multiply select-none`}
      />
    </span>
  )
}
