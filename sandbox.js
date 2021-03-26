export { assert, equal } from "https://deno.land/std/testing/asserts.ts";

/** start the sandbox and return a close handler */
export async function sandbox() {
  let w = new Worker(new URL("./sandbox.js", import.meta.url).href, {
    type: "module",
    deno: true,
  });
  await new Promise((res) => setTimeout(res, 1000)); //give it a second
  return async function stop() {
    w.terminate();
  };
}

if (import.meta.main) {
  (async function () {
    const p = Deno.run({
      cmd: ["arc", "sandbox"],
      stdin: "null",
      stdout: "null",
      stderr: "null",
    });
    await p.status();
  })();
}
