import { useMemo, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, X } from 'lucide-react'
import { SETTINGS_BASE, SETTINGS_NAV } from '../../config/settings.nav.config'

export default function SettingsSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return SETTINGS_NAV
    return SETTINGS_NAV.map((s) => ({
      ...s,
      links: s.links.filter((l) => l.label.toLowerCase().includes(q) || s.title.toLowerCase().includes(q)),
    })).filter((s) => s.links.length > 0)
  }, [query])

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-[#625346]/20 backdrop-blur-[1px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[268px] bg-[#EEE8F7] border-r border-[#DDD3ED] flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 shrink-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 pt-4 pb-3 border-b border-[#DDD3ED] shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6E5696] hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Dashboard
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation menu"
              className="lg:hidden p-1.5 rounded-lg text-[#625346] hover:bg-[#E2D8F3]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <h2 className="text-2xl font-bold text-[#625346]">Settings</h2>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#958777]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search settings"
              aria-label="Search settings"
              className="w-full pl-8 pr-2.5 py-1.5 rounded-[8px] border border-[#DDD3ED] bg-white text-[13px] text-[#625346] placeholder:text-[#958777] focus:outline-none focus:border-[#B8A3D9]"
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-custom px-3 py-4 space-y-5" aria-label="Settings navigation">
          {sections.map((s) => {
            const Icon = s.icon
            return (
              <div key={s.id}>
                <p className="px-2.5 mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#958777]">
                  <Icon className="w-3.5 h-3.5" />
                  {s.title}
                </p>
                <div className="space-y-0.5 ml-[18px] pl-3 border-l border-[#DDD3ED]">
                  {s.links.map((l) => (
                    <NavLink
                      key={l.slug}
                      to={`${SETTINGS_BASE}/${l.slug}`}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `block px-2.5 py-1.5 rounded-[10px] text-[13px] border transition-colors ${
                          isActive
                            ? 'bg-[#E1D7F2] text-[#6E5696] font-semibold border-[#B8A3D9] shadow-subtle'
                            : 'text-[#625346] font-medium border-transparent hover:bg-white/70'
                        }`
                      }
                    >
                      {l.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            )
          })}
          {sections.length === 0 && <p className="px-2.5 text-xs text-[#958777]">No matching settings.</p>}
        </nav>
      </aside>
    </>
  )
}
