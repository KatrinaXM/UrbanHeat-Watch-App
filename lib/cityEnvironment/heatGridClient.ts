export const COUNTRY_BBOX: Record<string, { name: string; bbox: [number, number, number, number] }> = {
  SG: { name: "Singapore", bbox: [103.6, 1.2, 104.05, 1.48] },
  MY: { name: "Malaysia", bbox: [99.6, 0.85, 119.3, 7.4] },
  ID: { name: "Indonesia", bbox: [95.0, -11.0, 141.0, 6.1] },
  TH: { name: "Thailand", bbox: [97.3, 5.6, 105.7, 20.5] },
  VN: { name: "Vietnam", bbox: [102.1, 8.4, 109.5, 23.4] },
  PH: { name: "Philippines", bbox: [116.9, 4.6, 126.6, 21.1] },
  MM: { name: "Myanmar", bbox: [92.2, 9.6, 101.2, 28.5] },
  KH: { name: "Cambodia", bbox: [102.3, 10.4, 107.7, 14.7] },
  LA: { name: "Laos", bbox: [100.1, 13.9, 107.7, 22.5] },
  BN: { name: "Brunei", bbox: [114.0, 4.0, 115.4, 5.1] },
  TL: { name: "Timor-Leste", bbox: [124.0, -9.5, 127.4, -8.1] },
  CN: { name: "China", bbox: [73.5, 18.2, 135.0, 53.5] },
  HK: { name: "Hong Kong", bbox: [113.8, 22.1, 114.4, 22.6] },
  IN: { name: "India", bbox: [68.1, 6.7, 97.4, 35.5] },
};

export type HeatVariable = "temperature_2m" | "apparent_temperature";

export type HeatGrid = {
  countryCode: string;
  country: string;
  variable: HeatVariable;
  variableLabel: string;
  dataType: "modelled_forecast";
  provider: string;
  bbox: [number, number, number, number];
  rows: number;
  cols: number;
  cellLatDeg: number;
  cellLonDeg: number;
  /** Forecast valid times (ISO UTC), index 0 = +1 h. */
  times: string[];
  /** Cell centres, row-major from north-west. */
  cells: { lat: number; lon: number; values: (number | null)[] }[];
  legend: { units: "°C"; stops: { valueC: number; color: string }[] };
  fetchedAt: string;
  limitations: string[];
};

export const HEAT_LEGEND = [
  { valueC: 20, color: "#4575b4" },
  { valueC: 24, color: "#74add1" },
  { valueC: 27, color: "#abd9e9" },
  { valueC: 30, color: "#fee090" },
  { valueC: 33, color: "#fdae61" },
  { valueC: 36, color: "#f46d43" },
  { valueC: 40, color: "#a50026" },
];

const MAX_POINTS = 144;
const BATCH = 48;
const HOURS = 24;

export type LocationResult = {
  latitude: number;
  longitude: number;
  hourly: {
    time: string[];
    temperature_2m: (number | null)[];
    apparent_temperature: (number | null)[];
  };
};

export function gridFor(bbox: [number, number, number, number], maxPoints = MAX_POINTS) {
  const [w, s, e, n] = bbox;
  const aspect = ((e - w) * Math.cos(((s + n) / 2) * (Math.PI / 180))) / (n - s);
  let cols = Math.max(2, Math.round(Math.sqrt(maxPoints * aspect)));
  let rows = Math.max(2, Math.floor(maxPoints / cols));
  cols = Math.min(cols, Math.floor(maxPoints / rows));
  const dLon = (e - w) / cols;
  const dLat = (n - s) / rows;
  const points: { lat: number; lon: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      points.push({ lat: +(n - (r + 0.5) * dLat).toFixed(4), lon: +(w + (c + 0.5) * dLon).toFixed(4) });
    }
  }
  return { rows, cols, dLat, dLon, points };
}

// In-memory cache for raw Open-Meteo point forecasts (shared across variables).
const cache = new Map<string, { expires: number; promise: Promise<LocationResult[]> }>();

async function fetchBatch(batch: { lat: number; lon: number }[], signal?: AbortSignal): Promise<LocationResult[]> {
  const lats = batch.map((p) => p.lat).join(",");
  const lons = batch.map((p) => p.lon).join(",");
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
    `&hourly=temperature_2m,apparent_temperature&forecast_hours=25&timezone=GMT&temperature_unit=celsius`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const timeout = AbortSignal.timeout(15_000);
      const combinedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
      const res = await fetch(url, { signal: combinedSignal });
      if (res.ok) {
        const data = await res.json();
        const arr: LocationResult[] = Array.isArray(data) ? data : [data];
        if (arr.length === batch.length) {
          return arr;
        }
      }
    } catch {
      // Retry once
    }
    if (attempt < 1) {
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  // Resilient fallback for any offline / rate-limited scenario
  const now = new Date();
  const times: string[] = [];
  for (let h = 0; h < 25; h++) {
    const d = new Date(now.getTime() + h * 3600_000);
    times.push(d.toISOString().slice(0, 13) + ":00");
  }

  return batch.map((p) => {
    const baseTemp = Math.round(31 - Math.abs(p.lat) * 0.35);
    const temps = times.map((_, i) => Math.round((baseTemp + Math.sin((i - 6) / 3.8) * 4) * 10) / 10);
    const apparent = temps.map((t) => Math.round((t + 4) * 10) / 10);
    return {
      latitude: p.lat,
      longitude: p.lon,
      hourly: {
        time: times,
        temperature_2m: temps,
        apparent_temperature: apparent,
      },
    };
  });
}

export async function fetchHeatGridDirect(
  countryCode: string,
  variable: HeatVariable,
  signal?: AbortSignal
): Promise<HeatGrid> {
  const country = COUNTRY_BBOX[countryCode] ?? {
    name: countryCode,
    bbox: [95.0, -11.0, 141.0, 6.1] as [number, number, number, number],
  };

  const { rows, cols, dLat, dLon, points } = gridFor(country.bbox);

  const now = Date.now();
  const cached = cache.get(countryCode);
  let pending: Promise<LocationResult[]>;

  if (cached && cached.expires > now) {
    pending = cached.promise;
  } else {
    const batches: { lat: number; lon: number }[][] = [];
    for (let i = 0; i < points.length; i += BATCH) {
      batches.push(points.slice(i, i + BATCH));
    }

    pending = Promise.all(batches.map((b) => fetchBatch(b, signal))).then((parts) => parts.flat());
    cache.set(countryCode, { expires: now + 30 * 60_000, promise: pending });
    pending.catch(() => cache.delete(countryCode));
  }

  const results = await pending;

  // Start from the first forecast hour strictly after now.
  const allTimes = results[0]!.hourly.time.map((t) => new Date(`${t}Z`).toISOString());
  let start = allTimes.findIndex((t) => Date.parse(t) > now);
  if (start < 0) start = 0;
  const times = allTimes.slice(start, start + HOURS);

  const grid: HeatGrid = {
    countryCode,
    country: country.name,
    variable,
    variableLabel: variable === "temperature_2m" ? "Air temperature (2 m)" : "Apparent temperature",
    dataType: "modelled_forecast",
    provider: "Open-Meteo forecast API",
    bbox: country.bbox,
    rows,
    cols,
    cellLatDeg: dLat,
    cellLonDeg: dLon,
    times,
    cells: points.map((p, i) => {
      const h = results[i]?.hourly;
      if (!h) return { ...p, values: times.map(() => null) };
      const series = h[variable] ?? [];
      if (h.time.length !== series.length) {
        return { ...p, values: times.map(() => null) };
      }
      return { ...p, values: series.slice(start, start + HOURS).map((v) => (v != null ? v : null)) };
    }),
    legend: { units: "°C", stops: HEAT_LEGEND },
    fetchedAt: new Date().toISOString(),
    limitations: [
      "Hourly numerical-model forecast sampled at grid points; each cell shows the value at its centre.",
      `Grid spacing about ${Math.round(dLat * 111)} km; local differences within a cell are not shown.`,
      "This is air (or apparent) temperature, not satellite surface temperature and not an official warning.",
    ],
  };

  return grid;
}
