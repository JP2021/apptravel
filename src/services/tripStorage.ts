import AsyncStorage from '@react-native-async-storage/async-storage';
import { Trip } from '../types';

const STORAGE_KEY = '@travel_timeline_trips_v1';
const MOCK_SEED_KEY = '@travel_timeline_mock_seed_v1';

export async function loadTrips(): Promise<Trip[] | null> {
  try {
    const cached = await AsyncStorage.getItem(STORAGE_KEY);
    if (!cached) {
      return null;
    }
    const parsed = JSON.parse(cached) as Trip[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return null;
  }
}

export async function saveTrips(trips: Trip[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}

export async function getMockSeedVersion(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(MOCK_SEED_KEY);
  } catch {
    return null;
  }
}

export async function setMockSeedVersion(version: string) {
  await AsyncStorage.setItem(MOCK_SEED_KEY, version);
}
