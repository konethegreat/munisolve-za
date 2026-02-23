import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import {
  Code2,
  Database,
  Server,
  Layout,
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
        {/* Hero */}
        <section className="relative bg-gradient-to-b from-slate-50 to-white overflow-hidden">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
            <div className="text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 bg-[#0d3b5c]/10 text-[#0d3b5c] rounded-full px-4 py-2 text-sm font-medium mb-6">
                <Code2 size={18} />
                Founder & Owner
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-[#0d3b5c] leading-tight mb-2">
                Kone Tshivhinda
              </h1>
              <p className="text-lg text-[#1a5f3c] font-semibold mb-4">
                K-ONE IT SOLUTIONS
              </p>
              <p className="text-lg sm:text-xl text-slate-600">
                A sleek, user-friendly app giving citizens peace of mind about reporting municipal situations.
              </p>
              <div className="mt-12 flex justify-center">
                <div className="h-1 w-24 rounded-full bg-[#e8b923]" aria-hidden="true" />
              </div>
            </div>
          </div>
        </section>

        {/* Bio */}
        <section className="py-12 sm:py-16 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-[#0d3b5c] mb-6 text-center">About</h2>
            <div className="max-w-2xl mx-auto space-y-4 text-slate-600 text-center">
              <p>
                <span className="font-medium text-[#0d3b5c]">Age:</span> 24
              </p>
              <p>
                <span className="font-medium text-[#0d3b5c]">Background:</span> Founder of K-ONE IT SOLUTIONS, a tech startup.
              </p>
              <p>
                Municipalities, especially smaller and rural ones, have no proper reporting structure. MuniSolve ZA fixes that by making reporting faster, more documented, and more accessible to every citizen.
              </p>
            </div>
          </div>
        </section>

        {/* Skills & Tech Stack */}
        <section className="py-12 sm:py-16 bg-slate-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-[#0d3b5c] mb-8 text-center">
              Skills & Tech Stack
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {SKILL_CATEGORIES.map(({ title, icon: Icon, items }) => (
                <div
                  key={title}
                  className="bg-white rounded-lg shadow-sm border border-slate-200/80 p-5"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-md bg-[#0d3b5c]/10 text-[#0d3b5c]">
                      <Icon size={20} />
                    </div>
                    <h3 className="font-semibold text-[#0d3b5c]">{title}</h3>
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {items.map((skill) => (
                      <li
                        key={skill}
                        className="text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-700"
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
        <section className="py-12 sm:py-16 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-[#0d3b5c] mb-8 text-center">
              Connect
            </h2>
            <div className="flex flex-wrap justify-center gap-4">
              {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#0d3b5c] hover:bg-[#0a2d45] text-white font-medium py-2.5 px-4 rounded-md transition-colors text-sm"
                >
                  <Icon size={18} />
                  {label}
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
