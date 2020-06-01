import {
  createClient,
  getTableName,
  getKey,
} from "./deps.ts";

/** atomic increment */
export async function incr({ table, key, prop }) {
  let result = await createClient().updateItem({
    TableName: await getTableName(),
    Key: getKey({ table, key }),
    UpdateExpression: `SET ${prop} = if_not_exists(${prop}, :zero) + :val`,
    ExpressionAttributeValues: {
      ":val": 1,
      ":zero": 0,
    },
    ReturnValues: "ALL_NEW",
  });
  return result.Attributes;
}
