/**
 * Extrai texto de arquivos anexados (txt, PDF) para enviar à IA.
 * .txt: lido direto. .pdf: enviado para a API local (pdf-api) que extrai e devolve texto;
 * o texto é guardado em cache (AsyncStorage) e usado no envio.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EXTRACT_CACHE_PREFIX = 'travel_extract_';

export type AttachmentInput = {
  uri: string;
  name: string;
  mimeType?: string;
};

function getExtractPdfApiUrl(): string {
  const url = process.env.EXPO_PUBLIC_EXTRACT_PDF_API_URL;
  if (!url || !url.trim()) {
    throw new Error(
      'Defina EXPO_PUBLIC_EXTRACT_PDF_API_URL no .env (ex.: http://localhost:3001/extract-pdf).',
    );
  }
  return url.trim().replace(/\/$/, '');
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function cacheKey(att: AttachmentInput): string {
  const key = (att.uri + ':' + (att.name || '')).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return EXTRACT_CACHE_PREFIX + key;
}

/** Salva texto extraído em cache (JSON) para reutilizar no envio. */
async function setExtractedCache(att: AttachmentInput, text: string): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(att), JSON.stringify({ text, name: att.name }));
  } catch {
    // ignore
  }
}

/** Lê texto extraído do cache, se existir. */
async function getExtractedCache(att: AttachmentInput): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(att));
    if (!raw) return null;
    const obj = JSON.parse(raw) as { text?: string };
    return typeof obj?.text === 'string' ? obj.text : null;
  } catch {
    return null;
  }
}

/**
 * Extrai texto de um arquivo. Suporta .txt em todas as plataformas e .pdf via API (sem carregar PDF na página).
 */
export async function extractTextFromFile(att: AttachmentInput): Promise<string> {
  const name = (att.name || '').toLowerCase();
  const isTxt = name.endsWith('.txt') || att.mimeType === 'text/plain';
  const isPdf = name.endsWith('.pdf') || att.mimeType === 'application/pdf';

  if (isTxt) {
    return readTextFile(att.uri);
  }
  if (isPdf) {
    const cached = await getExtractedCache(att);
    if (cached != null) return cached;
    const text = await extractPdfViaApi(att);
    if (text) await setExtractedCache(att, text);
    return text;
  }
  return `[Arquivo não suportado: ${att.name}. Use .txt ou .pdf.]`;
}

async function readTextFile(uri: string): Promise<string> {
  try {
    if (Platform.OS === 'web') {
      const res = await fetch(uri);
      if (!res.ok) return '';
      return await res.text();
    }
    const FileSystem = await import('expo-file-system/legacy');
    return await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
  } catch {
    return '';
  }
}

async function getPdfBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    if (!res.ok) throw new Error('Falha ao ler o arquivo.');
    const buffer = await res.arrayBuffer();
    return arrayBufferToBase64(buffer);
  }
  const FileSystem = await import('expo-file-system/legacy');
  return await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

async function extractPdfViaApi(att: AttachmentInput): Promise<string> {
  try {
    const base64 = await getPdfBase64(att.uri);
    const apiUrl = getExtractPdfApiUrl();
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfBase64: base64 }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      let msg = `API respondeu ${res.status}`;
      try {
        const j = JSON.parse(errBody);
        if (j.detail) msg = j.detail;
        else if (j.error) msg = j.error;
      } catch {
        if (errBody) msg = errBody.slice(0, 200);
      }
      return `[Erro ao extrair PDF: ${msg}. Verifique a URL em EXPO_PUBLIC_EXTRACT_PDF_API_URL e se a API está rodando.]`;
    }
    const data = (await res.json()) as { text?: string };
    const text = (data?.text || '').trim() || '[Nenhum texto extraído do PDF.]';
    return text;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return `[Erro ao extrair PDF: ${msg}. Verifique se a API está rodando e se EXPO_PUBLIC_EXTRACT_PDF_API_URL está configurada corretamente.]`;
  }
}

/**
 * Extrai texto de todos os anexos (usa cache quando existir) e retorna um único bloco formatado para a IA.
 */
export async function extractTextFromAllAttachments(attachments: AttachmentInput[]): Promise<string> {
  if (!attachments.length) return '';
  const results = await Promise.all(
    attachments.map(async (att) => {
      const text = await extractTextFromFile(att);
      return `--- ${att.name} ---\n${text}`;
    }),
  );
  return results.join('\n\n');
}
