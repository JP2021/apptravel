import * as FileSystem from 'expo-file-system/legacy';
import { Trip } from '../types';

const UPLOAD_DIR = 'upload';
const MOCK_JSON_FILE = 'mock.json';

function getUploadDir(): string | null {
  const base = FileSystem.documentDirectory;
  if (!base) return null;
  return `${base}${UPLOAD_DIR}/`;
}

/**
 * Garante que a pasta upload existe no diretório de documentos.
 */
export async function ensureUploadDir(): Promise<string | null> {
  const dir = getUploadDir();
  if (!dir) return null;
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    return dir;
  } catch {
    return null;
  }
}

/**
 * Salva o mock (ou qualquer lista de viagens) em JSON na pasta upload (upload/mock.json).
 */
export async function saveMockToJson(trips: Trip[]): Promise<void> {
  const dir = await ensureUploadDir();
  if (!dir) return;
  try {
    const path = `${dir}${MOCK_JSON_FILE}`;
    await FileSystem.writeAsStringAsync(path, JSON.stringify(trips, null, 2), {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch {
    // ignora falha (ex.: web sem filesystem persistente)
  }
}

/**
 * Copia um arquivo (ex.: escolhido pelo DocumentPicker) para a pasta upload
 * e retorna a nova URI para ser usada no anexo. O nome do arquivo no disco
 * inclui dayId e timestamp para evitar colisões.
 */
export async function copyAttachmentToUpload(
  sourceUri: string,
  fileName: string,
  dayId: string,
): Promise<string | null> {
  const dir = await ensureUploadDir();
  if (!dir) return null;
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const destFileName = `${dayId}_${Date.now()}_${sanitized}`;
  const destUri = `${dir}${destFileName}`;
  try {
    await FileSystem.copyAsync({ from: sourceUri, to: destUri });
    return destUri;
  } catch {
    return null;
  }
}
