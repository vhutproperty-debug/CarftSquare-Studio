import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ProjectValidationError } from '@/lib/ops/projects/errors';

const ALLOWED = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
  ['application/pdf', 'pdf'],
]);

const MAX_BYTES = 12 * 1024 * 1024;

/**
 * Floor plans use the same local upload directory as the rest of the site.
 * Vercel Blob is not installed here, so durable files should be pasted as https URLs
 * (including a Blob URL). Uploaded files are written under public/uploads/ops-projects.
 */
export async function storeProjectFile(file: File): Promise<{ url: string; kind: 'image' | 'pdf'; name: string }> {
  const ext = ALLOWED.get(file.type);
  if (!ext) throw new ProjectValidationError('Upload a JPEG, PNG, WebP, GIF, or PDF.');
  if (file.size > MAX_BYTES) throw new ProjectValidationError('File is larger than 12 MB. Paste a link instead.');
  const filename = `${randomUUID()}.${ext}`;
  const directory = path.join(process.cwd(), 'public', 'uploads', 'ops-projects');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), Buffer.from(await file.arrayBuffer()));
  return {
    url: `/uploads/ops-projects/${filename}`,
    kind: ext === 'pdf' ? 'pdf' : 'image',
    name: (file.name || filename).slice(0, 160),
  };
}
