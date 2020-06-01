import { get } from "./mod.ts";

export async function page(props) {
  if (!props.table) {
    throw ReferenceError("Missing params.table");
  }

  let cursor = false;
  let finished = false;

  function next() {
    // signal completion
    if (finished) {
      return {
        done: true,
      };
    }

    // copy in props each invocation (limit and table)
    let params = { ...props };

    // if the cursor is truthy add that value to params
    if (cursor) {
      params.cursor = cursor;
    }

    return new Promise(function sigh(resolve, reject) {
      get(params).then(function got(result) {
        if (result && result.cursor) {
          cursor = result.cursor;
          resolve({ value: result, done: false });
        } else {
          finished = true; // important! and weird yes. we'll miss the last page otherwise
          resolve({ value: result, done: false });
        }
      }).catch(reject);
    });
  }

  // yay
  let asyncIterator = { next };
  let asyncIterable = {
    [Symbol.asyncIterator]: () => asyncIterator,
  };
  return asyncIterable;
}
