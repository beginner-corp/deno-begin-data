import { createClient as create } from "https://denopkg.com/chiefbiiko/dynamodb/mod.ts";
import { Hashids } from "https://raw.githubusercontent.com/smallwins/deno-hashids/master/mod.js";

/** get a ddb client */
export function createClient() {
  let env = Deno.env.toObject();
  if (env.NODE_ENV === "testing" || env.DENO_ENV === "testing") {
    let conf = {
      credentials: {
        accessKeyId: "DynamoDBLocal",
        secretAccessKey: "DoesNotDoAnyAuth",
        sessionToken: "preferTemporaryCredentials",
      },
      region: "local",
      port: 5000,
    };
    return create(conf);
  }
  return create();
}

/** get the begin/data dynamodb table name */
export async function getTableName() {
  let env = Deno.env.toObject();
  // allow override
  if (env.BEGIN_DATA_TABLE_NAME) {
    return env.BEGIN_DATA_TABLE_NAME;
  }
  // check for local sandbox testing
  if (env.NODE_ENV === "testing" || env.DENO_ENV === "testing") {
    let db = createClient();
    let result = await db.listTables();
    return result.TableNames.find((t: string) => t.includes("-staging-data"));
  } else {
    // TODO SSM lookup here
  }
}

/** get a begin/data key schema given options */
export function getKey(opts: { table: string; key?: string }) {
  let env = Deno.env.toObject();
  let stage = env.DENO_ENV === "testing"
    ? "staging"
    : (env.DENO_ENV || "staging");
  let scopeID = env.BEGIN_DATA_SCOPE_ID || env.ARC_APP_NAME || "sandbox";
  let dataID = `${stage}#${opts.table}#${opts.key}`;
  return {
    scopeID,
    dataID,
  };
}

/** create a key */
export async function createKey(table: string) {
  let TableName = await getTableName();
  let db = createClient();
  let env = Deno.env.toObject();
  let scopeID = env.BEGIN_DATA_SCOPE_ID || env.ARC_APP_NAME || "sandbox";
  let dataID = `${table}-seq`;
  let result = await db.updateItem({
    TableName,
    Key: { scopeID, dataID },
    AttributeUpdates: {
      idx: {
        Action: "ADD",
        Value: 1,
      },
    },
    ReturnValues: "UPDATED_NEW",
  });

  let hash = new Hashids();
  let epoc = Date.now() - 1544909702376; // hbd
  let seed = Number(result.Attributes.idx);

  return hash.encode([epoc, seed]);
}

/** convert an object from ddb */
export function unfmt(obj: { [others: string]: any }) {
  if (!obj) {
    return null;
  }
  let copy = { ...obj };
  copy.key = obj.dataID.split("#")[2];
  copy.table = obj.dataID.split("#")[1];
  delete copy.scopeID;
  delete copy.dataID;
  return copy;
}
