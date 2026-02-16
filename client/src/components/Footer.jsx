import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-[#0d3b5c] text-white mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/80 text-sm">
            © {currentYear} MuniSolve ZA. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a
              href="mailto:contact@munisolve.co.za"
              className="flex items-center gap-2 text-white/80 hover:text-[#e8b923] transition-colors text-sm"
            >
              <Mail size={16} />
              Contact
            </a>
            <Link
              to="/"
              className="text-white/80 hover:text-[#e8b923] transition-colors text-sm"
            >
              Home
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
