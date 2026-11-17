import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Check,
  Compass,
  Cpu,
  Fuel,
  Layers,
  Linkedin,
  Menu,
  ShieldAlert,
  Smartphone,
  Users,
  X,
  Youtube,
} from 'lucide-react'
import { SUBSCRIPTION_PLANS } from '../data/seedOrganizations'
import { formatInr } from '../components/ui/EnterprisePrimitives'
import { BrandLogo } from '../components/ui/BrandLogo'
import { FooterModals, type FooterModalKey } from '../components/landing/FooterModals'

export default function Landing() {
  const navigate = useNavigate()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [footerModal, setFooterModal] = useState<FooterModalKey>(null)

  const handleBegin = () => {
    navigate('/auth')
  }

  const platformModules = [
    {
      icon: Layers,
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
      icon: Cpu,
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
    <div className="min-h-screen bg-[#FFFFFF] text-[#625346]">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-[#FFFFFF]/95 backdrop-blur border-b border-[#E5E5E5]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <Link
            to="/"
            aria-label="DriveMitra"
            className="flex items-center shrink-0"
          >
            <BrandLogo size="header" />
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#958777]" aria-label="Primary navigation">
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
              onClick={handleBegin}
              className="btn-primary text-xs sm:text-sm"
            >
              Begin
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
          <div className="md:hidden border-t border-[#E5E5E5] bg-[#FFFFFF] px-6 py-4 space-y-3">
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
      <section className="py-16 lg:py-24 border-b border-[#DDD3ED] bg-[#EEE8F7]">
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
            <p className="mt-6 text-xs text-[#958777]">
              No dedicated GPS hardware required to start · Multi-organization RLS isolation · Supports ICE and EV commercial fleets
            </p>
          </div>

          {/* Authentic Interactive Platform Preview */}
          <div className="lg:col-span-6 flex">
            <div className="w-full bg-[#FFFFFF] border border-[#DDD3ED] rounded-2xl p-6 shadow-card flex flex-col justify-between">
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#E5E5E5]">
                <div>
                  <p className="text-xs font-semibold text-[#958777]">Command Centre Snapshot</p>
                  <p className="font-bold text-base text-[#625346] mt-0.5">
                    Kaveri Logistics Pvt Ltd
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 my-5">
                <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-xl p-3.5">
                  <p className="text-xs text-[#958777]">Fleet Health Avg</p>
                  <p className="text-2xl font-bold text-[#625346] tabular-nums mt-1">67%</p>
                </div>
                <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-xl p-3.5">
                  <p className="text-xs text-[#958777]">Active Trips</p>
                  <p className="text-2xl font-bold text-[#6E5696] tabular-nums mt-1">3</p>
                </div>
                <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-xl p-3.5">
                  <p className="text-xs text-[#958777]">Priority Reviews</p>
                  <p className="text-2xl font-bold text-[#625346] tabular-nums mt-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#D9786C] inline-block" />
                    2
                  </p>
                </div>
              </div>

              <div className="bg-[#FFFFFF] border border-[#DDD3ED] rounded-xl p-4 space-y-3">
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
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[#E5E5E5] text-xs">
                  <div>
                    <span className="text-[#958777] block">Preventive Est.</span>
                    <span className="font-semibold text-[#625346] tabular-nums">{formatInr(4800)}</span>
                  </div>
                  <div>
                    <span className="text-[#958777] block">Delay Exposure</span>
                    <span className="font-semibold text-[#625346] tabular-nums inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#D9786C]" />
                      {formatInr(62800)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#958777] block">Est. Savings</span>
                    <span className="font-semibold text-[#625346] tabular-nums inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#789A75]" />
                      {formatInr(58000)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Architecture & Smartphone Telematics */}
      <section id="platform" className="py-16 lg:py-20 bg-[#FFFFFF]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[#6E5696] uppercase tracking-wider">Unified Operating Architecture</p>
            <h2 className="dm-section-title text-3xl mt-2">
              Eight integrated intelligence modules sharing one operational record
            </h2>
            <p className="text-[#958777] mt-3 text-base">
              Every organization, vehicle digital twin, driver profile, trip route, fuel transaction, and maintenance log updates the same underlying system.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {platformModules.map((mod) => {
              const Icon = mod.icon
              return (
                <div key={mod.title} className="enterprise-card p-6 flex flex-col justify-between hover:bg-[#FFFFFF] transition-colors">
                  <div>
                    <div className="w-10 h-10 rounded-[10px] bg-[#EEE8F7] border border-[#B8A3D9] text-[#6E5696] flex items-center justify-center mb-4">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="dm-card-title">{mod.title}</h3>
                    <p className="text-sm text-[#958777] mt-2 leading-relaxed">{mod.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Predictive Maintenance & Smartphone Honesty */}
      <section id="predictive" className="py-16 lg:py-20 bg-[#EEE8F7] border-y border-[#DDD3ED]">
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
            <div className="flex items-center justify-between pb-4 border-b border-[#E5E5E5]">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#6E5696]" />
                <span className="font-semibold text-sm text-[#625346]">
                  Fleet Risk & Telemetry Integrity Safeguards
                </span>
              </div>
              <Compass className="w-4 h-4 text-[#958777]" />
            </div>
            <div className="mt-4 space-y-4 text-sm">
              <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[10px] p-4">
                <p className="font-semibold text-[#625346]">Honest Telemetry Freshness</p>
                <p className="text-[#958777] text-xs mt-1">
                  Coordinates older than 5 minutes are marked Stale or Offline with exact GPS accuracy in meters—never misrepresented as live tracking.
                </p>
              </div>
              <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[10px] p-4">
                <p className="font-semibold text-[#625346]">Driver Dispute Fairness</p>
                <p className="text-[#958777] text-xs mt-1">
                  Drivers can challenge accelerometer spikes caused by potholes or loose dashboard mounts; approved disputes are excluded from safety penalties.
                </p>
              </div>
              <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[10px] p-4">
                <p className="font-semibold text-[#625346]">Neutral Fuel Anomaly Review</p>
                <p className="text-[#958777] text-xs mt-1">
                  Duplicate entries or efficiency drops are flagged as Needs Review with supporting odometer math rather than automated accusations.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Industry Solutions */}
      <section id="solutions" className="py-16 lg:py-20 bg-[#FFFFFF]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[#6E5696] uppercase tracking-wider">Commercial Fleet Fit</p>
            <h2 className="dm-section-title text-3xl mt-2">
              Built for multi-city Indian commercial and mixed EV operations
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            {industryApplications.map((item) => (
              <div key={item.sector} className="enterprise-card p-6 hover:bg-[#FFFFFF] transition-colors">
                <h3 className="dm-card-title text-lg">{item.sector}</h3>
                <p className="text-sm text-[#958777] mt-2 leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 lg:py-20 bg-[#EEE8F7] border-t border-[#DDD3ED]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[#6E5696] uppercase tracking-wider">Transparent Licensing</p>
            <h2 className="dm-section-title text-3xl mt-2">
              Predictable pricing per active fleet organization
            </h2>
            <p className="text-[#958777] mt-2 text-sm">
              Start with a flexible workspace and scale seamlessly across your commercial fleet.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {SUBSCRIPTION_PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-xl p-6 flex flex-col justify-between border shadow-card ${
                  plan.id === 'growth'
                    ? 'bg-[#FFFFFF] text-[#625346] border-2 border-[#E8C65A]'
                    : 'bg-[#FAFAFA] text-[#625346] border-[#E5E5E5]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-bold text-[#625346]">{plan.name}</h3>
                    {plan.id === 'growth' && (
                      <span className="text-xs font-semibold text-[#625346] bg-[#E8C65A]/45 border border-[#D8B442] px-2.5 py-0.5 rounded-[8px]">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-1.5 text-[#958777]">{plan.tagline}</p>
                  <div className="mt-5 pb-5 border-b border-[#E5E5E5]">
                    {plan.monthlyInr !== null ? (
                      <p className="text-3xl font-bold tabular-nums text-[#625346]">
                        {formatInr(plan.monthlyInr)}
                        <span className="text-xs font-normal ml-1 text-[#958777]">
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
                  onClick={handleBegin}
                  className={`mt-8 w-full ${plan.id === 'growth' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  Begin
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#FFFFFF] border-t border-[#E5E5E5] pt-14 pb-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_1.15fr_1fr] gap-8 lg:gap-10">
            {/* Column 1: Brand & Core Promise */}
            <div className="space-y-4">
              <Link to="/" aria-label="DriveMitra" className="inline-flex items-center shrink-0">
                <BrandLogo size="sm" />
              </Link>
              <div className="space-y-1.5">
                <p className="text-sm font-bold text-[#625346]">
                  Track Smarter. Predict Earlier. Operate Better.
                </p>
                <p className="text-xs text-[#958777] leading-relaxed max-w-xs">
                  India’s first pure SaaS fleet intelligence platform.
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1" aria-label="Social media channels">
                <button
                  type="button"
                  onClick={() => setFooterModal('social-linkedin')}
                  aria-label="DriveMitra on LinkedIn"
                  className="w-9 h-9 rounded-[10px] bg-[#FFFFFF] border border-[#E5E5E5] text-[#625346] hover:bg-[#EEE8F7] hover:border-[#B8A3D9] flex items-center justify-center transition-colors"
                >
                  <Linkedin className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setFooterModal('social-x')}
                  aria-label="DriveMitra on Twitter (X)"
                  className="w-9 h-9 rounded-[10px] bg-[#FFFFFF] border border-[#E5E5E5] text-[#625346] hover:bg-[#EEE8F7] hover:border-[#B8A3D9] flex items-center justify-center transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setFooterModal('social-youtube')}
                  aria-label="DriveMitra on YouTube"
                  className="w-9 h-9 rounded-[10px] bg-[#FFFFFF] border border-[#E5E5E5] text-[#625346] hover:bg-[#EEE8F7] hover:border-[#B8A3D9] flex items-center justify-center transition-colors"
                >
                  <Youtube className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Column 2: Platform (Product) */}
            <div>
              <h3 className="text-xs font-bold text-[#625346] mb-3.5">Platform (Product)</h3>
              <ul className="space-y-2.5 text-xs text-[#958777]">
                <li>
                  <Link to="/dashboard" className="hover:text-[#625346] hover:underline underline-offset-4">
                    Executive Dashboard
                  </Link>
                </li>
                <li>
                  <a href="#platform" className="hover:text-[#625346] hover:underline underline-offset-4">
                    Smartphone Telematics
                  </a>
                </li>
                <li>
                  <a href="#predictive" className="hover:text-[#625346] hover:underline underline-offset-4">
                    Predictive Maintenance
                  </a>
                </li>
                <li>
                  <Link to="/dashboard/fleet" className="hover:text-[#625346] hover:underline underline-offset-4">
                    Vehicle Digital Twin
                  </Link>
                </li>
                <li>
                  <Link to="/dashboard/drivers" className="hover:text-[#625346] hover:underline underline-offset-4">
                    Driver & Safety Intelligence
                  </Link>
                </li>
                <li>
                  <Link to="/dashboard/financials" className="hover:text-[#625346] hover:underline underline-offset-4">
                    Financial & Fuel Intelligence
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Company & Resources */}
            <div>
              <h3 className="text-xs font-bold text-[#625346] mb-3.5">Company & Resources</h3>
              <ul className="space-y-2.5 text-xs text-[#958777]">
                <li>
                  <button
                    type="button"
                    onClick={() => setFooterModal('about')}
                    className="text-left hover:text-[#625346] hover:underline underline-offset-4"
                  >
                    About DriveMitra
                  </button>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-[#625346] hover:underline underline-offset-4">
                    Pricing & Plans
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setFooterModal('stories')}
                    className="text-left hover:text-[#625346] hover:underline underline-offset-4"
                  >
                    Customer Success Stories
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setFooterModal('blog')}
                    className="text-left hover:text-[#625346] hover:underline underline-offset-4"
                  >
                    Fleet Management Blog
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setFooterModal('api-docs')}
                    className="text-left hover:text-[#625346] hover:underline underline-offset-4"
                  >
                    API Documentation
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 4: Support & Contact */}
            <div>
              <h3 className="text-xs font-bold text-[#625346] mb-3.5">Support & Contact</h3>
              <ul className="space-y-2.5 text-xs text-[#958777]">
                <li>
                  <button
                    type="button"
                    onClick={() => setFooterModal('help-center')}
                    className="text-left hover:text-[#625346] hover:underline underline-offset-4"
                  >
                    Help Center & Knowledge Base
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setFooterModal('status')}
                    className="text-left hover:text-[#625346] hover:underline underline-offset-4"
                  >
                    System Status
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setFooterModal('whatsapp')}
                    className="text-left hover:text-[#625346] hover:underline underline-offset-4"
                  >
                    WhatsApp Support
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setFooterModal('contact')}
                    className="text-left hover:text-[#625346] hover:underline underline-offset-4"
                  >
                    Contact Us
                  </button>
                </li>
                <li className="pt-1">
                  <span className="block text-[11px] text-[#958777]">Enterprise Sales</span>
                  <a
                    href="mailto:enterprise@drivemitra.in"
                    className="font-semibold text-[#625346] hover:underline underline-offset-4"
                  >
                    enterprise@drivemitra.in
                  </a>
                </li>
                <li>
                  <span className="block text-[11px] text-[#958777]">General Support</span>
                  <a
                    href="mailto:hello@drivemitra.in"
                    className="font-semibold text-[#625346] hover:underline underline-offset-4"
                  >
                    hello@drivemitra.in
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 5: Legal & Compliance */}
            <div>
              <h3 className="text-xs font-bold text-[#625346] mb-3.5">Legal & Compliance</h3>
              <ul className="space-y-2.5 text-xs text-[#958777]">
                <li>
                  <button
                    type="button"
                    onClick={() => setFooterModal('terms')}
                    className="text-left hover:text-[#625346] hover:underline underline-offset-4"
                  >
                    Terms of Service
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setFooterModal('privacy')}
                    className="text-left hover:text-[#625346] hover:underline underline-offset-4"
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setFooterModal('cookies')}
                    className="text-left hover:text-[#625346] hover:underline underline-offset-4"
                  >
                    Cookie Preferences
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setFooterModal('sla')}
                    className="text-left hover:text-[#625346] hover:underline underline-offset-4"
                  >
                    Service Level Agreement (SLA)
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setFooterModal('security')}
                    className="text-left hover:text-[#625346] hover:underline underline-offset-4"
                  >
                    Data Security & Compliance
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-[#E5E5E5] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#958777]">
            <p>© {new Date().getFullYear()} DriveMitra. All rights reserved.</p>
            <p>Multi-tenant SaaS fleet intelligence for Indian commercial and EV fleets.</p>
          </div>
        </div>
      </footer>

      <FooterModals key={footerModal ?? 'closed'} activeModal={footerModal} onClose={() => setFooterModal(null)} />
    </div>
  )
}
