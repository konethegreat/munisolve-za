import { Link } from 'react-router-dom'
import { AlertCircle, ArrowRight, MapPin, ShieldCheck, Zap } from 'lucide-react'
import HolidayBanner from './HolidayBanner'

const HIGHLIGHTS = [
  { icon: Zap, text: 'Report in under a minute' },
  { icon: MapPin, text: 'Pinned to a live incident map' },
  { icon: ShieldCheck, text: 'Tracked until resolved' },
]

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Animated brand gradient backdrop */}
      <div className="absolute inset-0 bg-brand-animated opacity-[0.04]" aria-hidden="true" />
      {/* Floating gold orb */}
      <div
        className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#e8b923]/20 blur-3xl animate-float"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-[#1a5f3c]/15 blur-3xl animate-float"
        style={{ animationDelay: '2s' }}
        aria-hidden="true"
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-[#0d3b5c]/10 text-[#0d3b5c] rounded-full px-4 py-2 text-sm font-medium mb-6 animate-fade-up">
            <AlertCircle size={18} />
            South African Municipal Reporting
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#0d3b5c] leading-tight mb-6 animate-fade-up delay-1">
            Report infrastructure faults{' '}
            <span className="text-[#1a5f3c]">instantly.</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 mb-8 animate-fade-up delay-2">
            Help improve service delivery in your municipality. Log potholes, water leaks,
            streetlights, and other issues—so they get fixed faster.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-up delay-3">
            <Link
              to="/register"
              className="btn btn-accent btn-sheen py-3 px-6 text-base"
            >
              Get started
              <ArrowRight size={18} />
            </Link>
            <Link
              to="/report"
              className="btn btn-primary btn-sheen py-3 px-6 text-base"
            >
              Report a fault
            </Link>
          </div>

          {/* Trust highlights */}
          <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 animate-fade-up delay-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2 text-sm text-slate-600">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1a5f3c]/10 text-[#1a5f3c]">
                  <Icon size={15} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        {/* Holiday awareness notice */}
        <div className="mt-12 max-w-xl mx-auto animate-fade-up delay-5">
          <HolidayBanner />
        </div>

        <div className="mt-10 flex justify-center">
          <div className="accent-underline" aria-hidden="true" />
        </div>
      </div>
    </section>
  )
}
