import * as DocumentPicker from 'expo-document-picker';
import { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTrips } from '../context/TripsContext';
import { copyAttachmentToUpload } from '../services/uploadStorage';
import type { TripFormSnapshot } from '../services/travelAgent';
import { buildTripFromAttachments, hasOpenAIKey } from '../services/travelAgent';
import { extractTextFromAllAttachments } from '../services/fileExtract';
import { Attachment, DayActivity, DayDetails, DayType, Trip, TripDay } from '../types';
import { normalizeDateOnly } from '../utils/dateUtils';
import { webCard, webHero, webScrollPaddingBottom } from '../theme/webTheme';

type FormState = {
  destination: string;
  startDate: string;
  endDate: string;
  days: Array<
    Omit<TripDay, 'checklistItems' | 'attachments'> & {
      checklistText: string;
      attachments: Attachment[];
    }
  >;
};

const createEmptyActivity = (index = 1): DayActivity => ({
  id: `temp-activity-${Date.now()}-${index}`,
  title: '',
  time: '',
  location: '',
});

const createEmptyDay = (index = 1): FormState['days'][number] => ({
  id: `temp-day-${Date.now()}-${index}`,
  date: '',
  type: 'atividade',
  title: '',
  time: '',
  location: '',
  notes: '',
  details: {},
  activities: [createEmptyActivity(1)],
  checklistText: '',
  attachments: [],
});

const initialForm: FormState = {
  destination: '',
  startDate: '',
  endDate: '',
  days: [createEmptyDay()],
};

function applyAgentUpdates(prev: FormState, updates: TripFormSnapshot): FormState {
  const next: FormState = { ...prev };
  if (updates.destination !== undefined) next.destination = updates.destination;
  if (updates.startDate !== undefined) next.startDate = normalizeDateOnly(updates.startDate);
  if (updates.endDate !== undefined) next.endDate = normalizeDateOnly(updates.endDate);
  if (updates.days !== undefined && updates.days.length > 0) {
    const mapped = updates.days.map((d, i) => {
      let acts = (d.activities ?? []).map((a, j) => ({
        id: `temp-activity-${Date.now()}-${i}-${j}`,
        title: a.title ?? '',
        time: a.time ?? '',
        location: a.location ?? '',
      }));
      if (acts.length === 0 && (d.title?.trim() || d.time?.trim() || d.location?.trim())) {
        acts = [
          {
            id: `temp-activity-${Date.now()}-${i}-0`,
            title: d.title ?? '',
            time: d.time ?? '',
            location: d.location ?? '',
          },
        ];
      }
      return {
        id: prev.days[i]?.id ?? `temp-day-${Date.now()}-${i}`,
        date: normalizeDateOnly(d.date) || '',
        type: d.type ?? 'atividade',
        title: d.title ?? '',
        time: d.time ?? '',
        location: d.location ?? '',
        notes: d.notes ?? '',
        details: (d.details as DayDetails) ?? {},
        activities: acts.length ? acts : [createEmptyActivity(1)],
        checklistText: (d.checklistItems ?? []).join(', '),
        attachments: prev.days[i]?.attachments ?? [],
      };
    });
    next.days = mapped.length ? mapped : [createEmptyDay()];
  }
  return next;
}

function formToSnapshot(form: FormState): TripFormSnapshot {
  return {
    destination: form.destination || undefined,
    startDate: form.startDate || undefined,
    endDate: form.endDate || undefined,
    days: form.days
      .filter((d) => d.date.trim() || d.title.trim())
      .map((d) => ({
        date: d.date,
        type: d.type,
        title: d.title || undefined,
        time: d.time || undefined,
        location: d.location || undefined,
        notes: d.notes || undefined,
        details: Object.keys(d.details ?? {}).length ? (d.details as Record<string, string>) : undefined,
        activities: d.activities?.map((a) => ({
          title: a.title || undefined,
          time: a.time || undefined,
          location: a.location || undefined,
        })),
        checklistItems: d.checklistText ? d.checklistText.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      })),
  };
}

export function CreateTripScreen() {
  const { width } = useWindowDimensions();
  const isWebWide = width >= 980;
  const { trips, addTrip, updateTrip, deleteTrip } = useTrips();
  const [form, setForm] = useState<FormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bulkAttachments, setBulkAttachments] = useState<Attachment[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [aiLogs, setAiLogs] = useState<string[]>([]);
  const formSnapshot = useMemo(() => formToSnapshot(form), [form]);

  const addLog = (msg: string) => {
    setAiLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const notify = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      globalThis.alert?.(`${title}\n\n${message}`);
      return;
    }
    Alert.alert(title, message);
  };

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateDay = (dayId: string, patch: Partial<FormState['days'][number]>) => {
    setForm((prev) => ({
      ...prev,
      days: prev.days.map((day) => (day.id === dayId ? { ...day, ...patch } : day)),
    }));
  };

  const updateDayDetail = (dayId: string, key: keyof DayDetails, value: string) => {
    const current = form.days.find((day) => day.id === dayId);
    if (!current) {
      return;
    }
    updateDay(dayId, {
      details: {
        ...(current.details ?? {}),
        [key]: value,
      },
    });
  };

  const addActivityToDay = (dayId: string) => {
    const current = form.days.find((day) => day.id === dayId);
    if (!current) {
      return;
    }
    updateDay(dayId, {
      activities: [...current.activities, createEmptyActivity(current.activities.length + 1)],
    });
  };

  const updateActivity = (dayId: string, activityId: string, patch: Partial<DayActivity>) => {
    const current = form.days.find((day) => day.id === dayId);
    if (!current) {
      return;
    }
    updateDay(dayId, {
      activities: current.activities.map((activity) =>
        activity.id === activityId ? { ...activity, ...patch } : activity,
      ),
    });
  };

  const removeActivity = (dayId: string, activityId: string) => {
    const current = form.days.find((day) => day.id === dayId);
    if (!current) {
      return;
    }
    const next = current.activities.filter((activity) => activity.id !== activityId);
    updateDay(dayId, {
      activities: next.length ? next : [createEmptyActivity(1)],
    });
  };

  const removeDay = (dayId: string) => {
    setForm((prev) => ({
      ...prev,
      days: prev.days.length > 1 ? prev.days.filter((day) => day.id !== dayId) : prev.days,
    }));
  };

  const addDay = () => {
    setForm((prev) => ({
      ...prev,
      days: [...prev.days, createEmptyDay(prev.days.length + 1)],
    }));
  };

  const pickAttachment = async (dayId: string) => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) {
      return;
    }
    const file = result.assets[0];
    const savedUri = await copyAttachmentToUpload(file.uri, file.name, dayId);
    const uri = savedUri ?? file.uri;
    const attachment: Attachment = {
      name: file.name,
      uri,
      mimeType: file.mimeType,
    };
    updateDay(dayId, {
      attachments: [
        ...(form.days.find((day) => day.id === dayId)?.attachments ?? []),
        attachment,
      ],
    });
  };

  const removeAttachment = (dayId: string, index: number) => {
    const current = form.days.find((day) => day.id === dayId);
    if (!current) {
      return;
    }
    updateDay(dayId, {
      attachments: current.attachments.filter((_, attachmentIndex) => attachmentIndex !== index),
    });
  };

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
  };

  const editTrip = (trip: Trip) => {
    setEditingId(trip.id);
    setForm({
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      days: trip.days.map((day) => ({
        ...day,
        details: day.details ?? {},
        activities: day.activities?.length ? day.activities : [createEmptyActivity(1)],
        checklistText: day.checklistItems.join(', '),
      })),
    });
  };

  const dayTypeLabel = (type: DayType) => {
    if (type === 'voo') return 'Voo';
    if (type === 'hotel') return 'Hotel';
    if (type === 'logistica') return 'Logistica';
    return 'Atividade';
  };

  const parsedDays = useMemo(
    () =>
      form.days.map((day) => ({
        ...day,
        activities: day.activities
          .map((activity) => ({
            ...activity,
            title: activity.title.trim(),
            time: activity.time?.trim() ?? '',
            location: activity.location?.trim() ?? '',
          }))
          .filter((activity) => activity.title || activity.time || activity.location),
        checklistItems: day.checklistText
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      })),
    [form.days],
  );

  const saveTrip = () => {
    const filledDays = parsedDays.filter((day) => {
      const hasActivities = day.activities.some(
        (activity) => activity.title || activity.time || activity.location,
      );
      return Boolean(
        day.title.trim() ||
          day.date.trim() ||
          day.time?.trim() ||
          day.location?.trim() ||
          day.notes?.trim() ||
          hasActivities ||
          day.checklistItems.length ||
          day.attachments.length,
      );
    });

    if (!form.destination.trim()) {
      notify('Cadastro incompleto', 'Preencha o destino da viagem.');
      return;
    }

    if (!filledDays.length) {
      notify('Cadastro incompleto', 'Adicione ao menos um dia com informacoes.');
      return;
    }

    const daysWithoutDate = filledDays.filter((day) => !day.date.trim());
    if (daysWithoutDate.length > 0) {
      const names = daysWithoutDate.map((d) => d.title?.trim() || d.activities?.[0]?.title?.trim() || 'Dia sem título').filter(Boolean);
      const msg = names.length
        ? `Falta a data nestes passeios/dias: ${names.join(', ')}. Preencha a data no formulário ou peça ao assistente: "Qual a data do passeio [nome]?"`
        : 'Cada dia preenchido precisa ter pelo menos a data. Preencha a data ou peça ao assistente.';
      notify('Cadastro incompleto', msg);
      return;
    }

    const orderedDays = [...filledDays].sort((a, b) => a.date.localeCompare(b.date));
    const startDate = normalizeDateOnly(form.startDate || orderedDays[0]?.date || '');
    const endDate = normalizeDateOnly(form.endDate || orderedDays[orderedDays.length - 1]?.date || '');

    const trip: Trip = {
      id: editingId ?? `${Date.now()}`,
      destination: form.destination,
      startDate,
      endDate,
      days: orderedDays.map((day) => ({
        id: day.id,
        date: normalizeDateOnly(day.date) || day.date,
        type: day.type,
        title: (day.title && day.title.trim()) ? day.title.trim() : dayTypeLabel(day.type),
        time: day.time,
        location: day.location,
        notes: day.notes,
        details: day.details ?? {},
        activities: day.activities,
        checklistItems: day.checklistItems,
        attachments: day.attachments,
      })),
      createdAt: editingId
        ? trips.find((tripItem) => tripItem.id === editingId)?.createdAt ?? new Date().toISOString()
        : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (editingId) {
      updateTrip(trip);
      notify('Atualizada', 'Viagem editada com sucesso.');
    } else {
      addTrip(trip);
      notify('Sucesso', 'Viagem cadastrada.');
    }
    resetForm();
  };

  const handleDeleteTrip = (trip: Trip) => {
    if (Platform.OS === 'web') {
      const confirmed = globalThis.confirm?.(`Deseja excluir ${trip.destination}?`);
      if (confirmed) {
        deleteTrip(trip.id);
        if (editingId === trip.id) {
          resetForm();
        }
      }
      return;
    }

    Alert.alert('Excluir viagem', `Deseja excluir ${trip.destination}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          deleteTrip(trip.id);
          if (editingId === trip.id) {
            resetForm();
          }
        },
      },
    ]);
  };

  const pickBulkAttachments = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
      multiple: true,
    } as any);
    if (result.canceled) {
      return;
    }
    const assets = result.assets ?? [];
    const newAttachments: Attachment[] = [];
    for (const file of assets) {
      const savedUri = await copyAttachmentToUpload(file.uri, file.name, 'bulk');
      const uri = savedUri ?? file.uri;
      newAttachments.push({
        name: file.name,
        uri,
        mimeType: file.mimeType,
      });
    }
    setBulkAttachments((prev) => [...prev, ...newAttachments]);
  };

  const removeBulkAttachment = (index: number) => {
    setBulkAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const generateTripFromAttachments = async () => {
    if (!bulkAttachments.length) {
      notify('Sem anexos', 'Adicione ao menos um anexo para gerar a viagem com IA.');
      return;
    }
    if (!hasOpenAIKey()) {
      notify('Chave da IA ausente', 'Configure EXPO_PUBLIC_OPENAI_API_KEY no .env para usar a IA.');
      return;
    }
    setBulkLoading(true);
    setAiLogs([]);
    addLog(`Anexos: ${bulkAttachments.length} arquivo(s)`);
    try {
      addLog('Extraindo texto dos anexos...');
      const text = await extractTextFromAllAttachments(
        bulkAttachments.map((att) => ({
          uri: att.uri,
          name: att.name,
          mimeType: att.mimeType,
        })),
      );
      addLog(`Texto extraído: ${text.length} caracteres`);
      addLog(`Preview (início): ${text.slice(0, 400).replace(/\n/g, ' ')}${text.length > 400 ? '...' : ''}`);
      if (!text.trim()) {
        addLog('ERRO: texto extraído está vazio');
        notify('Falha na extração', 'Não foi possível extrair texto dos anexos. Tente anexar PDFs ou arquivos .txt.');
        setBulkLoading(false);
        return;
      }

      const isExtractionError =
        /\[Erro ao extrair PDF|Failed to fetch|EXPO_PUBLIC_EXTRACT_PDF_API_URL|API está rodando/i.test(text.trim());
      if (isExtractionError) {
        addLog('ERRO: o "texto" extraído é uma mensagem de erro da API de PDF, não o conteúdo dos arquivos.');
        notify(
          'API de PDF indisponível',
          'A extração de PDF falhou (Failed to fetch). Verifique se a API está rodando e se EXPO_PUBLIC_EXTRACT_PDF_API_URL no .env está correta. Local: npm run api na porta 3006.',
        );
        setBulkLoading(false);
        return;
      }

      addLog('Chamando IA para montar roteiro (buildTripFromAttachments)...');
      const snapshot = await buildTripFromAttachments(text);
      const daysCount = snapshot.days?.length ?? 0;
      addLog(`IA retornou: destination="${snapshot.destination ?? ''}", startDate="${snapshot.startDate ?? ''}", endDate="${snapshot.endDate ?? ''}", days.length=${daysCount}`);
      if (daysCount === 0) {
        addLog('ERRO: snapshot.days está vazio ou não é array.');
        addLog(`Resposta bruta (primeiros 600 chars): ${JSON.stringify(snapshot).slice(0, 600)}`);
        notify('Roteiro vazio', 'A IA não conseguiu montar nenhum dia a partir dos anexos. Veja os logs abaixo.');
        setBulkLoading(false);
        return;
      }

      const daysFromSnapshot =
        snapshot.days?.map((d, i) => ({
          id: `ai-day-${Date.now()}-${i}`,
          date: normalizeDateOnly(d.date) || d.date,
          type: d.type,
          title: d.title?.trim() || dayTypeLabel(d.type),
          time: d.time ?? '',
          location: d.location ?? '',
          notes: d.notes ?? '',
          details: (d.details as DayDetails) ?? {},
          activities: (d.activities ?? []).map((a, j) => ({
            id: `ai-activity-${Date.now()}-${i}-${j}`,
            title: a.title ?? '',
            time: a.time ?? '',
            location: a.location ?? '',
          })),
          checklistItems: d.checklistItems ?? [],
          attachments: [],
        })) ?? [];

      if (!daysFromSnapshot.length) {
        notify('Roteiro vazio', 'A IA não conseguiu montar nenhum dia a partir dos anexos.');
        return;
      }

      const orderedDays = [...daysFromSnapshot].sort((a, b) => a.date.localeCompare(b.date));
      const startDate =
        normalizeDateOnly(snapshot.startDate || orderedDays[0]?.date || '') ||
        (snapshot.startDate || orderedDays[0]?.date || '');
      const endDate =
        normalizeDateOnly(snapshot.endDate || orderedDays[orderedDays.length - 1]?.date || '') ||
        (snapshot.endDate || orderedDays[orderedDays.length - 1]?.date || '');

      const trip: Trip = {
        id: `${Date.now()}`,
        destination: snapshot.destination || 'Viagem sem destino',
        startDate,
        endDate,
        days: orderedDays,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      addTrip(trip);
      addLog('Viagem salva com sucesso.');
      notify('Sucesso', 'Viagem criada automaticamente a partir dos anexos.');
      setBulkAttachments([]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog(`ERRO: ${msg}`);
      if (e instanceof Error && e.stack) {
        addLog(`Stack: ${e.stack.slice(0, 300)}`);
      }
      notify('Erro ao gerar viagem com IA', msg);
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, webScrollPaddingBottom ? { paddingBottom: webScrollPaddingBottom } : null]}
      >
      <View style={[styles.hero, webHero]}>
        <Text style={styles.title}>Studio de Viagens</Text>
        <Text style={styles.subtitle}>
          Cadastro completo com edicao, exclusao e roteiro por dias dinamicos.
        </Text>
      </View>

      <View style={[styles.assistantChip, webCard]}>
        <Text style={styles.assistantChipText}>Gerar viagem automaticamente a partir de anexos (IA)</Text>
        <Pressable style={[styles.button, styles.secondary]} onPress={() => void pickBulkAttachments()}>
          <Text style={styles.primaryText}>Selecionar anexos (PDF/TXT)</Text>
        </Pressable>
        {bulkAttachments.length ? (
          <View style={styles.attachWrap}>
            {bulkAttachments.map((att, index) => (
              <View key={`${att.name}-${index}`} style={styles.attachItem}>
                <Text style={styles.fileText}>{att.name}</Text>
                <Pressable onPress={() => removeBulkAttachment(index)}>
                  <Text style={styles.removeText}>remover</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.fileText}>Nenhum anexo selecionado ainda.</Text>
        )}
        <Pressable
          style={[styles.button, styles.save, bulkLoading && { opacity: 0.7 }]}
          onPress={() => void generateTripFromAttachments()}
          disabled={bulkLoading}
        >
          <Text style={styles.primaryText}>
            {bulkLoading ? 'Gerando viagem com IA...' : 'Gerar viagem com IA e salvar'}
          </Text>
        </Pressable>
        {aiLogs.length > 0 ? (
          <View style={styles.logBox}>
            <Text style={styles.logTitle}>Log da última geração</Text>
            <ScrollView style={styles.logScroll} nestedScrollEnabled>
              <Text style={styles.logText} selectable>
                {aiLogs.join('\n')}
              </Text>
            </ScrollView>
          </View>
        ) : null}
      </View>

      <View style={isWebWide ? styles.gridWrap : undefined}>
        <View style={[styles.formCard, isWebWide && styles.formCardWide, webCard]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{editingId ? 'Editar viagem' : 'Nova viagem'}</Text>
            {editingId ? (
              <Pressable style={styles.chipGhost} onPress={resetForm}>
                <Text style={styles.chipGhostText}>Cancelar edicao</Text>
              </Pressable>
            ) : null}
          </View>

          <Field
            label="Destino"
            value={form.destination}
            onChangeText={(value) => updateField('destination', value)}
            placeholder="Ex: Roma"
          />
          <View style={styles.row2}>
            <View style={styles.flex1}>
              <Field
                label="Inicio (AAAA-MM-DD)"
                value={form.startDate}
                onChangeText={(value) => updateField('startDate', value)}
                placeholder="2026-06-14"
              />
            </View>
            <View style={styles.flex1}>
              <Field
                label="Fim (AAAA-MM-DD)"
                value={form.endDate}
                onChangeText={(value) => updateField('endDate', value)}
                placeholder="2026-06-20"
              />
            </View>
          </View>

          {form.days.map((day, index) => (
            <View key={day.id} style={[styles.dayCard, webCard]}>
              <View style={styles.sectionHeader}>
                <Text style={styles.dayTitle}>Dia {index + 1}</Text>
                <Pressable style={styles.chipGhost} onPress={() => removeDay(day.id)}>
                  <Text style={styles.chipGhostText}>Remover dia</Text>
                </Pressable>
              </View>

              <View style={styles.typeRow}>
                {(['voo', 'hotel', 'atividade', 'logistica'] as DayType[]).map((type) => (
                  <Pressable
                    key={type}
                    style={[styles.typeChip, day.type === type && styles.typeChipActive]}
                    onPress={() => updateDay(day.id, { type })}
                  >
                    <Text style={[styles.typeChipText, day.type === type && styles.typeChipTextActive]}>
                      {dayTypeLabel(type)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Field
                label={
                  day.type === 'voo' ? 'Data principal do voo (AAAA-MM-DD)' : 'Data'
                }
                value={day.date}
                onChangeText={(value) => updateDay(day.id, { date: value })}
                placeholder="2026-06-14"
              />
              <Field
                label="Titulo do dia"
                value={day.title}
                onChangeText={(value) => updateDay(day.id, { title: value })}
                placeholder="Ex: ITA Airways AZ 709 ou Check-in hotel"
              />

              {day.type === 'voo' ? (
                <View style={styles.typeDetailsWrap}>
                  <Text style={styles.typeDetailsTitle}>Campos de voo</Text>
                  <View style={styles.row2}>
                    <View style={styles.flex1}>
                      <Field
                        label="Companhia aerea"
                        value={day.details?.airline ?? ''}
                        onChangeText={(value) => updateDayDetail(day.id, 'airline', value)}
                        placeholder="Ex: LATAM"
                      />
                    </View>
                    <View style={styles.flex1}>
                      <Field
                        label="Numero do voo"
                        value={day.details?.flightNumber ?? ''}
                        onChangeText={(value) => updateDayDetail(day.id, 'flightNumber', value)}
                        placeholder="Ex: LA 8123"
                      />
                    </View>
                  </View>
                  <Field
                    label="Terminal / portao"
                    value={day.details?.terminalGate ?? ''}
                    onChangeText={(value) => updateDayDetail(day.id, 'terminalGate', value)}
                    placeholder="Ex: T3 • B12"
                  />
                  <View style={styles.row2}>
                    <View style={styles.flex1}>
                      <Field
                        label="Data de saída (AAAA-MM-DD)"
                        value={day.details?.departureDate ?? ''}
                        onChangeText={(value) => updateDayDetail(day.id, 'departureDate', value)}
                        placeholder="Ex: 2026-06-14"
                      />
                    </View>
                    <View style={styles.flex1}>
                      <Field
                        label="Data de chegada (pode ser no dia seguinte)"
                        value={day.details?.arrivalDate ?? ''}
                        onChangeText={(value) => updateDayDetail(day.id, 'arrivalDate', value)}
                        placeholder="Ex: 2026-06-15"
                      />
                    </View>
                  </View>
                  <View style={styles.row2}>
                    <View style={styles.flex1}>
                      <Field
                        label="Origem"
                        value={day.details?.departure ?? ''}
                        onChangeText={(value) => updateDayDetail(day.id, 'departure', value)}
                        placeholder="Ex: GRU"
                      />
                    </View>
                    <View style={styles.flex1}>
                      <Field
                        label="Destino"
                        value={day.details?.arrival ?? ''}
                        onChangeText={(value) => updateDayDetail(day.id, 'arrival', value)}
                        placeholder="Ex: FCO"
                      />
                    </View>
                  </View>
                </View>
              ) : null}

              {day.type === 'hotel' ? (
                <View style={styles.typeDetailsWrap}>
                  <Text style={styles.typeDetailsTitle}>Campos de hotel</Text>
                  <Field
                    label="Nome do hotel"
                    value={day.details?.hotelName ?? ''}
                    onChangeText={(value) => updateDayDetail(day.id, 'hotelName', value)}
                    placeholder="Ex: Hotel Artemide"
                  />
                  <View style={styles.row2}>
                    <View style={styles.flex1}>
                      <Field
                        label="Check-in"
                        value={day.details?.checkIn ?? ''}
                        onChangeText={(value) => updateDayDetail(day.id, 'checkIn', value)}
                        placeholder="14:00"
                      />
                    </View>
                    <View style={styles.flex1}>
                      <Field
                        label="Check-out"
                        value={day.details?.checkOut ?? ''}
                        onChangeText={(value) => updateDayDetail(day.id, 'checkOut', value)}
                        placeholder="11:00"
                      />
                    </View>
                  </View>
                  <Field
                    label="Codigo da reserva"
                    value={day.details?.reservationCode ?? ''}
                    onChangeText={(value) => updateDayDetail(day.id, 'reservationCode', value)}
                    placeholder="Ex: RM8K4P"
                  />
                </View>
              ) : null}

              {day.type === 'atividade' ? (
                <View style={styles.typeDetailsWrap}>
                  <Text style={styles.typeDetailsTitle}>Campos de atividade</Text>
                  <View style={styles.row2}>
                    <View style={styles.flex1}>
                      <Field
                        label="Categoria"
                        value={day.details?.activityCategory ?? ''}
                        onChangeText={(value) => updateDayDetail(day.id, 'activityCategory', value)}
                        placeholder="Ex: Museu, Tour, Gastronomia"
                      />
                    </View>
                    <View style={styles.flex1}>
                      <Field
                        label="Ingresso / ticket"
                        value={day.details?.ticketInfo ?? ''}
                        onChangeText={(value) => updateDayDetail(day.id, 'ticketInfo', value)}
                        placeholder="Ex: QR code / sem ingresso"
                      />
                    </View>
                  </View>
                </View>
              ) : null}

              {day.type === 'logistica' ? (
                <View style={styles.typeDetailsWrap}>
                  <Text style={styles.typeDetailsTitle}>Campos de logistica</Text>
                  <View style={styles.row2}>
                    <View style={styles.flex1}>
                      <Field
                        label="Meio de transporte"
                        value={day.details?.transportMode ?? ''}
                        onChangeText={(value) => updateDayDetail(day.id, 'transportMode', value)}
                        placeholder="Ex: Trem, Transfer, Uber"
                      />
                    </View>
                    <View style={styles.flex1}>
                      <Field
                        label="Origem"
                        value={day.details?.origin ?? ''}
                        onChangeText={(value) => updateDayDetail(day.id, 'origin', value)}
                        placeholder="Ex: Aeroporto FCO"
                      />
                    </View>
                  </View>
                  <Field
                    label="Destino"
                    value={day.details?.destination ?? ''}
                    onChangeText={(value) => updateDayDetail(day.id, 'destination', value)}
                    placeholder="Ex: Hotel Artemide"
                  />
                </View>
              ) : null}

              <View style={styles.row2}>
                <View style={styles.flex1}>
                  <Field
                    label="Horario"
                    value={day.time ?? ''}
                    onChangeText={(value) => updateDay(day.id, { time: value })}
                    placeholder="22:45"
                  />
                </View>
                <View style={styles.flex1}>
                  <Field
                    label="Local"
                    value={day.location ?? ''}
                    onChangeText={(value) => updateDay(day.id, { location: value })}
                    placeholder="Endereco, terminal, etc."
                  />
                </View>
              </View>
              <Field
                label="Notas"
                value={day.notes ?? ''}
                onChangeText={(value) => updateDay(day.id, { notes: value })}
                placeholder="Detalhes importantes do dia"
                multiline
              />
              <Field
                label="Checklist (virgula)"
                value={day.checklistText}
                onChangeText={(value) => updateDay(day.id, { checklistText: value })}
                placeholder="Passaporte, mala, remedio"
                multiline
              />

              <View style={styles.activitySection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.typeDetailsTitle}>Atividades no mesmo dia</Text>
                  <Pressable style={styles.chipGhost} onPress={() => addActivityToDay(day.id)}>
                    <Text style={styles.chipGhostText}>Adicionar atividade</Text>
                  </Pressable>
                </View>
                {day.activities.map((activity, activityIndex) => (
                  <View key={activity.id} style={styles.activityCard}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.activityTitle}>Atividade {activityIndex + 1}</Text>
                      <Pressable
                        style={styles.chipGhost}
                        onPress={() => removeActivity(day.id, activity.id)}
                      >
                        <Text style={styles.chipGhostText}>Remover</Text>
                      </Pressable>
                    </View>
                    <Field
                      label="Titulo da atividade"
                      value={activity.title}
                      onChangeText={(value) => updateActivity(day.id, activity.id, { title: value })}
                      placeholder="Ex: Coliseu, jantar, transfer..."
                    />
                    <View style={styles.row2}>
                      <View style={styles.flex1}>
                        <Field
                          label="Horario"
                          value={activity.time ?? ''}
                          onChangeText={(value) => updateActivity(day.id, activity.id, { time: value })}
                          placeholder="10:00"
                        />
                      </View>
                      <View style={styles.flex1}>
                        <Field
                          label="Local"
                          value={activity.location ?? ''}
                          onChangeText={(value) =>
                            updateActivity(day.id, activity.id, { location: value })
                          }
                          placeholder="Endereco/local"
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              <Pressable style={[styles.button, styles.secondary]} onPress={() => void pickAttachment(day.id)}>
                <Text style={styles.primaryText}>Anexar arquivo neste dia</Text>
              </Pressable>
              {day.attachments.length ? (
                <View style={styles.attachWrap}>
                  {day.attachments.map((attachment, attachmentIndex) => (
                    <View key={`${attachment.name}-${attachmentIndex}`} style={styles.attachItem}>
                      <Text style={styles.fileText}>{attachment.name}</Text>
                      <Pressable onPress={() => removeAttachment(day.id, attachmentIndex)}>
                        <Text style={styles.removeText}>remover</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.fileText}>Sem anexos nesse dia</Text>
              )}
            </View>
          ))}

          <Pressable style={[styles.button, styles.primary]} onPress={addDay}>
            <Text style={styles.primaryText}>Adicionar outro dia</Text>
          </Pressable>

          <Pressable style={[styles.button, styles.save]} onPress={saveTrip}>
            <Text style={styles.primaryText}>{editingId ? 'Atualizar viagem' : 'Salvar viagem'}</Text>
          </Pressable>
        </View>

        <View style={[styles.managerCard, isWebWide && styles.managerCardWide, webCard]}>
          <Text style={styles.sectionTitle}>Gerenciar no cadastro</Text>
          <Text style={styles.managerHint}>Editar e excluir direto por aqui.</Text>
          {trips.map((trip) => (
            <View key={trip.id} style={styles.manageItem}>
              <Text style={styles.manageTitle}>{trip.destination}</Text>
              <Text style={styles.manageMeta}>
                {trip.startDate || '-'} ate {trip.endDate || '-'} • {trip.days.length} dias
              </Text>
              <View style={styles.manageActions}>
                <Pressable style={[styles.smallBtn, styles.smallEdit]} onPress={() => editTrip(trip)}>
                  <Text style={styles.smallText}>Editar</Text>
                </Pressable>
                <Pressable style={[styles.smallBtn, styles.smallDelete]} onPress={() => handleDeleteTrip(trip)}>
                  <Text style={styles.smallText}>Excluir</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#6B7FA2"
        style={[styles.input, multiline && styles.multiline]}
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#060917',
  },
  content: {
    padding: 16,
    gap: 14,
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
  },
  hero: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2D3F67',
    backgroundColor: '#0D1A33',
    padding: 20,
  },
  gridWrap: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  formCard: {
    backgroundColor: '#0B1428',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#20355D',
    padding: 18,
    gap: 12,
  },
  formCardWide: {
    flex: 1.35,
  },
  managerCard: {
    backgroundColor: '#0B1428',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#20355D',
    padding: 18,
    gap: 10,
  },
  managerCardWide: {
    flex: 0.9,
    position: 'sticky' as any,
    top: 0 as any,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    color: '#E2EEFF',
    fontSize: 18,
    fontWeight: '800',
  },
  chipGhost: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#345387',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipGhostText: {
    color: '#9CC0FF',
    fontSize: 12,
    fontWeight: '700',
  },
  dayCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A4778',
    backgroundColor: '#0E1C37',
    padding: 16,
    gap: 10,
  },
  dayTitle: {
    color: '#CFE3FF',
    fontWeight: '800',
    fontSize: 16,
  },
  typeDetailsWrap: {
    borderWidth: 1,
    borderColor: '#33578E',
    borderRadius: 12,
    backgroundColor: '#112244',
    padding: 10,
    gap: 8,
  },
  activitySection: {
    borderWidth: 1,
    borderColor: '#33578E',
    borderRadius: 12,
    backgroundColor: '#0F2142',
    padding: 10,
    gap: 8,
  },
  activityCard: {
    borderWidth: 1,
    borderColor: '#2E4D7C',
    borderRadius: 10,
    backgroundColor: '#13264A',
    padding: 10,
    gap: 8,
  },
  activityTitle: {
    color: '#DBEAFE',
    fontWeight: '700',
    fontSize: 13,
  },
  typeDetailsTitle: {
    color: '#BFD8FF',
    fontWeight: '700',
    fontSize: 13,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#315081',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#122344',
  },
  typeChipActive: {
    borderColor: '#60A5FA',
    backgroundColor: '#1E3A8A',
  },
  typeChipText: {
    color: '#AFC6ED',
    fontSize: 12,
    fontWeight: '700',
  },
  typeChipTextActive: {
    color: '#EAF2FF',
  },
  row2: {
    flexDirection: 'row',
    gap: 10,
  },
  flex1: {
    flex: 1,
  },
  title: {
    color: '#F2F8FF',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#A8C2EB',
    marginTop: 4,
  },
  field: {
    gap: 6,
  },
  label: {
    color: '#C5DCF9',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#0A152C',
    borderColor: '#2B4676',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#E2EEFF',
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  button: {
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 11,
    marginTop: 2,
  },
  primary: {
    backgroundColor: '#1D4ED8',
  },
  secondary: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#35527E',
  },
  save: {
    backgroundColor: '#0891B2',
    marginTop: 12,
  },
  primaryText: {
    color: '#F8FBFF',
    fontWeight: '700',
  },
  fileText: {
    color: '#A4C0E7',
    fontSize: 12,
  },
  attachWrap: {
    gap: 6,
  },
  attachItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#28426C',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#101E3B',
  },
  removeText: {
    color: '#FCA5A5',
    fontWeight: '700',
    fontSize: 12,
  },
  managerHint: {
    color: '#9BB4D8',
    marginBottom: 4,
    fontSize: 12,
  },
  manageItem: {
    borderWidth: 1,
    borderColor: '#27406A',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#102041',
    gap: 4,
  },
  manageTitle: {
    color: '#E8F1FF',
    fontWeight: '800',
  },
  manageMeta: {
    color: '#AFC6ED',
    fontSize: 12,
  },
  manageActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  smallBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  smallEdit: {
    backgroundColor: '#1D4ED8',
  },
  smallDelete: {
    backgroundColor: '#B91C1C',
  },
  smallText: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 12,
  },
  assistantChip: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A4778',
    backgroundColor: '#0E1C37',
  },
  assistantChipText: {
    color: '#60A5FA',
    fontWeight: '700',
    fontSize: 14,
  },
  logBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#2A4778',
    borderRadius: 10,
    backgroundColor: '#0A152C',
    padding: 10,
    maxHeight: 220,
  },
  logTitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  logScroll: {
    maxHeight: 180,
  },
  logText: {
    color: '#A5B4C8',
    fontSize: 11,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
});
