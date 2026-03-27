import { Link } from 'react-router-dom'
import { PlusCircle, Truck, Brain, CheckCircle2, ArrowRight, ShieldCheck, Zap } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from '../../i18n/useTranslation'

export default function EmptyFleetState() {
  const [step, setStep] = useState(1)
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center page-enter py-12">
      {/* Progress Dots */}
      <div className="flex gap-2 mb-12">
        {[1, 2, 3].map((s) => (
          <div 
            key={s} 
            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${step >= s ? 'w-6 bg-primary' : 'bg-white/10'}`} 
          />
        ))}
      </div>

      {step === 1 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-xl">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6 mx-auto animate-float">
            <ShieldCheck className="w-10 h-10 text-primary" />
          </div>
          <h2 className="font-display text-3xl font-bold mb-4">{t('empty.welcome')}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-10 font-light">
            {t('empty.secured')}
          </p>
          <button onClick={() => setStep(2)} className="btn-gold !px-10 !py-3 flex items-center gap-2 mx-auto">
            {t('empty.configure')} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="animate-in fade-in slide-in-from-right-4 duration-500 max-w-xl">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6 mx-auto">
            <Zap className="w-10 h-10 text-primary" />
          </div>
          <h2 className="font-display text-3xl font-bold mb-4">{t('empty.calibration')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left mb-10">
            <div className="glass-card p-4 rounded-xl border-white/5 bg-white/5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                <span className="text-xs font-bold text-success uppercase">Active</span>
              </div>
              <p className="text-xs font-semibold">Gemini Flash Node</p>
              <p className="text-[10px] text-muted-foreground mt-1">Real-time inference active</p>
            </div>
            <div className="glass-card p-4 rounded-xl border-white/5 bg-white/5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                <span className="text-xs font-bold text-success uppercase">Verified</span>
              </div>
              <p className="text-xs font-semibold">TN Road Intel</p>
              <p className="text-[10px] text-muted-foreground mt-1">Regional stressors mapped</p>
            </div>
          </div>
          <p className="text-muted-foreground text-sm mb-10 font-light">
            {t('empty.geo_mapped')}
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setStep(1)} className="btn-ghost !px-8">{t('empty.back')}</button>
            <button onClick={() => setStep(3)} className="btn-gold !px-10 !py-3 flex items-center gap-2">
              {t('empty.finalize')} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="animate-in fade-in zoom-in-95 duration-500 max-w-xl">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6 mx-auto animate-pulse">
            <Truck className="w-10 h-10 text-primary" />
          </div>
          <h2 className="font-display text-3xl font-bold mb-4">{t('empty.unleash')}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-10 font-light">
            {t('empty.primed')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/vehicles">
              <button className="btn-gold !px-10 !py-3 flex items-center gap-2">
                <PlusCircle className="w-4 h-4" />
                {t('empty.register')}
              </button>
            </Link>
            <Link to="/health">
              <button className="btn-ghost !px-10 !py-3 flex items-center gap-2">
                <Brain className="w-4 h-4" />
                {t('empty.explore_ai')}
              </button>
            </Link>
          </div>
        </div>
      )}

      <div className="mt-16 pt-8 border-t border-white/5 text-[11px] text-muted-foreground max-w-lg mx-auto leading-relaxed">
        <p>{t('empty.sla_notice')} 
        <span className="text-primary hover:underline cursor-pointer px-1">{t('empty.sla_link')}</span>.
        {t('empty.accuracy_notice')}</p>
      </div>
    </div>
  )
}
