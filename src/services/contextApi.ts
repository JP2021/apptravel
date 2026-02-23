import { NearbyPlace, PlaceCategory, WeatherData } from '../types';

const weatherDescriptionMap: Record<number, string> = {
  0: 'Ceu limpo',
  1: 'Predominantemente limpo',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Nevoeiro',
  48: 'Nevoeiro com geada',
  51: 'Garoa leve',
  53: 'Garoa moderada',
  55: 'Garoa intensa',
  61: 'Chuva leve',
  63: 'Chuva moderada',
  65: 'Chuva forte',
  80: 'Pancadas de chuva leves',
  81: 'Pancadas de chuva moderadas',
  82: 'Pancadas de chuva fortes',
  95: 'Tempestade',
};

export async function geocodeAddress(address: string, fallbackCity?: string) {
  const candidates = [address, fallbackCity].filter(Boolean) as string[];

  for (const query of candidates) {
    const endpoints = [
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
      `https://geocode.maps.co/search?q=${encodeURIComponent(query)}&limit=1`,
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint);
        if (!response.ok) {
          continue;
        }
        const data = (await response.json()) as Array<{ lat: string; lon: string }>;
        if (!data.length) {
          continue;
        }
        const lat = Number(data[0].lat);
        const lon = Number(data[0].lon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          return { lat, lon };
        }
      } catch {
        // Tenta o proximo endpoint.
      }
    }

    // Fallback adicional com geocoding da Open-Meteo (boa compatibilidade no browser).
    try {
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=pt&format=json`,
      );
      if (response.ok) {
        const data = (await response.json()) as {
          results?: Array<{ latitude: number; longitude: number }>;
        };
        const first = data.results?.[0];
        if (first && Number.isFinite(first.latitude) && Number.isFinite(first.longitude)) {
          return { lat: first.latitude, lon: first.longitude };
        }
      }
    } catch {
      // Continua tentando proximo candidato.
    }
  }

  return null;
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const endpoint =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&current=temperature_2m,weather_code,wind_speed_10m';
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error('Falha na API de clima');
  }
  const data = (await response.json()) as {
    current: { temperature_2m: number; weather_code: number; wind_speed_10m: number };
  };
  const code = data.current?.weather_code ?? 0;
  return {
    temperature: data.current?.temperature_2m ?? 0,
    description: weatherDescriptionMap[code] ?? 'Condicao nao mapeada',
    windSpeed: data.current?.wind_speed_10m ?? 0,
  };
}

export async function fetchNearbyPlaces(lat: number, lon: number): Promise<NearbyPlace[]> {
  try {
    const wikiEndpoint =
      'https://pt.wikipedia.org/w/api.php' +
      `?action=query&list=geosearch&gscoord=${lat}|${lon}` +
      '&gsradius=10000&gslimit=20&format=json&origin=*';
    const wikiResponse = await fetch(wikiEndpoint);
    if (wikiResponse.ok) {
      const wikiData = (await wikiResponse.json()) as {
        query?: { geosearch?: Array<{ title: string; dist: number }> };
      };
      const wikiPlaces = (wikiData.query?.geosearch ?? [])
        .map((item) => ({
          name: item.title,
          category: 'Ponto turistico' as PlaceCategory,
          distanceKm: (item.dist ?? 0) / 1000,
        }))
        .slice(0, 10);

      if (wikiPlaces.length) {
        return wikiPlaces;
      }
    }
  } catch {
    // Se falhar, continua para fallback Overpass.
  }

  const query = `
[out:json][timeout:25];
(
  nwr["tourism"~"attraction|museum"](around:3000,${lat},${lon});
  nwr["amenity"="restaurant"](around:3000,${lat},${lon});
  nwr["amenity"="pharmacy"](around:3000,${lat},${lon});
  nwr["shop"="supermarket"](around:3000,${lat},${lon});
);
out center 80;
`;

  const endpoints = [
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
    `https://overpass.kumi.systems/api/interpreter?data=${encodeURIComponent(query)}`,
  ];

  let data:
    | {
        elements: Array<{
          lat?: number;
          lon?: number;
          center?: { lat: number; lon: number };
          tags?: { name?: string; amenity?: string; tourism?: string; shop?: string };
        }>;
      }
    | undefined;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        continue;
      }
      data = (await response.json()) as {
        elements: Array<{
          lat?: number;
          lon?: number;
          center?: { lat: number; lon: number };
          tags?: { name?: string; amenity?: string; tourism?: string; shop?: string };
        }>;
      };
      if (data.elements?.length) {
        break;
      }
    } catch {
      // Tenta proximo endpoint.
    }
  }

  if (!data?.elements) {
    throw new Error('Falha na API de lugares');
  }

  const overpassPlaces = data.elements
    .filter((item) => item.tags?.name)
    .map((item) => ({
      name: item.tags?.name ?? 'Sem nome',
      category: resolveCategory(item.tags),
      distanceKm: calculateDistanceKm(
        lat,
        lon,
        item.lat ?? item.center?.lat ?? lat,
        item.lon ?? item.center?.lon ?? lon,
      ),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 10);

  return overpassPlaces;
}

function resolveCategory(tags?: { amenity?: string; tourism?: string; shop?: string }): PlaceCategory {
  if (tags?.amenity === 'restaurant') {
    return 'Restaurante';
  }
  if (tags?.amenity === 'pharmacy') {
    return 'Farmacia';
  }
  if (tags?.shop === 'supermarket') {
    return 'Mercado';
  }
  return 'Ponto turistico';
}

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const deg2rad = (deg: number) => deg * (Math.PI / 180);
  const earthRadius = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}
