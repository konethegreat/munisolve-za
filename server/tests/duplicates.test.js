'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  AUTO_MERGE_SCORE,
  DUPLICATE_CANDIDATE_THRESHOLD,
  MAX_CANDIDATES,
  boundingBox,
  duplicateScore,
  familyForCategory,
  haversineMeters,
  scoreDuplicateCandidates,
  titleSimilarity,
} = require('../src/domain/duplicates');

const NOW = new Date('2026-11-02T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function candidate(overrides = {}) {
  return {
    id: 1,
    title: 'Pothole on Main Road',
    category: 'POTHOLE',
    latitude: -26.2041,
    longitude: 28.0473,
    createdAt: new Date(NOW.getTime() - 60 * 60 * 1000),
    userId: 9,
    status: 'PENDING',
    ...overrides,
  };
}

function report(overrides = {}) {
  return {
    id: 2,
    title: 'Pothole on Main Road',
    category: 'POTHOLE',
    latitude: -26.2041,
    longitude: 28.0473,
    createdAt: NOW,
    userId: 9,
    ...overrides,
  };
}

describe('duplicate families', () => {
  test('groups categories into the documented families, windows and radii', () => {
    assert.deepEqual(familyForCategory('POTHOLE'), {
      name: 'Roads', categories: ['POTHOLE'], windowMinutes: 30 * 24 * 60, radiusMeters: 50,
    });
    assert.equal(familyForCategory('WATER_LEAK').radiusMeters, 100);
    assert.equal(familyForCategory('WATER_LEAK').windowMinutes, 7 * 24 * 60);
    assert.equal(familyForCategory('ELECTRICITY_OUTAGE').windowMinutes, 6 * 60);
    assert.equal(familyForCategory('SEWAGE').windowMinutes, 14 * 24 * 60);

    const lighting = familyForCategory('STREETLIGHT');
    assert.equal(lighting.name, 'Lighting');
    assert.deepEqual(lighting.categories, ['STREETLIGHT', 'TRAFFIC_LIGHT']);
    assert.deepEqual(familyForCategory('TRAFFIC_LIGHT'), lighting);

    assert.equal(familyForCategory('REFUSE_COLLECTION').name, 'Waste');
    assert.equal(familyForCategory('ILLEGAL_DUMPING').name, 'Waste');
    assert.equal(familyForCategory('UNKNOWN_CATEGORY').name, 'Other');
    assert.equal(familyForCategory(undefined).name, 'Other');
  });
});

describe('distance and bounding box', () => {
  test('haversine distance is accurate enough for a city block', () => {
    const metres = haversineMeters(-26.2041, 28.0473, -26.2041, 28.0475);

    assert.ok(metres > 15 && metres < 25, `expected about 20 m, got ${metres}`);
  });

  test('a bounding box contains the radius and excludes a point beyond it', () => {
    const box = boundingBox(-26.2041, 28.0473, 100);

    assert.ok(box.minLat < -26.2041 && box.maxLat > -26.2041);
    assert.ok(box.minLon < 28.0473 && box.maxLon > 28.0473);

    const inside = haversineMeters(-26.2041, 28.0473, -26.2041, 28.0482);
    const outside = haversineMeters(-26.2041, 28.0473, -26.2041, 28.0503);
    assert.ok(inside <= 100);
    assert.ok(outside > 100);
    assert.ok(box.maxLon >= 28.0482 && box.maxLon < 28.0503);
  });
});

describe('title similarity', () => {
  test('compares lowercase word sets with the Dice coefficient', () => {
    assert.equal(titleSimilarity('Pothole on Main Road', 'Pothole on Main Road'), 1);
    assert.equal(titleSimilarity('Pothole!!!', 'pothole'), 1);
    assert.equal(titleSimilarity('', ''), 0);

    const partial = titleSimilarity('Pothole on Main Road', 'Pothole Main Road');
    assert.ok(Math.abs(partial - 6 / 7) < 1e-9, `expected 6/7, got ${partial}`);
  });
});

describe('duplicate scoring', () => {
  test('weights distance, recency and title, clamped to 0..1', () => {
    const samePlace = duplicateScore({
      distanceMeters: 0,
      radiusMeters: 50,
      ageMs: 0,
      windowMs: 30 * DAY,
      titleA: 'Pothole on Main Road',
      titleB: 'Pothole on Main Road',
    });
    assert.equal(samePlace, 1);

    const half = duplicateScore({
      distanceMeters: 25,
      radiusMeters: 50,
      ageMs: 0,
      windowMs: 30 * DAY,
      titleA: 'Pothole on Main Road',
      titleB: 'Pothole on Main Road',
    });
    assert.equal(half, 0.75);

    const far = duplicateScore({
      distanceMeters: 500,
      radiusMeters: 50,
      ageMs: 31 * DAY,
      windowMs: 30 * DAY,
      titleA: 'Pothole on Main Road',
      titleB: 'Broken water pipe',
    });
    assert.equal(far, 0);
  });

  test('returns scored candidates above the threshold, best first, capped', () => {
    const close = candidate({ id: 1, createdAt: new Date(NOW.getTime() - 60 * 60 * 1000) });
    const mid = candidate({
      id: 2,
      latitude: -26.204504,
      createdAt: new Date(NOW.getTime() - 10 * DAY),
      title: 'Road damage',
    });
    const far = candidate({ id: 3, latitude: -26.2051, title: 'Pothole' });

    const scored = scoreDuplicateCandidates({ report: report(), candidates: [mid, far, close], threshold: DUPLICATE_CANDIDATE_THRESHOLD });

    assert.deepEqual(scored.map((entry) => entry.report.id), [1]);
    assert.ok(scored[0].score >= DUPLICATE_CANDIDATE_THRESHOLD);
    assert.ok(scored[0].distanceMeters < 1);
  });

  test('never suggests a report without coordinates or a different family, and never itself', () => {
    assert.deepEqual(
      scoreDuplicateCandidates({ report: report({ latitude: null }), candidates: [candidate()] }),
      [],
    );

    const otherFamily = candidate({ id: 4, category: 'WATER_LEAK' });
    assert.deepEqual(scoreDuplicateCandidates({ report: report(), candidates: [otherFamily] }), []);

    const self = candidate({ id: 2 });
    assert.deepEqual(scoreDuplicateCandidates({ report: report(), candidates: [self] }), []);
  });

  test('caps the returned list and marks the same-reporter auto-merge score', () => {
    const candidates = Array.from({ length: MAX_CANDIDATES + 3 }, (_, index) =>
      candidate({ id: index + 10, latitude: -26.2041 + index * 0.00001 }),
    );
    const scored = scoreDuplicateCandidates({ report: report(), candidates });

    assert.equal(scored.length, MAX_CANDIDATES);
    assert.equal(AUTO_MERGE_SCORE, 0.9);
    assert.ok(scored.every((entry) => entry.report.userId === report().userId));
  });
});
