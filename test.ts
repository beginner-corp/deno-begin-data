import { assert, equal, sandbox } from "./sandbox.js";
import { version } from "./version.ts";
import { set, get, destroy } from "./mod.ts";
import { createKey } from "./deps.ts";

Deno.test(`begin/data@v${version}`, () => {
  if (!get) throw Error("missing module");
});

Deno.test("createKey", async () => {
  let stop = await sandbox();
  let result = await Promise.all([
    createKey("foo"),
    createKey("foo"),
    createKey("foo"),
  ]);
  console.log(result);
  await stop();
});

Deno.test("set, get & destroy", async () => {
  let stop = await sandbox();
  let result = await set({ table: "foo", cat: "sutr0" });
  console.log(result);
  //@ts-ignore
  let { key } = await get(result);
  await destroy({ table: "foo", key });
  await stop();
});

Deno.test("get by table name", async () => {
  let table = "cats";
  let stop = await sandbox();
  await Promise.all([
    set({ table, cat: "grey" }),
    set({ table, cat: "tabby" }),
    set({ table, cat: "black" }),
    set({ table, cat: "grey" }),
    set({ table, cat: "tabby" }),
    set({ table, cat: "black" }),
    set({ table, cat: "grey" }),
    set({ table, cat: "tabby" }),
    set({ table, cat: "black" }),
    set({ table, cat: "grey" }),
    set({ table, cat: "tabby" }),
    set({ table, cat: "black" }),
  ]);
  let result = await get({ table });
  console.log(result, result.cursor);
  await stop();
});

Deno.test("batch get", async () => {
  let table = "cats";
  let stop = await sandbox();
  let cat1 = { table, key: "sutr0" };
  let cat2 = { table, key: "blackie" };
  await Promise.all([
    set(cat1),
    set(cat2),
  ]);
  let result = await get([cat2, cat1]);
  console.log(result);
  await stop();
});

Deno.test("batch set", async () => {
  let table = "cats";
  let stop = await sandbox();
  let cat1 = { table, key: "sutr02" };
  let cat2 = { table, key: "blackie2" };
  let cat3 = { table };
  let result = await set([cat1, cat2, cat3]);
  console.log(result);
  await stop();
});
