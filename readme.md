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
- [ ] `destroy(params:object[])`
- [ ] `incr()`
- [ ] `decr()`
- [ ] `count()`
- [ ] `page()`
- [ ] SSM discovery
