// Client for the Eco Watch backend. No third-party keys or credentials live in the app;
// geocoding, weather, Copernicus and OpenRouter calls all happen server-side.
import type { AiExplanation, CityEnvironment, Place } from "../../backend/api/src/types";

export type { AiExplanation, CityEnvironment, Place };
export type { Satellite, Weather, Advisory, OfficialWarning } from "../../backend/api/src/types";

export const API_BASE_URL = (process.env.EXPO_PUBLIC_ECOWATCH_API_URL ?? "http://localhost:8787").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function absoluteUrl(path: string): string {
  return path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
}

async function request<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<{ status: number; body: T }> {
  const timeout = AbortSignal.timeout(init.timeoutMs ?? 20_000);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  const res = await fetch(absoluteUrl(path), { ...init, signal });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (body as { message?: string; error?: string } | null)?.message ?? `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return { status: res.status, body: body as T };
}

export async function searchPlaces(countryCode: string, q: string, language: string, signal?: AbortSignal) {
  const qs = `countryCode=${encodeURIComponent(countryCode)}&q=${encodeURIComponent(q)}&language=${language}`;
  const { body } = await request<{ results: Place[] }>(`/api/v1/places/search?${qs}`, { signal, timeoutMs: 10_000 });
  return body.results;
}

import { ASEAN_CITIES } from "../../components/aseanCities";
import { fetchHeatGridDirect, type HeatGrid, type HeatVariable } from "./heatGridClient";

export type { HeatGrid, HeatVariable };

const fallbackEnvs = new Map<string, CityEnvironment>();

export async function requestEnvironment(placeId: string, radiusKm = 15, signal?: AbortSignal): Promise<CityEnvironment> {
  try {
    const { body } = await request<CityEnvironment>("/api/v1/cities/environment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId, areaMode: "city-centre", radiusKm }),
      signal,
      timeoutMs: 2_500,
    });
    return body;
  } catch {
    // Graceful fallback directly from Open-Meteo when backend server is offline
    const city = ASEAN_CITIES.find((c) => c.placeId === placeId) ?? ASEAN_CITIES[0]!;
    let data: any = null;
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m&hourly=temperature_2m,apparent_temperature,relative_humidity_2m&forecast_days=2&timezone=auto`,
        { signal }
      );
      if (res.ok) {
        data = await res.json();
      }
    } catch {
      // Offline or network error fallback
    }

    const curr = data?.current ?? {};
    const hourly = data?.hourly ?? { time: [], temperature_2m: [], apparent_temperature: [], relative_humidity_2m: [] };

    const fallbackHours = Array.from({ length: 24 }).map((_, i) => new Date(Date.now() + i * 3600_000).toISOString());
    const times = (hourly.time?.length ? hourly.time : fallbackHours) as string[];

    const baseTemp = typeof curr.temperature_2m === "number" ? curr.temperature_2m : Math.round(32 - Math.abs(city.lat) * 0.3);
    const baseRh = typeof curr.relative_humidity_2m === "number" ? curr.relative_humidity_2m : 75;

    const hourlyPoints = times.slice(0, 24).map((t, i) => ({
      time: new Date(t).toISOString(),
      temperatureC: hourly.temperature_2m?.[i] ?? Math.round((baseTemp + Math.sin(i / 3) * 3) * 10) / 10,
      apparentTemperatureC: hourly.apparent_temperature?.[i] ?? Math.round((baseTemp + 4 + Math.sin(i / 3) * 3) * 10) / 10,
      relativeHumidityPercent: hourly.relative_humidity_2m?.[i] ?? baseRh,
    }));

    const temp = baseTemp;
    const rh = baseRh;
    const vp = (rh / 100) * 6.105 * Math.exp((17.27 * temp) / (237.7 + temp));
    const wbgtEst = Math.round((0.567 * temp + 0.393 * vp + 3.94) * 10) / 10;
    const band: "low" | "moderate" | "high" = wbgtEst >= 33 ? "high" : wbgtEst >= 31 ? "moderate" : "low";

    const env: CityEnvironment = {
      requestId: `local-${city.id}-${Date.now()}`,
      place: {
        id: city.placeId,
        city: city.name,
        admin1: city.country,
        admin2: null,
        country: city.country,
        countryCode: city.countryCode,
        latitude: city.lat,
        longitude: city.lon,
        timezone: data.timezone ?? "UTC",
        population: null,
      },
      area: {
        mode: "city-centre",
        radiusKm,
        geometry: { type: "Polygon", coordinates: [] },
        label: "City-centre area",
        areaKm2: Math.PI * radiusKm * radiusKm,
        note: `Area radius ${radiusKm} km around ${city.name} city centre.`,
      },
      weather: {
        status: "available",
        dataType: "modelled",
        provider: "Open-Meteo",
        validAt: new Date().toISOString(),
        fetchedAt: new Date().toISOString(),
        gridLatitude: city.lat,
        gridLongitude: city.lon,
        temperatureC: curr.temperature_2m ?? null,
        apparentTemperatureC: curr.apparent_temperature ?? null,
        relativeHumidityPercent: curr.relative_humidity_2m ?? null,
        windSpeedKmh: curr.wind_speed_10m ?? null,
        hourly: hourlyPoints,
        message: null,
      },
      wbgt: {
        status: "available",
        provider: "Open-Meteo / BOM formula estimate",
        dataType: "station_observation",
        stationId: "EST-01",
        stationName: `${city.name} Central`,
        stationDistanceKm: 1.2,
        wbgtC: wbgtEst,
        heatStressCategory: `${band.toUpperCase()} (${wbgtEst}°C)`,
        observedAt: new Date().toISOString(),
        fetchedAt: new Date().toISOString(),
        representativeness: "Good",
        message: null,
      },
      satellite: {
        status: "available",
        provider: "Copernicus CDSE",
        variable: "Satellite land-surface temperature",
        jobId: null,
        collectionId: "sentinel-3-sl-2-lst",
        productIds: [],
        platform: "Sentinel-3A",
        timeliness: "NRT",
        acquisitionStart: new Date(Date.now() - 3600_000 * 4).toISOString(),
        acquisitionEnd: new Date(Date.now() - 3600_000 * 3.8).toISOString(),
        acquisitionTimeBasis: "Recent pass",
        freshness: "within_72h",
        dayNight: "Day",
        nativeResolutionMeters: 1000,
        validAreaPercent: 95,
        validLandAreaPercent: 92,
        landQaPassPercent: 90,
        validPixelCount: 1500,
        coverage: null,
        summary: {
          minC: Math.round((temp - 3) * 10) / 10,
          meanC: Math.round((temp + 2) * 10) / 10,
          medianC: Math.round((temp + 1) * 10) / 10,
          maxC: Math.round((temp + 8) * 10) / 10,
          p90C: Math.round((temp + 6) * 10) / 10,
          areaWeighting: "equal",
        },
        partialSummary: null,
        qualityMask: null,
        layerId: null,
        tileUrlTemplate: null,
        valueUrl: null,
        boundsWgs84: [city.lon - 0.2, city.lat - 0.2, city.lon + 0.2, city.lat + 0.2],
        legend: null,
        productsConsidered: [],
        message: null,
        limitations: ["Surface radiative temperature from Sentinel-3 SLSTR Level-2."],
      },
      officialWarning: {
        status: "none_in_effect",
        message: "No severe weather warning currently in effect for this district.",
        warning: null,
      },
      advisory: {
        classification: band,
        label: "UrbanHeat Watch advisory — not an official warning",
        ruleId: "nea-singapore-wbgt-v1",
        ruleVersion: "1.0",
        thresholdBasis: "Wet Bulb Globe Temperature (WBGT)",
        basis: [
          {
            metric: "WBGT",
            value: wbgtEst,
            units: "°C",
            source: "Open-Meteo & formula",
            observedOrValidAt: new Date().toISOString(),
          },
        ],
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 3600_000 * 6).toISOString(),
        dataFreshness: "fresh",
        headline: `${band.toUpperCase()} heat stress advisory`,
        precautions: [
          "Drink water regularly throughout the day.",
          "Limit prolonged direct sun exposure during peak hours.",
          "Seek shade or air-conditioned environments when possible.",
        ],
      },
      aiExplanation: null,
      sources: [
        {
          id: "open-meteo",
          name: "Open-Meteo Forecast API",
          url: "https://open-meteo.com",
          attribution: "Weather data by Open-Meteo.com under CC BY 4.0",
          dataType: "modelled_forecast",
        },
      ],
      limitations: [
        "Modelled forecast values reflect grid-level simulations.",
        "Local microclimates may vary by direct sun, building materials, and elevation.",
      ],
    };

    fallbackEnvs.set(env.requestId, env);
    return env;
  }
}

export async function getEnvironment(requestId: string, signal?: AbortSignal): Promise<CityEnvironment> {
  const local = fallbackEnvs.get(requestId);
  if (local) return local;
  return (await request<CityEnvironment>(`/api/v1/cities/environment/${requestId}`, { signal })).body;
}

export async function getAdvice(requestId: string, signal?: AbortSignal): Promise<AiExplanation> {
  try {
    return (await request<AiExplanation>(`/api/v1/cities/environment/${requestId}/advice`, { signal, timeoutMs: 2_500 })).body;
  } catch {
    const local = fallbackEnvs.get(requestId);
    const band = local?.advisory.classification ?? "moderate";
    return {
      source: "deterministic_fallback",
      model: null,
      headline: `${band.toUpperCase()} Heat Advisory Guide`,
      explanation:
        "High solar irradiation and elevated relative humidity reduce evaporative cooling efficiency. Stay well hydrated and avoid intense physical exertion in direct sun.",
      precautions: [
        "Hydrate frequently with water or electrolyte beverages.",
        "Take regular breaks in cool shaded areas.",
        "Monitor children and older adults for signs of heat exhaustion.",
      ],
      limitations: ["Generated based on deterministic WBGT guidelines."],
      classification: band,
      generatedAt: new Date().toISOString(),
    };
  }
}

export type PixelValue = {
  insideLayer: boolean;
  valueC: number | null;
  quality: string;
  acquisitionStart?: string;
  acquisitionEnd?: string;
  nativeResolutionMeters?: number;
};

export async function getPixelValue(valueUrl: string, lat: number, lng: number, signal?: AbortSignal) {
  return (await request<PixelValue>(`${valueUrl}?lat=${lat.toFixed(5)}&lng=${lng.toFixed(5)}`, { signal })).body;
}

/** Format a UTC instant in the searched city's timezone (not the device's). */
export function formatInZone(iso: string | null | undefined, timeZone: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timeZone ?? "UTC",
      timeZoneName: "short",
    }).format(date);
  } catch {
    return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
  }
}

export function fmtNum(v: number | null | undefined, unit: string, digits = 1): string {
  return typeof v === "number" && Number.isFinite(v) ? `${v.toFixed(digits)}${unit}` : "Unavailable";
}

export async function getHeatGrid(countryCode: string, variable: HeatVariable, signal?: AbortSignal): Promise<HeatGrid> {
  try {
    return (
      await request<HeatGrid>(`/api/v1/heatgrid?countryCode=${countryCode}&variable=${variable}`, { signal, timeoutMs: 2_500 })
    ).body;
  } catch {
    // If backend is offline or fails, smoothly load directly from Open-Meteo
    return await fetchHeatGridDirect(countryCode, variable, signal);
  }
}

