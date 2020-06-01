// Copyright 2018-2020 the Deno authors. All rights reserved. MIT license.

// This is a specialised implementation of a System module loader.

"use strict";

// @ts-nocheck
/* eslint-disable */
let System, __instantiateAsync, __instantiate;

(() => {
  const r = new Map();

  System = {
    register(id, d, f) {
      r.set(id, { d, f, exp: {} });
    },
  };

  async function dI(mid, src) {
    let id = mid.replace(/\.\w+$/i, "");
    if (id.includes("./")) {
      const [o, ...ia] = id.split("/").reverse(),
        [, ...sa] = src.split("/").reverse(),
        oa = [o];
      let s = 0,
        i;
      while ((i = ia.shift())) {
        if (i === "..") s++;
        else if (i === ".") break;
        else oa.push(i);
      }
      if (s < sa.length) oa.push(...sa.slice(s));
      id = oa.reverse().join("/");
    }
    return r.has(id) ? gExpA(id) : import(mid);
  }

  function gC(id, main) {
    return {
      id,
      import: (m) => dI(m, id),
      meta: { url: id, main },
    };
  }

  function gE(exp) {
    return (id, v) => {
      v = typeof id === "string" ? { [id]: v } : id;
      for (const [id, value] of Object.entries(v)) {
        Object.defineProperty(exp, id, {
          value,
          writable: true,
          enumerable: true,
        });
      }
    };
  }

  function rF(main) {
    for (const [id, m] of r.entries()) {
      const { f, exp } = m;
      const { execute: e, setters: s } = f(gE(exp), gC(id, id === main));
      delete m.f;
      m.e = e;
      m.s = s;
    }
  }

  async function gExpA(id) {
    if (!r.has(id)) return;
    const m = r.get(id);
    if (m.s) {
      const { d, e, s } = m;
      delete m.s;
      delete m.e;
      for (let i = 0; i < s.length; i++) s[i](await gExpA(d[i]));
      const r = e();
      if (r) await r;
    }
    return m.exp;
  }

  function gExp(id) {
    if (!r.has(id)) return;
    const m = r.get(id);
    if (m.s) {
      const { d, e, s } = m;
      delete m.s;
      delete m.e;
      for (let i = 0; i < s.length; i++) s[i](gExp(d[i]));
      e();
    }
    return m.exp;
  }

  __instantiateAsync = async (m) => {
    System = __instantiateAsync = __instantiate = undefined;
    rF(m);
    return gExpA(m);
  };

  __instantiate = (m) => {
    System = __instantiateAsync = __instantiate = undefined;
    rF(m);
    return gExp(m);
  };
})();

System.register(
  "https://deno.land/x/base64/base",
  [],
  function (exports_1, context_1) {
    "use strict";
    var __moduleName = context_1 && context_1.id;
    function getLengths(b64) {
      const len = b64.length;
      if (len % 4 > 0) {
        throw new TypeError("Invalid string. Length must be a multiple of 4");
      }
      // Trim off extra bytes after placeholder bytes are found
      // See: https://github.com/beatgammit/base64-js/issues/42
      let validLen = b64.indexOf("=");
      if (validLen === -1) {
        validLen = len;
      }
      const placeHoldersLen = validLen === len ? 0 : 4 - (validLen % 4);
      return [validLen, placeHoldersLen];
    }
    function init(lookup, revLookup) {
      function _byteLength(validLen, placeHoldersLen) {
        return ((validLen + placeHoldersLen) * 3) / 4 - placeHoldersLen;
      }
      function tripletToBase64(num) {
        return (lookup[(num >> 18) & 0x3f] +
          lookup[(num >> 12) & 0x3f] +
          lookup[(num >> 6) & 0x3f] +
          lookup[num & 0x3f]);
      }
      function encodeChunk(buf, start, end) {
        const out = new Array((end - start) / 3);
        for (let i = start, curTriplet = 0; i < end; i += 3) {
          out[curTriplet++] = tripletToBase64(
            (buf[i] << 16) + (buf[i + 1] << 8) + buf[i + 2],
          );
        }
        return out.join("");
      }
      return {
        // base64 is 4/3 + up to two characters of the original data
        byteLength(b64) {
          return _byteLength.apply(null, getLengths(b64));
        },
        toUint8Array(b64) {
          const [validLen, placeHoldersLen] = getLengths(b64);
          const buf = new Uint8Array(_byteLength(validLen, placeHoldersLen));
          // If there are placeholders, only get up to the last complete 4 chars
          const len = placeHoldersLen ? validLen - 4 : validLen;
          let tmp;
          let curByte = 0;
          let i;
          for (i = 0; i < len; i += 4) {
            tmp = (revLookup[b64.charCodeAt(i)] << 18) |
              (revLookup[b64.charCodeAt(i + 1)] << 12) |
              (revLookup[b64.charCodeAt(i + 2)] << 6) |
              revLookup[b64.charCodeAt(i + 3)];
            buf[curByte++] = (tmp >> 16) & 0xff;
            buf[curByte++] = (tmp >> 8) & 0xff;
            buf[curByte++] = tmp & 0xff;
          }
          if (placeHoldersLen === 2) {
            tmp = (revLookup[b64.charCodeAt(i)] << 2) |
              (revLookup[b64.charCodeAt(i + 1)] >> 4);
            buf[curByte++] = tmp & 0xff;
          } else if (placeHoldersLen === 1) {
            tmp = (revLookup[b64.charCodeAt(i)] << 10) |
              (revLookup[b64.charCodeAt(i + 1)] << 4) |
              (revLookup[b64.charCodeAt(i + 2)] >> 2);
            buf[curByte++] = (tmp >> 8) & 0xff;
            buf[curByte++] = tmp & 0xff;
          }
          return buf;
        },
        fromUint8Array(buf) {
          const maxChunkLength = 16383; // Must be multiple of 3
          const len = buf.length;
          const extraBytes = len % 3; // If we have 1 byte left, pad 2 bytes
          const len2 = len - extraBytes;
          const parts = new Array(
            Math.ceil(len2 / maxChunkLength) + (extraBytes ? 1 : 0),
          );
          let curChunk = 0;
          let chunkEnd;
          // Go through the array every three bytes, we'll deal with trailing stuff later
          for (let i = 0; i < len2; i += maxChunkLength) {
            chunkEnd = i + maxChunkLength;
            parts[curChunk++] = encodeChunk(
              buf,
              i,
              chunkEnd > len2 ? len2 : chunkEnd,
            );
          }
          let tmp;
          // Pad the end with zeros, but make sure to not forget the extra bytes
          if (extraBytes === 1) {
            tmp = buf[len2];
            parts[curChunk] = lookup[tmp >> 2] + lookup[(tmp << 4) & 0x3f] +
              "==";
          } else if (extraBytes === 2) {
            tmp = (buf[len2] << 8) | (buf[len2 + 1] & 0xff);
            parts[curChunk] = lookup[tmp >> 10] +
              lookup[(tmp >> 4) & 0x3f] +
              lookup[(tmp << 2) & 0x3f] +
              "=";
          }
          return parts.join("");
        },
      };
    }
    exports_1("init", init);
    return {
      setters: [],
      execute: function () {
      },
    };
  },
);
System.register(
  "https://deno.land/x/base64/base64url",
  ["https://deno.land/x/base64/base"],
  function (exports_2, context_2) {
    "use strict";
    var base_ts_1,
      lookup,
      revLookup,
      code,
      mod,
      byteLength,
      toUint8Array,
      fromUint8Array;
    var __moduleName = context_2 && context_2.id;
    return {
      setters: [
        function (base_ts_1_1) {
          base_ts_1 = base_ts_1_1;
        },
      ],
      execute: function () {
        lookup = [];
        revLookup = [];
        code =
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
        for (let i = 0, l = code.length; i < l; ++i) {
          lookup[i] = code[i];
          revLookup[code.charCodeAt(i)] = i;
        }
        revLookup["-".charCodeAt(0)] = 62;
        revLookup["_".charCodeAt(0)] = 63;
        mod = base_ts_1.init(lookup, revLookup);
        exports_2("byteLength", byteLength = mod.byteLength);
        exports_2("toUint8Array", toUint8Array = mod.toUint8Array);
        exports_2("fromUint8Array", fromUint8Array = mod.fromUint8Array);
      },
    };
  },
);
System.register(
  "https://raw.githubusercontent.com/chiefbiiko/std-encoding/v1.0.0/mod",
  ["https://deno.land/x/base64/base64url"],
  function (exports_3, context_3) {
    "use strict";
    var base64url_ts_1, decoder, encoder;
    var __moduleName = context_3 && context_3.id;
    /** Serializes a Uint8Array to a hexadecimal string. */
    function toHexString(buf) {
      return buf.reduce(
        (hex, byte) => `${hex}${byte < 16 ? "0" : ""}${byte.toString(16)}`,
        "",
      );
    }
    /** Deserializes a Uint8Array from a hexadecimal string. */
    function fromHexString(hex) {
      const len = hex.length;
      if (len % 2 || !/^[0-9a-fA-F]+$/.test(hex)) {
        throw new TypeError("Invalid hex string.");
      }
      hex = hex.toLowerCase();
      const buf = new Uint8Array(Math.floor(len / 2));
      const end = len / 2;
      for (let i = 0; i < end; ++i) {
        buf[i] = parseInt(hex.substr(i * 2, 2), 16);
      }
      return buf;
    }
    /** Decodes a Uint8Array to utf8-, base64-, or hex-encoded string. */
    function decode(buf, encoding = "utf8") {
      if (/^utf-?8$/i.test(encoding)) {
        return decoder.decode(buf);
      } else if (/^base64$/i.test(encoding)) {
        return base64url_ts_1.fromUint8Array(buf);
      } else if (/^hex(?:adecimal)?$/i.test(encoding)) {
        return toHexString(buf);
      } else {
        throw new TypeError("Unsupported string encoding.");
      }
    }
    exports_3("decode", decode);
    function encode(str, encoding = "utf8") {
      if (/^utf-?8$/i.test(encoding)) {
        return encoder.encode(str);
      } else if (/^base64$/i.test(encoding)) {
        return base64url_ts_1.toUint8Array(str);
      } else if (/^hex(?:adecimal)?$/i.test(encoding)) {
        return fromHexString(str);
      } else {
        throw new TypeError("Unsupported string encoding.");
      }
    }
    exports_3("encode", encode);
    return {
      setters: [
        function (base64url_ts_1_1) {
          base64url_ts_1 = base64url_ts_1_1;
        },
      ],
      execute: function () {
        decoder = new TextDecoder();
        encoder = new TextEncoder();
      },
    };
  },
);
System.register(
  "https://raw.githubusercontent.com/chiefbiiko/get-aws-config/v1.0.1/mod",
  [],
  function (exports_4, context_4) {
    "use strict";
    var HOME, NEW_LINE_REGEX, PROFILE_REGEXP, QUOTE_REGEXP, decoder;
    var __moduleName = context_4 && context_4.id;
    /** Bike-shed file existence check. */
    function fileExistsSync(file) {
      try {
        Deno.statSync(file);
        return true;
      } catch (_) {
        return false;
      }
    }
    /** Normalizes config keys (from snake to camel case). */
    function normalizeKey(key) {
      return key
        .toLowerCase()
        .replace("aws_", "")
        .split("_")
        .map((part, i) =>
          i === 0 ? part : `${part[0].toUpperCase()}${part.slice(1)}`
        )
        .join("");
    }
    /** Parses config and credential files. */
    function parse(file) {
      if (!fileExistsSync(file)) {
        return {};
      }
      return decoder
        .decode(Deno.readFileSync(file))
        .split(NEW_LINE_REGEX)
        .map((line) => line.trim())
        .filter((line) => !!line && !line.startsWith("#"))
        .reduce(([oldProfile, acc], line) => {
          let newProfile = "";
          if (line.startsWith("[")) {
            newProfile = line.replace(PROFILE_REGEXP, "$1");
            if (!acc.hasOwnProperty(newProfile)) {
              acc[newProfile] = {};
            }
          } else {
            const [key, val] = line
              .split("=")
              .map((part) => part.replace(QUOTE_REGEXP, ""));
            acc[newProfile || oldProfile][normalizeKey(key)] = val;
          }
          return [newProfile || oldProfile, acc];
        }, ["default", { default: {} }])[1];
    }
    /** Derives aws config from the environment and/or filesystem. */
    function get(opts = {}) {
      const _opts = { ...opts, env: opts.env !== false };
      const ENV = _opts.env ? Deno.env.toObject() : {};
      _opts.fs = _opts.fs !== false;
      _opts.profile = _opts.profile || ENV.AWS_PROFILE || "default";
      _opts.credentialsFile = _opts.credentialsFile ||
        `${HOME}/.aws/credentials`;
      _opts.configFile = _opts.configFile || `${HOME}/.aws/config`;
      if (
        _opts.env &&
        ENV.AWS_ACCESS_KEY_ID &&
        ENV.AWS_SECRET_ACCESS_KEY &&
        ENV.AWS_DEFAULT_REGION
      ) {
        return {
          accessKeyId: ENV.AWS_ACCESS_KEY_ID,
          secretAccessKey: ENV.AWS_SECRET_ACCESS_KEY,
          sessionToken: ENV.AWS_SESSION_TOKEN,
          region: ENV.AWS_DEFAULT_REGION,
        };
      }
      if (_opts.fs) {
        const credentials = parse(
          opts.credentialsFile ||
            ENV.AWS_SHARED_CREDENTIALS_FILE ||
            _opts.credentialsFile,
        );
        const config = parse(
          opts.configFile || ENV.AWS_CONFIG_FILE || _opts.configFile,
        );
        const _profile = opts.profile || ENV.AWS_PROFILE || _opts.profile;
        credentials[_profile] = credentials[_profile] || {};
        config[_profile] = config[_profile] || {};
        return {
          ...config[_profile],
          ...credentials[_profile],
          accessKeyId: ENV.AWS_ACCESS_KEY_ID ||
            credentials[_profile].accessKeyId ||
            config[_profile].accessKeyId,
          secretAccessKey: ENV.AWS_SECRET_ACCESS_KEY ||
            credentials[_profile].secretAccessKey ||
            config[_profile].secretAccessKey,
          sessionToken: ENV.AWS_SESSION_TOKEN ||
            credentials[_profile].sessionToken ||
            config[_profile].sessionToken,
          region: ENV.AWS_REGION ||
            ENV.AWS_DEFAULT_REGION ||
            config[_profile].region ||
            config[_profile].default_region ||
            credentials[_profile].region ||
            credentials[_profile].default_region,
        };
      }
      return {};
    }
    exports_4("get", get);
    return {
      setters: [],
      execute: function () {
        /** Home path. */
        HOME = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE") ?? "";
        /** Line delimiter. */
        NEW_LINE_REGEX = /\r?\n/;
        /** Named profile extractor. */
        PROFILE_REGEXP = /^\[\s*(?:profile)?\s*([^\s]*)\s*\].*$/i;
        /** Quote extractor. */
        QUOTE_REGEXP = /(^\s*["']?)|(["']?\s*$)/g;
        /** Shared decoder. */
        decoder = new TextDecoder();
      },
    };
  },
);
System.register(
  "https://raw.githubusercontent.com/chiefbiiko/sha1/v1.0.3/deps",
  ["https://raw.githubusercontent.com/chiefbiiko/std-encoding/v1.0.0/mod"],
  function (exports_5, context_5) {
    "use strict";
    var __moduleName = context_5 && context_5.id;
    return {
      setters: [
        function (mod_ts_1_1) {
          exports_5({
            "encode": mod_ts_1_1["encode"],
            "decode": mod_ts_1_1["decode"],
          });
        },
      ],
      execute: function () {
      },
    };
  },
);
System.register(
  "https://raw.githubusercontent.com/chiefbiiko/sha1/v1.0.3/mod",
  ["https://raw.githubusercontent.com/chiefbiiko/sha1/v1.0.3/deps"],
  function (exports_6, context_6) {
    "use strict";
    var deps_ts_1, BYTES, SHA1;
    var __moduleName = context_6 && context_6.id;
    function rotl(x, n) {
      return (x << n) | (x >>> (32 - n));
    }
    /** Generates a SHA1 hash of the input data. */
    function sha1(msg, inputEncoding, outputEncoding) {
      return new SHA1().update(msg, inputEncoding).digest(outputEncoding);
    }
    exports_6("sha1", sha1);
    return {
      setters: [
        function (deps_ts_1_1) {
          deps_ts_1 = deps_ts_1_1;
        },
      ],
      execute: function () {
        /** Byte length of a SHA1 digest. */
        exports_6("BYTES", BYTES = 20);
        /**  A class representation of the SHA1 algorithm. */
        SHA1 = class SHA1 {
          /** Creates a SHA1 instance. */
          constructor() {
            this.hashSize = BYTES;
            this._buf = new Uint8Array(64);
            this._K = new Uint32Array(
              [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6],
            );
            this.init();
          }
          /** Reduces the four input numbers to a single one. */
          static F(t, b, c, d) {
            if (t <= 19) {
              return (b & c) | (~b & d);
            } else if (t <= 39) {
              return b ^ c ^ d;
            } else if (t <= 59) {
              return (b & c) | (b & d) | (c & d);
            } else {
              return b ^ c ^ d;
            }
          }
          /** Initializes a hash instance. */
          init() {
            // prettier-ignore
            this._H = new Uint32Array([
              0x67452301,
              0xEFCDAB89,
              0x98BADCFE,
              0x10325476,
              0xC3D2E1F0,
            ]);
            this._bufIdx = 0;
            this._count = new Uint32Array(2);
            this._buf.fill(0);
            this._finalized = false;
            return this;
          }
          /** Updates a hash with additional message data. */
          update(msg, inputEncoding) {
            if (msg === null) {
              throw new TypeError("msg must be a string or Uint8Array.");
            } else if (typeof msg === "string") {
              msg = deps_ts_1.encode(msg, inputEncoding);
            }
            // process the msg as many times as possible, the rest is stored in the buffer
            // message is processed in 512 bit (64 byte chunks)
            for (let i = 0; i < msg.length; i++) {
              this._buf[this._bufIdx++] = msg[i];
              if (this._bufIdx === 64) {
                this.transform();
                this._bufIdx = 0;
              }
            }
            // counter update (number of message bits)
            const c = this._count;
            if ((c[0] += msg.length << 3) < msg.length << 3) {
              c[1]++;
            }
            c[1] += msg.length >>> 29;
            return this;
          }
          /** Finalizes a hash with additional message data. */
          digest(outputEncoding) {
            if (this._finalized) {
              throw new Error("digest has already been called.");
            }
            this._finalized = true;
            // append '1'
            const b = this._buf;
            let idx = this._bufIdx;
            b[idx++] = 0x80;
            // zeropad up to byte pos 56
            while (idx !== 56) {
              if (idx === 64) {
                this.transform();
                idx = 0;
              }
              b[idx++] = 0;
            }
            // append length in bits
            const c = this._count;
            b[56] = (c[1] >>> 24) & 0xff;
            b[57] = (c[1] >>> 16) & 0xff;
            b[58] = (c[1] >>> 8) & 0xff;
            b[59] = (c[1] >>> 0) & 0xff;
            b[60] = (c[0] >>> 24) & 0xff;
            b[61] = (c[0] >>> 16) & 0xff;
            b[62] = (c[0] >>> 8) & 0xff;
            b[63] = (c[0] >>> 0) & 0xff;
            this.transform();
            // return the hash as byte array (20 bytes)
            const hash = new Uint8Array(BYTES);
            for (let i = 0; i < 5; i++) {
              hash[(i << 2) + 0] = (this._H[i] >>> 24) & 0xff;
              hash[(i << 2) + 1] = (this._H[i] >>> 16) & 0xff;
              hash[(i << 2) + 2] = (this._H[i] >>> 8) & 0xff;
              hash[(i << 2) + 3] = (this._H[i] >>> 0) & 0xff;
            }
            // clear internal states and prepare for new hash
            this.init();
            return outputEncoding
              ? deps_ts_1.decode(hash, outputEncoding)
              : hash;
          }
          /** Performs one transformation cycle. */
          transform() {
            const h = this._H;
            let a = h[0];
            let b = h[1];
            let c = h[2];
            let d = h[3];
            let e = h[4];
            // convert byte buffer to words
            const w = new Uint32Array(80);
            for (let i = 0; i < 16; i++) {
              w[i] = this._buf[(i << 2) + 3] |
                (this._buf[(i << 2) + 2] << 8) |
                (this._buf[(i << 2) + 1] << 16) |
                (this._buf[i << 2] << 24);
            }
            for (let t = 0; t < 80; t++) {
              if (t >= 16) {
                w[t] = rotl(w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16], 1);
              }
              const tmp = (rotl(a, 5) +
                SHA1.F(t, b, c, d) +
                e +
                w[t] +
                this._K[Math.floor(t / 20)]) |
                0;
              e = d;
              d = c;
              c = rotl(b, 30);
              b = a;
              a = tmp;
            }
            h[0] = (h[0] + a) | 0;
            h[1] = (h[1] + b) | 0;
            h[2] = (h[2] + c) | 0;
            h[3] = (h[3] + d) | 0;
            h[4] = (h[4] + e) | 0;
          }
        };
        exports_6("SHA1", SHA1);
      },
    };
  },
);
System.register(
  "https://raw.githubusercontent.com/chiefbiiko/sha256/v1.0.2/deps",
  ["https://raw.githubusercontent.com/chiefbiiko/std-encoding/v1.0.0/mod"],
  function (exports_7, context_7) {
    "use strict";
    var __moduleName = context_7 && context_7.id;
    return {
      setters: [
        function (mod_ts_2_1) {
          exports_7({
            "encode": mod_ts_2_1["encode"],
            "decode": mod_ts_2_1["decode"],
          });
        },
      ],
      execute: function () {
      },
    };
  },
);
System.register(
  "https://raw.githubusercontent.com/chiefbiiko/sha256/v1.0.2/mod",
  ["https://raw.githubusercontent.com/chiefbiiko/sha256/v1.0.2/deps"],
  function (exports_8, context_8) {
    "use strict";
    var deps_ts_2, BYTES, SHA256;
    var __moduleName = context_8 && context_8.id;
    /** Generates a SHA256 hash of the input data. */
    function sha256(msg, inputEncoding, outputEncoding) {
      return new SHA256().update(msg, inputEncoding).digest(outputEncoding);
    }
    exports_8("sha256", sha256);
    return {
      setters: [
        function (deps_ts_2_1) {
          deps_ts_2 = deps_ts_2_1;
        },
      ],
      execute: function () {
        /** Byte length of a SHA256 hash. */
        exports_8("BYTES", BYTES = 32);
        /** A class representation of the SHA256 algorithm. */
        SHA256 = class SHA256 {
          /** Creates a SHA256 instance. */
          constructor() {
            this.hashSize = BYTES;
            this._buf = new Uint8Array(64);
            // prettier-ignore
            this._K = new Uint32Array([
              0x428a2f98,
              0x71374491,
              0xb5c0fbcf,
              0xe9b5dba5,
              0x3956c25b,
              0x59f111f1,
              0x923f82a4,
              0xab1c5ed5,
              0xd807aa98,
              0x12835b01,
              0x243185be,
              0x550c7dc3,
              0x72be5d74,
              0x80deb1fe,
              0x9bdc06a7,
              0xc19bf174,
              0xe49b69c1,
              0xefbe4786,
              0x0fc19dc6,
              0x240ca1cc,
              0x2de92c6f,
              0x4a7484aa,
              0x5cb0a9dc,
              0x76f988da,
              0x983e5152,
              0xa831c66d,
              0xb00327c8,
              0xbf597fc7,
              0xc6e00bf3,
              0xd5a79147,
              0x06ca6351,
              0x14292967,
              0x27b70a85,
              0x2e1b2138,
              0x4d2c6dfc,
              0x53380d13,
              0x650a7354,
              0x766a0abb,
              0x81c2c92e,
              0x92722c85,
              0xa2bfe8a1,
              0xa81a664b,
              0xc24b8b70,
              0xc76c51a3,
              0xd192e819,
              0xd6990624,
              0xf40e3585,
              0x106aa070,
              0x19a4c116,
              0x1e376c08,
              0x2748774c,
              0x34b0bcb5,
              0x391c0cb3,
              0x4ed8aa4a,
              0x5b9cca4f,
              0x682e6ff3,
              0x748f82ee,
              0x78a5636f,
              0x84c87814,
              0x8cc70208,
              0x90befffa,
              0xa4506ceb,
              0xbef9a3f7,
              0xc67178f2,
            ]);
            this.init();
          }
          /** Initializes a hash. */
          init() {
            // prettier-ignore
            this._H = new Uint32Array([
              0x6a09e667,
              0xbb67ae85,
              0x3c6ef372,
              0xa54ff53a,
              0x510e527f,
              0x9b05688c,
              0x1f83d9ab,
              0x5be0cd19,
            ]);
            this._bufIdx = 0;
            this._count = new Uint32Array(2);
            this._buf.fill(0);
            this._finalized = false;
            return this;
          }
          /** Updates the hash with additional message data. */
          update(msg, inputEncoding) {
            if (msg === null) {
              throw new TypeError("msg must be a string or Uint8Array.");
            } else if (typeof msg === "string") {
              msg = deps_ts_2.encode(msg, inputEncoding);
            }
            // process the msg as many times as possible, the rest is stored in the buffer
            // message is processed in 512 bit (64 byte chunks)
            for (let i = 0, len = msg.length; i < len; i++) {
              this._buf[this._bufIdx++] = msg[i];
              if (this._bufIdx === 64) {
                this._transform();
                this._bufIdx = 0;
              }
            }
            // counter update (number of message bits)
            const c = this._count;
            if ((c[0] += msg.length << 3) < msg.length << 3) {
              c[1]++;
            }
            c[1] += msg.length >>> 29;
            return this;
          }
          /** Finalizes the hash with additional message data. */
          digest(outputEncoding) {
            if (this._finalized) {
              throw new Error("digest has already been called.");
            }
            this._finalized = true;
            // append '1'
            const b = this._buf;
            let idx = this._bufIdx;
            b[idx++] = 0x80;
            // zeropad up to byte pos 56
            while (idx !== 56) {
              if (idx === 64) {
                this._transform();
                idx = 0;
              }
              b[idx++] = 0;
            }
            // append length in bits
            const c = this._count;
            b[56] = (c[1] >>> 24) & 0xff;
            b[57] = (c[1] >>> 16) & 0xff;
            b[58] = (c[1] >>> 8) & 0xff;
            b[59] = (c[1] >>> 0) & 0xff;
            b[60] = (c[0] >>> 24) & 0xff;
            b[61] = (c[0] >>> 16) & 0xff;
            b[62] = (c[0] >>> 8) & 0xff;
            b[63] = (c[0] >>> 0) & 0xff;
            this._transform();
            // return the hash as byte array
            const hash = new Uint8Array(BYTES);
            // let i: number;
            for (let i = 0; i < 8; i++) {
              hash[(i << 2) + 0] = (this._H[i] >>> 24) & 0xff;
              hash[(i << 2) + 1] = (this._H[i] >>> 16) & 0xff;
              hash[(i << 2) + 2] = (this._H[i] >>> 8) & 0xff;
              hash[(i << 2) + 3] = (this._H[i] >>> 0) & 0xff;
            }
            // clear internal states and prepare for new hash
            this.init();
            return outputEncoding
              ? deps_ts_2.decode(hash, outputEncoding)
              : hash;
          }
          /** Performs one transformation cycle. */
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
            // convert byte buffer into w[0..15]
            const w = new Uint32Array(16);
            let i;
            for (i = 0; i < 16; i++) {
              w[i] = this._buf[(i << 2) + 3] |
                (this._buf[(i << 2) + 2] << 8) |
                (this._buf[(i << 2) + 1] << 16) |
                (this._buf[i << 2] << 24);
            }
            for (i = 0; i < 64; i++) {
              let tmp;
              if (i < 16) {
                tmp = w[i];
              } else {
                let a = w[(i + 1) & 15];
                let b = w[(i + 14) & 15];
                tmp = w[i & 15] =
                  (((a >>> 7) ^ (a >>> 18) ^ (a >>> 3) ^ (a << 25) ^
                    (a << 14)) +
                    ((b >>> 17) ^ (b >>> 19) ^ (b >>> 10) ^ (b << 15) ^
                      (b << 13)) +
                    w[i & 15] +
                    w[(i + 9) & 15]) |
                  0;
              }
              tmp = (tmp +
                h7 +
                ((h4 >>> 6) ^
                  (h4 >>> 11) ^
                  (h4 >>> 25) ^
                  (h4 << 26) ^
                  (h4 << 21) ^
                  (h4 << 7)) +
                (h6 ^ (h4 & (h5 ^ h6))) +
                this._K[i]) |
                0;
              h7 = h6;
              h6 = h5;
              h5 = h4;
              h4 = h3 + tmp;
              h3 = h2;
              h2 = h1;
              h1 = h0;
              h0 = (tmp +
                ((h1 & h2) ^ (h3 & (h1 ^ h2))) +
                ((h1 >>> 2) ^
                  (h1 >>> 13) ^
                  (h1 >>> 22) ^
                  (h1 << 30) ^
                  (h1 << 19) ^
                  (h1 << 10))) |
                0;
            }
            h[0] = (h[0] + h0) | 0;
            h[1] = (h[1] + h1) | 0;
            h[2] = (h[2] + h2) | 0;
            h[3] = (h[3] + h3) | 0;
            h[4] = (h[4] + h4) | 0;
            h[5] = (h[5] + h5) | 0;
            h[6] = (h[6] + h6) | 0;
            h[7] = (h[7] + h7) | 0;
          }
        };
        exports_8("SHA256", SHA256);
      },
    };
  },
);
System.register(
  "https://raw.githubusercontent.com/chiefbiiko/sha512/v1.0.3/deps",
  ["https://raw.githubusercontent.com/chiefbiiko/std-encoding/v1.0.0/mod"],
  function (exports_9, context_9) {
    "use strict";
    var __moduleName = context_9 && context_9.id;
    return {
      setters: [
        function (mod_ts_3_1) {
          exports_9({
            "encode": mod_ts_3_1["encode"],
            "decode": mod_ts_3_1["decode"],
          });
        },
      ],
      execute: function () {
      },
    };
  },
);
System.register(
  "https://raw.githubusercontent.com/chiefbiiko/sha512/v1.0.3/mod",
  ["https://raw.githubusercontent.com/chiefbiiko/sha512/v1.0.3/deps"],
  function (exports_10, context_10) {
    "use strict";
    var deps_ts_3, BYTES, SHA512;
    var __moduleName = context_10 && context_10.id;
    /** Obtain a SHA512 hash of an utf8 encoded string or an Uint8Array. */
    function sha512(msg, inputEncoding, outputEncoding) {
      return new SHA512()
        .init()
        .update(msg, inputEncoding)
        .digest(outputEncoding);
    }
    exports_10("sha512", sha512);
    return {
      setters: [
        function (deps_ts_3_1) {
          deps_ts_3 = deps_ts_3_1;
        },
      ],
      execute: function () {
        /** Byte length of a SHA512 hash. */
        exports_10("BYTES", BYTES = 64);
        /** A class representation of the SHA2-512 algorithm. */
        SHA512 = class SHA512 {
          /** Creates a SHA512 instance. */
          constructor() {
            this.hashSize = BYTES;
            this._buffer = new Uint8Array(128);
            // prettier-ignore
            this._K = new Uint32Array([
              0x428a2f98,
              0xd728ae22,
              0x71374491,
              0x23ef65cd,
              0xb5c0fbcf,
              0xec4d3b2f,
              0xe9b5dba5,
              0x8189dbbc,
              0x3956c25b,
              0xf348b538,
              0x59f111f1,
              0xb605d019,
              0x923f82a4,
              0xaf194f9b,
              0xab1c5ed5,
              0xda6d8118,
              0xd807aa98,
              0xa3030242,
              0x12835b01,
              0x45706fbe,
              0x243185be,
              0x4ee4b28c,
              0x550c7dc3,
              0xd5ffb4e2,
              0x72be5d74,
              0xf27b896f,
              0x80deb1fe,
              0x3b1696b1,
              0x9bdc06a7,
              0x25c71235,
              0xc19bf174,
              0xcf692694,
              0xe49b69c1,
              0x9ef14ad2,
              0xefbe4786,
              0x384f25e3,
              0x0fc19dc6,
              0x8b8cd5b5,
              0x240ca1cc,
              0x77ac9c65,
              0x2de92c6f,
              0x592b0275,
              0x4a7484aa,
              0x6ea6e483,
              0x5cb0a9dc,
              0xbd41fbd4,
              0x76f988da,
              0x831153b5,
              0x983e5152,
              0xee66dfab,
              0xa831c66d,
              0x2db43210,
              0xb00327c8,
              0x98fb213f,
              0xbf597fc7,
              0xbeef0ee4,
              0xc6e00bf3,
              0x3da88fc2,
              0xd5a79147,
              0x930aa725,
              0x06ca6351,
              0xe003826f,
              0x14292967,
              0x0a0e6e70,
              0x27b70a85,
              0x46d22ffc,
              0x2e1b2138,
              0x5c26c926,
              0x4d2c6dfc,
              0x5ac42aed,
              0x53380d13,
              0x9d95b3df,
              0x650a7354,
              0x8baf63de,
              0x766a0abb,
              0x3c77b2a8,
              0x81c2c92e,
              0x47edaee6,
              0x92722c85,
              0x1482353b,
              0xa2bfe8a1,
              0x4cf10364,
              0xa81a664b,
              0xbc423001,
              0xc24b8b70,
              0xd0f89791,
              0xc76c51a3,
              0x0654be30,
              0xd192e819,
              0xd6ef5218,
              0xd6990624,
              0x5565a910,
              0xf40e3585,
              0x5771202a,
              0x106aa070,
              0x32bbd1b8,
              0x19a4c116,
              0xb8d2d0c8,
              0x1e376c08,
              0x5141ab53,
              0x2748774c,
              0xdf8eeb99,
              0x34b0bcb5,
              0xe19b48a8,
              0x391c0cb3,
              0xc5c95a63,
              0x4ed8aa4a,
              0xe3418acb,
              0x5b9cca4f,
              0x7763e373,
              0x682e6ff3,
              0xd6b2b8a3,
              0x748f82ee,
              0x5defb2fc,
              0x78a5636f,
              0x43172f60,
              0x84c87814,
              0xa1f0ab72,
              0x8cc70208,
              0x1a6439ec,
              0x90befffa,
              0x23631e28,
              0xa4506ceb,
              0xde82bde9,
              0xbef9a3f7,
              0xb2c67915,
              0xc67178f2,
              0xe372532b,
              0xca273ece,
              0xea26619c,
              0xd186b8c7,
              0x21c0c207,
              0xeada7dd6,
              0xcde0eb1e,
              0xf57d4f7f,
              0xee6ed178,
              0x06f067aa,
              0x72176fba,
              0x0a637dc5,
              0xa2c898a6,
              0x113f9804,
              0xbef90dae,
              0x1b710b35,
              0x131c471b,
              0x28db77f5,
              0x23047d84,
              0x32caab7b,
              0x40c72493,
              0x3c9ebe0a,
              0x15c9bebc,
              0x431d67c4,
              0x9c100d4c,
              0x4cc5d4be,
              0xcb3e42b6,
              0x597f299c,
              0xfc657e2a,
              0x5fcb6fab,
              0x3ad6faec,
              0x6c44198c,
              0x4a475817,
            ]);
            this.init();
          }
          /** Initializes a SHA512 instance. */
          init() {
            // prettier-ignore
            this._H = new Uint32Array([
              0x6a09e667,
              0xf3bcc908,
              0xbb67ae85,
              0x84caa73b,
              0x3c6ef372,
              0xfe94f82b,
              0xa54ff53a,
              0x5f1d36f1,
              0x510e527f,
              0xade682d1,
              0x9b05688c,
              0x2b3e6c1f,
              0x1f83d9ab,
              0xfb41bd6b,
              0x5be0cd19,
              0x137e2179,
            ]);
            this._bufferIndex = 0;
            this._count = new Uint32Array(2);
            this._buffer.fill(0);
            this._finalized = false;
            return this;
          }
          /** Updates the hash with additional message data. */
          update(msg, inputEncoding) {
            if (msg === null) {
              throw new TypeError("msg must be a string or Uint8Array.");
            } else if (typeof msg === "string") {
              msg = deps_ts_3.encode(msg, inputEncoding);
            }
            // process the msg as many times as possible, the rest is stored in the
            // buffer; message is processed in 1024 bit (128 byte chunks)
            for (let i = 0; i < msg.length; i++) {
              this._buffer[this._bufferIndex++] = msg[i];
              if (this._bufferIndex === 128) {
                this.transform();
                this._bufferIndex = 0;
              }
            }
            // counter update (number of message bits)
            let c = this._count;
            if ((c[0] += msg.length << 3) < msg.length << 3) {
              c[1]++;
            }
            c[1] += msg.length >>> 29;
            return this;
          }
          /** Finalizes the hash with additional message data. */
          digest(outputEncoding) {
            if (this._finalized) {
              throw new Error("digest has already been called.");
            }
            this._finalized = true;
            // append '1'
            var b = this._buffer, idx = this._bufferIndex;
            b[idx++] = 0x80;
            // zeropad up to byte pos 112
            while (idx !== 112) {
              if (idx === 128) {
                this.transform();
                idx = 0;
              }
              b[idx++] = 0;
            }
            // append length in bits
            let c = this._count;
            b[112] = b[113] = b[114] = b[115] = b[116] = b[117] = b[118] =
              b[119] = 0;
            b[120] = (c[1] >>> 24) & 0xff;
            b[121] = (c[1] >>> 16) & 0xff;
            b[122] = (c[1] >>> 8) & 0xff;
            b[123] = (c[1] >>> 0) & 0xff;
            b[124] = (c[0] >>> 24) & 0xff;
            b[125] = (c[0] >>> 16) & 0xff;
            b[126] = (c[0] >>> 8) & 0xff;
            b[127] = (c[0] >>> 0) & 0xff;
            this.transform();
            // return the hash as byte array
            let i, hash = new Uint8Array(64);
            for (i = 0; i < 16; i++) {
              hash[(i << 2) + 0] = (this._H[i] >>> 24) & 0xff;
              hash[(i << 2) + 1] = (this._H[i] >>> 16) & 0xff;
              hash[(i << 2) + 2] = (this._H[i] >>> 8) & 0xff;
              hash[(i << 2) + 3] = this._H[i] & 0xff;
            }
            // clear internal states and prepare for new hash
            this.init();
            return outputEncoding
              ? deps_ts_3.decode(hash, outputEncoding)
              : hash;
          }
          /** Performs one transformation cycle. */
          transform() {
            let h = this._H,
              h0h = h[0],
              h0l = h[1],
              h1h = h[2],
              h1l = h[3],
              h2h = h[4],
              h2l = h[5],
              h3h = h[6],
              h3l = h[7],
              h4h = h[8],
              h4l = h[9],
              h5h = h[10],
              h5l = h[11],
              h6h = h[12],
              h6l = h[13],
              h7h = h[14],
              h7l = h[15];
            let ah = h0h,
              al = h0l,
              bh = h1h,
              bl = h1l,
              ch = h2h,
              cl = h2l,
              dh = h3h,
              dl = h3l,
              eh = h4h,
              el = h4l,
              fh = h5h,
              fl = h5l,
              gh = h6h,
              gl = h6l,
              hh = h7h,
              hl = h7l;
            // convert byte buffer into w[0..31]
            let i, w = new Uint32Array(160);
            for (i = 0; i < 32; i++) {
              w[i] = this._buffer[(i << 2) + 3] |
                (this._buffer[(i << 2) + 2] << 8) |
                (this._buffer[(i << 2) + 1] << 16) |
                (this._buffer[i << 2] << 24);
            }
            // fill w[32..159]
            let gamma0xl,
              gamma0xh,
              gamma0l,
              gamma0h,
              gamma1xl,
              gamma1xh,
              gamma1l,
              gamma1h,
              wrl,
              wrh,
              wr7l,
              wr7h,
              wr16l,
              wr16h;
            for (i = 16; i < 80; i++) {
              // Gamma0
              gamma0xh = w[(i - 15) * 2];
              gamma0xl = w[(i - 15) * 2 + 1];
              gamma0h = ((gamma0xl << 31) | (gamma0xh >>> 1)) ^
                ((gamma0xl << 24) | (gamma0xh >>> 8)) ^
                (gamma0xh >>> 7);
              gamma0l = ((gamma0xh << 31) | (gamma0xl >>> 1)) ^
                ((gamma0xh << 24) | (gamma0xl >>> 8)) ^
                ((gamma0xh << 25) | (gamma0xl >>> 7));
              // Gamma1
              gamma1xh = w[(i - 2) * 2];
              gamma1xl = w[(i - 2) * 2 + 1];
              gamma1h = ((gamma1xl << 13) | (gamma1xh >>> 19)) ^
                ((gamma1xh << 3) | (gamma1xl >>> 29)) ^
                (gamma1xh >>> 6);
              gamma1l = ((gamma1xh << 13) | (gamma1xl >>> 19)) ^
                ((gamma1xl << 3) | (gamma1xh >>> 29)) ^
                ((gamma1xh << 26) | (gamma1xl >>> 6));
              // shortcuts
              (wr7h = w[(i - 7) * 2]),
                (wr7l = w[(i - 7) * 2 + 1]),
                (wr16h = w[(i - 16) * 2]),
                (wr16l = w[(i - 16) * 2 + 1]);
              // W(round) = gamma0 + W(round - 7) + gamma1 + W(round - 16)
              wrl = gamma0l + wr7l;
              wrh = gamma0h + wr7h + (wrl >>> 0 < gamma0l >>> 0 ? 1 : 0);
              wrl += gamma1l;
              wrh += gamma1h + (wrl >>> 0 < gamma1l >>> 0 ? 1 : 0);
              wrl += wr16l;
              wrh += wr16h + (wrl >>> 0 < wr16l >>> 0 ? 1 : 0);
              // store
              w[i * 2] = wrh;
              w[i * 2 + 1] = wrl;
            }
            // compress
            let chl,
              chh,
              majl,
              majh,
              sig0l,
              sig0h,
              sig1l,
              sig1h,
              krl,
              krh,
              t1l,
              t1h,
              t2l,
              t2h;
            for (i = 0; i < 80; i++) {
              // Ch
              chh = (eh & fh) ^ (~eh & gh);
              chl = (el & fl) ^ (~el & gl);
              // Maj
              majh = (ah & bh) ^ (ah & ch) ^ (bh & ch);
              majl = (al & bl) ^ (al & cl) ^ (bl & cl);
              // Sigma0
              sig0h = ((al << 4) | (ah >>> 28)) ^
                ((ah << 30) | (al >>> 2)) ^
                ((ah << 25) | (al >>> 7));
              sig0l = ((ah << 4) | (al >>> 28)) ^
                ((al << 30) | (ah >>> 2)) ^
                ((al << 25) | (ah >>> 7));
              // Sigma1
              sig1h = ((el << 18) | (eh >>> 14)) ^
                ((el << 14) | (eh >>> 18)) ^
                ((eh << 23) | (el >>> 9));
              sig1l = ((eh << 18) | (el >>> 14)) ^
                ((eh << 14) | (el >>> 18)) ^
                ((el << 23) | (eh >>> 9));
              // K(round)
              krh = this._K[i * 2];
              krl = this._K[i * 2 + 1];
              // t1 = h + sigma1 + ch + K(round) + W(round)
              t1l = hl + sig1l;
              t1h = hh + sig1h + (t1l >>> 0 < hl >>> 0 ? 1 : 0);
              t1l += chl;
              t1h += chh + (t1l >>> 0 < chl >>> 0 ? 1 : 0);
              t1l += krl;
              t1h += krh + (t1l >>> 0 < krl >>> 0 ? 1 : 0);
              t1l = t1l + w[i * 2 + 1];
              t1h += w[i * 2] + (t1l >>> 0 < w[i * 2 + 1] >>> 0 ? 1 : 0);
              // t2 = sigma0 + maj
              t2l = sig0l + majl;
              t2h = sig0h + majh + (t2l >>> 0 < sig0l >>> 0 ? 1 : 0);
              // update working variables
              hh = gh;
              hl = gl;
              gh = fh;
              gl = fl;
              fh = eh;
              fl = el;
              el = (dl + t1l) | 0;
              eh = (dh + t1h + (el >>> 0 < dl >>> 0 ? 1 : 0)) | 0;
              dh = ch;
              dl = cl;
              ch = bh;
              cl = bl;
              bh = ah;
              bl = al;
              al = (t1l + t2l) | 0;
              ah = (t1h + t2h + (al >>> 0 < t1l >>> 0 ? 1 : 0)) | 0;
            }
            // intermediate hash
            h0l = h[1] = (h0l + al) | 0;
            h[0] = (h0h + ah + (h0l >>> 0 < al >>> 0 ? 1 : 0)) | 0;
            h1l = h[3] = (h1l + bl) | 0;
            h[2] = (h1h + bh + (h1l >>> 0 < bl >>> 0 ? 1 : 0)) | 0;
            h2l = h[5] = (h2l + cl) | 0;
            h[4] = (h2h + ch + (h2l >>> 0 < cl >>> 0 ? 1 : 0)) | 0;
            h3l = h[7] = (h3l + dl) | 0;
            h[6] = (h3h + dh + (h3l >>> 0 < dl >>> 0 ? 1 : 0)) | 0;
            h4l = h[9] = (h4l + el) | 0;
            h[8] = (h4h + eh + (h4l >>> 0 < el >>> 0 ? 1 : 0)) | 0;
            h5l = h[11] = (h5l + fl) | 0;
            h[10] = (h5h + fh + (h5l >>> 0 < fl >>> 0 ? 1 : 0)) | 0;
            h6l = h[13] = (h6l + gl) | 0;
            h[12] = (h6h + gh + (h6l >>> 0 < gl >>> 0 ? 1 : 0)) | 0;
            h7l = h[15] = (h7l + hl) | 0;
            h[14] = (h7h + hh + (h7l >>> 0 < hl >>> 0 ? 1 : 0)) | 0;
          }
        };
        exports_10("SHA512", SHA512);
      },
    };
  },
);
System.register(
  "https://raw.githubusercontent.com/chiefbiiko/hmac/v1.0.2/deps",
  [
    "https://raw.githubusercontent.com/chiefbiiko/sha1/v1.0.3/mod",
    "https://raw.githubusercontent.com/chiefbiiko/sha256/v1.0.2/mod",
    "https://raw.githubusercontent.com/chiefbiiko/sha512/v1.0.3/mod",
    "https://raw.githubusercontent.com/chiefbiiko/std-encoding/v1.0.0/mod",
  ],
  function (exports_11, context_11) {
    "use strict";
    var __moduleName = context_11 && context_11.id;
    return {
      setters: [
        function (mod_ts_4_1) {
          exports_11({
            "SHA1": mod_ts_4_1["SHA1"],
          });
        },
        function (mod_ts_5_1) {
          exports_11({
            "SHA256": mod_ts_5_1["SHA256"],
          });
        },
        function (mod_ts_6_1) {
          exports_11({
            "SHA512": mod_ts_6_1["SHA512"],
          });
        },
        function (mod_ts_7_1) {
          exports_11({
            "encode": mod_ts_7_1["encode"],
          });
        },
      ],
      execute: function () {
      },
    };
  },
);
System.register(
  "https://raw.githubusercontent.com/chiefbiiko/hmac/v1.0.2/mod",
  ["https://raw.githubusercontent.com/chiefbiiko/hmac/v1.0.2/deps"],
  function (exports_12, context_12) {
    "use strict";
    var deps_ts_4, SHA1_REGEX, SHA256_REGEX, SHA512_REGEX, HMAC;
    var __moduleName = context_12 && context_12.id;
    /** Returns a HMAC of the given msg and key using the indicated hash. */
    function hmac(hash, key, msg, inputEncoding, outputEncoding) {
      if (SHA1_REGEX.test(hash)) {
        return new HMAC(new deps_ts_4.SHA1())
          .init(key, inputEncoding)
          .update(msg, inputEncoding)
          .digest(outputEncoding);
      } else if (SHA256_REGEX.test(hash)) {
        return new HMAC(new deps_ts_4.SHA256())
          .init(key, inputEncoding)
          .update(msg, inputEncoding)
          .digest(outputEncoding);
      } else if (SHA512_REGEX.test(hash)) {
        return new HMAC(new deps_ts_4.SHA512())
          .init(key, inputEncoding)
          .update(msg, inputEncoding)
          .digest(outputEncoding);
      } else {
        throw new TypeError(
          `Unsupported hash ${hash}. Must be one of SHA(1|256|512).`,
        );
      }
    }
    exports_12("hmac", hmac);
    return {
      setters: [
        function (deps_ts_4_1) {
          deps_ts_4 = deps_ts_4_1;
        },
      ],
      execute: function () {
        SHA1_REGEX = /^\s*sha-?1\s*$/i;
        SHA256_REGEX = /^\s*sha-?256\s*$/i;
        SHA512_REGEX = /^\s*sha-?512\s*$/i;
        /** A class representation of the HMAC algorithm. */
        HMAC = class HMAC {
          /** Creates a new HMAC instance. */
          constructor(hasher, key) {
            this.hashSize = hasher.hashSize;
            this.hasher = hasher;
            this.B = this.hashSize <= 32 ? 64 : 128; // according to RFC4868
            this.iPad = 0x36;
            this.oPad = 0x5c;
            if (key) {
              this.init(key);
            }
          }
          /** Initializes an HMAC instance. */
          init(key, inputEncoding) {
            if (!key) {
              key = new Uint8Array(0);
            } else if (typeof key === "string") {
              key = deps_ts_4.encode(key, inputEncoding);
            }
            // process the key
            let _key = new Uint8Array(key);
            if (_key.length > this.B) {
              // keys longer than blocksize are shortened
              this.hasher.init();
              _key = this.hasher.update(key).digest();
            }
            // zeropadr
            if (_key.byteLength < this.B) {
              const tmp = new Uint8Array(this.B);
              tmp.set(_key, 0);
              _key = tmp;
            }
            // setup the key pads
            this.iKeyPad = new Uint8Array(this.B);
            this.oKeyPad = new Uint8Array(this.B);
            for (let i = 0; i < this.B; ++i) {
              this.iKeyPad[i] = this.iPad ^ _key[i];
              this.oKeyPad[i] = this.oPad ^ _key[i];
            }
            // blackout key
            _key.fill(0);
            // initial hash
            this.hasher.init();
            this.hasher.update(this.iKeyPad);
            return this;
          }
          /** Update the HMAC with additional message data. */
          update(msg = new Uint8Array(0), inputEncoding) {
            if (typeof msg === "string") {
              msg = deps_ts_4.encode(msg, inputEncoding);
            }
            this.hasher.update(msg);
            return this;
          }
          /** Finalize the HMAC with additional message data. */
          digest(outputEncoding) {
            const sum1 = this.hasher.digest(); // get sum 1
            this.hasher.init();
            return this.hasher
              .update(this.oKeyPad)
              .update(sum1)
              .digest(outputEncoding);
          }
        };
        exports_12("HMAC", HMAC);
      },
    };
  },
);
System.register(
  "https://deno.land/x/base64@v0.2.0/base",
  [],
  function (exports_13, context_13) {
    "use strict";
    var __moduleName = context_13 && context_13.id;
    function getLengths(b64) {
      const len = b64.length;
      if (len % 4 > 0) {
        throw new TypeError("Invalid string. Length must be a multiple of 4");
      }
      // Trim off extra bytes after placeholder bytes are found
      // See: https://github.com/beatgammit/base64-js/issues/42
      let validLen = b64.indexOf("=");
      if (validLen === -1) {
        validLen = len;
      }
      const placeHoldersLen = validLen === len ? 0 : 4 - (validLen % 4);
      return [validLen, placeHoldersLen];
    }
    function init(lookup, revLookup) {
      function _byteLength(validLen, placeHoldersLen) {
        return ((validLen + placeHoldersLen) * 3) / 4 - placeHoldersLen;
      }
      function tripletToBase64(num) {
        return (lookup[(num >> 18) & 0x3f] +
          lookup[(num >> 12) & 0x3f] +
          lookup[(num >> 6) & 0x3f] +
          lookup[num & 0x3f]);
      }
      function encodeChunk(buf, start, end) {
        const out = new Array((end - start) / 3);
        for (let i = start, curTriplet = 0; i < end; i += 3) {
          out[curTriplet++] = tripletToBase64(
            (buf[i] << 16) + (buf[i + 1] << 8) + buf[i + 2],
          );
        }
        return out.join("");
      }
      return {
        // base64 is 4/3 + up to two characters of the original data
        byteLength(b64) {
          return _byteLength.apply(null, getLengths(b64));
        },
        toUint8Array(b64) {
          const [validLen, placeHoldersLen] = getLengths(b64);
          const buf = new Uint8Array(_byteLength(validLen, placeHoldersLen));
          // If there are placeholders, only get up to the last complete 4 chars
          const len = placeHoldersLen ? validLen - 4 : validLen;
          let tmp;
          let curByte = 0;
          let i;
          for (i = 0; i < len; i += 4) {
            tmp = (revLookup[b64.charCodeAt(i)] << 18) |
              (revLookup[b64.charCodeAt(i + 1)] << 12) |
              (revLookup[b64.charCodeAt(i + 2)] << 6) |
              revLookup[b64.charCodeAt(i + 3)];
            buf[curByte++] = (tmp >> 16) & 0xff;
            buf[curByte++] = (tmp >> 8) & 0xff;
            buf[curByte++] = tmp & 0xff;
          }
          if (placeHoldersLen === 2) {
            tmp = (revLookup[b64.charCodeAt(i)] << 2) |
              (revLookup[b64.charCodeAt(i + 1)] >> 4);
            buf[curByte++] = tmp & 0xff;
          } else if (placeHoldersLen === 1) {
            tmp = (revLookup[b64.charCodeAt(i)] << 10) |
              (revLookup[b64.charCodeAt(i + 1)] << 4) |
              (revLookup[b64.charCodeAt(i + 2)] >> 2);
            buf[curByte++] = (tmp >> 8) & 0xff;
            buf[curByte++] = tmp & 0xff;
          }
          return buf;
        },
        fromUint8Array(buf) {
          const maxChunkLength = 16383; // Must be multiple of 3
          const len = buf.length;
          const extraBytes = len % 3; // If we have 1 byte left, pad 2 bytes
          const len2 = len - extraBytes;
          const parts = new Array(
            Math.ceil(len2 / maxChunkLength) + (extraBytes ? 1 : 0),
          );
          let curChunk = 0;
          let chunkEnd;
          // Go through the array every three bytes, we'll deal with trailing stuff later
          for (let i = 0; i < len2; i += maxChunkLength) {
            chunkEnd = i + maxChunkLength;
            parts[curChunk++] = encodeChunk(
              buf,
              i,
              chunkEnd > len2 ? len2 : chunkEnd,
            );
          }
          let tmp;
          // Pad the end with zeros, but make sure to not forget the extra bytes
          if (extraBytes === 1) {
            tmp = buf[len2];
            parts[curChunk] = lookup[tmp >> 2] + lookup[(tmp << 4) & 0x3f] +
              "==";
          } else if (extraBytes === 2) {
            tmp = (buf[len2] << 8) | (buf[len2 + 1] & 0xff);
            parts[curChunk] = lookup[tmp >> 10] +
              lookup[(tmp >> 4) & 0x3f] +
              lookup[(tmp << 2) & 0x3f] +
              "=";
          }
          return parts.join("");
        },
      };
    }
    exports_13("init", init);
    return {
      setters: [],
      execute: function () {
      },
    };
  },
);
System.register(
  "https://deno.land/x/base64@v0.2.0/mod",
  ["https://deno.land/x/base64@v0.2.0/base"],
  function (exports_14, context_14) {
    "use strict";
    var base_ts_2,
      lookup,
      revLookup,
      code,
      mod,
      byteLength,
      toUint8Array,
      fromUint8Array;
    var __moduleName = context_14 && context_14.id;
    return {
      setters: [
        function (base_ts_2_1) {
          base_ts_2 = base_ts_2_1;
        },
      ],
      execute: function () {
        lookup = [];
        revLookup = [];
        code =
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        for (let i = 0, l = code.length; i < l; ++i) {
          lookup[i] = code[i];
          revLookup[code.charCodeAt(i)] = i;
        }
        // Support decoding URL-safe base64 strings, as Node.js does.
        // See: https://en.wikipedia.org/wiki/Base64#URL_applications
        revLookup["-".charCodeAt(0)] = 62;
        revLookup["_".charCodeAt(0)] = 63;
        mod = base_ts_2.init(lookup, revLookup);
        exports_14("byteLength", byteLength = mod.byteLength);
        exports_14("toUint8Array", toUint8Array = mod.toUint8Array);
        exports_14("fromUint8Array", fromUint8Array = mod.fromUint8Array);
      },
    };
  },
);
System.register(
  "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/deps",
  [
    "https://raw.githubusercontent.com/chiefbiiko/std-encoding/v1.0.0/mod",
    "https://raw.githubusercontent.com/chiefbiiko/get-aws-config/v1.0.1/mod",
    "https://raw.githubusercontent.com/chiefbiiko/hmac/v1.0.2/mod",
    "https://deno.land/x/base64@v0.2.0/mod",
    "https://raw.githubusercontent.com/chiefbiiko/sha256/v1.0.2/mod",
  ],
  function (exports_15, context_15) {
    "use strict";
    var __moduleName = context_15 && context_15.id;
    return {
      setters: [
        function (mod_ts_8_1) {
          exports_15({
            "encode": mod_ts_8_1["encode"],
            "decode": mod_ts_8_1["decode"],
          });
        },
        function (mod_ts_9_1) {
          exports_15({
            "get": mod_ts_9_1["get"],
          });
        },
        function (mod_ts_10_1) {
          exports_15({
            "hmac": mod_ts_10_1["hmac"],
          });
        },
        function (mod_ts_11_1) {
          exports_15({
            "base64ToUint8Array": mod_ts_11_1["toUint8Array"],
            "base64FromUint8Array": mod_ts_11_1["fromUint8Array"],
          });
        },
        function (mod_ts_12_1) {
          exports_15({
            "sha256": mod_ts_12_1["sha256"],
          });
        },
      ],
      execute: function () {
      },
    };
  },
);
System.register(
  "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/util",
  [],
  function (exports_16, context_16) {
    "use strict";
    var ANY_BUT_DIGITS,
      ANY_BUT_DIGITS_T,
      memberTypeToSetType,
      DynamoDBSet,
      DynamoDBNumberValue,
      date;
    var __moduleName = context_16 && context_16.id;
    /** noop. */
    function noop(..._) {}
    exports_16("noop", noop);
    /** camelCase */
    function camelCase(text) {
      return `${text[0].toLowerCase()}${text.slice(1)}`;
    }
    exports_16("camelCase", camelCase);
    /** Defines a property. */
    function property(obj, name, value, enumerable, isValue) {
      const opts = {
        configurable: true,
        enumerable: typeof enumerable === "boolean" ? enumerable : true,
      };
      if (typeof value === "function" && !isValue) {
        opts.get = value;
      } else {
        opts.value = value;
        opts.writable = true;
      }
      Object.defineProperty(obj, name, opts);
    }
    exports_16("property", property);
    /** Defines a memoized property. */
    function memoizedProperty(obj, name, get, enumerable) {
      let cachedValue = null;
      // build enumerable attribute for each value with lazy accessor.
      property(obj, name, () => {
        if (cachedValue === null) {
          cachedValue = get();
        }
        return cachedValue;
      }, enumerable);
    }
    exports_16("memoizedProperty", memoizedProperty);
    /** aws typeof impl. */
    function typeOf(data) {
      if (data === null && typeof data === "object") {
        return "null";
      } else if (data !== undefined && isBinary(data)) {
        return "Binary";
      } else if (data !== undefined && data.constructor) {
        return data.wrapperName || data.constructor.name;
      } else if (data !== undefined && typeof data === "object") {
        // this object is the result of Object.create(null), hence the absence of a
        // defined constructor
        return "Object";
      } else {
        return "undefined";
      }
    }
    exports_16("typeOf", typeOf);
    /** Is given value a binary type? */
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
      // if (util.isNode()) {
      //   var Stream = util.stream.Stream;
      //   if (util.Buffer.isBuffer(data) || data instanceof Stream) {
      //     return true;
      //   }
      // }
      // var isType = (obj, type) => Object.prototype.toString.call(obj) === '[object ' + type + ']';
      if (data !== undefined && data.constructor) {
        // console.error(">>>>>>>>>> isBinary data", data)
        //  for (let i: number = 0; i < types.length; i++) {
        //
        //   // if (util.isType(data, types[i])) return true;
        //   if (data.constructor.name === types[i]) {
        //     // console.error(">>>> isBinary TRUE", data)
        //     return true;
        //   }
        //   // if(isType(data, types[i])) {
        //   //   return true
        //   // }
        //
        // }
        return types.some((type) => data.constructor.name === type);
      }
      return false;
    }
    return {
      setters: [],
      execute: function () {
        ANY_BUT_DIGITS = /[^\d]/g;
        ANY_BUT_DIGITS_T = /[^\dT]/g;
        /** Mapping member to set type. */
        memberTypeToSetType = {
          String: "String",
          Number: "Number",
          NumberValue: "Number",
          Binary: "Binary",
        };
        /** DynamoDB set type. */
        DynamoDBSet = class DynamoDBSet {
          /** Creates a dynamodb set. */
          constructor(list = [], options = {}) {
            this.wrappername = "Set";
            this.values = [];
            this.type = "";
            Array.prototype.push.apply(this.values, list);
            this.type = memberTypeToSetType[typeOf(this.values[0])];
            if (!this.type) {
              throw new Error(
                "DynamoDB sets can only contain string, number, or binary values",
              );
            }
            if (options.validate) {
              for (const value of this.values) {
                if (memberTypeToSetType[typeOf(value)] !== this.type) {
                  throw new Error(
                    `${this.type} Set contains ${typeOf(value)} value`,
                  );
                }
              }
            }
          }
          /** Renders the underlying values only when converting to JSON. */
          toJSON() {
            return this.values;
          }
        };
        exports_16("DynamoDBSet", DynamoDBSet);
        /**
             * An object recognizable as a numeric value that stores the underlying number
             * as a string.
             *
             * Intended to be a deserialization target for the DynamoDB Doc Client when
             * the `wrapNumbers` flag is set. This allows for numeric values that lose
             * precision when converted to JavaScript's `number` type.
             */
        DynamoDBNumberValue = class DynamoDBNumberValue {
          /** Creates a dynamodb number value. */
          constructor(value) {
            this.wrapperName = "NumberValue";
            this.value = value.toString();
          }
          /** Renders the underlying value as a number when converting to JSON. */
          toJSON() {
            return this.toNumber();
          }
          /** Converts the underlying value to a JavaScript number. */
          toNumber() {
            return Number(this.value);
          }
          /** Returns a decimal string representing the number value. */
          toString() {
            return this.value;
          }
        };
        exports_16("DynamoDBNumberValue", DynamoDBNumberValue);
        /** Date format helpers. */
        exports_16(
          "date",
          date = {
            /** Date stamp format as expected by awsSignatureV4KDF. */
            DATE_STAMP_REGEX: /^\d{8}$/,
            amz(date) {
              return `${
                date
                  .toISOString()
                  .slice(0, 19)
                  .replace(ANY_BUT_DIGITS_T, "")
              }Z`;
            },
            dateStamp(date) {
              return date
                .toISOString()
                .slice(0, 10)
                .replace(ANY_BUT_DIGITS, "");
            },
            from(date) {
              if (typeof date === "number") {
                return new Date(date * 1000); // unix timestamp
              } else {
                return new Date(date);
              }
            },
            iso8601(date = new Date()) {
              return date.toISOString().replace(/\.\d{3}Z$/, "Z");
            },
            rfc822(date = new Date()) {
              return date.toUTCString();
            },
            unixTimestamp(date = new Date()) {
              return date.getTime() / 1000;
            },
            /** Valid formats are: iso8601, rfc822, unixTimestamp, dateStamp, amz. */
            format(date, formatter = "iso8601") {
              return this[formatter](this.from(date));
            },
            parseTimestamp(value) {
              if (typeof value === "number") {
                // unix timestamp (number)
                return new Date(value * 1000);
              } else if (value.match(/^\d+$/)) {
                // unix timestamp
                return new Date(Number(value) * 1000);
              } else if (value.match(/^\d{4}/)) {
                // iso8601
                return new Date(value);
              } else if (value.match(/^\w{3},/)) {
                // rfc822
                return new Date(value);
              } else {
                throw new Error(`unhandled timestamp format: ${value}`);
              }
            },
          },
        );
      },
    };
  },
);
System.register(
  "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/client/aws_signature_v4",
  [
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/deps",
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/util",
  ],
  function (exports_17, context_17) {
    "use strict";
    var deps_ts_5, util_ts_1, AWS4;
    var __moduleName = context_17 && context_17.id;
    /** Creates a HMAC-SHA256 mac.*/
    function awsSignatureV4(key, msg, outputEncoding) {
      return deps_ts_5.hmac("sha256", key, msg, undefined, outputEncoding);
    }
    exports_17("awsSignatureV4", awsSignatureV4);
    /** Creates a key for generating an aws signature version 4. */
    function kdf(
      key,
      dateStamp,
      region,
      service,
      keyInputEncoding,
      outputEncoding,
    ) {
      if (typeof key === "string") {
        key = deps_ts_5.encode(key, keyInputEncoding);
      }
      if (typeof dateStamp !== "string") {
        dateStamp = util_ts_1.date.format(dateStamp, "dateStamp");
      } else if (!util_ts_1.date.DATE_STAMP_REGEX.test(dateStamp)) {
        throw new TypeError("date stamp format must be yyyymmdd");
      }
      const paddedKey = new Uint8Array(4 + key.byteLength);
      paddedKey.set(AWS4, 0);
      paddedKey.set(key, 4);
      let mac = deps_ts_5.hmac("sha256", paddedKey, dateStamp, "utf8");
      mac = deps_ts_5.hmac("sha256", mac, region, "utf8");
      mac = deps_ts_5.hmac("sha256", mac, service, "utf8");
      mac = deps_ts_5.hmac("sha256", mac, "aws4_request", "utf8");
      return outputEncoding ? deps_ts_5.decode(mac, outputEncoding) : mac;
    }
    exports_17("kdf", kdf);
    return {
      setters: [
        function (deps_ts_5_1) {
          deps_ts_5 = deps_ts_5_1;
        },
        function (util_ts_1_1) {
          util_ts_1 = util_ts_1_1;
        },
      ],
      execute: function () {
        /** Some magic bytes. */
        AWS4 = deps_ts_5.encode("AWS4", "utf8");
      },
    };
  },
);
System.register(
  "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/client/create_headers",
  [
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/deps",
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/client/aws_signature_v4",
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/util",
  ],
  function (exports_18, context_18) {
    "use strict";
    var deps_ts_6, aws_signature_v4_ts_1, util_ts_2, ALGORITHM, CONTENT_TYPE;
    var __moduleName = context_18 && context_18.id;
    /** Assembles a header object for a DynamoDB request. */
    async function createHeaders(
      op,
      payload,
      conf,
      refreshCredentials = !conf.cache.signingKey,
    ) {
      if (refreshCredentials) {
        await conf.cache.refresh();
      }
      const amzTarget = `DynamoDB_20120810.${op}`;
      const amzDate = util_ts_2.date.format(conf.date || new Date(), "amz");
      const canonicalUri = conf.canonicalUri || "/";
      const canonicalHeaders =
        `content-type:${CONTENT_TYPE}\nhost:${conf.host}\nx-amz-date:${amzDate}\nx-amz-target:${amzTarget}\n`;
      const signedHeaders = "content-type;host;x-amz-date;x-amz-target";
      const payloadHash = deps_ts_6.sha256(payload, undefined, "hex");
      const canonicalRequest =
        `${conf.method}\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
      const canonicalRequestDigest = deps_ts_6.sha256(
        canonicalRequest,
        "utf8",
        "hex",
      );
      const msg = deps_ts_6.encode(
        `${ALGORITHM}\n${amzDate}\n${conf.cache.credentialScope}\n${canonicalRequestDigest}`,
        "utf8",
      );
      const signature = aws_signature_v4_ts_1.awsSignatureV4(
        conf.cache.signingKey,
        msg,
        "hex",
      );
      const authorizationHeader =
        `${ALGORITHM} Credential=${conf.cache.accessKeyId}/${conf.cache.credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
      const headers = new Headers({
        "Content-Type": CONTENT_TYPE,
        "X-Amz-Date": amzDate,
        "X-Amz-Target": amzTarget,
        Authorization: authorizationHeader,
      });
      // https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_use-resources.html
      if (conf.cache.sessionToken) {
        headers.append("X-Amz-Security-Token", conf.cache.sessionToken);
      }
      return headers;
    }
    exports_18("createHeaders", createHeaders);
    return {
      setters: [
        function (deps_ts_6_1) {
          deps_ts_6 = deps_ts_6_1;
        },
        function (aws_signature_v4_ts_1_1) {
          aws_signature_v4_ts_1 = aws_signature_v4_ts_1_1;
        },
        function (util_ts_2_1) {
          util_ts_2 = util_ts_2_1;
        },
      ],
      execute: function () {
        /** Algorithm identifer. */
        ALGORITHM = "AWS4-HMAC-SHA256";
        /** Content type header value for POST requests. */
        CONTENT_TYPE = "application/x-amz-json-1.0";
      },
    };
  },
);
System.register(
  "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/client/base_fetch",
  [
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/deps",
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/client/create_headers",
  ],
  function (exports_19, context_19) {
    "use strict";
    var deps_ts_7, create_headers_ts_1;
    var __moduleName = context_19 && context_19.id;
    /** Base fetch. */
    async function baseFetch(conf, op, params) {
      const payload = deps_ts_7.encode(JSON.stringify(params), "utf8");
      let headers = await create_headers_ts_1.createHeaders(op, payload, conf);
      let response = await fetch(conf.endpoint, {
        method: conf.method,
        headers,
        body: payload,
      });
      let body = await response.json();
      if (!response.ok) {
        if (response.status === 403) {
          // retry once with refreshed credenttials
          headers = await create_headers_ts_1.createHeaders(
            op,
            payload,
            conf,
            true,
          );
          response = await fetch(conf.endpoint, {
            method: conf.method,
            headers,
            body: payload,
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
    exports_19("baseFetch", baseFetch);
    return {
      setters: [
        function (deps_ts_7_1) {
          deps_ts_7 = deps_ts_7_1;
        },
        function (create_headers_ts_1_1) {
          create_headers_ts_1 = create_headers_ts_1_1;
        },
      ],
      execute: function () {
      },
    };
  },
);
System.register(
  "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/api/collection",
  ["https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/util"],
  function (exports_20, context_20) {
    "use strict";
    var util_ts_3;
    var __moduleName = context_20 && context_20.id;
    function memoize(name, value, factory) {
      util_ts_3.memoizedProperty(this, name, /*nameTr(name)*/ function () {
        return factory(name, value);
      });
    }
    function Collection(
      iterable,
      options,
      factory, /*, nameTr: (name:string)=> string = String*/
      callback = util_ts_3.noop,
    ) {
      // nameTr = nameTr || String;
      // var self = this;
      for (const id in iterable) {
        if (Object.prototype.hasOwnProperty.call(iterable, id)) {
          memoize.call(this, id, iterable[id], factory /*, nameTr*/);
          if (callback) {
            callback(id, iterable[id]);
          }
        }
      }
    }
    exports_20("Collection", Collection);
    return {
      setters: [
        function (util_ts_3_1) {
          util_ts_3 = util_ts_3_1;
        },
      ],
      execute: function () {
      },
    };
  },
);
System.register(
  "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/api/shape",
  [
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/deps",
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/api/collection",
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/util",
  ],
  function (exports_21, context_21) {
    "use strict";
    var deps_ts_8, collection_ts_1, util_ts_4, _Collection;
    var __moduleName = context_21 && context_21.id;
    function property(obj, name, value, enumerable, isValue) {
      if (value !== null && value !== undefined) {
        util_ts_4.property.apply(this, arguments);
      }
    }
    function memoizedProperty(obj, name, get, enumerable) {
      if (!obj.constructor.prototype[name]) {
        util_ts_4.memoizedProperty.apply(this, arguments);
      }
    }
    function Shape(shape, options = {}, memberName) {
      property(this, "shape", shape.shape);
      property(this, "api", options.api, false);
      property(this, "type", shape.type);
      property(this, "enum", shape.enum);
      property(this, "min", shape.min);
      property(this, "max", shape.max);
      property(this, "pattern", shape.pattern);
      property(this, "location", shape.location || this.location || "body");
      property(
        this,
        "name",
        this.name ||
          shape.xmlName ||
          shape.queryName ||
          shape.locationName ||
          memberName,
      );
      property(
        this,
        "isStreaming",
        shape.streaming || this.isStreaming || false,
      );
      property(this, "requiresLength", shape.requiresLength, false);
      property(this, "isComposite", shape.isComposite || false);
      property(this, "isShape", true, false);
      property(this, "isQueryName", Boolean(shape.queryName), false);
      property(this, "isLocationName", Boolean(shape.locationName), false);
      property(this, "isIdempotent", shape.idempotencyToken);
      property(this, "isJsonValue", shape.jsonvalue);
      property(
        this,
        "isSensitive",
        shape.sensitive || (shape.prototype && shape.prototype.sensitive),
      );
      property(this, "isEventStream", Boolean(shape.eventstream), false);
      property(this, "isEvent", Boolean(shape.event), false);
      property(this, "isEventPayload", Boolean(shape.eventpayload), false);
      property(this, "isEventHeader", Boolean(shape.eventheader), false);
      property(
        this,
        "isTimestampFormatSet",
        Boolean(shape.timestampFormat) ||
          (shape.prototype && shape.prototype.isTimestampFormatSet),
        false,
      );
      property(
        this,
        "endpointDiscoveryId",
        Boolean(shape.endpointdiscoveryid),
        false,
      );
      property(this, "hostLabel", Boolean(shape.hostLabel), false);
      if (options.documentation) {
        property(this, "documentation", shape.documentation);
        property(this, "documentationUrl", shape.documentationUrl);
      }
      if (shape.xmlAttribute) {
        property(this, "isXmlAttribute", shape.xmlAttribute || false);
      }
      // type conversion and parsing
      property(this, "defaultValue", null);
      this.toWireFormat = function (value) {
        if (value === null || value === undefined) {
          return "";
        }
        return value;
      };
      this.toType = function (value) {
        return value;
      };
    }
    exports_21("Shape", Shape);
    function CompositeShape(shape) {
      Shape.apply(this, arguments);
      property(this, "isComposite", true);
      if (shape.flattened) {
        property(this, "flattened", shape.flattened || false);
      }
    }
    function StructureShape(shape, options = {}) {
      const self = this;
      // let requiredMap: null | Doc = null;
      const firstInit = !this.isShape;
      CompositeShape.apply(this, arguments);
      if (firstInit) {
        property(this, "defaultValue", function () {
          return {};
        });
        property(this, "members", {});
        property(this, "memberNames", []);
        property(this, "required", []);
        property(this, "isRequired", function () {
          return false;
        });
      }
      if (shape.members) {
        property(
          this,
          "members",
          new _Collection(shape.members, options, function (name, member) {
            return Shape.create(member, options, name);
          }),
        );
        memoizedProperty(this, "memberNames", function () {
          return shape.xmlOrder || Object.keys(shape.members);
        });
        if (shape.event) {
          memoizedProperty(this, "eventPayloadMemberName", function () {
            const members = self.members;
            const memberNames = self.memberNames;
            // iterate over members to find ones that are event payloads
            for (let i = 0, iLen = memberNames.length; i < iLen; i++) {
              if (members[memberNames[i]].isEventPayload) {
                return memberNames[i];
              }
            }
            return "";
          });
          memoizedProperty(this, "eventHeaderMemberNames", function () {
            const members = self.members;
            const memberNames = self.memberNames;
            const eventHeaderMemberNames = [];
            // iterate over members to find ones that are event headers
            for (let i = 0, iLen = memberNames.length; i < iLen; i++) {
              if (members[memberNames[i]].isEventHeader) {
                eventHeaderMemberNames.push(memberNames[i]);
              }
            }
            return eventHeaderMemberNames;
          });
        }
      }
      if (shape.required) {
        property(this, "required", shape.required);
        const requiredMap = shape.required.reduce((acc, req) => {
          acc[req] = true;
          return acc;
        }, {});
        property(
          this,
          "isRequired",
          function (name) {
            // if (!requiredMap) {
            //   // requiredMap = {};
            //   //
            //   // for (let i:number = 0; i < shape.required.length; i++) {
            //   //   requiredMap[shape.required[i]] = true;
            //   // }
            //   requiredMap = shape.required.reduce((acc: Doc, req: string): Doc => {
            //     acc[req] = true;
            //     return acc;
            //   }, {});
            // }
            return requiredMap[name];
          },
          false,
          true,
        );
      }
      property(this, "resultWrapper", shape.resultWrapper || null);
      if (shape.payload) {
        property(this, "payload", shape.payload);
      }
      if (typeof shape.xmlNamespace === "string") {
        property(this, "xmlNamespaceUri", shape.xmlNamespace);
      } else if (typeof shape.xmlNamespace === "object") {
        property(this, "xmlNamespacePrefix", shape.xmlNamespace.prefix);
        property(this, "xmlNamespaceUri", shape.xmlNamespace.uri);
      }
    }
    function ListShape(shape, options = {}) {
      const self = this;
      const firstInit = !this.isShape;
      CompositeShape.apply(this, arguments);
      if (firstInit) {
        property(this, "defaultValue", function () {
          return [];
        });
      }
      if (shape.member) {
        memoizedProperty(this, "member", function () {
          return Shape.create(shape.member, options);
        });
      }
      if (this.flattened) {
        const oldName = this.name;
        memoizedProperty(this, "name", function () {
          return self.member.name || oldName;
        });
      }
    }
    function MapShape(shape, options = {}) {
      const firstInit = !this.isShape;
      CompositeShape.apply(this, arguments);
      if (firstInit) {
        property(this, "defaultValue", function () {
          return {};
        });
        property(this, "key", Shape.create({ type: "string" }, options));
        property(this, "value", Shape.create({ type: "string" }, options));
      }
      if (shape.key) {
        memoizedProperty(this, "key", function () {
          return Shape.create(shape.key, options);
        });
      }
      if (shape.value) {
        memoizedProperty(this, "value", function () {
          return Shape.create(shape.value, options);
        });
      }
    }
    function TimestampShape(shape) {
      const self = this;
      Shape.apply(this, arguments);
      if (shape.timestampFormat) {
        property(this, "timestampFormat", shape.timestampFormat);
      } else if (self.isTimestampFormatSet && this.timestampFormat) {
        property(this, "timestampFormat", this.timestampFormat);
      } else if (this.location === "header") {
        property(this, "timestampFormat", "rfc822");
      } else if (this.location === "querystring") {
        property(this, "timestampFormat", "iso8601");
      } else if (this.api) {
        switch (this.api.protocol) {
          case "json":
          case "rest-json":
            property(this, "timestampFormat", "unixTimestamp");
            break;
          case "rest-xml":
          case "query":
          case "ec2":
            property(this, "timestampFormat", "iso8601");
            break;
        }
      }
      this.toType = function (value) {
        if (value === null || value === undefined) {
          return undefined;
        }
        if (typeof value.toISOString === "function") {
          return value;
        }
        if (typeof value === "string" || typeof value === "number") {
          return util_ts_4.date.parseTimestamp(value);
        }
        return undefined;
        // return typeof value === "string" || typeof value === "number"
        //   ? date.parseTimestamp(value)
        //   : null;
      };
      this.toWireFormat = function (value) {
        return util_ts_4.date.format(value, self.timestampFormat);
      };
    }
    function StringShape() {
      Shape.apply(this, arguments);
      const nullLessProtocols = ["rest-xml", "query", "ec2"];
      this.toType = function (value) {
        value = this.api && nullLessProtocols.indexOf(this.api.protocol) > -1
          ? value || "" : value;
        if (this.isJsonValue) {
          return JSON.parse(value);
        }
        return value && typeof value.toString === "function" ? value.toString()
        : value;
      };
      this.toWireFormat = function (value) {
        return this.isJsonValue ? JSON.stringify(value) : value;
      };
    }
    function FloatShape() {
      Shape.apply(this, arguments);
      this.toType = function (value) {
        if (value === null || value === undefined) {
          return undefined;
        }
        return parseFloat(value);
      };
      this.toWireFormat = this.toType;
    }
    function IntegerShape() {
      Shape.apply(this, arguments);
      this.toType = function (value) {
        if (value === null || value === undefined) {
          return undefined;
        }
        return parseInt(value, 10);
      };
      this.toWireFormat = this.toType;
    }
    function BinaryShape() {
      Shape.apply(this, arguments);
      this.toType = deps_ts_8.base64ToUint8Array;
      this.toWireFormat = deps_ts_8.base64FromUint8Array;
    }
    function Base64Shape() {
      BinaryShape.apply(this, arguments);
    }
    function BooleanShape() {
      Shape.apply(this, arguments);
      this.toType = function (value) {
        if (typeof value === "boolean") {
          return value;
        }
        if (value === null || value === undefined) {
          return undefined;
        }
        return value === "true";
      };
    }
    return {
      setters: [
        function (deps_ts_8_1) {
          deps_ts_8 = deps_ts_8_1;
        },
        function (collection_ts_1_1) {
          collection_ts_1 = collection_ts_1_1;
        },
        function (util_ts_4_1) {
          util_ts_4 = util_ts_4_1;
        },
      ],
      execute: function () {
        _Collection = collection_ts_1.Collection;
        /**
             * @api private
             */
        Shape.normalizedTypes = {
          character: "string",
          double: "float",
          long: "integer",
          short: "integer",
          biginteger: "integer",
          bigdecimal: "float",
          blob: "binary",
        };
        /**
             * @api private
             */
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
          binary: BinaryShape,
        };
        Shape.resolve = function resolve(shape, options = {}) {
          if (shape.shape) {
            const refShape = options.api.shapes[shape.shape];
            if (!refShape) {
              throw new Error(`Cannot find shape reference: ${shape.shape}`);
            }
            return refShape;
          } else {
            return null;
          }
        };
        Shape.create = function create(shape, options = {}, memberName = "") {
          if (shape.isShape) {
            return shape;
          }
          const refShape = Shape.resolve(shape, options);
          if (refShape) {
            let filteredKeys = Object.keys(shape);
            if (!options.documentation) {
              filteredKeys = filteredKeys.filter(function (name) {
                return !name.match(/documentation/);
              });
            }
            // create an inline shape with extra members
            const InlineShape = function () {
              refShape.constructor.call(this, shape, options, memberName);
            };
            InlineShape.prototype = refShape;
            return new InlineShape();
          } else {
            // set type if not set
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
            // normalize types
            const origType = shape.type;
            if (Shape.normalizedTypes[shape.type]) {
              shape.type = Shape.normalizedTypes[shape.type];
            }
            if (Shape.types[shape.type]) {
              return new Shape.types[shape.type](shape, options, memberName);
            } else {
              throw new Error("Unrecognized shape type: " + origType);
            }
          }
        };
        /**
             * @api private
             */
        Shape.shapes = {
          StructureShape: StructureShape,
          ListShape: ListShape,
          MapShape: MapShape,
          StringShape: StringShape,
          BooleanShape: BooleanShape,
          Base64Shape: Base64Shape,
        };
      },
    };
  },
);
System.register(
  "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/api/operation",
  [
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/api/shape",
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/util",
  ],
  function (exports_22, context_22) {
    "use strict";
    var shape_ts_1, util_ts_5;
    var __moduleName = context_22 && context_22.id;
    // import { Doc} from "../types.ts"
    function Operation(name, operation, options = {}) {
      const self = this;
      // options = options || {};
      util_ts_5.property(this, "name", operation.name || name);
      util_ts_5.property(this, "api", options.api, false);
      operation.http = operation.http || {};
      util_ts_5.property(this, "endpoint", operation.endpoint);
      util_ts_5.property(this, "httpMethod", operation.http.method || "POST");
      util_ts_5.property(this, "httpPath", operation.http.requestUri || "/");
      util_ts_5.property(this, "authtype", operation.authtype || "");
      util_ts_5.property(
        this,
        "endpointDiscoveryRequired",
        operation.endpointdiscovery
          ? operation.endpointdiscovery.required ? "REQUIRED" : "OPTIONAL"
          : "NULL",
      );
      util_ts_5.memoizedProperty(this, "input", function () {
        if (!operation.input) {
          return /*new*/ shape_ts_1.Shape.create(
            { type: "structure" },
            options,
          );
        }
        return shape_ts_1.Shape.create(operation.input, options);
      });
      util_ts_5.memoizedProperty(this, "output", function () {
        if (!operation.output) {
          return /*new*/ shape_ts_1.Shape.create(
            { type: "structure" },
            options,
          );
        }
        return shape_ts_1.Shape.create(operation.output, options);
      });
      util_ts_5.memoizedProperty(this, "errors", function () {
        if (!operation.errors) {
          return [];
        }
        return operation.errors.map((error) =>
          shape_ts_1.Shape.create(error, options)
        );
        // const list: any[] = [];
        //
        // for (let i: number = 0; i < operation.errors.length; i++) {
        //   list.push(Shape.create(operation.errors[i], options));
        // }
        //
        // return list;
      });
      util_ts_5.memoizedProperty(this, "paginator", function () {
        return options.api.paginators[name];
      });
      if (options.documentation) {
        util_ts_5.property(this, "documentation", operation.documentation);
        util_ts_5.property(
          this,
          "documentationUrl",
          operation.documentationUrl,
        );
      }
      // idempotentMembers only tracks top-level input shapes
      util_ts_5.memoizedProperty(this, "idempotentMembers", function () {
        // const idempotentMembers: string[] = [];
        // const input: Doc = self.input;
        // const members: Doc = input.members;
        if (!self.input.members) {
          return []; //idempotentMembers;
        }
        return Object.entries(self.input.members)
          .filter(([_, value]) => value.isIdempotent)
          .map(([key, _]) => key);
        // for (const name in members) {
        //   if (!members.hasOwnProperty(name)) {
        //     continue;
        //   }
        //
        //   if (members[name].isIdempotent) {
        //     idempotentMembers.push(name);
        //   }
        // }
        //
        // return idempotentMembers;
      });
      util_ts_5.memoizedProperty(this, "hasEventOutput", function () {
        // var output = self.output;
        return hasEventStream(self.output);
      });
    }
    exports_22("Operation", Operation);
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
      // check if any member is an event stream
      for (const name in members) {
        if (!members.hasOwnProperty(name) && members[name].isEventStream) {
          // if (members[name].isEventStream === true) {
          //   return true;
          // }
          return true;
        }
      }
      return false;
    }
    return {
      setters: [
        function (shape_ts_1_1) {
          shape_ts_1 = shape_ts_1_1;
        },
        function (util_ts_5_1) {
          util_ts_5 = util_ts_5_1;
        },
      ],
      execute: function () {
      },
    };
  },
);
System.register(
  "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/api/api",
  [
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/api/collection",
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/api/operation",
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/api/shape",
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/util",
  ],
  function (exports_23, context_23) {
    "use strict";
    var collection_ts_2,
      operation_ts_1,
      shape_ts_2,
      util_ts_6,
      _Collection,
      _Operation;
    var __moduleName = context_23 && context_23.id;
    // var Paginator = require('./paginator');
    // var ResourceWaiter = require('./resource_waiter');
    function Api(api = {}, options = {}) {
      const self = this;
      // api = api || {};
      // options = options || {};
      options.api = this;
      api.metadata = api.metadata || {};
      util_ts_6.property(this, "isApi", true, false);
      util_ts_6.property(this, "apiVersion", api.metadata.apiVersion);
      util_ts_6.property(this, "endpointPrefix", api.metadata.endpointPrefix);
      util_ts_6.property(this, "signingName", api.metadata.signingName);
      util_ts_6.property(this, "globalEndpoint", api.metadata.globalEndpoint);
      util_ts_6.property(
        this,
        "signatureVersion",
        api.metadata.signatureVersion,
      );
      util_ts_6.property(this, "jsonVersion", api.metadata.jsonVersion);
      util_ts_6.property(this, "targetPrefix", api.metadata.targetPrefix);
      util_ts_6.property(this, "protocol", api.metadata.protocol);
      util_ts_6.property(this, "timestampFormat", api.metadata.timestampFormat);
      util_ts_6.property(this, "xmlNamespaceUri", api.metadata.xmlNamespace);
      util_ts_6.property(
        this,
        "abbreviation",
        api.metadata.serviceAbbreviation,
      );
      util_ts_6.property(this, "fullName", api.metadata.serviceFullName);
      util_ts_6.property(this, "serviceId", api.metadata.serviceId);
      util_ts_6.memoizedProperty(this, "className", function () {
        let name = api.metadata.serviceAbbreviation ||
          api.metadata.serviceFullName;
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
          util_ts_6.property(
            self,
            "endpointOperation", /*stringUtil.lowerFirst(name)*/
            name,
          );
        }
      }
      util_ts_6.property(
        this,
        "operations",
        new _Collection(api.operations, options, function (name, operation) {
          return new _Operation(name, operation, options);
        }, /*, stringUtil.lowerFirst*/ addEndpointOperation),
      );
      util_ts_6.property(
        this,
        "shapes",
        new _Collection(api.shapes, options, function (name, shape) {
          return shape_ts_2.Shape.create(shape, options);
        }),
      );
      // property(this, 'paginators', new Collection(api.paginators, options, function(name, paginator) {
      //   return new Paginator(name, paginator, options);
      // }));
      //
      // property(this, 'waiters', new Collection(api.waiters, options, function(name, waiter) {
      //   return new ResourceWaiter(name, waiter, options);
      // }, util.string.lowerFirst));
      if (options.documentation) {
        util_ts_6.property(this, "documentation", api.documentation);
        util_ts_6.property(this, "documentationUrl", api.documentationUrl);
      }
    }
    exports_23("Api", Api);
    return {
      setters: [
        function (collection_ts_2_1) {
          collection_ts_2 = collection_ts_2_1;
        },
        function (operation_ts_1_1) {
          operation_ts_1 = operation_ts_1_1;
        },
        function (shape_ts_2_1) {
          shape_ts_2 = shape_ts_2_1;
        },
        function (util_ts_6_1) {
          util_ts_6 = util_ts_6_1;
        },
      ],
      execute: function () {
        // NOTE: 2 run in ts strict-mode (bypassing TS7009)
        _Collection = collection_ts_2.Collection;
        _Operation = operation_ts_1.Operation;
      },
    };
  },
);
System.register(
  "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/api/mod",
  ["https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/api/api"],
  function (exports_24, context_24) {
    "use strict";
    var api_ts_1, _Api, API;
    var __moduleName = context_24 && context_24.id;
    return {
      setters: [
        function (api_ts_1_1) {
          api_ts_1 = api_ts_1_1;
        },
      ],
      execute: function () {
        _Api = api_ts_1.Api;
        exports_24(
          "API",
          API = new _Api(JSON.parse(`
{
  "version": "2.0",
  "metadata": {
    "apiVersion": "2012-08-10",
    "endpointPrefix": "dynamodb",
    "jsonVersion": "1.0",
    "protocol": "json",
    "serviceAbbreviation": "DynamoDB",
    "serviceFullName": "Amazon DynamoDB",
    "serviceId": "DynamoDB",
    "signatureVersion": "v4",
    "targetPrefix": "DynamoDB_20120810",
    "uid": "dynamodb-2012-08-10"
  },
  "operations": {
    "BatchGetItem": {
      "input": {
        "type": "structure",
        "required": [
          "RequestItems"
        ],
        "members": {
          "RequestItems": {
            "shape": "S2"
          },
          "ReturnConsumedCapacity": {}
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "Responses": {
            "type": "map",
            "key": {},
            "value": {
              "shape": "Sr"
            }
          },
          "UnprocessedKeys": {
            "shape": "S2"
          },
          "ConsumedCapacity": {
            "shape": "St"
          }
        }
      },
      "endpointdiscovery": {}
    },
    "BatchWriteItem": {
      "input": {
        "type": "structure",
        "required": [
          "RequestItems"
        ],
        "members": {
          "RequestItems": {
            "shape": "S10"
          },
          "ReturnConsumedCapacity": {},
          "ReturnItemCollectionMetrics": {}
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "UnprocessedItems": {
            "shape": "S10"
          },
          "ItemCollectionMetrics": {
            "shape": "S18"
          },
          "ConsumedCapacity": {
            "shape": "St"
          }
        }
      },
      "endpointdiscovery": {}
    },
    "CreateBackup": {
      "input": {
        "type": "structure",
        "required": [
          "TableName",
          "BackupName"
        ],
        "members": {
          "TableName": {},
          "BackupName": {}
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "BackupDetails": {
            "shape": "S1h"
          }
        }
      },
      "endpointdiscovery": {}
    },
    "CreateGlobalTable": {
      "input": {
        "type": "structure",
        "required": [
          "GlobalTableName",
          "ReplicationGroup"
        ],
        "members": {
          "GlobalTableName": {},
          "ReplicationGroup": {
            "shape": "S1p"
          }
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "GlobalTableDescription": {
            "shape": "S1t"
          }
        }
      },
      "endpointdiscovery": {}
    },
    "CreateTable": {
      "input": {
        "type": "structure",
        "required": [
          "AttributeDefinitions",
          "TableName",
          "KeySchema"
        ],
        "members": {
          "AttributeDefinitions": {
            "shape": "S1z"
          },
          "TableName": {},
          "KeySchema": {
            "shape": "S23"
          },
          "LocalSecondaryIndexes": {
            "type": "list",
            "member": {
              "type": "structure",
              "required": [
                "IndexName",
                "KeySchema",
                "Projection"
              ],
              "members": {
                "IndexName": {},
                "KeySchema": {
                  "shape": "S23"
                },
                "Projection": {
                  "shape": "S28"
                }
              }
            }
          },
          "GlobalSecondaryIndexes": {
            "type": "list",
            "member": {
              "type": "structure",
              "required": [
                "IndexName",
                "KeySchema",
                "Projection"
              ],
              "members": {
                "IndexName": {},
                "KeySchema": {
                  "shape": "S23"
                },
                "Projection": {
                  "shape": "S28"
                },
                "ProvisionedThroughput": {
                  "shape": "S2e"
                }
              }
            }
          },
          "BillingMode": {},
          "ProvisionedThroughput": {
            "shape": "S2e"
          },
          "StreamSpecification": {
            "shape": "S2h"
          },
          "SSESpecification": {
            "shape": "S2k"
          },
          "Tags": {
            "shape": "S2o"
          }
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "TableDescription": {
            "shape": "S2t"
          }
        }
      },
      "endpointdiscovery": {}
    },
    "DeleteBackup": {
      "input": {
        "type": "structure",
        "required": [
          "BackupArn"
        ],
        "members": {
          "BackupArn": {}
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "BackupDescription": {
            "shape": "S3g"
          }
        }
      },
      "endpointdiscovery": {}
    },
    "DeleteItem": {
      "input": {
        "type": "structure",
        "required": [
          "TableName",
          "Key"
        ],
        "members": {
          "TableName": {},
          "Key": {
            "shape": "S6"
          },
          "Expected": {
            "shape": "S3t"
          },
          "ConditionalOperator": {},
          "ReturnValues": {},
          "ReturnConsumedCapacity": {},
          "ReturnItemCollectionMetrics": {},
          "ConditionExpression": {},
          "ExpressionAttributeNames": {
            "shape": "Sm"
          },
          "ExpressionAttributeValues": {
            "shape": "S41"
          }
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "Attributes": {
            "shape": "Ss"
          },
          "ConsumedCapacity": {
            "shape": "Su"
          },
          "ItemCollectionMetrics": {
            "shape": "S1a"
          }
        }
      },
      "endpointdiscovery": {}
    },
    "DeleteTable": {
      "input": {
        "type": "structure",
        "required": [
          "TableName"
        ],
        "members": {
          "TableName": {}
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "TableDescription": {
            "shape": "S2t"
          }
        }
      },
      "endpointdiscovery": {}
    },
    "DescribeBackup": {
      "input": {
        "type": "structure",
        "required": [
          "BackupArn"
        ],
        "members": {
          "BackupArn": {}
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "BackupDescription": {
            "shape": "S3g"
          }
        }
      },
      "endpointdiscovery": {}
    },
    "DescribeContinuousBackups": {
      "input": {
        "type": "structure",
        "required": [
          "TableName"
        ],
        "members": {
          "TableName": {}
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "ContinuousBackupsDescription": {
            "shape": "S4a"
          }
        }
      },
      "endpointdiscovery": {}
    },
    "DescribeEndpoints": {
      "input": {
        "type": "structure",
        "members": {}
      },
      "output": {
        "type": "structure",
        "required": [
          "Endpoints"
        ],
        "members": {
          "Endpoints": {
            "type": "list",
            "member": {
              "type": "structure",
              "required": [
                "Address",
                "CachePeriodInMinutes"
              ],
              "members": {
                "Address": {},
                "CachePeriodInMinutes": {
                  "type": "long"
                }
              }
            }
          }
        }
      },
      "endpointoperation": true
    },
    "DescribeGlobalTable": {
      "input": {
        "type": "structure",
        "required": [
          "GlobalTableName"
        ],
        "members": {
          "GlobalTableName": {}
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "GlobalTableDescription": {
            "shape": "S1t"
          }
        }
      },
      "endpointdiscovery": {}
    },
    "DescribeGlobalTableSettings": {
      "input": {
        "type": "structure",
        "required": [
          "GlobalTableName"
        ],
        "members": {
          "GlobalTableName": {}
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "GlobalTableName": {},
          "ReplicaSettings": {
            "shape": "S4m"
          }
        }
      },
      "endpointdiscovery": {}
    },
    "DescribeLimits": {
      "input": {
        "type": "structure",
        "members": {}
      },
      "output": {
        "type": "structure",
        "members": {
          "AccountMaxReadCapacityUnits": {
            "type": "long"
          },
          "AccountMaxWriteCapacityUnits": {
            "type": "long"
          },
          "TableMaxReadCapacityUnits": {
            "type": "long"
          },
          "TableMaxWriteCapacityUnits": {
            "type": "long"
          }
        }
      },
      "endpointdiscovery": {}
    },
    "DescribeTable": {
      "input": {
        "type": "structure",
        "required": [
          "TableName"
        ],
        "members": {
          "TableName": {}
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "Table": {
            "shape": "S2t"
          }
        }
      },
      "endpointdiscovery": {}
    },
    "DescribeTimeToLive": {
      "input": {
        "type": "structure",
        "required": [
          "TableName"
        ],
        "members": {
          "TableName": {}
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "TimeToLiveDescription": {
            "shape": "S3p"
          }
        }
      },
      "endpointdiscovery": {}
    },
    "GetItem": {
      "input": {
        "type": "structure",
        "required": [
          "TableName",
          "Key"
        ],
        "members": {
          "TableName": {},
          "Key": {
            "shape": "S6"
          },
          "AttributesToGet": {
            "shape": "Sj"
          },
          "ConsistentRead": {
            "type": "boolean"
          },
          "ReturnConsumedCapacity": {},
          "ProjectionExpression": {},
          "ExpressionAttributeNames": {
            "shape": "Sm"
          }
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "Item": {
            "shape": "Ss"
          },
          "ConsumedCapacity": {
            "shape": "Su"
          }
        }
      },
      "endpointdiscovery": {}
    },
    "ListBackups": {
      "input": {
        "type": "structure",
        "members": {
          "TableName": {},
          "Limit": {
            "type": "integer"
          },
          "TimeRangeLowerBound": {
            "type": "timestamp"
          },
          "TimeRangeUpperBound": {
            "type": "timestamp"
          },
          "ExclusiveStartBackupArn": {},
          "BackupType": {}
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "BackupSummaries": {
            "type": "list",
            "member": {
              "type": "structure",
              "members": {
                "TableName": {},
                "TableId": {},
                "TableArn": {},
                "BackupArn": {},
                "BackupName": {},
                "BackupCreationDateTime": {
                  "type": "timestamp"
                },
                "BackupExpiryDateTime": {
                  "type": "timestamp"
                },
                "BackupStatus": {},
                "BackupType": {},
                "BackupSizeBytes": {
                  "type": "long"
                }
              }
            }
          },
          "LastEvaluatedBackupArn": {}
        }
      },
      "endpointdiscovery": {}
    },
    "ListGlobalTables": {
      "input": {
        "type": "structure",
        "members": {
          "ExclusiveStartGlobalTableName": {},
          "Limit": {
            "type": "integer"
          },
          "RegionName": {}
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "GlobalTables": {
            "type": "list",
            "member": {
              "type": "structure",
              "members": {
                "GlobalTableName": {},
                "ReplicationGroup": {
                  "shape": "S1p"
                }
              }
            }
          },
          "LastEvaluatedGlobalTableName": {}
        }
      },
      "endpointdiscovery": {}
    },
    "ListTables": {
      "input": {
        "type": "structure",
        "members": {
          "ExclusiveStartTableName": {},
          "Limit": {
            "type": "integer"
          }
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "TableNames": {
            "type": "list",
            "member": {}
          },
          "LastEvaluatedTableName": {}
        }
      },
      "endpointdiscovery": {}
    },
    "ListTagsOfResource": {
      "input": {
        "type": "structure",
        "required": [
          "ResourceArn"
        ],
        "members": {
          "ResourceArn": {},
          "NextToken": {}
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "Tags": {
            "shape": "S2o"
          },
          "NextToken": {}
        }
      },
      "endpointdiscovery": {}
    },
    "PutItem": {
      "input": {
        "type": "structure",
        "required": [
          "TableName",
          "Item"
        ],
        "members": {
          "TableName": {},
          "Item": {
            "shape": "S14"
          },
          "Expected": {
            "shape": "S3t"
          },
          "ReturnValues": {},
          "ReturnConsumedCapacity": {},
          "ReturnItemCollectionMetrics": {},
          "ConditionalOperator": {},
          "ConditionExpression": {},
          "ExpressionAttributeNames": {
            "shape": "Sm"
          },
          "ExpressionAttributeValues": {
            "shape": "S41"
          }
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "Attributes": {
            "shape": "Ss"
          },
          "ConsumedCapacity": {
            "shape": "Su"
          },
          "ItemCollectionMetrics": {
            "shape": "S1a"
          }
        }
      },
      "endpointdiscovery": {}
    },
    "Query": {
      "input": {
        "type": "structure",
        "required": [
          "TableName"
        ],
        "members": {
          "TableName": {},
          "IndexName": {},
          "Select": {},
          "AttributesToGet": {
            "shape": "Sj"
          },
          "Limit": {
            "type": "integer"
          },
          "ConsistentRead": {
            "type": "boolean"
          },
          "KeyConditions": {
            "type": "map",
            "key": {},
            "value": {
              "shape": "S5w"
            }
          },
          "QueryFilter": {
            "shape": "S5x"
          },
          "ConditionalOperator": {},
          "ScanIndexForward": {
            "type": "boolean"
          },
          "ExclusiveStartKey": {
            "shape": "S6"
          },
          "ReturnConsumedCapacity": {},
          "ProjectionExpression": {},
          "FilterExpression": {},
          "KeyConditionExpression": {},
          "ExpressionAttributeNames": {
            "shape": "Sm"
          },
          "ExpressionAttributeValues": {
            "shape": "S41"
          }
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "Items": {
            "shape": "Sr"
          },
          "Count": {
            "type": "integer"
          },
          "ScannedCount": {
            "type": "integer"
          },
          "LastEvaluatedKey": {
            "shape": "S6"
          },
          "ConsumedCapacity": {
            "shape": "Su"
          }
        }
      },
      "endpointdiscovery": {}
    },
    "RestoreTableFromBackup": {
      "input": {
        "type": "structure",
        "required": [
          "TargetTableName",
          "BackupArn"
        ],
        "members": {
          "TargetTableName": {},
          "BackupArn": {}
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "TableDescription": {
            "shape": "S2t"
          }
        }
      },
      "endpointdiscovery": {}
    },
    "RestoreTableToPointInTime": {
      "input": {
        "type": "structure",
        "required": [
          "SourceTableName",
          "TargetTableName"
        ],
        "members": {
          "SourceTableName": {},
          "TargetTableName": {},
          "UseLatestRestorableTime": {
            "type": "boolean"
          },
          "RestoreDateTime": {
            "type": "timestamp"
          }
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "TableDescription": {
            "shape": "S2t"
          }
        }
      },
      "endpointdiscovery": {}
    },
    "Scan": {
      "input": {
        "type": "structure",
        "required": [
          "TableName"
        ],
        "members": {
          "TableName": {},
          "IndexName": {},
          "AttributesToGet": {
            "shape": "Sj"
          },
          "Limit": {
            "type": "integer"
          },
          "Select": {},
          "ScanFilter": {
            "shape": "S5x"
          },
          "ConditionalOperator": {},
          "ExclusiveStartKey": {
            "shape": "S6"
          },
          "ReturnConsumedCapacity": {},
          "TotalSegments": {
            "type": "integer"
          },
          "Segment": {
            "type": "integer"
          },
          "ProjectionExpression": {},
          "FilterExpression": {},
          "ExpressionAttributeNames": {
            "shape": "Sm"
          },
          "ExpressionAttributeValues": {
            "shape": "S41"
          },
          "ConsistentRead": {
            "type": "boolean"
          }
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "Items": {
            "shape": "Sr"
          },
          "Count": {
            "type": "integer"
          },
          "ScannedCount": {
            "type": "integer"
          },
          "LastEvaluatedKey": {
            "shape": "S6"
          },
          "ConsumedCapacity": {
            "shape": "Su"
          }
        }
      },
      "endpointdiscovery": {}
    },
    "TagResource": {
      "input": {
        "type": "structure",
        "required": [
          "ResourceArn",
          "Tags"
        ],
        "members": {
          "ResourceArn": {},
          "Tags": {
            "shape": "S2o"
          }
        }
      },
      "endpointdiscovery": {}
    },
    "TransactGetItems": {
      "input": {
        "type": "structure",
        "required": [
          "TransactItems"
        ],
        "members": {
          "TransactItems": {
            "type": "list",
            "member": {
              "type": "structure",
              "required": [
                "Get"
              ],
              "members": {
                "Get": {
                  "type": "structure",
                  "required": [
                    "Key",
                    "TableName"
                  ],
                  "members": {
                    "Key": {
                      "shape": "S6"
                    },
                    "TableName": {},
                    "ProjectionExpression": {},
                    "ExpressionAttributeNames": {
                      "shape": "Sm"
                    }
                  }
                }
              }
            }
          },
          "ReturnConsumedCapacity": {}
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "ConsumedCapacity": {
            "shape": "St"
          },
          "Responses": {
            "type": "list",
            "member": {
              "type": "structure",
              "members": {
                "Item": {
                  "shape": "Ss"
                }
              }
            }
          }
        }
      },
      "endpointdiscovery": {}
    },
    "TransactWriteItems": {
      "input": {
        "type": "structure",
        "required": [
          "TransactItems"
        ],
        "members": {
          "TransactItems": {
            "type": "list",
            "member": {
              "type": "structure",
              "members": {
                "ConditionCheck": {
                  "type": "structure",
                  "required": [
                    "Key",
                    "TableName",
                    "ConditionExpression"
                  ],
                  "members": {
                    "Key": {
                      "shape": "S6"
                    },
                    "TableName": {},
                    "ConditionExpression": {},
                    "ExpressionAttributeNames": {
                      "shape": "Sm"
                    },
                    "ExpressionAttributeValues": {
                      "shape": "S41"
                    },
                    "ReturnValuesOnConditionCheckFailure": {}
                  }
                },
                "Put": {
                  "type": "structure",
                  "required": [
                    "Item",
                    "TableName"
                  ],
                  "members": {
                    "Item": {
                      "shape": "S14"
                    },
                    "TableName": {},
                    "ConditionExpression": {},
                    "ExpressionAttributeNames": {
                      "shape": "Sm"
                    },
                    "ExpressionAttributeValues": {
                      "shape": "S41"
                    },
                    "ReturnValuesOnConditionCheckFailure": {}
                  }
                },
                "Delete": {
                  "type": "structure",
                  "required": [
                    "Key",
                    "TableName"
                  ],
                  "members": {
                    "Key": {
                      "shape": "S6"
                    },
                    "TableName": {},
                    "ConditionExpression": {},
                    "ExpressionAttributeNames": {
                      "shape": "Sm"
                    },
                    "ExpressionAttributeValues": {
                      "shape": "S41"
                    },
                    "ReturnValuesOnConditionCheckFailure": {}
                  }
                },
                "Update": {
                  "type": "structure",
                  "required": [
                    "Key",
                    "UpdateExpression",
                    "TableName"
                  ],
                  "members": {
                    "Key": {
                      "shape": "S6"
                    },
                    "UpdateExpression": {},
                    "TableName": {},
                    "ConditionExpression": {},
                    "ExpressionAttributeNames": {
                      "shape": "Sm"
                    },
                    "ExpressionAttributeValues": {
                      "shape": "S41"
                    },
                    "ReturnValuesOnConditionCheckFailure": {}
                  }
                }
              }
            }
          },
          "ReturnConsumedCapacity": {},
          "ReturnItemCollectionMetrics": {},
          "ClientRequestToken": {
            "idempotencyToken": true
          }
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "ConsumedCapacity": {
            "shape": "St"
          },
          "ItemCollectionMetrics": {
            "shape": "S18"
          }
        }
      },
      "endpointdiscovery": {}
    },
    "UntagResource": {
      "input": {
        "type": "structure",
        "required": [
          "ResourceArn",
          "TagKeys"
        ],
        "members": {
          "ResourceArn": {},
          "TagKeys": {
            "type": "list",
            "member": {}
          }
        }
      },
      "endpointdiscovery": {}
    },
    "UpdateContinuousBackups": {
      "input": {
        "type": "structure",
        "required": [
          "TableName",
          "PointInTimeRecoverySpecification"
        ],
        "members": {
          "TableName": {},
          "PointInTimeRecoverySpecification": {
            "type": "structure",
            "required": [
              "PointInTimeRecoveryEnabled"
            ],
            "members": {
              "PointInTimeRecoveryEnabled": {
                "type": "boolean"
              }
            }
          }
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "ContinuousBackupsDescription": {
            "shape": "S4a"
          }
        }
      },
      "endpointdiscovery": {}
    },
    "UpdateGlobalTable": {
      "input": {
        "type": "structure",
        "required": [
          "GlobalTableName",
          "ReplicaUpdates"
        ],
        "members": {
          "GlobalTableName": {},
          "ReplicaUpdates": {
            "type": "list",
            "member": {
              "type": "structure",
              "members": {
                "Create": {
                  "type": "structure",
                  "required": [
                    "RegionName"
                  ],
                  "members": {
                    "RegionName": {}
                  }
                },
                "Delete": {
                  "type": "structure",
                  "required": [
                    "RegionName"
                  ],
                  "members": {
                    "RegionName": {}
                  }
                }
              }
            }
          }
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "GlobalTableDescription": {
            "shape": "S1t"
          }
        }
      },
      "endpointdiscovery": {}
    },
    "UpdateGlobalTableSettings": {
      "input": {
        "type": "structure",
        "required": [
          "GlobalTableName"
        ],
        "members": {
          "GlobalTableName": {},
          "GlobalTableBillingMode": {},
          "GlobalTableProvisionedWriteCapacityUnits": {
            "type": "long"
          },
          "GlobalTableProvisionedWriteCapacityAutoScalingSettingsUpdate": {
            "shape": "S74"
          },
          "GlobalTableGlobalSecondaryIndexSettingsUpdate": {
            "type": "list",
            "member": {
              "type": "structure",
              "required": [
                "IndexName"
              ],
              "members": {
                "IndexName": {},
                "ProvisionedWriteCapacityUnits": {
                  "type": "long"
                },
                "ProvisionedWriteCapacityAutoScalingSettingsUpdate": {
                  "shape": "S74"
                }
              }
            }
          },
          "ReplicaSettingsUpdate": {
            "type": "list",
            "member": {
              "type": "structure",
              "required": [
                "RegionName"
              ],
              "members": {
                "RegionName": {},
                "ReplicaProvisionedReadCapacityUnits": {
                  "type": "long"
                },
                "ReplicaProvisionedReadCapacityAutoScalingSettingsUpdate": {
                  "shape": "S74"
                },
                "ReplicaGlobalSecondaryIndexSettingsUpdate": {
                  "type": "list",
                  "member": {
                    "type": "structure",
                    "required": [
                      "IndexName"
                    ],
                    "members": {
                      "IndexName": {},
                      "ProvisionedReadCapacityUnits": {
                        "type": "long"
                      },
                      "ProvisionedReadCapacityAutoScalingSettingsUpdate": {
                        "shape": "S74"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "GlobalTableName": {},
          "ReplicaSettings": {
            "shape": "S4m"
          }
        }
      },
      "endpointdiscovery": {}
    },
    "UpdateItem": {
      "input": {
        "type": "structure",
        "required": [
          "TableName",
          "Key"
        ],
        "members": {
          "TableName": {},
          "Key": {
            "shape": "S6"
          },
          "AttributeUpdates": {
            "type": "map",
            "key": {},
            "value": {
              "type": "structure",
              "members": {
                "Value": {
                  "shape": "S8"
                },
                "Action": {}
              }
            }
          },
          "Expected": {
            "shape": "S3t"
          },
          "ConditionalOperator": {},
          "ReturnValues": {},
          "ReturnConsumedCapacity": {},
          "ReturnItemCollectionMetrics": {},
          "UpdateExpression": {},
          "ConditionExpression": {},
          "ExpressionAttributeNames": {
            "shape": "Sm"
          },
          "ExpressionAttributeValues": {
            "shape": "S41"
          }
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "Attributes": {
            "shape": "Ss"
          },
          "ConsumedCapacity": {
            "shape": "Su"
          },
          "ItemCollectionMetrics": {
            "shape": "S1a"
          }
        }
      },
      "endpointdiscovery": {}
    },
    "UpdateTable": {
      "input": {
        "type": "structure",
        "required": [
          "TableName"
        ],
        "members": {
          "AttributeDefinitions": {
            "shape": "S1z"
          },
          "TableName": {},
          "BillingMode": {},
          "ProvisionedThroughput": {
            "shape": "S2e"
          },
          "GlobalSecondaryIndexUpdates": {
            "type": "list",
            "member": {
              "type": "structure",
              "members": {
                "Update": {
                  "type": "structure",
                  "required": [
                    "IndexName",
                    "ProvisionedThroughput"
                  ],
                  "members": {
                    "IndexName": {},
                    "ProvisionedThroughput": {
                      "shape": "S2e"
                    }
                  }
                },
                "Create": {
                  "type": "structure",
                  "required": [
                    "IndexName",
                    "KeySchema",
                    "Projection"
                  ],
                  "members": {
                    "IndexName": {},
                    "KeySchema": {
                      "shape": "S23"
                    },
                    "Projection": {
                      "shape": "S28"
                    },
                    "ProvisionedThroughput": {
                      "shape": "S2e"
                    }
                  }
                },
                "Delete": {
                  "type": "structure",
                  "required": [
                    "IndexName"
                  ],
                  "members": {
                    "IndexName": {}
                  }
                }
              }
            }
          },
          "StreamSpecification": {
            "shape": "S2h"
          },
          "SSESpecification": {
            "shape": "S2k"
          }
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "TableDescription": {
            "shape": "S2t"
          }
        }
      },
      "endpointdiscovery": {}
    },
    "UpdateTimeToLive": {
      "input": {
        "type": "structure",
        "required": [
          "TableName",
          "TimeToLiveSpecification"
        ],
        "members": {
          "TableName": {},
          "TimeToLiveSpecification": {
            "shape": "S7s"
          }
        }
      },
      "output": {
        "type": "structure",
        "members": {
          "TimeToLiveSpecification": {
            "shape": "S7s"
          }
        }
      },
      "endpointdiscovery": {}
    }
  },
  "shapes": {
    "S2": {
      "type": "map",
      "key": {},
      "value": {
        "type": "structure",
        "required": [
          "Keys"
        ],
        "members": {
          "Keys": {
            "type": "list",
            "member": {
              "shape": "S6"
            }
          },
          "AttributesToGet": {
            "shape": "Sj"
          },
          "ConsistentRead": {
            "type": "boolean"
          },
          "ProjectionExpression": {},
          "ExpressionAttributeNames": {
            "shape": "Sm"
          }
        }
      }
    },
    "S6": {
      "type": "map",
      "key": {},
      "value": {
        "shape": "S8"
      }
    },
    "S8": {
      "type": "structure",
      "members": {
        "S": {},
        "N": {},
        "B": {
          "type": "blob"
        },
        "SS": {
          "type": "list",
          "member": {}
        },
        "NS": {
          "type": "list",
          "member": {}
        },
        "BS": {
          "type": "list",
          "member": {
            "type": "blob"
          }
        },
        "M": {
          "type": "map",
          "key": {},
          "value": {
            "shape": "S8"
          }
        },
        "L": {
          "type": "list",
          "member": {
            "shape": "S8"
          }
        },
        "NULL": {
          "type": "boolean"
        },
        "BOOL": {
          "type": "boolean"
        }
      }
    },
    "Sj": {
      "type": "list",
      "member": {}
    },
    "Sm": {
      "type": "map",
      "key": {},
      "value": {}
    },
    "Sr": {
      "type": "list",
      "member": {
        "shape": "Ss"
      }
    },
    "Ss": {
      "type": "map",
      "key": {},
      "value": {
        "shape": "S8"
      }
    },
    "St": {
      "type": "list",
      "member": {
        "shape": "Su"
      }
    },
    "Su": {
      "type": "structure",
      "members": {
        "TableName": {},
        "CapacityUnits": {
          "type": "double"
        },
        "ReadCapacityUnits": {
          "type": "double"
        },
        "WriteCapacityUnits": {
          "type": "double"
        },
        "Table": {
          "shape": "Sw"
        },
        "LocalSecondaryIndexes": {
          "shape": "Sx"
        },
        "GlobalSecondaryIndexes": {
          "shape": "Sx"
        }
      }
    },
    "Sw": {
      "type": "structure",
      "members": {
        "ReadCapacityUnits": {
          "type": "double"
        },
        "WriteCapacityUnits": {
          "type": "double"
        },
        "CapacityUnits": {
          "type": "double"
        }
      }
    },
    "Sx": {
      "type": "map",
      "key": {},
      "value": {
        "shape": "Sw"
      }
    },
    "S10": {
      "type": "map",
      "key": {},
      "value": {
        "type": "list",
        "member": {
          "type": "structure",
          "members": {
            "PutRequest": {
              "type": "structure",
              "required": [
                "Item"
              ],
              "members": {
                "Item": {
                  "shape": "S14"
                }
              }
            },
            "DeleteRequest": {
              "type": "structure",
              "required": [
                "Key"
              ],
              "members": {
                "Key": {
                  "shape": "S6"
                }
              }
            }
          }
        }
      }
    },
    "S14": {
      "type": "map",
      "key": {},
      "value": {
        "shape": "S8"
      }
    },
    "S18": {
      "type": "map",
      "key": {},
      "value": {
        "type": "list",
        "member": {
          "shape": "S1a"
        }
      }
    },
    "S1a": {
      "type": "structure",
      "members": {
        "ItemCollectionKey": {
          "type": "map",
          "key": {},
          "value": {
            "shape": "S8"
          }
        },
        "SizeEstimateRangeGB": {
          "type": "list",
          "member": {
            "type": "double"
          }
        }
      }
    },
    "S1h": {
      "type": "structure",
      "required": [
        "BackupArn",
        "BackupName",
        "BackupStatus",
        "BackupType",
        "BackupCreationDateTime"
      ],
      "members": {
        "BackupArn": {},
        "BackupName": {},
        "BackupSizeBytes": {
          "type": "long"
        },
        "BackupStatus": {},
        "BackupType": {},
        "BackupCreationDateTime": {
          "type": "timestamp"
        },
        "BackupExpiryDateTime": {
          "type": "timestamp"
        }
      }
    },
    "S1p": {
      "type": "list",
      "member": {
        "type": "structure",
        "members": {
          "RegionName": {}
        }
      }
    },
    "S1t": {
      "type": "structure",
      "members": {
        "ReplicationGroup": {
          "type": "list",
          "member": {
            "type": "structure",
            "members": {
              "RegionName": {}
            }
          }
        },
        "GlobalTableArn": {},
        "CreationDateTime": {
          "type": "timestamp"
        },
        "GlobalTableStatus": {},
        "GlobalTableName": {}
      }
    },
    "S1z": {
      "type": "list",
      "member": {
        "type": "structure",
        "required": [
          "AttributeName",
          "AttributeType"
        ],
        "members": {
          "AttributeName": {},
          "AttributeType": {}
        }
      }
    },
    "S23": {
      "type": "list",
      "member": {
        "type": "structure",
        "required": [
          "AttributeName",
          "KeyType"
        ],
        "members": {
          "AttributeName": {},
          "KeyType": {}
        }
      }
    },
    "S28": {
      "type": "structure",
      "members": {
        "ProjectionType": {},
        "NonKeyAttributes": {
          "type": "list",
          "member": {}
        }
      }
    },
    "S2e": {
      "type": "structure",
      "required": [
        "ReadCapacityUnits",
        "WriteCapacityUnits"
      ],
      "members": {
        "ReadCapacityUnits": {
          "type": "long"
        },
        "WriteCapacityUnits": {
          "type": "long"
        }
      }
    },
    "S2h": {
      "type": "structure",
      "members": {
        "StreamEnabled": {
          "type": "boolean"
        },
        "StreamViewType": {}
      }
    },
    "S2k": {
      "type": "structure",
      "members": {
        "Enabled": {
          "type": "boolean"
        },
        "SSEType": {},
        "KMSMasterKeyId": {}
      }
    },
    "S2o": {
      "type": "list",
      "member": {
        "type": "structure",
        "required": [
          "Key",
          "Value"
        ],
        "members": {
          "Key": {},
          "Value": {}
        }
      }
    },
    "S2t": {
      "type": "structure",
      "members": {
        "AttributeDefinitions": {
          "shape": "S1z"
        },
        "TableName": {},
        "KeySchema": {
          "shape": "S23"
        },
        "TableStatus": {},
        "CreationDateTime": {
          "type": "timestamp"
        },
        "ProvisionedThroughput": {
          "shape": "S2v"
        },
        "TableSizeBytes": {
          "type": "long"
        },
        "ItemCount": {
          "type": "long"
        },
        "TableArn": {},
        "TableId": {},
        "BillingModeSummary": {
          "shape": "S30"
        },
        "LocalSecondaryIndexes": {
          "type": "list",
          "member": {
            "type": "structure",
            "members": {
              "IndexName": {},
              "KeySchema": {
                "shape": "S23"
              },
              "Projection": {
                "shape": "S28"
              },
              "IndexSizeBytes": {
                "type": "long"
              },
              "ItemCount": {
                "type": "long"
              },
              "IndexArn": {}
            }
          }
        },
        "GlobalSecondaryIndexes": {
          "type": "list",
          "member": {
            "type": "structure",
            "members": {
              "IndexName": {},
              "KeySchema": {
                "shape": "S23"
              },
              "Projection": {
                "shape": "S28"
              },
              "IndexStatus": {},
              "Backfilling": {
                "type": "boolean"
              },
              "ProvisionedThroughput": {
                "shape": "S2v"
              },
              "IndexSizeBytes": {
                "type": "long"
              },
              "ItemCount": {
                "type": "long"
              },
              "IndexArn": {}
            }
          }
        },
        "StreamSpecification": {
          "shape": "S2h"
        },
        "LatestStreamLabel": {},
        "LatestStreamArn": {},
        "RestoreSummary": {
          "type": "structure",
          "required": [
            "RestoreDateTime",
            "RestoreInProgress"
          ],
          "members": {
            "SourceBackupArn": {},
            "SourceTableArn": {},
            "RestoreDateTime": {
              "type": "timestamp"
            },
            "RestoreInProgress": {
              "type": "boolean"
            }
          }
        },
        "SSEDescription": {
          "shape": "S3b"
        }
      }
    },
    "S2v": {
      "type": "structure",
      "members": {
        "LastIncreaseDateTime": {
          "type": "timestamp"
        },
        "LastDecreaseDateTime": {
          "type": "timestamp"
        },
        "NumberOfDecreasesToday": {
          "type": "long"
        },
        "ReadCapacityUnits": {
          "type": "long"
        },
        "WriteCapacityUnits": {
          "type": "long"
        }
      }
    },
    "S30": {
      "type": "structure",
      "members": {
        "BillingMode": {},
        "LastUpdateToPayPerRequestDateTime": {
          "type": "timestamp"
        }
      }
    },
    "S3b": {
      "type": "structure",
      "members": {
        "Status": {},
        "SSEType": {},
        "KMSMasterKeyArn": {}
      }
    },
    "S3g": {
      "type": "structure",
      "members": {
        "BackupDetails": {
          "shape": "S1h"
        },
        "SourceTableDetails": {
          "type": "structure",
          "required": [
            "TableName",
            "TableId",
            "KeySchema",
            "TableCreationDateTime",
            "ProvisionedThroughput"
          ],
          "members": {
            "TableName": {},
            "TableId": {},
            "TableArn": {},
            "TableSizeBytes": {
              "type": "long"
            },
            "KeySchema": {
              "shape": "S23"
            },
            "TableCreationDateTime": {
              "type": "timestamp"
            },
            "ProvisionedThroughput": {
              "shape": "S2e"
            },
            "ItemCount": {
              "type": "long"
            },
            "BillingMode": {}
          }
        },
        "SourceTableFeatureDetails": {
          "type": "structure",
          "members": {
            "LocalSecondaryIndexes": {
              "type": "list",
              "member": {
                "type": "structure",
                "members": {
                  "IndexName": {},
                  "KeySchema": {
                    "shape": "S23"
                  },
                  "Projection": {
                    "shape": "S28"
                  }
                }
              }
            },
            "GlobalSecondaryIndexes": {
              "type": "list",
              "member": {
                "type": "structure",
                "members": {
                  "IndexName": {},
                  "KeySchema": {
                    "shape": "S23"
                  },
                  "Projection": {
                    "shape": "S28"
                  },
                  "ProvisionedThroughput": {
                    "shape": "S2e"
                  }
                }
              }
            },
            "StreamDescription": {
              "shape": "S2h"
            },
            "TimeToLiveDescription": {
              "shape": "S3p"
            },
            "SSEDescription": {
              "shape": "S3b"
            }
          }
        }
      }
    },
    "S3p": {
      "type": "structure",
      "members": {
        "TimeToLiveStatus": {},
        "AttributeName": {}
      }
    },
    "S3t": {
      "type": "map",
      "key": {},
      "value": {
        "type": "structure",
        "members": {
          "Value": {
            "shape": "S8"
          },
          "Exists": {
            "type": "boolean"
          },
          "ComparisonOperator": {},
          "AttributeValueList": {
            "shape": "S3x"
          }
        }
      }
    },
    "S3x": {
      "type": "list",
      "member": {
        "shape": "S8"
      }
    },
    "S41": {
      "type": "map",
      "key": {},
      "value": {
        "shape": "S8"
      }
    },
    "S4a": {
      "type": "structure",
      "required": [
        "ContinuousBackupsStatus"
      ],
      "members": {
        "ContinuousBackupsStatus": {},
        "PointInTimeRecoveryDescription": {
          "type": "structure",
          "members": {
            "PointInTimeRecoveryStatus": {},
            "EarliestRestorableDateTime": {
              "type": "timestamp"
            },
            "LatestRestorableDateTime": {
              "type": "timestamp"
            }
          }
        }
      }
    },
    "S4m": {
      "type": "list",
      "member": {
        "type": "structure",
        "required": [
          "RegionName"
        ],
        "members": {
          "RegionName": {},
          "ReplicaStatus": {},
          "ReplicaBillingModeSummary": {
            "shape": "S30"
          },
          "ReplicaProvisionedReadCapacityUnits": {
            "type": "long"
          },
          "ReplicaProvisionedReadCapacityAutoScalingSettings": {
            "shape": "S4p"
          },
          "ReplicaProvisionedWriteCapacityUnits": {
            "type": "long"
          },
          "ReplicaProvisionedWriteCapacityAutoScalingSettings": {
            "shape": "S4p"
          },
          "ReplicaGlobalSecondaryIndexSettings": {
            "type": "list",
            "member": {
              "type": "structure",
              "required": [
                "IndexName"
              ],
              "members": {
                "IndexName": {},
                "IndexStatus": {},
                "ProvisionedReadCapacityUnits": {
                  "type": "long"
                },
                "ProvisionedReadCapacityAutoScalingSettings": {
                  "shape": "S4p"
                },
                "ProvisionedWriteCapacityUnits": {
                  "type": "long"
                },
                "ProvisionedWriteCapacityAutoScalingSettings": {
                  "shape": "S4p"
                }
              }
            }
          }
        }
      }
    },
    "S4p": {
      "type": "structure",
      "members": {
        "MinimumUnits": {
          "type": "long"
        },
        "MaximumUnits": {
          "type": "long"
        },
        "AutoScalingDisabled": {
          "type": "boolean"
        },
        "AutoScalingRoleArn": {},
        "ScalingPolicies": {
          "type": "list",
          "member": {
            "type": "structure",
            "members": {
              "PolicyName": {},
              "TargetTrackingScalingPolicyConfiguration": {
                "type": "structure",
                "required": [
                  "TargetValue"
                ],
                "members": {
                  "DisableScaleIn": {
                    "type": "boolean"
                  },
                  "ScaleInCooldown": {
                    "type": "integer"
                  },
                  "ScaleOutCooldown": {
                    "type": "integer"
                  },
                  "TargetValue": {
                    "type": "double"
                  }
                }
              }
            }
          }
        }
      }
    },
    "S5w": {
      "type": "structure",
      "required": [
        "ComparisonOperator"
      ],
      "members": {
        "AttributeValueList": {
          "shape": "S3x"
        },
        "ComparisonOperator": {}
      }
    },
    "S5x": {
      "type": "map",
      "key": {},
      "value": {
        "shape": "S5w"
      }
    },
    "S74": {
      "type": "structure",
      "members": {
        "MinimumUnits": {
          "type": "long"
        },
        "MaximumUnits": {
          "type": "long"
        },
        "AutoScalingDisabled": {
          "type": "boolean"
        },
        "AutoScalingRoleArn": {},
        "ScalingPolicyUpdate": {
          "type": "structure",
          "required": [
            "TargetTrackingScalingPolicyConfiguration"
          ],
          "members": {
            "PolicyName": {},
            "TargetTrackingScalingPolicyConfiguration": {
              "type": "structure",
              "required": [
                "TargetValue"
              ],
              "members": {
                "DisableScaleIn": {
                  "type": "boolean"
                },
                "ScaleInCooldown": {
                  "type": "integer"
                },
                "ScaleOutCooldown": {
                  "type": "integer"
                },
                "TargetValue": {
                  "type": "double"
                }
              }
            }
          }
        }
      }
    },
    "S7s": {
      "type": "structure",
      "required": [
        "Enabled",
        "AttributeName"
      ],
      "members": {
        "Enabled": {
          "type": "boolean"
        },
        "AttributeName": {}
      }
    }
  }
}  
`)),
        );
      },
    };
  },
);
System.register(
  "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/client/converter",
  [
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/deps",
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/util",
  ],
  function (exports_25, context_25) {
    "use strict";
    var deps_ts_9, util_ts_7, Converter;
    var __moduleName = context_25 && context_25.id;
    /** Formats a list. */
    function formatList(data, options = {}) {
      const list = { L: [] };
      for (let i = 0; i < data.length; i++) {
        list["L"].push(Converter.input(data[i], options));
      }
      return list;
    }
    /** Converts a number. */
    function convertNumber(value, wrapNumbers = false) {
      return wrapNumbers
        ? new util_ts_7.DynamoDBNumberValue(value)
        : Number(value);
    }
    /** Formats a map. */
    function formatMap(data, options = {}) {
      const map = { M: {} };
      for (const key in data) {
        const formatted = Converter.input(data[key], options);
        if (formatted !== void 0) {
          map["M"][key] = formatted;
        }
      }
      return map;
    }
    /** Formats a set. */
    function formatSet(data, options = {}) {
      let values = data.values;
      if (options.convertEmptyValues) {
        values = filterEmptySetValues(data);
        if (values.length === 0) {
          return Converter.input(null);
        }
      }
      const map = {};
      switch (data.type) {
        case "String":
          map["SS"] = values;
          break;
        case "Binary":
          map["BS"] = values;
          break;
        case "Number":
          map["NS"] = values.map(function (value) {
            return value.toString();
          });
      }
      return map;
    }
    /** Filters empty set values. */
    function filterEmptySetValues(set) {
      const nonEmptyValues = [];
      const potentiallyEmptyTypes = {
        String: true,
        Binary: true,
        Number: false,
      };
      if (potentiallyEmptyTypes[set.type]) {
        for (let i = 0; i < set.values.length; i++) {
          if (set.values[i].length === 0) {
            continue;
          }
          nonEmptyValues.push(set.values[i]);
        }
        return nonEmptyValues;
      }
      return set.values;
    }
    return {
      setters: [
        function (deps_ts_9_1) {
          deps_ts_9 = deps_ts_9_1;
        },
        function (util_ts_7_1) {
          util_ts_7 = util_ts_7_1;
        },
      ],
      execute: function () {
        /** aws DynamoDB req/res document converter. */
        Converter = class Converter {
          /**
                 * Convert a JavaScript value to its equivalent DynamoDB AttributeValue type
                 *
                 * @param data [any] The data to convert to a DynamoDB AttributeValue
                 * @param options [map]
                 * @option options convertEmptyValues [Boolean] Whether to automatically
                 *                                              convert empty strings, blobs,
                 *                                              and sets to `null`
                 * @option options wrapNumbers [Boolean]  Whether to return numbers as a
                 *                                        NumberValue object instead of
                 *                                        converting them to native JavaScript
                 *                                        numbers. This allows for the safe
                 *                                        round-trip transport of numbers of
                 *                                        arbitrary size.
                 * @return [map] An object in the Amazon DynamoDB AttributeValue format
                 *
                 * @see AWS.DynamoDB.Converter.marshall AWS.DynamoDB.Converter.marshall to
                 *    convert entire records (rather than individual attributes)
                 */
          static input(data, options = {}) {
            const type = util_ts_7.typeOf(data);
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
              return { S: data };
            } else if (type === "Number" || type === "NumberValue") {
              return { N: data.toString() };
            } else if (type === "Binary") {
              if (data.length === 0 && options.convertEmptyValues) {
                return Converter.input(null);
              }
              // return { B: data };
              return { B: deps_ts_9.base64FromUint8Array(data) };
            } else if (type === "Boolean") {
              return { BOOL: data };
            } else if (type === "null") {
              return { NULL: true };
            } else if (type !== "undefined" && type !== "Function") {
              // this value has a custom constructor
              return formatMap(data, options);
            }
            return {};
          }
          /**
                 * Convert a JavaScript object into a DynamoDB record.
                 *
                 * @param data [any] The data to convert to a DynamoDB record
                 * @param options [map]
                 * @option options convertEmptyValues [Boolean] Whether to automatically
                 *                                              convert empty strings, blobs,
                 *                                              and sets to `null`
                 * @option options wrapNumbers [Boolean]  Whether to return numbers as a
                 *                                        NumberValue object instead of
                 *                                        converting them to native JavaScript
                 *                                        numbers. This allows for the safe
                 *                                        round-trip transport of numbers of
                 *                                        arbitrary size.
                 *
                 * @return [map] An object in the DynamoDB record format.
                 *
                 * @example Convert a JavaScript object into a DynamoDB record
                 *  var marshalled = AWS.DynamoDB.Converter.marshall({
                 *    string: 'foo',
                 *    list: ['fizz', 'buzz', 'pop'],
                 *    map: {
                 *      nestedMap: {
                 *        key: 'value',
                 *      }
                 *    },
                 *    number: 123,
                 *    nullValue: null,
                 *    boolValue: true,
                 *    stringSet: new DynamoDBSet(['foo', 'bar', 'baz'])
                 *  });
                 */
          static marshall(data, options) {
            return Converter.input(data, options).M;
          }
          /**
                 * Convert a DynamoDB AttributeValue object to its equivalent JavaScript type.
                 *
                 * @param data [map] An object in the Amazon DynamoDB AttributeValue format
                 * @param options [map]
                 * @option options convertEmptyValues [Boolean] Whether to automatically
                 *                                              convert empty strings, blobs,
                 *                                              and sets to `null`
                 * @option options wrapNumbers [Boolean]  Whether to return numbers as a
                 *                                        NumberValue object instead of
                 *                                        converting them to native JavaScript
                 *                                        numbers. This allows for the safe
                 *                                        round-trip transport of numbers of
                 *                                        arbitrary size.
                 *
                 * @return [Object|Array|String|Number|Boolean|null]
                 *
                 * @see AWS.DynamoDB.Converter.unmarshall AWS.DynamoDB.Converter.unmarshall to
                 *    convert entire records (rather than individual attributes)
                 */
          static output(data, options = {}) {
            for (const type in data) {
              const values = data[type];
              if (type === "M") {
                const map = {};
                for (const key in values) {
                  map[key] = Converter.output(values[key], options);
                }
                return map;
              } else if (type === "L") {
                // list = [];
                // for (i = 0; i < values.length; i++) {
                //   list.push(Converter.output(values[i], options));
                // }
                // return list;
                return values.map((value) => Converter.output(value, options));
              } else if (type === "SS") {
                // list = [];
                // for (i = 0; i < values.length; i++) {
                //   list.push(values[i] + '');
                // }
                // return new DynamoDBSet(list);
                return new util_ts_7.DynamoDBSet(values.map(String));
              } else if (type === "NS") {
                // list = [];
                // for (i = 0; i < values.length; i++) {
                //   list.push(convertNumber(values[i], options.wrapNumbers));
                // }
                // return new DynamoDBSet(list);
                return new util_ts_7.DynamoDBSet(values.map((value) =>
                  convertNumber(value, options.wrapNumbers)
                ));
              } else if (type === "BS") {
                // list = [];
                // for (i = 0; i < values.length; i++) {
                //   list.push(base64ToUint8Array(values[i]));
                // }
                // return new DynamoDBSet(list);
                return new util_ts_7.DynamoDBSet(
                  values.map(deps_ts_9.base64ToUint8Array),
                );
              } else if (type === "S") {
                return String(values);
              } else if (type === "N") {
                return convertNumber(values, options.wrapNumbers);
              } else if (type === "B") {
                return deps_ts_9.base64ToUint8Array(values);
              } else if (type === "BOOL") {
                return values === "true" || values === "TRUE" ||
                  values === true;
              } else if (type === "NULL") {
                return null;
              }
            }
          }
          /**
                 * Convert a DynamoDB record into a JavaScript object.
                 *
                 * @param data [any] The DynamoDB record
                 * @param options [map]
                 * @option options convertEmptyValues [Boolean] Whether to automatically
                 *                                              convert empty strings, blobs,
                 *                                              and sets to `null`
                 * @option options wrapNumbers [Boolean]  Whether to return numbers as a
                 *                                        NumberValue object instead of
                 *                                        converting them to native JavaScript
                 *                                        numbers. This allows for the safe
                 *                                        round-trip transport of numbers of
                 *                                        arbitrary size.
                 *
                 * @return [map] An object whose properties have been converted from
                 *    DynamoDB's AttributeValue format into their corresponding native
                 *    JavaScript types.
                 *
                 * @example Convert a record received from a DynamoDB stream
                 *  var unmarshalled = AWS.DynamoDB.Converter.unmarshall({
                 *    string: {S: 'foo'},
                 *    list: {L: [{S: 'fizz'}, {S: 'buzz'}, {S: 'pop'}]},
                 *    map: {
                 *      M: {
                 *        nestedMap: {
                 *          M: {
                 *            key: {S: 'value'}
                 *          }
                 *        }
                 *      }
                 *    },
                 *    number: {N: '123'},
                 *    nullValue: {NULL: true},
                 *    boolValue: {BOOL: true}
                 *  });
                 */
          static unmarshall(data, options) {
            return Converter.output({ M: data }, options);
          }
        };
        exports_25("Converter", Converter);
      },
    };
  },
);
System.register(
  "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/client/translator",
  ["https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/client/converter"],
  function (exports_26, context_26) {
    "use strict";
    var converter_ts_1;
    var __moduleName = context_26 && context_26.id;
    function Translator({ wrapNumbers, convertEmptyValues, attrValue } = {}) {
      // options = options || {};
      this.attrValue = attrValue;
      this.convertEmptyValues = Boolean(convertEmptyValues);
      this.wrapNumbers = Boolean(wrapNumbers);
    }
    exports_26("Translator", Translator);
    return {
      setters: [
        function (converter_ts_1_1) {
          converter_ts_1 = converter_ts_1_1;
        },
      ],
      execute: function () {
        Translator.prototype.translateInput = function (value, shape) {
          this.mode = "input";
          return this.translate(value, shape);
        };
        Translator.prototype.translateOutput = function (value, shape) {
          this.mode = "output";
          return this.translate(value, shape);
        };
        Translator.prototype.translate = function (value, shape) {
          const self = this;
          if (!shape || value === undefined) {
            return undefined;
          }
          if (shape.shape === self.attrValue) {
            return converter_ts_1.Converter[self.mode](value, {
              convertEmptyValues: self.convertEmptyValues,
              wrapNumbers: self.wrapNumbers,
            });
          }
          switch (shape.type) {
            case "structure":
              return self.translateStructure(value, shape);
            case "map":
              return self.translateMap(value, shape);
            case "list":
              return self.translateList(value, shape);
            default:
              return self.translateScalar(value, shape);
          }
        };
        Translator.prototype.translateStructure = function (structure, shape) {
          const self = this;
          if (structure == null) {
            return undefined;
          }
          const struct = {};
          // util.each(structure, function(name, value) {
          Object.entries(structure).forEach(([name, value]) => {
            const memberShape = shape.members[name];
            if (memberShape) {
              const result = self.translate(value, memberShape);
              if (result !== undefined) {
                struct[name] = result;
              }
            }
          });
          return struct;
        };
        Translator.prototype.translateList = function (list, shape) {
          const self = this;
          if (list == null) {
            return undefined;
          }
          return list.map((value) => {
            const result = self.translate(value, shape.member);
            if (result === undefined) {
              return null;
            } else {
              return result;
            }
          });
          // var out = [];
          // // util.arrayEach(list, function(value) {
          // list.forEach(function(value) {
          //   var result = self.translate(value, shape.member);
          //   if (result === undefined) out.push(null);
          //   else out.push(result);
          // });
          // return out;
        };
        Translator.prototype.translateMap = function (map, shape) {
          const self = this;
          if (!map) {
            return undefined;
          }
          return Object.entries(map).reduce((acc, [key, value]) => {
            const result = self.translate(value, shape.value);
            if (result === undefined) {
              acc[key] = null;
            } else {
              acc[key] = result;
            }
            return acc;
          }, {});
          // var out = {};
          // // util.each(map, function(key, value) {
          // Object.entries(map).forEach(function([key, value]) {
          //   var result = self.translate(value, shape.value);
          //   if (result === undefined) out[key] = null;
          //   else out[key] = result;
          // });
          // return out;
        };
        Translator.prototype.translateScalar = function (value, shape) {
          return shape.toType(value);
        };
      },
    };
  },
);
System.register(
  "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/client/base_op",
  [
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/client/base_fetch",
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/api/mod",
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/client/translator",
  ],
  function (exports_27, context_27) {
    "use strict";
    var base_fetch_ts_1,
      mod_ts_13,
      translator_ts_1,
      _Translator,
      NO_PARAMS_OPS,
      ATTR_VALUE;
    var __moduleName = context_27 && context_27.id;
    /** Base op. */
    async function baseOp(
      conf,
      op,
      params = {},
      {
        wrapNumbers = false,
        convertEmptyValues = false,
        translateJSON = true,
        iteratePages = true,
      } = NO_PARAMS_OPS.has(op) ? params || {} : {},
    ) {
      let translator;
      let outputShape;
      if (translateJSON) {
        translator = new _Translator({
          wrapNumbers,
          convertEmptyValues,
          attrValue: ATTR_VALUE,
        });
        outputShape = mod_ts_13.API.operations[op].output;
        params = translator.translateInput(
          params,
          mod_ts_13.API.operations[op].input,
        );
      } else {
        params = { ...params };
      }
      let rawResult = await base_fetch_ts_1.baseFetch(conf, op, params);
      if (rawResult.LastEvaluatedKey && iteratePages) {
        let lastEvaluatedKey = rawResult.LastEvaluatedKey;
        let first = true;
        return {
          [Symbol.asyncIterator]() {
            return this;
          },
          async next() {
            if (!lastEvaluatedKey) {
              return { value: {}, done: true };
            }
            if (first) {
              first = false;
              lastEvaluatedKey = rawResult.LastEvaluatedKey;
              if (!translateJSON) {
                return {
                  value: rawResult,
                  done: false,
                };
              } else {
                return {
                  value: translator.translateOutput(rawResult, outputShape),
                  done: false,
                };
              }
            } else {
              params.ExclusiveStartKey = lastEvaluatedKey;
            }
            rawResult = await base_fetch_ts_1.baseFetch(conf, op, params);
            lastEvaluatedKey = rawResult.LastEvaluatedKey;
            if (!translateJSON) {
              return { value: rawResult, done: false };
            }
            return {
              value: translator.translateOutput(rawResult, outputShape),
              done: false,
            };
          },
        };
      }
      if (!translateJSON) {
        return rawResult;
      }
      return translator.translateOutput(rawResult, outputShape);
    }
    exports_27("baseOp", baseOp);
    return {
      setters: [
        function (base_fetch_ts_1_1) {
          base_fetch_ts_1 = base_fetch_ts_1_1;
        },
        function (mod_ts_13_1) {
          mod_ts_13 = mod_ts_13_1;
        },
        function (translator_ts_1_1) {
          translator_ts_1 = translator_ts_1_1;
        },
      ],
      execute: function () {
        // ts strict food
        _Translator = translator_ts_1.Translator;
        /** DynamoDB operations that do not take any parameters. */
        exports_27(
          "NO_PARAMS_OPS",
          NO_PARAMS_OPS = new Set([
            "DescribeEndpoints",
            "DescribeLimits",
            "ListTables",
          ]),
        );
        /** Base shape of all DynamoDB query schemas. */
        ATTR_VALUE =
          mod_ts_13.API.operations.PutItem.input.members.Item.value.shape;
      },
    };
  },
);
System.register(
  "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/client/create_cache",
  [
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/client/aws_signature_v4",
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/util",
  ],
  function (exports_28, context_28) {
    "use strict";
    var aws_signature_v4_ts_2, util_ts_8, SERVICE;
    var __moduleName = context_28 && context_28.id;
    /** Cache for credentialScope and expensive signature key. */
    function createCache(conf) {
      return {
        _credentialScope: "",
        _signingKey: null,
        _accessKeyId: "",
        _sessionToken: "",
        async refresh() {
          const dateStamp = util_ts_8.date.format(new Date(), "dateStamp");
          let credentials;
          if (typeof conf.credentials === "function") {
            credentials = await conf.credentials();
          } else {
            credentials = conf.credentials;
          }
          this._signingKey = aws_signature_v4_ts_2.kdf(
            credentials.secretAccessKey,
            dateStamp,
            conf.region,
            SERVICE,
          );
          this._credentialScope =
            `${dateStamp}/${conf.region}/${SERVICE}/aws4_request`;
          this._accessKeyId = credentials.accessKeyId;
          this._sessionToken = credentials.sessionToken;
        },
        get signingKey() {
          return this._signingKey;
        },
        get credentialScope() {
          return this._credentialScope;
        },
        get accessKeyId() {
          return this._accessKeyId;
        },
        get sessionToken() {
          return this._sessionToken;
        },
      };
    }
    exports_28("createCache", createCache);
    return {
      setters: [
        function (aws_signature_v4_ts_2_1) {
          aws_signature_v4_ts_2 = aws_signature_v4_ts_2_1;
        },
        function (util_ts_8_1) {
          util_ts_8 = util_ts_8_1;
        },
      ],
      execute: function () {
        /** Service name. */
        SERVICE = "dynamodb";
      },
    };
  },
);
System.register(
  "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/client/derive_config",
  [
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/deps",
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/client/create_cache",
  ],
  function (exports_29, context_29) {
    "use strict";
    var deps_ts_10, create_cache_ts_1;
    var __moduleName = context_29 && context_29.id;
    /** Derives host and endpoint. */
    function deriveHostEndpoint(region, port) {
      let host;
      let endpoint;
      if (region === "local") {
        host = "localhost";
        endpoint = `http://${host}:${port || 8000}/`;
      } else {
        host = `dynamodb.${region}.amazonaws.com`;
        endpoint = `https://${host}:443/`;
      }
      return { host, endpoint };
    }
    /** Derives an internal config object from a ClientConfig. */
    function deriveConfig(conf = {}) {
      const _conf = { ...conf };
      if (
        _conf.profile ||
        !_conf.region ||
        !_conf.credentials ||
        (typeof _conf.credentials !== "function" &&
          (!_conf.credentials.accessKeyId ||
            !_conf.credentials.secretAccessKey))
      ) {
        const got = deps_ts_10.get({ profile: _conf.profile });
        if (typeof _conf.credentials !== "function") {
          _conf.credentials = {
            accessKeyId: got.accessKeyId,
            secretAccessKey: got.secretAccessKey,
            sessionToken: got.sessionToken,
            ..._conf.credentials,
          };
        }
        _conf.region = got.region;
        if (
          typeof _conf.credentials !== "function" &&
          (!_conf.region ||
            !_conf.credentials.accessKeyId ||
            !_conf.credentials.secretAccessKey)
        ) {
          throw new Error("unable to derive aws config");
        }
      }
      return {
        ..._conf,
        cache: create_cache_ts_1.createCache(_conf),
        method: "POST",
        ...deriveHostEndpoint(_conf.region, _conf.port),
      };
    }
    exports_29("deriveConfig", deriveConfig);
    return {
      setters: [
        function (deps_ts_10_1) {
          deps_ts_10 = deps_ts_10_1;
        },
        function (create_cache_ts_1_1) {
          create_cache_ts_1 = create_cache_ts_1_1;
        },
      ],
      execute: function () {
      },
    };
  },
);
System.register(
  "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/client/mod",
  [
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/client/aws_signature_v4",
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/client/base_op",
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/client/derive_config",
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/client/create_headers",
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/client/translator",
  ],
  function (exports_30, context_30) {
    "use strict";
    var __moduleName = context_30 && context_30.id;
    return {
      setters: [
        function (aws_signature_v4_ts_3_1) {
          exports_30({
            "awsSignatureV4": aws_signature_v4_ts_3_1["awsSignatureV4"],
          });
        },
        function (base_op_ts_1_1) {
          exports_30({
            "baseOp": base_op_ts_1_1["baseOp"],
          });
        },
        function (derive_config_ts_1_1) {
          exports_30({
            "deriveConfig": derive_config_ts_1_1["deriveConfig"],
          });
        },
        function (create_headers_ts_2_1) {
          exports_30({
            "createHeaders": create_headers_ts_2_1["createHeaders"],
          });
        },
        function (translator_ts_2_1) {
          exports_30({
            "Translator": translator_ts_2_1["Translator"],
          });
        },
      ],
      execute: function () {
      },
    };
  },
);
System.register(
  "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/mod",
  [
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/client/mod",
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/util",
  ],
  function (exports_31, context_31) {
    "use strict";
    var mod_ts_14, util_ts_9, OPS;
    var __moduleName = context_31 && context_31.id;
    /** Creates a DynamoDB client. */
    function createClient(conf) {
      const _conf = mod_ts_14.deriveConfig(conf);
      const dyno = {};
      for (const op of OPS) {
        dyno[util_ts_9.camelCase(op)] = mod_ts_14.baseOp.bind(null, _conf, op);
      }
      return dyno;
    }
    exports_31("createClient", createClient);
    return {
      setters: [
        function (mod_ts_14_1) {
          mod_ts_14 = mod_ts_14_1;
        },
        function (util_ts_9_1) {
          util_ts_9 = util_ts_9_1;
        },
      ],
      execute: function () {
        /** DynamoDB operations. */
        exports_31(
          "OPS",
          OPS = new Set([
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
          ]),
        );
      },
    };
  },
);
System.register(
  "https://raw.githubusercontent.com/smallwins/deno-hashids/master/mod",
  [],
  function (exports_32, context_32) {
    "use strict";
    var Hashids;
    var __moduleName = context_32 && context_32.id;
    return {
      setters: [],
      execute: function () {
        Hashids = class Hashids {
          constructor(
            salt = "",
            minLength = 0,
            alphabet =
              "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
          ) {
            const minAlphabetLength = 16;
            const sepDiv = 3.5;
            const guardDiv = 12;
            const errorAlphabetLength =
              "error: alphabet must contain at least X unique characters";
            const errorAlphabetSpace = "error: alphabet cannot contain spaces";
            let uniqueAlphabet = "", sepsLength, diff;
            /* funcs */
            this.escapeRegExp = (s) =>
              s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
            this.parseInt = (v, radix) =>
              (/^(-|\+)?([0-9]+|Infinity)$/.test(v)) ? parseInt(v, radix) : NaN;
            /* alphabet vars */
            this.seps = "cfhistuCFHISTU";
            this.minLength = parseInt(minLength, 10) > 0 ? minLength : 0;
            this.salt = (typeof salt === "string") ? salt : "";
            if (typeof alphabet === "string") {
              this.alphabet = alphabet;
            }
            for (let i = 0; i !== this.alphabet.length; i++) {
              if (uniqueAlphabet.indexOf(this.alphabet.charAt(i)) === -1) {
                uniqueAlphabet += this.alphabet.charAt(i);
              }
            }
            this.alphabet = uniqueAlphabet;
            if (this.alphabet.length < minAlphabetLength) {
              throw errorAlphabetLength.replace("X", minAlphabetLength);
            }
            if (this.alphabet.search(" ") !== -1) {
              throw errorAlphabetSpace;
            }
            /*
                            `this.seps` should contain only characters present in `this.alphabet`
                            `this.alphabet` should not contains `this.seps`
                        */
            for (let i = 0; i !== this.seps.length; i++) {
              const j = this.alphabet.indexOf(this.seps.charAt(i));
              if (j === -1) {
                this.seps = this.seps.substr(0, i) + " " +
                  this.seps.substr(i + 1);
              } else {
                this.alphabet = this.alphabet.substr(0, j) + " " +
                  this.alphabet.substr(j + 1);
              }
            }
            this.alphabet = this.alphabet.replace(/ /g, "");
            this.seps = this.seps.replace(/ /g, "");
            this.seps = this._shuffle(this.seps, this.salt);
            if (
              !this.seps.length ||
              (this.alphabet.length / this.seps.length) > sepDiv
            ) {
              sepsLength = Math.ceil(this.alphabet.length / sepDiv);
              if (sepsLength > this.seps.length) {
                diff = sepsLength - this.seps.length;
                this.seps += this.alphabet.substr(0, diff);
                this.alphabet = this.alphabet.substr(diff);
              }
            }
            this.alphabet = this._shuffle(this.alphabet, this.salt);
            const guardCount = Math.ceil(this.alphabet.length / guardDiv);
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
            for (let i = 0; i !== numbers.length; i++) {
              numbers[i] = this.parseInt(numbers[i], 10);
              if (numbers[i] >= 0) {
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
            for (let i = 0; i !== numbers.length; i++) {
              numbers[i] = parseInt("1" + numbers[i], 16);
            }
            return this.encode.apply(this, numbers);
          }
          decodeHex(id) {
            let ret = [];
            const numbers = this.decode(id);
            for (let i = 0; i !== numbers.length; i++) {
              ret += (numbers[i]).toString(16).substr(1);
            }
            return ret;
          }
          _encode(numbers) {
            let ret, alphabet = this.alphabet, numbersIdInt = 0;
            for (let i = 0; i !== numbers.length; i++) {
              numbersIdInt += (numbers[i] % (i + 100));
            }
            ret = alphabet.charAt(numbersIdInt % alphabet.length);
            const lottery = ret;
            for (let i = 0; i !== numbers.length; i++) {
              let number = numbers[i];
              const buffer = lottery + this.salt + alphabet;
              alphabet = this._shuffle(
                alphabet,
                buffer.substr(0, alphabet.length),
              );
              const last = this._toAlphabet(number, alphabet);
              ret += last;
              if (i + 1 < numbers.length) {
                number %= (last.charCodeAt(0) + i);
                const sepsIndex = number % this.seps.length;
                ret += this.seps.charAt(sepsIndex);
              }
            }
            if (ret.length < this.minLength) {
              let guardIndex = (numbersIdInt + ret[0].charCodeAt(0)) %
                this.guards.length;
              let guard = this.guards[guardIndex];
              ret = guard + ret;
              if (ret.length < this.minLength) {
                guardIndex = (numbersIdInt + ret[2].charCodeAt(0)) %
                  this.guards.length;
                guard = this.guards[guardIndex];
                ret += guard;
              }
            }
            const halfLength = parseInt(alphabet.length / 2, 10);
            while (ret.length < this.minLength) {
              alphabet = this._shuffle(alphabet, alphabet);
              ret = alphabet.substr(halfLength) + ret +
                alphabet.substr(0, halfLength);
              const excess = ret.length - this.minLength;
              if (excess > 0) {
                ret = ret.substr(excess / 2, this.minLength);
              }
            }
            return ret;
          }
          _decode(id, alphabet) {
            let ret = [],
              i = 0,
              r = new RegExp(`[${this.escapeRegExp(this.guards)}]`, "g"),
              idBreakdown = id.replace(r, " "),
              idArray = idBreakdown.split(" ");
            if (idArray.length === 3 || idArray.length === 2) {
              i = 1;
            }
            idBreakdown = idArray[i];
            if (typeof idBreakdown[0] !== "undefined") {
              const lottery = idBreakdown[0];
              idBreakdown = idBreakdown.substr(1);
              r = new RegExp(`[${this.escapeRegExp(this.seps)}]`, "g");
              idBreakdown = idBreakdown.replace(r, " ");
              idArray = idBreakdown.split(" ");
              for (let j = 0; j !== idArray.length; j++) {
                const subId = idArray[j];
                const buffer = lottery + this.salt + alphabet;
                alphabet = this._shuffle(
                  alphabet,
                  buffer.substr(0, alphabet.length),
                );
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
            for (
              let i = alphabet.length - 1, v = 0, p = 0, j = 0; i > 0; i--, v++
            ) {
              v %= salt.length;
              p += integer = salt.charCodeAt(v);
              j = (integer + v + p) % i;
              const tmp = alphabet[j];
              alphabet[j] = alphabet[i];
              alphabet[i] = tmp;
            }
            alphabet = alphabet.join("");
            return alphabet;
          }
          _toAlphabet(input, alphabet) {
            let id = "";
            do {
              id = alphabet.charAt(input % alphabet.length) + id;
              input = parseInt(input / alphabet.length, 10);
            } while (input);
            return id;
          }
          _fromAlphabet(input, alphabet) {
            return input.split("").map((item) => alphabet.indexOf(item)).reduce(
              (carry, item) => carry * alphabet.length + item,
              0,
            );
          }
        };
        exports_32("Hashids", Hashids);
      },
    };
  },
);
System.register(
  "file:///Users/brianleroux/Repo/deno-begin-data/deps",
  [
    "https://raw.githubusercontent.com/chiefbiiko/dynamodb/master/mod",
    "https://raw.githubusercontent.com/smallwins/deno-hashids/master/mod",
  ],
  function (exports_33, context_33) {
    "use strict";
    var mod_ts_15, mod_js_1;
    var __moduleName = context_33 && context_33.id;
    /** get a ddb client */
    function createClient() {
      let env = Deno.env.toObject();
      if (env.NODE_ENV === "testing" || env.DENO_ENV === "testing") {
        let conf = {
          credentials: {
            accessKeyId: "DynamoDBLocal",
            secretAccessKey: "DoesNotDoAnyAuth",
            sessionToken: "preferTemporaryCredentials",
          },
          region: "local",
          port: 5000,
        };
        return mod_ts_15.createClient(conf);
      }
      return mod_ts_15.createClient();
    }
    exports_33("createClient", createClient);
    /** get the begin/data dynamodb table name */
    async function getTableName() {
      let env = Deno.env.toObject();
      // allow override
      if (env.BEGIN_DATA_TABLE_NAME) {
        return env.BEGIN_DATA_TABLE_NAME;
      }
      // check for local sandbox testing
      if (env.NODE_ENV === "testing" || env.DENO_ENV === "testing") {
        let db = createClient();
        let result = await db.listTables();
        return result.TableNames.find((t) => t.includes("-staging-data"));
      } else {
        // TODO SSM lookup here
      }
    }
    exports_33("getTableName", getTableName);
    /** get a begin/data key schema given options */
    function getKey(opts) {
      let env = Deno.env.toObject();
      let stage = env.DENO_ENV === "testing" ? "staging"
      : (env.DENO_ENV || "staging");
      let scopeID = env.BEGIN_DATA_SCOPE_ID || env.ARC_APP_NAME || "sandbox";
      let dataID = `${stage}#${opts.table}#${opts.key}`;
      return {
        scopeID,
        dataID,
      };
    }
    exports_33("getKey", getKey);
    /** create a key */
    async function createKey(table) {
      let TableName = await getTableName();
      let db = createClient();
      let env = Deno.env.toObject();
      let scopeID = env.BEGIN_DATA_SCOPE_ID || env.ARC_APP_NAME || "sandbox";
      let dataID = `${table}-seq`;
      let result = await db.updateItem({
        TableName,
        Key: { scopeID, dataID },
        AttributeUpdates: {
          idx: {
            Action: "ADD",
            Value: 1,
          },
        },
        ReturnValues: "UPDATED_NEW",
      });
      let hash = new mod_js_1.Hashids();
      let epoc = Date.now() - 1544909702376; // hbd
      let seed = Number(result.Attributes.idx);
      return hash.encode([epoc, seed]);
    }
    exports_33("createKey", createKey);
    /** convert an object from ddb */
    function unfmt(obj) {
      if (!obj) {
        return null;
      }
      let copy = { ...obj };
      copy.key = obj.dataID.split("#")[2];
      copy.table = obj.dataID.split("#")[1];
      delete copy.scopeID;
      delete copy.dataID;
      return copy;
    }
    exports_33("unfmt", unfmt);
    return {
      setters: [
        function (mod_ts_15_1) {
          mod_ts_15 = mod_ts_15_1;
        },
        function (mod_js_1_1) {
          mod_js_1 = mod_js_1_1;
        },
      ],
      execute: function () {
      },
    };
  },
);
System.register(
  "file:///Users/brianleroux/Repo/deno-begin-data/get",
  ["file:///Users/brianleroux/Repo/deno-begin-data/deps"],
  function (exports_34, context_34) {
    "use strict";
    var deps_ts_11;
    var __moduleName = context_34 && context_34.id;
    /** get an item */
    async function get(params) {
      // {table, key}
      if (params.table && params.key) {
        let [TableName, Key] = await Promise.all([
          deps_ts_11.getTableName(),
          deps_ts_11.getKey(params),
        ]);
        let { Item } = await deps_ts_11.createClient().getItem(
          { TableName, Key },
        );
        return deps_ts_11.unfmt(Item);
      }
      // {table}
      if (params.table && !params.key) {
        params.key = params.begin || "UNKNOWN";
        let [TableName, Key] = await Promise.all([
          deps_ts_11.getTableName(),
          deps_ts_11.getKey(params),
        ]);
        let { dataID, scopeID } = Key;
        dataID = dataID.replace("#UNKNOWN", "");
        let query = {
          TableName,
          Limit: params.limit || 10,
          KeyConditionExpression:
            "#scopeID = :scopeID and begins_with(#dataID, :dataID)",
          ExpressionAttributeNames: {
            "#scopeID": "scopeID",
            "#dataID": "dataID",
          },
          ExpressionAttributeValues: {
            ":scopeID": scopeID,
            ":dataID": dataID,
          },
        };
        if (params.cursor) {
          query.ExclusiveStartKey = JSON.parse(atob(params.cursor));
        }
        let result = await deps_ts_11.createClient().query(
          query,
          { iteratePages: false },
        );
        let exact = (item) => item.table === params.table;
        let returns = Array.isArray(result.Items)
          ? result.Items.map(deps_ts_11.unfmt).filter(exact)
          : [];
        if (result.LastEvaluatedKey) {
          returns.cursor = btoa(JSON.stringify(result.LastEvaluatedKey));
        }
        return returns;
      }
      // [{table, key}, {table, key}]
      if (Array.isArray(params)) {
        let TableName = await deps_ts_11.getTableName();
        let query = { RequestItems: {} };
        query.RequestItems[TableName] = { Keys: params.map(deps_ts_11.getKey) };
        let result = await deps_ts_11.createClient().batchGetItem(query);
        return result.Responses[TableName].map(deps_ts_11.unfmt);
      }
      throw Error("get_invalid");
    }
    exports_34("get", get);
    return {
      setters: [
        function (deps_ts_11_1) {
          deps_ts_11 = deps_ts_11_1;
        },
      ],
      execute: function () {
      },
    };
  },
);
System.register(
  "file:///Users/brianleroux/Repo/deno-begin-data/set",
  ["file:///Users/brianleroux/Repo/deno-begin-data/deps"],
  function (exports_35, context_35) {
    "use strict";
    var deps_ts_12;
    var __moduleName = context_35 && context_35.id;
    /** set record(s) */
    async function set(params) {
      let exec = Array.isArray(params) ? batch : one;
      return exec(params);
    }
    exports_35("set", set);
    /** set one record */
    async function one(params) {
      if (!params.key) {
        params.key = await deps_ts_12.createKey(params.table);
      }
      let [TableName, Key] = await Promise.all([
        deps_ts_12.getTableName(),
        deps_ts_12.getKey(params),
      ]);
      let copy = { ...params };
      delete copy.key;
      delete copy.table;
      await deps_ts_12.createClient().putItem({
        TableName,
        Item: { ...copy, ...Key },
      });
      return { ...params };
    }
    /** batch set records */
    async function batch(params) {
      let TableName = await deps_ts_12.getTableName();
      // ensure keys
      let ensure = await Promise.all(params.map((item) => {
        return async function () {
          if (!item.key) {
            item.key = await deps_ts_12.createKey(item.table);
          }
          return item;
        }();
      }));
      let batch = ensure.map(deps_ts_12.getKey).map((Item) => ({
        PutRequest: { Item },
      }));
      let query = { RequestItems: {} };
      query.RequestItems[TableName] = batch;
      await deps_ts_12.createClient().batchWriteItem(query);
      let clean = (item) => deps_ts_12.unfmt(item.PutRequest.Item);
      return batch.map(clean);
    }
    return {
      setters: [
        function (deps_ts_12_1) {
          deps_ts_12 = deps_ts_12_1;
        },
      ],
      execute: function () {
      },
    };
  },
);
System.register(
  "file:///Users/brianleroux/Repo/deno-begin-data/destroy",
  ["file:///Users/brianleroux/Repo/deno-begin-data/deps"],
  function (exports_36, context_36) {
    "use strict";
    var deps_ts_13;
    var __moduleName = context_36 && context_36.id;
    /** destroy record(s) */
    async function destroy(params) {
      // destroy batch
      if (Array.isArray(params)) {
        let TableName = await deps_ts_13.getTableName();
        let req = (Key) => ({ DeleteRequest: { Key } });
        let batch = params.map(deps_ts_13.getKey).map(req);
        let query = { RequestItems: {} };
        query.RequestItems[TableName] = batch;
        await deps_ts_13.createClient().batchWriteItem(query);
        return;
      }
      // destroy one
      if (params.table && params.key) {
        let [TableName, Key] = await Promise.all([
          deps_ts_13.getTableName(),
          deps_ts_13.getKey(params),
        ]);
        await deps_ts_13.createClient().deleteItem({ TableName, Key });
        return;
      }
      // destroy fail
      throw Error("destroy_invalid");
    }
    exports_36("destroy", destroy);
    return {
      setters: [
        function (deps_ts_13_1) {
          deps_ts_13 = deps_ts_13_1;
        },
      ],
      execute: function () {
      },
    };
  },
);
System.register(
  "file:///Users/brianleroux/Repo/deno-begin-data/incr",
  ["file:///Users/brianleroux/Repo/deno-begin-data/deps"],
  function (exports_37, context_37) {
    "use strict";
    var deps_ts_14;
    var __moduleName = context_37 && context_37.id;
    /** atomic increment */
    async function incr({ table, key, prop }) {
      let result = await deps_ts_14.createClient().updateItem({
        TableName: await deps_ts_14.getTableName(),
        Key: deps_ts_14.getKey({ table, key }),
        UpdateExpression: `SET ${prop} = if_not_exists(${prop}, :zero) + :val`,
        ExpressionAttributeValues: {
          ":val": 1,
          ":zero": 0,
        },
        ReturnValues: "ALL_NEW",
      });
      return result.Attributes;
    }
    exports_37("incr", incr);
    return {
      setters: [
        function (deps_ts_14_1) {
          deps_ts_14 = deps_ts_14_1;
        },
      ],
      execute: function () {
      },
    };
  },
);
System.register(
  "file:///Users/brianleroux/Repo/deno-begin-data/decr",
  ["file:///Users/brianleroux/Repo/deno-begin-data/deps"],
  function (exports_38, context_38) {
    "use strict";
    var deps_ts_15;
    var __moduleName = context_38 && context_38.id;
    /** atomic decrement */
    async function decr({ table, key, prop }) {
      let result = await deps_ts_15.createClient().updateItem({
        TableName: await deps_ts_15.getTableName(),
        Key: deps_ts_15.getKey({ table, key }),
        UpdateExpression: `SET ${prop} = if_not_exists(${prop}, :zero) - :val`,
        ExpressionAttributeValues: {
          ":val": 1,
          ":zero": 0,
        },
        ReturnValues: "ALL_NEW",
      });
      return result.Attributes;
    }
    exports_38("decr", decr);
    return {
      setters: [
        function (deps_ts_15_1) {
          deps_ts_15 = deps_ts_15_1;
        },
      ],
      execute: function () {
      },
    };
  },
);
System.register(
  "file:///Users/brianleroux/Repo/deno-begin-data/count",
  ["file:///Users/brianleroux/Repo/deno-begin-data/deps"],
  function (exports_39, context_39) {
    "use strict";
    var deps_ts_16;
    var __moduleName = context_39 && context_39.id;
    async function count({ table }) {
      let TableName = await deps_ts_16.getTableName();
      let { scopeID, dataID } = deps_ts_16.getKey({ table });
      let result = await deps_ts_16.createClient().query({
        TableName,
        Select: "COUNT",
        KeyConditionExpression:
          "#scopeID = :scopeID and begins_with(#dataID, :dataID)",
        ExpressionAttributeNames: {
          "#scopeID": "scopeID",
          "#dataID": "dataID",
        },
        ExpressionAttributeValues: {
          ":scopeID": scopeID,
          ":dataID": dataID.replace("#undefined", ""),
        },
      }, { iteratePages: false });
      return result.ScannedCount;
    }
    exports_39("count", count);
    return {
      setters: [
        function (deps_ts_16_1) {
          deps_ts_16 = deps_ts_16_1;
        },
      ],
      execute: function () {
      },
    };
  },
);
System.register(
  "file:///Users/brianleroux/Repo/deno-begin-data/page",
  ["file:///Users/brianleroux/Repo/deno-begin-data/mod"],
  function (exports_40, context_40) {
    "use strict";
    var mod_ts_16;
    var __moduleName = context_40 && context_40.id;
    async function page(props) {
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
          mod_ts_16.get(params).then(function got(result) {
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
    exports_40("page", page);
    return {
      setters: [
        function (mod_ts_16_1) {
          mod_ts_16 = mod_ts_16_1;
        },
      ],
      execute: function () {
      },
    };
  },
);
System.register(
  "file:///Users/brianleroux/Repo/deno-begin-data/mod",
  [
    "file:///Users/brianleroux/Repo/deno-begin-data/get",
    "file:///Users/brianleroux/Repo/deno-begin-data/set",
    "file:///Users/brianleroux/Repo/deno-begin-data/destroy",
    "file:///Users/brianleroux/Repo/deno-begin-data/incr",
    "file:///Users/brianleroux/Repo/deno-begin-data/decr",
    "file:///Users/brianleroux/Repo/deno-begin-data/count",
    "file:///Users/brianleroux/Repo/deno-begin-data/page",
  ],
  function (exports_41, context_41) {
    "use strict";
    var __moduleName = context_41 && context_41.id;
    return {
      setters: [
        function (get_js_1_1) {
          exports_41({
            "get": get_js_1_1["get"],
          });
        },
        function (set_js_1_1) {
          exports_41({
            "set": set_js_1_1["set"],
          });
        },
        function (destroy_js_1_1) {
          exports_41({
            "destroy": destroy_js_1_1["destroy"],
          });
        },
        function (incr_js_1_1) {
          exports_41({
            "incr": incr_js_1_1["incr"],
          });
        },
        function (decr_js_1_1) {
          exports_41({
            "decr": decr_js_1_1["decr"],
          });
        },
        function (count_js_1_1) {
          exports_41({
            "count": count_js_1_1["count"],
          });
        },
        function (page_js_1_1) {
          exports_41({
            "page": page_js_1_1["page"],
          });
        },
      ],
      execute: function () {
      },
    };
  },
);

const __exp = __instantiate(
  "file:///Users/brianleroux/Repo/deno-begin-data/mod",
);
export const get = __exp["get"];
export const set = __exp["set"];
export const destroy = __exp["destroy"];
export const incr = __exp["incr"];
export const decr = __exp["decr"];
export const count = __exp["count"];
export const page = __exp["page"];
