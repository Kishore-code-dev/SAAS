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
  Users,
  Wrench,
  X,
  Youtube,
} from 'lucide-react'
import { SUBSCRIPTION_PLANS } from '../data/seedOrganizations'
import { formatInr } from '../components/ui/EnterprisePrimitives'
import { BrandLogo } from '../components/ui/BrandLogo'
import { FooterModals, type FooterModalKey } from '../components/landing/FooterModals'
import { useAuth } from '../hooks/useAuth'
import { getDefaultHomeForRole } from '../utils/rbac'

export default function Landing() {
  const navigate = useNavigate()
  const { isAuthenticated, user, passwordChangeRequired } = useAuth()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [footerModal, setFooterModal] = useState<FooterModalKey>(null)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')

  const workspaceHref = user
    ? passwordChangeRequired
      ? '/change-password'
      : getDefaultHomeForRole(user.role)
    : '/auth'

  const handleBegin = () => {
    navigate(isAuthenticated ? workspaceHref : '/auth')
  }

  const handleStartSignup = (planId: 'monthly' | 'annual' = 'monthly') => {
    navigate(isAuthenticated ? workspaceHref : `/signup?plan=${planId}`)
  }

  const platformModules = [
    {
      icon: Layers,
      title: 'Fleet & Digital Twins',
      description:
        'Unify registration, RC, insurance, Fitness/PUC expiry, vehicle dimensions, GVW specs, service history, and trips inside every vehicle profile.',
    },
    {
      icon: Cpu,
      title: '5-Area Predictive Health',
      description:
        'Actionable Remaining Useful Life intelligence organized across Fuel Health, Engine Health, Tyre Health, Driver Health, and Vehicle Health.',
    },
    {
      icon: Wrench,
      title: 'Work Orders & Parts Inventory',
      description:
        'Convert inspection defects and predictive alerts directly into workshop Work Orders with automated SKU stock deduction and Purchase Orders.',
    },
    {
      icon: Users,
      title: 'Indian Driver Master & Compliance',
      description:
        'Track LMV-TR/TRANS/HTV commercial licences, RTO records, Form 1A medical fitness, assignment history, and road-adjusted safety scores.',
    },
    {
      icon: Fuel,
      title: 'Fuel & Charging Verification',
      description:
        'Audit Diesel, Petrol, CNG, and EV charging spend with automated duplicate checks, efficiency variance, and cost-per-km benchmarks.',
    },
    {
      icon: BarChart3,
      title: 'Financial Control & ICE vs EV TCO',
      description:
        'Separate recorded bills from verified invoices and cleared payments while comparing ICE and EV operating cost per kilometer.',
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
      sector: 'Industrial & Heavy Commercial',
      detail: 'Track axle weights, vehicle clearance specs, tyre tread depth across axles, and multi-workshop SLA turnaround.',
    },
  ]

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#625346]">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-[#FFFFFF]/95 backdrop-blur border-b border-[#E5E5E5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
          <Link to="/" aria-label="DriveMitra" className="flex items-center shrink-0">
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
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            {isAuthenticated ? (
              <Link to={workspaceHref} className="btn-primary text-xs sm:text-sm whitespace-nowrap">
                {user?.role === 'platform_admin' ? 'Platform Admin' : 'Open Workspace'}
              </Link>
            ) : (
              <>
                <Link to="/auth" className="btn-secondary text-xs sm:text-sm whitespace-nowrap">
                  Login
                </Link>
                <Link to="/signup" className="btn-primary text-xs sm:text-sm whitespace-nowrap hidden sm:inline-flex">
                  Get Started
                </Link>
              </>
            )}
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
            <Link
              to={isAuthenticated ? workspaceHref : '/auth'}
              onClick={() => setMobileNavOpen(false)}
              className="block text-sm font-semibold text-[#6E5696]"
            >
              {isAuthenticated ? 'Open Workspace' : 'Login'}
            </Link>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="py-14 lg:py-24 border-b border-[#DDD3ED] bg-[#EEE8F7]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center">
            <p className="text-xs font-semibold text-[#6E5696] uppercase tracking-wider mb-4">
              Owner-First Fleet ERP & Predictive Intelligence
            </p>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-[#625346] leading-[1.12] tracking-tight">
              Your Fleet. Your Intelligence. Your Competitive Advantage.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-[#625346]/85 max-w-xl leading-relaxed">
              Built exclusively for commercial fleet owners, maintenance heads, and finance controllers — unifying satellite route intelligence, 5-area predictive health, work orders, parts inventory, and Indian compliance in one operating system.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => handleStartSignup('monthly')}
                className="btn-primary text-sm px-6 py-3"
              >
                {isAuthenticated ? 'Enter Workspace' : 'Create Fleet Account'}
              </button>
              <button type="button" onClick={handleBegin} className="btn-secondary text-sm px-5 py-3">
                {isAuthenticated ? 'Open Workspace' : 'Sign In'}
              </button>
            </div>
            <p className="mt-5 text-xs text-[#958777]">
              Strict multi-tenant organization isolation · Work orders & spare parts stock · Indian commercial compliance vault
            </p>
          </div>

          <div className="lg:col-span-6 flex">
            <div className="w-full bg-[#FFFFFF] border border-[#DDD3ED] rounded-2xl p-6 shadow-card flex flex-col justify-between">
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#E5E5E5]">
                <div>
                  <p className="text-xs font-semibold text-[#958777]">Owner Command Centre</p>
                  <p className="font-bold text-base text-[#625346] mt-0.5">
                    Fleet Command Overview
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 my-5">
                <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-xl p-3.5">
                  <p className="text-xs text-[#958777]">Fleet Health Avg</p>
                  <p className="text-2xl font-bold text-[#625346] tabular-nums mt-1">84%</p>
                </div>
                <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-xl p-3.5">
                  <p className="text-xs text-[#958777]">Health Areas</p>
                  <p className="text-2xl font-bold text-[#6E5696] tabular-nums mt-1">5</p>
                </div>
                <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-xl p-3.5">
                  <p className="text-xs text-[#958777]">Risk Categories</p>
                  <p className="text-2xl font-bold text-[#625346] tabular-nums mt-1">10</p>
                </div>
              </div>

              <div className="bg-[#FFFFFF] border border-[#DDD3ED] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-[#625346] inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#D9786C]" />
                      Engine Health · Preventive Window 6–10 Days
                    </p>
                    <p className="text-sm font-bold text-[#625346] mt-0.5">
                      TN 30 EF 9012 · Engine Oil & Sump Inspection
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#625346] bg-[#EEE8F7] border border-[#B8A3D9] px-2 py-0.5 rounded tabular-nums shrink-0">
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

      {/* Platform Architecture */}
      <section id="platform" className="py-16 lg:py-20 bg-[#FFFFFF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[#6E5696] uppercase tracking-wider">Unified Operating Architecture</p>
            <h2 className="dm-section-title text-3xl mt-2">
              Enterprise fleet control built around one clean operational ledger
            </h2>
            <p className="text-[#958777] mt-3 text-base">
              Every organization, vehicle specification sheet, Indian driver record, work order, spare SKU, and vendor invoice stays synchronized inside one private workspace.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {platformModules.map((mod) => {
              const Icon = mod.icon
              return (
                <div key={mod.title} className="enterprise-card p-6 flex flex-col justify-between">
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

      {/* Predictive Maintenance & Integrity */}
      <section id="predictive" className="py-16 lg:py-20 bg-[#EEE8F7] border-y border-[#DDD3ED]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-6">
            <p className="text-xs font-semibold text-[#6E5696] uppercase tracking-wider">5-Area Predictive Health</p>
            <h2 className="dm-section-title text-3xl mt-2">
              Explainable maintenance forecasts built on verifiable operational inputs
            </h2>
            <p className="text-[#625346]/85 mt-3 leading-relaxed">
              DriveMitra evaluates Fuel Health, Engine Health, Tyre Health, Driver Health (safety & compliance only), and Vehicle Health — clearly flagging insufficient data instead of guessing.
            </p>
            <div className="mt-6 space-y-3 text-sm text-[#625346]">
              <div className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-[#4D6E4A] mt-0.5 shrink-0" />
                <span>Cumulative odometer, service schedules (date + km), and small-issue escalation</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-[#4D6E4A] mt-0.5 shrink-0" />
                <span>Multi-axle tyre tread depth tracking and pre-trip inspection defect links</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-[#4D6E4A] mt-0.5 shrink-0" />
                <span>Live Open-Meteo highway climate monitoring & corridor stress scoring</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-[#4D6E4A] mt-0.5 shrink-0" />
                <span>60 / 30 / 15 / 7 / 0-day Indian licence, RC, Fitness, Insurance & PUC alerts</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 enterprise-card p-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#E5E5E5]">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#6E5696]" />
                <span className="font-semibold text-sm text-[#625346]">
                  Fleet Risk & Document Integrity Safeguards
                </span>
              </div>
              <Compass className="w-4 h-4 text-[#958777]" />
            </div>
            <div className="mt-4 space-y-4 text-sm">
              <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[10px] p-4">
                <p className="font-semibold text-[#625346]">Uploaded ≠ Verified Vault Policy</p>
                <p className="text-[#958777] text-xs mt-1">
                  Uploaded RC, Insurance, Aadhaar/PAN, and Form 1A medical certificates remain Pending Verification until an authorized manager reviews and stamps approval.
                </p>
              </div>
              <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[10px] p-4">
                <p className="font-semibold text-[#625346]">Honest Truck Routing Guardrails</p>
                <p className="text-[#958777] text-xs mt-1">
                  Bridge height, axle count, and GVW route compliance are verified only via Google Truck Routing when configured; otherwise corridors display an explicit unverified warning.
                </p>
              </div>
              <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[10px] p-4">
                <p className="font-semibold text-[#625346]">Recorded vs Verified vs Paid Accounting</p>
                <p className="text-[#958777] text-xs mt-1">
                  Separate operational fuel/service entries from verified vendor invoices and cleared payments without double-counting Work Orders.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Industry Solutions */}
      <section id="solutions" className="py-16 lg:py-20 bg-[#FFFFFF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[#6E5696] uppercase tracking-wider">Commercial Fleet Fit</p>
            <h2 className="dm-section-title text-3xl mt-2">
              Built for multi-city Indian commercial and mixed EV operations
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            {industryApplications.map((item) => (
              <div key={item.sector} className="enterprise-card p-6">
                <h3 className="dm-card-title text-lg">{item.sector}</h3>
                <p className="text-sm text-[#958777] mt-2 leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 lg:py-20 bg-[#EEE8F7] border-t border-[#DDD3ED]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold text-[#6E5696] uppercase tracking-wider">Transparent SaaS Licensing</p>
              <h2 className="dm-section-title text-3xl mt-2">
                Choose Your DriveMitra Subscription
              </h2>
              <p className="text-[#958777] mt-2 text-sm">
                One complete DriveMitra platform with unlimited vehicles, drivers &amp; staff — billed monthly or annually (+18% GST).
              </p>
            </div>
            <div className="inline-flex items-center gap-1 bg-[#FFFFFF] p-1 rounded-[10px] border border-[#DDD3ED]">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold transition-colors ${
                  billingCycle === 'monthly' ? 'bg-[#EEE8F7] text-[#6E5696]' : 'text-[#958777] hover:text-[#625346]'
                }`}
              >
                Monthly (₹3,500)
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold transition-colors ${
                  billingCycle === 'annual' ? 'bg-[#EEE8F7] text-[#6E5696]' : 'text-[#958777] hover:text-[#625346]'
                }`}
              >
                Annual (Save ₹6,000 / 14.29%)
              </button>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch max-w-5xl mx-auto">
            {SUBSCRIPTION_PLANS.map((plan) => {
              const isHighlighted = plan.billingFrequency === billingCycle
              const canonicalCycle = plan.billingFrequency
              const primaryPrice = canonicalCycle === 'annual' ? plan.annualInr : plan.monthlyInr
              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl p-7 flex flex-col justify-between border shadow-card ${
                    isHighlighted
                      ? 'bg-[#FFFFFF] text-[#625346] border-2 border-[#6E5696]'
                      : 'bg-[#FAFAFA] text-[#625346] border-[#DDD3ED]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xl font-bold text-[#625346]">{plan.name}</h3>
                      {plan.savingsVsMonthlyInr > 0 && (
                        <span className="text-xs font-semibold text-[#4D6E4A] bg-[#EDF4EC] border border-[#789A75] px-2.5 py-0.5 rounded-[8px]">
                          Save ₹6,000/yr (14.29%)
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-1.5 text-[#958777]">{plan.tagline}</p>
                    <div className="mt-5 pb-5 border-b border-[#E5E5E5]">
                      <p className="text-3xl font-bold tabular-nums text-[#625346]">
                        {formatInr(primaryPrice)}
                        <span className="text-xs font-normal ml-1 text-[#958777]">
                          / {canonicalCycle === 'annual' ? 'year' : 'month'} + 18% GST ({formatInr(plan.totalPayableInr)} total)
                        </span>
                      </p>
                      {canonicalCycle === 'annual' && (
                        <p className="text-xs text-[#4D6E4A] font-semibold mt-1">
                          Equivalent to ₹3,000/month · Full platform access
                        </p>
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
                    onClick={() => handleStartSignup(canonicalCycle)}
                    className={`mt-8 w-full ${isHighlighted ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {isAuthenticated ? 'Open Workspace' : `Choose ${plan.name}`}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#FFFFFF] border-t border-[#E5E5E5] pt-14 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_1.15fr_1fr] gap-8 lg:gap-10">
            <div className="space-y-4">
              <Link to="/" aria-label="DriveMitra" className="inline-flex items-center shrink-0">
                <BrandLogo size="sm" />
              </Link>
              <div className="space-y-1.5">
                <p className="text-sm font-bold text-[#625346]">
                  Track Smarter. Predict Earlier. Operate Better.
                </p>
                <p className="text-xs text-[#958777] leading-relaxed max-w-xs">
                  Pure SaaS owner-side fleet ERP and predictive intelligence for Indian commercial fleets.
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

            <div>
              <h3 className="text-xs font-bold text-[#625346] mb-3.5">Platform</h3>
              <ul className="space-y-2.5 text-xs text-[#958777]">
                <li><Link to="/dashboard" className="hover:text-[#625346]">Command Centre</Link></li>
                <li><Link to="/dashboard/fleet" className="hover:text-[#625346]">Vehicles & Specs</Link></li>
                <li><Link to="/dashboard/maintenance" className="hover:text-[#625346]">5-Area Predictive Health</Link></li>
                <li><Link to="/dashboard/work-orders" className="hover:text-[#625346]">Work Orders & Inventory</Link></li>
                <li><Link to="/dashboard/drivers" className="hover:text-[#625346]">Indian Driver Master</Link></li>
                <li><Link to="/dashboard/financials" className="hover:text-[#625346]">Financials & TCO</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-bold text-[#625346] mb-3.5">Company</h3>
              <ul className="space-y-2.5 text-xs text-[#958777]">
                <li><button type="button" onClick={() => setFooterModal('about')} className="text-left hover:text-[#625346]">About DriveMitra</button></li>
                <li><a href="#pricing" className="hover:text-[#625346]">Pricing & Plans</a></li>
                <li><button type="button" onClick={() => setFooterModal('stories')} className="text-left hover:text-[#625346]">Customer Stories</button></li>
                <li><button type="button" onClick={() => setFooterModal('api-docs')} className="text-left hover:text-[#625346]">API Documentation</button></li>
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-bold text-[#625346] mb-3.5">Support</h3>
              <ul className="space-y-2.5 text-xs text-[#958777]">
                <li><button type="button" onClick={() => setFooterModal('help-center')} className="text-left hover:text-[#625346]">Help Center</button></li>
                <li><button type="button" onClick={() => setFooterModal('status')} className="text-left hover:text-[#625346]">System Status</button></li>
                <li><button type="button" onClick={() => setFooterModal('contact')} className="text-left hover:text-[#625346]">Contact Us</button></li>
                <li><a href="mailto:enterprise@drivemitra.in" className="font-semibold text-[#625346]">enterprise@drivemitra.in</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-bold text-[#625346] mb-3.5">Legal & Compliance</h3>
              <ul className="space-y-2.5 text-xs text-[#958777]">
                <li><button type="button" onClick={() => setFooterModal('terms')} className="text-left hover:text-[#625346]">Terms of Service</button></li>
                <li><button type="button" onClick={() => setFooterModal('privacy')} className="text-left hover:text-[#625346]">Privacy Policy</button></li>
                <li><button type="button" onClick={() => setFooterModal('sla')} className="text-left hover:text-[#625346]">SLA</button></li>
                <li><button type="button" onClick={() => setFooterModal('security')} className="text-left hover:text-[#625346]">Security & Compliance</button></li>
              </ul>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-[#E5E5E5] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#958777]">
            <p>© {new Date().getFullYear()} DriveMitra. All rights reserved.</p>
            <p>Production SaaS Fleet ERP for Indian Commercial & EV Fleets.</p>
          </div>
        </div>
      </footer>

      <FooterModals key={footerModal ?? 'closed'} activeModal={footerModal} onClose={() => setFooterModal(null)} />
    </div>
  )
}
