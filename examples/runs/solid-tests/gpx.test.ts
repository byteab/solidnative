import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Run } from '../src/app/data/runs.solid.ts';
import { escapeXml, gpxFileName, toGpx } from '../src/app/export/gpx.solid.ts';

const run: Run = {
  id: 'r1',
  startedAt: '2026-09-20T07:00:00.000Z',
  durationSeconds: 120,
  distanceMeters: 500,
  route: [
    { latitude: 51.5313, longitude: -0.1568, timestamp: Date.parse('2026-09-20T07:00:00.000Z') },
    { latitude: 51.5327, longitude: -0.1591, timestamp: Date.parse('2026-09-20T07:01:00.000Z') },
    { latitude: 51.5346, longitude: -0.1608, timestamp: Date.parse('2026-09-20T07:02:00.000Z') },
  ],
  splits: [],
};

test('exports a valid GPX 1.1 document', () => {
  const gpx = toGpx(run);

  assert.ok(gpx.includes('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(gpx.includes('<gpx version="1.1"'));
  assert.ok(gpx.includes('xmlns="http://www.topografix.com/GPX/1/1"'));
});

test('writes one trkpt per recorded fix, with its coordinates and time', () => {
  const gpx = toGpx(run);

  assert.ok(gpx.includes('<trkpt lat="51.5313" lon="-0.1568">'));
  assert.ok(gpx.includes('<trkpt lat="51.5346" lon="-0.1608">'));
  assert.ok(gpx.includes('<time>2026-09-20T07:01:00.000Z</time>'));
  assert.equal((gpx.match(/<trkpt/g) ?? []).length, 3);
});

test('names the track after the run', () => {
  const gpx = toGpx(run);
  assert.ok(gpx.includes('<name>Run - '));
});

test('escapes characters XML cannot carry literally', () => {
  assert.equal(
    escapeXml('Tom & Jerry <run> "fast"'),
    'Tom &amp; Jerry &lt;run&gt; &quot;fast&quot;',
  );
});

test('the file name is stable and identifies the run', () => {
  assert.equal(gpxFileName(run), 'run-2026-09-20-r1.gpx');
});
