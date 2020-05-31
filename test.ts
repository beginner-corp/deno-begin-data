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
