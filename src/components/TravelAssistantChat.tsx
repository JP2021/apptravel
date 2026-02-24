import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { extractTextFromAllAttachments } from '../services/fileExtract';
import type { TripFormSnapshot } from '../services/travelAgent';
import { getFirstQuestion, sendToTravelAgent } from '../services/travelAgent';
import { webCard } from '../theme/webTheme';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type DayForAttachment = {
  id: string;
  date: string;
  title: string;
  attachments: Array<{ name: string; uri: string; mimeType?: string }>;
};

type TravelAssistantChatProps = {
  formSnapshot: TripFormSnapshot;
  /** Dias do formulário para anexar vouchers (id, date, title, attachments). */
  days?: DayForAttachment[];
  onFormUpdates: (updates: TripFormSnapshot) => void;
  /** Chamado quando o agente retorna done: true. Recebe o snapshot final para aplicar e salvar. */
  onDone: (finalSnapshot?: TripFormSnapshot) => void;
  onSwitchToForm: () => void;
  /** Abre o seletor de arquivo para anexar voucher ao dia. */
  onAttachVoucher?: (dayId: string) => void;
  /** Remove um anexo do dia. */
  onRemoveAttachment?: (dayId: string, index: number) => void;
};

export function TravelAssistantChat({
  formSnapshot,
  days = [],
  onFormUpdates,
  onDone,
  onSwitchToForm,
  onAttachVoucher,
  onRemoveAttachment,
}: TravelAssistantChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: getFirstQuestion() },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [processingAttachments, setProcessingAttachments] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);

  const allAttachments = days.flatMap((d) => d.attachments);
  const hasAttachments = allAttachments.length > 0;

  const processAttachmentsAndSend = async () => {
    if (!hasAttachments || loading || processingAttachments) return;
    setProcessingAttachments(true);
    try {
      const text = await extractTextFromAllAttachments(allAttachments);
      const content =
        text.trim() ||
        'Não foi possível extrair texto dos anexos. Use arquivos .txt ou .pdf (na versão web).';
      const userMessage: ChatMessage = {
        role: 'user',
        content: `Use o conteúdo dos meus anexos abaixo para montar o roteiro da viagem. Extraia voos, hotéis, datas, atividades. Se algo estiver faltando ou ambíguo, pergunte.\n\n--- Conteúdo dos anexos ---\n\n${content}`,
      };
      setMessages((prev) => [...prev, userMessage]);
      setLoading(true);
      const nextMessages: ChatMessage[] = [...messages, userMessage];
      const res = await sendToTravelAgent(nextMessages, formSnapshot);
      setMessages((prev) => [...prev, { role: 'assistant', content: res.question }]);
      if (res.formUpdates) onFormUpdates(res.formUpdates);
      if (res.done) onDone(res.formUpdates ?? undefined);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Erro ao processar anexos: ${e instanceof Error ? e.message : String(e)}`,
        },
      ]);
    } finally {
      setLoading(false);
      setProcessingAttachments(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const userMessage: ChatMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    try {
      const nextMessages: ChatMessage[] = [...messages, userMessage];
      const res = await sendToTravelAgent(nextMessages, formSnapshot);
      setMessages((prev) => [...prev, { role: 'assistant', content: res.question }]);
      if (res.formUpdates) {
        onFormUpdates(res.formUpdates);
      }
      if (res.done) {
        onDone(res.formUpdates ?? undefined);
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Erro ao chamar o assistente: ${e instanceof Error ? e.message : String(e)}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.card, webCard]}>
        <Text style={styles.title}>Assistente de viagens</Text>
        <Text style={styles.subtitle}>Responda às perguntas; o cadastro será preenchido automaticamente.</Text>
        <Pressable style={styles.linkBtn} onPress={onSwitchToForm}>
          <Text style={styles.linkText}>Preencher formulário manualmente</Text>
        </Pressable>
        {hasAttachments ? (
          <Pressable
            style={[styles.processBtn, (loading || processingAttachments) && styles.processBtnDisabled]}
            onPress={() => void processAttachmentsAndSend()}
            disabled={loading || processingAttachments}
          >
            {processingAttachments ? (
              <Text style={styles.processBtnText}>Extraindo texto dos anexos...</Text>
            ) : (
              <Text style={styles.processBtnText}>Processar anexos e montar roteiro com IA</Text>
            )}
          </Pressable>
        ) : null}
      </View>

      {days.length > 0 && (onAttachVoucher || onRemoveAttachment) ? (
        <View style={[styles.voucherCard, webCard]}>
          <Text style={styles.voucherTitle}>Anexar vouchers do passeio</Text>
          <Text style={styles.voucherSubtitle}>Você pode anexar um ou mais vouchers em cada dia.</Text>
          {days.map((day) => (
            <View key={day.id} style={styles.voucherDay}>
              <Text style={styles.voucherDayLabel}>
                {day.date || 'Sem data'} • {day.title || 'Sem título'}
              </Text>
              {onAttachVoucher ? (
                <Pressable
                  style={styles.voucherBtn}
                  onPress={() => onAttachVoucher(day.id)}
                >
                  <Text style={styles.voucherBtnText}>+ Anexar voucher</Text>
                </Pressable>
              ) : null}
              {day.attachments.length > 0 ? (
                <View style={styles.voucherList}>
                  {day.attachments.map((att, idx) => (
                    <View key={`${att.name}-${idx}`} style={styles.voucherItem}>
                      <Text style={styles.voucherFileName} numberOfLines={1}>{att.name}</Text>
                      {onRemoveAttachment ? (
                        <Pressable onPress={() => onRemoveAttachment(day.id, idx)}>
                          <Text style={styles.voucherRemove}>remover</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={styles.chatWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((msg, i) => (
            <View
              key={i}
              style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}
            >
              <Text style={msg.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant}>
                {msg.content}
              </Text>
            </View>
          ))}
          {loading ? (
            <View style={[styles.bubble, styles.bubbleAssistant]}>
              <ActivityIndicator color="#94A3B8" size="small" />
            </View>
          ) : null}
        </ScrollView>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Sua resposta..."
            placeholderTextColor="#6B7FA2"
            editable={!loading}
            onSubmitEditing={() => void send()}
            returnKeyType="send"
          />
          <Pressable
            style={[styles.sendBtn, loading && styles.sendBtnDisabled]}
            onPress={() => void send()}
            disabled={loading}
          >
            <Text style={styles.sendText}>Enviar</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
  },
  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A4778',
    backgroundColor: '#0E1C37',
  },
  title: {
    color: '#F2F8FF',
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: '#A8C2EB',
    marginTop: 4,
    fontSize: 13,
  },
  linkBtn: {
    marginTop: 10,
  },
  linkText: {
    color: '#60A5FA',
    fontSize: 13,
    fontWeight: '600',
  },
  processBtn: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#1E3A8A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  processBtnDisabled: {
    opacity: 0.7,
  },
  processBtnText: {
    color: '#E0E7FF',
    fontSize: 13,
    fontWeight: '700',
  },
  chatWrap: {
    flex: 1,
    minHeight: 280,
  },
  messages: {
    flex: 1,
    backgroundColor: '#0B1428',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#20355D',
  },
  messagesContent: {
    padding: 12,
    gap: 10,
    paddingBottom: 24,
  },
  bubble: {
    maxWidth: '88%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#1D4ED8',
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  bubbleTextUser: {
    color: '#F8FAFC',
    fontSize: 15,
  },
  bubbleTextAssistant: {
    color: '#E2E8F0',
    fontSize: 15,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#0A152C',
    borderColor: '#2B4676',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#E2EEFF',
    fontSize: 15,
  },
  sendBtn: {
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },
  sendText: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  voucherCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A4778',
    backgroundColor: '#0E1C37',
    gap: 10,
  },
  voucherTitle: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '800',
  },
  voucherSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
  },
  voucherDay: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#0B1428',
    gap: 6,
  },
  voucherDayLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  voucherBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  voucherBtnText: {
    color: '#60A5FA',
    fontSize: 13,
    fontWeight: '700',
  },
  voucherList: {
    gap: 4,
  },
  voucherItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#1E293B',
    borderRadius: 6,
  },
  voucherFileName: {
    color: '#E2E8F0',
    fontSize: 12,
    flex: 1,
  },
  voucherRemove: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '600',
  },
});
