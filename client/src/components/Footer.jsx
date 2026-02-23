import { Link } from 'react-router-dom'
import { Mail, Github, Linkedin, Facebook, ExternalLink } from 'lucide-react'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-[#0d3b5c] text-white mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/80 text-sm">
            © {currentYear} MuniSolve ZA. Kone Tshivhinda — K-ONE IT SOLUTIONS. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-4 sm:gap-6">
            <a
              href="https://github.com/konethegreat"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-white/80 hover:text-[#e8b923] transition-colors text-sm"
              aria-label="GitHub"
            >
              <Github size={16} />
            </a>
            <a
              href="https://www.linkedin.com/in/kone-tshivhinda-32a760233"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-white/80 hover:text-[#e8b923] transition-colors text-sm"
              aria-label="LinkedIn"
            >
              <Linkedin size={16} />
            </a>
            <a
              href="https://www.facebook.com/share/1A4q81U8vX/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-white/80 hover:text-[#e8b923] transition-colors text-sm"
              aria-label="Facebook"
            >
              <Facebook size={16} />
            </a>
            <a
              href="https://www.tiktok.com/@kone.tshivhinda"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-white/80 hover:text-[#e8b923] transition-colors text-sm"
              aria-label="TikTok"
            >
              <ExternalLink size={16} />
            </a>
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
