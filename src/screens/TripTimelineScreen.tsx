import { RouteProp, useRoute } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTrips } from '../context/TripsContext';
import { fetchNearbyPlaces, fetchWeather, geocodeAddress } from '../services/contextApi';
import { DayDetails, DayType, NearbyPlace, RootStackParamList, WeatherData } from '../types';
import { webCard, webHero } from '../theme/webTheme';

type TimelineRouteProp = RouteProp<RootStackParamList, 'Timeline'>;

export function TripTimelineScreen() {
  const { width } = useWindowDimensions();
  const isWideWeb = Platform.OS === 'web' && width > 1150;
  const route = useRoute<TimelineRouteProp>();
  const { getTripById } = useTrips();
  const trip = getTripById(route.params.tripId);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!trip) {
      return;
    }
    const loadContext = async () => {
      try {
        setLoading(true);
        setError(null);
        const geoTarget =
          trip.days.find((day) => day.type === 'hotel' && day.location)?.location ??
          trip.days.find((day) => day.location)?.location;
        if (!geoTarget) {
          setError('Nenhum endereco encontrado nos dias para buscar contexto.');
          return;
        }
        const coords = await geocodeAddress(geoTarget, trip.destination);
        if (!coords) {
          setError('Nao foi possivel localizar o endereco principal. Tente ajustar local ou destino.');
          return;
        }
        const [weatherData, nearby] = await Promise.all([
          fetchWeather(coords.lat, coords.lon),
          fetchNearbyPlaces(coords.lat, coords.lon),
        ]);
        setWeather(weatherData);
        setPlaces(nearby);
      } catch {
        setError('Falha ao carregar dados reais de clima e arredores.');
      } finally {
        setLoading(false);
      }
    };
    void loadContext();
  }, [trip]);

  const dayLabels = useMemo(() => {
    if (!trip) {
      return [];
    }
    return [...trip.days].sort((a, b) => a.date.localeCompare(b.date));
  }, [trip]);

  const openUrl = async (url: string) => {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
  };

  if (!trip) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Viagem nao encontrada.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={[styles.hero, isWideWeb && styles.compactCard, webHero]}>
        <Text style={styles.title}>{trip.destination}</Text>
        <Text style={styles.subtitle}>Timeline inteligente com dados reais por dia</Text>
        <Text style={styles.metaHeader}>
          {trip.startDate || '-'} ate {trip.endDate || '-'} • {trip.days.length} dias planejados
        </Text>
      </View>
      {dayLabels.map((day, index) => (
        <View key={day.id} style={isWideWeb ? styles.compactWrapper : undefined}>
          <View style={[styles.badge, index === 0 ? styles.badgeActive : styles.badgeNext]}>
            <Text style={styles.badgeText}>
              Dia {extractDay(day.date)} - {day.type.toUpperCase()}
            </Text>
          </View>
          <View style={[styles.card, isWideWeb && styles.compactCard, webCard]}>
            <Row label="Titulo" value={day.title || '-'} />
            <Row label="Data" value={day.date || '-'} />
            <Row label="Horario" value={day.time || '-'} />
            <Row label="Local" value={day.location || '-'} />
            <Row label="Notas" value={day.notes || '-'} />
            {renderTypedDetails(day.type, day.details)}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Atividades do dia</Text>
              {day.activities.length ? (
                day.activities.map((activity) => (
                  <View key={activity.id} style={styles.activityItem}>
                    <Text style={styles.placeName}>{activity.title || 'Atividade'}</Text>
                    <Text style={styles.metaText}>
                      {activity.time || '--'} • {activity.location || 'Local a definir'}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.metaText}>Sem atividades cadastradas.</Text>
              )}
            </View>

            {day.location ? (
              <Pressable
                style={[styles.button, styles.ghost]}
                onPress={() =>
                  void openUrl(
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      day.location ?? '',
                    )}`,
                  )
                }
              >
                <Text style={styles.buttonText}>Abrir local no mapa</Text>
              </Pressable>
            ) : null}

            {!!day.attachments.length && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Anexos</Text>
                {day.attachments.map((attachment, attachmentIndex) => (
                  <Pressable
                    key={`${attachment.name}-${attachmentIndex}`}
                    style={[styles.button, styles.primary]}
                    onPress={() => void openUrl(attachment.uri)}
                  >
                    <Text style={styles.buttonText}>Abrir: {attachment.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Checklist do dia</Text>
              {day.checklistItems.length ? (
                day.checklistItems.map((item) => (
                  <Text key={item} style={styles.metaText}>
                    • {item}
                  </Text>
                ))
              ) : (
                <Text style={styles.metaText}>Sem itens cadastrados.</Text>
              )}
            </View>
          </View>
        </View>
      ))}

      <View style={[styles.card, isWideWeb && styles.compactCard, webCard]}>
        <Text style={styles.sectionTitle}>Contexto inteligente do destino</Text>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Clima real</Text>
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#60A5FA" />
              <Text style={styles.metaText}>Consultando API...</Text>
            </View>
          ) : weather ? (
            <Text style={styles.metaText}>
              {weather.temperature.toFixed(1)}°C • {weather.description} • vento{' '}
              {weather.windSpeed.toFixed(1)} km/h
            </Text>
          ) : (
            <Text style={styles.metaText}>Sem dados de clima.</Text>
          )}
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lugares proximos</Text>
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#60A5FA" />
              <Text style={styles.metaText}>Buscando pontos no OpenStreetMap...</Text>
            </View>
          ) : places.length ? (
            places.map((place) => (
              <View key={`${place.name}-${place.distanceKm}`} style={styles.placeItem}>
                <Text style={styles.placeName}>{place.name}</Text>
                <Text style={styles.metaText}>
                  {place.distanceKm.toFixed(1)} km • {place.category}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.metaText}>Sem lugares encontrados.</Text>
          )}
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function extractDay(dateText: string) {
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }
  return String(date.getDate());
}

function renderTypedDetails(type: DayType, details?: DayDetails) {
  if (!details) {
    return null;
  }

  if (type === 'voo') {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Detalhes de voo</Text>
        <Row label="Companhia" value={details.airline || '-'} />
        <Row label="Numero voo" value={details.flightNumber || '-'} />
        <Row label="Terminal / portao" value={details.terminalGate || '-'} />
        <Row label="Origem" value={details.departure || '-'} />
        <Row label="Destino" value={details.arrival || '-'} />
      </View>
    );
  }

  if (type === 'hotel') {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Detalhes de hotel</Text>
        <Row label="Hotel" value={details.hotelName || '-'} />
        <Row label="Check-in" value={details.checkIn || '-'} />
        <Row label="Check-out" value={details.checkOut || '-'} />
        <Row label="Reserva" value={details.reservationCode || '-'} />
      </View>
    );
  }

  if (type === 'atividade') {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Detalhes da atividade</Text>
        <Row label="Categoria" value={details.activityCategory || '-'} />
        <Row label="Ingresso / ticket" value={details.ticketInfo || '-'} />
      </View>
    );
  }

  if (type === 'logistica') {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Detalhes de logistica</Text>
        <Row label="Transporte" value={details.transportMode || '-'} />
        <Row label="Origem" value={details.origin || '-'} />
        <Row label="Destino" value={details.destination || '-'} />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#060917',
  },
  content: {
    padding: 16,
    gap: 10,
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
  },
  center: {
    flex: 1,
    backgroundColor: '#0B1020',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#F2F8FF',
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: '#9FC1EE',
    marginTop: 4,
  },
  hero: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#26416E',
    backgroundColor: '#0D1A33',
    padding: 18,
    marginBottom: 8,
  },
  compactWrapper: {
    width: '100%',
    maxWidth: 780,
    alignSelf: 'center',
  },
  metaHeader: {
    color: '#AFC6ED',
    marginTop: 4,
    fontSize: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  badgeActive: {
    backgroundColor: '#13254A',
    borderColor: '#3766CC',
    borderWidth: 1,
  },
  badgeNext: {
    backgroundColor: '#1A2237',
    borderColor: '#354260',
    borderWidth: 1,
  },
  badgeText: {
    color: '#DBEAFE',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#0E1B35',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#294778',
    padding: 18,
    gap: 10,
  },
  compactCard: {
    width: '100%',
    maxWidth: 780,
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingBottom: 8,
    gap: 8,
  },
  label: {
    color: '#9FB0CF',
  },
  value: {
    color: '#E2E8F0',
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  actions: {
    gap: 8,
    marginTop: 4,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primary: {
    backgroundColor: '#2563EB',
  },
  ghost: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    borderWidth: 1,
  },
  buttonText: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  section: {
    marginTop: 8,
    backgroundColor: '#0F172A',
    borderColor: '#1E2A43',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  sectionTitle: {
    color: '#C7D2FE',
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    color: '#CBD5E1',
  },
  placeItem: {
    paddingVertical: 4,
  },
  activityItem: {
    borderWidth: 1,
    borderColor: '#2E4A78',
    backgroundColor: '#122240',
    borderRadius: 10,
    padding: 8,
    gap: 2,
  },
  placeName: {
    color: '#E2E8F0',
    fontWeight: '700',
  },
  errorText: {
    color: '#FCA5A5',
  },
});
