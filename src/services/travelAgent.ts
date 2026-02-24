/**
 * Agente de viagens com OpenAI.
 * Faz perguntas uma a uma e retorna atualizações para o formulário.
 * Chave: EXPO_PUBLIC_OPENAI_API_KEY no .env
 */

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

export type TripFormSnapshot = {
  destination?: string;
  startDate?: string;
  endDate?: string;
  days?: Array<{
    date: string;
    type: 'voo' | 'hotel' | 'atividade' | 'logistica';
    title?: string;
    time?: string;
    location?: string;
    notes?: string;
    details?: Record<string, string>;
    activities?: Array<{ title?: string; time?: string; location?: string }>;
    checklistItems?: string[];
  }>;
};

export type AgentResponse = {
  question: string;
  formUpdates?: TripFormSnapshot;
  done?: boolean;
};

const SYSTEM_PROMPT = `Você é um ESPECIALISTA em viagens. Conduza o cadastro como quem já sabe o fluxo: quem vai a um destino vai de avião, fica em hotel e pode ter passeios. NÃO pergunte "quer adicionar voo?" ou "deseja cadastrar um voo?" — assuma o voo e peça direto as INFORMAÇÕES do voo (data, companhia, número do voo, aeroporto de saída e chegada). Uma pergunta por vez.

INTERPRETAÇÃO DOS DADOS (muito importante):
- Em toda resposta você recebe na seção "MEMÓRIA: CONTEÚDO DOS ANEXOS" o texto completo que o usuário enviou dos PDFs/vouchers. Esse é o conteúdo que você DEVE usar: hotel, atividades, voos, aeroportos, datas estão ali. NUNCA pergunte "qual o hotel?", "tem atividades?", "qual aeroporto?" se essa informação já estiver na MEMÓRIA dos anexos — extraia e preencha formUpdates.
- Se no texto aparecer aeroporto, companhia, voo, hotel, check-in, passeio, data — EXTRAIA e preencha. Pergunte SÓ o que realmente não aparecer em lugar nenhum (ex.: check-out quando não estiver escrito).
- Se o usuário disser "está nos anexos" ou "já está no chat", use a MEMÓRIA dos anexos (a seção que você recebe) e preencha tudo; não pergunte de novo.

QUANDO O USUÁRIO ENVIAR CONTEÚDO DE ANEXOS (vouchers, confirmações, PDFs, textos):
- O conteúdo pode ter VÁRIOS anexos (cada bloco "--- nome.pdf ---" é um anexo). Extraia TODOS os itens de TODOS os anexos:
  • Cada voucher de passeio/tour/visita (ex.: "VISIT ON THE 3rd FLOOR OF THE EIFFEL TOWER", "Toledo Tour Básico") = um day type "atividade" com date, title, time, location.
  • Cada traslado/transfer (ex.: "Traslado em Amesterdã", "Traslado urbano") = um day type "logistica" com date, time, origin/destination (details.origin, details.destination).
  • Hotel mencionado (nome, endereço, data check-in) = um day type "hotel" com date e details.
  • Voo só se estiver explícito no texto (companhia, número, aeroportos) = day type "voo".
- NUNCA invente dados. Só preencha formUpdates com o que REALMENTE aparece no texto. Se não houver voo nos anexos, NÃO adicione voo. Se não houver data de check-out, NÃO invente; pergunte ou deixe em branco.
- Datas: formate sempre AAAA-MM-DD (ex. 17/03/26 → 2026-03-17, 26-03-2026 → 2026-03-26). Cada day precisa de "date" extraída do próprio voucher/anexo.
- Se houver vários destinos (ex. Paris, Madrid, Amesterdã), pode usar destination como "Paris, Madrid, Amesterdã" ou o principal; mesmo assim crie um day para CADA evento (cada tour, cada transfer, hotel) com a data e o local do documento.
- Faça perguntas só para o que faltar (ex. check-out não encontrado, data de um passeio sem data).

FLUXO NATURAL (quando NÃO há conteúdo de anexos — siga esta ordem):
1. Destino — preencha destination e peça dados do voo. NUNCA pergunte "deseja adicionar voo?".
2. Voo de ida: day com type "voo" e date; details (airline, flightNumber, departure, arrival, departureDate, arrivalDate).
3. Hospedagem: hotel com check-in/out, código.
4. Passeios/atividades: cada um em um day com type "atividade", SEMPRE com "date" em AAAA-MM-DD (extraia do contexto ou pergunte "Para o passeio X, qual a data?").
5. Ao ter voo + hospedagem (e atividades se houver), pergunte se pode finalizar.

REGRAS:
- UMA pergunta por vez. Datas sempre em AAAA-MM-DD.
- Todo day deve ter "date". Não invente dados que não estejam no texto.
- Tudo que estiver no "Conteúdo dos anexos" deve ser extraído e preenchido: aeroportos (arrival, departure), companhia, voo, hotel, atividades, traslados. NÃO pergunte "qual aeroporto de chegada?" ou "qual companhia?" se isso já aparecer no texto — preencha direto.
- Varra TODO o conteúdo: cada tour = day "atividade", cada traslado = "logistica", hotel = "hotel", voo (se no texto) = "voo" com details.
- Responda SOMENTE com um JSON válido, sem markdown: {"question": "texto da pergunta", "formUpdates": { ... }, "done": false}
- "done": true só quando o usuário confirmar que pode finalizar.`;

function getApiKey(): string | undefined {
  return typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_OPENAI_API_KEY;
}

export function hasOpenAIKey(): boolean {
  const key = getApiKey();
  return Boolean(key && key.trim().length > 0);
}

function buildUserContext(snapshot: TripFormSnapshot): string {
  const parts: string[] = [];
  if (snapshot.destination) parts.push(`Destino: ${snapshot.destination}`);
  if (snapshot.startDate) parts.push(`Início: ${snapshot.startDate}`);
  if (snapshot.endDate) parts.push(`Fim: ${snapshot.endDate}`);
  if (snapshot.days?.length) {
    parts.push(
      `Dias cadastrados (${snapshot.days.length}): ${snapshot.days
        .map(
          (d) =>
            `${d.date} ${d.type}${d.title ? ` - ${d.title}` : ''}`,
        )
        .join('; ')}`,
    );
  }
  return parts.length ? `Estado atual do cadastro: ${parts.join('. ')}` : 'Cadastro em branco.';
}

/** Extrai o conteúdo dos anexos da última mensagem do usuário que o contiver (memória do chat). */
function getAttachmentMemory(messages: Array<{ role: string; content: string }>): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== 'user') continue;
    const content = messages[i].content || '';
    const marker = '--- Conteúdo dos anexos ---';
    const idx = content.indexOf(marker);
    if (idx === -1 && !content.includes('Conteúdo dos anexos')) continue;
    const text = idx >= 0 ? content.slice(idx + marker.length).trim() : content;
    if (!text) continue;
    const maxLen = 14000;
    return text.length > maxLen ? text.slice(-maxLen) : text;
  }
  return '';
}

export async function sendToTravelAgent(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  formSnapshot: TripFormSnapshot,
): Promise<AgentResponse> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      question:
        'Configure a chave OPENAI no arquivo .env (EXPO_PUBLIC_OPENAI_API_KEY). Veja .env.example.',
      done: false,
    };
  }

  const context = buildUserContext(formSnapshot);
  let systemContent = `${SYSTEM_PROMPT}\n\n${context}`;

  const attachmentMemory = getAttachmentMemory(messages);
  if (attachmentMemory) {
    systemContent += `\n\n--- MEMÓRIA: CONTEÚDO DOS ANEXOS (fonte da verdade; extraia tudo daqui e NÃO pergunte de novo hotel, atividades, voos, aeroportos ou datas que já estejam abaixo) ---\n\n${attachmentMemory}`;
  }

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: systemContent },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    temperature: 0.4,
    max_tokens: 1200,
  };

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    return {
      question: `Erro na API: ${res.status}. ${err.slice(0, 200)}`,
      done: false,
    };
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    return { question: 'Resposta vazia do assistente.', done: false };
  }

  const parsed = parseAgentResponse(content);
  if (parsed) {
    if (typeof parsed.question !== 'string') parsed.question = 'Cadastro atualizado.';
    return parsed;
  }
  return { question: content, done: false };
}

/** Extrai o objeto JSON da resposta mesmo com texto antes/depois (ex: "Aqui está: {...}"). */
function parseAgentResponse(content: string): AgentResponse | null {
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  let str = jsonMatch[0];
  const open = str.indexOf('{');
  let depth = 0;
  let end = -1;
  for (let i = open; i < str.length; i++) {
    if (str[i] === '{') depth++;
    if (str[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return null;
  str = str.slice(open, end + 1);
  try {
    return JSON.parse(str) as AgentResponse;
  } catch {
    return null;
  }
}

export function getFirstQuestion(): string {
  return 'Olá! Sou seu assistente de viagens. Para onde você vai? (ex: Roma, Paris, Fernando de Noronha)';
}
