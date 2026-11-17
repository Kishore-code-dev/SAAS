import React, { useEffect, useState } from 'react'
import { Check, Copy, Mail, ShieldCheck, X } from 'lucide-react'
import { toast } from 'sonner'

export type FooterModalKey =
  | null
  | 'about'
  | 'stories'
  | 'blog'
  | 'api-docs'
  | 'help-center'
  | 'status'
  | 'whatsapp'
  | 'contact'
  | 'terms'
  | 'privacy'
  | 'cookies'
  | 'sla'
  | 'security'
  | 'social-linkedin'
  | 'social-x'
  | 'social-youtube'

interface StaticDocSpec {
  title: string
  subtitle: string
  sections: { heading: string; body: string }[]
  copyValue?: { label: string; value: string }
}

const STATIC_DOCS: Partial<Record<Exclude<FooterModalKey, null>, StaticDocSpec>> = {
  about: {
    title: 'About DriveMitra',
    subtitle: 'India’s first pure SaaS fleet intelligence platform.',
    sections: [
      {
        heading: 'Zero-Hardware Software Approach',
        body: 'DriveMitra eliminates mandatory OBD-II dongles and dedicated GPS hardware lock-ins. Commercial operators activate live fleet tracking, trip intelligence, and driver inspections directly from standard Android smartphones and dispatch consoles.',
      },
      {
        heading: 'Track Smarter. Predict Earlier. Operate Better.',
        body: 'Built for multi-city Indian freight, cold-chain, industrial, and EV delivery fleets, DriveMitra combines corridor stress profiling, UPI/card fuel verification, and 8-subsystem Remaining Useful Life (RUL) forecasting inside one multi-tenant system.',
      },
    ],
  },
  stories: {
    title: 'Customer Success Stories',
    subtitle: 'Operational outcomes across regional freight and electric delivery fleets.',
    sections: [
      {
        heading: 'Kaveri Logistics Pvt Ltd — Tamil Nadu Highway Corridors',
        body: 'Consolidated smartphone telemetry, workshop service logs, and preventive engine oil and brake scheduling across mixed commercial trucks, catching critical breakdown windows 4–10 days early.',
      },
      {
        heading: 'Deccan EV Cargo — Urban Last-Mile Electric Fleet',
        body: 'Unified kWh charging cost tracking alongside ICE comparison benchmarks, allowing dispatchers to quantify cost-per-kilometer advantages and schedule battery thermal checks proactively.',
      },
    ],
  },
  blog: {
    title: 'Fleet Management Blog',
    subtitle: 'Field notes on preventive maintenance, corridor wear, and fleet economics.',
    sections: [
      {
        heading: 'Calculating Cost-of-Delay Before a Highway Breakdown',
        body: 'Comparing planned bay intervention costs against emergency tow expenses, cargo penalties, and idle days across India’s high-load freight corridors.',
      },
      {
        heading: 'Why Smartphone Telematics Requires Driver Dispute Fairness',
        body: 'Separating genuine harsh braking from pothole-induced accelerometer spikes preserves trust while maintaining accurate corridor safety scoring.',
      },
    ],
  },
  'api-docs': {
    title: 'API Documentation',
    subtitle: 'REST endpoints and tenant-scoped integration interfaces.',
    sections: [
      {
        heading: 'GET /api/health',
        body: 'Returns live application service readiness and Copilot availability metadata for workspace monitoring.',
      },
      {
        heading: 'POST /api/copilot',
        body: 'Accepts tenant-scoped operational context, predictive maintenance logs, and natural-language queries with strict RBAC and cross-organization isolation checks.',
      },
      {
        heading: 'GPS & Inspection Payloads',
        body: 'Captures latitude, longitude, GPS accuracy in meters, timestamp freshness, trip status, and pre-trip driver inspection flags per organization ID.',
      },
    ],
  },
  'help-center': {
    title: 'Help Center & Knowledge Base',
    subtitle: 'Guides for dispatch managers, maintenance leads, finance teams, and drivers.',
    sections: [
      {
        heading: 'Smartphone Telemetry Setup',
        body: 'Sign in on the Driver App route, grant location permission, and keep battery optimization disabled during active corridor runs to avoid Stale telemetry alerts.',
      },
      {
        heading: '8-Subsystem Predictive Maintenance',
        body: 'Forecasts cover Engine Oil & Thermal, Brakes, Battery & Electrical, Tyres, Transmission, Cooling, Suspension, and Air Filter using mileage, service interval age, and inspection flags.',
      },
      {
        heading: 'Fuel Verification & Anomaly Review',
        body: 'UPI and fleet card logs flagged as Needs Review can be audited with odometer deltas before closing monthly TCO reports.',
      },
    ],
  },
  whatsapp: {
    title: 'WhatsApp Support',
    subtitle: 'Dedicated dispatch and driver onboarding assistance.',
    sections: [
      {
        heading: 'Fleet Onboarding & Driver Activation',
        body: 'Our India operations desk supports fleet managers and drivers Monday through Saturday (08:00–20:00 IST) for rapid vehicle twin imports and route configuration.',
      },
      {
        heading: 'Direct Support Channels',
        body: 'Reach enterprise onboarding at enterprise@drivemitra.in or general support at hello@drivemitra.in to link your organization WhatsApp dispatch group.',
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    subtitle: 'Enterprise subscription terms governing DriveMitra SaaS usage.',
    sections: [
      {
        heading: 'Platform License & Multi-Tenant Scope',
        body: 'Each organization account is granted a non-exclusive license to manage authorized fleet vehicles, drivers, maintenance logs, and financial records within its assigned organization boundary.',
      },
      {
        heading: 'Advisory Forecasting Disclaimer',
        body: 'Predictive maintenance windows estimate component wear from operational inputs and driver inspections; final roadworthiness sign-off remains with certified workshop technicians.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    subtitle: 'Transparent handling of fleet, driver, and trip telemetry.',
    sections: [
      {
        heading: 'Driver Location & Duty Boundaries',
        body: 'Smartphone GPS coordinates and motion events are recorded solely during active work dispatches and displayed with explicit freshness and meter-accuracy indicators.',
      },
      {
        heading: 'Tenant Isolation & Retention',
        body: 'Operational records, fuel logs, and maintenance histories remain isolated per fleet organization and are never shared across competing tenants.',
      },
    ],
  },
  sla: {
    title: 'Service Level Agreement (SLA)',
    subtitle: 'Enterprise reliability and incident response commitments.',
    sections: [
      {
        heading: 'Availability Target',
        body: 'DriveMitra targets 99.9% monthly availability for Command Centre dispatch workspaces, predictive maintenance scoring, and fleet ledger APIs.',
      },
      {
        heading: 'Incident Escalation',
        body: 'Priority operational support inquiries submitted to hello@drivemitra.in or enterprise@drivemitra.in receive initial engineering triage within business SLA windows.',
      },
    ],
  },
  security: {
    title: 'Data Security & Compliance',
    subtitle: 'Defense-in-depth protections for commercial fleet data.',
    sections: [
      {
        heading: 'Row-Level Tenant Isolation & RBAC',
        body: 'Every query enforces active organization ID scoping alongside role-based access control across Admin, Fleet Manager, Maintenance, Finance, and Driver roles.',
      },
      {
        heading: 'Auditability & Financial Integrity',
        body: 'Fuel anomaly flags, driver dispute resolutions, and maintenance status transitions preserve auditable timestamps without silent record tampering.',
      },
    ],
  },
  'social-linkedin': {
    title: 'DriveMitra on LinkedIn',
    subtitle: 'Company updates, customer deployments, and fleet engineering insights.',
    sections: [
      {
        heading: 'Official Company Page',
        body: 'Follow DriveMitra for product releases across India’s commercial freight, cold-chain, and EV cargo corridors.',
      },
    ],
    copyValue: { label: 'LinkedIn Handle', value: 'linkedin.com/company/drivemitra' },
  },
  'social-x': {
    title: 'DriveMitra on Twitter (X)',
    subtitle: 'Release notes, corridor intelligence briefs, and platform updates.',
    sections: [
      {
        heading: 'Official Handle',
        body: 'Connect with our product engineering and fleet operations team for timely SaaS updates.',
      },
    ],
    copyValue: { label: 'X (Twitter) Handle', value: '@drivemitra_in' },
  },
  'social-youtube': {
    title: 'DriveMitra on YouTube',
    subtitle: 'Platform walkthroughs, driver app training, and maintenance deep dives.',
    sections: [
      {
        heading: 'Video Onboarding Library',
        body: 'Watch step-by-step tutorials in English and regional languages on smartphone telematics setup and 8-subsystem predictive maintenance workflows.',
      },
    ],
    copyValue: { label: 'YouTube Channel', value: 'youtube.com/@DriveMitraOfficial' },
  },
}

const COOKIE_PREFS_KEY = 'drivemitra_cookie_prefs'

export function FooterModals({
  activeModal,
  onClose,
}: {
  activeModal: FooterModalKey
  onClose: () => void
}) {
  const [healthState, setHealthState] = useState<{
    loading: boolean
    ok?: boolean
    configured?: boolean
  }>(() => ({ loading: activeModal === 'status' }))

  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactMessage, setContactMessage] = useState('')
  const [contactSubmitted, setContactSubmitted] = useState(false)
  const [contactError, setContactError] = useState<string | null>(null)

  const [telemetryDiag, setTelemetryDiag] = useState(() => {
    try {
      const saved = localStorage.getItem(COOKIE_PREFS_KEY)
      return saved ? Boolean(JSON.parse(saved).telemetryDiag) : true
    } catch {
      return true
    }
  })
  const [analyticsOptIn, setAnalyticsOptIn] = useState(() => {
    try {
      const saved = localStorage.getItem(COOKIE_PREFS_KEY)
      return saved ? Boolean(JSON.parse(saved).analyticsOptIn) : false
    } catch {
      return false
    }
  })

  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (activeModal !== 'status') return
    let cancelled = false
    fetch('/api/health')
      .then((res) => res.json())
      .then((data: { ok?: boolean; configured?: boolean }) => {
        if (!cancelled) {
          setHealthState({
            loading: false,
            ok: Boolean(data.ok),
            configured: Boolean(data.configured),
          })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHealthState({ loading: false, ok: false, configured: false })
        }
      })
    return () => {
      cancelled = true
    }
  }, [activeModal])

  if (!activeModal) return null

  const staticDoc = STATIC_DOCS[activeModal]

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Copied to clipboard')
    } catch {
      toast.success(text)
    }
  }

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const cleanEmail = contactEmail.trim()
    if (!contactName.trim()) {
      setContactError('Please enter your name or organization.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setContactError('Please enter a valid work email address.')
      return
    }
    if (!contactMessage.trim()) {
      setContactError('Please include a brief note about your fleet requirements.')
      return
    }
    setContactError(null)
    setContactSubmitted(true)
    toast.success('Inquiry recorded for DriveMitra team')
  }

  const handleSaveCookies = () => {
    try {
      localStorage.setItem(
        COOKIE_PREFS_KEY,
        JSON.stringify({ essential: true, telemetryDiag, analyticsOptIn }),
      )
    } catch {
      // ignore storage quota failures
    }
    toast.success('Cookie preferences saved')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[#625346]/25 backdrop-blur-[1px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="DriveMitra Information"
    >
      <div className="w-full max-w-lg bg-[#FFFFFF] border border-[#E5E5E5] rounded-2xl shadow-elevated overflow-hidden">
        <div className="px-6 py-4 bg-[#EEE8F7] border-b border-[#DDD3ED] flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-[#625346]">
              {activeModal === 'status'
                ? 'System Status'
                : activeModal === 'contact'
                  ? 'Contact DriveMitra'
                  : activeModal === 'cookies'
                    ? 'Cookie Preferences'
                    : staticDoc?.title}
            </h3>
            <p className="text-xs text-[#958777] mt-0.5">
              {activeModal === 'status'
                ? 'Live operational readiness for platform services.'
                : activeModal === 'contact'
                  ? 'Enterprise Sales: enterprise@drivemitra.in · General Support: hello@drivemitra.in'
                  : activeModal === 'cookies'
                    ? 'Manage browser storage and diagnostic telemetry preferences.'
                    : staticDoc?.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-[#958777] hover:text-[#625346] hover:bg-[#E2D8F3]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
          {staticDoc && (
            <>
              {staticDoc.sections.map((section) => (
                <div
                  key={section.heading}
                  className="rounded-xl bg-[#FAFAFA] border border-[#E5E5E5] p-4"
                >
                  <p className="text-xs font-bold text-[#625346]">{section.heading}</p>
                  <p className="text-xs text-[#958777] mt-1.5 leading-relaxed">{section.body}</p>
                </div>
              ))}
              {staticDoc.copyValue && (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-[#FFFFFF] border border-[#DDD3ED] px-4 py-3">
                  <div>
                    <p className="text-[11px] text-[#958777]">{staticDoc.copyValue.label}</p>
                    <p className="text-xs font-semibold text-[#625346] mt-0.5">
                      {staticDoc.copyValue.value}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopy(staticDoc.copyValue!.value)}
                    className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}
            </>
          )}

          {activeModal === 'status' && (
            <div className="space-y-3">
              <div className="rounded-xl bg-[#FAFAFA] border border-[#E5E5E5] p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#625346]">Command Centre & Workspace API</p>
                  <p className="text-[11px] text-[#958777] mt-0.5">
                    Express server & fleet route availability
                  </p>
                </div>
                <span className="text-xs font-semibold text-[#4D6E4A]">
                  {healthState.loading ? 'Checking...' : healthState.ok ? 'Operational' : 'Offline'}
                </span>
              </div>
              <div className="rounded-xl bg-[#FAFAFA] border border-[#E5E5E5] p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#625346]">Predictive Maintenance Copilot</p>
                  <p className="text-[11px] text-[#958777] mt-0.5">
                    Server-side maintenance advisory endpoint
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold ${
                    healthState.configured ? 'text-[#4D6E4A]' : 'text-[#958777]'
                  }`}
                >
                  {healthState.loading
                    ? 'Checking...'
                    : healthState.configured
                      ? 'Ready'
                      : 'Key Required'}
                </span>
              </div>
            </div>
          )}

          {activeModal === 'contact' &&
            (contactSubmitted ? (
              <div className="rounded-xl bg-[#F3F8F2] border border-[#C6DBC3] p-5 text-center space-y-2">
                <ShieldCheck className="w-6 h-6 text-[#4D6E4A] mx-auto" />
                <p className="text-sm font-bold text-[#625346]">Inquiry Received</p>
                <p className="text-xs text-[#958777]">
                  Thank you, {contactName}. Our fleet specialists also respond directly at{' '}
                  <a
                    href="mailto:enterprise@drivemitra.in"
                    className="font-semibold text-[#625346] underline"
                  >
                    enterprise@drivemitra.in
                  </a>
                  .
                </p>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#625346] mb-1">
                    Name & Company
                  </label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="e.g. Rajesh Kumar · Kaveri Logistics"
                    className="dm-input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#625346] mb-1">
                    Work Email
                  </label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="ops@company.in"
                    className="dm-input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#625346] mb-1">
                    Fleet Scope & Inquiry
                  </label>
                  <textarea
                    rows={3}
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    placeholder="Share fleet size, vehicle types (ICE/EV), and maintenance goals..."
                    className="dm-input text-xs resize-none"
                  />
                </div>
                {contactError && <p className="text-xs font-medium text-[#B85245]">{contactError}</p>}
                <div className="flex items-center justify-between pt-2">
                  <a
                    href="mailto:hello@drivemitra.in"
                    className="text-xs font-medium text-[#6E5696] hover:underline inline-flex items-center gap-1.5"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    hello@drivemitra.in
                  </a>
                  <button type="submit" className="btn-primary text-xs py-2 px-4">
                    Send Inquiry
                  </button>
                </div>
              </form>
            ))}

          {activeModal === 'cookies' && (
            <div className="space-y-3">
              <div className="rounded-xl bg-[#FAFAFA] border border-[#E5E5E5] p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-[#625346]">Essential Session & Security</p>
                  <p className="text-[11px] text-[#958777] mt-0.5">
                    Required for active organization routing and authentication state.
                  </p>
                </div>
                <span className="text-xs font-semibold text-[#6E5696]">Always Active</span>
              </div>
              <label className="rounded-xl bg-[#FFFFFF] border border-[#E5E5E5] p-4 flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <p className="text-xs font-bold text-[#625346]">Telemetry Diagnostics</p>
                  <p className="text-[11px] text-[#958777] mt-0.5">
                    Retains map layer mode and workspace UI filter defaults locally.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={telemetryDiag}
                  onChange={(e) => setTelemetryDiag(e.target.checked)}
                  className="w-4 h-4 accent-[#6E5696]"
                />
              </label>
              <label className="rounded-xl bg-[#FFFFFF] border border-[#E5E5E5] p-4 flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <p className="text-xs font-bold text-[#625346]">Product Usage Insights</p>
                  <p className="text-[11px] text-[#958777] mt-0.5">
                    Helps improve predictive maintenance report workflows.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={analyticsOptIn}
                  onChange={(e) => setAnalyticsOptIn(e.target.checked)}
                  className="w-4 h-4 accent-[#6E5696]"
                />
              </label>
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveCookies}
                  className="btn-primary text-xs py-2 px-4"
                >
                  Save Preferences
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
