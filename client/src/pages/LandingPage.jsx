import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import Footer from '../components/Footer'


export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1">
        <Hero />
      </main>
      <Footer />
    </div>
  )
}
