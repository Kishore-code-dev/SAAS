import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { MAIN_NAV } from '../../config/nav.config'

function useCrumbs() {
  const { pathname } = useLocation()
  const clean = pathname.replace(/\/+$/, '') || '/'

  // Prefer exact leaf matches before prefix matches
  for (const e of MAIN_NAV) {
    const exactLeaf = e.children?.find((c) => clean === c.to)
    if (exactLeaf) {
      return [
        { label: e.label },
        { label: exactLeaf.label, to: exactLeaf.to },
      ]
    }
    if (e.to && e.to !== '/dashboard' && clean === e.to) {
      return [{ label: e.label, to: e.to }]
    }
  }

  for (const e of MAIN_NAV) {
    const sortedChildren = e.children
      ? [...e.children].sort((a, b) => b.to.length - a.to.length)
      : []
    const prefixLeaf = sortedChildren.find((c) => !c.end && clean.startsWith(`${c.to}/`))
      ?? sortedChildren.find((c) => clean.startsWith(`${c.to}/`))
    if (prefixLeaf) {
      return [
        { label: e.label },
        { label: prefixLeaf.label, to: prefixLeaf.to },
      ]
    }
    if (e.to && e.to !== '/dashboard' && clean.startsWith(`${e.to}/`)) {
      return [{ label: e.label, to: e.to }]
    }
  }
  return []
}

export default function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: ReactNode
  children?: ReactNode
}) {
  const crumbs = useCrumbs()
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[11px] font-medium text-[#958777] mb-1">
          <Link to="/dashboard" className="hover:text-[#6E5696]">Dashboard</Link>
          {crumbs.map((c, idx) => (
            <span key={`${idx}-${c.label}`} className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3" />
              {c.to ? <Link to={c.to} className="hover:text-[#6E5696]">{c.label}</Link> : <span>{c.label}</span>}
            </span>
          ))}
        </nav>
        <h1 className="dm-page-title">{title}</h1>
        {subtitle && <p className="text-sm text-[#958777] mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}
