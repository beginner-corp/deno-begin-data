@app
myapp

@begin
lint "deno fmt"
test "deno test -A --unstable"

@tables
data
  scopeID *String
  dataID **String
  ttl TTL
