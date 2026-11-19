import React from 'react'

export type BrandLogoSize = 'sm' | 'header' | 'md' | 'lg' | 'xl'

const SIZE_CLASSES: Record<BrandLogoSize, string> = {
  sm: 'h-9 w-[54px]',
  header: 'h-12 w-[72px]',
  md: 'h-12 w-[72px]',
  lg: 'h-16 w-[96px]',
  xl: 'h-20 w-[120px]',
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
      className={`inline-flex items-center justify-center bg-transparent overflow-hidden shrink-0 ${SIZE_CLASSES[size]} ${className}`}
    >
      <img
        src="/assets/aistudio/DRIVE_MITRA_e4e1a6d3.png"
        alt="DriveMitra"
        className="w-full h-full object-contain scale-[1.36] brightness-[1.04] contrast-[1.06] mix-blend-multiply select-none"
        draggable={false}
      />
    </span>
  )
}
