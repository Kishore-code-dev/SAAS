import { useMemo, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, X } from 'lucide-react'
import { SETTINGS_BASE, SETTINGS_NAV } from '../../config/settings.nav.config'
import { useAuth } from '../../hooks/useAuth'
import { useFleet } from '../../hooks/useFleet'

export default function SettingsSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { activeOrganization, members } = useFleet()
  const [query, setQuery] = useState('')

  const resolvedSections = useMemo(() => {
    const withTitles = SETTINGS_NAV.map((s) => ({
      ...s,
      displayTitle:
        s.titleDynamic === 'user'
          ? (user?.fullName ?? s.title)
          : s.titleDynamic === 'org'
            ? activeOrganization.name
            : s.title,
    }))

    const q = query.trim().toLowerCase()
    if (!q) return withTitles
    return withTitles
      .map((s) => ({
        ...s,
        links: s.links.filter(
          (l) => l.label.toLowerCase().includes(q) || s.displayTitle.toLowerCase().includes(q),
        ),
      }))
      .filter((s) => s.links.length > 0)
  }, [activeOrganization.name, query, user?.fullName])

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[272px] bg-[#FFFFFF] border-r border-[#E5E5E5] flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 shrink-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-4 pt-4 pb-3 border-b border-[#E5E5E5] shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6E5696] hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to DriveMitra
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation menu"
              className="lg:hidden p-1.5 rounded-lg text-[#625346] hover:bg-[#EEE8F7]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <h2 className="text-[22px] font-bold text-[#625346] tracking-tight">Settings</h2>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#958777]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search settings"
              className="w-full pl-8 pr-2.5 py-1.5 rounded-[10px] border border-[#E5E5E5] bg-[#FAFAFA] text-[13px] text-[#625346] placeholder:text-[#958777] focus:bg-white focus:outline-none focus:border-[#B8A3D9]"
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-custom px-3 py-4 space-y-5" aria-label="Settings navigation">
          {resolvedSections.map((s) => {
            const Icon = s.icon
            return (
              <div key={s.id}>
                <p className="px-2 mb-1.5 flex items-center gap-2 text-[11.5px] font-bold text-[#625346]">
                  <Icon className="w-3.5 h-3.5 text-[#6E5696] shrink-0" />
                  <span className="truncate">{s.displayTitle}</span>
                </p>
                <div className="space-y-0.5 ml-2 pl-3 border-l border-[#E5E5E5]">
                  {s.links.map((l) => (
                    <NavLink
                      key={l.slug}
                      to={`${SETTINGS_BASE}/${l.slug}`}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[8px] text-[12.5px] transition-colors ${
                          isActive
                            ? 'bg-[#EEE8F7] text-[#625346] font-semibold border border-[#DDD3ED]'
                            : 'text-[#625346]/85 font-medium hover:bg-[#FAFAFA] hover:text-[#625346] border border-transparent'
                        }`
                      }
                    >
                      <span className="truncate">{l.label}</span>
                      {l.countKey === 'members' && (
                        <span className="text-[11px] font-semibold text-[#958777] tabular-nums">
                          ({members.length})
                        </span>
                      )}
                      {l.badge && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#EEE8F7] text-[#6E5696] border border-[#DDD3ED] shrink-0">
                          {l.badge}
                        </span>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            )
          })}
          {resolvedSections.length === 0 && <p className="px-2.5 text-xs text-[#958777]">No matching settings.</p>}
        </nav>
      </aside>
    </>
  )
}
