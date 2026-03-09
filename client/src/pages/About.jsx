import { createElement } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Code2,
  Database,
  Server,
  Layout,
  MapPin,
  MessageSquare,
  Github,
  Linkedin,
  Facebook,
  ExternalLink,
} from 'lucide-react'

const SOCIAL_LINKS = [
  { label: 'GitHub', href: 'https://github.com/konethegreat', icon: Github },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/kone-tshivhinda-32a760233', icon: Linkedin },
  { label: 'Facebook', href: 'https://www.facebook.com/share/1A4q81U8vX/', icon: Facebook },
  { label: 'TikTok', href: 'https://www.tiktok.com/@kone.tshivhinda', icon: ExternalLink },
]

const SKILL_CATEGORIES = [
  {
    title: 'Frontend',
    icon: Layout,
    items: ['React', 'Vite', 'Tailwind CSS', 'JavaScript', 'HTML/CSS', 'Responsive UI'],
  },
  {
    title: 'Backend',
    icon: Server,
    items: ['Node.js', 'REST APIs', 'Express', 'Authentication', 'Validation'],
  },
  {
    title: 'Data & DevOps',
    icon: Database,
    items: ['Databases', 'SQL', 'API Design', 'Environment config', 'Security basics'],
  },
  {
    title: 'Tools & Soft Skills',
    icon: MessageSquare,
    items: ['Git', 'Problem-solving', 'Documentation', 'User focus', 'Civic tech'],
  },
]

export default function About() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1">
        {/* Proud banner */}
        <section className="bg-[#e8b923] text-[#0d3b5c]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 font-semibold tracking-tight">
                <Award size={18} />
                <span>Black-Owned Business</span>
                <span className="text-[#0d3b5c]/60">|</span>
                <span>BEE Certified</span>
              </div>
              <div className="text-sm text-[#0d3b5c]/80">
                Built in South Africa. Built for service delivery.
              </div>
            </div>
          </div>
        </section>

        {/* Hero */}
        <section className="relative overflow-hidden bg-[#0d3b5c]">
          <div
            className="absolute inset-0 opacity-40"
            aria-hidden="true"
            style={{
              background:
                'radial-gradient(800px circle at 20% 20%, rgba(232,185,35,0.35), transparent 55%), radial-gradient(700px circle at 80% 40%, rgba(26,95,60,0.35), transparent 55%), linear-gradient(to bottom, rgba(13,59,92,1), rgba(13,59,92,0.95))',
            }}
          />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 text-white/90 px-4 py-2 text-sm font-medium">
                <Code2 size={18} />
                K-ONE IT SOLUTIONS
                <span className="text-white/40">•</span>
                All things tech
              </div>

              <h1 className="mt-5 text-4xl sm:text-5xl font-bold tracking-tight text-white">
                Professional tech solutions with a civic mission.
              </h1>

              <p className="mt-4 text-lg sm:text-xl text-white/80 leading-relaxed">
                We build software, IT solutions, and civic tech platforms that help communities work better —
                with <span className="text-[#e8b923] font-semibold">MuniSolve ZA</span> as our flagship product.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <a
                  href="#munisolve"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-[#e8b923] text-[#0d3b5c] px-5 py-3 font-semibold shadow-sm hover:bg-[#f2cd4c] transition-colors"
                >
                  Explore MuniSolve ZA <ArrowRight size={18} />
                </a>
                <a
                  href="#connect"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-white/10 text-white px-5 py-3 font-semibold hover:bg-white/15 transition-colors"
                >
                  Connect with us <ExternalLink size={18} />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Mission */}
        <section className="py-12 sm:py-16 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-7">
                <h2 className="text-2xl sm:text-3xl font-bold text-[#0d3b5c] tracking-tight">
                  Our mission
                </h2>
                <p className="mt-4 text-slate-600 leading-relaxed">
                  To deliver dependable, modern technology that improves how people live and how institutions serve — from
                  robust software development to practical IT solutions and civic tech that creates accountability.
                </p>
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-[#0d3b5c]">Software development</div>
                    <div className="mt-2 text-sm text-slate-600">Products built for real users, real constraints, real outcomes.</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-[#0d3b5c]">IT solutions</div>
                    <div className="mt-2 text-sm text-slate-600">Reliable systems, integration, and support that keeps teams moving.</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-[#0d3b5c]">Civic tech</div>
                    <div className="mt-2 text-sm text-slate-600">Tools that make public service delivery easier to report and improve.</div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="rounded-2xl border border-[#e8b923]/40 bg-gradient-to-b from-[#e8b923]/20 to-white p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#0d3b5c] text-white px-4 py-2 text-sm font-semibold">
                      <Award size={18} className="text-[#e8b923]" />
                      BEE Certified
                    </div>
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#1a5f3c]">
                      <CheckCircle2 size={18} />
                      Black-owned
                    </div>
                  </div>

                  <h3 className="mt-5 text-lg font-bold text-[#0d3b5c]">Why it matters</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    We’re proud to be a black-owned, BEE certified business — and we bring that identity forward in the way
                    we build: with excellence, responsibility, and impact.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Founder */}
        <section className="py-12 sm:py-16 bg-slate-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#0d3b5c] tracking-tight">
                  Founder profile
                </h2>
                <p className="mt-2 text-slate-600">
                  The builder behind K-ONE IT SOLUTIONS and the flagship platform, MuniSolve ZA.
                </p>
              </div>
              <a
                href="#connect"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#0d3b5c] hover:text-[#1a5f3c] transition-colors"
              >
                Work with us <ArrowRight size={16} />
              </a>
            </div>

            <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5">
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-[#1a5f3c]">Founder & Owner</div>
                      <h3 className="mt-1 text-2xl font-bold text-[#0d3b5c]">Kone Tshivhinda</h3>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full bg-[#0d3b5c]/10 text-[#0d3b5c] px-3 py-1 text-xs font-semibold">
                          <MapPin size={14} />
                          Johannesburg
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full bg-[#1a5f3c]/10 text-[#1a5f3c] px-3 py-1 text-xs font-semibold">
                          Age 24
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full bg-[#e8b923]/25 text-[#0d3b5c] px-3 py-1 text-xs font-semibold">
                          Civic tech founder
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="mt-5 text-slate-600 leading-relaxed">
                    I build practical technology that’s clean, fast, and built for everyday people — especially where
                    service delivery needs better tools, better visibility, and better outcomes.
                  </p>
                </div>
              </div>

              <div className="lg:col-span-7">
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                  <h4 className="text-sm font-semibold text-[#0d3b5c]">What I bring</h4>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#0d3b5c]">
                        <CheckCircle2 size={16} className="text-[#1a5f3c]" />
                        Product-first engineering
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        Strong UX, reliable APIs, and pragmatic delivery.
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#0d3b5c]">
                        <CheckCircle2 size={16} className="text-[#1a5f3c]" />
                        Civic impact mindset
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        Tech that helps communities report, track, and resolve issues.
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#0d3b5c]">
                        <CheckCircle2 size={16} className="text-[#1a5f3c]" />
                        Modern stack execution
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        Frontend, backend, and practical DevOps fundamentals.
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#0d3b5c]">
                        <CheckCircle2 size={16} className="text-[#1a5f3c]" />
                        Clear communication
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        Documentation, collaboration, and stakeholder alignment.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Product showcase */}
        <section id="munisolve" className="py-12 sm:py-16 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#e8b923]/25 text-[#0d3b5c] px-4 py-2 text-sm font-semibold">
                  <Code2 size={18} />
                  Flagship product
                </div>
                <h2 className="mt-4 text-2xl sm:text-3xl font-bold text-[#0d3b5c] tracking-tight">
                  MuniSolve ZA
                </h2>
                <p className="mt-3 text-slate-600 leading-relaxed">
                  A platform that helps citizens report municipal service delivery problems in a clear, documented way —
                  while enabling better tracking, visibility, and follow-through.
                </p>
              </div>
              <div className="rounded-xl border border-[#e8b923]/40 bg-[#0d3b5c] p-5 text-white shadow-sm">
                <div className="text-sm text-white/80">Designed for</div>
                <div className="mt-1 text-lg font-bold">
                  Citizens • Municipal teams • Communities
                </div>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                  <h3 className="text-lg font-bold text-[#0d3b5c]">What it does</h3>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl bg-white border border-slate-200 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#0d3b5c]">
                        <CheckCircle2 size={16} className="text-[#e8b923]" />
                        Simple reporting
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        Log issues quickly with clear details that reduce back-and-forth.
                      </p>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#0d3b5c]">
                        <CheckCircle2 size={16} className="text-[#e8b923]" />
                        Better documentation
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        Keep a record that helps with accountability and follow-up.
                      </p>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#0d3b5c]">
                        <CheckCircle2 size={16} className="text-[#e8b923]" />
                        Visibility for communities
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        Make service delivery issues easier to see and understand.
                      </p>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#0d3b5c]">
                        <CheckCircle2 size={16} className="text-[#e8b923]" />
                        Civic tech impact
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        Encourages responsiveness and trust through better systems.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-[#0d3b5c]">Why it matters</h3>
                  <p className="mt-3 text-slate-600 leading-relaxed">
                    Many municipalities — especially smaller and rural ones — don’t have a consistent reporting structure.
                    MuniSolve ZA improves access by making reporting faster, clearer, and easier to track.
                  </p>
                  <div className="mt-5 rounded-xl bg-[#0d3b5c] p-4 text-white">
                    <div className="text-sm text-white/80">Flagship outcome</div>
                    <div className="mt-1 font-semibold">
                      More documented issues, better follow-up, and stronger community confidence.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Skills & Tech Stack */}
        <section className="py-12 sm:py-16 bg-slate-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-bold text-[#0d3b5c] tracking-tight">
                Skills & tech stack
              </h2>
              <p className="mt-3 text-slate-600">
                A focused toolkit for building modern web products and practical civic tech.
              </p>
              <div className="mt-6 flex justify-center">
                <div className="h-1 w-28 rounded-full bg-[#e8b923]" aria-hidden="true" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {SKILL_CATEGORIES.map(({ title, icon, items }) => (
                <div
                  key={title}
                  className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-md bg-[#e8b923]/25 text-[#0d3b5c]">
                      {createElement(icon, { size: 20 })}
                    </div>
                    <h3 className="font-semibold text-[#0d3b5c]">{title}</h3>
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {items.map((skill) => (
                      <li
                        key={skill}
                        className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700"
                      >
                        {skill}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Social & GitHub links */}
        <section id="connect" className="py-12 sm:py-16 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-6 sm:p-10">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="max-w-2xl">
                  <h2 className="text-2xl sm:text-3xl font-bold text-[#0d3b5c] tracking-tight">
                    Let’s connect
                  </h2>
                  <p className="mt-3 text-slate-600 leading-relaxed">
                    Follow our work, see what we’re building, and reach out for collaboration.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-2xl bg-[#0d3b5c] px-5 py-4 text-white shadow-sm">
                  <MessageSquare size={18} className="text-[#e8b923]" />
                  <div>
                    <div className="text-sm text-white/80">Company</div>
                    <div className="font-semibold">K-ONE IT SOLUTIONS</div>
                  </div>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {SOCIAL_LINKS.map(({ label, href, icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 hover:border-[#e8b923]/60 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid place-items-center h-10 w-10 rounded-xl bg-[#e8b923]/25 text-[#0d3b5c]">
                        {createElement(icon, { size: 18 })}
                      </div>
                      <div className="font-semibold text-[#0d3b5c]">{label}</div>
                    </div>
                    <ArrowRight size={18} className="text-slate-400 group-hover:text-[#1a5f3c] transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
