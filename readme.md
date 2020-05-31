# deno-begin-data

Experimental port of begin/data from Node to Deno

## prereq

- Node >= 12.x
- Deno >= 1.0.3
- `npm i -g @architect/architect`

## contrib

- Run the linter `./begin lint`
- Run the tests `./begin test`
- Add further tasks in `app.arc` under the `@begin` pragma

### todo

- [x] `get(params:{table:string, key:string})`
- [ ] `get(params:{table:string})`
- [ ] `get(params:object[])`
- [x] `set(params:{table:string, key:string})`
- [x] `set(params:{table:string})`
- [ ] `set(params:object[])`
- [x] `destroy(params:{table:string, key:string})`
- [x] `destroy(params:object[])`
- [ ] `incr()`
- [ ] `decr()`
- [ ] `count()`
- [ ] `page()`
