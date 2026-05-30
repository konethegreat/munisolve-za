import { Link } from 'react-router-dom'
import { ClipboardList, MapPinned, BellRing, ArrowRight } from 'lucide-react'
import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import Footer from '../components/Footer'
import StatsSection from '../components/StatsSection'

const STEPS = [
  {
    icon: ClipboardList,
    title: 'Log the issue',
    body: 'Pick a category, describe the fault, and pin the exact location in seconds.',
  },
  {
    icon: MapPinned,
    title: 'See it on the map',
    body: 'Your report joins a live incident map with weather and air-quality context.',
  },
  {
    icon: BellRing,
    title: 'Track to resolution',
    body: 'Follow status updates from Pending to Resolved, with the Siyanda AI assistant on hand.',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-mesh">
      <Navbar />
      <main className="flex-1">
        <Hero />

        <StatsSection />

        {/* How it works */}
        <section className="py-16 sm:py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-[#0d3b5c]">How it works</h2>
              <div className="accent-underline mx-auto mt-4" />
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {STEPS.map((s, i) => {
                const Icon = s.icon
                return (
                  <div
                    key={s.title}
                    className="card card-hover animate-fade-up p-7"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#0d3b5c]/10 text-[#0d3b5c]">
                      <Icon size={24} />
                    </div>
                    <h3 className="text-lg font-semibold text-[#0d3b5c]">
                      <span className="text-[#e8b923] mr-1">{i + 1}.</span> {s.title}
                    </h3>
                    <p className="mt-2 text-sm text-slate-600">{s.body}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* CTA banner */}
        <section className="px-4 sm:px-6 lg:px-8 pb-20">
          <div className="max-w-5xl mx-auto overflow-hidden rounded-2xl bg-brand-animated px-8 py-12 text-center shadow-lg">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Spotted a problem in your neighbourhood?
            </h2>
            <p className="mt-3 text-white/80">
              Take a minute to report it. Every report helps your municipality act faster.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row justify-center gap-4">
              <Link to="/report" className="btn btn-gold btn-sheen py-3 px-7 text-base">
                Report a fault <ArrowRight size={18} />
              </Link>
              <Link
                to="/map"
                className="btn py-3 px-7 text-base border-2 border-white/40 text-white hover:bg-white/10"
              >
                View the map
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
