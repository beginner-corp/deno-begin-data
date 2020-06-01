# deno-begin-data

Experimental port of begin/data from Node to Deno

## prereq

- Deno >= 1.0.3
- Node >= 12.x and `npm i -g @architect/architect`

## contrib

- Run the linter `./begin lint`
- Run the tests `./begin test`
- Add further tasks in `app.arc` under the `@begin` pragma

### api

begin/data organizes collections of json documents by *`table`* and *`key`*. All documents have these properties.

### writing documents with `set`

- [x] `set(params:{table:string, key:string}):Promise<{table:string, key:string}>`
- [x] `set(params:{table:string}):Promise<{table:string, key:string}>`
- [x] `set(params:object[]):Promise<{table:string, key:string}[]>`

#### `set` examples

Write any valid JSON document; please ensure required `table` and `key` properties exist.

```typescript
import * as data from "https://deno.begin.com/data@latest/mod.ts";

await data.set({ table: "cats", key: "sutr0", cat: true, });
```

### reading documents with `get`

- [x] `get(params:{table:string, key:string, begin?:string}):Promise<{table:string, key:string}>` read one document
- [x] `get(params:{table:string}):Promise<{table:string, key:string}[]>` paginate documents
- [x] `get(params:object[]):Promise<{table:string, key:string}[]>` batch read documents

#### `get` examples

To read a single value pass named options `table` and `key` to `get`.

```typescript
import { get } from "https://deno.begin.com/data@latest/mod.ts";

let table = "people";
let key = "brian@begin.com";
let person = await get({ table, key })
// { table: "people", key: "brian@begin.com", role: "maintainer" }
```

To read the first ten records in a table just pass `table` and no other arguments:

```typescript
let firstpage = await get({ table })
// [{table, key}, {table, key}, {table, key}, ...]
let cursor = firstpage.cursor
// Xkasskieewxx9429kdad...
```

Paginate the table collection by passing `cursor` back to `get`:

```typescript
let secondpage = await get({ table, cursor })
// [{table, key}, {table, key}, {table, key}, ...]
```

### async iteration with `page`

- [x] `page(params:{table:string, limit:number, begin?:string}):AsyncIterator<{table:string, key:string}[]>`

#### `page` example

```typescript
import { page } from "https://deno.begin.com/data@latest/mod.ts";

let pages = await page({table: 'accounts', limit: 5})

for await (let account of pages) {
  console.log(account)
}
```

### `destroy` documents

- [x] `destroy(params:{table:string, key:string}):Promise<void>`
- [x] `destroy(params:object[]):Promise<void>`

### atomic counters

- [x] `incr(params:{table:string, key:string, prop:string):Promise<{table:string, key:string, prop:number}>`
- [x] `decr(params:{table:string, key:string, prop:string):Promise<{table:string, key:string, prop:number}>`
- [x] `count(params:{table:string}):Promise<number>`

