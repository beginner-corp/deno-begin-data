@app
myapp

@begin
lint "deno fmt"
test "deno test -A --unstable"
build "deno bundle mod.ts dist.js"

@tables
data
  scopeID *String
  dataID **String
  ttl TTL
