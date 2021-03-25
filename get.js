import { createClient, getKey, getTableName, unfmt } from "./deps.ts";

/** get an item */
export async function get(params) {
  // {table, key}
  if (params.table && params.key) {
    let [TableName, Key] = await Promise.all([
      getTableName(),
      getKey(params),
    ]);
    let { Item } = await createClient().getItem({ TableName, Key });
    return unfmt(Item);
  }

  // {table}
  if (params.table && !params.key) {
    params.key = params.begin || "UNKNOWN";

    let [TableName, Key] = await Promise.all([
      getTableName(),
      getKey(params),
    ]);

    let { dataID, scopeID } = Key;
    dataID = dataID.replace("#UNKNOWN", "");

    let query = {
      TableName,
      Limit: params.limit || 10,
      KeyConditionExpression:
        "#scopeID = :scopeID and begins_with(#dataID, :dataID)",
      ExpressionAttributeNames: {
        "#scopeID": "scopeID",
        "#dataID": "dataID",
      },
      ExpressionAttributeValues: {
        ":scopeID": scopeID,
        ":dataID": dataID,
      },
    };

    if (params.cursor) {
      query.ExclusiveStartKey = JSON.parse(atob(params.cursor));
    }

    let result = await createClient().query(query, { iteratePages: false });
    let exact = (item) => item.table === params.table;
    let returns = Array.isArray(result.Items)
      ? result.Items.map(unfmt).filter(exact)
      : [];
    if (result.LastEvaluatedKey) {
      returns.cursor = btoa(JSON.stringify(result.LastEvaluatedKey));
    }
    return returns;
  }

  // [{table, key}, {table, key}]
  if (Array.isArray(params)) {
    let TableName = await getTableName();
    let query = { RequestItems: {} };
    query.RequestItems[TableName] = { Keys: params.map(getKey) };
    let result = await createClient().batchGetItem(query);
    return result.Responses[TableName].map(unfmt);
  }

  throw Error("get_invalid");
}
