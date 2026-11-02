'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  AUTO_ASSIGN_MIN_LEAD,
  AUTO_ASSIGN_THRESHOLD,
  haversineKm,
  planAssignment,
  scoreTeams,
  specializationMatchScore,
  specializationMatches,
} = require('../src/domain/assignment');

const NOW = new Date('2026-11-02T12:00:00.000Z');

function report(overrides = {}) {
  return {
    id: 12,
    category: 'POTHOLE',
    municipality: 'City of Johannesburg',
    latitude: 0,
    longitude: 0,
    ...overrides,
  };
}

function team(overrides = {}) {
  return {
    id: 1,
    name: 'Roads Crew',
    specialization: 'Roads & Infrastructure',
    municipality: 'City of Johannesburg',
    latitude: 0,
    longitude: 0,
    isActive: true,
    capacity: 10,
    maxRadiusKm: 20,
    autoAssignEnabled: true,
    activeTickets: 0,
    ...overrides,
  };
}

describe('assignment skills and distance', () => {
  test('maps categories to specialization keywords', () => {
    assert.equal(specializationMatches('POTHOLE', 'Roads & Infrastructure'), true);
    assert.equal(specializationMatches('WATER_LEAK', 'Water & Sanitation'), true);
    assert.equal(specializationMatches('SEWAGE', 'Water & Sanitation'), true);
    assert.equal(specializationMatches('ELECTRICITY_OUTAGE', 'Electricity & Power'), true);
    assert.equal(specializationMatches('REFUSE_COLLECTION', 'Waste Management'), true);
    assert.equal(specializationMatches('POTHOLE', 'Water & Sanitation'), false);
    assert.equal(specializationMatches('OTHER', 'Roads'), false);

    assert.equal(specializationMatchScore('POTHOLE', 'Roads & Infrastructure'), 2);
    assert.equal(specializationMatchScore('POTHOLE', 'Waste Management'), 1);
  });

  test('haversine kilometres match a known city distance', () => {
    const km = haversineKm(-26.2041, 28.0473, -26.2041, 28.0573);

    assert.ok(km > 0.9 && km < 1.1, `expected about 1 km, got ${km}`);
  });
});

describe('team scoring', () => {
  test('filters inactive, full, out-of-radius and wrong-municipality teams', () => {
    const teams = [
      team({ id: 1, name: 'Good' }),
      team({ id: 2, name: 'Inactive', isActive: false }),
      team({ id: 3, name: 'Full', activeTickets: 10 }),
      team({ id: 4, name: 'Far', latitude: 0.5 }),
      team({ id: 5, name: 'Elsewhere', municipality: 'City of Cape Town' }),
      team({ id: 6, name: 'No radius', maxRadiusKm: 0 }),
    ];

    const scored = scoreTeams(report(), teams);

    assert.deepEqual(scored.map((entry) => entry.teamId), [1]);
  });

  test('scores skill, municipality, distance and load', () => {
    const [close] = scoreTeams(report(), [team()]);
    assert.equal(close.score, 100);
    assert.deepEqual(close.reasons, ['skill_match', 'municipality_match', 'distance_0km_of_20km', 'load_0_of_10']);

    const [mismatch] = scoreTeams(report(), [team({ specialization: 'Waste Management' })]);
    assert.equal(mismatch.score, 70);

    const [noMunicipality] = scoreTeams(report(), [team({ municipality: null })]);
    assert.equal(noMunicipality.score, 80);
    assert.ok(!noMunicipality.reasons.includes('municipality_match'));

    const [halfLoad] = scoreTeams(report(), [team({ activeTickets: 5 })]);
    assert.equal(halfLoad.score, 95);
  });
});

describe('planning an assignment', () => {
  test('is skipped while the global switch is off', () => {
    const plan = planAssignment({ report: report(), teams: [team()], enabled: false, now: NOW });

    assert.equal(plan.mode, 'SKIPPED');
    assert.deepEqual(plan.reasons, ['AUTO_ASSIGN_DISABLED']);
    assert.equal(plan.teamId, null);
  });

  test('is skipped without coordinates, for OTHER work or next to a suggested duplicate', () => {
    assert.deepEqual(
      planAssignment({ report: report({ latitude: null }), teams: [team()], now: NOW }).reasons,
      ['NO_COORDINATES'],
    );
    assert.deepEqual(
      planAssignment({ report: report({ category: 'OTHER' }), teams: [team({ specialization: 'General' })], now: NOW }).reasons,
      ['CATEGORY_OTHER'],
    );
    assert.deepEqual(
      planAssignment({ report: report(), teams: [team()], hasSuggestedDuplicate: true, now: NOW }).reasons,
      ['SUGGESTED_DUPLICATE'],
    );
  });

  test('is skipped when no team is eligible, or none opts in', () => {
    assert.deepEqual(
      planAssignment({ report: report(), teams: [team({ latitude: 1 })], now: NOW }).reasons,
      ['NO_ELIGIBLE_TEAM'],
    );
    assert.deepEqual(
      planAssignment({ report: report(), teams: [team({ autoAssignEnabled: false })], now: NOW }).reasons,
      ['TEAM_AUTO_ASSIGN_DISABLED'],
    );
  });

  test('is skipped below the score threshold or without enough lead', () => {
    const low = planAssignment({
      report: report(),
      teams: [team({ municipality: null, specialization: 'Waste Management' })],
      now: NOW,
    });
    assert.equal(low.mode, 'SKIPPED');
    assert.ok(low.reasons.includes('SCORE_BELOW_THRESHOLD'));

    const tight = planAssignment({
      report: report(),
      teams: [
        team({ id: 1, name: 'Winner' }),
        team({ id: 2, name: 'Runner-up', latitude: 0.05 }),
      ],
      now: NOW,
    });
    assert.equal(tight.mode, 'SKIPPED');
    assert.ok(tight.reasons.includes('LEAD_TOO_SMALL'));
    assert.equal(tight.score, 100);
    assert.ok(tight.runnerUpScore > 80);
  });

  test('auto-assigns a clear winner and records the reasons', () => {
    const plan = planAssignment({
      report: report(),
      teams: [
        team({ id: 1, name: 'Winner' }),
        team({ id: 2, name: 'Runner-up', latitude: 0.15 }),
      ],
      now: NOW,
    });

    assert.equal(plan.mode, 'AUTO');
    assert.equal(plan.teamId, 1);
    assert.equal(plan.score, 100);
    assert.ok(plan.score - plan.runnerUpScore >= AUTO_ASSIGN_MIN_LEAD);
    assert.equal(AUTO_ASSIGN_THRESHOLD, 70);
    assert.deepEqual(plan.reasons, ['skill_match', 'municipality_match', 'distance_0km_of_20km', 'load_0_of_10']);
  });
});
