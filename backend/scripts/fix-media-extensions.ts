import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as mime from 'mime-types';

dotenv.config();

type MediaRow = {
  id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  media_type: string;
};

const fallbackExtensions: Record<string, string> = {
  image: 'jpg',
  video: 'mp4',
  audio: 'mp3',
  voice: 'ogg',
  sticker: 'webp',
  document: 'bin',
};

const normalizeMimeType = (value?: string | null): string | null => {
  if (!value) return null;
  return value.split(';')[0].trim();
};

const resolveExtension = (row: MediaRow): string | null => {
  const normalized = normalizeMimeType(row.mime_type);
  if (normalized) {
    const ext = mime.extension(normalized);
    if (ext) {
      return ext;
    }
  }
  return fallbackExtensions[row.media_type] || null;
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

async function run() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'whatsapp_bot',
    user: process.env.DB_USER || 'whatsapp_user',
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    const result = await pool.query<MediaRow>(
      'SELECT id, file_name, file_path, mime_type, media_type FROM media'
    );

    let updated = 0;
    let skipped = 0;

    for (const row of result.rows) {
      const nameExt = path.extname(row.file_name);
      const pathExt = path.extname(row.file_path);

      if (nameExt || pathExt) {
        continue;
      }

      const extension = resolveExtension(row);
      if (!extension) {
        skipped += 1;
        console.warn(`Skipped ${row.id}: could not resolve extension.`);
        continue;
      }

      const newFileName = `${row.file_name}.${extension}`;
      const newFilePath = `${row.file_path}.${extension}`;

      const oldExists = await fileExists(row.file_path);
      const newExists = await fileExists(newFilePath);

      if (oldExists && !newExists) {
        await fs.rename(row.file_path, newFilePath);
      } else if (!oldExists && newExists) {
        // File already renamed; continue with DB update.
      } else {
        skipped += 1;
        console.warn(`Skipped ${row.id}: file state ambiguous.`);
        continue;
      }

      await pool.query(
        'UPDATE media SET file_name = $1, file_path = $2 WHERE id = $3',
        [newFileName, newFilePath, row.id]
      );
      updated += 1;
    }

    console.log(`Done. Updated: ${updated}, skipped: ${skipped}`);
  } catch (error) {
    console.error('Fix media extensions failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
