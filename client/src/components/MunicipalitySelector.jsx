// ==========================================
// MUNICIPALITY SELECTOR COMPONENT
// ==========================================
// Searchable dropdown with all South African municipalities
import { useState, useRef, useEffect } from 'react';

// ==========================================
// ALL SOUTH AFRICAN MUNICIPALITIES
// ==========================================
// eslint-disable-next-line react-refresh/only-export-components
export const MUNICIPALITIES = [
  // ── METROPOLITAN MUNICIPALITIES ──
  { value: 'City of Johannesburg', label: 'City of Johannesburg', province: 'Gauteng', type: 'Metro' },
  { value: 'City of Tshwane', label: 'City of Tshwane (Pretoria)', province: 'Gauteng', type: 'Metro' },
  { value: 'City of Ekurhuleni', label: 'City of Ekurhuleni', province: 'Gauteng', type: 'Metro' },
  { value: 'City of Cape Town', label: 'City of Cape Town', province: 'Western Cape', type: 'Metro' },
  { value: 'eThekwini Municipality', label: 'eThekwini Municipality (Durban)', province: 'KwaZulu-Natal', type: 'Metro' },
  { value: 'Nelson Mandela Bay', label: 'Nelson Mandela Bay (Gqeberha)', province: 'Eastern Cape', type: 'Metro' },
  { value: 'Buffalo City', label: 'Buffalo City (East London)', province: 'Eastern Cape', type: 'Metro' },
  { value: 'Mangaung', label: 'Mangaung (Bloemfontein)', province: 'Free State', type: 'Metro' },

  // ── GAUTENG ──
  { value: 'Emfuleni', label: 'Emfuleni', province: 'Gauteng', type: 'Local' },
  { value: 'Lesedi', label: 'Lesedi', province: 'Gauteng', type: 'Local' },
  { value: 'Merafong City', label: 'Merafong City', province: 'Gauteng', type: 'Local' },
  { value: 'Midvaal', label: 'Midvaal', province: 'Gauteng', type: 'Local' },
  { value: 'Mogale City', label: 'Mogale City (Krugersdorp)', province: 'Gauteng', type: 'Local' },
  { value: 'Rand West City', label: 'Rand West City', province: 'Gauteng', type: 'Local' },

  // ── WESTERN CAPE ──
  { value: 'Beaufort West', label: 'Beaufort West', province: 'Western Cape', type: 'Local' },
  { value: 'Bergrivier', label: 'Bergrivier', province: 'Western Cape', type: 'Local' },
  { value: 'Bitou', label: 'Bitou (Plettenberg Bay)', province: 'Western Cape', type: 'Local' },
  { value: 'Breede Valley', label: 'Breede Valley (Worcester)', province: 'Western Cape', type: 'Local' },
  { value: 'Cape Agulhas', label: 'Cape Agulhas', province: 'Western Cape', type: 'Local' },
  { value: 'Cederberg', label: 'Cederberg', province: 'Western Cape', type: 'Local' },
  { value: 'Drakenstein', label: 'Drakenstein (Paarl)', province: 'Western Cape', type: 'Local' },
  { value: 'George', label: 'George', province: 'Western Cape', type: 'Local' },
  { value: 'Hessequa', label: 'Hessequa', province: 'Western Cape', type: 'Local' },
  { value: 'Kannaland', label: 'Kannaland', province: 'Western Cape', type: 'Local' },
  { value: 'Knysna', label: 'Knysna', province: 'Western Cape', type: 'Local' },
  { value: 'Laingsburg', label: 'Laingsburg', province: 'Western Cape', type: 'Local' },
  { value: 'Langeberg', label: 'Langeberg', province: 'Western Cape', type: 'Local' },
  { value: 'Matzikama', label: 'Matzikama', province: 'Western Cape', type: 'Local' },
  { value: 'Mossel Bay', label: 'Mossel Bay', province: 'Western Cape', type: 'Local' },
  { value: 'Oudtshoorn', label: 'Oudtshoorn', province: 'Western Cape', type: 'Local' },
  { value: 'Overstrand', label: 'Overstrand (Hermanus)', province: 'Western Cape', type: 'Local' },
  { value: 'Prince Albert', label: 'Prince Albert', province: 'Western Cape', type: 'Local' },
  { value: 'Saldanha Bay', label: 'Saldanha Bay', province: 'Western Cape', type: 'Local' },
  { value: 'Stellenbosch', label: 'Stellenbosch', province: 'Western Cape', type: 'Local' },
  { value: 'Swartland', label: 'Swartland (Malmesbury)', province: 'Western Cape', type: 'Local' },
  { value: 'Swellendam', label: 'Swellendam', province: 'Western Cape', type: 'Local' },
  { value: 'Theewaterskloof', label: 'Theewaterskloof', province: 'Western Cape', type: 'Local' },
  { value: 'Witzenberg', label: 'Witzenberg (Ceres)', province: 'Western Cape', type: 'Local' },

  // ── KWAZULU-NATAL ──
  { value: 'Abaqulusi', label: 'Abaqulusi (Vryheid)', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'AmaJuba', label: 'AmaJuba (Newcastle)', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'Big Five Hlabisa', label: 'Big Five Hlabisa', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'Edumbe', label: 'Edumbe', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'eMadlangeni', label: 'eMadlangeni', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'Endumeni', label: 'Endumeni (Dundee)', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'Ezinqoleni', label: 'Ezinqoleni', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'Hibiscus Coast', label: 'Hibiscus Coast (Port Shepstone)', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'Impendle', label: 'Impendle', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'Inkosi Langalibalele', label: 'Inkosi Langalibalele', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'Jozini', label: 'Jozini', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'KwaDukuza', label: 'KwaDukuza (Stanger)', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'Maphumulo', label: 'Maphumulo', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'Mandeni', label: 'Mandeni', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'Msunduzi', label: 'Msunduzi (Pietermaritzburg)', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'Mtubatuba', label: 'Mtubatuba', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'Mthonjaneni', label: 'Mthonjaneni (Melmoth)', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'Nkandla', label: 'Nkandla', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'Nkosazana Dlamini Zuma', label: 'Nkosazana Dlamini Zuma', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'Nongoma', label: 'Nongoma', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'Nquthu', label: 'Nquthu', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'Okhahlamba', label: 'Okhahlamba (Bergville)', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'Ray Nkonyeni', label: 'Ray Nkonyeni', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'Richmond', label: 'Richmond', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'Umdoni', label: 'Umdoni (Scottburgh)', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'uMfolozi', label: 'uMfolozi', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'uMhlathuze', label: 'uMhlathuze (Richards Bay)', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'uMlalazi', label: 'uMlalazi (Eshowe)', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'uMngeni', label: 'uMngeni (Howick)', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'uMshwathi', label: 'uMshwathi', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'uMuziwabantu', label: 'uMuziwabantu', province: 'KwaZulu-Natal', type: 'Local' },
  { value: 'uPhongolo', label: 'uPhongolo', province: 'KwaZulu-Natal', type: 'Local' },

  // ── EASTERN CAPE ──
  { value: 'Amahlathi', label: 'Amahlathi', province: 'Eastern Cape', type: 'Local' },
  { value: 'Blue Crane Route', label: 'Blue Crane Route', province: 'Eastern Cape', type: 'Local' },
  { value: 'Camdeboo', label: 'Camdeboo (Graaff-Reinet)', province: 'Eastern Cape', type: 'Local' },
  { value: 'Dr Beyers Naudé', label: 'Dr Beyers Naudé', province: 'Eastern Cape', type: 'Local' },
  { value: 'Enoch Mgijima', label: 'Enoch Mgijima (Queenstown)', province: 'Eastern Cape', type: 'Local' },
  { value: 'Great Kei', label: 'Great Kei', province: 'Eastern Cape', type: 'Local' },
  { value: 'Ikwezi', label: 'Ikwezi', province: 'Eastern Cape', type: 'Local' },
  { value: 'Intsika Yethu', label: 'Intsika Yethu (Cofimvaba)', province: 'Eastern Cape', type: 'Local' },
  { value: 'Inxuba Yethemba', label: 'Inxuba Yethemba (Cradock)', province: 'Eastern Cape', type: 'Local' },
  { value: 'King Sabata Dalindyebo', label: 'King Sabata Dalindyebo (Mthatha)', province: 'Eastern Cape', type: 'Local' },
  { value: 'Kouga', label: 'Kouga (Jeffreys Bay)', province: 'Eastern Cape', type: 'Local' },
  { value: 'Kou-Kamma', label: 'Kou-Kamma', province: 'Eastern Cape', type: 'Local' },
  { value: 'Makana', label: 'Makana (Makhanda/Grahamstown)', province: 'Eastern Cape', type: 'Local' },
  { value: 'Malahleni', label: 'Malahleni', province: 'Eastern Cape', type: 'Local' },
  { value: 'Mbhashe', label: 'Mbhashe', province: 'Eastern Cape', type: 'Local' },
  { value: 'Mbizana', label: 'Mbizana', province: 'Eastern Cape', type: 'Local' },
  { value: 'Mhlontlo', label: 'Mhlontlo', province: 'Eastern Cape', type: 'Local' },
  { value: 'Mnquma', label: 'Mnquma (Butterworth)', province: 'Eastern Cape', type: 'Local' },
  { value: 'Ndlambe', label: 'Ndlambe (Port Alfred)', province: 'Eastern Cape', type: 'Local' },
  { value: 'Ngquza Hill', label: 'Ngquza Hill', province: 'Eastern Cape', type: 'Local' },
  { value: 'Nyandeni', label: 'Nyandeni', province: 'Eastern Cape', type: 'Local' },
  { value: 'Port St Johns', label: 'Port St Johns', province: 'Eastern Cape', type: 'Local' },
  { value: 'Raymond Mhlaba', label: 'Raymond Mhlaba (Fort Beaufort)', province: 'Eastern Cape', type: 'Local' },
  { value: 'Senqu', label: 'Senqu (Aliwal North)', province: 'Eastern Cape', type: 'Local' },
  { value: 'Sakhisizwe', label: 'Sakhisizwe', province: 'Eastern Cape', type: 'Local' },
  { value: 'Sunday River Valley', label: 'Sunday River Valley', province: 'Eastern Cape', type: 'Local' },
  { value: 'Walter Sisulu', label: 'Walter Sisulu', province: 'Eastern Cape', type: 'Local' },

  // ── LIMPOPO ──
  { value: 'Ba-Phalaborwa', label: 'Ba-Phalaborwa', province: 'Limpopo', type: 'Local' },
  { value: 'Bela-Bela', label: 'Bela-Bela (Warmbaths)', province: 'Limpopo', type: 'Local' },
  { value: 'Fetakgomo Tubatse', label: 'Fetakgomo Tubatse', province: 'Limpopo', type: 'Local' },
  { value: 'Greater Giyani', label: 'Greater Giyani', province: 'Limpopo', type: 'Local' },
  { value: 'Greater Letaba', label: 'Greater Letaba (Tzaneen)', province: 'Limpopo', type: 'Local' },
  { value: 'Greater Tzaneen', label: 'Greater Tzaneen', province: 'Limpopo', type: 'Local' },
  { value: 'Lephalale', label: 'Lephalale (Ellisras)', province: 'Limpopo', type: 'Local' },
  { value: 'Lepelle-Nkumpi', label: 'Lepelle-Nkumpi', province: 'Limpopo', type: 'Local' },
  { value: 'Limkhokho', label: 'Limkhokho', province: 'Limpopo', type: 'Local' },
  { value: 'Maruleng', label: 'Maruleng', province: 'Limpopo', type: 'Local' },
  { value: 'Modimolle-Mookgophi', label: 'Modimolle-Mookgophi (Nylstroom)', province: 'Limpopo', type: 'Local' },
  { value: 'Mogalakwena', label: 'Mogalakwena (Mokopane)', province: 'Limpopo', type: 'Local' },
  { value: 'Molemole', label: 'Molemole', province: 'Limpopo', type: 'Local' },
  { value: 'Musina', label: 'Musina (Messina)', province: 'Limpopo', type: 'Local' },
  { value: 'Makhado', label: 'Makhado (Louis Trichardt)', province: 'Limpopo', type: 'Local' },
  { value: 'Polokwane', label: 'Polokwane', province: 'Limpopo', type: 'Local' },
  { value: 'Thabazimbi', label: 'Thabazimbi', province: 'Limpopo', type: 'Local' },
  { value: 'The Bakenberg', label: 'The Bakenberg', province: 'Limpopo', type: 'Local' },
  { value: 'Thulamela', label: 'Thulamela (Thohoyandou)', province: 'Limpopo', type: 'Local' },

  // ── MPUMALANGA ──
  { value: 'Albert Luthuli', label: 'Albert Luthuli', province: 'Mpumalanga', type: 'Local' },
  { value: 'Dipaleseng', label: 'Dipaleseng', province: 'Mpumalanga', type: 'Local' },
  { value: 'Dr JS Moroka', label: 'Dr JS Moroka (Siyabuswa)', province: 'Mpumalanga', type: 'Local' },
  { value: 'Emalahleni', label: 'Emalahleni (Witbank)', province: 'Mpumalanga', type: 'Local' },
  { value: 'Emakhazeni', label: 'Emakhazeni (Belfast)', province: 'Mpumalanga', type: 'Local' },
  { value: 'Govan Mbeki', label: 'Govan Mbeki (Secunda)', province: 'Mpumalanga', type: 'Local' },
  { value: 'Lekwa', label: 'Lekwa (Standerton)', province: 'Mpumalanga', type: 'Local' },
  { value: 'Mkhondo', label: 'Mkhondo (Piet Retief)', province: 'Mpumalanga', type: 'Local' },
  { value: 'Msukaligwa', label: 'Msukaligwa (Ermelo)', province: 'Mpumalanga', type: 'Local' },
  { value: 'Mbombela', label: 'Mbombela (Nelspruit)', province: 'Mpumalanga', type: 'Local' },
  { value: 'Nkomazi', label: 'Nkomazi (Komatipoort)', province: 'Mpumalanga', type: 'Local' },
  { value: 'Pixley Ka Seme', label: 'Pixley Ka Seme', province: 'Mpumalanga', type: 'Local' },
  { value: 'Steve Tshwete', label: 'Steve Tshwete (Middelburg)', province: 'Mpumalanga', type: 'Local' },
  { value: 'Thaba Chweu', label: 'Thaba Chweu (Lydenburg)', province: 'Mpumalanga', type: 'Local' },
  { value: 'Thembisile Hani', label: 'Thembisile Hani', province: 'Mpumalanga', type: 'Local' },
  { value: 'Victor Khanye', label: 'Victor Khanye (Delmas)', province: 'Mpumalanga', type: 'Local' },

  // ── NORTH WEST ──
  { value: 'Ditsobotla', label: 'Ditsobotla (Lichtenburg)', province: 'North West', type: 'Local' },
  { value: 'Ga-Segonyana', label: 'Ga-Segonyana', province: 'North West', type: 'Local' },
  { value: 'Greater Taung', label: 'Greater Taung', province: 'North West', type: 'Local' },
  { value: 'JB Marks', label: 'JB Marks (Potchefstroom)', province: 'North West', type: 'Local' },
  { value: 'Kagisano-Molopo', label: 'Kagisano-Molopo', province: 'North West', type: 'Local' },
  { value: 'Kgetlengrivier', label: 'Kgetlengrivier', province: 'North West', type: 'Local' },
  { value: 'Lekwa-Teemane', label: 'Lekwa-Teemane', province: 'North West', type: 'Local' },
  { value: 'Madibeng', label: 'Madibeng (Brits)', province: 'North West', type: 'Local' },
  { value: 'Mahikeng', label: 'Mahikeng', province: 'North West', type: 'Local' },
  { value: 'Mamusa', label: 'Mamusa (Schweizer-Reneke)', province: 'North West', type: 'Local' },
  { value: 'Moretele', label: 'Moretele', province: 'North West', type: 'Local' },
  { value: 'Moses Kotane', label: 'Moses Kotane', province: 'North West', type: 'Local' },
  { value: 'Naledi', label: 'Naledi', province: 'North West', type: 'Local' },
  { value: 'Ramotshere Moiloa', label: 'Ramotshere Moiloa', province: 'North West', type: 'Local' },
  { value: 'Ratlou', label: 'Ratlou', province: 'North West', type: 'Local' },
  { value: 'Rustenburg', label: 'Rustenburg', province: 'North West', type: 'Local' },
  { value: 'Tswaing', label: 'Tswaing (Delareyville)', province: 'North West', type: 'Local' },

  // ── FREE STATE ──
  { value: 'Dihlabeng', label: 'Dihlabeng (Bethlehem)', province: 'Free State', type: 'Local' },
  { value: 'Kopanong', label: 'Kopanong', province: 'Free State', type: 'Local' },
  { value: 'Letsemeng', label: 'Letsemeng', province: 'Free State', type: 'Local' },
  { value: 'Mafube', label: 'Mafube (Frankfort)', province: 'Free State', type: 'Local' },
  { value: 'Masilonyana', label: 'Masilonyana (Theunissen)', province: 'Free State', type: 'Local' },
  { value: 'Matjhabeng', label: 'Matjhabeng (Welkom)', province: 'Free State', type: 'Local' },
  { value: 'Metsimaholo', label: 'Metsimaholo (Sasolburg)', province: 'Free State', type: 'Local' },
  { value: 'Mohokare', label: 'Mohokare (Zastron)', province: 'Free State', type: 'Local' },
  { value: 'Moqhaka', label: 'Moqhaka (Kroonstad)', province: 'Free State', type: 'Local' },
  { value: 'Mantsopa', label: 'Mantsopa (Ladybrand)', province: 'Free State', type: 'Local' },
  { value: 'Maluti-a-Phofung', label: 'Maluti-a-Phofung (Harrismith)', province: 'Free State', type: 'Local' },
  { value: 'Nala', label: 'Nala (Bothaville)', province: 'Free State', type: 'Local' },
  { value: 'Ngwathe', label: 'Ngwathe (Parys)', province: 'Free State', type: 'Local' },
  { value: 'Nketoana', label: 'Nketoana (Reitz)', province: 'Free State', type: 'Local' },
  { value: 'Phumelela', label: 'Phumelela (Vrede)', province: 'Free State', type: 'Local' },
  { value: 'Setsoto', label: 'Setsoto (Ficksburg)', province: 'Free State', type: 'Local' },
  { value: 'Tokologo', label: 'Tokologo', province: 'Free State', type: 'Local' },
  { value: 'Tswelopele', label: 'Tswelopele (Bultfontein)', province: 'Free State', type: 'Local' },

  // ── NORTHERN CAPE ──
  { value: 'Dawid Kruiper', label: 'Dawid Kruiper (Upington)', province: 'Northern Cape', type: 'Local' },
  { value: 'Dikgatlong', label: 'Dikgatlong (Barkly West)', province: 'Northern Cape', type: 'Local' },
  { value: 'Emthanjeni', label: 'Emthanjeni (De Aar)', province: 'Northern Cape', type: 'Local' },
  { value: 'Gamagara', label: 'Gamagara', province: 'Northern Cape', type: 'Local' },
  { value: 'Ga-Segonyana', label: 'Ga-Segonyana (Kuruman)', province: 'Northern Cape', type: 'Local' },
  { value: 'Hantam', label: 'Hantam (Calvinia)', province: 'Northern Cape', type: 'Local' },
  { value: 'Joe Morolong', label: 'Joe Morolong', province: 'Northern Cape', type: 'Local' },
  { value: 'John Taolo Gaetsewe', label: 'John Taolo Gaetsewe', province: 'Northern Cape', type: 'Local' },
  { value: 'Kareeberg', label: 'Kareeberg', province: 'Northern Cape', type: 'Local' },
  { value: 'Karoo Hoogland', label: 'Karoo Hoogland', province: 'Northern Cape', type: 'Local' },
  { value: 'Khâi-Ma', label: 'Khâi-Ma', province: 'Northern Cape', type: 'Local' },
  { value: 'Magareng', label: 'Magareng (Warrenton)', province: 'Northern Cape', type: 'Local' },
  { value: 'Nama Khoi', label: 'Nama Khoi (Springbok)', province: 'Northern Cape', type: 'Local' },
  { value: 'Phokwane', label: 'Phokwane', province: 'Northern Cape', type: 'Local' },
  { value: 'Renosterberg', label: 'Renosterberg', province: 'Northern Cape', type: 'Local' },
  { value: 'Richtersveld', label: 'Richtersveld', province: 'Northern Cape', type: 'Local' },
  { value: 'Siyancuma', label: 'Siyancuma (Douglas)', province: 'Northern Cape', type: 'Local' },
  { value: 'Siyathemba', label: 'Siyathemba (Prieska)', province: 'Northern Cape', type: 'Local' },
  { value: 'Sol Plaatje', label: 'Sol Plaatje (Kimberley)', province: 'Northern Cape', type: 'Local' },
  { value: 'Thembelihle', label: 'Thembelihle', province: 'Northern Cape', type: 'Local' },
  { value: 'Ubuntu', label: 'Ubuntu (Victoria West)', province: 'Northern Cape', type: 'Local' },
  { value: 'Umsobomvu', label: 'Umsobomvu (Colesberg)', province: 'Northern Cape', type: 'Local' },
];

// ==========================================
// SEARCHABLE MUNICIPALITY SELECTOR
// ==========================================
export default function MunicipalitySelector({ value, onChange, required = false }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Filter municipalities by search term
  const filtered = MUNICIPALITIES.filter((m) =>
    m.label.toLowerCase().includes(search.toLowerCase()) ||
    m.province.toLowerCase().includes(search.toLowerCase())
  );

  // Group by province
  const grouped = filtered.reduce((acc, m) => {
    if (!acc[m.province]) acc[m.province] = [];
    acc[m.province].push(m);
    return acc;
  }, {});

  // Selected municipality label
  const selected = MUNICIPALITIES.find((m) => m.value === value);

  const handleSelect = (muni) => {
    onChange({ target: { name: 'municipality', value: muni.value } });
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="relative" ref={ref}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full text-left rounded-md border px-3 py-2 text-sm transition-colors
          ${open
            ? 'border-[#0d3b5c] ring-1 ring-[#0d3b5c]'
            : 'border-slate-300 hover:border-slate-400'
          }
          ${!selected ? 'text-slate-400' : 'text-slate-800'}
        `}
      >
        <span className="flex items-center justify-between">
          <span>
            {selected ? (
              <>
                {selected.label}
                <span className="ml-2 text-xs text-slate-400">({selected.province})</span>
              </>
            ) : (
              'Search for your municipality...'
            )}
          </span>
          <span className="text-slate-400">{open ? '▲' : '▼'}</span>
        </span>
      </button>

      {/* Hidden input for form validation */}
      <input
        type="text"
        required={required}
        value={value}
        onChange={() => {}}
        className="sr-only"
        tabIndex={-1}
      />

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-72 overflow-hidden flex flex-col">
          {/* Search Input */}
          <div className="p-2 border-b border-slate-100">
            <input
              type="text"
              autoFocus
              placeholder="Search by name or province..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md outline-none focus:border-[#0d3b5c]"
            />
          </div>

          {/* Results */}
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-6">
                No municipalities found for "{search}"
              </p>
            ) : (
              Object.entries(grouped).map(([province, munis]) => (
                <div key={province}>
                  {/* Province Header */}
                  <div className="px-3 py-1.5 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide sticky top-0">
                    {province}
                  </div>
                  {/* Municipality Options */}
                  {munis.map((muni) => (
                    <button
                      key={muni.value}
                      type="button"
                      onClick={() => handleSelect(muni)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors
                        ${value === muni.value ? 'bg-blue-50 text-[#0d3b5c] font-medium' : 'text-slate-700'}
                      `}
                    >
                      {muni.label}
                      {muni.type === 'Metro' && (
                        <span className="ml-2 text-xs bg-[#0d3b5c] text-white px-1.5 py-0.5 rounded">
                          Metro
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}