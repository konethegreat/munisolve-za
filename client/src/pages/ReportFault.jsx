import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

export default function ReportFault() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-xl shadow-lg border-t-4 border-[#0d3b5c] p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-[#0d3b5c] mb-2">Report a fault</h1>
          <p className="text-slate-600 mb-6">
            Fault reporting form will be available here. Log in or register to continue.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              to="/login"
              className="bg-[#0d3b5c] hover:bg-[#0a2d45] text-white font-semibold py-2 px-4 rounded-md transition-colors"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="bg-[#1a5f3c] hover:bg-[#145230] text-white font-semibold py-2 px-4 rounded-md transition-colors"
            >
              Register
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
