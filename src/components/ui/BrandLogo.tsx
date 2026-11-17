import React from 'react'

export type BrandLogoSize = 'sm' | 'header' | 'md' | 'lg' | 'xl'

const SIZE_CLASSES: Record<BrandLogoSize, string> = {
  sm: 'h-9 w-[50px] rounded-[8px]',
  header: 'h-12 w-[66px] rounded-[10px]',
  md: 'h-12 w-[68px] rounded-[10px]',
  lg: 'h-16 w-[88px] rounded-xl',
  xl: 'h-20 w-[112px] rounded-2xl',
}

export function BrandLogo({
  size = 'header',
  className = '',
}: {
  size?: BrandLogoSize
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center justify-center bg-[#FFFFFF] overflow-hidden shrink-0 ${SIZE_CLASSES[size]} ${className}`}
    >
      <img
        src="/assets/aistudio/DRIVE_MITRA_e4e1a6d3.png"
        alt="DriveMitra"
        className="w-full h-full object-contain scale-[1.32] mix-blend-multiply select-none"
        draggable={false}
      />
    </span>
  )
}
