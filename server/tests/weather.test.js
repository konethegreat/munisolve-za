'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { getWeatherForLocation } = require('../src/services/weather.service');

const OPEN_METEO = {
  current: {
    temperature_2m: 21.4,
    precipitation: 0.2,
    weather_code: 61,
    wind_speed_10m: 14.5,
    relative_humidity_2m: 72,
  },
};

describe('Open-Meteo weather', () => {
  const realFetch = global.fetch;
  let calls;
  let reply;

  beforeEach(() => {
    calls = [];
    reply = async (url) => {
      calls.push(url);
      return new Response(JSON.stringify(OPEN_METEO), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    global.fetch = (...args) => reply(...args);
  });

  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.WEATHER_ENABLED;
  });

  test('maps Open-Meteo fields without an API key', async () => {
    delete process.env.WEATHER_API_KEY;
    const weather = await getWeatherForLocation(-26.2041, 28.0473);

    assert.deepEqual(weather, {
      weatherTemp: 21.4,
      weatherCondition: 'Slight rain',
      weatherRainfall: 0.2,
      weatherWind: 14.5,
      weatherHumidity: 72,
    });
    assert.equal(calls.length, 1);
    const url = new URL(calls[0]);
    assert.equal(url.origin, 'https://api.open-meteo.com');
    assert.equal(url.pathname, '/v1/forecast');
    assert.equal(url.searchParams.get('latitude'), '-26.2041');
    assert.equal(url.searchParams.get('longitude'), '28.0473');
    assert.match(url.searchParams.get('current'), /weather_code/);
  });

  test('serves a second lookup from the in-memory cache', async () => {
    await getWeatherForLocation(-26.3, 28.1);
    await getWeatherForLocation(-26.3, 28.1);
    assert.equal(calls.length, 1);
  });

  test('returns null when the upstream fails or times out', async () => {
    reply = async () => new Response('busy', { status: 503 });
    assert.equal(await getWeatherForLocation(-26.4, 28.2), null);

    reply = async () => { throw new Error('network down'); };
    assert.equal(await getWeatherForLocation(-26.5, 28.3), null);
  });

  test('returns null without calling upstream when disabled or coordinates are invalid', async () => {
    process.env.WEATHER_ENABLED = 'false';
    assert.equal(await getWeatherForLocation(-26.6, 28.4), null);
    assert.equal(calls.length, 0);

    delete process.env.WEATHER_ENABLED;
    assert.equal(await getWeatherForLocation(undefined, 28.4), null);
    assert.equal(await getWeatherForLocation(200, 28.4), null);
    assert.equal(calls.length, 0);
  });
});
