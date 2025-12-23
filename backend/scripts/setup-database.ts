import { Pool, PoolClient } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'whatsapp_bot',
    user: process.env.DB_USER || 'whatsapp_user',
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  });

  let client: PoolClient | null = null;

  try {
    console.log('Connecting to database...');
    client = await pool.connect();
    if (!client) {
      throw new Error('Database connection failed');
    }

    console.log('Preparing migrations...');
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const appliedResult = await client.query<{ filename: string }>(
      'SELECT filename FROM schema_migrations'
    );
    const applied = new Set(appliedResult.rows.map((row) => row.filename));

    if (applied.size === 0) {
      const schemaCheck = await client.query<{ exists: boolean }>(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'users'
        ) AS exists
      `);

      if (schemaCheck.rows[0]?.exists) {
        const bootstrapMigrations = ['001_initial_schema.sql'];
        for (const file of bootstrapMigrations) {
          if (migrationFiles.includes(file)) {
            await client.query(
              'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
              [file]
            );
            applied.add(file);
          }
        }
      }
    }

    console.log(`Found ${migrationFiles.length} migration(s).`);

    await client.query('BEGIN');
    for (const file of migrationFiles) {
      if (applied.has(file)) {
        console.log(`Skipping already applied migration: ${file}`);
        continue;
      }

      console.log(`Applying migration: ${file}`);
      const migrationSQL = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(migrationSQL);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
    }
    await client.query('COMMIT');

    console.log('Migrations completed successfully!');

    client.release();
    client = null;
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Ignore rollback errors.
      }
    }
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
