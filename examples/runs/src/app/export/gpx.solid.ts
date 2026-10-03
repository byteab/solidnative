import type { Run } from '../data/runs.solid.ts';

/** Escapes the handful of characters GPX (being XML) cannot carry literally. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * A run as a GPX 1.1 track: one `<trkpt>` per fix, with its time. Readable by Strava, Garmin
 * Connect and most other route tools, which is the point of GPX over a format of the app's own.
 */
export function toGpx(run: Run): string {
  const points = run.route
    .map((point) => {
      const time = `<time>${new Date(point.timestamp).toISOString()}</time>`;
      return `      <trkpt lat="${point.latitude}" lon="${point.longitude}">${time}</trkpt>`;
    })
    .join('\n');

  const name = escapeXml(`Run - ${new Date(run.startedAt).toLocaleDateString()}`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="solidnative Runs" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${name}</name>
    <trkseg>
${points}
    </trkseg>
  </trk>
</gpx>
`;
}

/** The file name a run's GPX export is shared under. */
export function gpxFileName(run: Run): string {
  return `run-${run.startedAt.slice(0, 10)}-${run.id}.gpx`;
}
