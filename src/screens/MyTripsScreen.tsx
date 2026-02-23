import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTrips } from '../context/TripsContext';
import { RootStackParamList, Trip } from '../types';
import { webCard, webHero, webScrollPaddingBottom } from '../theme/webTheme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function MyTripsScreen() {
  const { width } = useWindowDimensions();
  const isWideWeb = Platform.OS === 'web' && width > 1100;
  const navigation = useNavigation<Navigation>();
  const { trips, loading, deleteTrip } = useTrips();

  const handleDelete = (trip: Trip) => {
    if (Platform.OS === 'web') {
      const confirmed = globalThis.confirm?.(
        `Deseja remover a viagem para ${trip.destination}?`,
      );
      if (confirmed) {
        deleteTrip(trip.id);
      }
      return;
    }

    Alert.alert('Excluir viagem', `Deseja remover a viagem para ${trip.destination}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => deleteTrip(trip.id),
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#60A5FA" />
        <Text style={styles.loadingText}>Carregando viagens...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, webScrollPaddingBottom ? { paddingBottom: webScrollPaddingBottom } : null]}
    >
      <View style={[styles.hero, isWideWeb && styles.compactCard, webHero]}>
        <Text style={styles.title}>Minhas viagens</Text>
        <Text style={styles.subtitle}>Linha do tempo inteligente com contexto real por dia.</Text>
      </View>

      {!trips.length ? (
        <View style={[styles.emptyCard, isWideWeb && styles.compactCard, webCard]}>
          <Text style={styles.emptyTitle}>Nenhuma viagem cadastrada</Text>
          <Text style={styles.emptyText}>Use a aba "Cadastrar" para criar sua primeira viagem.</Text>
        </View>
      ) : (
        trips.map((trip) => (
          <View key={trip.id} style={[styles.tripCard, isWideWeb && styles.compactCard, webCard]}>
            <Text style={styles.tripTitle}>{trip.destination}</Text>
            <Text style={styles.tripMeta}>
              {trip.startDate || '-'} • {trip.endDate || '-'}
            </Text>
            <Text style={styles.tripMeta}>{trip.days.length} dias planejados</Text>
            <View style={styles.actions}>
              <Pressable
                style={[styles.button, styles.primary]}
                onPress={() => navigation.navigate('Timeline', { tripId: trip.id })}
              >
                <Text style={styles.buttonText}>Ver timeline</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.danger]} onPress={() => handleDelete(trip)}>
                <Text style={styles.buttonText}>Excluir</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#060917',
  },
  center: {
    flex: 1,
    backgroundColor: '#060917',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#C7D2FE',
  },
  content: {
    padding: 16,
    gap: 10,
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
  },
  hero: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#26416E',
    backgroundColor: '#0D1A33',
    padding: 18,
    marginBottom: 6,
  },
  title: {
    color: '#F1F7FF',
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: '#9FC1EE',
    marginTop: 4,
    fontSize: 15,
  },
  emptyCard: {
    backgroundColor: '#0E1B35',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#294778',
    padding: 18,
    gap: 6,
  },
  emptyTitle: {
    color: '#E2E8F0',
    fontWeight: '700',
  },
  emptyText: {
    color: '#AFC0DF',
  },
  tripCard: {
    backgroundColor: '#0E1B35',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#294778',
    padding: 18,
    gap: 6,
  },
  compactCard: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
  tripTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  tripMeta: {
    color: '#B9CAE7',
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  primary: {
    backgroundColor: '#2563EB',
  },
  danger: {
    backgroundColor: '#B91C1C',
  },
  buttonText: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
});
