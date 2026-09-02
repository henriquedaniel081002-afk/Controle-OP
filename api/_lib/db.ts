import postgres from 'postgres';

let client: ReturnType<typeof postgres> | null = null;

export function getDb() {
  const connectionString = String(process.env.DATABASE_URL || '').trim();

  if (!connectionString) {
    throw new Error('DATABASE_URL não configurada no servidor.');
  }

  if (!client) {
    client = postgres(connectionString, {
      max: 1,
      prepare: false,
      ssl: 'require',
      idle_timeout: 20,
      connect_timeout: 15,
    });
  }

  return client;
}
