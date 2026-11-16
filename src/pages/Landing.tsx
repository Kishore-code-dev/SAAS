import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  BarChart3,
  Check,
  Compass,
  Fuel,
  Menu,
  ShieldAlert,
  Smartphone,
  Truck,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { SUBSCRIPTION_PLANS } from '../data/seedOrganizations'
import { useFleet } from '../hooks/useFleet'
import { useAuth, validateEmailFormat } from '../hooks/useAuth'
import { EnterpriseModal, formatInr } from '../components/ui/EnterprisePrimitives'

export default function Landing() {
  const navigate = useNavigate()
  const { submitDemoRequest, setEnvironment } = useFleet()
  const { enterDemoSession } = useAuth()

  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [demoModalOpen, setDemoModalOpen] = useState(false)
  const [selectedPlanName, setSelectedPlanName] = useState<string>('Growth')
  const [formState, setFormState] = useState({
    fullName: '',
    workEmail: '',
    companyName: '',
    fleetSize: '15–50 vehicles',
    phone: '',
    notes: '',
  })
  const [submittedRequest, setSubmittedRequest] = useState(false)

  const handleExploreDemo = () => {
    setEnvironment('demo')
    enterDemoSession({
      fullName: 'Karthikeyan R',
      email: 'karthikeyan@kaverilogistics.in',
      role: 'fleet_manager',
      isDemo: true,
    })
    navigate('/dashboard')
  }

  const handleOpenDemoModal = (plan = 'Growth') => {
    setSelectedPlanName(plan)
    setSubmittedRequest(false)
    setDemoModalOpen(true)
  }

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formState.fullName.trim() || !validateEmailFormat(formState.workEmail) || !formState.companyName.trim()) {
      toast.error('Please enter your name, valid work email, and company name.')
      return
    }
    submitDemoRequest({
      ...formState,
      notes: `${selectedPlanName ? `[Plan interest: ${selectedPlanName}] ` : ''}${formState.notes}`.trim(),
    })
    setSubmittedRequest(true)
    toast.success('Demo request recorded. Our fleet solutions team will follow up.')
  }

  const platformModules = [
    {
      icon: Truck,
      title: 'Fleet Intelligence & Digital Twins',
      description:
        'Unify registration, insurance, odometer, component health, maintenance ledger, and active trip status inside each vehicle profile.',
    },
    {
      icon: Smartphone,
      title: 'Smartphone Telematics',
      description:
        'Capture GPS location, speed profiles, trip stops, and driver motion events via standard Android/web devices with zero mandatory tracker hardware.',
    },
    {
      icon: Wrench,
      title: 'Predictive Maintenance Engine',
      description:
        'Estimate component failure windows across 8 vehicle subsystems using mileage, service history, road stress, and inspection reports.',
    },
    {
      icon: Users,
      title: 'Driver Intelligence & Fairness',
      description:
        'Explainable safety scores adjusted for corridor road stress and GPS quality, paired with a transparent event dispute workflow.',
    },
    {
      icon: Fuel,
      title: 'Fuel & Charging Verification',
      description:
        'Track UPI, fleet card, cash, and EV charging spend with automated duplicate flagging and cost-per-kilometer variance checks.',
    },
    {
      icon: BarChart3,
      title: 'Financial Control & ICE vs EV',
      description:
        'Analyze fuel, maintenance, and estimated downtime exposure across every vehicle, with direct ICE and electric TCO comparisons.',
    },
  ]

  const industryApplications = [
    {
      sector: 'Regional Freight & Distribution',
      detail: 'Monitor multi-city highway corridors, catch overdue service intervals early, and quantify delay costs per idle day.',
    },
    {
      sector: 'Last-Mile & EV Cargo Fleets',
      detail: 'Track battery state of health, charging spend per kWh, regenerative braking behavior, and ICE-to-EV unit cost savings.',
    },
    {
      sector: 'Cold Chain & Perishables',
      detail: 'Identify unplanned highway halts, stale telemetry gaps, and mechanical risks before time-sensitive cargo dispatches.',
    },
    {
      sector: 'Industrial & Construction Supply',
      detail: 'Factor high-stress corridor conditions, pothole indices, and payload wear into proactive suspension and brake scheduling.',
    },
  ]

  return (
    <div className="min-h-screen bg-[#F7F0D9] text-[#625346]">
      {/* Top Bar Contract: 3 exact zones separated by gap-8 */}
      <header className="sticky top-0 z-40 bg-[#FBF6E6]/95 backdrop-blur border-b border-[#E0D4B7]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <Link
            to="/"
            className="text-lg font-extrabold tracking-tight text-[#625346] whitespace-nowrap shrink-0"
          >
            DriveMitra
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#7D6D5F]" aria-label="Primary navigation">
            <a href="#platform" className="hover:text-[#625346] hover:underline underline-offset-4 whitespace-nowrap shrink-0">
              Platform
            </a>
            <a href="#predictive" className="hover:text-[#625346] hover:underline underline-offset-4 whitespace-nowrap shrink-0">
              Predictive AI
            </a>
            <a href="#solutions" className="hover:text-[#625346] hover:underline underline-offset-4 whitespace-nowrap shrink-0">
              Solutions
            </a>
            <a href="#pricing" className="hover:text-[#625346] hover:underline underline-offset-4 whitespace-nowrap shrink-0">
              Pricing
            </a>
            <Link to="/auth" className="hover:text-[#625346] hover:underline underline-offset-4 whitespace-nowrap shrink-0">
              Sign In
            </Link>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleOpenDemoModal('Growth')}
              className="btn-accent text-xs sm:text-sm"
            >
              Request Demo
            </button>
            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
              className="md:hidden p-2 rounded-[10px] text-[#625346] hover:bg-[#EEE8F7]"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div className="md:hidden border-t border-[#E0D4B7] bg-[#FBF6E6] px-6 py-4 space-y-3">
            <a href="#platform" onClick={() => setMobileNavOpen(false)} className="block text-sm font-medium text-[#625346]">
              Platform
            </a>
            <a href="#predictive" onClick={() => setMobileNavOpen(false)} className="block text-sm font-medium text-[#625346]">
              Predictive AI
            </a>
            <a href="#solutions" onClick={() => setMobileNavOpen(false)} className="block text-sm font-medium text-[#625346]">
              Solutions
            </a>
            <a href="#pricing" onClick={() => setMobileNavOpen(false)} className="block text-sm font-medium text-[#625346]">
              Pricing
            </a>
            <Link to="/auth" onClick={() => setMobileNavOpen(false)} className="block text-sm font-semibold text-[#6E5696]">
              Sign In
            </Link>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="py-16 lg:py-24 border-b border-[#D4C7E6] bg-[#EEE8F7]">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center">
            <p className="text-xs font-semibold text-[#6E5696] uppercase tracking-wider mb-4">
              Enterprise Fleet Intelligence · Smartphone Telematics
            </p>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-[#625346] leading-[1.12] tracking-tight">
              Your Fleet. Your Intelligence. Your Competitive Advantage.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-[#625346]/85 max-w-xl leading-relaxed">
              Monitor vehicle operations, anticipate maintenance requirements, and transform everyday fleet data into smarter operational and financial decisions.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <button type="button" onClick={handleExploreDemo} className="btn-accent py-3 px-6">
                Explore Platform
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleOpenDemoModal('Growth')}
                className="btn-secondary py-3 px-6"
              >
                Request a Demo
              </button>
            </div>
            <p className="mt-6 text-xs text-[#7D6D5F]">
              No dedicated GPS hardware required to start · Multi-organization RLS isolation · Supports ICE and EV commercial fleets
            </p>
          </div>

          {/* Authentic Interactive Platform Preview */}
          <div className="lg:col-span-6 flex">
            <div className="w-full bg-[#F4EBD5] border border-[#D4C7E6] rounded-2xl p-6 shadow-card flex flex-col justify-between">
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#E0D4B7]">
                <div>
                  <p className="text-xs font-semibold text-[#7D6D5F]">Command Centre Snapshot · Sample Demo Fleet</p>
                  <p className="font-bold text-base text-[#625346] mt-0.5">
                    Kaveri Logistics Pvt Ltd
                  </p>
                </div>
                <span className="text-xs font-semibold text-[#625346] bg-[#E8C65A]/45 border border-[#C9A63B] px-2.5 py-1 rounded-[8px]">
                  DEMO WORKSPACE
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 my-5">
                <div className="bg-[#FBF6E6] border border-[#E0D4B7] rounded-xl p-3.5">
                  <p className="text-xs text-[#7D6D5F]">Fleet Health Avg</p>
                  <p className="text-2xl font-bold text-[#625346] tabular-nums mt-1">67%</p>
                </div>
                <div className="bg-[#FBF6E6] border border-[#E0D4B7] rounded-xl p-3.5">
                  <p className="text-xs text-[#7D6D5F]">Active Trips</p>
                  <p className="text-2xl font-bold text-[#6E5696] tabular-nums mt-1">3</p>
                </div>
                <div className="bg-[#FBF6E6] border border-[#E0D4B7] rounded-xl p-3.5">
                  <p className="text-xs text-[#7D6D5F]">Priority Reviews</p>
                  <p className="text-2xl font-bold text-[#625346] tabular-nums mt-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#D9786C] inline-block" />
                    2
                  </p>
                </div>
              </div>

              <div className="bg-[#FBF6E6] border border-[#D4C7E6] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-[#625346] inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#D9786C]" />
                      Critical Maintenance Window · 6–10 Days
                    </p>
                    <p className="text-sm font-bold text-[#625346] mt-0.5">
                      TN 30 EF 9012 · Engine Oil & Thermal Stress
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#625346] bg-[#EEE8F7] border border-[#B8A3D9] px-2 py-0.5 rounded tabular-nums">
                    Conf. 87%
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[#E0D4B7] text-xs">
                  <div>
                    <span className="text-[#7D6D5F] block">Preventive Est.</span>
                    <span className="font-semibold text-[#625346] tabular-nums">{formatInr(4800)}</span>
                  </div>
                  <div>
                    <span className="text-[#7D6D5F] block">Delay Exposure</span>
                    <span className="font-semibold text-[#625346] tabular-nums inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#D9786C]" />
                      {formatInr(62800)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#7D6D5F] block">Est. Savings</span>
                    <span className="font-semibold text-[#625346] tabular-nums inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#789A75]" />
                      {formatInr(58000)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-[#E0D4B7] flex items-center justify-between text-xs text-[#7D6D5F]">
                <span>From Fleet Tracking to Fleet Intelligence</span>
                <button
                  type="button"
                  onClick={handleExploreDemo}
                  className="font-semibold text-[#625346] hover:text-[#6E5696] hover:underline inline-flex items-center gap-1"
                >
                  Open Live Demo
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Architecture & Smartphone Telematics */}
      <section id="platform" className="py-16 lg:py-20 bg-[#F7F0D9]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[#6E5696] uppercase tracking-wider">Unified Operating Architecture</p>
            <h2 className="dm-section-title text-3xl mt-2">
              Eight integrated intelligence modules sharing one operational record
            </h2>
            <p className="text-[#7D6D5F] mt-3 text-base">
              Every organization, vehicle digital twin, driver profile, trip route, fuel transaction, and maintenance log updates the same underlying system.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {platformModules.map((mod) => {
              const Icon = mod.icon
              return (
                <div key={mod.title} className="enterprise-card p-6 flex flex-col justify-between hover:bg-[#FBF6E6] transition-colors">
                  <div>
                    <div className="w-10 h-10 rounded-[10px] bg-[#EEE8F7] border border-[#B8A3D9] text-[#6E5696] flex items-center justify-center mb-4">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="dm-card-title">{mod.title}</h3>
                    <p className="text-sm text-[#7D6D5F] mt-2 leading-relaxed">{mod.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Predictive Maintenance & Smartphone Honesty */}
      <section id="predictive" className="py-16 lg:py-20 bg-[#EEE8F7] border-y border-[#D4C7E6]">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-6">
            <p className="text-xs font-semibold text-[#6E5696] uppercase tracking-wider">Flagship Predictive Maintenance</p>
            <h2 className="dm-section-title text-3xl mt-2">
              Explainable wear windows built on verifiable operational inputs
            </h2>
            <p className="text-[#625346]/85 mt-3 leading-relaxed">
              DriveMitra never claims a smartphone sensor can directly measure internal brake pads or engine oil viscosity. Instead, our deterministic and machine-learning baseline models combine verifiable signals to prioritize workshop scheduling before roadside breakdowns occur.
            </p>
            <div className="mt-6 space-y-3 text-sm text-[#625346]">
              <div className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-[#4D6E4A] mt-0.5 shrink-0" />
                <span>Vehicle age, cumulative odometer, and daily utilization intensity</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-[#4D6E4A] mt-0.5 shrink-0" />
                <span>Recorded service intervals, parts history, and driver pre-trip inspection flags</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-[#4D6E4A] mt-0.5 shrink-0" />
                <span>Corridor road-stress indices, ambient heat exposure, and driving event rates</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-[#4D6E4A] mt-0.5 shrink-0" />
                <span>Transparent confidence intervals, model version tags, and delay-cost comparisons</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 enterprise-card p-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#E0D4B7]">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#6E5696]" />
                <span className="font-semibold text-sm text-[#625346]">
                  Fleet Risk & Telemetry Integrity Safeguards
                </span>
              </div>
              <Compass className="w-4 h-4 text-[#7D6D5F]" />
            </div>
            <div className="mt-4 space-y-4 text-sm">
              <div className="bg-[#FBF6E6] border border-[#E0D4B7] rounded-[10px] p-4">
                <p className="font-semibold text-[#625346]">Honest Telemetry Freshness</p>
                <p className="text-[#7D6D5F] text-xs mt-1">
                  Coordinates older than 5 minutes are marked Stale or Offline with exact GPS accuracy in meters—never misrepresented as live tracking.
                </p>
              </div>
              <div className="bg-[#FBF6E6] border border-[#E0D4B7] rounded-[10px] p-4">
                <p className="font-semibold text-[#625346]">Driver Dispute Fairness</p>
                <p className="text-[#7D6D5F] text-xs mt-1">
                  Drivers can challenge accelerometer spikes caused by potholes or loose dashboard mounts; approved disputes are excluded from safety penalties.
                </p>
              </div>
              <div className="bg-[#FBF6E6] border border-[#E0D4B7] rounded-[10px] p-4">
                <p className="font-semibold text-[#625346]">Neutral Fuel Anomaly Review</p>
                <p className="text-[#7D6D5F] text-xs mt-1">
                  Duplicate entries or efficiency drops are flagged as Needs Review with supporting odometer math rather than automated accusations.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Industry Solutions */}
      <section id="solutions" className="py-16 lg:py-20 bg-[#F7F0D9]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[#6E5696] uppercase tracking-wider">Commercial Fleet Fit</p>
            <h2 className="dm-section-title text-3xl mt-2">
              Built for multi-city Indian commercial and mixed EV operations
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            {industryApplications.map((item) => (
              <div key={item.sector} className="enterprise-card p-6 hover:bg-[#FBF6E6] transition-colors">
                <h3 className="dm-card-title text-lg">{item.sector}</h3>
                <p className="text-sm text-[#7D6D5F] mt-2 leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 lg:py-20 bg-[#EEE8F7] border-t border-[#D4C7E6]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[#6E5696] uppercase tracking-wider">Transparent Licensing</p>
            <h2 className="dm-section-title text-3xl mt-2">
              Predictable pricing per active fleet organization
            </h2>
            <p className="text-[#7D6D5F] mt-2 text-sm">
              Start with a repeatable Demo or Pilot workspace before onboarding your production fleet.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {SUBSCRIPTION_PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-xl p-6 flex flex-col justify-between border shadow-card ${
                  plan.id === 'growth'
                    ? 'bg-[#FBF6E6] text-[#625346] border-2 border-[#E8C65A]'
                    : 'bg-[#F4EBD5] text-[#625346] border-[#E0D4B7]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-bold text-[#625346]">{plan.name}</h3>
                    {plan.id === 'growth' && (
                      <span className="text-xs font-semibold text-[#625346] bg-[#E8C65A]/45 border border-[#C9A63B] px-2.5 py-0.5 rounded-[8px]">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-1.5 text-[#7D6D5F]">{plan.tagline}</p>
                  <div className="mt-5 pb-5 border-b border-[#E0D4B7]">
                    {plan.monthlyInr !== null ? (
                      <p className="text-3xl font-bold tabular-nums text-[#625346]">
                        {formatInr(plan.monthlyInr)}
                        <span className="text-xs font-normal ml-1 text-[#7D6D5F]">
                          / month
                        </span>
                      </p>
                    ) : (
                      <p className="text-2xl font-bold text-[#625346]">Custom Contract</p>
                    )}
                  </div>
                  <ul className="mt-5 space-y-2.5 text-sm">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <Check className="w-4 h-4 mt-0.5 shrink-0 text-[#4D6E4A]" />
                        <span className="text-[#625346]">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenDemoModal(plan.name)}
                  className={`mt-8 w-full ${plan.id === 'growth' ? 'btn-accent' : 'btn-secondary'}`}
                >
                  {plan.monthlyInr === null ? 'Contact Enterprise Sales' : `Request ${plan.name} Pilot`}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA & Footer */}
      <section className="py-14 bg-[#F4EBD5] border-t border-[#E0D4B7] text-[#625346]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#625346]">
              Ready to move from reactive repairs to fleet intelligence?
            </h2>
            <p className="text-[#625346]/80 text-sm mt-1.5">
              Launch the interactive Demo Workspace immediately or request a guided pilot onboarding.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleExploreDemo}
              className="btn-accent py-2.5 px-5"
            >
              Launch Demo Workspace
            </button>
            <button
              type="button"
              onClick={() => handleOpenDemoModal('Growth')}
              className="btn-secondary py-2.5 px-5"
            >
              Request Demo
            </button>
          </div>
        </div>
      </section>

      <footer className="bg-[#FBF6E6] border-t border-[#E0D4B7] py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#7D6D5F]">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#6E5696]" />
            <span className="font-semibold text-[#625346]">DriveMitra</span>
            <span>·</span>
            <span>Enterprise Fleet Intelligence Platform</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#platform" className="hover:text-[#625346]">Platform</a>
            <a href="#predictive" className="hover:text-[#625346]">Predictive AI</a>
            <a href="#pricing" className="hover:text-[#625346]">Pricing</a>
            <Link to="/auth" className="hover:text-[#625346]">Sign In</Link>
            <Link to="/driver" className="hover:text-[#625346]">Driver App</Link>
          </div>
        </div>
      </footer>

      {/* Request Demo Modal */}
      <EnterpriseModal
        open={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
        title="Request a DriveMitra Fleet Pilot"
        subtitle={`Selected plan interest: ${selectedPlanName} · Timezone: Asia/Kolkata`}
      >
        {submittedRequest ? (
          <div className="py-4 space-y-4">
            <div className="p-4 rounded-[10px] bg-[#789A75]/20 border border-[#789A75] text-[#625346] text-sm">
              Thank you, <strong>{formState.fullName}</strong>. Your pilot request for{' '}
              <strong>{formState.companyName}</strong> has been logged.
            </div>
            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={() => setDemoModalOpen(false)} className="btn-secondary">
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setDemoModalOpen(false)
                  handleExploreDemo()
                }}
                className="btn-accent"
              >
                Explore Demo Workspace Now
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleDemoSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="demo-name" className="dm-label">Full Name *</label>
                <input
                  id="demo-name"
                  required
                  value={formState.fullName}
                  onChange={(e) => setFormState((s) => ({ ...s, fullName: e.target.value }))}
                  placeholder="Karthikeyan R"
                  className="dm-input"
                />
              </div>
              <div>
                <label htmlFor="demo-email" className="dm-label">Work Email *</label>
                <input
                  id="demo-email"
                  type="email"
                  required
                  value={formState.workEmail}
                  onChange={(e) => setFormState((s) => ({ ...s, workEmail: e.target.value }))}
                  placeholder="ops@company.in"
                  className="dm-input"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="demo-company" className="dm-label">Organization Name *</label>
                <input
                  id="demo-company"
                  required
                  value={formState.companyName}
                  onChange={(e) => setFormState((s) => ({ ...s, companyName: e.target.value }))}
                  placeholder="Kaveri Logistics Pvt Ltd"
                  className="dm-input"
                />
              </div>
              <div>
                <label htmlFor="demo-size" className="dm-label">Fleet Size</label>
                <select
                  id="demo-size"
                  value={formState.fleetSize}
                  onChange={(e) => setFormState((s) => ({ ...s, fleetSize: e.target.value }))}
                  className="dm-input"
                >
                  <option value="5–15 vehicles">5–15 vehicles</option>
                  <option value="15–50 vehicles">15–50 vehicles</option>
                  <option value="50–200 vehicles">50–200 vehicles</option>
                  <option value="200+ vehicles">200+ vehicles</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="demo-phone" className="dm-label">Phone Number</label>
              <input
                id="demo-phone"
                value={formState.phone}
                onChange={(e) => setFormState((s) => ({ ...s, phone: e.target.value }))}
                placeholder="+91 98400 00000"
                className="dm-input"
              />
            </div>
            <div>
              <label htmlFor="demo-notes" className="dm-label">Operational Priorities</label>
              <textarea
                id="demo-notes"
                rows={3}
                value={formState.notes}
                onChange={(e) => setFormState((s) => ({ ...s, notes: e.target.value }))}
                placeholder="Predictive maintenance, fuel auditing, EV transition..."
                className="dm-input"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={() => setDemoModalOpen(false)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn-accent">
                Submit Request
              </button>
            </div>
          </form>
        )}
      </EnterpriseModal>
    </div>
  )
}
