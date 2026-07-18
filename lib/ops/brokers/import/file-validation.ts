import path from 'path';
import { BROKER_IMPORT_CONFIG } from '@/lib/ops/brokers/config';

export function sanitizeFileName(fileName: string): string {
  const base = path.basename(fileName || 'export.txt');
  return base.replace(/[^\w.\- ()[\]]+/g, '_').slice(0, 180) || 'export.txt';
}

export function validateWhatsAppExportFile(input: {
  fileName: string;
  mimeType?: string | null;
  sizeBytes: number;
}): { ok: true; fileName: string } | { ok: false; error: string } {
  const fileName = sanitizeFileName(input.fileName);
  const ext = path.extname(fileName).toLowerCase();

  if (!(BROKER_IMPORT_CONFIG.allowedExtensions as readonly string[]).includes(ext)) {
    return { ok: false, error: 'Only WhatsApp .txt export files are allowed.' };
  }

  if (input.sizeBytes <= 0) {
    return { ok: false, error: 'Uploaded file is empty.' };
  }

  if (input.sizeBytes > BROKER_IMPORT_CONFIG.maxFileBytes) {
    return {
      ok: false,
      error: `File exceeds the ${Math.round(BROKER_IMPORT_CONFIG.maxFileBytes / (1024 * 1024))}MB limit.`,
    };
  }

  const mime = (input.mimeType || '').toLowerCase();
  if (
    mime &&
    !(BROKER_IMPORT_CONFIG.allowedMimeTypes as readonly string[]).includes(mime) &&
    !mime.startsWith('text/')
  ) {
    return { ok: false, error: 'Invalid file type. Upload a plain-text WhatsApp export.' };
  }

  return { ok: true, fileName };
}
