import { Link } from 'react-router-dom'
import { AlertCircle, ArrowRight } from 'lucide-react'

export default function Hero() {
  return (
    <section className="relative bg-gradient-to-b from-slate-50 to-white overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-[#0d3b5c]/10 text-[#0d3b5c] rounded-full px-4 py-2 text-sm font-medium mb-6">
            <AlertCircle size={18} />
            South African Municipal Reporting
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#0d3b5c] leading-tight mb-6">
            Report infrastructure faults{' '}
            <span className="text-[#1a5f3c]">instantly.</span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 mb-10">
            Help improve service delivery in your municipality. Log potholes, water leaks,
            streetlights, and other issues—so they get fixed faster.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 bg-[#1a5f3c] hover:bg-[#145230] text-white font-semibold py-3 px-6 rounded-md shadow-md hover:shadow-lg transition-all"
            >
              Get started
              <ArrowRight size={18} />
            </Link>
            <Link
              to="/report"
              className="inline-flex items-center justify-center gap-2 bg-[#0d3b5c] hover:bg-[#0a2d45] text-white font-semibold py-3 px-6 rounded-md border-2 border-[#0d3b5c] hover:border-[#0a2d45] transition-all"
            >
              Report a fault
            </Link>
          </div>
        </div>
        <div className="mt-16 flex justify-center">
          <div className="h-1 w-24 rounded-full bg-[#e8b923]" aria-hidden="true" />
        </div>
      </div>
    </section>
  )
}
