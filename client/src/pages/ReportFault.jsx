// ==========================================
// REPORT FAULT PAGE (Complete Functional Form)
// ==========================================
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import MunicipalitySelector from '../components/MunicipalitySelector';

const NOMINATIM_HEADERS = {
  'User-Agent': 'MuniSolveZA/1.0 (erictshivhinda@gmail.com)',
};

async function nominatimSearch(query) {
  if (!query || query.trim().length < 2) return [];
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query.trim())}&countrycodes=za&format=json&limit=5`;
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!res.ok) return [];
  return res.json();
}

async function nominatimReverse(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!res.ok) return null;
  return res.json();
}

const CATEGORIES = [
  { value: 'POTHOLE', label: 'Pothole' },
  { value: 'WATER_LEAK', label: 'Water Leak' },
  { value: 'ELECTRICITY_OUTAGE', label: 'Electricity Outage' },
  { value: 'REFUSE_COLLECTION', label: 'Refuse Collection' },
  { value: 'STREETLIGHT', label: 'Street Light' },
  { value: 'SEWAGE', label: 'Sewage' },
  { value: 'ILLEGAL_DUMPING', label: 'Illegal Dumping' },
  { value: 'GRAFFITI', label: 'Graffiti' },
  { value: 'PARK_MAINTENANCE', label: 'Park Maintenance' },
  { value: 'TRAFFIC_LIGHT', label: 'Traffic Light' },
  { value: 'OTHER', label: 'Other' },
];

const MUNICIPALITIES = [
  { value: 'City of Johannesburg', label: 'City of Johannesburg' },
  { value: 'City of Tshwane', label: 'City of Tshwane' },
  { value: 'City of Ekurhuleni', label: 'City of Ekurhuleni' },
  { value: 'City of Cape Town', label: 'City of Cape Town' },
  { value: 'eThekwini Municipality', label: 'eThekwini Municipality (Durban)' },
  { value: 'Nelson Mandela Bay', label: 'Nelson Mandela Bay' },
  { value: 'Buffalo City', label: 'Buffalo City' },
  { value: 'Msunduzi', label: 'Msunduzi (Pietermaritzburg)' },
];

export default function ReportFault() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    municipality: '',
    address: '',
    latitude: null,
    longitude: null,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [addressSuggestionsLoading, setAddressSuggestionsLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const skipAddressSearchRef = useRef(false);
  const addressWrapperRef = useRef(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === 'address') {
      skipAddressSearchRef.current = false;
      setAddressSuggestions([]);
    }
    setError('');
  };

  // Debounced Nominatim search (400ms)
  useEffect(() => {
    if (skipAddressSearchRef.current) return;
    const q = form.address?.trim() || '';
    if (q.length < 2) {
      setAddressSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      setAddressSuggestionsLoading(true);
      try {
        const results = await nominatimSearch(form.address);
        setAddressSuggestions(Array.isArray(results) ? results : []);
      } catch {
        setAddressSuggestions([]);
      } finally {
        setAddressSuggestionsLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [form.address]);

  // Click outside to close address dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (addressWrapperRef.current && !addressWrapperRef.current.contains(e.target)) {
        setAddressSuggestions([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectAddress = useCallback((result) => {
    const displayName = result.display_name || '';
    const lat = result.lat != null ? parseFloat(result.lat) : null;
    const lon = result.lon != null ? parseFloat(result.lon) : null;
    setForm((prev) => ({
      ...prev,
      address: displayName,
      latitude: lat,
      longitude: lon,
    }));
    setAddressSuggestions([]);
    skipAddressSearchRef.current = true;
  }, []);

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setLocationLoading(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const data = await nominatimReverse(latitude, longitude);
          if (data && data.display_name) {
            setForm((prev) => ({
              ...prev,
              address: data.display_name,
              latitude,
              longitude,
            }));
            setAddressSuggestions([]);
            skipAddressSearchRef.current = true;
          } else {
            setForm((prev) => ({
              ...prev,
              address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
              latitude,
              longitude,
            }));
          }
        } catch {
          setForm((prev) => ({
            ...prev,
            address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            latitude,
            longitude,
          }));
        } finally {
          setLocationLoading(false);
        }
      },
      () => {
        setLocationLoading(false);
        setError('Could not get your location. Please allow location access or enter an address manually.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      const payload = {
        ...form,
        latitude: form.latitude ?? undefined,
        longitude: form.longitude ?? undefined,
      };
      const { data } = await api.post('/reports', payload);
      
      if (data.success) {
        setSuccess(true);
        // Reset form
        setForm({
          title: '',
          description: '',
          category: '',
          municipality: '',
          address: '',
          latitude: null,
          longitude: null,
        });
        
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Failed to submit report. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="bg-white rounded-xl shadow-lg border-t-4 border-[#0d3b5c] p-8 max-w-md w-full text-center">
            <h1 className="text-2xl font-bold text-[#0d3b5c] mb-2">Authentication Required</h1>
            <p className="text-slate-600 mb-6">
              Please log in or register to report a fault.
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => navigate('/login')}
                className="bg-[#0d3b5c] hover:bg-[#0a2d45] text-white font-semibold py-2 px-4 rounded-md transition-colors"
              >
                Log in
              </button>
              <button
                onClick={() => navigate('/register')}
                className="bg-[#1a5f3c] hover:bg-[#145230] text-white font-semibold py-2 px-4 rounded-md transition-colors"
              >
                Register
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1 px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg border-t-4 border-[#0d3b5c] p-8">
            <h1 className="text-2xl font-bold text-[#0d3b5c] mb-2">Report a Fault</h1>
            <p className="text-slate-600 text-sm mb-6">
              Help us improve your community by reporting municipal service issues.
            </p>

            {success && (
              <div className="mb-6 bg-green-50 border border-green-200 rounded-md px-4 py-3">
                <p className="text-green-800 font-medium">✓ Report submitted successfully!</p>
                <p className="text-green-700 text-sm">Redirecting to dashboard...</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              {/* Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  required
                  minLength={10}
                  maxLength={200}
                  value={form.title}
                  onChange={handleChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-[#0d3b5c] focus:ring-1 focus:ring-[#0d3b5c] outline-none"
                  placeholder="e.g., Large pothole on Main Road"
                />
                <p className="text-xs text-slate-500 mt-1">10-200 characters, be specific</p>
              </div>

              {/* Category */}
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-slate-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  id="category"
                  name="category"
                  required
                  value={form.category}
                  onChange={handleChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-[#0d3b5c] focus:ring-1 focus:ring-[#0d3b5c] outline-none"
                >
                  <option value="">Select a category</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Municipality */}
              <div>
  <label className="block text-sm font-medium text-slate-700 mb-1">
    Municipality <span className="text-red-500">*</span>
  </label>
  <MunicipalitySelector
    value={form.municipality}
    onChange={handleChange}
    required
  />
</div>

              {/* Street Address with Nominatim autocomplete */}
              <div ref={addressWrapperRef} className="relative">
                <label htmlFor="address" className="block text-sm font-medium text-slate-700 mb-1">
                  Street Address <span className="text-red-500">*</span>
                </label>
                <input
                  id="address"
                  name="address"
                  type="text"
                  required
                  minLength={5}
                  maxLength={500}
                  value={form.address}
                  onChange={handleChange}
                  autoComplete="off"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-[#0d3b5c] focus:ring-1 focus:ring-[#0d3b5c] outline-none"
                  placeholder="Start typing an address in South Africa..."
                />
                {addressSuggestionsLoading && (
                  <p className="absolute left-3 top-full mt-1 text-xs text-slate-500">Searching...</p>
                )}
                {addressSuggestions.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg max-h-48 overflow-auto">
                    {addressSuggestions.map((result, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 border-b border-slate-100 last:border-0"
                          onClick={() => selectAddress(result)}
                        >
                          {result.display_name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={locationLoading}
                  className="mt-2 text-sm text-[#0d3b5c] hover:underline font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {locationLoading ? 'Getting location...' : 'Use my current location'}
                </button>
                {/* Hidden state: lat/lon are in form.latitude, form.longitude and submitted with form */}
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  required
                  minLength={20}
                  maxLength={2000}
                  rows={5}
                  value={form.description}
                  onChange={handleChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-[#0d3b5c] focus:ring-1 focus:ring-[#0d3b5c] outline-none resize-none"
                  placeholder="Describe the issue in detail (minimum 20 characters)..."
                />
                <p className="text-xs text-slate-500 mt-1">
                  {form.description.length}/2000 characters (minimum 20)
                </p>
              </div>

              {/* Submit Button */}
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-3 px-4 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-[#0d3b5c] hover:bg-[#0a2d45] text-white font-semibold py-3 px-4 rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
