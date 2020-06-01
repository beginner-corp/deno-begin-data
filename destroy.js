import {
  createClient,
  getTableName,
  getKey,
  createKey,
  unfmt,
} from "./deps.ts";

/** destroy an item */
export async function destroy(params) {
  let [TableName, Key] = await Promise.all([
    getTableName(),
    getKey(params),
  ]);
  return createClient().deleteItem({ TableName, Key });
}
