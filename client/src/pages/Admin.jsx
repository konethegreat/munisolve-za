import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function Admin() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1 px-4 py-10">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h1 className="text-2xl font-bold text-[#0d3b5c]">Admin</h1>
            <p className="text-slate-500 mt-1">
              Welcome to the admin area.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

