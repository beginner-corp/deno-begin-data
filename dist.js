function getLengths(b64) {
    const len = b64.length;
    if (len % 4 > 0) {
        throw new TypeError("Invalid string. Length must be a multiple of 4");
    }
    let validLen = b64.indexOf("=");
    if (validLen === -1) {
        validLen = len;
    }
    const placeHoldersLen = validLen === len ? 0 : 4 - validLen % 4;
    return [
        validLen,
        placeHoldersLen
    ];
}
function init(lookup, revLookup) {
    function _byteLength(validLen, placeHoldersLen) {
        return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
    }
    function tripletToBase64(num) {
        return lookup[num >> 18 & 63] + lookup[num >> 12 & 63] + lookup[num >> 6 & 63] + lookup[num & 63];
    }
    function encodeChunk(buf, start, end) {
        const out = new Array((end - start) / 3);
        for(let i = start, curTriplet = 0; i < end; i += 3){
            out[curTriplet++] = tripletToBase64((buf[i] << 16) + (buf[i + 1] << 8) + buf[i + 2]);
        }
        return out.join("");
    }
    return {
        byteLength (b64) {
            return _byteLength.apply(null, getLengths(b64));
        },
        toUint8Array (b64) {
            const [validLen, placeHoldersLen] = getLengths(b64);
            const buf = new Uint8Array(_byteLength(validLen, placeHoldersLen));
            const len = placeHoldersLen ? validLen - 4 : validLen;
            let tmp;
            let curByte = 0;
            let i;
            for(i = 0; i < len; i += 4){
                tmp = revLookup[b64.charCodeAt(i)] << 18 | revLookup[b64.charCodeAt(i + 1)] << 12 | revLookup[b64.charCodeAt(i + 2)] << 6 | revLookup[b64.charCodeAt(i + 3)];
                buf[curByte++] = tmp >> 16 & 255;
                buf[curByte++] = tmp >> 8 & 255;
                buf[curByte++] = tmp & 255;
            }
            if (placeHoldersLen === 2) {
                tmp = revLookup[b64.charCodeAt(i)] << 2 | revLookup[b64.charCodeAt(i + 1)] >> 4;
                buf[curByte++] = tmp & 255;
            } else if (placeHoldersLen === 1) {
                tmp = revLookup[b64.charCodeAt(i)] << 10 | revLookup[b64.charCodeAt(i + 1)] << 4 | revLookup[b64.charCodeAt(i + 2)] >> 2;
                buf[curByte++] = tmp >> 8 & 255;
                buf[curByte++] = tmp & 255;
            }
            return buf;
        },
        fromUint8Array (buf) {
            const maxChunkLength = 16383;
            const len = buf.length;
            const extraBytes = len % 3;
            const len2 = len - extraBytes;
            const parts = new Array(Math.ceil(len2 / 16383) + (extraBytes ? 1 : 0));
            let curChunk = 0;
            let chunkEnd;
            for(let i = 0; i < len2; i += maxChunkLength){
                chunkEnd = i + maxChunkLength;
                parts[curChunk++] = encodeChunk(buf, i, chunkEnd > len2 ? len2 : chunkEnd);
            }
            let tmp;
            if (extraBytes === 1) {
                tmp = buf[len2];
                parts[curChunk] = lookup[tmp >> 2] + lookup[tmp << 4 & 63] + "==";
            } else if (extraBytes === 2) {
                tmp = buf[len2] << 8 | buf[len2 + 1] & 255;
                parts[curChunk] = lookup[tmp >> 10] + lookup[tmp >> 4 & 63] + lookup[tmp << 2 & 63] + "=";
            }
            return parts.join("");
        }
    };
}
const lookup = [];
const revLookup = [];
const code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
for(let i = 0, l = code.length; i < l; ++i){
    lookup[i] = code[i];
    revLookup[code.charCodeAt(i)] = i;
}
revLookup["-".charCodeAt(0)] = 62;
revLookup["_".charCodeAt(0)] = 63;
const mod = init(lookup, revLookup);
const toUint8Array = mod.toUint8Array;
const fromUint8Array = mod.fromUint8Array;
const decoder = new TextDecoder();
const encoder = new TextEncoder();
function toUrlSafe(str) {
    return str.replace(/\-/g, "+").replace(/_/g, "/");
}
function fromUrlSafe(str) {
    return str.replace(/\+/g, "-").replace(/\//g, "_");
}
function toHexString(buf) {
    return buf.reduce((hex, __byte)=>`${hex}${__byte < 16 ? "0" : ""}${__byte.toString(16)}`
    , "");
}
function fromHexString(hex) {
    const len = hex.length;
    if (len % 2 || !/^[0-9a-fA-F]+$/.test(hex)) {
        throw new TypeError("Invalid hex string.");
    }
    hex = hex.toLowerCase();
    const buf = new Uint8Array(Math.floor(len / 2));
    const end = len / 2;
    for(let i1 = 0; i1 < end; ++i1){
        buf[i1] = parseInt(hex.substr(i1 * 2, 2), 16);
    }
    return buf;
}
function decode(buf, encoding = "utf8") {
    if (/^utf-?8$/i.test(encoding)) {
        return decoder.decode(buf);
    } else if (/^base64$/i.test(encoding)) {
        return fromUint8Array(buf);
    } else if (/^base64url$/i.test(encoding)) {
        return toUrlSafe(fromUint8Array(buf));
    } else if (/^hex(?:adecimal)?$/i.test(encoding)) {
        return toHexString(buf);
    } else {
        throw new TypeError("Unsupported string encoding.");
    }
}
function encode(str, encoding = "utf8") {
    if (/^utf-?8$/i.test(encoding)) {
        return encoder.encode(str);
    } else if (/^base64(?:url)?$/i.test(encoding)) {
        return toUint8Array(fromUrlSafe(str));
    } else if (/^hex(?:adecimal)?$/i.test(encoding)) {
        return fromHexString(str);
    } else {
        throw new TypeError("Unsupported string encoding.");
    }
}
const HOME = (Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE")) ?? "";
const NEW_LINE_REGEX = /\r?\n/;
const PROFILE_REGEXP = /^\[\s*(?:profile)?\s*([^\s]*)\s*\].*$/i;
const QUOTE_REGEXP = /(^\s*["']?)|(["']?\s*$)/g;
const decoder1 = new TextDecoder();
function fileExistsSync(file) {
    try {
        Deno.statSync(file);
        return true;
    } catch (_) {
        return false;
    }
}
function normalizeKey(key) {
    return key.toLowerCase().replace("aws_", "").split("_").map((part, i1)=>i1 === 0 ? part : `${part[0].toUpperCase()}${part.slice(1)}`
    ).join("");
}
function parse(file) {
    if (!fileExistsSync(file)) {
        return {
        };
    }
    return decoder1.decode(Deno.readFileSync(file)).split(NEW_LINE_REGEX).map((line)=>line.trim()
    ).filter((line)=>!!line && !line.startsWith("#")
    ).reduce(([oldProfile, acc], line)=>{
        let newProfile = "";
        if (line.startsWith("[")) {
            newProfile = line.replace(PROFILE_REGEXP, "$1");
            if (!acc.hasOwnProperty(newProfile)) {
                acc[newProfile] = {
                };
            }
        } else {
            const [key, val] = line.split("=").map((part)=>part.replace(QUOTE_REGEXP, "")
            );
            acc[newProfile || oldProfile][normalizeKey(key)] = val;
        }
        return [
            newProfile || oldProfile,
            acc
        ];
    }, [
        "default",
        {
            default: {
            }
        }
    ])[1];
}
function get2(opts = {
}) {
    const _opts = {
        ...opts,
        env: opts.env !== false
    };
    const ENV = _opts.env ? Deno.env.toObject() : {
    };
    _opts.fs = _opts.fs !== false;
    _opts.profile = _opts.profile || ENV.AWS_PROFILE || "default";
    _opts.credentialsFile = _opts.credentialsFile || `${HOME}/.aws/credentials`;
    _opts.configFile = _opts.configFile || `${HOME}/.aws/config`;
    if (_opts.env && ENV.AWS_ACCESS_KEY_ID && ENV.AWS_SECRET_ACCESS_KEY && ENV.AWS_DEFAULT_REGION) {
        return {
            accessKeyId: ENV.AWS_ACCESS_KEY_ID,
            secretAccessKey: ENV.AWS_SECRET_ACCESS_KEY,
            sessionToken: ENV.AWS_SESSION_TOKEN,
            region: ENV.AWS_DEFAULT_REGION
        };
    }
    if (_opts.fs) {
        const credentials = parse(opts.credentialsFile || ENV.AWS_SHARED_CREDENTIALS_FILE || _opts.credentialsFile);
        const config = parse(opts.configFile || ENV.AWS_CONFIG_FILE || _opts.configFile);
        const _profile = opts.profile || ENV.AWS_PROFILE || _opts.profile;
        credentials[_profile] = credentials[_profile] || {
        };
        config[_profile] = config[_profile] || {
        };
        return {
            ...config[_profile],
            ...credentials[_profile],
            accessKeyId: ENV.AWS_ACCESS_KEY_ID || credentials[_profile].accessKeyId || config[_profile].accessKeyId,
            secretAccessKey: ENV.AWS_SECRET_ACCESS_KEY || credentials[_profile].secretAccessKey || config[_profile].secretAccessKey,
            sessionToken: ENV.AWS_SESSION_TOKEN || credentials[_profile].sessionToken || config[_profile].sessionToken,
            region: ENV.AWS_REGION || ENV.AWS_DEFAULT_REGION || config[_profile].region || config[_profile].default_region || credentials[_profile].region || credentials[_profile].default_region
        };
    }
    return {
    };
}
function getLengths1(b64) {
    const len = b64.length;
    let validLen = b64.indexOf("=");
    if (validLen === -1) {
        validLen = len;
    }
    const placeHoldersLen = validLen === len ? 0 : 4 - validLen % 4;
    return [
        validLen,
        placeHoldersLen
    ];
}
function init1(lookup1, revLookup1, urlsafe = false) {
    function _byteLength(validLen, placeHoldersLen) {
        return Math.floor((validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen);
    }
    function tripletToBase64(num) {
        return lookup1[num >> 18 & 63] + lookup1[num >> 12 & 63] + lookup1[num >> 6 & 63] + lookup1[num & 63];
    }
    function encodeChunk(buf, start, end) {
        const out = new Array((end - start) / 3);
        for(let i1 = start, curTriplet = 0; i1 < end; i1 += 3){
            out[curTriplet++] = tripletToBase64((buf[i1] << 16) + (buf[i1 + 1] << 8) + buf[i1 + 2]);
        }
        return out.join("");
    }
    return {
        byteLength (b64) {
            return _byteLength.apply(null, getLengths1(b64));
        },
        toUint8Array (b64) {
            const [validLen, placeHoldersLen] = getLengths1(b64);
            const buf = new Uint8Array(_byteLength(validLen, placeHoldersLen));
            const len = placeHoldersLen ? validLen - 4 : validLen;
            let tmp;
            let curByte = 0;
            let i1;
            for(i1 = 0; i1 < len; i1 += 4){
                tmp = revLookup1[b64.charCodeAt(i1)] << 18 | revLookup1[b64.charCodeAt(i1 + 1)] << 12 | revLookup1[b64.charCodeAt(i1 + 2)] << 6 | revLookup1[b64.charCodeAt(i1 + 3)];
                buf[curByte++] = tmp >> 16 & 255;
                buf[curByte++] = tmp >> 8 & 255;
                buf[curByte++] = tmp & 255;
            }
            if (placeHoldersLen === 2) {
                tmp = revLookup1[b64.charCodeAt(i1)] << 2 | revLookup1[b64.charCodeAt(i1 + 1)] >> 4;
                buf[curByte++] = tmp & 255;
            } else if (placeHoldersLen === 1) {
                tmp = revLookup1[b64.charCodeAt(i1)] << 10 | revLookup1[b64.charCodeAt(i1 + 1)] << 4 | revLookup1[b64.charCodeAt(i1 + 2)] >> 2;
                buf[curByte++] = tmp >> 8 & 255;
                buf[curByte++] = tmp & 255;
            }
            return buf;
        },
        fromUint8Array (buf) {
            const maxChunkLength = 16383;
            const len = buf.length;
            const extraBytes = len % 3;
            const len2 = len - extraBytes;
            const parts = new Array(Math.ceil(len2 / 16383) + (extraBytes ? 1 : 0));
            let curChunk = 0;
            let chunkEnd;
            for(let i1 = 0; i1 < len2; i1 += maxChunkLength){
                chunkEnd = i1 + maxChunkLength;
                parts[curChunk++] = encodeChunk(buf, i1, chunkEnd > len2 ? len2 : chunkEnd);
            }
            let tmp;
            if (extraBytes === 1) {
                tmp = buf[len2];
                parts[curChunk] = lookup1[tmp >> 2] + lookup1[tmp << 4 & 63];
                if (!urlsafe) parts[curChunk] += "==";
            } else if (extraBytes === 2) {
                tmp = buf[len2] << 8 | buf[len2 + 1] & 255;
                parts[curChunk] = lookup1[tmp >> 10] + lookup1[tmp >> 4 & 63] + lookup1[tmp << 2 & 63];
                if (!urlsafe) parts[curChunk] += "=";
            }
            return parts.join("");
        }
    };
}
const lookup1 = [];
const revLookup1 = [];
const code1 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
for(let i1 = 0, l1 = code1.length; i1 < l1; ++i1){
    lookup1[i1] = code1[i1];
    revLookup1[code1.charCodeAt(i1)] = i1;
}
const { byteLength , toUint8Array: toUint8Array1 , fromUint8Array: fromUint8Array1  } = init1(lookup1, revLookup1, true);
const decoder2 = new TextDecoder();
const encoder1 = new TextEncoder();
function toHexString1(buf) {
    return buf.reduce((hex, __byte)=>`${hex}${__byte < 16 ? "0" : ""}${__byte.toString(16)}`
    , "");
}
function fromHexString1(hex) {
    const len = hex.length;
    if (len % 2 || !/^[0-9a-fA-F]+$/.test(hex)) {
        throw new TypeError("Invalid hex string.");
    }
    hex = hex.toLowerCase();
    const buf = new Uint8Array(Math.floor(len / 2));
    const end = len / 2;
    for(let i2 = 0; i2 < end; ++i2){
        buf[i2] = parseInt(hex.substr(i2 * 2, 2), 16);
    }
    return buf;
}
function decode1(buf, encoding = "utf8") {
    if (/^utf-?8$/i.test(encoding)) {
        return decoder2.decode(buf);
    } else if (/^base64$/i.test(encoding)) {
        return fromUint8Array1(buf);
    } else if (/^hex(?:adecimal)?$/i.test(encoding)) {
        return toHexString1(buf);
    } else {
        throw new TypeError("Unsupported string encoding.");
    }
}
function encode1(str, encoding = "utf8") {
    if (/^utf-?8$/i.test(encoding)) {
        return encoder1.encode(str);
    } else if (/^base64$/i.test(encoding)) {
        return toUint8Array1(str);
    } else if (/^hex(?:adecimal)?$/i.test(encoding)) {
        return fromHexString1(str);
    } else {
        throw new TypeError("Unsupported string encoding.");
    }
}
function rotl(x, n) {
    return x << n | x >>> 32 - n;
}
class SHA1 {
    hashSize = 20;
    _buf = new Uint8Array(64);
    _K = new Uint32Array([
        1518500249,
        1859775393,
        2400959708,
        3395469782
    ]);
    constructor(){
        this.init();
    }
    static F(t, b, c, d) {
        if (t <= 19) {
            return b & c | ~b & d;
        } else if (t <= 39) {
            return b ^ c ^ d;
        } else if (t <= 59) {
            return b & c | b & d | c & d;
        } else {
            return b ^ c ^ d;
        }
    }
    init() {
        this._H = new Uint32Array([
            1732584193,
            4023233417,
            2562383102,
            271733878,
            3285377520
        ]);
        this._bufIdx = 0;
        this._count = new Uint32Array(2);
        this._buf.fill(0);
        this._finalized = false;
        return this;
    }
    update(msg, inputEncoding) {
        if (msg === null) {
            throw new TypeError("msg must be a string or Uint8Array.");
        } else if (typeof msg === "string") {
            msg = encode1(msg, inputEncoding);
        }
        for(let i2 = 0; i2 < msg.length; i2++){
            this._buf[this._bufIdx++] = msg[i2];
            if (this._bufIdx === 64) {
                this.transform();
                this._bufIdx = 0;
            }
        }
        const c = this._count;
        if ((c[0] += msg.length << 3) < msg.length << 3) {
            c[1]++;
        }
        c[1] += msg.length >>> 29;
        return this;
    }
    digest(outputEncoding) {
        if (this._finalized) {
            throw new Error("digest has already been called.");
        }
        this._finalized = true;
        const b = this._buf;
        let idx = this._bufIdx;
        b[idx++] = 128;
        while(idx !== 56){
            if (idx === 64) {
                this.transform();
                idx = 0;
            }
            b[idx++] = 0;
        }
        const c = this._count;
        b[56] = c[1] >>> 24 & 255;
        b[57] = c[1] >>> 16 & 255;
        b[58] = c[1] >>> 8 & 255;
        b[59] = c[1] >>> 0 & 255;
        b[60] = c[0] >>> 24 & 255;
        b[61] = c[0] >>> 16 & 255;
        b[62] = c[0] >>> 8 & 255;
        b[63] = c[0] >>> 0 & 255;
        this.transform();
        const hash = new Uint8Array(20);
        for(let i2 = 0; i2 < 5; i2++){
            hash[(i2 << 2) + 0] = this._H[i2] >>> 24 & 255;
            hash[(i2 << 2) + 1] = this._H[i2] >>> 16 & 255;
            hash[(i2 << 2) + 2] = this._H[i2] >>> 8 & 255;
            hash[(i2 << 2) + 3] = this._H[i2] >>> 0 & 255;
        }
        this.init();
        return outputEncoding ? decode1(hash, outputEncoding) : hash;
    }
    transform() {
        const h = this._H;
        let a = h[0];
        let b = h[1];
        let c = h[2];
        let d = h[3];
        let e = h[4];
        const w = new Uint32Array(80);
        for(let i2 = 0; i2 < 16; i2++){
            w[i2] = this._buf[(i2 << 2) + 3] | this._buf[(i2 << 2) + 2] << 8 | this._buf[(i2 << 2) + 1] << 16 | this._buf[i2 << 2] << 24;
        }
        for(let t = 0; t < 80; t++){
            if (t >= 16) {
                w[t] = rotl(w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16], 1);
            }
            const tmp = rotl(a, 5) + SHA1.F(t, b, c, d) + e + w[t] + this._K[Math.floor(t / 20)] | 0;
            e = d;
            d = c;
            c = rotl(b, 30);
            b = a;
            a = tmp;
        }
        h[0] = h[0] + a | 0;
        h[1] = h[1] + b | 0;
        h[2] = h[2] + c | 0;
        h[3] = h[3] + d | 0;
        h[4] = h[4] + e | 0;
    }
}
class SHA256 {
    hashSize = 32;
    constructor(){
        this._buf = new Uint8Array(64);
        this._K = new Uint32Array([
            1116352408,
            1899447441,
            3049323471,
            3921009573,
            961987163,
            1508970993,
            2453635748,
            2870763221,
            3624381080,
            310598401,
            607225278,
            1426881987,
            1925078388,
            2162078206,
            2614888103,
            3248222580,
            3835390401,
            4022224774,
            264347078,
            604807628,
            770255983,
            1249150122,
            1555081692,
            1996064986,
            2554220882,
            2821834349,
            2952996808,
            3210313671,
            3336571891,
            3584528711,
            113926993,
            338241895,
            666307205,
            773529912,
            1294757372,
            1396182291,
            1695183700,
            1986661051,
            2177026350,
            2456956037,
            2730485921,
            2820302411,
            3259730800,
            3345764771,
            3516065817,
            3600352804,
            4094571909,
            275423344,
            430227734,
            506948616,
            659060556,
            883997877,
            958139571,
            1322822218,
            1537002063,
            1747873779,
            1955562222,
            2024104815,
            2227730452,
            2361852424,
            2428436474,
            2756734187,
            3204031479,
            3329325298
        ]);
        this.init();
    }
    init() {
        this._H = new Uint32Array([
            1779033703,
            3144134277,
            1013904242,
            2773480762,
            1359893119,
            2600822924,
            528734635,
            1541459225
        ]);
        this._bufIdx = 0;
        this._count = new Uint32Array(2);
        this._buf.fill(0);
        this._finalized = false;
        return this;
    }
    update(msg, inputEncoding) {
        if (msg === null) {
            throw new TypeError("msg must be a string or Uint8Array.");
        } else if (typeof msg === "string") {
            msg = encode1(msg, inputEncoding);
        }
        for(let i2 = 0, len = msg.length; i2 < len; i2++){
            this._buf[this._bufIdx++] = msg[i2];
            if (this._bufIdx === 64) {
                this._transform();
                this._bufIdx = 0;
            }
        }
        const c = this._count;
        if ((c[0] += msg.length << 3) < msg.length << 3) {
            c[1]++;
        }
        c[1] += msg.length >>> 29;
        return this;
    }
    digest(outputEncoding) {
        if (this._finalized) {
            throw new Error("digest has already been called.");
        }
        this._finalized = true;
        const b = this._buf;
        let idx = this._bufIdx;
        b[idx++] = 128;
        while(idx !== 56){
            if (idx === 64) {
                this._transform();
                idx = 0;
            }
            b[idx++] = 0;
        }
        const c = this._count;
        b[56] = c[1] >>> 24 & 255;
        b[57] = c[1] >>> 16 & 255;
        b[58] = c[1] >>> 8 & 255;
        b[59] = c[1] >>> 0 & 255;
        b[60] = c[0] >>> 24 & 255;
        b[61] = c[0] >>> 16 & 255;
        b[62] = c[0] >>> 8 & 255;
        b[63] = c[0] >>> 0 & 255;
        this._transform();
        const hash = new Uint8Array(32);
        for(let i2 = 0; i2 < 8; i2++){
            hash[(i2 << 2) + 0] = this._H[i2] >>> 24 & 255;
            hash[(i2 << 2) + 1] = this._H[i2] >>> 16 & 255;
            hash[(i2 << 2) + 2] = this._H[i2] >>> 8 & 255;
            hash[(i2 << 2) + 3] = this._H[i2] >>> 0 & 255;
        }
        this.init();
        return outputEncoding ? decode1(hash, outputEncoding) : hash;
    }
    _transform() {
        const h = this._H;
        let h0 = h[0];
        let h1 = h[1];
        let h2 = h[2];
        let h3 = h[3];
        let h4 = h[4];
        let h5 = h[5];
        let h6 = h[6];
        let h7 = h[7];
        const w = new Uint32Array(16);
        let i2;
        for(i2 = 0; i2 < 16; i2++){
            w[i2] = this._buf[(i2 << 2) + 3] | this._buf[(i2 << 2) + 2] << 8 | this._buf[(i2 << 2) + 1] << 16 | this._buf[i2 << 2] << 24;
        }
        for(i2 = 0; i2 < 64; i2++){
            let tmp;
            if (i2 < 16) {
                tmp = w[i2];
            } else {
                let a = w[i2 + 1 & 15];
                let b = w[i2 + 14 & 15];
                tmp = w[i2 & 15] = (a >>> 7 ^ a >>> 18 ^ a >>> 3 ^ a << 25 ^ a << 14) + (b >>> 17 ^ b >>> 19 ^ b >>> 10 ^ b << 15 ^ b << 13) + w[i2 & 15] + w[i2 + 9 & 15] | 0;
            }
            tmp = tmp + h7 + (h4 >>> 6 ^ h4 >>> 11 ^ h4 >>> 25 ^ h4 << 26 ^ h4 << 21 ^ h4 << 7) + (h6 ^ h4 & (h5 ^ h6)) + this._K[i2] | 0;
            h7 = h6;
            h6 = h5;
            h5 = h4;
            h4 = h3 + tmp;
            h3 = h2;
            h2 = h1;
            h1 = h0;
            h0 = tmp + (h1 & h2 ^ h3 & (h1 ^ h2)) + (h1 >>> 2 ^ h1 >>> 13 ^ h1 >>> 22 ^ h1 << 30 ^ h1 << 19 ^ h1 << 10) | 0;
        }
        h[0] = h[0] + h0 | 0;
        h[1] = h[1] + h1 | 0;
        h[2] = h[2] + h2 | 0;
        h[3] = h[3] + h3 | 0;
        h[4] = h[4] + h4 | 0;
        h[5] = h[5] + h5 | 0;
        h[6] = h[6] + h6 | 0;
        h[7] = h[7] + h7 | 0;
    }
}
function sha256(msg, inputEncoding, outputEncoding) {
    return new SHA256().update(msg, inputEncoding).digest(outputEncoding);
}
class SHA512 {
    hashSize = 64;
    _buffer = new Uint8Array(128);
    constructor(){
        this._K = new Uint32Array([
            1116352408,
            3609767458,
            1899447441,
            602891725,
            3049323471,
            3964484399,
            3921009573,
            2173295548,
            961987163,
            4081628472,
            1508970993,
            3053834265,
            2453635748,
            2937671579,
            2870763221,
            3664609560,
            3624381080,
            2734883394,
            310598401,
            1164996542,
            607225278,
            1323610764,
            1426881987,
            3590304994,
            1925078388,
            4068182383,
            2162078206,
            991336113,
            2614888103,
            633803317,
            3248222580,
            3479774868,
            3835390401,
            2666613458,
            4022224774,
            944711139,
            264347078,
            2341262773,
            604807628,
            2007800933,
            770255983,
            1495990901,
            1249150122,
            1856431235,
            1555081692,
            3175218132,
            1996064986,
            2198950837,
            2554220882,
            3999719339,
            2821834349,
            766784016,
            2952996808,
            2566594879,
            3210313671,
            3203337956,
            3336571891,
            1034457026,
            3584528711,
            2466948901,
            113926993,
            3758326383,
            338241895,
            168717936,
            666307205,
            1188179964,
            773529912,
            1546045734,
            1294757372,
            1522805485,
            1396182291,
            2643833823,
            1695183700,
            2343527390,
            1986661051,
            1014477480,
            2177026350,
            1206759142,
            2456956037,
            344077627,
            2730485921,
            1290863460,
            2820302411,
            3158454273,
            3259730800,
            3505952657,
            3345764771,
            106217008,
            3516065817,
            3606008344,
            3600352804,
            1432725776,
            4094571909,
            1467031594,
            275423344,
            851169720,
            430227734,
            3100823752,
            506948616,
            1363258195,
            659060556,
            3750685593,
            883997877,
            3785050280,
            958139571,
            3318307427,
            1322822218,
            3812723403,
            1537002063,
            2003034995,
            1747873779,
            3602036899,
            1955562222,
            1575990012,
            2024104815,
            1125592928,
            2227730452,
            2716904306,
            2361852424,
            442776044,
            2428436474,
            593698344,
            2756734187,
            3733110249,
            3204031479,
            2999351573,
            3329325298,
            3815920427,
            3391569614,
            3928383900,
            3515267271,
            566280711,
            3940187606,
            3454069534,
            4118630271,
            4000239992,
            116418474,
            1914138554,
            174292421,
            2731055270,
            289380356,
            3203993006,
            460393269,
            320620315,
            685471733,
            587496836,
            852142971,
            1086792851,
            1017036298,
            365543100,
            1126000580,
            2618297676,
            1288033470,
            3409855158,
            1501505948,
            4234509866,
            1607167915,
            987167468,
            1816402316,
            1246189591
        ]);
        this.init();
    }
    init() {
        this._H = new Uint32Array([
            1779033703,
            4089235720,
            3144134277,
            2227873595,
            1013904242,
            4271175723,
            2773480762,
            1595750129,
            1359893119,
            2917565137,
            2600822924,
            725511199,
            528734635,
            4215389547,
            1541459225,
            327033209
        ]);
        this._bufferIndex = 0;
        this._count = new Uint32Array(2);
        this._buffer.fill(0);
        this._finalized = false;
        return this;
    }
    update(msg, inputEncoding) {
        if (msg === null) {
            throw new TypeError("msg must be a string or Uint8Array.");
        } else if (typeof msg === "string") {
            msg = encode1(msg, inputEncoding);
        }
        for(let i2 = 0; i2 < msg.length; i2++){
            this._buffer[this._bufferIndex++] = msg[i2];
            if (this._bufferIndex === 128) {
                this.transform();
                this._bufferIndex = 0;
            }
        }
        let c = this._count;
        if ((c[0] += msg.length << 3) < msg.length << 3) {
            c[1]++;
        }
        c[1] += msg.length >>> 29;
        return this;
    }
    digest(outputEncoding) {
        if (this._finalized) {
            throw new Error("digest has already been called.");
        }
        this._finalized = true;
        var b = this._buffer, idx = this._bufferIndex;
        b[idx++] = 128;
        while(idx !== 112){
            if (idx === 128) {
                this.transform();
                idx = 0;
            }
            b[idx++] = 0;
        }
        let c = this._count;
        b[112] = b[113] = b[114] = b[115] = b[116] = b[117] = b[118] = b[119] = 0;
        b[120] = c[1] >>> 24 & 255;
        b[121] = c[1] >>> 16 & 255;
        b[122] = c[1] >>> 8 & 255;
        b[123] = c[1] >>> 0 & 255;
        b[124] = c[0] >>> 24 & 255;
        b[125] = c[0] >>> 16 & 255;
        b[126] = c[0] >>> 8 & 255;
        b[127] = c[0] >>> 0 & 255;
        this.transform();
        let i2, hash = new Uint8Array(64);
        for(i2 = 0; i2 < 16; i2++){
            hash[(i2 << 2) + 0] = this._H[i2] >>> 24 & 255;
            hash[(i2 << 2) + 1] = this._H[i2] >>> 16 & 255;
            hash[(i2 << 2) + 2] = this._H[i2] >>> 8 & 255;
            hash[(i2 << 2) + 3] = this._H[i2] & 255;
        }
        this.init();
        return outputEncoding ? decode1(hash, outputEncoding) : hash;
    }
    transform() {
        let h = this._H, h0h = h[0], h0l = h[1], h1h = h[2], h1l = h[3], h2h = h[4], h2l = h[5], h3h = h[6], h3l = h[7], h4h = h[8], h4l = h[9], h5h = h[10], h5l = h[11], h6h = h[12], h6l = h[13], h7h = h[14], h7l = h[15];
        let ah = h0h, al = h0l, bh = h1h, bl = h1l, ch = h2h, cl = h2l, dh = h3h, dl = h3l, eh = h4h, el = h4l, fh = h5h, fl = h5l, gh = h6h, gl = h6l, hh = h7h, hl = h7l;
        let i2, w = new Uint32Array(160);
        for(i2 = 0; i2 < 32; i2++){
            w[i2] = this._buffer[(i2 << 2) + 3] | this._buffer[(i2 << 2) + 2] << 8 | this._buffer[(i2 << 2) + 1] << 16 | this._buffer[i2 << 2] << 24;
        }
        let gamma0xl, gamma0xh, gamma0l, gamma0h, gamma1xl, gamma1xh, gamma1l, gamma1h, wrl, wrh, wr7l, wr7h, wr16l, wr16h;
        for(i2 = 16; i2 < 80; i2++){
            gamma0xh = w[(i2 - 15) * 2];
            gamma0xl = w[(i2 - 15) * 2 + 1];
            gamma0h = (gamma0xl << 31 | gamma0xh >>> 1) ^ (gamma0xl << 24 | gamma0xh >>> 8) ^ gamma0xh >>> 7;
            gamma0l = (gamma0xh << 31 | gamma0xl >>> 1) ^ (gamma0xh << 24 | gamma0xl >>> 8) ^ (gamma0xh << 25 | gamma0xl >>> 7);
            gamma1xh = w[(i2 - 2) * 2];
            gamma1xl = w[(i2 - 2) * 2 + 1];
            gamma1h = (gamma1xl << 13 | gamma1xh >>> 19) ^ (gamma1xh << 3 | gamma1xl >>> 29) ^ gamma1xh >>> 6;
            gamma1l = (gamma1xh << 13 | gamma1xl >>> 19) ^ (gamma1xl << 3 | gamma1xh >>> 29) ^ (gamma1xh << 26 | gamma1xl >>> 6);
            wr7h = w[(i2 - 7) * 2], wr7l = w[(i2 - 7) * 2 + 1], wr16h = w[(i2 - 16) * 2], wr16l = w[(i2 - 16) * 2 + 1];
            wrl = gamma0l + wr7l;
            wrh = gamma0h + wr7h + (wrl >>> 0 < gamma0l >>> 0 ? 1 : 0);
            wrl += gamma1l;
            wrh += gamma1h + (wrl >>> 0 < gamma1l >>> 0 ? 1 : 0);
            wrl += wr16l;
            wrh += wr16h + (wrl >>> 0 < wr16l >>> 0 ? 1 : 0);
            w[i2 * 2] = wrh;
            w[i2 * 2 + 1] = wrl;
        }
        let chl, chh, majl, majh, sig0l, sig0h, sig1l, sig1h, krl, krh, t1l, t1h, t2l, t2h;
        for(i2 = 0; i2 < 80; i2++){
            chh = eh & fh ^ ~eh & gh;
            chl = el & fl ^ ~el & gl;
            majh = ah & bh ^ ah & ch ^ bh & ch;
            majl = al & bl ^ al & cl ^ bl & cl;
            sig0h = (al << 4 | ah >>> 28) ^ (ah << 30 | al >>> 2) ^ (ah << 25 | al >>> 7);
            sig0l = (ah << 4 | al >>> 28) ^ (al << 30 | ah >>> 2) ^ (al << 25 | ah >>> 7);
            sig1h = (el << 18 | eh >>> 14) ^ (el << 14 | eh >>> 18) ^ (eh << 23 | el >>> 9);
            sig1l = (eh << 18 | el >>> 14) ^ (eh << 14 | el >>> 18) ^ (el << 23 | eh >>> 9);
            krh = this._K[i2 * 2];
            krl = this._K[i2 * 2 + 1];
            t1l = hl + sig1l;
            t1h = hh + sig1h + (t1l >>> 0 < hl >>> 0 ? 1 : 0);
            t1l += chl;
            t1h += chh + (t1l >>> 0 < chl >>> 0 ? 1 : 0);
            t1l += krl;
            t1h += krh + (t1l >>> 0 < krl >>> 0 ? 1 : 0);
            t1l = t1l + w[i2 * 2 + 1];
            t1h += w[i2 * 2] + (t1l >>> 0 < w[i2 * 2 + 1] >>> 0 ? 1 : 0);
            t2l = sig0l + majl;
            t2h = sig0h + majh + (t2l >>> 0 < sig0l >>> 0 ? 1 : 0);
            hh = gh;
            hl = gl;
            gh = fh;
            gl = fl;
            fh = eh;
            fl = el;
            el = dl + t1l | 0;
            eh = dh + t1h + (el >>> 0 < dl >>> 0 ? 1 : 0) | 0;
            dh = ch;
            dl = cl;
            ch = bh;
            cl = bl;
            bh = ah;
            bl = al;
            al = t1l + t2l | 0;
            ah = t1h + t2h + (al >>> 0 < t1l >>> 0 ? 1 : 0) | 0;
        }
        h0l = h[1] = h0l + al | 0;
        h[0] = h0h + ah + (h0l >>> 0 < al >>> 0 ? 1 : 0) | 0;
        h1l = h[3] = h1l + bl | 0;
        h[2] = h1h + bh + (h1l >>> 0 < bl >>> 0 ? 1 : 0) | 0;
        h2l = h[5] = h2l + cl | 0;
        h[4] = h2h + ch + (h2l >>> 0 < cl >>> 0 ? 1 : 0) | 0;
        h3l = h[7] = h3l + dl | 0;
        h[6] = h3h + dh + (h3l >>> 0 < dl >>> 0 ? 1 : 0) | 0;
        h4l = h[9] = h4l + el | 0;
        h[8] = h4h + eh + (h4l >>> 0 < el >>> 0 ? 1 : 0) | 0;
        h5l = h[11] = h5l + fl | 0;
        h[10] = h5h + fh + (h5l >>> 0 < fl >>> 0 ? 1 : 0) | 0;
        h6l = h[13] = h6l + gl | 0;
        h[12] = h6h + gh + (h6l >>> 0 < gl >>> 0 ? 1 : 0) | 0;
        h7l = h[15] = h7l + hl | 0;
        h[14] = h7h + hh + (h7l >>> 0 < hl >>> 0 ? 1 : 0) | 0;
    }
}
const SHA1_REGEX = /^\s*sha-?1\s*$/i;
const SHA256_REGEX = /^\s*sha-?256\s*$/i;
const SHA512_REGEX = /^\s*sha-?512\s*$/i;
class HMAC {
    constructor(hasher, key1){
        this.hashSize = hasher.hashSize;
        this.hasher = hasher;
        this.B = this.hashSize <= 32 ? 64 : 128;
        this.iPad = 54;
        this.oPad = 92;
        if (key1) {
            this.init(key1);
        }
    }
    init(key, inputEncoding) {
        if (!key) {
            key = new Uint8Array(0);
        } else if (typeof key === "string") {
            key = encode1(key, inputEncoding);
        }
        let _key = new Uint8Array(key);
        if (_key.length > this.B) {
            this.hasher.init();
            _key = this.hasher.update(key).digest();
        }
        if (_key.byteLength < this.B) {
            const tmp = new Uint8Array(this.B);
            tmp.set(_key, 0);
            _key = tmp;
        }
        this.iKeyPad = new Uint8Array(this.B);
        this.oKeyPad = new Uint8Array(this.B);
        for(let i2 = 0; i2 < this.B; ++i2){
            this.iKeyPad[i2] = this.iPad ^ _key[i2];
            this.oKeyPad[i2] = this.oPad ^ _key[i2];
        }
        _key.fill(0);
        this.hasher.init();
        this.hasher.update(this.iKeyPad);
        return this;
    }
    update(msg = new Uint8Array(0), inputEncoding) {
        if (typeof msg === "string") {
            msg = encode1(msg, inputEncoding);
        }
        this.hasher.update(msg);
        return this;
    }
    digest(outputEncoding) {
        const sum1 = this.hasher.digest();
        this.hasher.init();
        return this.hasher.update(this.oKeyPad).update(sum1).digest(outputEncoding);
    }
}
function hmac(hash, key2, msg, inputEncoding, outputEncoding) {
    if (SHA1_REGEX.test(hash)) {
        return new HMAC(new SHA1()).init(key2, inputEncoding).update(msg, inputEncoding).digest(outputEncoding);
    } else if (SHA256_REGEX.test(hash)) {
        return new HMAC(new SHA256()).init(key2, inputEncoding).update(msg, inputEncoding).digest(outputEncoding);
    } else if (SHA512_REGEX.test(hash)) {
        return new HMAC(new SHA512()).init(key2, inputEncoding).update(msg, inputEncoding).digest(outputEncoding);
    } else {
        throw new TypeError(`Unsupported hash ${hash}. Must be one of SHA(1|256|512).`);
    }
}
const lookup2 = [];
const revLookup2 = [];
const code2 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
for(let i2 = 0, l2 = code2.length; i2 < l2; ++i2){
    lookup2[i2] = code2[i2];
    revLookup2[code2.charCodeAt(i2)] = i2;
}
revLookup2["-".charCodeAt(0)] = 62;
revLookup2["_".charCodeAt(0)] = 63;
const mod1 = init(lookup2, revLookup2);
const toUint8Array2 = mod1.toUint8Array;
const fromUint8Array2 = mod1.fromUint8Array;
const ANY_BUT_DIGITS = /[^\d]/g;
const ANY_BUT_DIGITS_T = /[^\dT]/g;
function noop(..._) {
}
function camelCase(text) {
    return `${text[0].toLowerCase()}${text.slice(1)}`;
}
function property(obj, name, value, enumerable, isValue) {
    const opts = {
        configurable: true,
        enumerable: typeof enumerable === "boolean" ? enumerable : true
    };
    if (typeof value === "function" && !isValue) {
        opts.get = value;
    } else {
        opts.value = value;
        opts.writable = true;
    }
    Object.defineProperty(obj, name, opts);
}
function memoizedProperty(obj, name, get1, enumerable) {
    let cachedValue = null;
    property(obj, name, ()=>{
        if (cachedValue === null) {
            cachedValue = get1();
        }
        return cachedValue;
    }, enumerable);
}
function typeOf(data) {
    if (data === null && typeof data === "object") {
        return "null";
    } else if (data !== undefined && isBinary(data)) {
        return "Binary";
    } else if (data !== undefined && data.constructor) {
        return data.wrapperName || data.constructor.name;
    } else if (data !== undefined && typeof data === "object") {
        return "Object";
    } else {
        return "undefined";
    }
}
function isBinary(data) {
    const types = [
        "Buffer",
        "File",
        "Blob",
        "ArrayBuffer",
        "DataView",
        "Int8Array",
        "Uint8Array",
        "Uint8ClampedArray",
        "Int16Array",
        "Uint16Array",
        "Int32Array",
        "Uint32Array",
        "Float32Array",
        "Float64Array", 
    ];
    if (data !== undefined && data.constructor) {
        return types.some((type)=>data.constructor.name === type
        );
    }
    return false;
}
const memberTypeToSetType = {
    String: "String",
    Number: "Number",
    NumberValue: "Number",
    Binary: "Binary"
};
class DynamoDBSet {
    wrappername = "Set";
    values = [];
    type = "";
    constructor(list = [], options1 = {
    }){
        Array.prototype.push.apply(this.values, list);
        this.type = memberTypeToSetType[typeOf(this.values[0])];
        if (!this.type) {
            throw new Error("DynamoDB sets can only contain string, number, or binary values");
        }
        if (options1.validate) {
            for (const value of this.values){
                if (memberTypeToSetType[typeOf(value)] !== this.type) {
                    throw new Error(`${this.type} Set contains ${typeOf(value)} value`);
                }
            }
        }
    }
    toJSON() {
        return this.values;
    }
}
class DynamoDBNumberValue {
    wrapperName = "NumberValue";
    constructor(value1){
        this.value = value1.toString();
    }
    toJSON() {
        return this.toNumber();
    }
    toNumber() {
        return Number(this.value);
    }
    toString() {
        return this.value;
    }
}
const date1 = {
    DATE_STAMP_REGEX: /^\d{8}$/,
    amz (date) {
        return `${date.toISOString().slice(0, 19).replace(ANY_BUT_DIGITS_T, "")}Z`;
    },
    dateStamp (date) {
        return date.toISOString().slice(0, 10).replace(ANY_BUT_DIGITS, "");
    },
    from (date) {
        if (typeof date === "number") {
            return new Date(date * 1000);
        } else {
            return new Date(date);
        }
    },
    iso8601 (date = new Date()) {
        return date.toISOString().replace(/\.\d{3}Z$/, "Z");
    },
    rfc822 (date = new Date()) {
        return date.toUTCString();
    },
    unixTimestamp (date = new Date()) {
        return date.getTime() / 1000;
    },
    format (date, formatter = "iso8601") {
        return this[formatter](this.from(date));
    },
    parseTimestamp (value) {
        if (typeof value === "number") {
            return new Date(value * 1000);
        } else if (value.match(/^\d+$/)) {
            return new Date(Number(value) * 1000);
        } else if (value.match(/^\d{4}/)) {
            return new Date(value);
        } else if (value.match(/^\w{3},/)) {
            return new Date(value);
        } else {
            throw new Error(`unhandled timestamp format: ${value}`);
        }
    }
};
const AWS4 = encode("AWS4", "utf8");
function awsSignatureV4(key2, msg, outputEncoding) {
    return hmac("sha256", key2, msg, undefined, outputEncoding);
}
function kdf(key2, dateStamp, region, service, keyInputEncoding, outputEncoding) {
    if (typeof key2 === "string") {
        key2 = encode(key2, keyInputEncoding);
    }
    if (typeof dateStamp !== "string") {
        dateStamp = date1.format(dateStamp, "dateStamp");
    } else if (!date1.DATE_STAMP_REGEX.test(dateStamp)) {
        throw new TypeError("date stamp format must be yyyymmdd");
    }
    const paddedKey = new Uint8Array(4 + key2.byteLength);
    paddedKey.set(AWS4, 0);
    paddedKey.set(key2, 4);
    let mac = hmac("sha256", paddedKey, dateStamp, "utf8");
    mac = hmac("sha256", mac, region, "utf8");
    mac = hmac("sha256", mac, service, "utf8");
    mac = hmac("sha256", mac, "aws4_request", "utf8");
    return outputEncoding ? decode(mac, outputEncoding) : mac;
}
const ALGORITHM = "AWS4-HMAC-SHA256";
const CONTENT_TYPE = "application/x-amz-json-1.0";
async function createHeaders(op, payload, conf, refreshCredentials = !conf.cache.signingKey) {
    if (refreshCredentials) {
        await conf.cache.refresh();
    }
    const amzTarget = `DynamoDB_20120810.${op}`;
    const amzDate = date1.format(conf.date || new Date(), "amz");
    const canonicalUri = conf.canonicalUri || "/";
    const canonicalHeaders = `content-type:${CONTENT_TYPE}\nhost:${conf.host}\nx-amz-date:${amzDate}\nx-amz-target:${amzTarget}\n`;
    const signedHeaders = "content-type;host;x-amz-date;x-amz-target";
    const payloadHash = sha256(payload, undefined, "hex");
    const canonicalRequest = `${conf.method}\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    const canonicalRequestDigest = sha256(canonicalRequest, "utf8", "hex");
    const msg = encode(`${ALGORITHM}\n${amzDate}\n${conf.cache.credentialScope}\n${canonicalRequestDigest}`, "utf8");
    const signature = awsSignatureV4(conf.cache.signingKey, msg, "hex");
    const authorizationHeader = `${ALGORITHM} Credential=${conf.cache.accessKeyId}/${conf.cache.credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const headers = new Headers({
        "Content-Type": CONTENT_TYPE,
        "X-Amz-Date": amzDate,
        "X-Amz-Target": amzTarget,
        Authorization: authorizationHeader
    });
    if (conf.cache.sessionToken) {
        headers.append("X-Amz-Security-Token", conf.cache.sessionToken);
    }
    return headers;
}
async function baseFetch(conf, op, params) {
    const payload = encode(JSON.stringify(params), "utf8");
    let headers = await createHeaders(op, payload, conf);
    let response = await fetch(conf.endpoint, {
        method: conf.method,
        headers,
        body: payload
    });
    let body = await response.json();
    if (!response.ok) {
        if (response.status === 403) {
            headers = await createHeaders(op, payload, conf, true);
            response = await fetch(conf.endpoint, {
                method: conf.method,
                headers,
                body: payload
            });
            if (response.ok) {
                body = await response.json();
                return body;
            }
        }
        throw new Error(body.message);
    }
    return body;
}
function memoize(name, value2, factory) {
    memoizedProperty(this, name, function() {
        return factory(name, value2);
    });
}
function Collection(iterable, options1, factory, callback = noop) {
    for(const id in iterable){
        if (Object.prototype.hasOwnProperty.call(iterable, id)) {
            memoize.call(this, id, iterable[id], factory);
            if (callback) {
                callback(id, iterable[id]);
            }
        }
    }
}
function property1(obj, name, value2, enumerable, isValue) {
    if (value2 !== null && value2 !== undefined) {
        property.apply(this, arguments);
    }
}
function memoizedProperty1(obj, name, get1, enumerable) {
    if (!obj.constructor.prototype[name]) {
        memoizedProperty.apply(this, arguments);
    }
}
function Shape(shape, options1 = {
}, memberName) {
    property1(this, "shape", shape.shape);
    property1(this, "api", options1.api, false);
    property1(this, "type", shape.type);
    property1(this, "enum", shape.enum);
    property1(this, "min", shape.min);
    property1(this, "max", shape.max);
    property1(this, "pattern", shape.pattern);
    property1(this, "location", shape.location || this.location || "body");
    property1(this, "name", this.name || shape.xmlName || shape.queryName || shape.locationName || memberName);
    property1(this, "isStreaming", shape.streaming || this.isStreaming || false);
    property1(this, "requiresLength", shape.requiresLength, false);
    property1(this, "isComposite", shape.isComposite || false);
    property1(this, "isShape", true, false);
    property1(this, "isQueryName", Boolean(shape.queryName), false);
    property1(this, "isLocationName", Boolean(shape.locationName), false);
    property1(this, "isIdempotent", shape.idempotencyToken);
    property1(this, "isJsonValue", shape.jsonvalue);
    property1(this, "isSensitive", shape.sensitive || shape.prototype && shape.prototype.sensitive);
    property1(this, "isEventStream", Boolean(shape.eventstream), false);
    property1(this, "isEvent", Boolean(shape.event), false);
    property1(this, "isEventPayload", Boolean(shape.eventpayload), false);
    property1(this, "isEventHeader", Boolean(shape.eventheader), false);
    property1(this, "isTimestampFormatSet", Boolean(shape.timestampFormat) || shape.prototype && shape.prototype.isTimestampFormatSet, false);
    property1(this, "endpointDiscoveryId", Boolean(shape.endpointdiscoveryid), false);
    property1(this, "hostLabel", Boolean(shape.hostLabel), false);
    if (options1.documentation) {
        property1(this, "documentation", shape.documentation);
        property1(this, "documentationUrl", shape.documentationUrl);
    }
    if (shape.xmlAttribute) {
        property1(this, "isXmlAttribute", shape.xmlAttribute || false);
    }
    property1(this, "defaultValue", null);
    this.toWireFormat = function(value2) {
        if (value2 === null || value2 === undefined) {
            return "";
        }
        return value2;
    };
    this.toType = function(value2) {
        return value2;
    };
}
Shape.normalizedTypes = {
    character: "string",
    double: "float",
    long: "integer",
    short: "integer",
    biginteger: "integer",
    bigdecimal: "float",
    blob: "binary"
};
Shape.types = {
    structure: StructureShape,
    list: ListShape,
    map: MapShape,
    boolean: BooleanShape,
    timestamp: TimestampShape,
    float: FloatShape,
    integer: IntegerShape,
    string: StringShape,
    base64: Base64Shape,
    binary: BinaryShape
};
Shape.resolve = function resolve(shape, options1 = {
}) {
    if (shape.shape) {
        const refShape = options1.api.shapes[shape.shape];
        if (!refShape) {
            throw new Error(`Cannot find shape reference: ${shape.shape}`);
        }
        return refShape;
    } else {
        return null;
    }
};
Shape.create = function create(shape, options1 = {
}, memberName = "") {
    if (shape.isShape) {
        return shape;
    }
    const refShape = Shape.resolve(shape, options1);
    if (refShape) {
        let filteredKeys = Object.keys(shape);
        if (!options1.documentation) {
            filteredKeys = filteredKeys.filter(function(name) {
                return !name.match(/documentation/);
            });
        }
        const InlineShape = function() {
            refShape.constructor.call(this, shape, options1, memberName);
        };
        InlineShape.prototype = refShape;
        return new InlineShape();
    } else {
        if (!shape.type) {
            if (shape.members) {
                shape.type = "structure";
            } else if (shape.member) {
                shape.type = "list";
            } else if (shape.key) {
                shape.type = "map";
            } else {
                shape.type = "string";
            }
        }
        const origType = shape.type;
        if (Shape.normalizedTypes[shape.type]) {
            shape.type = Shape.normalizedTypes[shape.type];
        }
        if (Shape.types[shape.type]) {
            return new Shape.types[shape.type](shape, options1, memberName);
        } else {
            throw new Error("Unrecognized shape type: " + origType);
        }
    }
};
function CompositeShape(shape) {
    Shape.apply(this, arguments);
    property1(this, "isComposite", true);
    if (shape.flattened) {
        property1(this, "flattened", shape.flattened || false);
    }
}
function StructureShape(shape, options1 = {
}) {
    const self = this;
    const firstInit = !this.isShape;
    CompositeShape.apply(this, arguments);
    if (firstInit) {
        property1(this, "defaultValue", function() {
            return {
            };
        });
        property1(this, "members", {
        });
        property1(this, "memberNames", []);
        property1(this, "required", []);
        property1(this, "isRequired", function() {
            return false;
        });
    }
    if (shape.members) {
        property1(this, "members", new Collection(shape.members, options1, function(name, member) {
            return Shape.create(member, options1, name);
        }));
        memoizedProperty1(this, "memberNames", function() {
            return shape.xmlOrder || Object.keys(shape.members);
        });
        if (shape.event) {
            memoizedProperty1(this, "eventPayloadMemberName", function() {
                const members = self.members;
                const memberNames = self.memberNames;
                for(let i3 = 0, iLen = memberNames.length; i3 < iLen; i3++){
                    if (members[memberNames[i3]].isEventPayload) {
                        return memberNames[i3];
                    }
                }
                return "";
            });
            memoizedProperty1(this, "eventHeaderMemberNames", function() {
                const members = self.members;
                const memberNames = self.memberNames;
                const eventHeaderMemberNames = [];
                for(let i3 = 0, iLen = memberNames.length; i3 < iLen; i3++){
                    if (members[memberNames[i3]].isEventHeader) {
                        eventHeaderMemberNames.push(memberNames[i3]);
                    }
                }
                return eventHeaderMemberNames;
            });
        }
    }
    if (shape.required) {
        property1(this, "required", shape.required);
        const requiredMap = shape.required.reduce((acc, req)=>{
            acc[req] = true;
            return acc;
        }, {
        });
        property1(this, "isRequired", function(name) {
            return requiredMap[name];
        }, false, true);
    }
    property1(this, "resultWrapper", shape.resultWrapper || null);
    if (shape.payload) {
        property1(this, "payload", shape.payload);
    }
    if (typeof shape.xmlNamespace === "string") {
        property1(this, "xmlNamespaceUri", shape.xmlNamespace);
    } else if (typeof shape.xmlNamespace === "object") {
        property1(this, "xmlNamespacePrefix", shape.xmlNamespace.prefix);
        property1(this, "xmlNamespaceUri", shape.xmlNamespace.uri);
    }
}
function ListShape(shape, options1 = {
}) {
    const self = this;
    const firstInit = !this.isShape;
    CompositeShape.apply(this, arguments);
    if (firstInit) {
        property1(this, "defaultValue", function() {
            return [];
        });
    }
    if (shape.member) {
        memoizedProperty1(this, "member", function() {
            return Shape.create(shape.member, options1);
        });
    }
    if (this.flattened) {
        const oldName = this.name;
        memoizedProperty1(this, "name", function() {
            return self.member.name || oldName;
        });
    }
}
function MapShape(shape, options1 = {
}) {
    const firstInit = !this.isShape;
    CompositeShape.apply(this, arguments);
    if (firstInit) {
        property1(this, "defaultValue", function() {
            return {
            };
        });
        property1(this, "key", Shape.create({
            type: "string"
        }, options1));
        property1(this, "value", Shape.create({
            type: "string"
        }, options1));
    }
    if (shape.key) {
        memoizedProperty1(this, "key", function() {
            return Shape.create(shape.key, options1);
        });
    }
    if (shape.value) {
        memoizedProperty1(this, "value", function() {
            return Shape.create(shape.value, options1);
        });
    }
}
function TimestampShape(shape) {
    const self = this;
    Shape.apply(this, arguments);
    if (shape.timestampFormat) {
        property1(this, "timestampFormat", shape.timestampFormat);
    } else if (self.isTimestampFormatSet && this.timestampFormat) {
        property1(this, "timestampFormat", this.timestampFormat);
    } else if (this.location === "header") {
        property1(this, "timestampFormat", "rfc822");
    } else if (this.location === "querystring") {
        property1(this, "timestampFormat", "iso8601");
    } else if (this.api) {
        switch(this.api.protocol){
            case "json":
            case "rest-json":
                property1(this, "timestampFormat", "unixTimestamp");
                break;
            case "rest-xml":
            case "query":
            case "ec2":
                property1(this, "timestampFormat", "iso8601");
                break;
        }
    }
    this.toType = function(value2) {
        if (value2 === null || value2 === undefined) {
            return undefined;
        }
        if (typeof value2.toISOString === "function") {
            return value2;
        }
        if (typeof value2 === "string" || typeof value2 === "number") {
            return date1.parseTimestamp(value2);
        }
        return undefined;
    };
    this.toWireFormat = function(value2) {
        return date1.format(value2, self.timestampFormat);
    };
}
function StringShape() {
    Shape.apply(this, arguments);
    const nullLessProtocols = [
        "rest-xml",
        "query",
        "ec2"
    ];
    this.toType = function(value2) {
        value2 = this.api && nullLessProtocols.indexOf(this.api.protocol) > -1 ? value2 || "" : value2;
        if (this.isJsonValue) {
            return JSON.parse(value2);
        }
        return value2 && typeof value2.toString === "function" ? value2.toString() : value2;
    };
    this.toWireFormat = function(value2) {
        return this.isJsonValue ? JSON.stringify(value2) : value2;
    };
}
function FloatShape() {
    Shape.apply(this, arguments);
    this.toType = function(value2) {
        if (value2 === null || value2 === undefined) {
            return undefined;
        }
        return parseFloat(value2);
    };
    this.toWireFormat = this.toType;
}
function IntegerShape() {
    Shape.apply(this, arguments);
    this.toType = function(value2) {
        if (value2 === null || value2 === undefined) {
            return undefined;
        }
        return parseInt(value2, 10);
    };
    this.toWireFormat = this.toType;
}
function BinaryShape() {
    Shape.apply(this, arguments);
    this.toType = toUint8Array2;
    this.toWireFormat = fromUint8Array2;
}
function Base64Shape() {
    BinaryShape.apply(this, arguments);
}
function BooleanShape() {
    Shape.apply(this, arguments);
    this.toType = function(value2) {
        if (typeof value2 === "boolean") {
            return value2;
        }
        if (value2 === null || value2 === undefined) {
            return undefined;
        }
        return value2 === "true";
    };
}
Shape.shapes = {
    StructureShape: StructureShape,
    ListShape: ListShape,
    MapShape: MapShape,
    StringShape: StringShape,
    BooleanShape: BooleanShape,
    Base64Shape: Base64Shape
};
function Operation(name, operation, options1 = {
}) {
    const self = this;
    property(this, "name", operation.name || name);
    property(this, "api", options1.api, false);
    operation.http = operation.http || {
    };
    property(this, "endpoint", operation.endpoint);
    property(this, "httpMethod", operation.http.method || "POST");
    property(this, "httpPath", operation.http.requestUri || "/");
    property(this, "authtype", operation.authtype || "");
    property(this, "endpointDiscoveryRequired", operation.endpointdiscovery ? operation.endpointdiscovery.required ? "REQUIRED" : "OPTIONAL" : "NULL");
    memoizedProperty(this, "input", function() {
        if (!operation.input) {
            return Shape.create({
                type: "structure"
            }, options1);
        }
        return Shape.create(operation.input, options1);
    });
    memoizedProperty(this, "output", function() {
        if (!operation.output) {
            return Shape.create({
                type: "structure"
            }, options1);
        }
        return Shape.create(operation.output, options1);
    });
    memoizedProperty(this, "errors", function() {
        if (!operation.errors) {
            return [];
        }
        return operation.errors.map((error)=>Shape.create(error, options1)
        );
    });
    memoizedProperty(this, "paginator", function() {
        return options1.api.paginators[name];
    });
    if (options1.documentation) {
        property(this, "documentation", operation.documentation);
        property(this, "documentationUrl", operation.documentationUrl);
    }
    memoizedProperty(this, "idempotentMembers", function() {
        if (!self.input.members) {
            return [];
        }
        return Object.entries(self.input.members).filter(([_, value2])=>value2.isIdempotent
        ).map(([key2, _])=>key2
        );
    });
    memoizedProperty(this, "hasEventOutput", function() {
        return hasEventStream(self.output);
    });
}
function hasEventStream(topLevelShape) {
    const members = topLevelShape.members;
    const payload = topLevelShape.payload;
    if (!topLevelShape.members) {
        return false;
    }
    if (payload) {
        const payloadMember = members[payload];
        return payloadMember.isEventStream;
    }
    for(const name in members){
        if (!members.hasOwnProperty(name) && members[name].isEventStream) {
            return true;
        }
    }
    return false;
}
function Api(api = {
}, options1 = {
}) {
    const self = this;
    options1.api = this;
    api.metadata = api.metadata || {
    };
    property(this, "isApi", true, false);
    property(this, "apiVersion", api.metadata.apiVersion);
    property(this, "endpointPrefix", api.metadata.endpointPrefix);
    property(this, "signingName", api.metadata.signingName);
    property(this, "globalEndpoint", api.metadata.globalEndpoint);
    property(this, "signatureVersion", api.metadata.signatureVersion);
    property(this, "jsonVersion", api.metadata.jsonVersion);
    property(this, "targetPrefix", api.metadata.targetPrefix);
    property(this, "protocol", api.metadata.protocol);
    property(this, "timestampFormat", api.metadata.timestampFormat);
    property(this, "xmlNamespaceUri", api.metadata.xmlNamespace);
    property(this, "abbreviation", api.metadata.serviceAbbreviation);
    property(this, "fullName", api.metadata.serviceFullName);
    property(this, "serviceId", api.metadata.serviceId);
    memoizedProperty(this, "className", function() {
        let name = api.metadata.serviceAbbreviation || api.metadata.serviceFullName;
        if (!name) {
            return "";
        }
        name = name.replace(/^Amazon|AWS\s*|\(.*|\s+|\W+/g, "");
        if (name === "ElasticLoadBalancing") {
            name = "ELB";
        }
        return name;
    });
    function addEndpointOperation(name, operation) {
        if (operation.endpointoperation) {
            property(self, "endpointOperation", name);
        }
    }
    property(this, "operations", new Collection(api.operations, options1, function(name, operation) {
        return new Operation(name, operation, options1);
    }, addEndpointOperation));
    property(this, "shapes", new Collection(api.shapes, options1, function(name, shape) {
        return Shape.create(shape, options1);
    }));
    if (options1.documentation) {
        property(this, "documentation", api.documentation);
        property(this, "documentationUrl", api.documentationUrl);
    }
}
const API = new Api(JSON.parse(`\n{\n  "version": "2.0",\n  "metadata": {\n    "apiVersion": "2012-08-10",\n    "endpointPrefix": "dynamodb",\n    "jsonVersion": "1.0",\n    "protocol": "json",\n    "serviceAbbreviation": "DynamoDB",\n    "serviceFullName": "Amazon DynamoDB",\n    "serviceId": "DynamoDB",\n    "signatureVersion": "v4",\n    "targetPrefix": "DynamoDB_20120810",\n    "uid": "dynamodb-2012-08-10"\n  },\n  "operations": {\n    "BatchGetItem": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "RequestItems"\n        ],\n        "members": {\n          "RequestItems": {\n            "shape": "S2"\n          },\n          "ReturnConsumedCapacity": {}\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "Responses": {\n            "type": "map",\n            "key": {},\n            "value": {\n              "shape": "Sr"\n            }\n          },\n          "UnprocessedKeys": {\n            "shape": "S2"\n          },\n          "ConsumedCapacity": {\n            "shape": "St"\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "BatchWriteItem": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "RequestItems"\n        ],\n        "members": {\n          "RequestItems": {\n            "shape": "S10"\n          },\n          "ReturnConsumedCapacity": {},\n          "ReturnItemCollectionMetrics": {}\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "UnprocessedItems": {\n            "shape": "S10"\n          },\n          "ItemCollectionMetrics": {\n            "shape": "S18"\n          },\n          "ConsumedCapacity": {\n            "shape": "St"\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "CreateBackup": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "TableName",\n          "BackupName"\n        ],\n        "members": {\n          "TableName": {},\n          "BackupName": {}\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "BackupDetails": {\n            "shape": "S1h"\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "CreateGlobalTable": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "GlobalTableName",\n          "ReplicationGroup"\n        ],\n        "members": {\n          "GlobalTableName": {},\n          "ReplicationGroup": {\n            "shape": "S1p"\n          }\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "GlobalTableDescription": {\n            "shape": "S1t"\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "CreateTable": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "AttributeDefinitions",\n          "TableName",\n          "KeySchema"\n        ],\n        "members": {\n          "AttributeDefinitions": {\n            "shape": "S1z"\n          },\n          "TableName": {},\n          "KeySchema": {\n            "shape": "S23"\n          },\n          "LocalSecondaryIndexes": {\n            "type": "list",\n            "member": {\n              "type": "structure",\n              "required": [\n                "IndexName",\n                "KeySchema",\n                "Projection"\n              ],\n              "members": {\n                "IndexName": {},\n                "KeySchema": {\n                  "shape": "S23"\n                },\n                "Projection": {\n                  "shape": "S28"\n                }\n              }\n            }\n          },\n          "GlobalSecondaryIndexes": {\n            "type": "list",\n            "member": {\n              "type": "structure",\n              "required": [\n                "IndexName",\n                "KeySchema",\n                "Projection"\n              ],\n              "members": {\n                "IndexName": {},\n                "KeySchema": {\n                  "shape": "S23"\n                },\n                "Projection": {\n                  "shape": "S28"\n                },\n                "ProvisionedThroughput": {\n                  "shape": "S2e"\n                }\n              }\n            }\n          },\n          "BillingMode": {},\n          "ProvisionedThroughput": {\n            "shape": "S2e"\n          },\n          "StreamSpecification": {\n            "shape": "S2h"\n          },\n          "SSESpecification": {\n            "shape": "S2k"\n          },\n          "Tags": {\n            "shape": "S2o"\n          }\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "TableDescription": {\n            "shape": "S2t"\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "DeleteBackup": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "BackupArn"\n        ],\n        "members": {\n          "BackupArn": {}\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "BackupDescription": {\n            "shape": "S3g"\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "DeleteItem": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "TableName",\n          "Key"\n        ],\n        "members": {\n          "TableName": {},\n          "Key": {\n            "shape": "S6"\n          },\n          "Expected": {\n            "shape": "S3t"\n          },\n          "ConditionalOperator": {},\n          "ReturnValues": {},\n          "ReturnConsumedCapacity": {},\n          "ReturnItemCollectionMetrics": {},\n          "ConditionExpression": {},\n          "ExpressionAttributeNames": {\n            "shape": "Sm"\n          },\n          "ExpressionAttributeValues": {\n            "shape": "S41"\n          }\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "Attributes": {\n            "shape": "Ss"\n          },\n          "ConsumedCapacity": {\n            "shape": "Su"\n          },\n          "ItemCollectionMetrics": {\n            "shape": "S1a"\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "DeleteTable": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "TableName"\n        ],\n        "members": {\n          "TableName": {}\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "TableDescription": {\n            "shape": "S2t"\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "DescribeBackup": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "BackupArn"\n        ],\n        "members": {\n          "BackupArn": {}\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "BackupDescription": {\n            "shape": "S3g"\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "DescribeContinuousBackups": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "TableName"\n        ],\n        "members": {\n          "TableName": {}\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "ContinuousBackupsDescription": {\n            "shape": "S4a"\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "DescribeEndpoints": {\n      "input": {\n        "type": "structure",\n        "members": {}\n      },\n      "output": {\n        "type": "structure",\n        "required": [\n          "Endpoints"\n        ],\n        "members": {\n          "Endpoints": {\n            "type": "list",\n            "member": {\n              "type": "structure",\n              "required": [\n                "Address",\n                "CachePeriodInMinutes"\n              ],\n              "members": {\n                "Address": {},\n                "CachePeriodInMinutes": {\n                  "type": "long"\n                }\n              }\n            }\n          }\n        }\n      },\n      "endpointoperation": true\n    },\n    "DescribeGlobalTable": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "GlobalTableName"\n        ],\n        "members": {\n          "GlobalTableName": {}\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "GlobalTableDescription": {\n            "shape": "S1t"\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "DescribeGlobalTableSettings": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "GlobalTableName"\n        ],\n        "members": {\n          "GlobalTableName": {}\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "GlobalTableName": {},\n          "ReplicaSettings": {\n            "shape": "S4m"\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "DescribeLimits": {\n      "input": {\n        "type": "structure",\n        "members": {}\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "AccountMaxReadCapacityUnits": {\n            "type": "long"\n          },\n          "AccountMaxWriteCapacityUnits": {\n            "type": "long"\n          },\n          "TableMaxReadCapacityUnits": {\n            "type": "long"\n          },\n          "TableMaxWriteCapacityUnits": {\n            "type": "long"\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "DescribeTable": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "TableName"\n        ],\n        "members": {\n          "TableName": {}\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "Table": {\n            "shape": "S2t"\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "DescribeTimeToLive": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "TableName"\n        ],\n        "members": {\n          "TableName": {}\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "TimeToLiveDescription": {\n            "shape": "S3p"\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "GetItem": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "TableName",\n          "Key"\n        ],\n        "members": {\n          "TableName": {},\n          "Key": {\n            "shape": "S6"\n          },\n          "AttributesToGet": {\n            "shape": "Sj"\n          },\n          "ConsistentRead": {\n            "type": "boolean"\n          },\n          "ReturnConsumedCapacity": {},\n          "ProjectionExpression": {},\n          "ExpressionAttributeNames": {\n            "shape": "Sm"\n          }\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "Item": {\n            "shape": "Ss"\n          },\n          "ConsumedCapacity": {\n            "shape": "Su"\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "ListBackups": {\n      "input": {\n        "type": "structure",\n        "members": {\n          "TableName": {},\n          "Limit": {\n            "type": "integer"\n          },\n          "TimeRangeLowerBound": {\n            "type": "timestamp"\n          },\n          "TimeRangeUpperBound": {\n            "type": "timestamp"\n          },\n          "ExclusiveStartBackupArn": {},\n          "BackupType": {}\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "BackupSummaries": {\n            "type": "list",\n            "member": {\n              "type": "structure",\n              "members": {\n                "TableName": {},\n                "TableId": {},\n                "TableArn": {},\n                "BackupArn": {},\n                "BackupName": {},\n                "BackupCreationDateTime": {\n                  "type": "timestamp"\n                },\n                "BackupExpiryDateTime": {\n                  "type": "timestamp"\n                },\n                "BackupStatus": {},\n                "BackupType": {},\n                "BackupSizeBytes": {\n                  "type": "long"\n                }\n              }\n            }\n          },\n          "LastEvaluatedBackupArn": {}\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "ListGlobalTables": {\n      "input": {\n        "type": "structure",\n        "members": {\n          "ExclusiveStartGlobalTableName": {},\n          "Limit": {\n            "type": "integer"\n          },\n          "RegionName": {}\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "GlobalTables": {\n            "type": "list",\n            "member": {\n              "type": "structure",\n              "members": {\n                "GlobalTableName": {},\n                "ReplicationGroup": {\n                  "shape": "S1p"\n                }\n              }\n            }\n          },\n          "LastEvaluatedGlobalTableName": {}\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "ListTables": {\n      "input": {\n        "type": "structure",\n        "members": {\n          "ExclusiveStartTableName": {},\n          "Limit": {\n            "type": "integer"\n          }\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "TableNames": {\n            "type": "list",\n            "member": {}\n          },\n          "LastEvaluatedTableName": {}\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "ListTagsOfResource": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "ResourceArn"\n        ],\n        "members": {\n          "ResourceArn": {},\n          "NextToken": {}\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "Tags": {\n            "shape": "S2o"\n          },\n          "NextToken": {}\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "PutItem": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "TableName",\n          "Item"\n        ],\n        "members": {\n          "TableName": {},\n          "Item": {\n            "shape": "S14"\n          },\n          "Expected": {\n            "shape": "S3t"\n          },\n          "ReturnValues": {},\n          "ReturnConsumedCapacity": {},\n          "ReturnItemCollectionMetrics": {},\n          "ConditionalOperator": {},\n          "ConditionExpression": {},\n          "ExpressionAttributeNames": {\n            "shape": "Sm"\n          },\n          "ExpressionAttributeValues": {\n            "shape": "S41"\n          }\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "Attributes": {\n            "shape": "Ss"\n          },\n          "ConsumedCapacity": {\n            "shape": "Su"\n          },\n          "ItemCollectionMetrics": {\n            "shape": "S1a"\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "Query": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "TableName"\n        ],\n        "members": {\n          "TableName": {},\n          "IndexName": {},\n          "Select": {},\n          "AttributesToGet": {\n            "shape": "Sj"\n          },\n          "Limit": {\n            "type": "integer"\n          },\n          "ConsistentRead": {\n            "type": "boolean"\n          },\n          "KeyConditions": {\n            "type": "map",\n            "key": {},\n            "value": {\n              "shape": "S5w"\n            }\n          },\n          "QueryFilter": {\n            "shape": "S5x"\n          },\n          "ConditionalOperator": {},\n          "ScanIndexForward": {\n            "type": "boolean"\n          },\n          "ExclusiveStartKey": {\n            "shape": "S6"\n          },\n          "ReturnConsumedCapacity": {},\n          "ProjectionExpression": {},\n          "FilterExpression": {},\n          "KeyConditionExpression": {},\n          "ExpressionAttributeNames": {\n            "shape": "Sm"\n          },\n          "ExpressionAttributeValues": {\n            "shape": "S41"\n          }\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "Items": {\n            "shape": "Sr"\n          },\n          "Count": {\n            "type": "integer"\n          },\n          "ScannedCount": {\n            "type": "integer"\n          },\n          "LastEvaluatedKey": {\n            "shape": "S6"\n          },\n          "ConsumedCapacity": {\n            "shape": "Su"\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "RestoreTableFromBackup": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "TargetTableName",\n          "BackupArn"\n        ],\n        "members": {\n          "TargetTableName": {},\n          "BackupArn": {}\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "TableDescription": {\n            "shape": "S2t"\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "RestoreTableToPointInTime": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "SourceTableName",\n          "TargetTableName"\n        ],\n        "members": {\n          "SourceTableName": {},\n          "TargetTableName": {},\n          "UseLatestRestorableTime": {\n            "type": "boolean"\n          },\n          "RestoreDateTime": {\n            "type": "timestamp"\n          }\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "TableDescription": {\n            "shape": "S2t"\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "Scan": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "TableName"\n        ],\n        "members": {\n          "TableName": {},\n          "IndexName": {},\n          "AttributesToGet": {\n            "shape": "Sj"\n          },\n          "Limit": {\n            "type": "integer"\n          },\n          "Select": {},\n          "ScanFilter": {\n            "shape": "S5x"\n          },\n          "ConditionalOperator": {},\n          "ExclusiveStartKey": {\n            "shape": "S6"\n          },\n          "ReturnConsumedCapacity": {},\n          "TotalSegments": {\n            "type": "integer"\n          },\n          "Segment": {\n            "type": "integer"\n          },\n          "ProjectionExpression": {},\n          "FilterExpression": {},\n          "ExpressionAttributeNames": {\n            "shape": "Sm"\n          },\n          "ExpressionAttributeValues": {\n            "shape": "S41"\n          },\n          "ConsistentRead": {\n            "type": "boolean"\n          }\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "Items": {\n            "shape": "Sr"\n          },\n          "Count": {\n            "type": "integer"\n          },\n          "ScannedCount": {\n            "type": "integer"\n          },\n          "LastEvaluatedKey": {\n            "shape": "S6"\n          },\n          "ConsumedCapacity": {\n            "shape": "Su"\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "TagResource": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "ResourceArn",\n          "Tags"\n        ],\n        "members": {\n          "ResourceArn": {},\n          "Tags": {\n            "shape": "S2o"\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "TransactGetItems": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "TransactItems"\n        ],\n        "members": {\n          "TransactItems": {\n            "type": "list",\n            "member": {\n              "type": "structure",\n              "required": [\n                "Get"\n              ],\n              "members": {\n                "Get": {\n                  "type": "structure",\n                  "required": [\n                    "Key",\n                    "TableName"\n                  ],\n                  "members": {\n                    "Key": {\n                      "shape": "S6"\n                    },\n                    "TableName": {},\n                    "ProjectionExpression": {},\n                    "ExpressionAttributeNames": {\n                      "shape": "Sm"\n                    }\n                  }\n                }\n              }\n            }\n          },\n          "ReturnConsumedCapacity": {}\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "ConsumedCapacity": {\n            "shape": "St"\n          },\n          "Responses": {\n            "type": "list",\n            "member": {\n              "type": "structure",\n              "members": {\n                "Item": {\n                  "shape": "Ss"\n                }\n              }\n            }\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "TransactWriteItems": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "TransactItems"\n        ],\n        "members": {\n          "TransactItems": {\n            "type": "list",\n            "member": {\n              "type": "structure",\n              "members": {\n                "ConditionCheck": {\n                  "type": "structure",\n                  "required": [\n                    "Key",\n                    "TableName",\n                    "ConditionExpression"\n                  ],\n                  "members": {\n                    "Key": {\n                      "shape": "S6"\n                    },\n                    "TableName": {},\n                    "ConditionExpression": {},\n                    "ExpressionAttributeNames": {\n                      "shape": "Sm"\n                    },\n                    "ExpressionAttributeValues": {\n                      "shape": "S41"\n                    },\n                    "ReturnValuesOnConditionCheckFailure": {}\n                  }\n                },\n                "Put": {\n                  "type": "structure",\n                  "required": [\n                    "Item",\n                    "TableName"\n                  ],\n                  "members": {\n                    "Item": {\n                      "shape": "S14"\n                    },\n                    "TableName": {},\n                    "ConditionExpression": {},\n                    "ExpressionAttributeNames": {\n                      "shape": "Sm"\n                    },\n                    "ExpressionAttributeValues": {\n                      "shape": "S41"\n                    },\n                    "ReturnValuesOnConditionCheckFailure": {}\n                  }\n                },\n                "Delete": {\n                  "type": "structure",\n                  "required": [\n                    "Key",\n                    "TableName"\n                  ],\n                  "members": {\n                    "Key": {\n                      "shape": "S6"\n                    },\n                    "TableName": {},\n                    "ConditionExpression": {},\n                    "ExpressionAttributeNames": {\n                      "shape": "Sm"\n                    },\n                    "ExpressionAttributeValues": {\n                      "shape": "S41"\n                    },\n                    "ReturnValuesOnConditionCheckFailure": {}\n                  }\n                },\n                "Update": {\n                  "type": "structure",\n                  "required": [\n                    "Key",\n                    "UpdateExpression",\n                    "TableName"\n                  ],\n                  "members": {\n                    "Key": {\n                      "shape": "S6"\n                    },\n                    "UpdateExpression": {},\n                    "TableName": {},\n                    "ConditionExpression": {},\n                    "ExpressionAttributeNames": {\n                      "shape": "Sm"\n                    },\n                    "ExpressionAttributeValues": {\n                      "shape": "S41"\n                    },\n                    "ReturnValuesOnConditionCheckFailure": {}\n                  }\n                }\n              }\n            }\n          },\n          "ReturnConsumedCapacity": {},\n          "ReturnItemCollectionMetrics": {},\n          "ClientRequestToken": {\n            "idempotencyToken": true\n          }\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "ConsumedCapacity": {\n            "shape": "St"\n          },\n          "ItemCollectionMetrics": {\n            "shape": "S18"\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "UntagResource": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "ResourceArn",\n          "TagKeys"\n        ],\n        "members": {\n          "ResourceArn": {},\n          "TagKeys": {\n            "type": "list",\n            "member": {}\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "UpdateContinuousBackups": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "TableName",\n          "PointInTimeRecoverySpecification"\n        ],\n        "members": {\n          "TableName": {},\n          "PointInTimeRecoverySpecification": {\n            "type": "structure",\n            "required": [\n              "PointInTimeRecoveryEnabled"\n            ],\n            "members": {\n              "PointInTimeRecoveryEnabled": {\n                "type": "boolean"\n              }\n            }\n          }\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "ContinuousBackupsDescription": {\n            "shape": "S4a"\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "UpdateGlobalTable": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "GlobalTableName",\n          "ReplicaUpdates"\n        ],\n        "members": {\n          "GlobalTableName": {},\n          "ReplicaUpdates": {\n            "type": "list",\n            "member": {\n              "type": "structure",\n              "members": {\n                "Create": {\n                  "type": "structure",\n                  "required": [\n                    "RegionName"\n                  ],\n                  "members": {\n                    "RegionName": {}\n                  }\n                },\n                "Delete": {\n                  "type": "structure",\n                  "required": [\n                    "RegionName"\n                  ],\n                  "members": {\n                    "RegionName": {}\n                  }\n                }\n              }\n            }\n          }\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "GlobalTableDescription": {\n            "shape": "S1t"\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "UpdateGlobalTableSettings": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "GlobalTableName"\n        ],\n        "members": {\n          "GlobalTableName": {},\n          "GlobalTableBillingMode": {},\n          "GlobalTableProvisionedWriteCapacityUnits": {\n            "type": "long"\n          },\n          "GlobalTableProvisionedWriteCapacityAutoScalingSettingsUpdate": {\n            "shape": "S74"\n          },\n          "GlobalTableGlobalSecondaryIndexSettingsUpdate": {\n            "type": "list",\n            "member": {\n              "type": "structure",\n              "required": [\n                "IndexName"\n              ],\n              "members": {\n                "IndexName": {},\n                "ProvisionedWriteCapacityUnits": {\n                  "type": "long"\n                },\n                "ProvisionedWriteCapacityAutoScalingSettingsUpdate": {\n                  "shape": "S74"\n                }\n              }\n            }\n          },\n          "ReplicaSettingsUpdate": {\n            "type": "list",\n            "member": {\n              "type": "structure",\n              "required": [\n                "RegionName"\n              ],\n              "members": {\n                "RegionName": {},\n                "ReplicaProvisionedReadCapacityUnits": {\n                  "type": "long"\n                },\n                "ReplicaProvisionedReadCapacityAutoScalingSettingsUpdate": {\n                  "shape": "S74"\n                },\n                "ReplicaGlobalSecondaryIndexSettingsUpdate": {\n                  "type": "list",\n                  "member": {\n                    "type": "structure",\n                    "required": [\n                      "IndexName"\n                    ],\n                    "members": {\n                      "IndexName": {},\n                      "ProvisionedReadCapacityUnits": {\n                        "type": "long"\n                      },\n                      "ProvisionedReadCapacityAutoScalingSettingsUpdate": {\n                        "shape": "S74"\n                      }\n                    }\n                  }\n                }\n              }\n            }\n          }\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "GlobalTableName": {},\n          "ReplicaSettings": {\n            "shape": "S4m"\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "UpdateItem": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "TableName",\n          "Key"\n        ],\n        "members": {\n          "TableName": {},\n          "Key": {\n            "shape": "S6"\n          },\n          "AttributeUpdates": {\n            "type": "map",\n            "key": {},\n            "value": {\n              "type": "structure",\n              "members": {\n                "Value": {\n                  "shape": "S8"\n                },\n                "Action": {}\n              }\n            }\n          },\n          "Expected": {\n            "shape": "S3t"\n          },\n          "ConditionalOperator": {},\n          "ReturnValues": {},\n          "ReturnConsumedCapacity": {},\n          "ReturnItemCollectionMetrics": {},\n          "UpdateExpression": {},\n          "ConditionExpression": {},\n          "ExpressionAttributeNames": {\n            "shape": "Sm"\n          },\n          "ExpressionAttributeValues": {\n            "shape": "S41"\n          }\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "Attributes": {\n            "shape": "Ss"\n          },\n          "ConsumedCapacity": {\n            "shape": "Su"\n          },\n          "ItemCollectionMetrics": {\n            "shape": "S1a"\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "UpdateTable": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "TableName"\n        ],\n        "members": {\n          "AttributeDefinitions": {\n            "shape": "S1z"\n          },\n          "TableName": {},\n          "BillingMode": {},\n          "ProvisionedThroughput": {\n            "shape": "S2e"\n          },\n          "GlobalSecondaryIndexUpdates": {\n            "type": "list",\n            "member": {\n              "type": "structure",\n              "members": {\n                "Update": {\n                  "type": "structure",\n                  "required": [\n                    "IndexName",\n                    "ProvisionedThroughput"\n                  ],\n                  "members": {\n                    "IndexName": {},\n                    "ProvisionedThroughput": {\n                      "shape": "S2e"\n                    }\n                  }\n                },\n                "Create": {\n                  "type": "structure",\n                  "required": [\n                    "IndexName",\n                    "KeySchema",\n                    "Projection"\n                  ],\n                  "members": {\n                    "IndexName": {},\n                    "KeySchema": {\n                      "shape": "S23"\n                    },\n                    "Projection": {\n                      "shape": "S28"\n                    },\n                    "ProvisionedThroughput": {\n                      "shape": "S2e"\n                    }\n                  }\n                },\n                "Delete": {\n                  "type": "structure",\n                  "required": [\n                    "IndexName"\n                  ],\n                  "members": {\n                    "IndexName": {}\n                  }\n                }\n              }\n            }\n          },\n          "StreamSpecification": {\n            "shape": "S2h"\n          },\n          "SSESpecification": {\n            "shape": "S2k"\n          }\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "TableDescription": {\n            "shape": "S2t"\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    },\n    "UpdateTimeToLive": {\n      "input": {\n        "type": "structure",\n        "required": [\n          "TableName",\n          "TimeToLiveSpecification"\n        ],\n        "members": {\n          "TableName": {},\n          "TimeToLiveSpecification": {\n            "shape": "S7s"\n          }\n        }\n      },\n      "output": {\n        "type": "structure",\n        "members": {\n          "TimeToLiveSpecification": {\n            "shape": "S7s"\n          }\n        }\n      },\n      "endpointdiscovery": {}\n    }\n  },\n  "shapes": {\n    "S2": {\n      "type": "map",\n      "key": {},\n      "value": {\n        "type": "structure",\n        "required": [\n          "Keys"\n        ],\n        "members": {\n          "Keys": {\n            "type": "list",\n            "member": {\n              "shape": "S6"\n            }\n          },\n          "AttributesToGet": {\n            "shape": "Sj"\n          },\n          "ConsistentRead": {\n            "type": "boolean"\n          },\n          "ProjectionExpression": {},\n          "ExpressionAttributeNames": {\n            "shape": "Sm"\n          }\n        }\n      }\n    },\n    "S6": {\n      "type": "map",\n      "key": {},\n      "value": {\n        "shape": "S8"\n      }\n    },\n    "S8": {\n      "type": "structure",\n      "members": {\n        "S": {},\n        "N": {},\n        "B": {\n          "type": "blob"\n        },\n        "SS": {\n          "type": "list",\n          "member": {}\n        },\n        "NS": {\n          "type": "list",\n          "member": {}\n        },\n        "BS": {\n          "type": "list",\n          "member": {\n            "type": "blob"\n          }\n        },\n        "M": {\n          "type": "map",\n          "key": {},\n          "value": {\n            "shape": "S8"\n          }\n        },\n        "L": {\n          "type": "list",\n          "member": {\n            "shape": "S8"\n          }\n        },\n        "NULL": {\n          "type": "boolean"\n        },\n        "BOOL": {\n          "type": "boolean"\n        }\n      }\n    },\n    "Sj": {\n      "type": "list",\n      "member": {}\n    },\n    "Sm": {\n      "type": "map",\n      "key": {},\n      "value": {}\n    },\n    "Sr": {\n      "type": "list",\n      "member": {\n        "shape": "Ss"\n      }\n    },\n    "Ss": {\n      "type": "map",\n      "key": {},\n      "value": {\n        "shape": "S8"\n      }\n    },\n    "St": {\n      "type": "list",\n      "member": {\n        "shape": "Su"\n      }\n    },\n    "Su": {\n      "type": "structure",\n      "members": {\n        "TableName": {},\n        "CapacityUnits": {\n          "type": "double"\n        },\n        "ReadCapacityUnits": {\n          "type": "double"\n        },\n        "WriteCapacityUnits": {\n          "type": "double"\n        },\n        "Table": {\n          "shape": "Sw"\n        },\n        "LocalSecondaryIndexes": {\n          "shape": "Sx"\n        },\n        "GlobalSecondaryIndexes": {\n          "shape": "Sx"\n        }\n      }\n    },\n    "Sw": {\n      "type": "structure",\n      "members": {\n        "ReadCapacityUnits": {\n          "type": "double"\n        },\n        "WriteCapacityUnits": {\n          "type": "double"\n        },\n        "CapacityUnits": {\n          "type": "double"\n        }\n      }\n    },\n    "Sx": {\n      "type": "map",\n      "key": {},\n      "value": {\n        "shape": "Sw"\n      }\n    },\n    "S10": {\n      "type": "map",\n      "key": {},\n      "value": {\n        "type": "list",\n        "member": {\n          "type": "structure",\n          "members": {\n            "PutRequest": {\n              "type": "structure",\n              "required": [\n                "Item"\n              ],\n              "members": {\n                "Item": {\n                  "shape": "S14"\n                }\n              }\n            },\n            "DeleteRequest": {\n              "type": "structure",\n              "required": [\n                "Key"\n              ],\n              "members": {\n                "Key": {\n                  "shape": "S6"\n                }\n              }\n            }\n          }\n        }\n      }\n    },\n    "S14": {\n      "type": "map",\n      "key": {},\n      "value": {\n        "shape": "S8"\n      }\n    },\n    "S18": {\n      "type": "map",\n      "key": {},\n      "value": {\n        "type": "list",\n        "member": {\n          "shape": "S1a"\n        }\n      }\n    },\n    "S1a": {\n      "type": "structure",\n      "members": {\n        "ItemCollectionKey": {\n          "type": "map",\n          "key": {},\n          "value": {\n            "shape": "S8"\n          }\n        },\n        "SizeEstimateRangeGB": {\n          "type": "list",\n          "member": {\n            "type": "double"\n          }\n        }\n      }\n    },\n    "S1h": {\n      "type": "structure",\n      "required": [\n        "BackupArn",\n        "BackupName",\n        "BackupStatus",\n        "BackupType",\n        "BackupCreationDateTime"\n      ],\n      "members": {\n        "BackupArn": {},\n        "BackupName": {},\n        "BackupSizeBytes": {\n          "type": "long"\n        },\n        "BackupStatus": {},\n        "BackupType": {},\n        "BackupCreationDateTime": {\n          "type": "timestamp"\n        },\n        "BackupExpiryDateTime": {\n          "type": "timestamp"\n        }\n      }\n    },\n    "S1p": {\n      "type": "list",\n      "member": {\n        "type": "structure",\n        "members": {\n          "RegionName": {}\n        }\n      }\n    },\n    "S1t": {\n      "type": "structure",\n      "members": {\n        "ReplicationGroup": {\n          "type": "list",\n          "member": {\n            "type": "structure",\n            "members": {\n              "RegionName": {}\n            }\n          }\n        },\n        "GlobalTableArn": {},\n        "CreationDateTime": {\n          "type": "timestamp"\n        },\n        "GlobalTableStatus": {},\n        "GlobalTableName": {}\n      }\n    },\n    "S1z": {\n      "type": "list",\n      "member": {\n        "type": "structure",\n        "required": [\n          "AttributeName",\n          "AttributeType"\n        ],\n        "members": {\n          "AttributeName": {},\n          "AttributeType": {}\n        }\n      }\n    },\n    "S23": {\n      "type": "list",\n      "member": {\n        "type": "structure",\n        "required": [\n          "AttributeName",\n          "KeyType"\n        ],\n        "members": {\n          "AttributeName": {},\n          "KeyType": {}\n        }\n      }\n    },\n    "S28": {\n      "type": "structure",\n      "members": {\n        "ProjectionType": {},\n        "NonKeyAttributes": {\n          "type": "list",\n          "member": {}\n        }\n      }\n    },\n    "S2e": {\n      "type": "structure",\n      "required": [\n        "ReadCapacityUnits",\n        "WriteCapacityUnits"\n      ],\n      "members": {\n        "ReadCapacityUnits": {\n          "type": "long"\n        },\n        "WriteCapacityUnits": {\n          "type": "long"\n        }\n      }\n    },\n    "S2h": {\n      "type": "structure",\n      "members": {\n        "StreamEnabled": {\n          "type": "boolean"\n        },\n        "StreamViewType": {}\n      }\n    },\n    "S2k": {\n      "type": "structure",\n      "members": {\n        "Enabled": {\n          "type": "boolean"\n        },\n        "SSEType": {},\n        "KMSMasterKeyId": {}\n      }\n    },\n    "S2o": {\n      "type": "list",\n      "member": {\n        "type": "structure",\n        "required": [\n          "Key",\n          "Value"\n        ],\n        "members": {\n          "Key": {},\n          "Value": {}\n        }\n      }\n    },\n    "S2t": {\n      "type": "structure",\n      "members": {\n        "AttributeDefinitions": {\n          "shape": "S1z"\n        },\n        "TableName": {},\n        "KeySchema": {\n          "shape": "S23"\n        },\n        "TableStatus": {},\n        "CreationDateTime": {\n          "type": "timestamp"\n        },\n        "ProvisionedThroughput": {\n          "shape": "S2v"\n        },\n        "TableSizeBytes": {\n          "type": "long"\n        },\n        "ItemCount": {\n          "type": "long"\n        },\n        "TableArn": {},\n        "TableId": {},\n        "BillingModeSummary": {\n          "shape": "S30"\n        },\n        "LocalSecondaryIndexes": {\n          "type": "list",\n          "member": {\n            "type": "structure",\n            "members": {\n              "IndexName": {},\n              "KeySchema": {\n                "shape": "S23"\n              },\n              "Projection": {\n                "shape": "S28"\n              },\n              "IndexSizeBytes": {\n                "type": "long"\n              },\n              "ItemCount": {\n                "type": "long"\n              },\n              "IndexArn": {}\n            }\n          }\n        },\n        "GlobalSecondaryIndexes": {\n          "type": "list",\n          "member": {\n            "type": "structure",\n            "members": {\n              "IndexName": {},\n              "KeySchema": {\n                "shape": "S23"\n              },\n              "Projection": {\n                "shape": "S28"\n              },\n              "IndexStatus": {},\n              "Backfilling": {\n                "type": "boolean"\n              },\n              "ProvisionedThroughput": {\n                "shape": "S2v"\n              },\n              "IndexSizeBytes": {\n                "type": "long"\n              },\n              "ItemCount": {\n                "type": "long"\n              },\n              "IndexArn": {}\n            }\n          }\n        },\n        "StreamSpecification": {\n          "shape": "S2h"\n        },\n        "LatestStreamLabel": {},\n        "LatestStreamArn": {},\n        "RestoreSummary": {\n          "type": "structure",\n          "required": [\n            "RestoreDateTime",\n            "RestoreInProgress"\n          ],\n          "members": {\n            "SourceBackupArn": {},\n            "SourceTableArn": {},\n            "RestoreDateTime": {\n              "type": "timestamp"\n            },\n            "RestoreInProgress": {\n              "type": "boolean"\n            }\n          }\n        },\n        "SSEDescription": {\n          "shape": "S3b"\n        }\n      }\n    },\n    "S2v": {\n      "type": "structure",\n      "members": {\n        "LastIncreaseDateTime": {\n          "type": "timestamp"\n        },\n        "LastDecreaseDateTime": {\n          "type": "timestamp"\n        },\n        "NumberOfDecreasesToday": {\n          "type": "long"\n        },\n        "ReadCapacityUnits": {\n          "type": "long"\n        },\n        "WriteCapacityUnits": {\n          "type": "long"\n        }\n      }\n    },\n    "S30": {\n      "type": "structure",\n      "members": {\n        "BillingMode": {},\n        "LastUpdateToPayPerRequestDateTime": {\n          "type": "timestamp"\n        }\n      }\n    },\n    "S3b": {\n      "type": "structure",\n      "members": {\n        "Status": {},\n        "SSEType": {},\n        "KMSMasterKeyArn": {}\n      }\n    },\n    "S3g": {\n      "type": "structure",\n      "members": {\n        "BackupDetails": {\n          "shape": "S1h"\n        },\n        "SourceTableDetails": {\n          "type": "structure",\n          "required": [\n            "TableName",\n            "TableId",\n            "KeySchema",\n            "TableCreationDateTime",\n            "ProvisionedThroughput"\n          ],\n          "members": {\n            "TableName": {},\n            "TableId": {},\n            "TableArn": {},\n            "TableSizeBytes": {\n              "type": "long"\n            },\n            "KeySchema": {\n              "shape": "S23"\n            },\n            "TableCreationDateTime": {\n              "type": "timestamp"\n            },\n            "ProvisionedThroughput": {\n              "shape": "S2e"\n            },\n            "ItemCount": {\n              "type": "long"\n            },\n            "BillingMode": {}\n          }\n        },\n        "SourceTableFeatureDetails": {\n          "type": "structure",\n          "members": {\n            "LocalSecondaryIndexes": {\n              "type": "list",\n              "member": {\n                "type": "structure",\n                "members": {\n                  "IndexName": {},\n                  "KeySchema": {\n                    "shape": "S23"\n                  },\n                  "Projection": {\n                    "shape": "S28"\n                  }\n                }\n              }\n            },\n            "GlobalSecondaryIndexes": {\n              "type": "list",\n              "member": {\n                "type": "structure",\n                "members": {\n                  "IndexName": {},\n                  "KeySchema": {\n                    "shape": "S23"\n                  },\n                  "Projection": {\n                    "shape": "S28"\n                  },\n                  "ProvisionedThroughput": {\n                    "shape": "S2e"\n                  }\n                }\n              }\n            },\n            "StreamDescription": {\n              "shape": "S2h"\n            },\n            "TimeToLiveDescription": {\n              "shape": "S3p"\n            },\n            "SSEDescription": {\n              "shape": "S3b"\n            }\n          }\n        }\n      }\n    },\n    "S3p": {\n      "type": "structure",\n      "members": {\n        "TimeToLiveStatus": {},\n        "AttributeName": {}\n      }\n    },\n    "S3t": {\n      "type": "map",\n      "key": {},\n      "value": {\n        "type": "structure",\n        "members": {\n          "Value": {\n            "shape": "S8"\n          },\n          "Exists": {\n            "type": "boolean"\n          },\n          "ComparisonOperator": {},\n          "AttributeValueList": {\n            "shape": "S3x"\n          }\n        }\n      }\n    },\n    "S3x": {\n      "type": "list",\n      "member": {\n        "shape": "S8"\n      }\n    },\n    "S41": {\n      "type": "map",\n      "key": {},\n      "value": {\n        "shape": "S8"\n      }\n    },\n    "S4a": {\n      "type": "structure",\n      "required": [\n        "ContinuousBackupsStatus"\n      ],\n      "members": {\n        "ContinuousBackupsStatus": {},\n        "PointInTimeRecoveryDescription": {\n          "type": "structure",\n          "members": {\n            "PointInTimeRecoveryStatus": {},\n            "EarliestRestorableDateTime": {\n              "type": "timestamp"\n            },\n            "LatestRestorableDateTime": {\n              "type": "timestamp"\n            }\n          }\n        }\n      }\n    },\n    "S4m": {\n      "type": "list",\n      "member": {\n        "type": "structure",\n        "required": [\n          "RegionName"\n        ],\n        "members": {\n          "RegionName": {},\n          "ReplicaStatus": {},\n          "ReplicaBillingModeSummary": {\n            "shape": "S30"\n          },\n          "ReplicaProvisionedReadCapacityUnits": {\n            "type": "long"\n          },\n          "ReplicaProvisionedReadCapacityAutoScalingSettings": {\n            "shape": "S4p"\n          },\n          "ReplicaProvisionedWriteCapacityUnits": {\n            "type": "long"\n          },\n          "ReplicaProvisionedWriteCapacityAutoScalingSettings": {\n            "shape": "S4p"\n          },\n          "ReplicaGlobalSecondaryIndexSettings": {\n            "type": "list",\n            "member": {\n              "type": "structure",\n              "required": [\n                "IndexName"\n              ],\n              "members": {\n                "IndexName": {},\n                "IndexStatus": {},\n                "ProvisionedReadCapacityUnits": {\n                  "type": "long"\n                },\n                "ProvisionedReadCapacityAutoScalingSettings": {\n                  "shape": "S4p"\n                },\n                "ProvisionedWriteCapacityUnits": {\n                  "type": "long"\n                },\n                "ProvisionedWriteCapacityAutoScalingSettings": {\n                  "shape": "S4p"\n                }\n              }\n            }\n          }\n        }\n      }\n    },\n    "S4p": {\n      "type": "structure",\n      "members": {\n        "MinimumUnits": {\n          "type": "long"\n        },\n        "MaximumUnits": {\n          "type": "long"\n        },\n        "AutoScalingDisabled": {\n          "type": "boolean"\n        },\n        "AutoScalingRoleArn": {},\n        "ScalingPolicies": {\n          "type": "list",\n          "member": {\n            "type": "structure",\n            "members": {\n              "PolicyName": {},\n              "TargetTrackingScalingPolicyConfiguration": {\n                "type": "structure",\n                "required": [\n                  "TargetValue"\n                ],\n                "members": {\n                  "DisableScaleIn": {\n                    "type": "boolean"\n                  },\n                  "ScaleInCooldown": {\n                    "type": "integer"\n                  },\n                  "ScaleOutCooldown": {\n                    "type": "integer"\n                  },\n                  "TargetValue": {\n                    "type": "double"\n                  }\n                }\n              }\n            }\n          }\n        }\n      }\n    },\n    "S5w": {\n      "type": "structure",\n      "required": [\n        "ComparisonOperator"\n      ],\n      "members": {\n        "AttributeValueList": {\n          "shape": "S3x"\n        },\n        "ComparisonOperator": {}\n      }\n    },\n    "S5x": {\n      "type": "map",\n      "key": {},\n      "value": {\n        "shape": "S5w"\n      }\n    },\n    "S74": {\n      "type": "structure",\n      "members": {\n        "MinimumUnits": {\n          "type": "long"\n        },\n        "MaximumUnits": {\n          "type": "long"\n        },\n        "AutoScalingDisabled": {\n          "type": "boolean"\n        },\n        "AutoScalingRoleArn": {},\n        "ScalingPolicyUpdate": {\n          "type": "structure",\n          "required": [\n            "TargetTrackingScalingPolicyConfiguration"\n          ],\n          "members": {\n            "PolicyName": {},\n            "TargetTrackingScalingPolicyConfiguration": {\n              "type": "structure",\n              "required": [\n                "TargetValue"\n              ],\n              "members": {\n                "DisableScaleIn": {\n                  "type": "boolean"\n                },\n                "ScaleInCooldown": {\n                  "type": "integer"\n                },\n                "ScaleOutCooldown": {\n                  "type": "integer"\n                },\n                "TargetValue": {\n                  "type": "double"\n                }\n              }\n            }\n          }\n        }\n      }\n    },\n    "S7s": {\n      "type": "structure",\n      "required": [\n        "Enabled",\n        "AttributeName"\n      ],\n      "members": {\n        "Enabled": {\n          "type": "boolean"\n        },\n        "AttributeName": {}\n      }\n    }\n  }\n}  \n`));
function formatList(data, options1 = {
}) {
    const list1 = {
        L: []
    };
    for(let i3 = 0; i3 < data.length; i3++){
        list1["L"].push(Converter.input(data[i3], options1));
    }
    return list1;
}
function convertNumber(value2, wrapNumbers = false) {
    return wrapNumbers ? new DynamoDBNumberValue(value2) : Number(value2);
}
function formatMap(data, options1 = {
}) {
    const map = {
        M: {
        }
    };
    for(const key2 in data){
        const formatted = Converter.input(data[key2], options1);
        if (formatted !== void 0) {
            map["M"][key2] = formatted;
        }
    }
    return map;
}
function formatSet(data, options1 = {
}) {
    let values = data.values;
    if (options1.convertEmptyValues) {
        values = filterEmptySetValues(data);
        if (values.length === 0) {
            return Converter.input(null);
        }
    }
    const map = {
    };
    switch(data.type){
        case "String":
            map["SS"] = values;
            break;
        case "Binary":
            map["BS"] = values;
            break;
        case "Number":
            map["NS"] = values.map(function(value2) {
                return value2.toString();
            });
    }
    return map;
}
function filterEmptySetValues(set) {
    const nonEmptyValues = [];
    const potentiallyEmptyTypes = {
        String: true,
        Binary: true,
        Number: false
    };
    if (potentiallyEmptyTypes[set.type]) {
        for(let i3 = 0; i3 < set.values.length; i3++){
            if (set.values[i3].length === 0) {
                continue;
            }
            nonEmptyValues.push(set.values[i3]);
        }
        return nonEmptyValues;
    }
    return set.values;
}
class Converter {
    static input(data, options = {
    }) {
        const type = typeOf(data);
        if (type === "Object") {
            return formatMap(data, options);
        } else if (type === "Array") {
            return formatList(data, options);
        } else if (type === "Set") {
            return formatSet(data, options);
        } else if (type === "String") {
            if (data.length === 0 && options.convertEmptyValues) {
                return Converter.input(null);
            }
            return {
                S: data
            };
        } else if (type === "Number" || type === "NumberValue") {
            return {
                N: data.toString()
            };
        } else if (type === "Binary") {
            if (data.length === 0 && options.convertEmptyValues) {
                return Converter.input(null);
            }
            return {
                B: fromUint8Array2(data)
            };
        } else if (type === "Boolean") {
            return {
                BOOL: data
            };
        } else if (type === "null") {
            return {
                NULL: true
            };
        } else if (type !== "undefined" && type !== "Function") {
            return formatMap(data, options);
        }
        return {
        };
    }
    static marshall(data, options) {
        return Converter.input(data, options).M;
    }
    static output(data, options = {
    }) {
        for(const type in data){
            const values = data[type];
            if (type === "M") {
                const map = {
                };
                for(const key2 in values){
                    map[key2] = Converter.output(values[key2], options);
                }
                return map;
            } else if (type === "L") {
                return values.map((value2)=>Converter.output(value2, options)
                );
            } else if (type === "SS") {
                return new DynamoDBSet(values.map(String));
            } else if (type === "NS") {
                return new DynamoDBSet(values.map((value2)=>convertNumber(value2, options.wrapNumbers)
                ));
            } else if (type === "BS") {
                return new DynamoDBSet(values.map(toUint8Array2));
            } else if (type === "S") {
                return String(values);
            } else if (type === "N") {
                return convertNumber(values, options.wrapNumbers);
            } else if (type === "B") {
                return toUint8Array2(values);
            } else if (type === "BOOL") {
                return values === "true" || values === "TRUE" || values === true;
            } else if (type === "NULL") {
                return null;
            }
        }
    }
    static unmarshall(data, options) {
        return Converter.output({
            M: data
        }, options);
    }
}
function Translator({ wrapNumbers , convertEmptyValues , attrValue  } = {
}) {
    this.attrValue = attrValue;
    this.convertEmptyValues = Boolean(convertEmptyValues);
    this.wrapNumbers = Boolean(wrapNumbers);
}
Translator.prototype.translateInput = function(value2, shape) {
    this.mode = "input";
    return this.translate(value2, shape);
};
Translator.prototype.translateOutput = function(value2, shape) {
    this.mode = "output";
    return this.translate(value2, shape);
};
Translator.prototype.translate = function(value2, shape) {
    const self = this;
    if (!shape || value2 === undefined) {
        return undefined;
    }
    if (shape.shape === self.attrValue) {
        return Converter[self.mode](value2, {
            convertEmptyValues: self.convertEmptyValues,
            wrapNumbers: self.wrapNumbers
        });
    }
    switch(shape.type){
        case "structure":
            return self.translateStructure(value2, shape);
        case "map":
            return self.translateMap(value2, shape);
        case "list":
            return self.translateList(value2, shape);
        default:
            return self.translateScalar(value2, shape);
    }
};
Translator.prototype.translateStructure = function(structure, shape) {
    const self = this;
    if (structure == null) {
        return undefined;
    }
    const struct = {
    };
    Object.entries(structure).forEach(([name, value2])=>{
        const memberShape = shape.members[name];
        if (memberShape) {
            const result = self.translate(value2, memberShape);
            if (result !== undefined) {
                struct[name] = result;
            }
        }
    });
    return struct;
};
Translator.prototype.translateList = function(list1, shape) {
    const self = this;
    if (list1 == null) {
        return undefined;
    }
    return list1.map((value2)=>{
        const result = self.translate(value2, shape.member);
        if (result === undefined) {
            return null;
        } else {
            return result;
        }
    });
};
Translator.prototype.translateMap = function(map, shape) {
    const self = this;
    if (!map) {
        return undefined;
    }
    return Object.entries(map).reduce((acc, [key2, value2])=>{
        const result = self.translate(value2, shape.value);
        if (result === undefined) {
            acc[key2] = null;
        } else {
            acc[key2] = result;
        }
        return acc;
    }, {
    });
};
Translator.prototype.translateScalar = function(value2, shape) {
    return shape.toType(value2);
};
const _Translator = Translator;
const NO_PARAMS_OPS = new Set([
    "DescribeEndpoints",
    "DescribeLimits",
    "ListTables", 
]);
const ATTR_VALUE = API.operations.PutItem.input.members.Item.value.shape;
async function baseOp(conf, op, params = {
}, { wrapNumbers =false , convertEmptyValues =false , translateJSON =true , iteratePages =true  } = NO_PARAMS_OPS.has(op) ? params || {
} : {
}) {
    let translator;
    let outputShape;
    if (translateJSON) {
        translator = new _Translator({
            wrapNumbers,
            convertEmptyValues,
            attrValue: ATTR_VALUE
        });
        outputShape = API.operations[op].output;
        params = translator.translateInput(params, API.operations[op].input);
    } else {
        params = {
            ...params
        };
    }
    let rawResult = await baseFetch(conf, op, params);
    if (rawResult.LastEvaluatedKey && iteratePages) {
        let lastEvaluatedKey = rawResult.LastEvaluatedKey;
        let first = true;
        return {
            [Symbol.asyncIterator] () {
                return this;
            },
            async next () {
                if (!lastEvaluatedKey) {
                    return {
                        value: {
                        },
                        done: true
                    };
                }
                if (first) {
                    first = false;
                    lastEvaluatedKey = rawResult.LastEvaluatedKey;
                    if (!translateJSON) {
                        return {
                            value: rawResult,
                            done: false
                        };
                    } else {
                        return {
                            value: translator.translateOutput(rawResult, outputShape),
                            done: false
                        };
                    }
                } else {
                    params.ExclusiveStartKey = lastEvaluatedKey;
                }
                rawResult = await baseFetch(conf, op, params);
                lastEvaluatedKey = rawResult.LastEvaluatedKey;
                if (!translateJSON) {
                    return {
                        value: rawResult,
                        done: false
                    };
                }
                return {
                    value: translator.translateOutput(rawResult, outputShape),
                    done: false
                };
            }
        };
    }
    if (!translateJSON) {
        return rawResult;
    }
    return translator.translateOutput(rawResult, outputShape);
}
const SERVICE = "dynamodb";
function createCache(conf) {
    return {
        _credentialScope: "",
        _signingKey: null,
        _accessKeyId: "",
        _sessionToken: "",
        async refresh () {
            const dateStamp = date1.format(new Date(), "dateStamp");
            let credentials;
            if (typeof conf.credentials === "function") {
                credentials = await conf.credentials();
            } else {
                credentials = conf.credentials;
            }
            this._signingKey = kdf(credentials.secretAccessKey, dateStamp, conf.region, SERVICE);
            this._credentialScope = `${dateStamp}/${conf.region}/${SERVICE}/aws4_request`;
            this._accessKeyId = credentials.accessKeyId;
            this._sessionToken = credentials.sessionToken;
        },
        get signingKey () {
            return this._signingKey;
        },
        get credentialScope () {
            return this._credentialScope;
        },
        get accessKeyId () {
            return this._accessKeyId;
        },
        get sessionToken () {
            return this._sessionToken;
        }
    };
}
function deriveHostEndpoint(region, port = 8000, host = "localhost") {
    let _host = host;
    let endpoint;
    if (region === "local") {
        endpoint = `http://${host}:${port}/`;
    } else {
        _host = `dynamodb.${region}.amazonaws.com`;
        endpoint = `https://${_host}:443/`;
    }
    return {
        host: _host,
        endpoint
    };
}
function deriveConfig(conf = {
}) {
    const _conf = {
        ...conf
    };
    if (_conf.profile || !_conf.region || !_conf.credentials || typeof _conf.credentials !== "function" && (!_conf.credentials.accessKeyId || !_conf.credentials.secretAccessKey)) {
        const got = get2({
            profile: _conf.profile
        });
        if (typeof _conf.credentials !== "function") {
            _conf.credentials = {
                accessKeyId: got.accessKeyId,
                secretAccessKey: got.secretAccessKey,
                sessionToken: got.sessionToken,
                ..._conf.credentials
            };
        }
        _conf.region = got.region;
        if (typeof _conf.credentials !== "function" && (!_conf.region || !_conf.credentials.accessKeyId || !_conf.credentials.secretAccessKey)) {
            throw new Error("unable to derive aws config");
        }
    }
    return {
        ..._conf,
        cache: createCache(_conf),
        method: "POST",
        ...deriveHostEndpoint(_conf.region, _conf.port, _conf.host)
    };
}
const OPS = new Set([
    "BatchGetItem",
    "BatchWriteItem",
    "CreateBackup",
    "CreateGlobalTable",
    "CreateTable",
    "DeleteBackup",
    "DeleteItem",
    "DeleteTable",
    "DescribeBackup",
    "DescribeContinuousBackups",
    "DescribeEndpoints",
    "DescribeGlobalTable",
    "DescribeGlobalTableSettings",
    "DescribeLimits",
    "DescribeTable",
    "DescribeTimeToLive",
    "GetItem",
    "ListBackups",
    "ListGlobalTables",
    "ListTables",
    "ListTagsOfResource",
    "PutItem",
    "Query",
    "RestoreTableFromBackup",
    "RestoreTableToPointInTime",
    "Scan",
    "TagResource",
    "TransactGetItems",
    "TransactWriteItems",
    "UntagResource",
    "UpdateContinuousBackups",
    "UpdateGlobalTable",
    "UpdateGlobalTableSettings",
    "UpdateItem",
    "UpdateTable",
    "UpdateTimeToLive", 
]);
function createClient(conf) {
    const _conf = deriveConfig(conf);
    const dyno = {
    };
    for (const op of OPS){
        dyno[camelCase(op)] = baseOp.bind(null, _conf, op);
    }
    return dyno;
}
class Hashids {
    constructor(salt1 = "", minLength = 0, alphabet1 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"){
        const minAlphabetLength = 16;
        const sepDiv = 3.5;
        const guardDiv = 12;
        const errorAlphabetLength = "error: alphabet must contain at least X unique characters";
        const errorAlphabetSpace = "error: alphabet cannot contain spaces";
        let uniqueAlphabet = "", sepsLength, diff;
        this.escapeRegExp = (s)=>s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")
        ;
        this.parseInt = (v, radix)=>/^(-|\+)?([0-9]+|Infinity)$/.test(v) ? parseInt(v, radix) : NaN
        ;
        this.seps = "cfhistuCFHISTU";
        this.minLength = parseInt(minLength, 10) > 0 ? minLength : 0;
        this.salt = typeof salt1 === "string" ? salt1 : "";
        if (typeof alphabet1 === "string") {
            this.alphabet = alphabet1;
        }
        for(let i3 = 0; i3 !== this.alphabet.length; i3++){
            if (uniqueAlphabet.indexOf(this.alphabet.charAt(i3)) === -1) {
                uniqueAlphabet += this.alphabet.charAt(i3);
            }
        }
        this.alphabet = uniqueAlphabet;
        if (this.alphabet.length < 16) {
            throw errorAlphabetLength.replace("X", 16);
        }
        if (this.alphabet.search(" ") !== -1) {
            throw errorAlphabetSpace;
        }
        for(let i4 = 0; i4 !== this.seps.length; i4++){
            const j = this.alphabet.indexOf(this.seps.charAt(i4));
            if (j === -1) {
                this.seps = this.seps.substr(0, i4) + " " + this.seps.substr(i4 + 1);
            } else {
                this.alphabet = this.alphabet.substr(0, j) + " " + this.alphabet.substr(j + 1);
            }
        }
        this.alphabet = this.alphabet.replace(/ /g, "");
        this.seps = this.seps.replace(/ /g, "");
        this.seps = this._shuffle(this.seps, this.salt);
        if (!this.seps.length || this.alphabet.length / this.seps.length > 3.5) {
            sepsLength = Math.ceil(this.alphabet.length / sepDiv);
            if (sepsLength > this.seps.length) {
                diff = sepsLength - this.seps.length;
                this.seps += this.alphabet.substr(0, diff);
                this.alphabet = this.alphabet.substr(diff);
            }
        }
        this.alphabet = this._shuffle(this.alphabet, this.salt);
        const guardCount = Math.ceil(this.alphabet.length / 12);
        if (this.alphabet.length < 3) {
            this.guards = this.seps.substr(0, guardCount);
            this.seps = this.seps.substr(guardCount);
        } else {
            this.guards = this.alphabet.substr(0, guardCount);
            this.alphabet = this.alphabet.substr(guardCount);
        }
    }
    encode(...numbers) {
        const ret = "";
        if (!numbers.length) {
            return ret;
        }
        if (numbers[0] && numbers[0].constructor === Array) {
            numbers = numbers[0];
            if (!numbers.length) {
                return ret;
            }
        }
        for(let i5 = 0; i5 !== numbers.length; i5++){
            numbers[i5] = this.parseInt(numbers[i5], 10);
            if (numbers[i5] >= 0) {
                continue;
            } else {
                return ret;
            }
        }
        return this._encode(numbers);
    }
    decode(id) {
        const ret = [];
        if (!id || !id.length || typeof id !== "string") {
            return ret;
        }
        return this._decode(id, this.alphabet);
    }
    encodeHex(hex) {
        hex = hex.toString();
        if (!/^[0-9a-fA-F]+$/.test(hex)) {
            return "";
        }
        const numbers = hex.match(/[\w\W]{1,12}/g);
        for(let i5 = 0; i5 !== numbers.length; i5++){
            numbers[i5] = parseInt("1" + numbers[i5], 16);
        }
        return this.encode.apply(this, numbers);
    }
    decodeHex(id) {
        let ret = [];
        const numbers = this.decode(id);
        for(let i5 = 0; i5 !== numbers.length; i5++){
            ret += numbers[i5].toString(16).substr(1);
        }
        return ret;
    }
    _encode(numbers) {
        let ret, alphabet1 = this.alphabet, numbersIdInt = 0;
        for(let i5 = 0; i5 !== numbers.length; i5++){
            numbersIdInt += numbers[i5] % (i5 + 100);
        }
        ret = alphabet1.charAt(numbersIdInt % alphabet1.length);
        const lottery = ret;
        for(let i6 = 0; i6 !== numbers.length; i6++){
            let number = numbers[i6];
            const buffer = lottery + this.salt + alphabet1;
            alphabet1 = this._shuffle(alphabet1, buffer.substr(0, alphabet1.length));
            const last = this._toAlphabet(number, alphabet1);
            ret += last;
            if (i6 + 1 < numbers.length) {
                number %= last.charCodeAt(0) + i6;
                const sepsIndex = number % this.seps.length;
                ret += this.seps.charAt(sepsIndex);
            }
        }
        if (ret.length < this.minLength) {
            let guardIndex = (numbersIdInt + ret[0].charCodeAt(0)) % this.guards.length;
            let guard = this.guards[guardIndex];
            ret = guard + ret;
            if (ret.length < this.minLength) {
                guardIndex = (numbersIdInt + ret[2].charCodeAt(0)) % this.guards.length;
                guard = this.guards[guardIndex];
                ret += guard;
            }
        }
        const halfLength = parseInt(alphabet1.length / 2, 10);
        while(ret.length < this.minLength){
            alphabet1 = this._shuffle(alphabet1, alphabet1);
            ret = alphabet1.substr(halfLength) + ret + alphabet1.substr(0, halfLength);
            const excess = ret.length - this.minLength;
            if (excess > 0) {
                ret = ret.substr(excess / 2, this.minLength);
            }
        }
        return ret;
    }
    _decode(id, alphabet) {
        let ret = [], i5 = 0, r = new RegExp(`[${this.escapeRegExp(this.guards)}]`, "g"), idBreakdown = id.replace(r, " "), idArray = idBreakdown.split(" ");
        if (idArray.length === 3 || idArray.length === 2) {
            i5 = 1;
        }
        idBreakdown = idArray[i5];
        if (typeof idBreakdown[0] !== "undefined") {
            const lottery = idBreakdown[0];
            idBreakdown = idBreakdown.substr(1);
            r = new RegExp(`[${this.escapeRegExp(this.seps)}]`, "g");
            idBreakdown = idBreakdown.replace(r, " ");
            idArray = idBreakdown.split(" ");
            for(let j = 0; j !== idArray.length; j++){
                const subId = idArray[j];
                const buffer = lottery + this.salt + alphabet;
                alphabet = this._shuffle(alphabet, buffer.substr(0, alphabet.length));
                ret.push(this._fromAlphabet(subId, alphabet));
            }
            if (this.encode(ret) !== id) {
                ret = [];
            }
        }
        return ret;
    }
    _shuffle(alphabet, salt) {
        let integer;
        if (!salt.length) {
            return alphabet;
        }
        alphabet = alphabet.split("");
        for(let i5 = alphabet.length - 1, v = 0, p = 0, j = 0; i5 > 0; i5--, v++){
            v %= salt.length;
            p += integer = salt.charCodeAt(v);
            j = (integer + v + p) % i5;
            const tmp = alphabet[j];
            alphabet[j] = alphabet[i5];
            alphabet[i5] = tmp;
        }
        alphabet = alphabet.join("");
        return alphabet;
    }
    _toAlphabet(input, alphabet) {
        let id = "";
        do {
            id = alphabet.charAt(input % alphabet.length) + id;
            input = parseInt(input / alphabet.length, 10);
        }while (input)
        return id;
    }
    _fromAlphabet(input, alphabet) {
        return input.split("").map((item)=>alphabet.indexOf(item)
        ).reduce((carry, item)=>carry * alphabet.length + item
        , 0);
    }
}
function createClient1() {
    let env = Deno.env.toObject();
    if (env.NODE_ENV === "testing" || env.DENO_ENV === "testing") {
        let conf = {
            credentials: {
                accessKeyId: "DynamoDBLocal",
                secretAccessKey: "DoesNotDoAnyAuth",
                sessionToken: "preferTemporaryCredentials"
            },
            region: "local",
            port: 5000
        };
        return createClient(conf);
    }
    return createClient({
        credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            sessionToken: env.AWS_SESSION_TOKEN
        }
    });
}
async function getTableName() {
    let env = Deno.env.toObject();
    if (env.BEGIN_DATA_TABLE_NAME) {
        return env.BEGIN_DATA_TABLE_NAME;
    }
    if (env.NODE_ENV === "testing" || env.DENO_ENV === "testing") {
        let db = createClient1();
        let result = await db.listTables();
        return result.TableNames.find((t)=>t.includes("-staging-data")
        );
    } else {
    }
}
function getKey(opts) {
    let env = Deno.env.toObject();
    let stage = env.DENO_ENV === "testing" ? "staging" : env.DENO_ENV || "staging";
    let scopeID = env.BEGIN_DATA_SCOPE_ID || env.ARC_APP_NAME || "sandbox";
    let dataID = `${stage}#${opts.table}#${opts.key}`;
    return {
        scopeID,
        dataID
    };
}
async function createKey(table) {
    let TableName = await getTableName();
    let db = createClient1();
    let env = Deno.env.toObject();
    let scopeID = env.BEGIN_DATA_SCOPE_ID || env.ARC_APP_NAME || "sandbox";
    let dataID = `${table}-seq`;
    let result = await db.updateItem({
        TableName,
        Key: {
            scopeID,
            dataID
        },
        AttributeUpdates: {
            idx: {
                Action: "ADD",
                Value: 1
            }
        },
        ReturnValues: "UPDATED_NEW"
    });
    let hash = new Hashids();
    let epoc = Date.now() - 1544909702376;
    let seed = Number(result.Attributes.idx);
    return hash.encode([
        epoc,
        seed
    ]);
}
function unfmt(obj) {
    if (!obj) {
        return null;
    }
    let copy = {
        ...obj
    };
    copy.key = obj.dataID.split("#")[2];
    copy.table = obj.dataID.split("#")[1];
    delete copy.scopeID;
    delete copy.dataID;
    return copy;
}
async function get1(params) {
    if (params.table && params.key) {
        let [TableName, Key] = await Promise.all([
            getTableName(),
            getKey(params), 
        ]);
        let { Item  } = await createClient1().getItem({
            TableName,
            Key
        });
        return unfmt(Item);
    }
    if (params.table && !params.key) {
        params.key = params.begin || "UNKNOWN";
        let [TableName, Key] = await Promise.all([
            getTableName(),
            getKey(params), 
        ]);
        let { dataID , scopeID  } = Key;
        dataID = dataID.replace("#UNKNOWN", "");
        let query = {
            TableName,
            Limit: params.limit || 10,
            KeyConditionExpression: "#scopeID = :scopeID and begins_with(#dataID, :dataID)",
            ExpressionAttributeNames: {
                "#scopeID": "scopeID",
                "#dataID": "dataID"
            },
            ExpressionAttributeValues: {
                ":scopeID": scopeID,
                ":dataID": dataID
            }
        };
        if (params.cursor) {
            query.ExclusiveStartKey = JSON.parse(atob(params.cursor));
        }
        let result = await createClient1().query(query, {
            iteratePages: false
        });
        let exact = (item)=>item.table === params.table
        ;
        let returns = Array.isArray(result.Items) ? result.Items.map(unfmt).filter(exact) : [];
        if (result.LastEvaluatedKey) {
            returns.cursor = btoa(JSON.stringify(result.LastEvaluatedKey));
        }
        return returns;
    }
    if (Array.isArray(params)) {
        let TableName = await getTableName();
        let query = {
            RequestItems: {
            }
        };
        query.RequestItems[TableName] = {
            Keys: params.map(getKey)
        };
        let result = await createClient1().batchGetItem(query);
        return result.Responses[TableName].map(unfmt);
    }
    throw Error("get_invalid");
}
async function set1(params) {
    let exec = Array.isArray(params) ? batch : one;
    return exec(params);
}
async function one(params) {
    if (!params.key) {
        params.key = await createKey(params.table);
    }
    let [TableName, Key] = await Promise.all([
        getTableName(),
        getKey(params), 
    ]);
    let copy = {
        ...params
    };
    delete copy.key;
    delete copy.table;
    await createClient1().putItem({
        TableName,
        Item: {
            ...copy,
            ...Key
        }
    });
    return {
        ...params
    };
}
async function batch(params) {
    let TableName = await getTableName();
    let ensure = await Promise.all(params.map((item)=>{
        return (async function() {
            if (!item.key) {
                item.key = await createKey(item.table);
            }
            return item;
        })();
    }));
    let batch1 = ensure.map(getKey).map((Item)=>({
            PutRequest: {
                Item
            }
        })
    );
    let query = {
        RequestItems: {
        }
    };
    query.RequestItems[TableName] = batch1;
    await createClient1().batchWriteItem(query);
    let clean = (item)=>unfmt(item.PutRequest.Item)
    ;
    return batch1.map(clean);
}
async function destroy1(params) {
    if (Array.isArray(params)) {
        let TableName = await getTableName();
        let req = (Key)=>({
                DeleteRequest: {
                    Key
                }
            })
        ;
        let batch1 = params.map(getKey).map(req);
        let query = {
            RequestItems: {
            }
        };
        query.RequestItems[TableName] = batch1;
        await createClient1().batchWriteItem(query);
        return;
    }
    if (params.table && params.key) {
        let [TableName, Key] = await Promise.all([
            getTableName(),
            getKey(params), 
        ]);
        await createClient1().deleteItem({
            TableName,
            Key
        });
        return;
    }
    throw Error("destroy_invalid");
}
async function incr1({ table , key: key2 , prop  }) {
    let result = await createClient1().updateItem({
        TableName: await getTableName(),
        Key: getKey({
            table,
            key: key2
        }),
        UpdateExpression: `SET ${prop} = if_not_exists(${prop}, :zero) + :val`,
        ExpressionAttributeValues: {
            ":val": 1,
            ":zero": 0
        },
        ReturnValues: "ALL_NEW"
    });
    return result.Attributes;
}
async function decr1({ table , key: key2 , prop  }) {
    let result = await createClient1().updateItem({
        TableName: await getTableName(),
        Key: getKey({
            table,
            key: key2
        }),
        UpdateExpression: `SET ${prop} = if_not_exists(${prop}, :zero) - :val`,
        ExpressionAttributeValues: {
            ":val": 1,
            ":zero": 0
        },
        ReturnValues: "ALL_NEW"
    });
    return result.Attributes;
}
async function count1({ table  }) {
    let TableName = await getTableName();
    let { scopeID , dataID  } = getKey({
        table
    });
    let result = await createClient1().query({
        TableName,
        Select: "COUNT",
        KeyConditionExpression: "#scopeID = :scopeID and begins_with(#dataID, :dataID)",
        ExpressionAttributeNames: {
            "#scopeID": "scopeID",
            "#dataID": "dataID"
        },
        ExpressionAttributeValues: {
            ":scopeID": scopeID,
            ":dataID": dataID.replace("#undefined", "")
        }
    }, {
        iteratePages: false
    });
    return result.ScannedCount;
}
export { get1 as get };
async function page1(props) {
    if (!props.table) {
        throw ReferenceError("Missing params.table");
    }
    let cursor = false;
    let finished = false;
    function next() {
        if (finished) {
            return {
                done: true
            };
        }
        let params = {
            ...props
        };
        if (cursor) {
            params.cursor = cursor;
        }
        return new Promise(function sigh(resolve1, reject) {
            get1(params).then(function got(result) {
                if (result && result.cursor) {
                    cursor = result.cursor;
                    resolve1({
                        value: result,
                        done: false
                    });
                } else {
                    finished = true;
                    resolve1({
                        value: result,
                        done: false
                    });
                }
            }).catch(reject);
        });
    }
    let asyncIterator = {
        next
    };
    let asyncIterable = {
        [Symbol.asyncIterator]: ()=>asyncIterator
    };
    return asyncIterable;
}
export { set1 as set };
export { destroy1 as destroy };
export { incr1 as incr };
export { decr1 as decr };
export { count1 as count };
export { page1 as page };
