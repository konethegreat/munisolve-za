export type DuplicateFamilyName = 'Roads' | 'Water' | 'Sewage' | 'Power' | 'Lighting' | 'Waste' | 'Other';

export interface DuplicateFamily {
  name: DuplicateFamilyName;
  categories: readonly string[];
  windowMinutes: number;
  radiusMeters: number;
}

const DAY_MINUTES = 24 * 60;

export const DUPLICATE_FAMILIES: readonly DuplicateFamily[] = [
  { name: 'Roads', categories: ['POTHOLE'], windowMinutes: 30 * DAY_MINUTES, radiusMeters: 50 },
  { name: 'Water', categories: ['WATER_LEAK'], windowMinutes: 7 * DAY_MINUTES, radiusMeters: 100 },
  { name: 'Sewage', categories: ['SEWAGE'], windowMinutes: 14 * DAY_MINUTES, radiusMeters: 100 },
  { name: 'Power', categories: ['ELECTRICITY_OUTAGE'], windowMinutes: 6 * 60, radiusMeters: 250 },
  {
    name: 'Lighting',
    categories: ['STREETLIGHT', 'TRAFFIC_LIGHT'],
    windowMinutes: 72 * 60,
    radiusMeters: 100,
  },
  {
    name: 'Waste',
    categories: ['REFUSE_COLLECTION', 'ILLEGAL_DUMPING'],
    windowMinutes: 48 * 60,
    radiusMeters: 100,
  },
  {
    name: 'Other',
    categories: ['GRAFFITI', 'PARK_MAINTENANCE', 'OTHER'],
    windowMinutes: 14 * DAY_MINUTES,
    radiusMeters: 100,
  },
];

const OTHER_FAMILY = DUPLICATE_FAMILIES[DUPLICATE_FAMILIES.length - 1];

export const DUPLICATE_CANDIDATE_THRESHOLD = 0.65;
export const AUTO_MERGE_SCORE = 0.9;
export const MAX_CANDIDATES = 5;

const EARTH_RADIUS_METERS = 6_371_000;

export function familyForCategory(category: string | undefined | null): DuplicateFamily {
  const upper = String(category ?? '').toUpperCase();
  return DUPLICATE_FAMILIES.find((family) => family.categories.includes(upper)) ?? OTHER_FAMILY;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function boundingBox(latitude: number, longitude: number, radiusMeters: number): BoundingBox {
  const latDelta = (radiusMeters / EARTH_RADIUS_METERS) * (180 / Math.PI);
  const lonScale = Math.max(Math.cos((latitude * Math.PI) / 180), 1e-6);
  const lonDelta = latDelta / lonScale;
  const clampLat = (value: number) => Math.max(-90, Math.min(90, value));
  const clampLon = (value: number) => Math.max(-180, Math.min(180, value));
  return {
    minLat: clampLat(latitude - latDelta),
    maxLat: clampLat(latitude + latDelta),
    minLon: clampLon(longitude - lonDelta),
    maxLon: clampLon(longitude + lonDelta),
  };
}

function words(text: string | undefined | null): Set<string> {
  return new Set(
    String(text ?? '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
}

export function titleSimilarity(left: string | undefined | null, right: string | undefined | null): number {
  const a = words(left);
  const b = words(right);
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return (2 * shared) / (a.size + b.size);
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round4 = (value: number) => Math.round(value * 10_000) / 10_000;

export interface DuplicateScoreInput {
  distanceMeters: number;
  radiusMeters: number;
  ageMs: number;
  windowMs: number;
  titleA: string;
  titleB: string;
}

export function duplicateScore({
  distanceMeters,
  radiusMeters,
  ageMs,
  windowMs,
  titleA,
  titleB,
}: DuplicateScoreInput): number {
  const distance = radiusMeters > 0 ? clamp01(1 - distanceMeters / radiusMeters) : 0;
  const recency = windowMs > 0 ? clamp01(1 - ageMs / windowMs) : 0;
  const title = titleSimilarity(titleA, titleB);
  return round4(0.5 * distance + 0.3 * recency + 0.2 * title);
}

export interface DuplicateReport {
  id: number;
  title: string;
  category: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: Date | string;
  userId: number;
}

export interface ScoredDuplicate {
  report: DuplicateReport;
  score: number;
  distanceMeters: number;
}

export interface ScoreCandidatesOptions {
  report: DuplicateReport;
  candidates: DuplicateReport[];
  threshold?: number;
}

export function scoreDuplicateCandidates({
  report,
  candidates,
  threshold = DUPLICATE_CANDIDATE_THRESHOLD,
}: ScoreCandidatesOptions): ScoredDuplicate[] {
  if (report.latitude == null || report.longitude == null) return [];

  const family = familyForCategory(report.category);
  const windowMs = family.windowMinutes * 60 * 1000;
  const reportCreatedAt = new Date(report.createdAt).getTime();

  const scored: ScoredDuplicate[] = [];
  for (const candidate of candidates) {
    if (candidate.id === report.id) continue;
    if (candidate.latitude == null || candidate.longitude == null) continue;
    if (familyForCategory(candidate.category).name !== family.name) continue;

    const ageMs = reportCreatedAt - new Date(candidate.createdAt).getTime();
    if (ageMs < 0 || ageMs > windowMs) continue;

    const distanceMeters = haversineMeters(
      report.latitude,
      report.longitude,
      candidate.latitude,
      candidate.longitude,
    );
    if (distanceMeters > family.radiusMeters) continue;

    const score = duplicateScore({
      distanceMeters,
      radiusMeters: family.radiusMeters,
      ageMs,
      windowMs,
      titleA: report.title,
      titleB: candidate.title,
    });
    if (score < threshold) continue;

    scored.push({ report: candidate, score, distanceMeters });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.distanceMeters - b.distanceMeters || a.report.id - b.report.id)
    .slice(0, MAX_CANDIDATES);
}
