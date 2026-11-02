import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  HardHat,
  MapPin,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import HolidayBanner from './HolidayBanner'

const HIGHLIGHTS = [
  { icon: Zap, text: 'Report in under a minute' },
  { icon: MapPin, text: 'Pinned to a live incident map' },
  { icon: ShieldCheck, text: 'Tracked until resolved' },
]

const STEPS = [
  { label: 'Report received', state: 'done' },
  { label: 'Crew assigned', state: 'done' },
  { label: 'Repair in progress', state: 'current' },
  { label: 'Resolved and closed', state: 'next' },
]

function PreviewPanel() {
  return (
    <div className="relative mx-auto w-full max-w-md animate-fade-up delay-4">
      <div
        className="pointer-events-none absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-[#e8b923]/30 via-[#1a5f3c]/15 to-[#0d3b5c]/25 blur-2xl"
        aria-hidden="true"
      />
      <div
        className="relative overflow-hidden rounded-2xl border border-white/70 bg-white/90 p-5 shadow-2xl backdrop-blur"
        aria-label="Sample report preview"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0d3b5c]/10 text-[#0d3b5c]">
              <ClipboardCheck size={18} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Sample report
              </p>
              <p className="text-sm font-semibold text-[#0d3b5c]">#0042 · Pothole</p>
            </div>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
            Preview
          </span>
        </div>

        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
          <p className="font-semibold text-slate-800">Large pothole on Main Road</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
            <MapPin size={12} /> Melville, City of Johannesburg
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-700">
              <HardHat size={12} /> In progress
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600">
              <Clock size={12} /> Resolution due in 5d
            </span>
          </div>
        </div>

        <ol className="mt-4 space-y-3">
          {STEPS.map((step) => {
            const done = step.state === 'done'
            const current = step.state === 'current'
            return (
              <li key={step.label} className="flex items-center gap-3">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                    done
                      ? 'border-[#1a5f3c] bg-[#1a5f3c] text-white'
                      : current
                        ? 'border-[#e8b923] bg-[#e8b923]/15 text-[#a16207]'
                        : 'border-slate-200 bg-white text-slate-300'
                  }`}
                >
                  {done ? <CheckCircle2 size={13} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                </span>
                <span
                  className={`text-sm ${
                    done || current ? 'font-medium text-slate-700' : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
                {current && (
                  <span className="ml-auto text-xs font-medium text-[#a16207]">Now</span>
                )}
              </li>
            )
          })}
        </ol>

        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
          Weather and nearby duplicate checks run automatically, so crews arrive prepared.
        </p>
      </div>
    </div>
  )
}

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-brand-animated opacity-[0.04]" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#e8b923]/20 blur-3xl animate-float"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-[#1a5f3c]/15 blur-3xl animate-float"
        style={{ animationDelay: '2s' }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
            <div className="inline-flex animate-fade-up items-center gap-2 rounded-full bg-[#0d3b5c]/10 px-4 py-2 text-sm font-medium text-[#0d3b5c]">
              <AlertCircle size={18} />
              South African Municipal Reporting
            </div>

            <h1 className="mt-6 animate-fade-up text-4xl font-bold leading-tight text-[#0d3b5c] delay-1 sm:text-5xl lg:text-6xl">
              Report infrastructure faults{' '}
              <span className="text-[#1a5f3c]">instantly.</span>
            </h1>

            <p className="mt-6 animate-fade-up text-lg text-slate-600 delay-2 sm:text-xl">
              Help improve service delivery in your municipality. Log potholes, water leaks,
              streetlights, and other issues so they get fixed faster.
            </p>

            <div className="mt-8 flex animate-fade-up flex-col justify-center gap-3 delay-3 sm:flex-row lg:justify-start">
              <Link to="/register" className="btn btn-accent btn-sheen px-6 py-3 text-base">
                Get started
                <ArrowRight size={18} />
              </Link>
              <Link to="/report" className="btn btn-primary btn-sheen px-6 py-3 text-base">
                Report a fault
              </Link>
              <a href="#impact" className="btn btn-glow px-6 py-3 text-base">
                <Sparkles size={17} />
                See live impact
              </a>
            </div>

            <ul className="mt-10 flex animate-fade-up flex-wrap items-center justify-center gap-x-6 gap-y-3 delay-4 lg:justify-start">
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

          <PreviewPanel />
        </div>

        <div className="mx-auto mt-14 max-w-xl animate-fade-up delay-5">
          <HolidayBanner />
        </div>

        <div className="mt-10 flex justify-center lg:justify-start">
          <div className="accent-underline" aria-hidden="true" />
        </div>
      </div>
    </section>
  )
}
