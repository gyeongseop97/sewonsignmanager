import crypto from 'crypto';

function hmac(key, data, encoding) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest(encoding);
}
function sha256(data, encoding='hex') {
  return crypto.createHash('sha256').update(data).digest(encoding);
}
function amzDate(date = new Date()) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}
function shortDate(amz) {
  return amz.slice(0, 8);
}
function encodePath(path) {
  return path.split('/').map(part => encodeURIComponent(part).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)).join('/');
}
function signingKey(secret, dateStamp) {
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, 'auto');
  const kService = hmac(kRegion, 's3');
  return hmac(kService, 'aws4_request');
}
export function r2Env() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET_NAME;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !bucket || !accessKey || !secretKey) {
    throw new Error('R2 environment variables are missing.');
  }
  return { accountId, bucket, accessKey, secretKey };
}
export async function r2Request({ method, key, body, contentType='application/octet-stream' }) {
  const { accountId, bucket, accessKey, secretKey } = r2Env();
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const payloadHash = body ? sha256(body) : sha256(Buffer.alloc(0));
  const date = amzDate();
  const dateStamp = shortDate(date);
  const canonicalUri = `/${bucket}/${encodePath(key)}`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const headers = {
    'content-type': contentType,
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': date
  };
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${date}\n`;
  const canonicalRequest = [method, canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', date, scope, sha256(canonicalRequest)].join('\n');
  const signature = hmac(signingKey(secretKey, dateStamp), stringToSign, 'hex');
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const url = `https://${host}${canonicalUri}`;
  return fetch(url, { method, headers, body });
}
