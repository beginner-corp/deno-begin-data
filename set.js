import {
  createClient,
  createKey,
  getKey,
  getTableName,
  unfmt,
} from "./deps.ts";

/** set record(s) */
export async function set(params) {
  let exec = Array.isArray(params) ? batch : one;
  return exec(params);
}

/** set one record */
async function one(params) {
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

/** batch set records */
async function batch(params) {
  let TableName = await getTableName();
  // ensure keys
  let ensure = await Promise.all(params.map((item) => {
    return async function () {
      if (!item.key) {
        item.key = await createKey(item.table);
      }
      return item;
    }();
  }));
  let batch = ensure.map(getKey).map((Item) => ({ PutRequest: { Item } }));
  let query = { RequestItems: {} };
  query.RequestItems[TableName] = batch;
  await createClient().batchWriteItem(query);
  let clean = (item) => unfmt(item.PutRequest.Item);
  return batch.map(clean);
}
