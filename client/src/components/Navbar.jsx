import { useState, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Menu, X, Home, ClipboardList, MapPin, UserCircle, LayoutDashboard, LogIn, UserPlus, Shield, HardHat, LogOut } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const NAV_LINKS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/report', label: 'Report Fault', icon: ClipboardList },
  { to: '/map', label: 'Map', icon: MapPin },
  { to: '/about', label: 'About', icon: UserCircle },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()
  const isAdmin = ['MUNICIPAL_ADMIN', 'SUPER_ADMIN'].includes(user?.role)
  const isSupervisor = ['WORKER_SUPERVISOR', 'MUNICIPAL_ADMIN', 'SUPER_ADMIN'].includes(user?.role)

  const handleLogout = async () => {
    setOpen(false)
    await logout()
    navigate('/login')
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const desktopLinkClass = ({ isActive }) =>
    `relative flex items-center gap-1.5 rounded-md px-3 py-2 transition-colors ${
      isActive ? 'text-[#e8b923]' : 'text-white/90 hover:text-[#e8b923]'
    } after:absolute after:left-3 after:right-3 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-[#e8b923] after:transition-transform after:duration-300 ${
      isActive ? 'after:scale-x-100' : 'after:scale-x-0 hover:after:scale-x-100'
    }`

  return (
    <nav
      className={`sticky top-0 z-[1100] text-white transition-all duration-300 ${
        scrolled ? 'glass shadow-lg' : 'bg-[#0d3b5c] shadow-md'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg tracking-tight group">
            <span className="text-[#e8b923] transition-transform group-hover:scale-105">MuniSolve</span>
            <span>ZA</span>
            <span className="text-white/70 text-sm font-normal hidden sm:inline">by K-ONE IT SOLUTIONS</span>
          </Link>

          {/* Desktop menu */}
          <div className="hidden md:flex items-center gap-2 lg:gap-4">
            {NAV_LINKS.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={to === '/'} className={desktopLinkClass}>
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
            {isAuthenticated && (
              <NavLink to="/dashboard" className={desktopLinkClass}>
                <LayoutDashboard size={18} />
                Dashboard
              </NavLink>
            )}
            {isAuthenticated && isSupervisor && (
              <Link
                to="/supervisor"
                className="flex items-center gap-1.5 bg-white/10 hover:bg-[#1a5f3c] hover:text-white text-white/90 rounded-md px-3 py-2 text-sm transition-colors"
                aria-label="Supervisor Dashboard"
              >
                <HardHat size={16} className="opacity-90" />
                Ops
              </Link>
            )}
            {isAuthenticated && isAdmin && (
              <Link
                to="/admin"
                className="btn btn-gold px-3 py-2 text-sm"
                aria-label="Admin Panel"
              >
                <Shield size={18} className="opacity-90" />
                Admin Panel
              </Link>
            )}
            {isAuthenticated ? (
              <>
                <span className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-2 text-sm text-white/90">
                  <UserCircle size={18} />
                  <span className="max-w-28 truncate">{user?.firstName || 'Account'}</span>
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 rounded-md px-3 py-2 text-white/90 transition-colors hover:bg-white/10 hover:text-[#e8b923]"
                >
                  <LogOut size={18} />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="flex items-center gap-1.5 bg-white/10 hover:bg-[#e8b923] hover:text-[#0d3b5c] text-white rounded-md px-4 py-2 transition-colors"
                >
                  <LogIn size={18} />
                  Login
                </Link>
                <Link
                  to="/register"
                  className="btn btn-accent px-4 py-2"
                >
                  <UserPlus size={18} />
                  Register
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            className="md:hidden p-2 rounded-md text-white/90 hover:bg-white/10 transition-colors"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden py-4 border-t border-white/10 animate-fade-in">
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-3 rounded-md transition-colors ${
                      isActive ? 'bg-white/10 text-[#e8b923]' : 'text-white/90 hover:bg-white/10'
                    }`
                  }
                  onClick={() => setOpen(false)}
                >
                  <Icon size={18} />
                  {label}
                </NavLink>
              ))}
              {isAuthenticated && (
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-3 rounded-md transition-colors ${
                      isActive ? 'bg-white/10 text-[#e8b923]' : 'text-white/90 hover:bg-white/10'
                    }`
                  }
                  onClick={() => setOpen(false)}
                >
                  <LayoutDashboard size={18} />
                  Dashboard
                </NavLink>
              )}
              {isAuthenticated && isSupervisor && (
                <Link
                  to="/supervisor"
                  className="flex items-center gap-2 px-4 py-3 bg-[#1a5f3c] text-white rounded-md mx-2 font-semibold shadow-sm"
                  onClick={() => setOpen(false)}
                  aria-label="Supervisor Dashboard"
                >
                  <HardHat size={18} className="opacity-90" />
                  Ops Dashboard
                </Link>
              )}
              {isAuthenticated && isAdmin && (
                <Link
                  to="/admin"
                  className="flex items-center gap-2 px-4 py-3 bg-[#e8b923] text-[#0d3b5c] rounded-md mx-2 font-semibold shadow-sm"
                  onClick={() => setOpen(false)}
                  aria-label="Admin Panel"
                >
                  <Shield size={18} className="opacity-90" />
                  Admin Panel
                </Link>
              )}
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-2 rounded-md px-4 py-3 text-left text-white/90 hover:bg-white/10"
                >
                  <LogOut size={18} />
                  Logout
                </button>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
