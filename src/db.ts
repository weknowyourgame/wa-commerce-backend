import { Client } from "@neondatabase/serverless";
interface Env { DATABASE_URL: string; }

export async function getDbClient(env: Env) {
	const client = new Client(env.DATABASE_URL);
	await client.connect();
	return client;
}
