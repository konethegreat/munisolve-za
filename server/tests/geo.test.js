'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { searchPlaces, reversePlace, ATTRIBUTION } = require('../src/services/geo.service');

const SEARCH_ROWS = [
  {
    display_name: 'Braamfontein, Johannesburg, Gauteng, South Africa',
    lat: '-26.1929',
    lon: '28.0320',
    category: 'place',
    type: 'suburb',
    boundingbox: ['-26.2', '-26.18', '28.02', '28.04'],
  },
];

const REVERSE_ROW = {
  display_name: '1 Juta Street, Braamfontein, Johannesburg, South Africa',
  lat: '-26.1929',
  lon: '28.0320',
  address: {
    house_number: '1',
    road: 'Juta Street',
    suburb: 'Braamfontein',
    city: 'Johannesburg',
    state: 'Gauteng',
    postcode: '2001',
    country: 'South Africa',
  },
};

describe('Nominatim geo proxy', () => {
  const realFetch = global.fetch;
  let calls;
  let reply;

  beforeEach(() => {
    calls = [];
    reply = async (_url, _options) =>
      new Response(JSON.stringify(SEARCH_ROWS), { status: 200, headers: { 'content-type': 'application/json' } });
    global.fetch = (url, options) => {
      calls.push({ url, options, at: Date.now() });
      return reply(url, options);
    };
  });

  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.GEO_ENABLED;
  });

  test('searches places with attribution, a User-Agent and a one-day cache', async () => {
    const first = await searchPlaces('Braamfontein', { limit: 3 });

    assert.equal(first.cached, false);
    assert.equal(first.data.attribution, ATTRIBUTION);
    assert.deepEqual(first.data.results, [
      {
        displayName: 'Braamfontein, Johannesburg, Gauteng, South Africa',
        latitude: -26.1929,
        longitude: 28.032,
        category: 'place',
        type: 'suburb',
        boundingBox: [-26.2, -26.18, 28.02, 28.04],
      },
    ]);

    const url = new URL(calls[0].url);
    assert.equal(url.origin, 'https://nominatim.openstreetmap.org');
    assert.equal(url.pathname, '/search');
    assert.equal(url.searchParams.get('q'), 'Braamfontein');
    assert.equal(url.searchParams.get('limit'), '3');
    assert.equal(url.searchParams.get('countrycodes'), 'za');
    assert.match(calls[0].options.headers['User-Agent'], /MuniSolveZA/);

    const second = await searchPlaces('Braamfontein', { limit: 3 });
    assert.equal(second.cached, true);
    assert.equal(calls.length, 1);
  });

  test('reverse geocodes to address components', async () => {
    reply = async () =>
      new Response(JSON.stringify(REVERSE_ROW), { status: 200, headers: { 'content-type': 'application/json' } });

    const { data } = await reversePlace(-26.1929, 28.032);

    assert.equal(data.displayName, '1 Juta Street, Braamfontein, Johannesburg, South Africa');
    assert.equal(data.address.houseNumber, '1');
    assert.equal(data.address.road, 'Juta Street');
    assert.equal(data.address.suburb, 'Braamfontein');
    assert.equal(data.address.city, 'Johannesburg');
    assert.equal(data.address.state, 'Gauteng');
    assert.equal(data.address.postcode, '2001');
    assert.equal(data.attribution, ATTRIBUTION);

    const url = new URL(calls[0].url);
    assert.equal(url.pathname, '/reverse');
    assert.equal(url.searchParams.get('lat'), '-26.1929');
    assert.equal(url.searchParams.get('lon'), '28.032');
  });

  test('serializes upstream calls to at most one per second', async () => {
    await searchPlaces('Soweto', { limit: 1 });
    await searchPlaces('Sandton', { limit: 1 });

    assert.equal(calls.length, 2);
    assert.ok(calls[1].at - calls[0].at >= 900, `calls were ${calls[1].at - calls[0].at}ms apart`);
  });

  test('maps upstream failures to a 502 envelope error', async () => {
    reply = async () => new Response('busy', { status: 503 });
    await assert.rejects(searchPlaces('Pretoria', { limit: 1 }), (error) => {
      assert.equal(error.statusCode, 502);
      assert.equal(error.errorCode, 'UPSTREAM_UNAVAILABLE');
      return true;
    });

    reply = async () => {
      throw new Error('network down');
    };
    await assert.rejects(reversePlace(-25.7479, 28.2293), (error) => {
      assert.equal(error.statusCode, 502);
      assert.equal(error.errorCode, 'UPSTREAM_UNAVAILABLE');
      return true;
    });
  });

  test('rejects bad input and stays inactive when disabled', async () => {
    await assert.rejects(searchPlaces('a'), (error) => error.errorCode === 'INVALID_QUERY');
    await assert.rejects(reversePlace(120, 28), (error) => error.errorCode === 'INVALID_COORDINATES');
    assert.equal(calls.length, 0);

    process.env.GEO_ENABLED = 'false';
    await assert.rejects(searchPlaces('Durban'), (error) => error.errorCode === 'GEO_DISABLED');
    assert.equal(calls.length, 0);
  });
});
