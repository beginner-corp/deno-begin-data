import {
  createClient,
  getTableName,
  getKey,
  createKey,
  unfmt,
} from "./deps.ts";

/** destroy record(s) */
export async function destroy(params) {
  // destroy batch
  if (Array.isArray(params)) {
    let TableName = await getTableName();
    let req = (Key) => ({ DeleteRequest: { Key } });
    let batch = params.map(getKey).map(req);
    let query = { RequestItems: {} };
    query.RequestItems[TableName] = batch;
    await createClient().batchWriteItem(query);
    return;
  }
  // destroy one
  if (params.table && params.key) {
    let [TableName, Key] = await Promise.all([
      getTableName(),
      getKey(params),
    ]);
    await createClient().deleteItem({ TableName, Key });
    return;
  }
  // destroy fail
  throw Error("destroy_invalid");
}
