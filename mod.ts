import {
  createClient,
  getTableName,
  getKey,
  createKey,
  unfmt,
} from "./deps.ts";

interface params {
  table: string;
  key?: string;
  [others: string]: any;
}

/** get an item */
export async function get(params: params) {
  let [TableName, Key] = await Promise.all([
    getTableName(),
    getKey(params),
  ]);
  let { Item } = await createClient().getItem({ TableName, Key });
  return unfmt(Item);
}

/** set an item */
export async function set(params: params) {
  if (!params.key) {
    params.key = await createKey(params.table);
  }
  let [TableName, Key] = await Promise.all([
    getTableName(),
    getKey(params),
  ]);
  let copy = { ...params };
  delete copy.key;
  delete copy.table;
  await createClient().putItem({
    TableName,
    Item: { ...copy, ...Key },
  });
  return { ...params };
}

/** destroy an item */
export async function destroy(params: { table: string; key: string }) {
  let [TableName, Key] = await Promise.all([
    getTableName(),
    getKey(params),
  ]);
  return createClient().deleteItem({ TableName, Key });
}

// page, incr, decr, count
