import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X, Home, ClipboardList, LogIn, UserPlus } from 'lucide-react'

export default function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <nav className="bg-[#0d3b5c] text-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <span className="text-[#e8b923]">MuniSolve</span>
            <span>ZA</span>
          </Link>

          {/* Desktop menu */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/"
              className="flex items-center gap-1.5 text-white/90 hover:text-[#e8b923] transition-colors rounded-md px-3 py-2"
            >
              <Home size={18} />
              Home
            </Link>
            <Link
              to="/report"
              className="flex items-center gap-1.5 text-white/90 hover:text-[#e8b923] transition-colors rounded-md px-3 py-2"
            >
              <ClipboardList size={18} />
              Report Fault
            </Link>
            <Link
              to="/login"
              className="flex items-center gap-1.5 bg-white/10 hover:bg-[#e8b923] hover:text-[#0d3b5c] text-white rounded-md px-4 py-2 transition-colors"
            >
              <LogIn size={18} />
              Login
            </Link>
            <Link
              to="/register"
              className="flex items-center gap-1.5 bg-[#1a5f3c] hover:bg-[#e8b923] hover:text-[#0d3b5c] text-white rounded-md px-4 py-2 transition-colors"
            >
              <UserPlus size={18} />
              Register
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            className="md:hidden p-2 rounded-md text-white/90 hover:bg-white/10"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden py-4 border-t border-white/10">
            <div className="flex flex-col gap-1">
              <Link
                to="/"
                className="flex items-center gap-2 px-4 py-3 text-white/90 hover:bg-white/10 rounded-md"
                onClick={() => setOpen(false)}
              >
                <Home size={18} />
                Home
              </Link>
              <Link
                to="/report"
                className="flex items-center gap-2 px-4 py-3 text-white/90 hover:bg-white/10 rounded-md"
                onClick={() => setOpen(false)}
              >
                <ClipboardList size={18} />
                Report Fault
              </Link>
              <Link
                to="/login"
                className="flex items-center gap-2 px-4 py-3 text-white/90 hover:bg-white/10 rounded-md"
                onClick={() => setOpen(false)}
              >
                <LogIn size={18} />
                Login
              </Link>
              <Link
                to="/register"
                className="flex items-center gap-2 px-4 py-3 bg-[#1a5f3c] text-white rounded-md mx-2"
                onClick={() => setOpen(false)}
              >
                <UserPlus size={18} />
                Register
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
