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

- [x] `get(params:{table:string, key:string})`
- [x] `get(params:{table:string})`
- [x] `get(params:object[])`
- [x] `set(params:{table:string, key:string})`
- [x] `set(params:{table:string})`
- [x] `set(params:object[])`
- [x] `destroy(params:{table:string, key:string})`
- [x] `destroy(params:object[])`
- [x] `incr(params:{table:string, key:string, prop:string)`
- [x] `decr(params:{table:string, key:string, prop:string)`
- [x] `count(params:{table:string})`
- [x] `page(params:{table:string})`
- [ ] SSM discovery
