import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Volume2, VolumeX, Bot, Loader2, Sparkles, Zap, Shield, Target } from 'lucide-react'
import { cn } from '../../lib/utils'

import { FleetStats } from '../../hooks/useFleetStats'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'മലയാളം' },
  { code: 'mr', label: 'मराठी' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'gu', label: 'ગુજરાતી' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ' },
]

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  type?: 'text' | 'action' | 'alert'
}

interface Props {
  stats: FleetStats
}

function getMitraResponse(msg: string, stats: FleetStats): string {
  const lower = msg.toLowerCase()
  
  if (lower.includes('health') || lower.includes('score')) {
    return `Analysis complete. Your fleet vitality score is indexed at ${stats.avg_health_score}%. I've identified ${stats.critical_vehicles} units requiring immediate mechanical intervention to prevent route disruption. Would you like me to prioritize the dispatch of maintenance crews for these units?`
  }
  
  if (lower.includes('maintenance') || lower.includes('service')) {
    return `Fleet intelligence confirms ${stats.upcoming_maintenance} predictive maintenance events. By addressing these within the next 48 hours, our modeling indicates a potential OEE improvement and a net saving of ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(stats.predicted_savings)}. Shall I provision the internal service tickets?`
  }

  if (lower.includes(' சென்னை') || lower.includes('chennai')) {
    return `Querying Chennai Sector... I see 12 vehicles active. Unit TN-01-AX-9920 has flagged a high vibration level in the braking system. My recommendation: Immediate inspection at the Red Hills yard.`
  }

  if (lower.includes('performance') || lower.includes('efficiency')) {
    return `Operational efficiency is currently at 94.2%. Driver behavior analysis shows a 12% reduction in harsh acceleration events this week. This trajectory will lead to significant fuel optimization by month-end.`
  }

  if (lower.includes('billing') || lower.includes('plan')) {
    return `You are currently on the 'Growth' SaaS tier. Your next intelligence cycle starts in 12 days. You've utilized 65% of your AI agent compute quota. Upgrade to 'Enterprise' for unlimited predictive modeling.`
  }

  return `Reporting for duty. I am Mitra, your dedicated Fleet Intelligence Agent. I am monitoring ${stats.total_vehicles} assets across the Indian subcontinent. How can I optimize your logistics operations today?`
}

export default function AIAssistant({ stats }: Props) {

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: `Intelligence initialized. I am monitoring ${stats.total_vehicles} assets across your fleet. How can I assist with your operations today?`, timestamp: new Date() }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [tts, setTts] = useState(false)
  const [lang, setLang] = useState('en')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    
    // Simulate AI Processing (CrewAI-like delay)
    await new Promise(r => setTimeout(r, 1800))
    
    const reply = getMitraResponse(input, stats)
    const aiMsg: Message = { role: 'assistant', content: reply, timestamp: new Date() }
    setMessages(prev => [...prev, aiMsg])
    setLoading(false)
    
    if (tts && 'speechSynthesis' in window) {
      const utt = new SpeechSynthesisUtterance(reply)
      utt.lang = lang
      window.speechSynthesis.speak(utt)
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        id="ai-assistant-toggle"
        onClick={() => setOpen(!open)}
        className={cn(
          'fixed bottom-8 right-8 w-16 h-16 rounded-[24px] shadow-[0_0_30px_rgba(255,204,0,0.3)] flex items-center justify-center z-50 transition-all duration-500 hover:scale-110 active:scale-95',
          open ? 'bg-secondary border-white/10 rotate-90' : 'bg-gradient-gold animate-pulse-gold'
        )}
      >
        {open ? <X className="w-6 h-6 text-foreground" /> : <Bot className="w-8 h-8 text-black" />}
        {!open && (
           <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-background animate-bounce" />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-28 right-8 w-[380px] h-[550px] glass-card rounded-[32px] z-50 flex flex-col shadow-[0_20px_60px_rgba(0,0,0,0.6)] border border-primary/20 overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="px-6 py-5 border-b border-white/5 relative bg-black/40">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-gold flex items-center justify-center shadow-[0_0_15px_rgba(255,204,0,0.2)]">
                        <Sparkles className="w-5 h-5 text-black" />
                    </div>
                    <div>
                        <p className="text-sm font-black tracking-tighter text-white">Mitra Core v2.0</p>
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Active Intelligence</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setTts(!tts)} 
                        className={cn("p-2 rounded-xl transition-all", tts ? "bg-primary/20 text-primary" : "bg-white/5 text-muted-foreground hover:bg-white/10")}>
                        {tts ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    </button>
                    <select
                        value={lang}
                        onChange={e => setLang(e.target.value)}
                        className="bg-white/5 border-none text-[10px] font-black rounded-lg px-2 py-1 text-muted-foreground cursor-pointer outline-none hover:bg-white/10"
                    >
                        {LANGUAGES.map(l => (
                        <option key={l.code} value={l.code} className="bg-slate-900">{l.label}</option>
                        ))}
                    </select>
                </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scroll-smooth">
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex flex-col', msg.role === 'user' ? 'items-end' : 'items-start')}>
                {msg.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-1.5 px-1">
                        <Bot className="w-3 h-3 text-primary" />
                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Mitra Agent</span>
                    </div>
                )}
                <div className={cn(
                  'max-w-[90%] rounded-[24px] px-5 py-4 text-[13px] leading-relaxed shadow-xl animate-fade-in-up',
                  msg.role === 'user'
                    ? 'bg-gradient-gold text-black font-black rounded-tr-none'
                    : 'bg-white/[0.03] text-foreground font-medium rounded-tl-none border border-white/5 backdrop-blur-sm'
                )}>
                  {msg.content}
                </div>
                <p className="text-[9px] text-muted-foreground/50 mt-1.5 px-1 font-bold">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start animate-fade-in">
                <div className="bg-white/[0.03] border border-white/5 rounded-[24px] rounded-tl-none px-5 py-4 flex flex-col gap-3 w-[80%] shadow-xl">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-[11px] font-black text-primary uppercase tracking-widest">Querying Intelligence Layer...</span>
                  </div>
                  <div className="space-y-2">
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-primary animate-progress-glow" style={{ width: '60%' }} />
                    </div>
                    <div className="flex justify-between text-[8px] font-black text-muted-foreground uppercase">
                        <span>Reading Telemetry</span>
                        <span>Verifying Patterns</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick Actions */}
          <div className="px-6 py-3 flex gap-2 overflow-x-auto no-scrollbar border-t border-white/5 bg-black/20">
            {['Fleet Health', 'Fuel Audit', 'Risk Alerts'].map(action => (
                <button key={action} onClick={() => { setInput(action); }}
                    className="flex-shrink-0 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black text-muted-foreground hover:text-primary hover:border-primary/40 transition-all uppercase tracking-tight">
                    {action}
                </button>
            ))}
          </div>

          {/* Input Area */}
          <div className="p-6 bg-black/40 border-t border-white/5">
            <div className="relative">
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && send()}
                    placeholder="Ask Mitra anything..."
                    className="w-full bg-white/5 border border-white/10 rounded-[20px] pl-5 pr-14 py-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all font-medium"
                />
                <button
                    onClick={send}
                    disabled={!input.trim() || loading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-gradient-gold flex items-center justify-center disabled:opacity-30 hover:scale-105 transition-all shadow-lg active:scale-95 group"
                >
                    <Send className="w-4 h-4 text-black group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </button>
            </div>
            <p className="text-center text-[9px] text-muted-foreground font-bold mt-4 uppercase tracking-widest opacity-50 flex items-center justify-center gap-2">
                <Shield className="w-2.5 h-2.5" /> End-to-End Encrypted Intelligence
            </p>
          </div>
        </div>
      )}
    </>
  )
}
