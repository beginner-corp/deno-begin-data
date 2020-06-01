export async function ssm(params) {
  let env = Deno.env.toObject();
  let Path = env.ARC_CLOUDFORMATION;
  let Recursive = true;
  //POST / HTTP/1.1
  //Host: ssm.us-east-2.amazonaws.com
  //Accept-Encoding: identity
  //Content-Length: 46
  //X-Amz-Target: AmazonSSM.GetParametersByPath
  //X-Amz-Date: 20180316T004724Z
  //User-Agent: aws-cli/1.11.180 Python/2.7.9 Windows/8 botocore/1.7.38
  //Content-Type: application/x-amz-json-1.1
  //Authorization: AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20180316/us-east-2/ssm/aws4_request,
  //SignedHeaders=content-type;host;x-amz-date;x-amz-target, Signature=39c3b3042cd2aEXAMPLE

  //{
  //    "Path": "/Branch312/Dev/",
  //    "Recursive": true
  //}
  let result = await fetch(opts);
  return fetch.json();
}
