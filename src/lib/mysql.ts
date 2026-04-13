import "server-only";

import mysql, {
  type Pool,
  type PoolConnection,
  type QueryResult,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";

let pool: Pool | null = null;
const afterCommitKey = Symbol.for("glyph.after-commit");

export type SqlValue = string | number | boolean | Date | Buffer | null;

type AfterCommitCallback = () => void | Promise<void>;

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Missing ${name}. Configure MySQL connection in .env.local before running the app.`,
    );
  }

  return value;
}

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: getRequiredEnv("DB_HOST"),
      port: Number(process.env.DB_PORT || 3306),
      user: getRequiredEnv("DB_USER"),
      password: process.env.DB_PASSWORD || "",
      database: getRequiredEnv("DB_NAME"),
      waitForConnections: true,
      connectionLimit: 4,
      namedPlaceholders: false,
      charset: "utf8mb4",
    });
  }

  return pool;
}

export async function queryRows<T extends RowDataPacket>(
  sql: string,
  params: SqlValue[] = [],
) {
  const [rows] = await getPool().query<T[]>(sql, params);
  return rows;
}

export async function queryOne<T extends RowDataPacket>(
  sql: string,
  params: SqlValue[] = [],
) {
  const rows = await queryRows<T>(sql, params);
  return rows[0] ?? null;
}

export async function execute(sql: string, params: SqlValue[] = []) {
  const [result] = await getPool().execute<ResultSetHeader>(sql, params);
  return result;
}

export async function withTransaction<T>(
  callback: (connection: PoolConnection) => Promise<T>,
) {
  const connection = await getPool().getConnection();
  (connection as PoolConnection & { [afterCommitKey]?: AfterCommitCallback[] })[afterCommitKey] = [];

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    const callbacks = (connection as PoolConnection & { [afterCommitKey]?: AfterCommitCallback[] })[afterCommitKey] ?? [];

    for (const run of callbacks) {
      await run();
    }

    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    delete (connection as PoolConnection & { [afterCommitKey]?: AfterCommitCallback[] })[afterCommitKey];
    connection.release();
  }
}

export async function txQueryRows<T extends RowDataPacket>(
  connection: PoolConnection,
  sql: string,
  params: SqlValue[] = [],
) {
  const [rows] = await connection.query<T[] & QueryResult>(sql, params);
  return rows as T[];
}

export async function txQueryOne<T extends RowDataPacket>(
  connection: PoolConnection,
  sql: string,
  params: SqlValue[] = [],
) {
  const rows = await txQueryRows<T>(connection, sql, params);
  return rows[0] ?? null;
}

export async function txExecute(
  connection: PoolConnection,
  sql: string,
  params: SqlValue[] = [],
) {
  const [result] = await connection.execute<ResultSetHeader>(sql, params);
  return result;
}

export function placeholders(values: readonly unknown[]) {
  return values.map(() => "?").join(", ");
}

export function onTransactionCommit(connection: PoolConnection, callback: AfterCommitCallback) {
  const holder = connection as PoolConnection & { [afterCommitKey]?: AfterCommitCallback[] };
  holder[afterCommitKey] = holder[afterCommitKey] ?? [];
  holder[afterCommitKey].push(callback);
}
