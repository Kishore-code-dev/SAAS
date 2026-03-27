import { Link } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import HeroVisual from '../components/landing/HeroVisual'
import {
  Truck, Brain, Shield, Zap, BarChart3, Clock,
  ChevronRight, Map, Users, Navigation, Fuel, Activity, Globe, ArrowRight, Play, Star, Smartphone,
  Menu, X, CheckCircle2, ShieldCheck, ZapOff, Fingerprint, Layers
} from 'lucide-react'

// --- Components ---

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const lastScrollY = useRef(0)

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      setIsScrolled(currentScrollY > 50)
      
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setIsVisible(false)
      } else {
        setIsVisible(true)
      }
      lastScrollY.current = currentScrollY
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <motion.nav
      initial={{ y: 0 }}
      animate={{ y: isVisible ? 0 : -100 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className={`fixed top-0 left-0 right-0 h-20 z-50 px-6 lg:px-16 flex items-center justify-between transition-all duration-500 ${
        isScrolled ? 'bg-background/80 backdrop-blur-2xl border-b border-white/5' : 'bg-transparent'
      }`}
    >
      <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <div className="w-10 h-10 rounded-[12px] flex items-center justify-center bg-black shadow-gold group-hover:scale-110 transition-transform border border-primary/20">
          <Truck className="w-6 h-6 text-primary" />
        </div>
        <span className="font-display text-2xl font-black tracking-tighter text-white">DriveMitra</span>
      </div>

      <div className="hidden lg:flex items-center gap-10 text-[11px] font-black uppercase tracking-[0.2em] text-muted">
        {['Features', 'Pricing', 'About', 'Contact'].map((item) => (
          <a key={item} href={`#${item.toLowerCase()}`} className="hover:text-primary transition-colors">{item}</a>
        ))}
      </div>

      <div className="flex items-center gap-6">
        <Link to="/auth" className="hidden sm:block text-[11px] font-black uppercase tracking-[0.2em] text-white hover:text-primary transition-colors">
          Log In
        </Link>
        <Link to="/auth">
          <button className="btn-primary !px-6 !py-2.5 !text-[11px] uppercase tracking-widest">Get Started</button>
        </Link>
      </div>
    </motion.nav>
  )
}

const StatCounter = ({ value, label }: { value: string; label: string }) => {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.5 })
  const [count, setCount] = useState(0)
  const target = parseFloat(value.replace(/[^0-9.]/g, ''))
  const suffix = value.replace(/[0-9.]/g, '')

  useEffect(() => {
    if (inView) {
      let start = 0
      const duration = 2000
      const step = (timestamp: number) => {
        if (!start) start = timestamp
        const progress = Math.min((timestamp - start) / duration, 1)
        setCount(progress * target)
        if (progress < 1) window.requestAnimationFrame(step)
      }
      window.requestAnimationFrame(step)
    }
  }, [inView, target])

  return (
    <div ref={ref} className="text-center group">
      <div className="text-5xl lg:text-6xl font-display font-black text-gradient-gold mb-3 group-hover:scale-110 transition-transform duration-500">
        {count.toLocaleString(undefined, { maximumFractionDigits: 1 })}{suffix}
      </div>
      <div className="h-1 w-12 bg-primary/20 mx-auto mb-4 rounded-full" />
      <p className="text-[10px] text-muted uppercase font-black tracking-[0.4em]">{label}</p>
    </div>
  )
}

const Marquee = () => {
  const brands = ['RELIANCE', 'TATA', 'MAHINDRA', 'ADANI', 'EICHER', 'AMAZON', 'FLIPKART', 'DELHIVERY']
  return (
    <div className="relative flex overflow-x-hidden border-y border-white/5 bg-white/[0.01] py-12">
      <div className="animate-marquee whitespace-nowrap flex items-center gap-24 pr-24">
        {brands.concat(brands).map((brand, i) => (
          <span key={i} className="text-4xl font-display font-black tracking-tighter text-white/20 hover:text-primary/40 transition-colors cursor-default select-none">
            {brand}
          </span>
        ))}
      </div>
    </div>
  )
}

const FeatureCard = ({ icon: Icon, title, desc, delay }: any) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay }}
      whileHover={{ y: -8 }}
      className="glass-card p-10 rounded-[32px] border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-primary/30 transition-all duration-500 group relative overflow-hidden"
    >
      <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors" />
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-8 bg-primary/10 border border-primary/20 shadow-gold group-hover:scale-110 transition-transform duration-500">
        <Icon className="w-8 h-8 text-primary shadow-gold" />
      </div>
      <h3 className="text-2xl font-display font-black mb-4 text-white group-hover:text-primary transition-colors">{title}</h3>
      <p className="text-muted leading-relaxed font-medium text-sm">{desc}</p>
      <div className="mt-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary opacity-30 group-hover:opacity-100 transition-opacity">
        Explore Tech <ChevronRight className="w-4 h-4" />
      </div>
    </motion.div>
  )
}

// --- Main Page ---

export default function Landing() {
  const { scrollYProgress } = useScroll()
  const backgroundY = useTransform(scrollYProgress, [0, 1], ['0%', '20%'])

  const features = [
    { icon: Map, title: 'Live GPS Fleet Map', desc: 'Track every vehicle in real-time on an elite India-wide map using just driver smartphones.' },
    { icon: Brain, title: 'AI Monitoring Agents', desc: 'Neural agents detect overspeeding, harsh braking, and route deviations with 99.9% precision.' },
    { icon: Activity, title: 'Behavioral Scoring', desc: 'Smartphone telemetry measures acceleration, cornering, and phone usage for safety profiling.' },
    { icon: Navigation, title: 'Auto Trip Detection', desc: 'Zero manual input. Trips ignite and terminate automatically based on velocity vectors.' },
    { icon: Fuel, title: 'Digital Fuel Ledger', desc: 'Record purchases via UPI/Paytm. AI OCR verifies physical receipts for bulletproof accounting.' },
    { icon: Globe, title: 'V-Language Support', desc: 'Interface in English, Hindi, Tamil, Telugu, and Kannada—built for the diverse Indian logistics.' },
  ]

  const plans = [
    {
      name: 'Starter', price: '₹999', period: '/mo',
      desc: 'Precision for small fleets',
      features: ['Up to 5 vehicles', 'Real-time GPS', 'Auto Trip Detection', 'Email Reports'],
      cta: 'Start Free Trial', popular: false
    },
    {
      name: 'Growth', price: '₹2,999', period: '/mo',
      desc: 'Scale your operations',
      features: ['Up to 25 vehicles', 'Driver behavior scoring', 'Fuel management', 'AI alert engine', 'Maintenance tracking'],
      cta: 'Begin Growth', popular: true
    },
    {
      name: 'Enterprise', price: 'Custom', period: '',
      desc: 'Elite fleet management',
      features: ['Unlimited power', 'Multi-language support', 'Custom AI models', 'White-labeling', 'API Infrastructure'],
      cta: 'Contact Sales', popular: false
    },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/30 scroll-smooth">
      <Navbar />
      
      {/* Dynamic Background */}
      <motion.div style={{ y: backgroundY }} className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(245,197,24,0.08),transparent_50%)]" />
        <div className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: 'linear-gradient(rgba(245,197,24,1) 1px, transparent 1px), linear-gradient(90deg, rgba(245,197,24,1) 1px, transparent 1px)',
            backgroundSize: '100px 100px'
          }} />
      </motion.div>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-32 pb-20 max-w-7xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2.5 px-6 py-2 rounded-full text-[10px] font-black tracking-[0.3em] uppercase mb-12 bg-white/5 border border-white/10 text-primary shadow-gold"
        >
          <Zap className="w-3.5 h-3.5 fill-primary shadow-gold" /> The Intelligence Layer for Indian Fleet Operations
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="font-display text-7xl md:text-8xl lg:text-[130px] font-black tracking-tighter mb-10 leading-[0.85] text-white"
        >
          Fleet Intel. <br />
          <span className="text-gradient-gold drop-shadow-2xl">Re-Engineered.</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-lg md:text-xl text-muted max-w-2xl mb-16 font-medium leading-relaxed"
        >
          DriveMitra turns smartphones into high-fidelity telematics engines. 
          Hardware-free, AI-driven, and meticulously designed for India's logistics elite.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-8 mb-24"
        >
          <button className="btn-primary !text-lg !px-16 !py-6 shadow-gold group">
            Get Started Free <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <button className="btn-secondary !text-lg !px-12 !py-6">
            View Case Studies
          </button>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="w-full relative group mt-12"
        >
          <div className="absolute -inset-10 bg-primary/20 blur-[120px] rounded-full opacity-20 group-hover:opacity-40 transition-opacity duration-1000" />
          <div className="glass-card rounded-[40px] p-4 overflow-hidden shadow-2xl relative border-white/10">
            <HeroVisual />
          </div>
        </motion.div>
      </section>

      {/* Stats Board */}
      <section className="py-32 relative">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 lg:grid-cols-4 gap-16">
          <StatCounter value="5000+" label="Active Vehicles" />
          <StatCounter value="98.4%" label="GPS Precision" />
          <StatCounter value="₹12Cr+" label="Fuel Savings" />
          <StatCounter value="5" label="Local Languages" />
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-20 flex flex-col items-center">
        <p className="text-[10px] font-black uppercase tracking-[0.6em] text-muted mb-16">Propelling the Future of These Legends</p>
        <div className="w-full">
          <Marquee />
        </div>
      </section>

      {/* Features Showcase */}
      <section id="features" className="py-40 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-32">
          <div className="inline-block px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest mb-8">Ecosystem</div>
          <h2 className="text-6xl md:text-8xl font-display font-black mb-10 leading-none">The Full Stack. <br /><span className="text-gradient-gold">Zero Hardware.</span></h2>
          <p className="text-muted max-w-2xl mx-auto text-lg font-medium">
            We've eliminated the friction of expensive black boxes. Welcome to software-defined fleet intelligence.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {features.map((f, i) => (
            <FeatureCard key={i} {...f} delay={i * 0.1} />
          ))}
        </div>
      </section>

      {/* Pricing section */}
      <section id="pricing" className="py-40 px-6 bg-white/[0.01] border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-32 gap-12">
            <div className="max-w-xl">
              <div className="inline-block px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest mb-8">Investment</div>
              <h2 className="text-6xl md:text-8xl font-display font-black leading-[0.85]">Engineered for <br /><span className="text-gradient-gold">Scale.</span></h2>
            </div>
            <p className="text-muted max-w-md text-lg font-medium lg:pb-6">
              Logistics is a game of margins. Our pricing is designed to grow as you dominate.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {plans.map((p, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`glass-card p-12 rounded-[48px] flex flex-col h-full relative group shadow-premium transition-all duration-700
                ${p.popular ? 'border-primary/50 bg-white/[0.04] scale-105 z-10 shadow-gold' : 'border-white/5 bg-white/[0.01]'}`}
              >
                {p.popular && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-8 py-2 rounded-full text-[11px] font-black uppercase tracking-widest bg-primary text-black shadow-gold ring-4 ring-background">
                    Most Popular
                  </div>
                )}
                
                <div className="mb-12">
                  <h3 className="text-3xl font-display font-black mb-2 uppercase tracking-tight text-white">{p.name}</h3>
                  <p className="text-sm text-muted font-bold">{p.desc}</p>
                </div>
                
                <div className="mb-16">
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-7xl font-display font-black text-white group-hover:text-primary transition-colors">{p.price}</span>
                    <span className="text-sm text-muted uppercase font-black">{p.period}</span>
                  </div>
                  <div className="h-1.5 w-24 bg-primary/10 rounded-full overflow-hidden">
                    <div className="h-full bg-primary w-1/3 group-hover:w-full transition-all duration-1000" />
                  </div>
                </div>

                <ul className="space-y-6 mb-16 flex-1">
                  {p.features.map((f, ii) => (
                    <li key={ii} className="flex items-center gap-4 text-sm text-muted font-medium group/li">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center group-hover/li:bg-primary transition-colors">
                        <Star className="w-3 h-3 text-primary group-hover/li:text-black" />
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>

                <button className={`w-full py-6 rounded-[24px] font-black text-sm uppercase tracking-[0.2em] transition-all duration-500
                  ${p.popular 
                    ? 'btn-primary shadow-gold' 
                    : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'}`}>
                  {p.cta}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="pt-32 pb-16 px-6 bg-black border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-20 mb-32">
            <div className="col-span-1 md:col-span-1">
              <div className="flex items-center gap-3 mb-10">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 border border-white/10">
                  <Truck className="w-6 h-6 text-primary" />
                </div>
                <span className="font-display text-2xl font-black text-white">DriveMitra</span>
              </div>
              <p className="text-sm text-muted leading-relaxed mb-10">
                The definitive intelligence layer for India's logistics enterprise. 
                Zero hardware. Elite clarity. Built for the modern supply chain.
              </p>
              <div className="flex gap-4">
                {[Globe, Zap, Activity, Shield].map((Icon, i) => (
                  <div key={i} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-primary/20 hover:border-primary/40 transition-all cursor-pointer group">
                    <Icon className="w-5 h-5 text-muted group-hover:text-white" />
                  </div>
                ))}
              </div>
            </div>
            
            {['Product', 'Company', 'Contact'].map((section, idx) => (
              <div key={idx}>
                <h5 className="text-[11px] font-black uppercase tracking-[0.3em] text-primary mb-10">{section}</h5>
                <ul className="space-y-6">
                  {['Features', 'Intelligence', 'Fleet Map', 'Cloud Ledger', 'API Engine'].map((item, i) => (
                    <li key={i} className="text-[13px] text-muted font-bold hover:text-white cursor-pointer transition-colors flex items-center gap-2 group">
                      <ChevronRight className="w-3 h-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          
          <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-10">
            <div className="flex items-center gap-6">
              <p className="text-[10px] text-muted font-black uppercase tracking-[0.4em]">© 2026 DriveMitra Intelligence Group</p>
              <div className="h-4 w-px bg-white/10 hidden md:block" />
              <p className="text-[10px] text-muted font-black uppercase tracking-[0.4em] flex items-center gap-2">Built in India 🇮🇳 <Fingerprint className="w-3 h-3" /></p>
            </div>
            <div className="flex gap-10">
               {['Privacy Policy', 'Security Protocol', 'Term of Service'].map(text => (
                 <a key={text} className="text-[10px] text-muted font-black uppercase tracking-[0.2em] hover:text-primary transition-colors">{text}</a>
               ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
