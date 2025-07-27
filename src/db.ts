import { Client } from '@neondatabase/serverless';

interface Env {
  DATABASE_URL: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const client = new Client(env.DATABASE_URL);
    await client.connect();
    const { rows } = await client.query('SELECT * FROM books_to_read;');
    return new Response(JSON.stringify(rows));
  },
};