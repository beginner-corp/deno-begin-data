import {
  createClient,
  getTableName,
  getKey,
} from "./deps.ts";

export async function count({ table }) {
  let TableName = await getTableName();
  let { scopeID, dataID } = getKey({ table });
  let result = await createClient().query({
    TableName,
    Select: "COUNT",
    KeyConditionExpression:
      "#scopeID = :scopeID and begins_with(#dataID, :dataID)",
    ExpressionAttributeNames: {
      "#scopeID": "scopeID",
      "#dataID": "dataID",
    },
    ExpressionAttributeValues: {
      ":scopeID": scopeID,
      ":dataID": dataID.replace("#undefined", ""),
    },
  }, { iteratePages: false });
  return result.ScannedCount;
}
