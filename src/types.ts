export type Attachment = {
  name: string;
  uri: string;
  mimeType?: string;
};

export type PlaceCategory = 'Ponto turistico' | 'Restaurante' | 'Farmacia' | 'Mercado';

export type NearbyPlace = {
  name: string;
  category: PlaceCategory;
  distanceKm: number;
};

export type WeatherData = {
  temperature: number;
  description: string;
  windSpeed: number;
};

export type DayType = 'voo' | 'hotel' | 'atividade' | 'logistica';

export type DayDetails = {
  airline?: string;
  flightNumber?: string;
  terminalGate?: string;
  /** Codigo IATA / cidade de origem (ex: GRU) */
  departure?: string;
  /** Codigo IATA / cidade de destino (ex: FCO) */
  arrival?: string;
  /** Data de saída do voo (AAAA-MM-DD), se diferente da data do dia */
  departureDate?: string;
  /** Data de chegada do voo (AAAA-MM-DD), pode ser no dia seguinte */
  arrivalDate?: string;
  hotelName?: string;
  checkIn?: string;
  checkOut?: string;
  reservationCode?: string;
  activityCategory?: string;
  ticketInfo?: string;
  transportMode?: string;
  origin?: string;
  destination?: string;
};

export type DayActivity = {
  id: string;
  title: string;
  time?: string;
  location?: string;
};

export type TripDay = {
  id: string;
  date: string;
  type: DayType;
  title: string;
  time?: string;
  location?: string;
  notes?: string;
  details?: DayDetails;
  activities: DayActivity[];
  checklistItems: string[];
  attachments: Attachment[];
};

export type Trip = {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  days: TripDay[];
  createdAt: string;
  updatedAt: string;
};

export type RootStackParamList = {
  Tabs: undefined;
  Timeline: { tripId: string };
};

export type TabParamList = {
  MinhasViagens: undefined;
  Cadastrar: undefined;
};
