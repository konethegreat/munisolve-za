export const AUTO_ASSIGN_MIN_AGE_MINUTES = 5;
export const AUTO_ASSIGN_THRESHOLD = 70;
export const AUTO_ASSIGN_MIN_LEAD = 15;
export const DEFAULT_TEAM_CAPACITY = 10;
export const DEFAULT_TEAM_RADIUS_KM = 20;

export const CATEGORY_SKILL_KEYWORDS: Record<string, readonly string[]> = {
  POTHOLE: ['Roads', 'Infrastructure'],
  WATER_LEAK: ['Water', 'Sanitation'],
  SEWAGE: ['Water', 'Sanitation'],
  ELECTRICITY_OUTAGE: ['Electricity', 'Power'],
  STREETLIGHT: ['Electricity', 'Infrastructure'],
  TRAFFIC_LIGHT: ['Electricity', 'Infrastructure'],
  REFUSE_COLLECTION: ['Waste'],
  ILLEGAL_DUMPING: ['Waste'],
  GRAFFITI: ['Waste', 'Infrastructure'],
  PARK_MAINTENANCE: ['Infrastructure'],
  OTHER: [],
};

export function specializationMatches(category: string | undefined | null, specialization: string | undefined | null): boolean {
  const keywords = CATEGORY_SKILL_KEYWORDS[String(category ?? '').toUpperCase()] ?? [];
  const haystack = String(specialization ?? '').toUpperCase();
  return keywords.some((keyword) => haystack.includes(keyword.toUpperCase()));
}

// Kept for the supervisor suggestion endpoint, which weights a match as 2 and no match as 1.
export function specializationMatchScore(category: string, specialization: string): 2 | 1 {
  return specializationMatches(category, specialization) ? 2 : 1;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface AssignmentReport {
  id: number;
  category: string;
  municipality?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface AssignmentTeam {
  id: number;
  name?: string;
  specialization: string;
  municipality?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isActive?: boolean;
  capacity?: number;
  maxRadiusKm?: number;
  autoAssignEnabled?: boolean;
  activeTickets?: number;
}

export interface TeamScore {
  teamId: number;
  score: number;
  distanceKm: number;
  autoAssignEnabled: boolean;
  reasons: string[];
}

export interface AssignmentPlan {
  mode: 'AUTO' | 'SKIPPED';
  teamId: number | null;
  score: number | null;
  runnerUpScore: number | null;
  reasons: string[];
}

const round1 = (value: number) => Math.round(value * 10) / 10;
const sameText = (left: string, right: string) => left.trim().toLowerCase() === right.trim().toLowerCase();

export function scoreTeams(report: AssignmentReport, teams: AssignmentTeam[]): TeamScore[] {
  const reportLat = report.latitude;
  const reportLon = report.longitude;
  const reportMunicipality = String(report.municipality ?? '').trim();

  const scored: TeamScore[] = [];
  for (const team of teams) {
    if (team.isActive === false) continue;

    const capacity = team.capacity ?? DEFAULT_TEAM_CAPACITY;
    const activeTickets = team.activeTickets ?? 0;
    if (capacity <= 0 || activeTickets >= capacity) continue;

    const maxRadiusKm = team.maxRadiusKm ?? DEFAULT_TEAM_RADIUS_KM;
    if (maxRadiusKm <= 0) continue;

    if (reportLat == null || reportLon == null || team.latitude == null || team.longitude == null) continue;

    const teamMunicipality = String(team.municipality ?? '').trim();
    const municipalityMatch = reportMunicipality !== '' && teamMunicipality !== ''
      && sameText(reportMunicipality, teamMunicipality);
    if (reportMunicipality !== '' && teamMunicipality !== '' && !municipalityMatch) continue;

    const distanceKm = haversineKm(reportLat, reportLon, team.latitude, team.longitude);
    if (distanceKm > maxRadiusKm) continue;

    const skillMatch = specializationMatches(report.category, team.specialization);
    const skillScore = skillMatch ? 40 : 10;
    const municipalityScore = municipalityMatch ? 20 : 0;
    const distanceScore = 30 * (1 - distanceKm / maxRadiusKm);
    const loadScore = 10 * (1 - activeTickets / capacity);

    scored.push({
      teamId: team.id,
      score: round1(skillScore + municipalityScore + distanceScore + loadScore),
      distanceKm: round1(distanceKm),
      autoAssignEnabled: team.autoAssignEnabled === true,
      reasons: [
        skillMatch ? 'skill_match' : 'skill_mismatch',
        ...(municipalityMatch ? ['municipality_match'] : []),
        `distance_${round1(distanceKm)}km_of_${round1(maxRadiusKm)}km`,
        `load_${activeTickets}_of_${capacity}`,
      ],
    });
  }

  return scored.sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm || a.teamId - b.teamId);
}

export interface PlanAssignmentOptions {
  report: AssignmentReport;
  teams: AssignmentTeam[];
  enabled?: boolean;
  hasSuggestedDuplicate?: boolean;
  threshold?: number;
  minLead?: number;
}

export function planAssignment({
  report,
  teams,
  enabled = true,
  hasSuggestedDuplicate = false,
  threshold = AUTO_ASSIGN_THRESHOLD,
  minLead = AUTO_ASSIGN_MIN_LEAD,
}: PlanAssignmentOptions): AssignmentPlan {
  const skipped = (reasons: string[], score: number | null = null, runnerUpScore: number | null = null): AssignmentPlan => ({
    mode: 'SKIPPED',
    teamId: null,
    score,
    runnerUpScore,
    reasons,
  });

  if (!enabled) return skipped(['AUTO_ASSIGN_DISABLED']);
  if (report.latitude == null || report.longitude == null) return skipped(['NO_COORDINATES']);
  if (String(report.category ?? '').toUpperCase() === 'OTHER') return skipped(['CATEGORY_OTHER']);
  if (hasSuggestedDuplicate) return skipped(['SUGGESTED_DUPLICATE']);

  const scored = scoreTeams(report, teams);
  if (scored.length === 0) return skipped(['NO_ELIGIBLE_TEAM']);

  const optedIn = scored.filter((entry) => entry.autoAssignEnabled);
  if (optedIn.length === 0) return skipped(['TEAM_AUTO_ASSIGN_DISABLED']);

  const [top, runnerUp] = optedIn;
  const runnerUpScore = runnerUp?.score ?? null;

  if (top.score < threshold) return skipped([...top.reasons, 'SCORE_BELOW_THRESHOLD'], top.score, runnerUpScore);
  if (top.score - (runnerUp?.score ?? 0) < minLead) {
    return skipped([...top.reasons, 'LEAD_TOO_SMALL'], top.score, runnerUpScore);
  }

  return {
    mode: 'AUTO',
    teamId: top.teamId,
    score: top.score,
    runnerUpScore,
    reasons: top.reasons,
  };
}
