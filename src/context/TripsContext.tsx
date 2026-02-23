import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { defaultTrips } from '../mock/defaultTrips';
import { saveMockToJson } from '../services/uploadStorage';
import {
  getMockSeedVersion,
  loadTrips,
  saveTrips,
  setMockSeedVersion,
} from '../services/tripStorage';
import { Attachment, DayDetails, Trip, TripDay } from '../types';

const CURRENT_MOCK_VERSION = 'mock-v2-4days';

type TripsContextValue = {
  trips: Trip[];
  loading: boolean;
  addTrip: (trip: Trip) => void;
  updateTrip: (trip: Trip) => void;
  deleteTrip: (tripId: string) => void;
  getTripById: (tripId: string) => Trip | undefined;
};

const TripsContext = createContext<TripsContextValue | undefined>(undefined);

export function TripsProvider({ children }: { children: ReactNode }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hydrate = async () => {
      const loaded = await loadTrips();
      const lastSeedVersion = await getMockSeedVersion();

      let source: Trip[];
      if (loaded === null) {
        source = defaultTrips;
        await setMockSeedVersion(CURRENT_MOCK_VERSION);
        await saveMockToJson(defaultTrips);
      } else if (loaded.length === 0 && lastSeedVersion !== CURRENT_MOCK_VERSION) {
        source = defaultTrips;
        await setMockSeedVersion(CURRENT_MOCK_VERSION);
        await saveMockToJson(defaultTrips);
      } else {
        source = loaded;
      }

      setTrips(source.map(normalizeTrip).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setLoading(false);
    };
    void hydrate();
  }, []);

  useEffect(() => {
    if (!loading) {
      void saveTrips(trips);
    }
  }, [trips, loading]);

  const value = useMemo<TripsContextValue>(
    () => ({
      trips,
      loading,
      addTrip: (trip) =>
        setTrips((prev) => [trip, ...prev].sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
      updateTrip: (trip) =>
        setTrips((prev) =>
          prev
            .map((current) => (current.id === trip.id ? { ...trip, updatedAt: new Date().toISOString() } : current))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        ),
      deleteTrip: (tripId) => setTrips((prev) => prev.filter((trip) => trip.id !== tripId)),
      getTripById: (tripId) => trips.find((trip) => trip.id === tripId),
    }),
    [trips, loading],
  );

  return <TripsContext.Provider value={value}>{children}</TripsContext.Provider>;
}

export function useTrips() {
  const context = useContext(TripsContext);
  if (!context) {
    throw new Error('useTrips precisa estar dentro de TripsProvider');
  }
  return context;
}

function normalizeTrip(trip: any): Trip {
  if (Array.isArray(trip.days)) {
    return {
      ...trip,
      days: trip.days.map((day: TripDay) => ({
        ...day,
        details: (day.details ?? {}) as DayDetails,
        activities: Array.isArray(day.activities) ? day.activities : [],
        attachments: Array.isArray(day.attachments) ? day.attachments : [],
        checklistItems: Array.isArray(day.checklistItems) ? day.checklistItems : [],
      })),
      startDate: trip.startDate ?? trip.days[0]?.date ?? '',
      endDate: trip.endDate ?? trip.days[trip.days.length - 1]?.date ?? '',
      updatedAt: trip.updatedAt ?? trip.createdAt ?? new Date().toISOString(),
    };
  }

  const legacyDays: TripDay[] = [];
  if (trip.flightDate || trip.flightCompany || trip.flightTime || trip.airportAddress) {
    legacyDays.push({
      id: `legacy-flight-${trip.id}`,
      date: trip.flightDate ?? '',
      type: 'voo',
      title: trip.flightCompany || 'Voo',
      time: trip.flightTime || '',
      location: trip.airportAddress || '',
      notes: trip.terminalGate || '',
      details: {
        airline: trip.flightCompany || '',
        terminalGate: trip.terminalGate || '',
      },
      activities: [],
      checklistItems: Array.isArray(trip.checklistItems) ? trip.checklistItems : [],
      attachments: trip.flightVoucher ? [trip.flightVoucher as Attachment] : [],
    });
  }
  if (trip.hotelDate || trip.hotelName || trip.hotelAddress) {
    legacyDays.push({
      id: `legacy-hotel-${trip.id}`,
      date: trip.hotelDate ?? '',
      type: 'hotel',
      title: trip.hotelName || 'Hotel',
      time: trip.hotelCheckInTime || '',
      location: trip.hotelAddress || '',
      notes: 'Check-in hotel',
      details: {
        hotelName: trip.hotelName || '',
        checkIn: trip.hotelCheckInTime || '',
      },
      activities: [],
      checklistItems: [],
      attachments: trip.hotelVoucher ? [trip.hotelVoucher as Attachment] : [],
    });
  }

  return {
    id: trip.id ?? `${Date.now()}`,
    destination: trip.destination ?? 'Sem destino',
    startDate: trip.flightDate ?? legacyDays[0]?.date ?? '',
    endDate: trip.hotelDate ?? legacyDays[legacyDays.length - 1]?.date ?? '',
    days: legacyDays,
    createdAt: trip.createdAt ?? new Date().toISOString(),
    updatedAt: trip.updatedAt ?? trip.createdAt ?? new Date().toISOString(),
  };
}
