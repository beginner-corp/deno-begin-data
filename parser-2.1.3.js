// we-like-strings-LikeThisOne_or_2
const DASHERIZED = /^([a-zA-Z0-9_-]+)$/;

// Emptyness is not nothingness
const SPACE = / /;
const NEWLINE = /(\r\n|\r|\n)/;
const TAB = /\t/;

/**
 * reserved syntax:
 *
 * - # comments
 * - @ pragmas
 * - \ (we need for c style escaping like \n)
 * - {} braces
 * - [] brackets
 * - <> angle brackets
 *
 * (note: any of those symbols can be quoted)
 */
const PRAGMA = /\@/;
const COMMENT = /\#/;
const RESERVED = /\{|\}|\[|\]|\<|\>/;

/**
 * strings are REALLY loose in .arc formats!
 *
 * this allows to have config with full clean paths like
 * ./../foo/bar/baz.buzz
 *
 * allow:
 *
 * - open paren (
 * - close paren )
 * - slash /
 * - letters
 * - tilde ~
 * - dashes -
 * - underscore _
 * - dot .
 * - comma ,
 * - colon :
 * - dolla $
 * - star * (we use this for **String and *String for succinct Dynamo tables)
 * - question ?
 * - ampersand &
 * - bang !
 * - percent %
 * - equals =
 * - plus +
 * - pipe |
 * - caret ^
 * - backtick `
 * - single quote '
 * - double quote " is greedy, supports newlines and must have a closing "
 */
const STRING =
  /(\()|(\))|(\/)|([a-zA-Z0-9])|(-)|(\_)|(\.)|(\,)|(\:)|(\$)|(\*)|(\?)|(\&)|(\!)|(\%)|(\=)|(\+)|(\|)|(\^)|(\`)|(\')|(\")/;

/**
 * numbers (integer or float; negative modifier supported)
 */
const NUMBER = /(\-)|(\d)/;

/**
 * boolean literal constants: true and false
 */
const BOOLEAN = /(t)|(f)/;

var regexp = {
  DASHERIZED,
  SPACE,
  NEWLINE,
  TAB,
  PRAGMA,
  COMMENT,
  RESERVED,
  STRING,
  NUMBER,
  BOOLEAN,
};

var lexPragmaSyntax = class PragmaSyntaxError extends SyntaxError {
  constructor({ token, line, column }) {
    super(
      `pragma "${token}" has illegal character(s) (line: ${line} column: ${column})`,
    );
    this.line = line;
    this.column = column;
    this.name = this.constructor.name;
  }
};

var lexCloseQuoteNotFound = class CloseQuoteNotFoundError
  extends ReferenceError {
  constructor({ line, column }) {
    super(`closing quote not found (line: ${line} column: ${column})`);
    this.line = line;
    this.column = column;
    this.name = this.constructor.name;
  }
};

const {
  DASHERIZED: DASHERIZED$1,
  SPACE: SPACE$1,
  NEWLINE: NEWLINE$1,
  STRING: STRING$1,
} = regexp;

/**
 * helper for slicing out a lexeme token: pragma, comment, boolean, number or a string
 *
 * @param {number} cursor
 * @param {code} source code string
 * @returns {string} token
 */
var peek = {
  pragma(cursor, code, line, column) {
    let copy = code.slice(cursor, code.length);
    let matches = copy.match(NEWLINE$1);
    let end = matches && matches.index ? matches.index : code.length;
    let token = copy.slice(0, end).trim();
    if (!DASHERIZED$1.test(token.substring(1))) { //ignore the leading @
      throw new lexPragmaSyntax({ token, line, column });
    }
    return token;
  },

  comment(cursor, code) {
    let copy = code.slice(cursor, code.length);
    let matches = copy.match(NEWLINE$1);
    let end = matches && matches.index ? matches.index : code.length;
    return copy.slice(0, end);
  },

  bool(cursor, code) {
    let copy = code.slice(cursor, code.length);
    let mSpace = copy.match(SPACE$1);
    let mNewline = copy.match(NEWLINE$1);
    let iSpace = mSpace && mSpace.index ? mSpace.index : false;
    let iNewline = mNewline && mNewline.index ? mNewline.index : false;
    let end = (iSpace || iNewline)
      ? (iSpace && iSpace < iNewline ? iSpace : iNewline)
      : code.length;
    return copy.slice(0, end).trim();
  },

  number(cursor, code) {
    let copy = code.slice(cursor, code.length);
    let mSpace = copy.match(SPACE$1);
    let mNewline = copy.match(NEWLINE$1);
    let iSpace = mSpace && mSpace.index ? mSpace.index : false;
    let iNewline = mNewline && mNewline.index ? mNewline.index : false;
    let end = (iSpace || iNewline)
      ? (iSpace && iSpace < iNewline ? iSpace : iNewline)
      : code.length;
    return copy.slice(0, end).trim();
  },

  string(cursor, code, line, column) {
    let pointer = cursor;
    let character = code[cursor];
    let token = "";
    if (character === '"') {
      // seek ahead to next instance of " skipping any \" references
      let copy = code.slice(cursor + 1, code.length);
      let count = 0;
      let last = (function getNextQuote() {
        // create a copy of the code string
        let inner = copy.substring(count, copy.length);
        let index = inner.indexOf('"');
        // if we didn't find it blow up hard
        let notfound = index === -1;
        if (notfound) {
          throw new lexCloseQuoteNotFound({ line, column });
        }
        // if is not an excaped value return
        let escapee = inner[index - 1] === "\\";
        if (!escapee) {
          return index;
        }
        // by default continue searching
        count = index;
        getNextQuote();
      })();
      return copy.substring(0, last);
    } else {
      while (STRING$1.test(character)) {
        token += character;
        character = code[++pointer];
      }
      return token;
    }
  },
};

var lexUnknown = class UnknownCharacterError extends SyntaxError {
  constructor({ character, line, column }) {
    super(`unknown character "${character}" (line: ${line} column: ${column})`);
    this.line = line;
    this.column = column;
    this.name = this.constructor.name;
  }
};

let {
  SPACE: SPACE$2,
  TAB: TAB$1,
  NEWLINE: NEWLINE$2,
  PRAGMA: PRAGMA$1,
  COMMENT: COMMENT$1,
  STRING: STRING$2,
  NUMBER: NUMBER$1,
  BOOLEAN: BOOLEAN$1,
} = regexp;

/**
 * tokenizes code including spaces and newlines (which are significant) and comments (which are not)
 *
 * @param {string} code
 * @returns {array} tokens [{type, value, line, column}]
 */
var lexer = function lex(code) {
  // state bag for our tokens
  let tokens = [];

  // ensure code is terminated by a newline (stripped out later)
  code += "\n";

  // counters
  let cursor = 0;
  let line = 1;
  let column = 1;

  // stream the code one character at a time
  while (cursor < code.length) {
    if (PRAGMA$1.test(code[cursor])) {
      let token = peek.pragma(cursor, code, line, column);
      tokens.push({
        type: "pragma",
        value: token.substring(1),
        line,
        column,
      });
      cursor += token.length;
      column += token.length;
      continue;
    }

    if (COMMENT$1.test(code[cursor])) {
      let token = peek.comment(cursor, code);
      tokens.push({
        type: "comment",
        value: token,
        line,
        column,
      });
      cursor += token.length;
      column += token.length;
      continue;
    }

    if (SPACE$2.test(code[cursor])) {
      tokens.push({
        type: "space",
        value: " ",
        line,
        column,
      });
      cursor += 1;
      column += 1;
      continue;
    }

    // convert tabs to spaces
    if (TAB$1.test(code[cursor])) {
      tokens.push({
        type: "space",
        value: " ",
        line,
        column,
      });
      tokens.push({
        type: "space",
        value: " ",
        line,
        column,
      });
      cursor += 1;
      column += 1;
      continue;
    }

    if (NEWLINE$2.test(code[cursor])) {
      tokens.push({
        type: "newline",
        value: "\n",
        line,
        column,
      });
      cursor += 1;
      line += 1;
      column = 1;
      continue;
    }

    /* order important! this comes before str */
    if (BOOLEAN$1.test(code[cursor])) {
      let tmp = peek.bool(cursor, code);
      let isBoolean = tmp === "true" || tmp === "false";
      if (isBoolean) {
        tokens.push({
          type: "boolean",
          value: tmp === "false" ? false : true, // questionable
          line,
          column,
        });
        cursor += tmp.length;
        column += tmp.length;
        continue;
      }
    }

    /* order important! this needs to come before str */
    if (NUMBER$1.test(code[cursor])) {
      let token = peek.number(cursor, code);
      if (!Number.isNaN(Number(token))) {
        tokens.push({
          type: "number",
          value: Number(token),
          line,
          column,
        });
        cursor += token.length;
        column += token.length;
        continue;
      }
    }

    if (STRING$2.test(code[cursor])) {
      let token = peek.string(cursor, code, line, column);
      let quote = code[cursor] === '"';
      tokens.push({
        type: "string",
        value: token,
        line,
        column,
      });
      cursor += token.length + (quote ? 2 : 0);
      column += token.length + (quote ? 2 : 0);
      continue;
    }

    throw new lexUnknown({ character: code[cursor], line, column });
  }

  return tokens;
};

/**
 * predicate for not-empty token
 *
 * @param {token}
 * @returns {boolean}
 */
var _notEmpty = function notempty(t) {
  return !(t.type == "comment" || t.type == "newline" || t.type === "space");
};

/**
 * removes comments and empty lines
 *
 * @param {array} tokens
 * @returns {array} tokens
 */
var _compact = function compact(tokens) {
  // grabs a copy removing all comments
  let copy = tokens.slice(0).filter((t) => t.type != "comment");

  // get the indices of all newlines
  let newlines = copy.map((t, i) => t.type === "newline" ? i : false).filter(
    Boolean,
  );
  let newlinetokens = copy.map((t) => t.type === "newline" ? t : false).filter(
    Boolean,
  );
  let newlinemap = [];

  // get collection of lines: [[{token}, {token}], [{token, token}]]
  let lines = newlines.reduce(function linebreak(collection, newline, index) {
    let start = index === 0 ? index : newlines[index - 1] + 1;
    let line = copy.slice(start, newline);
    let empty = line.filter(_notEmpty).length === 0;
    if (!empty) {
      collection.push(line);
      newlinemap.push(newlinetokens[newlines.indexOf(newline)]);
    }
    return collection;
  }, []);

  // flatten result; ignoring leading spaces and newlines
  let found = false;
  let index = 0;
  let result = [];

  for (let line of lines) {
    for (let t of line) {
      let ignore = t.type == "space" || t.type == "newline";
      if (ignore === false && found === false) {
        found = true;
      }
      if (found) {
        result.push(t);
      }
    }
    result.push(newlinemap[index]);
    index += 1;
  }

  return result;
};

var parseArrayIllegalSpace = class SpaceError extends SyntaxError {
  constructor({ line, column }) {
    super(`illegal indent (line: ${line} column: ${column})`);
    this.line = line;
    this.column = column;
    this.name = this.constructor.name;
  }
};

/**
 * extract an array value from a list of tokens
 *
 * @param {lines} an array of tokens
 * @returns {object} {end, value}
 */
var array = function array(lines) {
  let copy = lines.slice(0);
  let end = copy[0].length + 1;
  let value = copy[0].filter(_notEmpty).map((t) => t.value);

  let nextline = copy.length > 1 && lines[1][0].type == "space";
  if (nextline) {
    throw new parseArrayIllegalSpace(lines[1][0]);
  }

  return { end, value };
};

var parseVectorNameNotString = class VectorNameNotStrng extends SyntaxError {
  constructor({ line, column }) {
    super(`vector name is not a string (line: ${line} column: ${column})`);
    this.line = line;
    this.column = column;
    this.name = this.constructor.name;
  }
};

/**
 * extract a vector value
 *
 * @param {array} lines
 * @param {number} index
 * @returns {object} {end, value}
 */
var vector = function vector(lines) {
  let copy = lines.slice(0);
  let end = copy[0].length + 1; // len of the tokes in the line plus one for the line itself
  let raw = copy.shift().filter(_notEmpty)[0];
  let name = raw.value;

  if (!name || raw.type != "string") {
    throw new parseVectorNameNotString(lines[0][0]);
  }

  let value = {};
  value[name] = [];

  let done = false;
  while (!done) {
    let line = copy.shift();
    let indented = Array.isArray(line) && line.length > 2 &&
      line[0].type == "space" && line[1].type == "space";
    if (indented && done === false) {
      end += 1; // one for the line
      end += line.length; // for all the tokens in the given line
      value[name].push(line.filter(_notEmpty)[0].value);
    } else {
      done = true;
    }
  }

  return { end, value };
};

var parseMapIllegalSpace = class SpaceError extends SyntaxError {
  constructor({ line, column }) {
    super(`illegal indent (line: ${line} column: ${column})`);
    this.line = line;
    this.column = column;
    this.name = this.constructor.name;
  }
};

var parseMapNameNotString = class MapNameNotString extends SyntaxError {
  constructor({ line, column }) {
    super(`map name is not a string (line: ${line} column: ${column})`);
    this.line = line;
    this.column = column;
    this.name = this.constructor.name;
  }
};

var parseMapKeyNotString = class MapKeyNotStrng extends SyntaxError {
  constructor({ line, column }) {
    super(`map key is not a string (line: ${line} column: ${column})`);
    this.line = line;
    this.column = column;
    this.name = this.constructor.name;
  }
};

/**
 * extracts a map value
 *
 * @param {lines}
 * @param {number} index
 * @returns {object} {end, value}
 */
var map = function map(lines) {
  // extract the `name` and create the `end` index
  let copy = lines.slice(0);
  let end = copy[0].length + 1; // length of the current line plus one for the line
  let raw = copy.shift().filter(_notEmpty)[0];
  let name = raw.value;

  if (!name || raw.type != "string") {
    throw new parseMapNameNotString(lines[0][0]);
  }

  // final state to return for the map token
  let value = {};
  value[name] = {};

  // keep score
  let last = false;
  let done = false;

  while (!done) {
    // figure out the indentation of the next line
    let line = copy.shift();
    let { onespace, twospace, threespace, fourspace, fivespace } = spaces(line);

    if (onespace || threespace || fivespace) {
      throw new parseMapIllegalSpace(line[0]);
    }

    if (fourspace && done === false) {
      // four spaces signals a vector value
      if (line.filter(_notEmpty).length > 1) {
        throw new parseMapKeyNotString(line[0]);
      }
      end += 1; // one for the line
      end += line.length; // for all the tokens in the given line
      let right = line.filter(_notEmpty)[0].value;
      value[name][last].push(right);
    } else if (twospace && done === false) {
      // two spaces signals a key/value
      end += 1; // one for the line
      end += line.length; // for all the tokens in the given line
      let right = line.filter(_notEmpty).slice(0);
      let left = right.shift();
      if (left.type != "string") {
        throw new parseMapKeyNotString(left);
      }
      last = left.value; // reuse this for vert vector trapping
      value[name][left.value] = right.length === 1
        ? right[0].value
        : right.map((t) => t.value);
    } else {
      // indentation is over: we out
      done = true;
    }
  }
  return { end, value };
};

/** hide this here */
function spaces(line) {
  if (!Array.isArray(line)) {
    return {
      onespace: false,
      twospace: false,
      threespace: false,
      fourspace: false,
      fivespace: false,
    };
  }
  let onespace = line.length > 2 && line[0].type == "space" &&
    line[1].type != "space";
  let twospace = line.length > 2 && line[0].type == "space" &&
    line[1].type == "space";
  let threespace = line.length >= 4 && line[0].type == "space" &&
    line[1].type == "space" && line[2].type == "space" &&
    line[3].type != "space";
  let fourspace = line.length >= 5 && line[0].type == "space" &&
    line[1].type == "space" && line[2].type == "space" &&
    line[3].type == "space";
  let fivespace = line.length >= 5 && line[0].type == "space" &&
    line[1].type == "space" && line[2].type == "space" &&
    line[3].type == "space" && line[4].type == "space";
  return { onespace, twospace, threespace, fourspace, fivespace };
}

var parseTypeUnknown = class TypeUnknownError extends TypeError {
  constructor({ line, column }) {
    super(`type unknown (line: ${1} column: ${1})`);
    this.line = line;
    this.column = column;
    this.name = this.constructor.name;
  }
};

/**
 * extracts scalar, array, vector and map values
 *
 * @param {object} params
 * @param {array} params.tokens
 * @param {number} params.index
 *
 * @example
 * string-scalar-value
 *
 * array of values
 *
 * named
 *   vector
 *   of
 *   values
 *
 * map
 *   key value
 *   one true
 *   vector 1 2 3
 *
 * map
 *   named
 *     vector
 *     of
 *     values
 */
var getType = function type({ tokens, index }) {
  // working copy of the relevant tokens
  let working = tokens.slice(index, tokens.length);

  // get the indices of all newlines
  let newlines = working.map((t, i) => t.type === "newline" ? i : false).filter(
    Boolean,
  );

  // get collection of lines: [[{token}, {token}], [{token, token}]]
  let lines = newlines.reduce(function linebreak(collection, newline, index) {
    let start = index === 0 ? index : newlines[index - 1] + 1;
    collection.push(working.slice(start, newline));
    return collection;
  }, []);

  // extract the first three lines
  let [first, second, third] = lines;

  // is the second line indented two spaces? (signaling a named vector or map value)
  let indent = Array.isArray(second) && second.length >= 3 &&
    second[0].type === "space" && second[1].type === "space";

  // is the third line indented four spaces? (signaling a map with an initial named vector value)
  let vectorindent = Array.isArray(third) && third.length > 4 &&
    third[0].type == "space" && third[1].type == "space" &&
    third[2].type == "space" && third[3].type == "space";

  // is the second line a scalar (singular) value?
  let singular = second && second.filter(_notEmpty).length === 1 &&
    vectorindent === false;

  let scalar = first.filter(_notEmpty).length === 1;

  // do we have a scalar string|number|boolean value?
  // do we have a possible array or vector value?
  // do we have a possible map value?
  let is = {
    scalar: scalar && indent === false, // string, number or boolean
    array: scalar === false, // array of scalar values
    vector: scalar && indent === true && singular === true, // vector of scalar values
    map: scalar && indent === true && singular === false, // map of keys and values (scalar or vector)
  };

  if (is.scalar) {
    return { end: 1, value: tokens[index].value };
  }

  if (is.array) {
    return array(lines);
  }

  if (is.vector) {
    return vector(lines);
  }

  if (is.map) {
    return map(lines);
  }

  throw new parseTypeUnknown(tokens[index]);
};

var parsePragmaNotFound = class PragmaNotFound extends ReferenceError {
  constructor({ line, column }) {
    super(`opening @pragma not found (line: ${1} column: ${1})`);
    this.line = line;
    this.column = column;
    this.name = this.constructor.name;
  }
};

var parsePragmaAlreadyDefined = class PragmaNotFound extends ReferenceError {
  constructor({ value, line, column }) {
    super(`@${value} pragma already defined (line: ${line} column: ${column})`);
    this.line = line;
    this.column = column;
    this.name = this.constructor.name;
  }
};

/**
 * parses tokens into JSON friendly structure if possible
 *
 * @param {array} raw tokens
 * @returns {object}
 */
var parser = function parse(raw, sourcemap = false) {
  let tokens = _compact(raw);
  // console.log({tokens})

  // arcfiles must begin with an @pragma
  if (tokens[0].type != "pragma") {
    throw new parsePragmaNotFound();
  }

  let arc = {};
  let src = {};
  let pragma = false;
  let index = 0;

  while (index < tokens.length) {
    let token = tokens[index];

    if (token.type === "pragma") {
      // pragmas must be unique
      if ({}.hasOwnProperty.call(arc, token.value)) {
        throw new parsePragmaAlreadyDefined(token);
      }

      // create the pragma
      arc[token.value] = [];

      // create a source map
      src[token.value] = [];

      // keep a ref to the current pragma
      pragma = token.value;
      index += 1;
    }

    // ignore newlines and spaces
    let empty = token.type === "newline" || token.type === "space";
    if (empty) {
      index += 1;
    }

    if (
      token.type === "number" || token.type === "boolean" ||
      token.type === "string"
    ) {
      let { end, value } = getType({ tokens, index });
      arc[pragma].push(value);
      src[pragma].push({ start: token, end: tokens[index + end] });
      index += end;
    }
  }

  return sourcemap ? { arc, src } : arc;
};

/**
 * Adjusts cardinality of some Architect specific keys to make them nicer to author in JSON, YAML and TOML
 */
var json = function parseJSON(text) {
  let SKIP = ["macros", "events", "queues", "tables", "indexes", "cdn", "ws"];
  let KNOWN = ["app", "aws", "static", "http", "scheduled"].concat(SKIP);

  let json = JSON.parse(text);
  let result = {};

  for (let section of Object.keys(json)) {
    // passthru
    if (SKIP.includes(section)) {
      result[section] = json[section];
      continue;
    }

    // convert app:name to app:[name]
    if (section === "app" && Array.isArray(json[section]) === false) {
      result[section] = [json[section]];
      continue;
    }

    // convert plain objects to tuples (aws, static, scheduled)
    // this will add unknown pragmas that are top level objects too
    if (
      Array.isArray(json[section]) === false &&
      typeof json[section] === "object"
    ) {
      if (!result[section]) {
        result[section] = [];
      }
      Object.keys(json[section]).forEach((key) => {
        let value = [key, json[section][key]];
        result[section].push(value);
      });
      continue;
    }

    // ensure we add unknown pragmas; just pass thru
    if (Array.isArray(json[section]) && KNOWN.includes(section) === false) {
      result[section] = json[section];
      continue;
    }

    // convert array of objects [{get: '/'}] to tuples [['get', '/']]
    if (section === "http") {
      if (!result[section]) {
        result[section] = [];
      }
      json[section].forEach((route) => {
        if (Array.isArray(route) === false && typeof route === "object") {
          let verb = Object.keys(route)[0];
          let tuple = [verb, route[verb]];
          result[section].push(tuple);
        } else if (Array.isArray(route)) {
          result[section].push(route);
        } else {
          throw Error("invalid route type");
        }
      });
      continue;
    }

    if (KNOWN.includes(section) && Array.isArray(json[section])) {
      result[section] = json[section];
      continue;
    }

    // end of pragma loop
  }

  return result;
};

function unwrapExports(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default")
    ? x["default"]
    : x;
}

function createCommonjsModule(fn, module) {
  return module = { exports: {} }, fn(module, module.exports), module.exports;
}

function getCjsExportFromNamespace(n) {
  return n && n["default"] || n;
}

var jsYaml3_13_1_min = createCommonjsModule(function (module, exports) {
  !function (e) {
    module.exports = e();
  }(function () {
    return function o(a, s, c) {
      function u(t, e) {
        if (!s[t]) {
          if (!a[t]) {
            var n = "function" == typeof require && require;
            if (!e && n) return n(t, !0);
            if (l) return l(t, !0);
            var i = new Error("Cannot find module '" + t + "'");
            throw i.code = "MODULE_NOT_FOUND", i;
          }
          var r = s[t] = { exports: {} };
          a[t][0].call(
            r.exports,
            function (e) {
              return u(a[t][1][e] || e);
            },
            r,
            r.exports,
            o,
            a,
            s,
            c,
          );
        }
        return s[t].exports;
      }
      for (
        var l = "function" == typeof require && require, e = 0;
        e < c.length;
        e++
      ) {
        u(c[e]);
      }
      return u;
    }(
      {
        1: [
          function (e, t, n) {
            var i = e("./js-yaml/loader"), r = e("./js-yaml/dumper");
            function o(e) {
              return function () {
                throw new Error(
                  "Function " + e + " is deprecated and cannot be used.",
                );
              };
            }
            t.exports.Type = e("./js-yaml/type"),
              t.exports.Schema = e("./js-yaml/schema"),
              t.exports.FAILSAFE_SCHEMA = e("./js-yaml/schema/failsafe"),
              t.exports.JSON_SCHEMA = e("./js-yaml/schema/json"),
              t.exports.CORE_SCHEMA = e("./js-yaml/schema/core"),
              t.exports.DEFAULT_SAFE_SCHEMA = e(
                "./js-yaml/schema/default_safe",
              ),
              t.exports.DEFAULT_FULL_SCHEMA = e(
                "./js-yaml/schema/default_full",
              ),
              t.exports.load = i.load,
              t.exports.loadAll = i.loadAll,
              t.exports.safeLoad = i.safeLoad,
              t.exports.safeLoadAll = i.safeLoadAll,
              t.exports.dump = r.dump,
              t.exports.safeDump = r.safeDump,
              t.exports.YAMLException = e("./js-yaml/exception"),
              t.exports.MINIMAL_SCHEMA = e("./js-yaml/schema/failsafe"),
              t.exports.SAFE_SCHEMA = e("./js-yaml/schema/default_safe"),
              t.exports.DEFAULT_SCHEMA = e("./js-yaml/schema/default_full"),
              t.exports.scan = o("scan"),
              t.exports.parse = o("parse"),
              t.exports.compose = o("compose"),
              t.exports.addConstructor = o("addConstructor");
          },
          {
            "./js-yaml/dumper": 3,
            "./js-yaml/exception": 4,
            "./js-yaml/loader": 5,
            "./js-yaml/schema": 7,
            "./js-yaml/schema/core": 8,
            "./js-yaml/schema/default_full": 9,
            "./js-yaml/schema/default_safe": 10,
            "./js-yaml/schema/failsafe": 11,
            "./js-yaml/schema/json": 12,
            "./js-yaml/type": 13,
          },
        ],
        2: [function (e, t, n) {
          function i(e) {
            return null == e;
          }
          t.exports.isNothing = i,
            t.exports.isObject = function (e) {
              return "object" == typeof e && null !== e;
            },
            t.exports.toArray = function (e) {
              return Array.isArray(e) ? e : i(e) ? [] : [e];
            },
            t.exports.repeat = function (e, t) {
              var n, i = "";
              for (n = 0; n < t; n += 1) i += e;
              return i;
            },
            t.exports.isNegativeZero = function (e) {
              return 0 === e && Number.NEGATIVE_INFINITY === 1 / e;
            },
            t.exports.extend = function (e, t) {
              var n, i, r, o;
              if (t) {
                for (n = 0, i = (o = Object.keys(t)).length; n < i; n += 1) {
                  e[r = o[n]] = t[r];
                }
              }
              return e;
            };
        }, {}],
        3: [
          function (e, t, n) {
            var c = e("./common"),
              d = e("./exception"),
              i = e("./schema/default_full"),
              r = e("./schema/default_safe"),
              p = Object.prototype.toString,
              u = Object.prototype.hasOwnProperty,
              o = 9,
              h = 10,
              a = 32,
              f = 33,
              m = 34,
              g = 35,
              y = 37,
              x = 38,
              v = 39,
              A = 42,
              b = 44,
              w = 45,
              C = 58,
              k = 62,
              j = 63,
              S = 64,
              I = 91,
              O = 93,
              E = 96,
              F = 123,
              _ = 124,
              N = 125,
              s = {
                0: "\\0",
                7: "\\a",
                8: "\\b",
                9: "\\t",
                10: "\\n",
                11: "\\v",
                12: "\\f",
                13: "\\r",
                27: "\\e",
                34: '\\"',
                92: "\\\\",
                133: "\\N",
                160: "\\_",
                8232: "\\L",
                8233: "\\P",
              },
              l = [
                "y",
                "Y",
                "yes",
                "Yes",
                "YES",
                "on",
                "On",
                "ON",
                "n",
                "N",
                "no",
                "No",
                "NO",
                "off",
                "Off",
                "OFF",
              ];
            function M(e) {
              var t, n, i;
              if (t = e.toString(16).toUpperCase(), e <= 255) n = "x", i = 2;
              else if (e <= 65535) n = "u", i = 4;
              else {
                if (!(e <= 4294967295)) {
                  throw new d(
                    "code point within a string may not be greater than 0xFFFFFFFF",
                  );
                }
                n = "U", i = 8;
              }
              return "\\" + n + c.repeat("0", i - t.length) + t;
            }
            function T(e) {
              this.schema = e.schema || i,
                this.indent = Math.max(1, e.indent || 2),
                this.noArrayIndent = e.noArrayIndent || !1,
                this.skipInvalid = e.skipInvalid || !1,
                this.flowLevel = c.isNothing(e.flowLevel) ? -1 : e.flowLevel,
                this.styleMap = function (e, t) {
                  var n, i, r, o, a, s, c;
                  if (null === t) return {};
                  for (
                    n = {}, r = 0, o = (i = Object.keys(t)).length;
                    r < o;
                    r += 1
                  ) {
                    a = i[r],
                      s = String(t[a]),
                      "!!" === a.slice(0, 2) &&
                      (a = "tag:yaml.org,2002:" + a.slice(2)),
                      (c = e.compiledTypeMap.fallback[a]) &&
                      u.call(c.styleAliases, s) && (s = c.styleAliases[s]),
                      n[a] = s;
                  }
                  return n;
                }(this.schema, e.styles || null),
                this.sortKeys = e.sortKeys || !1,
                this.lineWidth = e.lineWidth || 80,
                this.noRefs = e.noRefs || !1,
                this.noCompatMode = e.noCompatMode || !1,
                this.condenseFlow = e.condenseFlow || !1,
                this.implicitTypes = this.schema.compiledImplicit,
                this.explicitTypes = this.schema.compiledExplicit,
                this.tag = null,
                this.result = "",
                this.duplicates = [],
                this.usedDuplicates = null;
            }
            function L(e, t) {
              for (
                var n,
                  i = c.repeat(" ", t),
                  r = 0,
                  o = -1,
                  a = "",
                  s = e.length;
                r < s;
              ) {
                r = -1 === (o = e.indexOf("\n", r))
                  ? (n = e.slice(r), s)
                  : (n = e.slice(r, o + 1), o + 1),
                  n.length && "\n" !== n && (a += i),
                  a += n;
              }
              return a;
            }
            function D(e, t) {
              return "\n" + c.repeat(" ", e.indent * t);
            }
            function U(e) {
              return e === a || e === o;
            }
            function q(e) {
              return 32 <= e && e <= 126 ||
                161 <= e && e <= 55295 && 8232 !== e && 8233 !== e ||
                57344 <= e && e <= 65533 && 65279 !== e ||
                65536 <= e && e <= 1114111;
            }
            function Y(e) {
              return q(e) && 65279 !== e && e !== b && e !== I && e !== O &&
                e !== F && e !== N && e !== C && e !== g;
            }
            function R(e) {
              return /^\n* /.test(e);
            }
            var B = 1, P = 2, W = 3, K = 4, $ = 5;
            function H(e, t, n, i, r) {
              var o,
                a,
                s = !1,
                c = !1,
                u = -1 !== i,
                l = -1,
                p = function (e) {
                  return q(e) && 65279 !== e && !U(e) && e !== w && e !== j &&
                    e !== C && e !== b && e !== I && e !== O && e !== F &&
                    e !== N && e !== g && e !== x && e !== A && e !== f &&
                    e !== _ && e !== k && e !== v && e !== m && e !== y &&
                    e !== S && e !== E;
                }(e.charCodeAt(0)) && !U(e.charCodeAt(e.length - 1));
              if (t) {
                for (o = 0; o < e.length; o++) {
                  if (!q(a = e.charCodeAt(o))) return $;
                  p = p && Y(a);
                }
              } else {
                for (o = 0; o < e.length; o++) {
                  if ((a = e.charCodeAt(o)) === h) {
                    s = !0,
                      u && (c = c || i < o - l - 1 && " " !== e[l + 1], l = o);
                  } else if (!q(a)) return $;
                  p = p && Y(a);
                }
                c = c || u && i < o - l - 1 && " " !== e[l + 1];
              }
              return s || c
                ? 9 < n && R(e) ? $ : c ? K : W
                : p && !r(e)
                ? B
                : P;
            }
            function G(i, r, o, a) {
              i.dump = function () {
                if (0 === r.length) return "''";
                if (!i.noCompatMode && -1 !== l.indexOf(r)) {
                  return "'" + r + "'";
                }
                var e = i.indent * Math.max(1, o),
                  t = -1 === i.lineWidth
                    ? -1
                    : Math.max(Math.min(i.lineWidth, 40), i.lineWidth - e),
                  n = a || -1 < i.flowLevel && o >= i.flowLevel;
                switch (
                  H(r, n, i.indent, t, function (e) {
                    return function (e, t) {
                      var n, i;
                      for (n = 0, i = e.implicitTypes.length; n < i; n += 1) {
                        if (e.implicitTypes[n].resolve(t)) return !0;
                      }
                      return !1;
                    }(i, e);
                  })
                ) {
                  case B:
                    return r;
                  case P:
                    return "'" + r.replace(/'/g, "''") + "'";
                  case W:
                    return "|" + V(r, i.indent) + Z(L(r, e));
                  case K:
                    return ">" + V(r, i.indent) + Z(L(
                      function (t, n) {
                        var e,
                          i,
                          r = /(\n+)([^\n]*)/g,
                          o = function () {
                            var e = t.indexOf("\n");
                            return e = -1 !== e ? e : t.length,
                              r.lastIndex = e,
                              z(t.slice(0, e), n);
                          }(),
                          a = "\n" === t[0] || " " === t[0];
                        for (; i = r.exec(t);) {
                          var s = i[1], c = i[2];
                          e = " " === c[0],
                            o += s + (a || e || "" === c ? "" : "\n") + z(c, n),
                            a = e;
                        }
                        return o;
                      }(r, t),
                      e,
                    ));
                  case $:
                    return '"' + function (e) {
                      for (var t, n, i, r = "", o = 0; o < e.length; o++) {
                        55296 <= (t = e.charCodeAt(o)) && t <= 56319 &&
                        56320 <= (n = e.charCodeAt(o + 1)) && n <= 57343
                          ? (r += M(1024 * (t - 55296) + n - 56320 + 65536),
                            o++)
                          : (i = s[t], r += !i && q(t) ? e[o] : i || M(t));
                      }
                      return r;
                    }(r) + '"';
                  default:
                    throw new d("impossible error: invalid scalar style");
                }
              }();
            }
            function V(e, t) {
              var n = R(e) ? String(t) : "", i = "\n" === e[e.length - 1];
              return n + (i && ("\n" === e[e.length - 2] || "\n" === e)
                ? "+"
                : i
                ? ""
                : "-") + "\n";
            }
            function Z(e) {
              return "\n" === e[e.length - 1] ? e.slice(0, -1) : e;
            }
            function z(e, t) {
              if ("" === e || " " === e[0]) return e;
              for (
                var n, i, r = / [^ ]/g, o = 0, a = 0, s = 0, c = "";
                n = r.exec(e);
              ) {
                t < (s = n.index) - o &&
                (i = o < a ? a : s, c += "\n" + e.slice(o, i), o = i + 1),
                  a = s;
              }
              return c += "\n",
                e.length - o > t && o < a
                  ? c += e.slice(o, a) + "\n" + e.slice(a + 1)
                  : c += e.slice(o),
                c.slice(1);
            }
            function J(e, t, n) {
              var i, r, o, a, s, c;
              for (
                o = 0, a = (r = n ? e.explicitTypes : e.implicitTypes).length;
                o < a;
                o += 1
              ) {
                if (
                  ((s = r[o]).instanceOf || s.predicate) &&
                  (!s.instanceOf ||
                    "object" == typeof t && t instanceof s.instanceOf) &&
                  (!s.predicate || s.predicate(t))
                ) {
                  if (e.tag = n ? s.tag : "?", s.represent) {
                    if (
                      c = e.styleMap[s.tag] || s.defaultStyle,
                        "[object Function]" === p.call(s.represent)
                    ) {
                      i = s.represent(t, c);
                    } else {
                      if (!u.call(s.represent, c)) {
                        throw new d(
                          "!<" + s.tag + '> tag resolver accepts not "' + c +
                            '" style',
                        );
                      }
                      i = s.represent[c](t, c);
                    }
                    e.dump = i;
                  }
                  return !0;
                }
              }
              return !1;
            }
            function Q(e, t, n, i, r, o) {
              e.tag = null, e.dump = n, J(e, n, !1) || J(e, n, !0);
              var a = p.call(e.dump);
              i && (i = e.flowLevel < 0 || e.flowLevel > t);
              var s, c, u = "[object Object]" === a || "[object Array]" === a;
              if (
                u && (c = -1 !== (s = e.duplicates.indexOf(n))),
                  (null !== e.tag && "?" !== e.tag || c ||
                    2 !== e.indent && 0 < t) && (r = !1),
                  c && e.usedDuplicates[s]
              ) {
                e.dump = "*ref_" + s;
              } else {
                if (
                  u && c && !e.usedDuplicates[s] && (e.usedDuplicates[s] = !0),
                    "[object Object]" === a
                ) {
                  i && 0 !== Object.keys(e.dump).length
                    ? (function (e, t, n, i) {
                      var r,
                        o,
                        a,
                        s,
                        c,
                        u,
                        l = "",
                        p = e.tag,
                        f = Object.keys(n);
                      if (!0 === e.sortKeys) f.sort();
                      else if ("function" == typeof e.sortKeys) {
                        f.sort(e.sortKeys);
                      } else if (e.sortKeys) {
                        throw new d("sortKeys must be a boolean or a function");
                      }
                      for (r = 0, o = f.length; r < o; r += 1) {
                        u = "",
                          i && 0 === r || (u += D(e, t)),
                          s = n[a = f[r]],
                          Q(e, t + 1, a, !0, !0, !0) &&
                          ((c = null !== e.tag && "?" !== e.tag ||
                            e.dump && 1024 < e.dump.length) &&
                            (e.dump && h === e.dump.charCodeAt(0)
                              ? u += "?"
                              : u += "? "),
                            u += e.dump,
                            c && (u += D(e, t)),
                            Q(e, t + 1, s, !0, c) &&
                            (e.dump && h === e.dump.charCodeAt(0)
                              ? u += ":"
                              : u += ": ",
                              l += u += e.dump));
                      }
                      e.tag = p, e.dump = l || "{}";
                    }(e, t, e.dump, r),
                      c && (e.dump = "&ref_" + s + e.dump))
                    : (function (e, t, n) {
                      var i, r, o, a, s, c = "", u = e.tag, l = Object.keys(n);
                      for (
                        i = 0, r = l.length; i < r; i += 1
                      ) {
                        s = e.condenseFlow ? '"' : "",
                          0 !== i && (s += ", "),
                          a = n[o = l[i]],
                          Q(e, t, o, !1, !1) &&
                          (1024 < e.dump.length && (s += "? "),
                            s += e.dump + (e.condenseFlow ? '"' : "") + ":" +
                              (e.condenseFlow ? "" : " "),
                            Q(e, t, a, !1, !1) && (c += s += e.dump));
                      }
                      e.tag = u, e.dump = "{" + c + "}";
                    }(e, t, e.dump),
                      c && (e.dump = "&ref_" + s + " " + e.dump));
                } else if ("[object Array]" === a) {
                  var l = e.noArrayIndent && 0 < t ? t - 1 : t;
                  i && 0 !== e.dump.length
                    ? (function (e, t, n, i) {
                      var r, o, a = "", s = e.tag;
                      for (r = 0, o = n.length; r < o; r += 1) {
                        Q(e, t + 1, n[r], !0, !0) &&
                          (i && 0 === r || (a += D(e, t)),
                            e.dump && h === e.dump.charCodeAt(0)
                              ? a += "-"
                              : a += "- ",
                            a += e.dump);
                      }
                      e.tag = s, e.dump = a || "[]";
                    }(e, l, e.dump, r),
                      c && (e.dump = "&ref_" + s + e.dump))
                    : (function (e, t, n) {
                      var i, r, o = "", a = e.tag;
                      for (i = 0, r = n.length; i < r; i += 1) {
                        Q(e, t, n[i], !1, !1) &&
                          (0 !== i && (o += "," + (e.condenseFlow
                            ? ""
                            : " ")),
                            o += e.dump);
                      }
                      e.tag = a, e.dump = "[" + o + "]";
                    }(e, l, e.dump),
                      c && (e.dump = "&ref_" + s + " " + e.dump));
                } else {
                  if ("[object String]" !== a) {
                    if (e.skipInvalid) {
                      return !1;
                    }
                    throw new d("unacceptable kind of an object to dump " + a);
                  }
                  "?" !== e.tag && G(e, e.dump, t, o);
                }
                null !== e.tag && "?" !== e.tag &&
                  (e.dump = "!<" + e.tag + "> " + e.dump);
              }
              return !0;
            }
            function X(e, t) {
              var n, i, r = [], o = [];
              for (
                function e(t, n, i) {
                  var r, o, a;
                  if (null !== t && "object" == typeof t) {
                    if (-1 !== (o = n.indexOf(t))) {
                      -1 === i.indexOf(o) && i.push(o);
                    } else if (n.push(t), Array.isArray(t)) {
                      for (o = 0, a = t.length; o < a; o += 1) {
                        e(t[o], n, i);
                      }
                    } else {
                      for (
                        r = Object.keys(t), o = 0, a = r.length; o < a; o += 1
                      ) {
                        e(t[r[o]], n, i);
                      }
                    }
                  }
                }(e, r, o),
                  n = 0,
                  i = o.length;
                n < i;
                n += 1
              ) {
                t.duplicates.push(r[o[n]]);
              }
              t.usedDuplicates = new Array(i);
            }
            function ee(e, t) {
              var n = new T(t = t || {});
              return n.noRefs || X(e, n),
                Q(n, 0, e, !0, !0) ? n.dump + "\n" : "";
            }
            t.exports.dump = ee,
              t.exports.safeDump = function (e, t) {
                return ee(e, c.extend({ schema: r }, t));
              };
          },
          {
            "./common": 2,
            "./exception": 4,
            "./schema/default_full": 9,
            "./schema/default_safe": 10,
          },
        ],
        4: [function (e, t, n) {
          function i(e, t) {
            Error.call(this),
              this.name = "YAMLException",
              this.reason = e,
              this.mark = t,
              this.message = (this.reason || "(unknown reason)") +
                (this.mark ? " " + this.mark.toString() : ""),
              Error.captureStackTrace
                ? Error.captureStackTrace(this, this.constructor)
                : this.stack = (new Error()).stack || "";
          }
          ((i.prototype = Object.create(Error.prototype)).constructor = i)
            .prototype.toString = function (e) {
              var t = this.name + ": ";
              return t += this.reason || "(unknown reason)",
                !e && this.mark && (t += " " + this.mark.toString()),
                t;
            }, t.exports = i;
        }, {}],
        5: [
          function (e, t, n) {
            var g = e("./common"),
              i = e("./exception"),
              r = e("./mark"),
              o = e("./schema/default_safe"),
              a = e("./schema/default_full"),
              y = Object.prototype.hasOwnProperty,
              x = 1,
              v = 2,
              A = 3,
              b = 4,
              w = 1,
              C = 2,
              k = 3,
              c =
                /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/,
              s = /[\x85\u2028\u2029]/,
              u = /[,\[\]\{\}]/,
              l = /^(?:!|!!|![a-z\-]+!)$/i,
              p =
                /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;
            function f(e) {
              return Object.prototype.toString.call(e);
            }
            function j(e) {
              return 10 === e || 13 === e;
            }
            function S(e) {
              return 9 === e || 32 === e;
            }
            function I(e) {
              return 9 === e || 32 === e || 10 === e || 13 === e;
            }
            function O(e) {
              return 44 === e || 91 === e || 93 === e || 123 === e || 125 === e;
            }
            function d(e) {
              return 48 === e ? "\0" : 97 === e ? "" : 98 === e
              ? "\b"
              : 116 === e
              ? "\t"
              : 9 === e
              ? "\t"
              : 110 === e
              ? "\n"
              : 118 === e
              ? "\v"
              : 102 === e
              ? "\f"
              : 114 === e
              ? "\r"
              : 101 === e
              ? ""
              : 32 === e
              ? " "
              : 34 === e
              ? '"'
              : 47 === e
              ? "/"
              : 92 === e
              ? "\\"
              : 78 === e
              ? ""
              : 95 === e
              ? " "
              : 76 === e
              ? "\u2028"
              : 80 === e
              ? "\u2029"
              : "";
            }
            for (
              var E = new Array(256), F = new Array(256), h = 0; h < 256; h++
            ) {
              E[h] = d(h) ? 1 : 0, F[h] = d(h);
            }
            function m(e, t) {
              this.input = e,
                this.filename = t.filename || null,
                this.schema = t.schema || a,
                this.onWarning = t.onWarning || null,
                this.legacy = t.legacy || !1,
                this.json = t.json || !1,
                this.listener = t.listener || null,
                this.implicitTypes = this.schema.compiledImplicit,
                this.typeMap = this.schema.compiledTypeMap,
                this.length = e.length,
                this.position = 0,
                this.line = 0,
                this.lineStart = 0,
                this.lineIndent = 0,
                this.documents = [];
            }
            function _(e, t) {
              return new i(
                t,
                new r(
                  e.filename,
                  e.input,
                  e.position,
                  e.line,
                  e.position - e.lineStart,
                ),
              );
            }
            function N(e, t) {
              throw _(e, t);
            }
            function M(e, t) {
              e.onWarning && e.onWarning.call(null, _(e, t));
            }
            var T = {
              YAML: function (e, t, n) {
                var i, r, o;
                null !== e.version && N(e, "duplication of %YAML directive"),
                  1 !== n.length &&
                  N(e, "YAML directive accepts exactly one argument"),
                  null === (i = /^([0-9]+)\.([0-9]+)$/.exec(n[0])) &&
                  N(e, "ill-formed argument of the YAML directive"),
                  r = parseInt(i[1], 10),
                  o = parseInt(i[2], 10),
                  1 !== r &&
                  N(e, "unacceptable YAML version of the document"),
                  e.version = n[0],
                  e.checkLineBreaks = o < 2,
                  1 !== o && 2 !== o &&
                  M(e, "unsupported YAML version of the document");
              },
              TAG: function (e, t, n) {
                var i, r;
                2 !== n.length &&
                N(e, "TAG directive accepts exactly two arguments"),
                  i = n[0],
                  r = n[1],
                  l.test(i) ||
                  N(
                    e,
                    "ill-formed tag handle (first argument) of the TAG directive",
                  ),
                  y.call(e.tagMap, i) &&
                  N(
                    e,
                    'there is a previously declared suffix for "' + i +
                      '" tag handle',
                  ),
                  p.test(r) ||
                  N(
                    e,
                    "ill-formed tag prefix (second argument) of the TAG directive",
                  ),
                  e.tagMap[i] = r;
              },
            };
            function L(e, t, n, i) {
              var r, o, a, s;
              if (t < n) {
                if (s = e.input.slice(t, n), i) {
                  for (
                    r = 0, o = s.length; r < o; r += 1
                  ) {
                    9 === (a = s.charCodeAt(r)) ||
                      32 <= a && a <= 1114111 ||
                      N(e, "expected valid JSON character");
                  }
                } else {
                  c.test(s) &&
                    N(e, "the stream contains non-printable characters");
                }
                e.result += s;
              }
            }
            function D(e, t, n, i) {
              var r, o, a, s;
              for (
                g.isObject(n) ||
                N(
                  e,
                  "cannot merge mappings; the provided source object is unacceptable",
                ),
                  a = 0,
                  s = (r = Object.keys(n)).length;
                a < s;
                a += 1
              ) {
                o = r[a], y.call(t, o) || (t[o] = n[o], i[o] = !0);
              }
            }
            function U(e, t, n, i, r, o, a, s) {
              var c, u;
              if (Array.isArray(r)) {
                for (
                  c = 0, u = (r = Array.prototype.slice.call(r)).length;
                  c < u;
                  c += 1
                ) {
                  Array.isArray(r[c]) &&
                  N(e, "nested arrays are not supported inside keys"),
                    "object" == typeof r && "[object Object]" === f(r[c]) &&
                    (r[c] = "[object Object]");
                }
              }
              if (
                "object" == typeof r && "[object Object]" === f(r) &&
                (r = "[object Object]"),
                  r = String(r),
                  null === t && (t = {}),
                  "tag:yaml.org,2002:merge" === i
              ) {
                if (Array.isArray(o)) {
                  for (c = 0, u = o.length; c < u; c += 1) D(e, t, o[c], n);
                } else D(e, t, o, n);
              } else {
                e.json || y.call(n, r) || !y.call(t, r) ||
                (e.line = a || e.line,
                  e.position = s || e.position,
                  N(e, "duplicated mapping key")),
                  t[r] = o,
                  delete n[r];
              }
              return t;
            }
            function q(e) {
              var t;
              10 === (t = e.input.charCodeAt(e.position))
                ? e.position++
                : 13 === t
                ? (e.position++,
                  10 === e.input.charCodeAt(e.position) && e.position++)
                : N(e, "a line break is expected"),
                e.line += 1,
                e.lineStart = e.position;
            }
            function Y(e, t, n) {
              for (var i = 0, r = e.input.charCodeAt(e.position); 0 !== r;) {
                for (; S(r);) r = e.input.charCodeAt(++e.position);
                if (t && 35 === r) {
                  for (
                    ;
                    10 !== (r = e.input.charCodeAt(++e.position)) &&
                    13 !== r && 0 !== r;
                  );
                }
                if (!j(r)) break;
                for (
                  q(e),
                    r = e.input.charCodeAt(e.position),
                    i++,
                    e.lineIndent = 0;
                  32 === r;
                ) {
                  e.lineIndent++, r = e.input.charCodeAt(++e.position);
                }
              }
              return -1 !== n && 0 !== i && e.lineIndent < n &&
                M(e, "deficient indentation"),
                i;
            }
            function R(e) {
              var t, n = e.position;
              return !(45 !== (t = e.input.charCodeAt(n)) && 46 !== t ||
                t !== e.input.charCodeAt(n + 1) ||
                t !== e.input.charCodeAt(n + 2) ||
                (n += 3, 0 !== (t = e.input.charCodeAt(n)) && !I(t)));
            }
            function B(e, t) {
              1 === t
                ? e.result += " "
                : 1 < t && (e.result += g.repeat("\n", t - 1));
            }
            function P(e, t) {
              var n, i, r = e.tag, o = e.anchor, a = [], s = !1;
              for (
                null !== e.anchor && (e.anchorMap[e.anchor] = a),
                  i = e.input.charCodeAt(e.position);
                0 !== i && 45 === i && I(e.input.charCodeAt(e.position + 1));
              ) {
                if (s = !0, e.position++, Y(e, !0, -1) && e.lineIndent <= t) {
                  a.push(null), i = e.input.charCodeAt(e.position);
                } else if (
                  n = e.line,
                    $(e, t, A, !1, !0),
                    a.push(e.result),
                    Y(e, !0, -1),
                    i = e.input.charCodeAt(e.position),
                    (e.line === n || e.lineIndent > t) && 0 !== i
                ) {
                  N(e, "bad indentation of a sequence entry");
                } else if (e.lineIndent < t) { 
                  break;
                }
              }
              return !!s &&
                (e.tag = r,
                  e.anchor = o,
                  e.kind = "sequence",
                  e.result = a,
                  !0);
            }
            function W(e) {
              var t, n, i, r, o = !1, a = !1;
              if (33 !== (r = e.input.charCodeAt(e.position))) return !1;
              if (
                null !== e.tag && N(e, "duplication of a tag property"),
                  60 === (r = e.input.charCodeAt(++e.position))
                    ? (o = !0, r = e.input.charCodeAt(++e.position))
                    : 33 === r
                    ? (a = !0, n = "!!", r = e.input.charCodeAt(++e.position))
                    : n = "!",
                  t = e.position,
                  o
              ) {
                for (
                  ; 0 !== (r = e.input.charCodeAt(++e.position)) && 62 !== r;
                );
                e.position < e.length
                  ? (i = e.input.slice(t, e.position),
                    r = e.input.charCodeAt(++e.position))
                  : N(e, "unexpected end of the stream within a verbatim tag");
              } else {
                for (; 0 !== r && !I(r);) {
                  33 === r && (a
                    ? N(e, "tag suffix cannot contain exclamation marks")
                    : (n = e.input.slice(t - 1, e.position + 1),
                      l.test(n) ||
                      N(e, "named tag handle cannot contain such characters"),
                      a = !0,
                      t = e.position + 1)),
                    r = e.input.charCodeAt(++e.position);
                }
                i = e.input.slice(t, e.position),
                  u.test(i) &&
                  N(e, "tag suffix cannot contain flow indicator characters");
              }
              return i && !p.test(i) &&
                N(e, "tag name cannot contain such characters: " + i),
                o
                  ? e.tag = i
                  : y.call(e.tagMap, n)
                  ? e.tag = e.tagMap[n] + i
                  : "!" === n
                  ? e.tag = "!" + i
                  : "!!" === n
                  ? e.tag = "tag:yaml.org,2002:" + i
                  : N(e, 'undeclared tag handle "' + n + '"'),
                !0;
            }
            function K(e) {
              var t, n;
              if (38 !== (n = e.input.charCodeAt(e.position))) { 
                return !1;
              }
              for (
                null !== e.anchor &&
                N(e, "duplication of an anchor property"),
                  n = e.input.charCodeAt(++e.position),
                  t = e.position;
                0 !== n && !I(n) && !O(n);
              ) {
                n = e.input.charCodeAt(++e.position);
              }
              return e.position === t &&
                N(
                  e,
                  "name of an anchor node must contain at least one character",
                ),
                e.anchor = e.input.slice(t, e.position),
                !0;
            }
            function $(e, t, n, i, r) {
              var o, a, s, c, u, l, p, f, d = 1, h = !1, m = !1;
              if (
                null !== e.listener && e.listener("open", e),
                  e.tag = null,
                  e.anchor = null,
                  e.kind = null,
                  e.result = null,
                  o = a = s = b === n || A === n,
                  i && Y(e, !0, -1) &&
                  (h = !0,
                    e.lineIndent > t
                      ? d = 1
                      : e.lineIndent === t
                      ? d = 0
                      : e.lineIndent < t && (d = -1)),
                  1 === d
              ) {
                for (; W(e) || K(e);) {
                  Y(e, !0, -1)
                    ? (h = !0,
                      s = o,
                      e.lineIndent > t ? d = 1 : e.lineIndent === t
                      ? d = 0
                      : e.lineIndent < t && (d = -1))
                    : s = !1;
                }
              }
              if (
                s && (s = h || r),
                  1 !== d && b !== n || (p = x === n || v === n
                    ? t
                    : t + 1,
                    f = e.position - e.lineStart,
                    1 === d
                      ? s && (P(e, f) || function (e, t, n) {
                            var i,
                              r,
                              o,
                              a,
                              s,
                              c = e.tag,
                              u = e.anchor,
                              l = {},
                              p = {},
                              f = null,
                              d = null,
                              h = null,
                              m = !1,
                              g = !1;
                            for (
                              null !== e.anchor &&
                              (e.anchorMap[e.anchor] = l),
                                s = e.input.charCodeAt(e.position);
                              0 !== s;
                            ) {
                              if (
                                i = e.input.charCodeAt(e.position + 1),
                                  o = e.line,
                                  a = e.position,
                                  63 !== s && 58 !== s || !I(i)
                              ) {
                                if (!$(e, n, v, !1, !0)) break;
                                if (e.line === o) {
                                  for (
                                    s = e.input.charCodeAt(e.position); S(s);
                                  ) {
                                    s = e.input.charCodeAt(++e.position);
                                  }
                                  if (58 === s) {
                                    I(s = e.input.charCodeAt(++e.position)) ||
                                    N(
                                      e,
                                      "a whitespace character is expected after the key-value separator within a block mapping",
                                    ),
                                      m &&
                                      (U(e, l, p, f, d, null),
                                        f = d = h = null),
                                      r = m = !(g = !0),
                                      f = e.tag,
                                      d = e.result;
                                  } else {
                                    if (!g) return e.tag = c, e.anchor = u, !0;
                                    N(
                                      e,
                                      "can not read an implicit mapping pair; a colon is missed",
                                    );
                                  }
                                } else {
                                  if (!g) return e.tag = c, e.anchor = u, !0;
                                  N(
                                    e,
                                    "can not read a block mapping entry; a multiline key may not be an implicit key",
                                  );
                                }
                              } else {
                                63 === s
                                  ? (m &&
                                    (U(e, l, p, f, d, null), f = d = h = null),
                                    r = m = g = !0)
                                  : m
                                  ? r = !(m = !1)
                                  : N(
                                    e,
                                    "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line",
                                  ),
                                  e.position += 1,
                                  s = i;
                              }
                              if (
                                (e.line === o || e.lineIndent > t) &&
                                ($(e, t, b, !0, r) && (m
                                  ? d = e.result
                                  : h = e.result),
                                  m ||
                                  (U(e, l, p, f, d, h, o, a), f = d = h = null),
                                  Y(e, !0, -1),
                                  s = e.input.charCodeAt(e.position)),
                                  e.lineIndent > t && 0 !== s
                              ) {
                                N(e, "bad indentation of a mapping entry");
                              } else if (e.lineIndent < t) break;
                            }
                            return m && U(e, l, p, f, d, null),
                              g &&
                              (e.tag = c,
                                e.anchor = u,
                                e.kind = "mapping",
                                e.result = l),
                              g;
                          }(e, f, p)) || function (e, t) {
                        var n,
                          i,
                          r,
                          o,
                          a,
                          s,
                          c,
                          u,
                          l,
                          p,
                          f = !0,
                          d = e.tag,
                          h = e.anchor,
                          m = {};
                        if (
                          91 === (p = e.input.charCodeAt(e.position))
                        ) {
                          s = !(r = 93), i = [];
                        } else {
                          if (123 !== p) return !1;
                          r = 125, s = !0, i = {};
                        }
                        for (
                          null !== e.anchor && (e.anchorMap[e.anchor] = i),
                            p = e.input.charCodeAt(++e.position);
                          0 !== p;
                        ) {
                          if (
                            Y(e, !0, t),
                              (p = e.input.charCodeAt(e.position)) === r
                          ) {
                            return e.position++,
                              e.tag = d,
                              e.anchor = h,
                              e.kind = s ? "mapping" : "sequence",
                              e.result = i,
                              !0;
                          }
                          f ||
                          N(e, "missed comma between flow collection entries"),
                            l = null,
                            o = a = !1,
                            63 === p &&
                            I(e.input.charCodeAt(e.position + 1)) &&
                            (o = a = !0, e.position++, Y(e, !0, t)),
                            n = e.line,
                            $(e, t, x, !1, !0),
                            u = e.tag,
                            c = e.result,
                            Y(e, !0, t),
                            p = e.input.charCodeAt(e.position),
                            !a && e.line !== n || 58 !== p ||
                            (o = !0,
                              p = e.input.charCodeAt(++e.position),
                              Y(e, !0, t),
                              $(e, t, x, !1, !0),
                              l = e.result),
                            s
                              ? U(e, i, m, u, c, l)
                              : o
                              ? i.push(U(e, null, m, u, c, l))
                              : i.push(c),
                            Y(e, !0, t),
                            44 === (p = e.input.charCodeAt(e.position))
                              ? (f = !0, p = e.input.charCodeAt(++e.position))
                              : f = !1;
                        }
                        N(
                          e,
                          "unexpected end of the stream within a flow collection",
                        );
                      }(e, p)
                        ? m = !0
                        : (a && function (e, t) {
                              var n,
                                i,
                                r,
                                o,
                                a,
                                s = w,
                                c = !1,
                                u = !1,
                                l = t,
                                p = 0,
                                f = !1;
                              if (
                                124 === (o = e.input.charCodeAt(e.position))
                              ) {
                                i = !1;
                              } else {
                                if (62 !== o) return !1;
                                i = !0;
                              }
                              for (e.kind = "scalar", e.result = ""; 0 !== o;) {
                                if (
                                  43 ===
                                    (o = e.input.charCodeAt(++e.position)) ||
                                  45 === o
                                ) {
                                  w === s
                                    ? s = 43 === o ? k : C
                                    : N(
                                      e,
                                      "repeat of a chomping mode identifier",
                                    );
                                } else {
                                  if (
                                    !(0 <= (r = 48 <= (a = o) && a <= 57
                                      ? a - 48
                                      : -1))
                                  ) {
                                    break;
                                  }
                                  0 == r
                                    ? N(
                                      e,
                                      "bad explicit indentation width of a block scalar; it cannot be less than one",
                                    )
                                    : u
                                    ? N(
                                      e,
                                      "repeat of an indentation width identifier",
                                    )
                                    : (l = t + r - 1, u = !0);
                                }
                              }
                              if (S(o)) {
                                for (
                                  ; S(o = e.input.charCodeAt(++e.position));
                                );
                                if (35 === o) {
                                  for (
                                    ;
                                    !j(o = e.input.charCodeAt(++e.position)) &&
                                    0 !== o;
                                  );
                                }
                              }
                              for (; 0 !== o;) {
                                for (
                                  q(e),
                                    e.lineIndent = 0,
                                    o = e.input.charCodeAt(e.position);
                                  (!u || e.lineIndent < l) && 32 === o;
                                ) {
                                  e.lineIndent++,
                                    o = e.input.charCodeAt(++e.position);
                                }
                                if (
                                  !u && e.lineIndent > l && (l = e.lineIndent),
                                    j(o)
                                ) {
                                  p++;
                                } else {
                                  if (e.lineIndent < l) {
                                    s === k
                                      ? e.result += g.repeat(
                                        "\n",
                                        c ? 1 + p : p,
                                      )
                                      : s === w && c && (e.result += "\n");
                                    break;
                                  }
                                  for (
                                    i
                                      ? S(o)
                                        ? (f = !0,
                                          e.result += g.repeat(
                                            "\n",
                                            c ? 1 + p : p,
                                          ))
                                        : f
                                        ? (f = !1,
                                          e.result += g.repeat("\n", p + 1))
                                        : 0 === p
                                        ? c && (e.result += " ")
                                        : e.result += g.repeat("\n", p)
                                      : e.result += g.repeat(
                                        "\n",
                                        c ? 1 + p : p,
                                      ),
                                      u = c = !0,
                                      p = 0,
                                      n = e.position;
                                    !j(o) && 0 !== o;
                                  ) {
                                    o = e.input.charCodeAt(++e.position);
                                  }
                                  L(e, n, e.position, !1);
                                }
                              }
                              return !0;
                            }(e, p) || function (e, t) {
                          var n, i, r;
                          if (
                            39 !== (n = e.input.charCodeAt(e.position))
                          ) {
                            return !1;
                          }
                          for (
                            e.kind = "scalar",
                              e.result = "",
                              e.position++,
                              i = r = e.position;
                            0 !== (n = e.input.charCodeAt(e.position));
                          ) {
                            if (39 === n) {
                              if (
                                L(e, i, e.position, !0),
                                  39 !== (n = e.input.charCodeAt(++e.position))
                              ) {
                                return !0;
                              }
                              i = e.position, e.position++, r = e.position;
                            } else {
                              j(n)
                                ? (L(e, i, r, !0),
                                  B(e, Y(e, !1, t)),
                                  i = r = e.position)
                                : e.position === e.lineStart && R(e)
                                ? N(
                                  e,
                                  "unexpected end of the document within a single quoted scalar",
                                )
                                : (e.position++, r = e.position);
                            }
                          }
                          N(
                            e,
                            "unexpected end of the stream within a single quoted scalar",
                          );
                        }(e, p) || function (e, t) {
                          var n, i, r, o, a, s, c, u, l, p;
                          if (
                            34 !== (s = e.input.charCodeAt(e.position))
                          ) {
                            return !1;
                          }
                          for (
                            e.kind = "scalar",
                              e.result = "",
                              e.position++,
                              n = i = e.position;
                            0 !== (s = e.input.charCodeAt(e.position));
                          ) {
                            if (34 === s) {
                              return L(e, n, e.position, !0), e.position++, !0;
                            }
                            if (92 === s) {
                              if (
                                L(e, n, e.position, !0),
                                  j(s = e.input.charCodeAt(++e.position))
                              ) {
                                Y(e, !1, t);
                              } else if (s < 256 && E[s]) {
                                e.result += F[s], e.position++;
                              } else if (
                                0 < (a = 120 === (p = s)
                                  ? 2
                                  : 117 === p
                                  ? 4
                                  : 85 === p
                                  ? 8
                                  : 0)
                              ) {
                                for (
                                  r = a, o = 0; 0 < r; r--
                                ) {
                                  s = e.input.charCodeAt(++e.position),
                                    l = void 0,
                                    0 <=
                                      (a = 48 <= (u = s) && u <= 57
                                        ? u - 48
                                        : 97 <= (l = 32 | u) && l <= 102
                                        ? l - 97 + 10
                                        : -1)
                                      ? o = (o << 4) + a
                                      : N(e, "expected hexadecimal character");
                                }
                                e.result += (c = o) <= 65535
                                  ? String.fromCharCode(c)
                                  : String.fromCharCode(
                                    55296 + (c - 65536 >> 10),
                                    56320 + (c - 65536 & 1023),
                                  ), e.position++;
                              } else N(e, "unknown escape sequence");
                              n = i = e.position;
                            } else {
                              j(s)
                                ? (L(e, n, i, !0),
                                  B(e, Y(e, !1, t)),
                                  n = i = e.position)
                                : e.position === e.lineStart && R(e)
                                ? N(
                                  e,
                                  "unexpected end of the document within a double quoted scalar",
                                )
                                : (e.position++, i = e.position);
                            }
                          }
                          N(
                            e,
                            "unexpected end of the stream within a double quoted scalar",
                          );
                        }(e, p)
                          ? m = !0
                          : !function (e) {
                            var t, n, i;
                            if (
                              42 !== (i = e.input.charCodeAt(e.position))
                            ) {
                              return !1;
                            }
                            for (
                              i = e.input.charCodeAt(++e.position),
                                t = e.position;
                              0 !== i && !I(i) && !O(i);
                            ) {
                              i = e.input.charCodeAt(++e.position);
                            }
                            return e.position === t &&
                              N(
                                e,
                                "name of an alias node must contain at least one character",
                              ),
                              n = e.input.slice(t, e.position),
                              e.anchorMap.hasOwnProperty(n) ||
                              N(e, 'unidentified alias "' + n + '"'),
                              e.result = e.anchorMap[n],
                              Y(e, !0, -1),
                              !0;
                          }(e)
                          ? function (e, t, n) {
                            var i,
                              r,
                              o,
                              a,
                              s,
                              c,
                              u,
                              l,
                              p = e.kind,
                              f = e.result;
                            if (
                              I(l = e.input.charCodeAt(e.position)) || O(l) ||
                              35 === l || 38 === l || 42 === l || 33 === l ||
                              124 === l || 62 === l || 39 === l || 34 === l ||
                              37 === l || 64 === l || 96 === l
                            ) {
                              return !1;
                            }
                            if (
                              (63 === l || 45 === l) &&
                              (I(i = e.input.charCodeAt(e.position + 1)) ||
                                n && O(i))
                            ) {
                              return !1;
                            }
                            for (
                              e.kind = "scalar",
                                e.result = "",
                                r = o = e.position,
                                a = !1;
                              0 !== l;
                            ) {
                              if (58 === l) {
                                if (
                                  I(i = e.input.charCodeAt(e.position + 1)) ||
                                  n && O(i)
                                ) {
                                  break;
                                }
                              } else if (35 === l) {
                                if (I(e.input.charCodeAt(e.position - 1))) {
                                  break;
                                }
                              } else {
                                if (
                                  e.position === e.lineStart && R(e) ||
                                  n && O(l)
                                ) {
                                  break;
                                }
                                if (j(l)) {
                                  if (
                                    s = e.line,
                                      c = e.lineStart,
                                      u = e.lineIndent,
                                      Y(e, !1, -1),
                                      e.lineIndent >= t
                                  ) {
                                    a = !0, l = e.input.charCodeAt(e.position);
                                    continue;
                                  }
                                  e.position = o,
                                    e.line = s,
                                    e.lineStart = c,
                                    e.lineIndent = u;
                                  break;
                                }
                              }
                              a &&
                              (L(e, r, o, !1),
                                B(e, e.line - s),
                                r = o = e.position,
                                a = !1),
                                S(l) || (o = e.position + 1),
                                l = e.input.charCodeAt(++e.position);
                            }
                            return L(e, r, o, !1),
                              !!e.result || (e.kind = p, e.result = f, !1);
                          }(e, p, x === n) &&
                            (m = !0, null === e.tag && (e.tag = "?"))
                          : (m = !0,
                            null === e.tag && null === e.anchor ||
                            N(e, "alias node should not have any properties")),
                          null !== e.anchor &&
                          (e.anchorMap[e.anchor] = e.result))
                      : 0 === d && (m = s && P(e, f))),
                  null !== e.tag && "!" !== e.tag
              ) {
                if ("?" === e.tag) {
                  for (c = 0, u = e.implicitTypes.length; c < u; c += 1) {
                    if ((l = e.implicitTypes[c]).resolve(e.result)) {
                      e.result = l.construct(e.result),
                        e.tag = l.tag,
                        null !== e.anchor &&
                        (e.anchorMap[e.anchor] = e.result);
                      break;
                    }
                  }
                } else {
                  y.call(e.typeMap[e.kind || "fallback"], e.tag)
                    ? (l = e.typeMap[e.kind || "fallback"][e.tag],
                      null !== e.result && l.kind !== e.kind &&
                      N(
                        e,
                        "unacceptable node kind for !<" + e.tag +
                          '> tag; it should be "' + l.kind + '", not "' +
                          e.kind + '"',
                      ),
                      l.resolve(e.result)
                        ? (e.result = l.construct(e.result),
                          null !== e.anchor &&
                          (e.anchorMap[e.anchor] = e.result))
                        : N(
                          e,
                          "cannot resolve a node with !<" + e.tag +
                            "> explicit tag",
                        ))
                    : N(e, "unknown tag !<" + e.tag + ">");
                }
              }
              return null !== e.listener && e.listener("close", e),
                null !== e.tag || null !== e.anchor || m;
            }
            function H(e) {
              var t, n, i, r, o = e.position, a = !1;
              for (
                e.version = null,
                  e.checkLineBreaks = e.legacy,
                  e.tagMap = {},
                  e.anchorMap = {};
                0 !== (r = e.input.charCodeAt(e.position)) &&
                (Y(e, !0, -1),
                  r = e.input.charCodeAt(e.position),
                  !(0 < e.lineIndent || 37 !== r));
              ) {
                for (
                  a = !0, r = e.input.charCodeAt(++e.position), t = e.position;
                  0 !== r && !I(r);
                ) {
                  r = e.input.charCodeAt(++e.position);
                }
                for (
                  i = [],
                    (n = e.input.slice(t, e.position)).length < 1 &&
                    N(
                      e,
                      "directive name must not be less than one character in length",
                    );
                  0 !== r;
                ) {
                  for (; S(r);) r = e.input.charCodeAt(++e.position);
                  if (35 === r) {
                    for (
                      ; 0 !== (r = e.input.charCodeAt(++e.position)) && !j(r);
                    );
                    break;
                  }
                  if (j(r)) break;
                  for (t = e.position; 0 !== r && !I(r);) {
                    r = e.input.charCodeAt(++e.position);
                  }
                  i.push(e.input.slice(t, e.position));
                }
                0 !== r && q(e),
                  y.call(T, n)
                    ? T[n](e, n, i)
                    : M(e, 'unknown document directive "' + n + '"');
              }
              Y(e, !0, -1),
                0 === e.lineIndent && 45 === e.input.charCodeAt(e.position) &&
                45 === e.input.charCodeAt(e.position + 1) &&
                45 === e.input.charCodeAt(e.position + 2)
                  ? (e.position += 3, Y(e, !0, -1))
                  : a && N(e, "directives end mark is expected"),
                $(e, e.lineIndent - 1, b, !1, !0),
                Y(e, !0, -1),
                e.checkLineBreaks && s.test(e.input.slice(o, e.position)) &&
                M(e, "non-ASCII line breaks are interpreted as content"),
                e.documents.push(e.result),
                e.position === e.lineStart && R(e)
                  ? 46 === e.input.charCodeAt(e.position) &&
                    (e.position += 3, Y(e, !0, -1))
                  : e.position < e.length - 1 &&
                    N(
                      e,
                      "end of the stream or a document separator is expected",
                    );
            }
            function G(e, t) {
              t = t || {},
                0 !== (e = String(e)).length &&
                (10 !== e.charCodeAt(e.length - 1) &&
                  13 !== e.charCodeAt(e.length - 1) && (e += "\n"),
                  65279 === e.charCodeAt(0) && (e = e.slice(1)));
              var n = new m(e, t);
              for (
                n.input += "\0"; 32 === n.input.charCodeAt(n.position);
              ) {
                n.lineIndent += 1, n.position += 1;
              }
              for (; n.position < n.length - 1;) H(n);
              return n.documents;
            }
            function V(e, t, n) {
              var i, r, o = G(e, n);
              if ("function" != typeof t) return o;
              for (i = 0, r = o.length; i < r; i += 1) t(o[i]);
            }
            function Z(e, t) {
              var n = G(e, t);
              if (0 !== n.length) {
                if (1 === n.length) return n[0];
                throw new i(
                  "expected a single document in the stream, but found more",
                );
              }
            }
            t.exports.loadAll = V,
              t.exports.load = Z,
              t.exports.safeLoadAll = function (e, t, n) {
                if ("function" != typeof t) {
                  return V(e, g.extend({ schema: o }, n));
                }
                V(e, t, g.extend({ schema: o }, n));
              },
              t.exports.safeLoad = function (e, t) {
                return Z(e, g.extend({ schema: o }, t));
              };
          },
          {
            "./common": 2,
            "./exception": 4,
            "./mark": 6,
            "./schema/default_full": 9,
            "./schema/default_safe": 10,
          },
        ],
        6: [function (e, t, n) {
          var s = e("./common");
          function i(e, t, n, i, r) {
            this.name = e,
              this.buffer = t,
              this.position = n,
              this.line = i,
              this.column = r;
          }
          i.prototype.getSnippet = function (e, t) {
            var n, i, r, o, a;
            if (!this.buffer) {
              return null;
            }
            for (
              e = e || 4, t = t || 75, n = "", i = this.position;
              0 < i &&
              -1 === "\0\r\n\u2028\u2029".indexOf(this.buffer.charAt(i - 1));
            ) {
              if (i -= 1, this.position - i > t / 2 - 1) {
                n = " ... ", i += 5;
                break;
              }
            }
            for (
              r = "", o = this.position;
              o < this.buffer.length &&
              -1 === "\0\r\n\u2028\u2029".indexOf(this.buffer.charAt(o));
            ) {
              if ((o += 1) - this.position > t / 2 - 1) {
                r = " ... ", o -= 5;
                break;
              }
            }
            return a = this.buffer.slice(i, o),
              s.repeat(" ", e) + n + a + r + "\n" +
              s.repeat(" ", e + this.position - i + n.length) + "^";
          },
            i.prototype.toString = function (e) {
              var t, n = "";
              return this.name && (n += 'in "' + this.name + '" '),
                n += "at line " + (this.line + 1) + ", column " +
                  (this.column + 1),
                e || (t = this.getSnippet()) && (n += ":\n" + t),
                n;
            },
            t.exports = i;
        }, { "./common": 2 }],
        7: [function (e, t, n) {
          var i = e("./common"), r = e("./exception"), o = e("./type");
          function a(e, t, i) {
            var r = [];
            return e.include.forEach(function (e) {
              i = a(e, t, i);
            }),
              e[t].forEach(function (n) {
                i.forEach(function (e, t) {
                  e.tag === n.tag && e.kind === n.kind && r.push(t);
                }), i.push(n);
              }),
              i.filter(function (e, t) {
                return -1 === r.indexOf(t);
              });
          }
          function s(e) {
            this.include = e.include || [],
              this.implicit = e.implicit || [],
              this.explicit = e.explicit || [],
              this.implicit.forEach(function (e) {
                if (e.loadKind && "scalar" !== e.loadKind) {
                  throw new r(
                    "There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.",
                  );
                }
              }),
              this.compiledImplicit = a(this, "implicit", []),
              this.compiledExplicit = a(this, "explicit", []),
              this.compiledTypeMap = function () {
                var e,
                  t,
                  n = { scalar: {}, sequence: {}, mapping: {}, fallback: {} };
                function i(e) {
                  n[e.kind][e.tag] = n.fallback[e.tag] = e;
                }
                for (e = 0, t = arguments.length; e < t; e += 1) {
                  arguments[e].forEach(i);
                }
                return n;
              }(this.compiledImplicit, this.compiledExplicit);
          }
          s.DEFAULT = null,
            s.create = function () {
              var e, t;
              switch (arguments.length) {
                case 1:
                  e = s.DEFAULT, t = arguments[0];
                  break;
                case 2:
                  e = arguments[0], t = arguments[1];
                  break;
                default:
                  throw new r(
                    "Wrong number of arguments for Schema.create function",
                  );
              }
              if (
                e = i.toArray(e),
                  t = i.toArray(t),
                  !e.every(function (e) {
                    return e instanceof s;
                  })
              ) {
                throw new r(
                  "Specified list of super schemas (or a single Schema object) contains a non-Schema object.",
                );
              }
              if (
                !t.every(function (e) {
                  return e instanceof o;
                })
              ) {
                throw new r(
                  "Specified list of YAML types (or a single Type object) contains a non-Type object.",
                );
              }
              return new s({ include: e, explicit: t });
            },
            t.exports = s;
        }, { "./common": 2, "./exception": 4, "./type": 13 }],
        8: [function (e, t, n) {
          var i = e("../schema");
          t.exports = new i({ include: [e("./json")] });
        }, { "../schema": 7, "./json": 12 }],
        9: [
          function (e, t, n) {
            var i = e("../schema");
            t.exports = i.DEFAULT = new i(
              {
                include: [e("./default_safe")],
                explicit: [
                  e("../type/js/undefined"),
                  e("../type/js/regexp"),
                  e("../type/js/function"),
                ],
              },
            );
          },
          {
            "../schema": 7,
            "../type/js/function": 18,
            "../type/js/regexp": 19,
            "../type/js/undefined": 20,
            "./default_safe": 10,
          },
        ],
        10: [
          function (e, t, n) {
            var i = e("../schema");
            t.exports = new i(
              {
                include: [e("./core")],
                implicit: [e("../type/timestamp"), e("../type/merge")],
                explicit: [
                  e("../type/binary"),
                  e("../type/omap"),
                  e("../type/pairs"),
                  e("../type/set"),
                ],
              },
            );
          },
          {
            "../schema": 7,
            "../type/binary": 14,
            "../type/merge": 22,
            "../type/omap": 24,
            "../type/pairs": 25,
            "../type/set": 27,
            "../type/timestamp": 29,
            "./core": 8,
          },
        ],
        11: [
          function (e, t, n) {
            var i = e("../schema");
            t.exports = new i(
              {
                explicit: [
                  e("../type/str"),
                  e("../type/seq"),
                  e("../type/map"),
                ],
              },
            );
          },
          {
            "../schema": 7,
            "../type/map": 21,
            "../type/seq": 26,
            "../type/str": 28,
          },
        ],
        12: [
          function (e, t, n) {
            var i = e("../schema");
            t.exports = new i(
              {
                include: [e("./failsafe")],
                implicit: [
                  e("../type/null"),
                  e("../type/bool"),
                  e("../type/int"),
                  e("../type/float"),
                ],
              },
            );
          },
          {
            "../schema": 7,
            "../type/bool": 15,
            "../type/float": 16,
            "../type/int": 17,
            "../type/null": 23,
            "./failsafe": 11,
          },
        ],
        13: [function (e, t, n) {
          var i = e("./exception"),
            r = [
              "kind",
              "resolve",
              "construct",
              "instanceOf",
              "predicate",
              "represent",
              "defaultStyle",
              "styleAliases",
            ],
            o = ["scalar", "sequence", "mapping"];
          t.exports = function (t, e) {
            if (
              e = e || {},
                Object.keys(e).forEach(function (e) {
                  if (-1 === r.indexOf(e)) {
                    throw new i(
                      'Unknown option "' + e + '" is met in definition of "' +
                        t + '" YAML type.',
                    );
                  }
                }),
                this.tag = t,
                this.kind = e.kind || null,
                this.resolve = e.resolve || function () {
                  return !0;
                },
                this.construct = e.construct || function (e) {
                  return e;
                },
                this.instanceOf = e.instanceOf || null,
                this.predicate = e.predicate || null,
                this.represent = e.represent || null,
                this.defaultStyle = e.defaultStyle || null,
                this.styleAliases = function (e) {
                  var n = {};
                  return null !== e && Object.keys(e).forEach(function (t) {
                    e[t].forEach(function (e) {
                      n[String(e)] = t;
                    });
                  }),
                    n;
                }(e.styleAliases || null),
                -1 === o.indexOf(this.kind)
            ) {
              throw new i(
                'Unknown kind "' + this.kind + '" is specified for "' + t +
                  '" YAML type.',
              );
            }
          };
        }, { "./exception": 4 }],
        14: [function (e, t, n) {
          var c;
          try {
            c = e("buffer").Buffer;
          } catch (e) {}
          var i = e("../type"),
            u =
              "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r";
          t.exports = new i(
            "tag:yaml.org,2002:binary",
            {
              kind: "scalar",
              resolve: function (e) {
                if (null === e) return !1;
                var t, n, i = 0, r = e.length, o = u;
                for (n = 0; n < r; n++) {
                  if (!(64 < (t = o.indexOf(e.charAt(n))))) {
                    if (t < 0) return !1;
                    i += 6;
                  }
                }
                return i % 8 == 0;
              },
              construct: function (e) {
                var t,
                  n,
                  i = e.replace(/[\r\n=]/g, ""),
                  r = i.length,
                  o = u,
                  a = 0,
                  s = [];
                for (t = 0; t < r; t++) {
                  t % 4 == 0 && t &&
                  (s.push(a >> 16 & 255),
                    s.push(a >> 8 & 255),
                    s.push(255 & a)), a = a << 6 | o.indexOf(i.charAt(t));
                }
                return 0 == (n = r % 4 * 6)
                  ? (s.push(a >> 16 & 255),
                    s.push(a >> 8 & 255),
                    s.push(255 & a))
                  : 18 == n
                  ? (s.push(a >> 10 & 255), s.push(a >> 2 & 255))
                  : 12 == n && s.push(a >> 4 & 255),
                  c ? c.from ? c.from(s) : new c(s) : s;
              },
              predicate: function (e) {
                return c && c.isBuffer(e);
              },
              represent: function (e) {
                var t, n, i = "", r = 0, o = e.length, a = u;
                for (t = 0; t < o; t++) {
                  t % 3 == 0 && t &&
                  (i += a[r >> 18 & 63],
                    i += a[r >> 12 & 63],
                    i += a[r >> 6 & 63],
                    i += a[63 & r]), r = (r << 8) + e[t];
                }
                return 0 == (n = o % 3)
                  ? (i += a[r >> 18 & 63],
                    i += a[r >> 12 & 63],
                    i += a[r >> 6 & 63],
                    i += a[63 & r])
                  : 2 == n
                  ? (i += a[r >> 10 & 63],
                    i += a[r >> 4 & 63],
                    i += a[r << 2 & 63],
                    i += a[64])
                  : 1 == n &&
                    (i += a[r >> 2 & 63],
                      i += a[r << 4 & 63],
                      i += a[64],
                      i += a[64]),
                  i;
              },
            },
          );
        }, { "../type": 13 }],
        15: [function (e, t, n) {
          var i = e("../type");
          t.exports = new i(
            "tag:yaml.org,2002:bool",
            {
              kind: "scalar",
              resolve: function (e) {
                if (null === e) return !1;
                var t = e.length;
                return 4 === t &&
                    ("true" === e || "True" === e || "TRUE" === e) ||
                  5 === t &&
                    ("false" === e || "False" === e || "FALSE" === e);
              },
              construct: function (e) {
                return "true" === e || "True" === e || "TRUE" === e;
              },
              predicate: function (e) {
                return "[object Boolean]" === Object.prototype.toString.call(e);
              },
              represent: {
                lowercase: function (e) {
                  return e ? "true" : "false";
                },
                uppercase: function (e) {
                  return e ? "TRUE" : "FALSE";
                },
                camelcase: function (e) {
                  return e
                    ? "True"
                    : "False";
                },
              },
              defaultStyle: "lowercase",
            },
          );
        }, { "../type": 13 }],
        16: [function (e, t, n) {
          var i = e("../common"),
            r = e("../type"),
            o = new RegExp(
              "^(?:[-+]?(?:0|[1-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\\.[0-9_]*|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$",
            );
          var a = /^[-+]?[0-9]+e/;
          t.exports = new r(
            "tag:yaml.org,2002:float",
            {
              kind: "scalar",
              resolve: function (e) {
                return null !== e && !(!o.test(e) || "_" === e[e.length - 1]);
              },
              construct: function (e) {
                var t, n, i, r;
                return n = "-" === (t = e.replace(/_/g, "").toLowerCase())[0]
                  ? -1
                  : 1,
                  r = [],
                  0 <= "+-".indexOf(t[0]) && (t = t.slice(1)),
                  ".inf" === t
                    ? 1 == n
                      ? Number.POSITIVE_INFINITY
                      : Number.NEGATIVE_INFINITY
                    : ".nan" === t
                    ? NaN
                    : 0 <= t.indexOf(":")
                    ? (t.split(":").forEach(function (e) {
                      r.unshift(parseFloat(e, 10));
                    }),
                      t = 0,
                      i = 1,
                      r.forEach(function (e) {
                        t += e * i, i *= 60;
                      }),
                      n * t)
                    : n * parseFloat(t, 10);
              },
              predicate: function (e) {
                return "[object Number]" ===
                    Object.prototype.toString.call(e) &&
                  (e % 1 != 0 || i.isNegativeZero(e));
              },
              represent: function (e, t) {
                var n;
                if (isNaN(e)) {
                  switch (t) {
                    case "lowercase":
                      return ".nan";
                    case "uppercase":
                      return ".NAN";
                    case "camelcase":
                      return ".NaN";
                  }
                } else if (Number.POSITIVE_INFINITY === e) {
                  switch (t) {
                    case "lowercase":
                      return ".inf";
                    case "uppercase":
                      return ".INF";
                    case "camelcase":
                      return ".Inf";
                  }
                } else if (Number.NEGATIVE_INFINITY === e) {
                  switch (t) {
                    case "lowercase":
                      return "-.inf";
                    case "uppercase":
                      return "-.INF";
                    case "camelcase":
                      return "-.Inf";
                  }
                } else if (i.isNegativeZero(e)) return "-0.0";
                return n = e.toString(10), a.test(n) ? n.replace("e", ".e") : n;
              },
              defaultStyle: "lowercase",
            },
          );
        }, { "../common": 2, "../type": 13 }],
        17: [function (e, t, n) {
          var i = e("../common"), r = e("../type");
          t.exports = new r(
            "tag:yaml.org,2002:int",
            {
              kind: "scalar",
              resolve: function (e) {
                if (null === e) return !1;
                var t, n, i, r, o = e.length, a = 0, s = !1;
                if (!o) return !1;
                if (
                  "-" !== (t = e[a]) && "+" !== t || (t = e[++a]),
                    "0" === t
                ) {
                  if (a + 1 === o) return !0;
                  if ("b" === (t = e[++a])) {
                    for (a++; a < o; a++) {
                      if ("_" !== (t = e[a])) {
                        if ("0" !== t && "1" !== t) return !1;
                        s = !0;
                      }
                    }
                    return s && "_" !== t;
                  }
                  if ("x" === t) {
                    for (a++; a < o; a++) {
                      if ("_" !== (t = e[a])) {
                        if (
                          !(48 <= (i = e.charCodeAt(a)) && i <= 57 ||
                            65 <= i && i <= 70 || 97 <= i && i <= 102)
                        ) {
                          return !1;
                        }
                        s = !0;
                      }
                    }
                    return s && "_" !== t;
                  }
                  for (; a < o; a++) {
                    if ("_" !== (t = e[a])) {
                      if (
                        !(48 <= (n = e.charCodeAt(a)) && n <= 55)
                      ) {
                        return !1;
                      }
                      s = !0;
                    }
                  }
                  return s && "_" !== t;
                }
                if ("_" === t) return !1;
                for (; a < o; a++) {
                  if ("_" !== (t = e[a])) {
                    if (":" === t) break;
                    if (!(48 <= (r = e.charCodeAt(a)) && r <= 57)) return !1;
                    s = !0;
                  }
                }
                return !(!s || "_" === t) &&
                  (":" !== t || /^(:[0-5]?[0-9])+$/.test(e.slice(a)));
              },
              construct: function (e) {
                var t, n, i = e, r = 1, o = [];
                return -1 !== i.indexOf("_") && (i = i.replace(/_/g, "")),
                  "-" !== (t = i[0]) && "+" !== t ||
                  ("-" === t && (r = -1), t = (i = i.slice(1))[0]),
                  "0" === i ? 0 : "0" === t
                  ? "b" === i[1] ? r * parseInt(i.slice(2), 2) : "x" === i[1]
                  ? r * parseInt(i, 16)
                  : r * parseInt(i, 8)
                  : -1 !== i.indexOf(":")
                  ? (i.split(":").forEach(function (e) {
                    o.unshift(parseInt(e, 10));
                  }),
                    i = 0,
                    n = 1,
                    o.forEach(function (e) {
                      i += e * n, n *= 60;
                    }),
                    r * i)
                  : r * parseInt(i, 10);
              },
              predicate: function (e) {
                return "[object Number]" ===
                    Object.prototype.toString.call(e) &&
                  e % 1 == 0 && !i.isNegativeZero(e);
              },
              represent: {
                binary: function (e) {
                  return 0 <= e
                    ? "0b" + e.toString(2)
                    : "-0b" + e.toString(2).slice(1);
                },
                octal: function (e) {
                  return 0 <= e ? "0" + e.toString(8)
                  : "-0" + e.toString(8).slice(1);
                },
                decimal: function (e) {
                  return e.toString(10);
                },
                hexadecimal: function (e) {
                  return 0 <= e ? "0x" + e.toString(16).toUpperCase()
                  : "-0x" + e.toString(16).toUpperCase().slice(1);
                },
              },
              defaultStyle: "decimal",
              styleAliases: {
                binary: [2, "bin"],
                octal: [8, "oct"],
                decimal: [10, "dec"],
                hexadecimal: [16, "hex"],
              },
            },
          );
        }, { "../common": 2, "../type": 13 }],
        18: [function (e, t, n) {
          var o;
          try {
            o = e("esprima");
          } catch (e) {
            "undefined" != typeof window && (o = window.esprima);
          }
          var i = e("../../type");
          t.exports = new i(
            "tag:yaml.org,2002:js/function",
            {
              kind: "scalar",
              resolve: function (e) {
                if (null === e) return !1;
                try {
                  var t = "(" + e + ")", n = o.parse(t, { range: !0 });
                  return "Program" === n.type && 1 === n.body.length &&
                    "ExpressionStatement" === n.body[0].type &&
                    ("ArrowFunctionExpression" === n.body[0].expression.type ||
                      "FunctionExpression" === n.body[0].expression.type);
                } catch (e) {
                  return !1;
                }
              },
              construct: function (e) {
                var t, n = "(" + e + ")", i = o.parse(n, { range: !0 }), r = [];
                if (
                  "Program" !== i.type || 1 !== i.body.length ||
                  "ExpressionStatement" !== i.body[0].type ||
                  "ArrowFunctionExpression" !==
                        i.body[0].expression.type &&
                    "FunctionExpression" !== i.body[0].expression.type
                ) {
                  throw new Error("Failed to resolve function");
                }
                return i.body[0].expression.params.forEach(function (e) {
                  r.push(e.name);
                }),
                  t = i.body[0].expression.body.range,
                  "BlockStatement" === i.body[0].expression.body.type
                    ? new Function(r, n.slice(t[0] + 1, t[1] - 1))
                    : new Function(r, "return " + n.slice(t[0], t[1]));
              },
              predicate: function (e) {
                return "[object Function]" ===
                  Object.prototype.toString.call(e);
              },
              represent: function (e) {
                return e.toString();
              },
            },
          );
        }, { "../../type": 13 }],
        19: [function (e, t, n) {
          var i = e("../../type");
          t.exports = new i(
            "tag:yaml.org,2002:js/regexp",
            {
              kind: "scalar",
              resolve: function (e) {
                if (null === e) return !1;
                if (0 === e.length) return !1;
                var t = e, n = /\/([gim]*)$/.exec(e), i = "";
                if ("/" === t[0]) {
                  if (n && (i = n[1]), 3 < i.length) return !1;
                  if ("/" !== t[t.length - i.length - 1]) return !1;
                }
                return !0;
              },
              construct: function (e) {
                var t = e, n = /\/([gim]*)$/.exec(e), i = "";
                return "/" === t[0] &&
                  (n && (i = n[1]), t = t.slice(1, t.length - i.length - 1)),
                  new RegExp(t, i);
              },
              predicate: function (e) {
                return "[object RegExp]" === Object.prototype.toString.call(e);
              },
              represent: function (e) {
                var t = "/" + e.source + "/";
                return e.global && (t += "g"),
                  e.multiline && (t += "m"),
                  e.ignoreCase && (t += "i"),
                  t;
              },
            },
          );
        }, { "../../type": 13 }],
        20: [function (e, t, n) {
          var i = e("../../type");
          t.exports = new i(
            "tag:yaml.org,2002:js/undefined",
            {
              kind: "scalar",
              resolve: function () {
                return !0;
              },
              construct: function () {},
              predicate: function (e) {
                return void 0 === e;
              },
              represent: function () {
                return "";
              },
            },
          );
        }, { "../../type": 13 }],
        21: [function (e, t, n) {
          var i = e("../type");
          t.exports = new i(
            "tag:yaml.org,2002:map",
            {
              kind: "mapping",
              construct: function (e) {
                return null !== e ? e : {};
              },
            },
          );
        }, { "../type": 13 }],
        22: [function (e, t, n) {
          var i = e("../type");
          t.exports = new i(
            "tag:yaml.org,2002:merge",
            {
              kind: "scalar",
              resolve: function (e) {
                return "<<" === e || null === e;
              },
            },
          );
        }, { "../type": 13 }],
        23: [function (e, t, n) {
          var i = e("../type");
          t.exports = new i(
            "tag:yaml.org,2002:null",
            {
              kind: "scalar",
              resolve: function (e) {
                if (null === e) return !0;
                var t = e.length;
                return 1 === t && "~" === e ||
                  4 === t &&
                    ("null" === e || "Null" === e || "NULL" === e);
              },
              construct: function () {
                return null;
              },
              predicate: function (e) {
                return null === e;
              },
              represent: {
                canonical: function () {
                  return "~";
                },
                lowercase: function () {
                  return "null";
                },
                uppercase: function () {
                  return "NULL";
                },
                camelcase: function () {
                  return "Null";
                },
              },
              defaultStyle: "lowercase",
            },
          );
        }, { "../type": 13 }],
        24: [function (e, t, n) {
          var i = e("../type"),
            c = Object.prototype.hasOwnProperty,
            u = Object.prototype.toString;
          t.exports = new i(
            "tag:yaml.org,2002:omap",
            {
              kind: "sequence",
              resolve: function (e) {
                if (null === e) return !0;
                var t, n, i, r, o, a = [], s = e;
                for (t = 0, n = s.length; t < n; t += 1) {
                  if (i = s[t], o = !1, "[object Object]" !== u.call(i)) {
                    return !1;
                  }
                  for (r in i) {
                    if (c.call(i, r)) {
                      if (o) {
                        return !1;
                      }
                      o = !0;
                    }
                  }
                  if (!o) return !1;
                  if (-1 !== a.indexOf(r)) return !1;
                  a.push(r);
                }
                return !0;
              },
              construct: function (e) {
                return null !== e
                  ? e
                  : [];
              },
            },
          );
        }, { "../type": 13 }],
        25: [function (e, t, n) {
          var i = e("../type"), s = Object.prototype.toString;
          t.exports = new i(
            "tag:yaml.org,2002:pairs",
            {
              kind: "sequence",
              resolve: function (e) {
                if (null === e) return !0;
                var t, n, i, r, o, a = e;
                for (
                  o = new Array(a.length), t = 0, n = a.length; t < n; t += 1
                ) {
                  if (i = a[t], "[object Object]" !== s.call(i)) return !1;
                  if (1 !== (r = Object.keys(i)).length) return !1;
                  o[t] = [r[0], i[r[0]]];
                }
                return !0;
              },
              construct: function (e) {
                if (null === e) return [];
                var t, n, i, r, o, a = e;
                for (
                  o = new Array(a.length), t = 0, n = a.length; t < n; t += 1
                ) {
                  i = a[t], r = Object.keys(i), o[t] = [r[0], i[r[0]]];
                }
                return o;
              },
            },
          );
        }, { "../type": 13 }],
        26: [function (e, t, n) {
          var i = e("../type");
          t.exports = new i(
            "tag:yaml.org,2002:seq",
            {
              kind: "sequence",
              construct: function (e) {
                return null !== e ? e : [];
              },
            },
          );
        }, { "../type": 13 }],
        27: [function (e, t, n) {
          var i = e("../type"), r = Object.prototype.hasOwnProperty;
          t.exports = new i(
            "tag:yaml.org,2002:set",
            {
              kind: "mapping",
              resolve: function (e) {
                if (null === e) return !0;
                var t, n = e;
                for (t in n) if (r.call(n, t) && null !== n[t]) return !1;
                return !0;
              },
              construct: function (e) {
                return null !== e ? e : {};
              },
            },
          );
        }, { "../type": 13 }],
        28: [function (e, t, n) {
          var i = e("../type");
          t.exports = new i(
            "tag:yaml.org,2002:str",
            {
              kind: "scalar",
              construct: function (e) {
                return null !== e ? e : "";
              },
            },
          );
        }, { "../type": 13 }],
        29: [function (e, t, n) {
          var i = e("../type"),
            p = new RegExp(
              "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$",
            ),
            f = new RegExp(
              "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$",
            );
          t.exports = new i(
            "tag:yaml.org,2002:timestamp",
            {
              kind: "scalar",
              resolve: function (e) {
                return null !== e && (null !== p.exec(e) || null !== f.exec(e));
              },
              construct: function (e) {
                var t, n, i, r, o, a, s, c, u = 0, l = null;
                if (
                  null === (t = p.exec(e)) && (t = f.exec(e)), null === t
                ) {
                  throw new Error("Date resolve error");
                }
                if (n = +t[1], i = +t[2] - 1, r = +t[3], !t[4]) {
                  return new Date(Date.UTC(n, i, r));
                }
                if (o = +t[4], a = +t[5], s = +t[6], t[7]) {
                  for (u = t[7].slice(0, 3); u.length < 3;) u += "0";
                  u = +u;
                }
                return t[9] &&
                  (l = 6e4 * (60 * +t[10] + +(t[11] || 0)),
                    "-" === t[9] && (l = -l)),
                  c = new Date(Date.UTC(n, i, r, o, a, s, u)),
                  l && c.setTime(c.getTime() - l),
                  c;
              },
              instanceOf: Date,
              represent: function (e) {
                return e.toISOString();
              },
            },
          );
        }, { "../type": 13 }],
        "/": [function (e, t, n) {
          var i = e("./lib/js-yaml.js");
          t.exports = i;
        }, { "./lib/js-yaml.js": 1 }],
      },
      {},
      [],
    )("/");
  });
});

var yaml_1 = function parseYAML(text) {
  return json(JSON.stringify(jsYaml3_13_1_min.load(text)));
};

var tomlNode3_0_0 = createCommonjsModule(function (module, exports) {
  (function (f) {
    {
      module.exports = f();
    }
  })(function () {
    return (function () {
      function r(e, n, t) {
        function o(i, f) {
          if (!n[i]) {
            if (!e[i]) {
              var c = "function" == typeof require && require;
              if (!f && c) return c(i, !0);
              if (u) return u(i, !0);
              var a = new Error("Cannot find module '" + i + "'");
              throw a.code = "MODULE_NOT_FOUND", a;
            }
            var p = n[i] = { exports: {} };
            e[i][0].call(
              p.exports,
              function (r) {
                var n = e[i][1][r];
                return o(n || r);
              },
              p,
              p.exports,
              r,
              e,
              n,
              t,
            );
          }
          return n[i].exports;
        }
        for (
          var u = "function" == typeof require && require, i = 0;
          i < t.length;
          i++
        ) {
          o(t[i]);
        }
        return o;
      }
      return r;
    })()(
      {
        1: [function (require, module, exports) {
          var parser = require("./lib/parser");
          var compiler = require("./lib/compiler");

          module.exports = {
            parse: function (input) {
              var nodes = parser.parse(input.toString());
              return compiler.compile(nodes);
            },
          };
        }, { "./lib/compiler": 2, "./lib/parser": 3 }],
        2: [function (require, module, exports) {
          function compile(nodes) {
            var assignedPaths = [];
            var valueAssignments = [];
            var currentPath = "";
            var data = Object.create(null);
            var context = data;

            return reduce(nodes);

            function reduce(nodes) {
              var node;
              for (var i = 0; i < nodes.length; i++) {
                node = nodes[i];
                switch (node.type) {
                  case "Assign":
                    assign(node);
                    break;
                  case "ObjectPath":
                    setPath(node);
                    break;
                  case "ArrayPath":
                    addTableArray(node);
                    break;
                }
              }

              return data;
            }

            function genError(err, line, col) {
              var ex = new Error(err);
              ex.line = line;
              ex.column = col;
              throw ex;
            }

            function assign(node) {
              var key = node.key;
              var value = node.value;
              var line = node.line;
              var column = node.column;

              var fullPath;
              if (currentPath) {
                fullPath = currentPath + "." + key;
              } else {
                fullPath = key;
              }
              if (typeof context[key] !== "undefined") {
                genError(
                  "Cannot redefine existing key '" + fullPath + "'.",
                  line,
                  column,
                );
              }

              context[key] = reduceValueNode(value);

              if (!pathAssigned(fullPath)) {
                assignedPaths.push(fullPath);
                valueAssignments.push(fullPath);
              }
            }

            function pathAssigned(path) {
              return assignedPaths.indexOf(path) !== -1;
            }

            function reduceValueNode(node) {
              if (node.type === "Array") {
                return reduceArrayWithTypeChecking(node.value);
              } else if (node.type === "InlineTable") {
                return reduceInlineTableNode(node.value);
              } else {
                return node.value;
              }
            }

            function reduceInlineTableNode(values) {
              var obj = Object.create(null);
              for (var i = 0; i < values.length; i++) {
                var val = values[i];
                if (val.value.type === "InlineTable") {
                  obj[val.key] = reduceInlineTableNode(val.value.value);
                } else if (val.type === "InlineTableValue") {
                  obj[val.key] = reduceValueNode(val.value);
                }
              }

              return obj;
            }

            function setPath(node) {
              var path = node.value;
              var quotedPath = path.map(quoteDottedString).join(".");
              var line = node.line;
              var column = node.column;

              if (pathAssigned(quotedPath)) {
                genError(
                  "Cannot redefine existing key '" + path + "'.",
                  line,
                  column,
                );
              }
              assignedPaths.push(quotedPath);
              context = deepRef(data, path, Object.create(null), line, column);
              currentPath = path;
            }

            function addTableArray(node) {
              var path = node.value;
              var quotedPath = path.map(quoteDottedString).join(".");
              var line = node.line;
              var column = node.column;

              if (!pathAssigned(quotedPath)) {
                assignedPaths.push(quotedPath);
              }
              assignedPaths = assignedPaths.filter(function (p) {
                return p.indexOf(quotedPath) !== 0;
              });
              assignedPaths.push(quotedPath);
              context = deepRef(data, path, [], line, column);
              currentPath = quotedPath;

              if (context instanceof Array) {
                var newObj = Object.create(null);
                context.push(newObj);
                context = newObj;
              } else {
                genError(
                  "Cannot redefine existing key '" + path + "'.",
                  line,
                  column,
                );
              }
            }

            // Given a path 'a.b.c', create (as necessary) `start.a`,
            // `start.a.b`, and `start.a.b.c`, assigning `value` to `start.a.b.c`.
            // If `a` or `b` are arrays and have items in them, the last item in the
            // array is used as the context for the next sub-path.
            function deepRef(start, keys, value, line, column) {
              var traversed = [];
              var traversedPath = "";
              var path = keys.join(".");
              var ctx = start;

              for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                traversed.push(key);
                traversedPath = traversed.join(".");
                if (typeof ctx[key] === "undefined") {
                  if (i === keys.length - 1) {
                    ctx[key] = value;
                  } else {
                    ctx[key] = Object.create(null);
                  }
                } else if (
                  i !== keys.length - 1 &&
                  valueAssignments.indexOf(traversedPath) > -1
                ) {
                  // already a non-object value at key, can't be used as part of a new path
                  genError(
                    "Cannot redefine existing key '" + traversedPath + "'.",
                    line,
                    column,
                  );
                }

                ctx = ctx[key];
                if (ctx instanceof Array && ctx.length && i < keys.length - 1) {
                  ctx = ctx[ctx.length - 1];
                }
              }

              return ctx;
            }

            function reduceArrayWithTypeChecking(array) {
              // Ensure that all items in the array are of the same type
              var firstType = null;
              for (var i = 0; i < array.length; i++) {
                var node = array[i];
                if (firstType === null) {
                  firstType = node.type;
                } else {
                  if (node.type !== firstType) {
                    genError(
                      "Cannot add value of type " + node.type +
                        " to array of type " +
                        firstType + ".",
                      node.line,
                      node.column,
                    );
                  }
                }
              }

              // Recursively reduce array of nodes into array of the nodes' values
              return array.map(reduceValueNode);
            }

            function quoteDottedString(str) {
              if (str.indexOf(".") > -1) {
                return '"' + str + '"';
              } else {
                return str;
              }
            }
          }

          module.exports = {
            compile: compile,
          };
        }, {}],
        3: [function (require, module, exports) {
          module.exports = (function () {
            /*
   * Generated by PEG.js 0.8.0.
   *
   * http://pegjs.majda.cz/
   */

            function peg$subclass(child, parent) {
              function ctor() {
                this.constructor = child;
              }
              ctor.prototype = parent.prototype;
              child.prototype = new ctor();
            }

            function SyntaxError(
              message,
              expected,
              found,
              offset,
              line,
              column,
            ) {
              this.message = message;
              this.expected = expected;
              this.found = found;
              this.offset = offset;
              this.line = line;
              this.column = column;

              this.name = "SyntaxError";
            }

            peg$subclass(SyntaxError, Error);

            function parse(input) {
              var options = arguments.length > 1 ? arguments[1] : {},
                peg$FAILED = {},
                peg$startRuleFunctions = { start: peg$parsestart },
                peg$startRuleFunction = peg$parsestart,
                peg$c1 = function () {
                  return nodes;
                },
                peg$c2 = peg$FAILED,
                peg$c3 = "#",
                peg$c4 = { type: "literal", value: "#", description: '"#"' },
                peg$c5 = void 0,
                peg$c6 = { type: "any", description: "any character" },
                peg$c7 = "[",
                peg$c8 = { type: "literal", value: "[", description: '"["' },
                peg$c9 = "]",
                peg$c10 = { type: "literal", value: "]", description: '"]"' },
                peg$c11 = function (name) {
                  addNode(node("ObjectPath", name, line, column));
                },
                peg$c12 = function (name) {
                  addNode(node("ArrayPath", name, line, column));
                },
                peg$c13 = function (parts, name) {
                  return parts.concat(name);
                },
                peg$c14 = function (name) {
                  return [name];
                },
                peg$c15 = function (name) {
                  return name;
                },
                peg$c16 = ".",
                peg$c17 = { type: "literal", value: ".", description: '"."' },
                peg$c18 = "=",
                peg$c19 = { type: "literal", value: "=", description: '"="' },
                peg$c20 = function (key, value) {
                  addNode(node("Assign", value, line, column, key));
                },
                peg$c21 = function (chars) {
                  return chars.join("");
                },
                peg$c22 = function (node) {
                  return node.value;
                },
                peg$c23 = '"""',
                peg$c24 = {
                  type: "literal",
                  value: '"""',
                  description: '"\\"\\"\\""',
                },
                peg$c25 = null,
                peg$c26 = function (chars) {
                  return node("String", chars.join(""), line, column);
                },
                peg$c27 = '"',
                peg$c28 = { type: "literal", value: '"', description: '"\\""' },
                peg$c29 = "'''",
                peg$c30 = {
                  type: "literal",
                  value: "'''",
                  description: "\"'''\"",
                },
                peg$c31 = "'",
                peg$c32 = { type: "literal", value: "'", description: '"\'"' },
                peg$c33 = function (char) {
                  return char;
                },
                peg$c34 = function (char) {
                  return char;
                },
                peg$c35 = "\\",
                peg$c36 = {
                  type: "literal",
                  value: "\\",
                  description: '"\\\\"',
                },
                peg$c37 = function () {
                  return "";
                },
                peg$c38 = "e",
                peg$c39 = { type: "literal", value: "e", description: '"e"' },
                peg$c40 = "E",
                peg$c41 = { type: "literal", value: "E", description: '"E"' },
                peg$c42 = function (left, right) {
                  return node(
                    "Float",
                    parseFloat(left + "e" + right),
                    line,
                    column,
                  );
                },
                peg$c43 = function (text) {
                  return node("Float", parseFloat(text), line, column);
                },
                peg$c44 = "+",
                peg$c45 = { type: "literal", value: "+", description: '"+"' },
                peg$c46 = function (digits) {
                  return digits.join("");
                },
                peg$c47 = "-",
                peg$c48 = { type: "literal", value: "-", description: '"-"' },
                peg$c49 = function (digits) {
                  return "-" + digits.join("");
                },
                peg$c50 = function (text) {
                  return node("Integer", parseInt(text, 10), line, column);
                },
                peg$c51 = "true",
                peg$c52 = {
                  type: "literal",
                  value: "true",
                  description: '"true"',
                },
                peg$c53 = function () {
                  return node("Boolean", true, line, column);
                },
                peg$c54 = "false",
                peg$c55 = {
                  type: "literal",
                  value: "false",
                  description: '"false"',
                },
                peg$c56 = function () {
                  return node("Boolean", false, line, column);
                },
                peg$c57 = function () {
                  return node("Array", [], line, column);
                },
                peg$c58 = function (value) {
                  return node("Array", value ? [value] : [], line, column);
                },
                peg$c59 = function (values) {
                  return node("Array", values, line, column);
                },
                peg$c60 = function (values, value) {
                  return node("Array", values.concat(value), line, column);
                },
                peg$c61 = function (value) {
                  return value;
                },
                peg$c62 = ",",
                peg$c63 = { type: "literal", value: ",", description: '","' },
                peg$c64 = "{",
                peg$c65 = { type: "literal", value: "{", description: '"{"' },
                peg$c66 = "}",
                peg$c67 = { type: "literal", value: "}", description: '"}"' },
                peg$c68 = function (values) {
                  return node("InlineTable", values, line, column);
                },
                peg$c69 = function (key, value) {
                  return node("InlineTableValue", value, line, column, key);
                },
                peg$c70 = function (digits) {
                  return "." + digits;
                },
                peg$c71 = function (date) {
                  return date.join("");
                },
                peg$c72 = ":",
                peg$c73 = { type: "literal", value: ":", description: '":"' },
                peg$c74 = function (time) {
                  return time.join("");
                },
                peg$c75 = "T",
                peg$c76 = { type: "literal", value: "T", description: '"T"' },
                peg$c77 = "Z",
                peg$c78 = { type: "literal", value: "Z", description: '"Z"' },
                peg$c79 = function (date, time) {
                  return node(
                    "Date",
                    new Date(date + "T" + time + "Z"),
                    line,
                    column,
                  );
                },
                peg$c80 = function (date, time) {
                  return node(
                    "Date",
                    new Date(date + "T" + time),
                    line,
                    column,
                  );
                },
                peg$c81 = /^[ \t]/,
                peg$c82 = {
                  type: "class",
                  value: "[ \\t]",
                  description: "[ \\t]",
                },
                peg$c83 = "\n",
                peg$c84 = {
                  type: "literal",
                  value: "\n",
                  description: '"\\n"',
                },
                peg$c85 = "\r",
                peg$c86 = {
                  type: "literal",
                  value: "\r",
                  description: '"\\r"',
                },
                peg$c87 = /^[0-9a-f]/i,
                peg$c88 = {
                  type: "class",
                  value: "[0-9a-f]i",
                  description: "[0-9a-f]i",
                },
                peg$c89 = /^[0-9]/,
                peg$c90 = {
                  type: "class",
                  value: "[0-9]",
                  description: "[0-9]",
                },
                peg$c91 = "_",
                peg$c92 = { type: "literal", value: "_", description: '"_"' },
                peg$c93 = function () {
                  return "";
                },
                peg$c94 = /^[A-Za-z0-9_\-]/,
                peg$c95 = {
                  type: "class",
                  value: "[A-Za-z0-9_\\-]",
                  description: "[A-Za-z0-9_\\-]",
                },
                peg$c96 = function (d) {
                  return d.join("");
                },
                peg$c97 = '\\"',
                peg$c98 = {
                  type: "literal",
                  value: '\\"',
                  description: '"\\\\\\""',
                },
                peg$c99 = function () {
                  return '"';
                },
                peg$c100 = "\\\\",
                peg$c101 = {
                  type: "literal",
                  value: "\\\\",
                  description: '"\\\\\\\\"',
                },
                peg$c102 = function () {
                  return "\\";
                },
                peg$c103 = "\\b",
                peg$c104 = {
                  type: "literal",
                  value: "\\b",
                  description: '"\\\\b"',
                },
                peg$c105 = function () {
                  return "\b";
                },
                peg$c106 = "\\t",
                peg$c107 = {
                  type: "literal",
                  value: "\\t",
                  description: '"\\\\t"',
                },
                peg$c108 = function () {
                  return "\t";
                },
                peg$c109 = "\\n",
                peg$c110 = {
                  type: "literal",
                  value: "\\n",
                  description: '"\\\\n"',
                },
                peg$c111 = function () {
                  return "\n";
                },
                peg$c112 = "\\f",
                peg$c113 = {
                  type: "literal",
                  value: "\\f",
                  description: '"\\\\f"',
                },
                peg$c114 = function () {
                  return "\f";
                },
                peg$c115 = "\\r",
                peg$c116 = {
                  type: "literal",
                  value: "\\r",
                  description: '"\\\\r"',
                },
                peg$c117 = function () {
                  return "\r";
                },
                peg$c118 = "\\U",
                peg$c119 = {
                  type: "literal",
                  value: "\\U",
                  description: '"\\\\U"',
                },
                peg$c120 = function (digits) {
                  return convertCodePoint(digits.join(""));
                },
                peg$c121 = "\\u",
                peg$c122 = {
                  type: "literal",
                  value: "\\u",
                  description: '"\\\\u"',
                },
                peg$currPos = 0,
                peg$reportedPos = 0,
                peg$cachedPos = 0,
                peg$cachedPosDetails = { line: 1, column: 1, seenCR: false },
                peg$maxFailPos = 0,
                peg$maxFailExpected = [],
                peg$silentFails = 0,
                peg$cache = {},
                peg$result;

              if ("startRule" in options) {
                if (!(options.startRule in peg$startRuleFunctions)) {
                  throw new Error(
                    "Can't start parsing from rule \"" + options.startRule +
                      '".',
                  );
                }

                peg$startRuleFunction =
                  peg$startRuleFunctions[options.startRule];
              }

              function line() {
                return peg$computePosDetails(peg$reportedPos).line;
              }

              function column() {
                return peg$computePosDetails(peg$reportedPos).column;
              }

              function peg$computePosDetails(pos) {
                function advance(details, startPos, endPos) {
                  var p, ch;

                  for (p = startPos; p < endPos; p++) {
                    ch = input.charAt(p);
                    if (ch === "\n") {
                      if (!details.seenCR) details.line++;
                      details.column = 1;
                      details.seenCR = false;
                    } else if (
                      ch === "\r" || ch === "\u2028" || ch === "\u2029"
                    ) {
                      details.line++;
                      details.column = 1;
                      details.seenCR = true;
                    } else {
                      details.column++;
                      details.seenCR = false;
                    }
                  }
                }

                if (peg$cachedPos !== pos) {
                  if (peg$cachedPos > pos) {
                    peg$cachedPos = 0;
                    peg$cachedPosDetails = {
                      line: 1,
                      column: 1,
                      seenCR: false,
                    };
                  }
                  advance(peg$cachedPosDetails, peg$cachedPos, pos);
                  peg$cachedPos = pos;
                }

                return peg$cachedPosDetails;
              }

              function peg$fail(expected) {
                if (peg$currPos < peg$maxFailPos) return;

                if (peg$currPos > peg$maxFailPos) {
                  peg$maxFailPos = peg$currPos;
                  peg$maxFailExpected = [];
                }

                peg$maxFailExpected.push(expected);
              }

              function peg$buildException(message, expected, pos) {
                function cleanupExpected(expected) {
                  var i = 1;

                  expected.sort(function (a, b) {
                    if (a.description < b.description) {
                      return -1;
                    } else if (a.description > b.description) {
                      return 1;
                    } else {
                      return 0;
                    }
                  });

                  while (i < expected.length) {
                    if (expected[i - 1] === expected[i]) {
                      expected.splice(i, 1);
                    } else {
                      i++;
                    }
                  }
                }

                function buildMessage(expected, found) {
                  function stringEscape(s) {
                    function hex(ch) {
                      return ch.charCodeAt(0).toString(16).toUpperCase();
                    }

                    return s
                      .replace(/\\/g, "\\\\")
                      .replace(/"/g, '\\"')
                      .replace(/\x08/g, "\\b")
                      .replace(/\t/g, "\\t")
                      .replace(/\n/g, "\\n")
                      .replace(/\f/g, "\\f")
                      .replace(/\r/g, "\\r")
                      .replace(/[\x00-\x07\x0B\x0E\x0F]/g, function (ch) {
                        return "\\x0" + hex(ch);
                      })
                      .replace(/[\x10-\x1F\x80-\xFF]/g, function (ch) {
                        return "\\x" + hex(ch);
                      })
                      .replace(/[\u0180-\u0FFF]/g, function (ch) {
                        return "\\u0" + hex(ch);
                      })
                      .replace(/[\u1080-\uFFFF]/g, function (ch) {
                        return "\\u" + hex(ch);
                      });
                  }

                  var expectedDescs = new Array(expected.length),
                    expectedDesc,
                    foundDesc,
                    i;

                  for (i = 0; i < expected.length; i++) {
                    expectedDescs[i] = expected[i].description;
                  }

                  expectedDesc = expected.length > 1
                    ? expectedDescs.slice(0, -1).join(", ") +
                      " or " +
                      expectedDescs[expected.length - 1]
                    : expectedDescs[0];

                  foundDesc = found
                    ? '"' + stringEscape(found) + '"'
                    : "end of input";

                  return "Expected " + expectedDesc + " but " + foundDesc +
                    " found.";
                }

                var posDetails = peg$computePosDetails(pos),
                  found = pos < input.length ? input.charAt(pos) : null;

                if (expected !== null) {
                  cleanupExpected(expected);
                }

                return new SyntaxError(
                  message !== null ? message : buildMessage(expected, found),
                  expected,
                  found,
                  pos,
                  posDetails.line,
                  posDetails.column,
                );
              }

              function peg$parsestart() {
                var s0, s1, s2;

                var key = peg$currPos * 49 + 0,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                s1 = [];
                s2 = peg$parseline();
                while (s2 !== peg$FAILED) {
                  s1.push(s2);
                  s2 = peg$parseline();
                }
                if (s1 !== peg$FAILED) {
                  peg$reportedPos = s0;
                  s1 = peg$c1();
                }
                s0 = s1;

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parseline() {
                var s0, s1, s2, s3, s4, s5, s6;

                var key = peg$currPos * 49 + 1,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                s1 = [];
                s2 = peg$parseS();
                while (s2 !== peg$FAILED) {
                  s1.push(s2);
                  s2 = peg$parseS();
                }
                if (s1 !== peg$FAILED) {
                  s2 = peg$parseexpression();
                  if (s2 !== peg$FAILED) {
                    s3 = [];
                    s4 = peg$parseS();
                    while (s4 !== peg$FAILED) {
                      s3.push(s4);
                      s4 = peg$parseS();
                    }
                    if (s3 !== peg$FAILED) {
                      s4 = [];
                      s5 = peg$parsecomment();
                      while (s5 !== peg$FAILED) {
                        s4.push(s5);
                        s5 = peg$parsecomment();
                      }
                      if (s4 !== peg$FAILED) {
                        s5 = [];
                        s6 = peg$parseNL();
                        if (s6 !== peg$FAILED) {
                          while (s6 !== peg$FAILED) {
                            s5.push(s6);
                            s6 = peg$parseNL();
                          }
                        } else {
                          s5 = peg$c2;
                        }
                        if (s5 === peg$FAILED) {
                          s5 = peg$parseEOF();
                        }
                        if (s5 !== peg$FAILED) {
                          s1 = [s1, s2, s3, s4, s5];
                          s0 = s1;
                        } else {
                          peg$currPos = s0;
                          s0 = peg$c2;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c2;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c2;
                }
                if (s0 === peg$FAILED) {
                  s0 = peg$currPos;
                  s1 = [];
                  s2 = peg$parseS();
                  if (s2 !== peg$FAILED) {
                    while (s2 !== peg$FAILED) {
                      s1.push(s2);
                      s2 = peg$parseS();
                    }
                  } else {
                    s1 = peg$c2;
                  }
                  if (s1 !== peg$FAILED) {
                    s2 = [];
                    s3 = peg$parseNL();
                    if (s3 !== peg$FAILED) {
                      while (s3 !== peg$FAILED) {
                        s2.push(s3);
                        s3 = peg$parseNL();
                      }
                    } else {
                      s2 = peg$c2;
                    }
                    if (s2 === peg$FAILED) {
                      s2 = peg$parseEOF();
                    }
                    if (s2 !== peg$FAILED) {
                      s1 = [s1, s2];
                      s0 = s1;
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                  if (s0 === peg$FAILED) {
                    s0 = peg$parseNL();
                  }
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parseexpression() {
                var s0;

                var key = peg$currPos * 49 + 2,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$parsecomment();
                if (s0 === peg$FAILED) {
                  s0 = peg$parsepath();
                  if (s0 === peg$FAILED) {
                    s0 = peg$parsetablearray();
                    if (s0 === peg$FAILED) {
                      s0 = peg$parseassignment();
                    }
                  }
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parsecomment() {
                var s0, s1, s2, s3, s4, s5;

                var key = peg$currPos * 49 + 3,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                if (input.charCodeAt(peg$currPos) === 35) {
                  s1 = peg$c3;
                  peg$currPos++;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) peg$fail(peg$c4);
                }
                if (s1 !== peg$FAILED) {
                  s2 = [];
                  s3 = peg$currPos;
                  s4 = peg$currPos;
                  peg$silentFails++;
                  s5 = peg$parseNL();
                  if (s5 === peg$FAILED) {
                    s5 = peg$parseEOF();
                  }
                  peg$silentFails--;
                  if (s5 === peg$FAILED) {
                    s4 = peg$c5;
                  } else {
                    peg$currPos = s4;
                    s4 = peg$c2;
                  }
                  if (s4 !== peg$FAILED) {
                    if (input.length > peg$currPos) {
                      s5 = input.charAt(peg$currPos);
                      peg$currPos++;
                    } else {
                      s5 = peg$FAILED;
                      if (peg$silentFails === 0) peg$fail(peg$c6);
                    }
                    if (s5 !== peg$FAILED) {
                      s4 = [s4, s5];
                      s3 = s4;
                    } else {
                      peg$currPos = s3;
                      s3 = peg$c2;
                    }
                  } else {
                    peg$currPos = s3;
                    s3 = peg$c2;
                  }
                  while (s3 !== peg$FAILED) {
                    s2.push(s3);
                    s3 = peg$currPos;
                    s4 = peg$currPos;
                    peg$silentFails++;
                    s5 = peg$parseNL();
                    if (s5 === peg$FAILED) {
                      s5 = peg$parseEOF();
                    }
                    peg$silentFails--;
                    if (s5 === peg$FAILED) {
                      s4 = peg$c5;
                    } else {
                      peg$currPos = s4;
                      s4 = peg$c2;
                    }
                    if (s4 !== peg$FAILED) {
                      if (input.length > peg$currPos) {
                        s5 = input.charAt(peg$currPos);
                        peg$currPos++;
                      } else {
                        s5 = peg$FAILED;
                        if (peg$silentFails === 0) peg$fail(peg$c6);
                      }
                      if (s5 !== peg$FAILED) {
                        s4 = [s4, s5];
                        s3 = s4;
                      } else {
                        peg$currPos = s3;
                        s3 = peg$c2;
                      }
                    } else {
                      peg$currPos = s3;
                      s3 = peg$c2;
                    }
                  }
                  if (s2 !== peg$FAILED) {
                    s1 = [s1, s2];
                    s0 = s1;
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c2;
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parsepath() {
                var s0, s1, s2, s3, s4, s5;

                var key = peg$currPos * 49 + 4,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                if (input.charCodeAt(peg$currPos) === 91) {
                  s1 = peg$c7;
                  peg$currPos++;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) peg$fail(peg$c8);
                }
                if (s1 !== peg$FAILED) {
                  s2 = [];
                  s3 = peg$parseS();
                  while (s3 !== peg$FAILED) {
                    s2.push(s3);
                    s3 = peg$parseS();
                  }
                  if (s2 !== peg$FAILED) {
                    s3 = peg$parsetable_key();
                    if (s3 !== peg$FAILED) {
                      s4 = [];
                      s5 = peg$parseS();
                      while (s5 !== peg$FAILED) {
                        s4.push(s5);
                        s5 = peg$parseS();
                      }
                      if (s4 !== peg$FAILED) {
                        if (input.charCodeAt(peg$currPos) === 93) {
                          s5 = peg$c9;
                          peg$currPos++;
                        } else {
                          s5 = peg$FAILED;
                          if (peg$silentFails === 0) peg$fail(peg$c10);
                        }
                        if (s5 !== peg$FAILED) {
                          peg$reportedPos = s0;
                          s1 = peg$c11(s3);
                          s0 = s1;
                        } else {
                          peg$currPos = s0;
                          s0 = peg$c2;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c2;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c2;
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parsetablearray() {
                var s0, s1, s2, s3, s4, s5, s6, s7;

                var key = peg$currPos * 49 + 5,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                if (input.charCodeAt(peg$currPos) === 91) {
                  s1 = peg$c7;
                  peg$currPos++;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) peg$fail(peg$c8);
                }
                if (s1 !== peg$FAILED) {
                  if (input.charCodeAt(peg$currPos) === 91) {
                    s2 = peg$c7;
                    peg$currPos++;
                  } else {
                    s2 = peg$FAILED;
                    if (peg$silentFails === 0) peg$fail(peg$c8);
                  }
                  if (s2 !== peg$FAILED) {
                    s3 = [];
                    s4 = peg$parseS();
                    while (s4 !== peg$FAILED) {
                      s3.push(s4);
                      s4 = peg$parseS();
                    }
                    if (s3 !== peg$FAILED) {
                      s4 = peg$parsetable_key();
                      if (s4 !== peg$FAILED) {
                        s5 = [];
                        s6 = peg$parseS();
                        while (s6 !== peg$FAILED) {
                          s5.push(s6);
                          s6 = peg$parseS();
                        }
                        if (s5 !== peg$FAILED) {
                          if (input.charCodeAt(peg$currPos) === 93) {
                            s6 = peg$c9;
                            peg$currPos++;
                          } else {
                            s6 = peg$FAILED;
                            if (peg$silentFails === 0) peg$fail(peg$c10);
                          }
                          if (s6 !== peg$FAILED) {
                            if (input.charCodeAt(peg$currPos) === 93) {
                              s7 = peg$c9;
                              peg$currPos++;
                            } else {
                              s7 = peg$FAILED;
                              if (peg$silentFails === 0) peg$fail(peg$c10);
                            }
                            if (s7 !== peg$FAILED) {
                              peg$reportedPos = s0;
                              s1 = peg$c12(s4);
                              s0 = s1;
                            } else {
                              peg$currPos = s0;
                              s0 = peg$c2;
                            }
                          } else {
                            peg$currPos = s0;
                            s0 = peg$c2;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$c2;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c2;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c2;
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parsetable_key() {
                var s0, s1, s2;

                var key = peg$currPos * 49 + 6,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                s1 = [];
                s2 = peg$parsedot_ended_table_key_part();
                if (s2 !== peg$FAILED) {
                  while (s2 !== peg$FAILED) {
                    s1.push(s2);
                    s2 = peg$parsedot_ended_table_key_part();
                  }
                } else {
                  s1 = peg$c2;
                }
                if (s1 !== peg$FAILED) {
                  s2 = peg$parsetable_key_part();
                  if (s2 !== peg$FAILED) {
                    peg$reportedPos = s0;
                    s1 = peg$c13(s1, s2);
                    s0 = s1;
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c2;
                }
                if (s0 === peg$FAILED) {
                  s0 = peg$currPos;
                  s1 = peg$parsetable_key_part();
                  if (s1 !== peg$FAILED) {
                    peg$reportedPos = s0;
                    s1 = peg$c14(s1);
                  }
                  s0 = s1;
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parsetable_key_part() {
                var s0, s1, s2, s3, s4;

                var key = peg$currPos * 49 + 7,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                s1 = [];
                s2 = peg$parseS();
                while (s2 !== peg$FAILED) {
                  s1.push(s2);
                  s2 = peg$parseS();
                }
                if (s1 !== peg$FAILED) {
                  s2 = peg$parsekey();
                  if (s2 !== peg$FAILED) {
                    s3 = [];
                    s4 = peg$parseS();
                    while (s4 !== peg$FAILED) {
                      s3.push(s4);
                      s4 = peg$parseS();
                    }
                    if (s3 !== peg$FAILED) {
                      peg$reportedPos = s0;
                      s1 = peg$c15(s2);
                      s0 = s1;
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c2;
                }
                if (s0 === peg$FAILED) {
                  s0 = peg$currPos;
                  s1 = [];
                  s2 = peg$parseS();
                  while (s2 !== peg$FAILED) {
                    s1.push(s2);
                    s2 = peg$parseS();
                  }
                  if (s1 !== peg$FAILED) {
                    s2 = peg$parsequoted_key();
                    if (s2 !== peg$FAILED) {
                      s3 = [];
                      s4 = peg$parseS();
                      while (s4 !== peg$FAILED) {
                        s3.push(s4);
                        s4 = peg$parseS();
                      }
                      if (s3 !== peg$FAILED) {
                        peg$reportedPos = s0;
                        s1 = peg$c15(s2);
                        s0 = s1;
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c2;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parsedot_ended_table_key_part() {
                var s0, s1, s2, s3, s4, s5, s6;

                var key = peg$currPos * 49 + 8,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                s1 = [];
                s2 = peg$parseS();
                while (s2 !== peg$FAILED) {
                  s1.push(s2);
                  s2 = peg$parseS();
                }
                if (s1 !== peg$FAILED) {
                  s2 = peg$parsekey();
                  if (s2 !== peg$FAILED) {
                    s3 = [];
                    s4 = peg$parseS();
                    while (s4 !== peg$FAILED) {
                      s3.push(s4);
                      s4 = peg$parseS();
                    }
                    if (s3 !== peg$FAILED) {
                      if (input.charCodeAt(peg$currPos) === 46) {
                        s4 = peg$c16;
                        peg$currPos++;
                      } else {
                        s4 = peg$FAILED;
                        if (peg$silentFails === 0) peg$fail(peg$c17);
                      }
                      if (s4 !== peg$FAILED) {
                        s5 = [];
                        s6 = peg$parseS();
                        while (s6 !== peg$FAILED) {
                          s5.push(s6);
                          s6 = peg$parseS();
                        }
                        if (s5 !== peg$FAILED) {
                          peg$reportedPos = s0;
                          s1 = peg$c15(s2);
                          s0 = s1;
                        } else {
                          peg$currPos = s0;
                          s0 = peg$c2;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c2;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c2;
                }
                if (s0 === peg$FAILED) {
                  s0 = peg$currPos;
                  s1 = [];
                  s2 = peg$parseS();
                  while (s2 !== peg$FAILED) {
                    s1.push(s2);
                    s2 = peg$parseS();
                  }
                  if (s1 !== peg$FAILED) {
                    s2 = peg$parsequoted_key();
                    if (s2 !== peg$FAILED) {
                      s3 = [];
                      s4 = peg$parseS();
                      while (s4 !== peg$FAILED) {
                        s3.push(s4);
                        s4 = peg$parseS();
                      }
                      if (s3 !== peg$FAILED) {
                        if (input.charCodeAt(peg$currPos) === 46) {
                          s4 = peg$c16;
                          peg$currPos++;
                        } else {
                          s4 = peg$FAILED;
                          if (peg$silentFails === 0) peg$fail(peg$c17);
                        }
                        if (s4 !== peg$FAILED) {
                          s5 = [];
                          s6 = peg$parseS();
                          while (s6 !== peg$FAILED) {
                            s5.push(s6);
                            s6 = peg$parseS();
                          }
                          if (s5 !== peg$FAILED) {
                            peg$reportedPos = s0;
                            s1 = peg$c15(s2);
                            s0 = s1;
                          } else {
                            peg$currPos = s0;
                            s0 = peg$c2;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$c2;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c2;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parseassignment() {
                var s0, s1, s2, s3, s4, s5;

                var key = peg$currPos * 49 + 9,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                s1 = peg$parsekey();
                if (s1 !== peg$FAILED) {
                  s2 = [];
                  s3 = peg$parseS();
                  while (s3 !== peg$FAILED) {
                    s2.push(s3);
                    s3 = peg$parseS();
                  }
                  if (s2 !== peg$FAILED) {
                    if (input.charCodeAt(peg$currPos) === 61) {
                      s3 = peg$c18;
                      peg$currPos++;
                    } else {
                      s3 = peg$FAILED;
                      if (peg$silentFails === 0) peg$fail(peg$c19);
                    }
                    if (s3 !== peg$FAILED) {
                      s4 = [];
                      s5 = peg$parseS();
                      while (s5 !== peg$FAILED) {
                        s4.push(s5);
                        s5 = peg$parseS();
                      }
                      if (s4 !== peg$FAILED) {
                        s5 = peg$parsevalue();
                        if (s5 !== peg$FAILED) {
                          peg$reportedPos = s0;
                          s1 = peg$c20(s1, s5);
                          s0 = s1;
                        } else {
                          peg$currPos = s0;
                          s0 = peg$c2;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c2;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c2;
                }
                if (s0 === peg$FAILED) {
                  s0 = peg$currPos;
                  s1 = peg$parsequoted_key();
                  if (s1 !== peg$FAILED) {
                    s2 = [];
                    s3 = peg$parseS();
                    while (s3 !== peg$FAILED) {
                      s2.push(s3);
                      s3 = peg$parseS();
                    }
                    if (s2 !== peg$FAILED) {
                      if (input.charCodeAt(peg$currPos) === 61) {
                        s3 = peg$c18;
                        peg$currPos++;
                      } else {
                        s3 = peg$FAILED;
                        if (peg$silentFails === 0) peg$fail(peg$c19);
                      }
                      if (s3 !== peg$FAILED) {
                        s4 = [];
                        s5 = peg$parseS();
                        while (s5 !== peg$FAILED) {
                          s4.push(s5);
                          s5 = peg$parseS();
                        }
                        if (s4 !== peg$FAILED) {
                          s5 = peg$parsevalue();
                          if (s5 !== peg$FAILED) {
                            peg$reportedPos = s0;
                            s1 = peg$c20(s1, s5);
                            s0 = s1;
                          } else {
                            peg$currPos = s0;
                            s0 = peg$c2;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$c2;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c2;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parsekey() {
                var s0, s1, s2;

                var key = peg$currPos * 49 + 10,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                s1 = [];
                s2 = peg$parseASCII_BASIC();
                if (s2 !== peg$FAILED) {
                  while (s2 !== peg$FAILED) {
                    s1.push(s2);
                    s2 = peg$parseASCII_BASIC();
                  }
                } else {
                  s1 = peg$c2;
                }
                if (s1 !== peg$FAILED) {
                  peg$reportedPos = s0;
                  s1 = peg$c21(s1);
                }
                s0 = s1;

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parsequoted_key() {
                var s0, s1;

                var key = peg$currPos * 49 + 11,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                s1 = peg$parsedouble_quoted_single_line_string();
                if (s1 !== peg$FAILED) {
                  peg$reportedPos = s0;
                  s1 = peg$c22(s1);
                }
                s0 = s1;
                if (s0 === peg$FAILED) {
                  s0 = peg$currPos;
                  s1 = peg$parsesingle_quoted_single_line_string();
                  if (s1 !== peg$FAILED) {
                    peg$reportedPos = s0;
                    s1 = peg$c22(s1);
                  }
                  s0 = s1;
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parsevalue() {
                var s0;

                var key = peg$currPos * 49 + 12,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$parsestring();
                if (s0 === peg$FAILED) {
                  s0 = peg$parsedatetime();
                  if (s0 === peg$FAILED) {
                    s0 = peg$parsefloat();
                    if (s0 === peg$FAILED) {
                      s0 = peg$parseinteger();
                      if (s0 === peg$FAILED) {
                        s0 = peg$parseboolean();
                        if (s0 === peg$FAILED) {
                          s0 = peg$parsearray();
                          if (s0 === peg$FAILED) {
                            s0 = peg$parseinline_table();
                          }
                        }
                      }
                    }
                  }
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parsestring() {
                var s0;

                var key = peg$currPos * 49 + 13,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$parsedouble_quoted_multiline_string();
                if (s0 === peg$FAILED) {
                  s0 = peg$parsedouble_quoted_single_line_string();
                  if (s0 === peg$FAILED) {
                    s0 = peg$parsesingle_quoted_multiline_string();
                    if (s0 === peg$FAILED) {
                      s0 = peg$parsesingle_quoted_single_line_string();
                    }
                  }
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parsedouble_quoted_multiline_string() {
                var s0, s1, s2, s3, s4;

                var key = peg$currPos * 49 + 14,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                if (input.substr(peg$currPos, 3) === peg$c23) {
                  s1 = peg$c23;
                  peg$currPos += 3;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) peg$fail(peg$c24);
                }
                if (s1 !== peg$FAILED) {
                  s2 = peg$parseNL();
                  if (s2 === peg$FAILED) {
                    s2 = peg$c25;
                  }
                  if (s2 !== peg$FAILED) {
                    s3 = [];
                    s4 = peg$parsemultiline_string_char();
                    while (s4 !== peg$FAILED) {
                      s3.push(s4);
                      s4 = peg$parsemultiline_string_char();
                    }
                    if (s3 !== peg$FAILED) {
                      if (input.substr(peg$currPos, 3) === peg$c23) {
                        s4 = peg$c23;
                        peg$currPos += 3;
                      } else {
                        s4 = peg$FAILED;
                        if (peg$silentFails === 0) peg$fail(peg$c24);
                      }
                      if (s4 !== peg$FAILED) {
                        peg$reportedPos = s0;
                        s1 = peg$c26(s3);
                        s0 = s1;
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c2;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c2;
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parsedouble_quoted_single_line_string() {
                var s0, s1, s2, s3;

                var key = peg$currPos * 49 + 15,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                if (input.charCodeAt(peg$currPos) === 34) {
                  s1 = peg$c27;
                  peg$currPos++;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) peg$fail(peg$c28);
                }
                if (s1 !== peg$FAILED) {
                  s2 = [];
                  s3 = peg$parsestring_char();
                  while (s3 !== peg$FAILED) {
                    s2.push(s3);
                    s3 = peg$parsestring_char();
                  }
                  if (s2 !== peg$FAILED) {
                    if (input.charCodeAt(peg$currPos) === 34) {
                      s3 = peg$c27;
                      peg$currPos++;
                    } else {
                      s3 = peg$FAILED;
                      if (peg$silentFails === 0) peg$fail(peg$c28);
                    }
                    if (s3 !== peg$FAILED) {
                      peg$reportedPos = s0;
                      s1 = peg$c26(s2);
                      s0 = s1;
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c2;
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parsesingle_quoted_multiline_string() {
                var s0, s1, s2, s3, s4;

                var key = peg$currPos * 49 + 16,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                if (input.substr(peg$currPos, 3) === peg$c29) {
                  s1 = peg$c29;
                  peg$currPos += 3;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) peg$fail(peg$c30);
                }
                if (s1 !== peg$FAILED) {
                  s2 = peg$parseNL();
                  if (s2 === peg$FAILED) {
                    s2 = peg$c25;
                  }
                  if (s2 !== peg$FAILED) {
                    s3 = [];
                    s4 = peg$parsemultiline_literal_char();
                    while (s4 !== peg$FAILED) {
                      s3.push(s4);
                      s4 = peg$parsemultiline_literal_char();
                    }
                    if (s3 !== peg$FAILED) {
                      if (input.substr(peg$currPos, 3) === peg$c29) {
                        s4 = peg$c29;
                        peg$currPos += 3;
                      } else {
                        s4 = peg$FAILED;
                        if (peg$silentFails === 0) peg$fail(peg$c30);
                      }
                      if (s4 !== peg$FAILED) {
                        peg$reportedPos = s0;
                        s1 = peg$c26(s3);
                        s0 = s1;
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c2;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c2;
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parsesingle_quoted_single_line_string() {
                var s0, s1, s2, s3;

                var key = peg$currPos * 49 + 17,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                if (input.charCodeAt(peg$currPos) === 39) {
                  s1 = peg$c31;
                  peg$currPos++;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) peg$fail(peg$c32);
                }
                if (s1 !== peg$FAILED) {
                  s2 = [];
                  s3 = peg$parseliteral_char();
                  while (s3 !== peg$FAILED) {
                    s2.push(s3);
                    s3 = peg$parseliteral_char();
                  }
                  if (s2 !== peg$FAILED) {
                    if (input.charCodeAt(peg$currPos) === 39) {
                      s3 = peg$c31;
                      peg$currPos++;
                    } else {
                      s3 = peg$FAILED;
                      if (peg$silentFails === 0) peg$fail(peg$c32);
                    }
                    if (s3 !== peg$FAILED) {
                      peg$reportedPos = s0;
                      s1 = peg$c26(s2);
                      s0 = s1;
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c2;
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parsestring_char() {
                var s0, s1, s2;

                var key = peg$currPos * 49 + 18,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$parseESCAPED();
                if (s0 === peg$FAILED) {
                  s0 = peg$currPos;
                  s1 = peg$currPos;
                  peg$silentFails++;
                  if (input.charCodeAt(peg$currPos) === 34) {
                    s2 = peg$c27;
                    peg$currPos++;
                  } else {
                    s2 = peg$FAILED;
                    if (peg$silentFails === 0) peg$fail(peg$c28);
                  }
                  peg$silentFails--;
                  if (s2 === peg$FAILED) {
                    s1 = peg$c5;
                  } else {
                    peg$currPos = s1;
                    s1 = peg$c2;
                  }
                  if (s1 !== peg$FAILED) {
                    if (input.length > peg$currPos) {
                      s2 = input.charAt(peg$currPos);
                      peg$currPos++;
                    } else {
                      s2 = peg$FAILED;
                      if (peg$silentFails === 0) peg$fail(peg$c6);
                    }
                    if (s2 !== peg$FAILED) {
                      peg$reportedPos = s0;
                      s1 = peg$c33(s2);
                      s0 = s1;
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parseliteral_char() {
                var s0, s1, s2;

                var key = peg$currPos * 49 + 19,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                s1 = peg$currPos;
                peg$silentFails++;
                if (input.charCodeAt(peg$currPos) === 39) {
                  s2 = peg$c31;
                  peg$currPos++;
                } else {
                  s2 = peg$FAILED;
                  if (peg$silentFails === 0) peg$fail(peg$c32);
                }
                peg$silentFails--;
                if (s2 === peg$FAILED) {
                  s1 = peg$c5;
                } else {
                  peg$currPos = s1;
                  s1 = peg$c2;
                }
                if (s1 !== peg$FAILED) {
                  if (input.length > peg$currPos) {
                    s2 = input.charAt(peg$currPos);
                    peg$currPos++;
                  } else {
                    s2 = peg$FAILED;
                    if (peg$silentFails === 0) peg$fail(peg$c6);
                  }
                  if (s2 !== peg$FAILED) {
                    peg$reportedPos = s0;
                    s1 = peg$c33(s2);
                    s0 = s1;
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c2;
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parsemultiline_string_char() {
                var s0, s1, s2;

                var key = peg$currPos * 49 + 20,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$parseESCAPED();
                if (s0 === peg$FAILED) {
                  s0 = peg$parsemultiline_string_delim();
                  if (s0 === peg$FAILED) {
                    s0 = peg$currPos;
                    s1 = peg$currPos;
                    peg$silentFails++;
                    if (input.substr(peg$currPos, 3) === peg$c23) {
                      s2 = peg$c23;
                      peg$currPos += 3;
                    } else {
                      s2 = peg$FAILED;
                      if (peg$silentFails === 0) peg$fail(peg$c24);
                    }
                    peg$silentFails--;
                    if (s2 === peg$FAILED) {
                      s1 = peg$c5;
                    } else {
                      peg$currPos = s1;
                      s1 = peg$c2;
                    }
                    if (s1 !== peg$FAILED) {
                      if (input.length > peg$currPos) {
                        s2 = input.charAt(peg$currPos);
                        peg$currPos++;
                      } else {
                        s2 = peg$FAILED;
                        if (peg$silentFails === 0) peg$fail(peg$c6);
                      }
                      if (s2 !== peg$FAILED) {
                        peg$reportedPos = s0;
                        s1 = peg$c34(s2);
                        s0 = s1;
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c2;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  }
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parsemultiline_string_delim() {
                var s0, s1, s2, s3, s4;

                var key = peg$currPos * 49 + 21,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                if (input.charCodeAt(peg$currPos) === 92) {
                  s1 = peg$c35;
                  peg$currPos++;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) peg$fail(peg$c36);
                }
                if (s1 !== peg$FAILED) {
                  s2 = peg$parseNL();
                  if (s2 !== peg$FAILED) {
                    s3 = [];
                    s4 = peg$parseNLS();
                    while (s4 !== peg$FAILED) {
                      s3.push(s4);
                      s4 = peg$parseNLS();
                    }
                    if (s3 !== peg$FAILED) {
                      peg$reportedPos = s0;
                      s1 = peg$c37();
                      s0 = s1;
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c2;
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parsemultiline_literal_char() {
                var s0, s1, s2;

                var key = peg$currPos * 49 + 22,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                s1 = peg$currPos;
                peg$silentFails++;
                if (input.substr(peg$currPos, 3) === peg$c29) {
                  s2 = peg$c29;
                  peg$currPos += 3;
                } else {
                  s2 = peg$FAILED;
                  if (peg$silentFails === 0) peg$fail(peg$c30);
                }
                peg$silentFails--;
                if (s2 === peg$FAILED) {
                  s1 = peg$c5;
                } else {
                  peg$currPos = s1;
                  s1 = peg$c2;
                }
                if (s1 !== peg$FAILED) {
                  if (input.length > peg$currPos) {
                    s2 = input.charAt(peg$currPos);
                    peg$currPos++;
                  } else {
                    s2 = peg$FAILED;
                    if (peg$silentFails === 0) peg$fail(peg$c6);
                  }
                  if (s2 !== peg$FAILED) {
                    peg$reportedPos = s0;
                    s1 = peg$c33(s2);
                    s0 = s1;
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c2;
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parsefloat() {
                var s0, s1, s2, s3;

                var key = peg$currPos * 49 + 23,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                s1 = peg$parsefloat_text();
                if (s1 === peg$FAILED) {
                  s1 = peg$parseinteger_text();
                }
                if (s1 !== peg$FAILED) {
                  if (input.charCodeAt(peg$currPos) === 101) {
                    s2 = peg$c38;
                    peg$currPos++;
                  } else {
                    s2 = peg$FAILED;
                    if (peg$silentFails === 0) peg$fail(peg$c39);
                  }
                  if (s2 === peg$FAILED) {
                    if (input.charCodeAt(peg$currPos) === 69) {
                      s2 = peg$c40;
                      peg$currPos++;
                    } else {
                      s2 = peg$FAILED;
                      if (peg$silentFails === 0) peg$fail(peg$c41);
                    }
                  }
                  if (s2 !== peg$FAILED) {
                    s3 = peg$parseinteger_text();
                    if (s3 !== peg$FAILED) {
                      peg$reportedPos = s0;
                      s1 = peg$c42(s1, s3);
                      s0 = s1;
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c2;
                }
                if (s0 === peg$FAILED) {
                  s0 = peg$currPos;
                  s1 = peg$parsefloat_text();
                  if (s1 !== peg$FAILED) {
                    peg$reportedPos = s0;
                    s1 = peg$c43(s1);
                  }
                  s0 = s1;
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parsefloat_text() {
                var s0, s1, s2, s3, s4, s5;

                var key = peg$currPos * 49 + 24,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                if (input.charCodeAt(peg$currPos) === 43) {
                  s1 = peg$c44;
                  peg$currPos++;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) peg$fail(peg$c45);
                }
                if (s1 === peg$FAILED) {
                  s1 = peg$c25;
                }
                if (s1 !== peg$FAILED) {
                  s2 = peg$currPos;
                  s3 = peg$parseDIGITS();
                  if (s3 !== peg$FAILED) {
                    if (input.charCodeAt(peg$currPos) === 46) {
                      s4 = peg$c16;
                      peg$currPos++;
                    } else {
                      s4 = peg$FAILED;
                      if (peg$silentFails === 0) peg$fail(peg$c17);
                    }
                    if (s4 !== peg$FAILED) {
                      s5 = peg$parseDIGITS();
                      if (s5 !== peg$FAILED) {
                        s3 = [s3, s4, s5];
                        s2 = s3;
                      } else {
                        peg$currPos = s2;
                        s2 = peg$c2;
                      }
                    } else {
                      peg$currPos = s2;
                      s2 = peg$c2;
                    }
                  } else {
                    peg$currPos = s2;
                    s2 = peg$c2;
                  }
                  if (s2 !== peg$FAILED) {
                    peg$reportedPos = s0;
                    s1 = peg$c46(s2);
                    s0 = s1;
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c2;
                }
                if (s0 === peg$FAILED) {
                  s0 = peg$currPos;
                  if (input.charCodeAt(peg$currPos) === 45) {
                    s1 = peg$c47;
                    peg$currPos++;
                  } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) peg$fail(peg$c48);
                  }
                  if (s1 !== peg$FAILED) {
                    s2 = peg$currPos;
                    s3 = peg$parseDIGITS();
                    if (s3 !== peg$FAILED) {
                      if (input.charCodeAt(peg$currPos) === 46) {
                        s4 = peg$c16;
                        peg$currPos++;
                      } else {
                        s4 = peg$FAILED;
                        if (peg$silentFails === 0) peg$fail(peg$c17);
                      }
                      if (s4 !== peg$FAILED) {
                        s5 = peg$parseDIGITS();
                        if (s5 !== peg$FAILED) {
                          s3 = [s3, s4, s5];
                          s2 = s3;
                        } else {
                          peg$currPos = s2;
                          s2 = peg$c2;
                        }
                      } else {
                        peg$currPos = s2;
                        s2 = peg$c2;
                      }
                    } else {
                      peg$currPos = s2;
                      s2 = peg$c2;
                    }
                    if (s2 !== peg$FAILED) {
                      peg$reportedPos = s0;
                      s1 = peg$c49(s2);
                      s0 = s1;
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parseinteger() {
                var s0, s1;

                var key = peg$currPos * 49 + 25,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                s1 = peg$parseinteger_text();
                if (s1 !== peg$FAILED) {
                  peg$reportedPos = s0;
                  s1 = peg$c50(s1);
                }
                s0 = s1;

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parseinteger_text() {
                var s0, s1, s2, s3, s4;

                var key = peg$currPos * 49 + 26,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                if (input.charCodeAt(peg$currPos) === 43) {
                  s1 = peg$c44;
                  peg$currPos++;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) peg$fail(peg$c45);
                }
                if (s1 === peg$FAILED) {
                  s1 = peg$c25;
                }
                if (s1 !== peg$FAILED) {
                  s2 = [];
                  s3 = peg$parseDIGIT_OR_UNDER();
                  if (s3 !== peg$FAILED) {
                    while (s3 !== peg$FAILED) {
                      s2.push(s3);
                      s3 = peg$parseDIGIT_OR_UNDER();
                    }
                  } else {
                    s2 = peg$c2;
                  }
                  if (s2 !== peg$FAILED) {
                    s3 = peg$currPos;
                    peg$silentFails++;
                    if (input.charCodeAt(peg$currPos) === 46) {
                      s4 = peg$c16;
                      peg$currPos++;
                    } else {
                      s4 = peg$FAILED;
                      if (peg$silentFails === 0) peg$fail(peg$c17);
                    }
                    peg$silentFails--;
                    if (s4 === peg$FAILED) {
                      s3 = peg$c5;
                    } else {
                      peg$currPos = s3;
                      s3 = peg$c2;
                    }
                    if (s3 !== peg$FAILED) {
                      peg$reportedPos = s0;
                      s1 = peg$c46(s2);
                      s0 = s1;
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c2;
                }
                if (s0 === peg$FAILED) {
                  s0 = peg$currPos;
                  if (input.charCodeAt(peg$currPos) === 45) {
                    s1 = peg$c47;
                    peg$currPos++;
                  } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) peg$fail(peg$c48);
                  }
                  if (s1 !== peg$FAILED) {
                    s2 = [];
                    s3 = peg$parseDIGIT_OR_UNDER();
                    if (s3 !== peg$FAILED) {
                      while (s3 !== peg$FAILED) {
                        s2.push(s3);
                        s3 = peg$parseDIGIT_OR_UNDER();
                      }
                    } else {
                      s2 = peg$c2;
                    }
                    if (s2 !== peg$FAILED) {
                      s3 = peg$currPos;
                      peg$silentFails++;
                      if (input.charCodeAt(peg$currPos) === 46) {
                        s4 = peg$c16;
                        peg$currPos++;
                      } else {
                        s4 = peg$FAILED;
                        if (peg$silentFails === 0) peg$fail(peg$c17);
                      }
                      peg$silentFails--;
                      if (s4 === peg$FAILED) {
                        s3 = peg$c5;
                      } else {
                        peg$currPos = s3;
                        s3 = peg$c2;
                      }
                      if (s3 !== peg$FAILED) {
                        peg$reportedPos = s0;
                        s1 = peg$c49(s2);
                        s0 = s1;
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c2;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parseboolean() {
                var s0, s1;

                var key = peg$currPos * 49 + 27,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                if (input.substr(peg$currPos, 4) === peg$c51) {
                  s1 = peg$c51;
                  peg$currPos += 4;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) peg$fail(peg$c52);
                }
                if (s1 !== peg$FAILED) {
                  peg$reportedPos = s0;
                  s1 = peg$c53();
                }
                s0 = s1;
                if (s0 === peg$FAILED) {
                  s0 = peg$currPos;
                  if (input.substr(peg$currPos, 5) === peg$c54) {
                    s1 = peg$c54;
                    peg$currPos += 5;
                  } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) peg$fail(peg$c55);
                  }
                  if (s1 !== peg$FAILED) {
                    peg$reportedPos = s0;
                    s1 = peg$c56();
                  }
                  s0 = s1;
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parsearray() {
                var s0, s1, s2, s3, s4;

                var key = peg$currPos * 49 + 28,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                if (input.charCodeAt(peg$currPos) === 91) {
                  s1 = peg$c7;
                  peg$currPos++;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) peg$fail(peg$c8);
                }
                if (s1 !== peg$FAILED) {
                  s2 = [];
                  s3 = peg$parsearray_sep();
                  while (s3 !== peg$FAILED) {
                    s2.push(s3);
                    s3 = peg$parsearray_sep();
                  }
                  if (s2 !== peg$FAILED) {
                    if (input.charCodeAt(peg$currPos) === 93) {
                      s3 = peg$c9;
                      peg$currPos++;
                    } else {
                      s3 = peg$FAILED;
                      if (peg$silentFails === 0) peg$fail(peg$c10);
                    }
                    if (s3 !== peg$FAILED) {
                      peg$reportedPos = s0;
                      s1 = peg$c57();
                      s0 = s1;
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c2;
                }
                if (s0 === peg$FAILED) {
                  s0 = peg$currPos;
                  if (input.charCodeAt(peg$currPos) === 91) {
                    s1 = peg$c7;
                    peg$currPos++;
                  } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) peg$fail(peg$c8);
                  }
                  if (s1 !== peg$FAILED) {
                    s2 = peg$parsearray_value();
                    if (s2 === peg$FAILED) {
                      s2 = peg$c25;
                    }
                    if (s2 !== peg$FAILED) {
                      if (input.charCodeAt(peg$currPos) === 93) {
                        s3 = peg$c9;
                        peg$currPos++;
                      } else {
                        s3 = peg$FAILED;
                        if (peg$silentFails === 0) peg$fail(peg$c10);
                      }
                      if (s3 !== peg$FAILED) {
                        peg$reportedPos = s0;
                        s1 = peg$c58(s2);
                        s0 = s1;
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c2;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                  if (s0 === peg$FAILED) {
                    s0 = peg$currPos;
                    if (input.charCodeAt(peg$currPos) === 91) {
                      s1 = peg$c7;
                      peg$currPos++;
                    } else {
                      s1 = peg$FAILED;
                      if (peg$silentFails === 0) peg$fail(peg$c8);
                    }
                    if (s1 !== peg$FAILED) {
                      s2 = [];
                      s3 = peg$parsearray_value_list();
                      if (s3 !== peg$FAILED) {
                        while (s3 !== peg$FAILED) {
                          s2.push(s3);
                          s3 = peg$parsearray_value_list();
                        }
                      } else {
                        s2 = peg$c2;
                      }
                      if (s2 !== peg$FAILED) {
                        if (input.charCodeAt(peg$currPos) === 93) {
                          s3 = peg$c9;
                          peg$currPos++;
                        } else {
                          s3 = peg$FAILED;
                          if (peg$silentFails === 0) peg$fail(peg$c10);
                        }
                        if (s3 !== peg$FAILED) {
                          peg$reportedPos = s0;
                          s1 = peg$c59(s2);
                          s0 = s1;
                        } else {
                          peg$currPos = s0;
                          s0 = peg$c2;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c2;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                    if (s0 === peg$FAILED) {
                      s0 = peg$currPos;
                      if (input.charCodeAt(peg$currPos) === 91) {
                        s1 = peg$c7;
                        peg$currPos++;
                      } else {
                        s1 = peg$FAILED;
                        if (peg$silentFails === 0) peg$fail(peg$c8);
                      }
                      if (s1 !== peg$FAILED) {
                        s2 = [];
                        s3 = peg$parsearray_value_list();
                        if (s3 !== peg$FAILED) {
                          while (s3 !== peg$FAILED) {
                            s2.push(s3);
                            s3 = peg$parsearray_value_list();
                          }
                        } else {
                          s2 = peg$c2;
                        }
                        if (s2 !== peg$FAILED) {
                          s3 = peg$parsearray_value();
                          if (s3 !== peg$FAILED) {
                            if (input.charCodeAt(peg$currPos) === 93) {
                              s4 = peg$c9;
                              peg$currPos++;
                            } else {
                              s4 = peg$FAILED;
                              if (peg$silentFails === 0) peg$fail(peg$c10);
                            }
                            if (s4 !== peg$FAILED) {
                              peg$reportedPos = s0;
                              s1 = peg$c60(s2, s3);
                              s0 = s1;
                            } else {
                              peg$currPos = s0;
                              s0 = peg$c2;
                            }
                          } else {
                            peg$currPos = s0;
                            s0 = peg$c2;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$c2;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c2;
                      }
                    }
                  }
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parsearray_value() {
                var s0, s1, s2, s3, s4;

                var key = peg$currPos * 49 + 29,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                s1 = [];
                s2 = peg$parsearray_sep();
                while (s2 !== peg$FAILED) {
                  s1.push(s2);
                  s2 = peg$parsearray_sep();
                }
                if (s1 !== peg$FAILED) {
                  s2 = peg$parsevalue();
                  if (s2 !== peg$FAILED) {
                    s3 = [];
                    s4 = peg$parsearray_sep();
                    while (s4 !== peg$FAILED) {
                      s3.push(s4);
                      s4 = peg$parsearray_sep();
                    }
                    if (s3 !== peg$FAILED) {
                      peg$reportedPos = s0;
                      s1 = peg$c61(s2);
                      s0 = s1;
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c2;
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parsearray_value_list() {
                var s0, s1, s2, s3, s4, s5, s6;

                var key = peg$currPos * 49 + 30,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                s1 = [];
                s2 = peg$parsearray_sep();
                while (s2 !== peg$FAILED) {
                  s1.push(s2);
                  s2 = peg$parsearray_sep();
                }
                if (s1 !== peg$FAILED) {
                  s2 = peg$parsevalue();
                  if (s2 !== peg$FAILED) {
                    s3 = [];
                    s4 = peg$parsearray_sep();
                    while (s4 !== peg$FAILED) {
                      s3.push(s4);
                      s4 = peg$parsearray_sep();
                    }
                    if (s3 !== peg$FAILED) {
                      if (input.charCodeAt(peg$currPos) === 44) {
                        s4 = peg$c62;
                        peg$currPos++;
                      } else {
                        s4 = peg$FAILED;
                        if (peg$silentFails === 0) peg$fail(peg$c63);
                      }
                      if (s4 !== peg$FAILED) {
                        s5 = [];
                        s6 = peg$parsearray_sep();
                        while (s6 !== peg$FAILED) {
                          s5.push(s6);
                          s6 = peg$parsearray_sep();
                        }
                        if (s5 !== peg$FAILED) {
                          peg$reportedPos = s0;
                          s1 = peg$c61(s2);
                          s0 = s1;
                        } else {
                          peg$currPos = s0;
                          s0 = peg$c2;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c2;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c2;
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parsearray_sep() {
                var s0;

                var key = peg$currPos * 49 + 31,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$parseS();
                if (s0 === peg$FAILED) {
                  s0 = peg$parseNL();
                  if (s0 === peg$FAILED) {
                    s0 = peg$parsecomment();
                  }
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parseinline_table() {
                var s0, s1, s2, s3, s4, s5;

                var key = peg$currPos * 49 + 32,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                if (input.charCodeAt(peg$currPos) === 123) {
                  s1 = peg$c64;
                  peg$currPos++;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) peg$fail(peg$c65);
                }
                if (s1 !== peg$FAILED) {
                  s2 = [];
                  s3 = peg$parseS();
                  while (s3 !== peg$FAILED) {
                    s2.push(s3);
                    s3 = peg$parseS();
                  }
                  if (s2 !== peg$FAILED) {
                    s3 = [];
                    s4 = peg$parseinline_table_assignment();
                    while (s4 !== peg$FAILED) {
                      s3.push(s4);
                      s4 = peg$parseinline_table_assignment();
                    }
                    if (s3 !== peg$FAILED) {
                      s4 = [];
                      s5 = peg$parseS();
                      while (s5 !== peg$FAILED) {
                        s4.push(s5);
                        s5 = peg$parseS();
                      }
                      if (s4 !== peg$FAILED) {
                        if (input.charCodeAt(peg$currPos) === 125) {
                          s5 = peg$c66;
                          peg$currPos++;
                        } else {
                          s5 = peg$FAILED;
                          if (peg$silentFails === 0) peg$fail(peg$c67);
                        }
                        if (s5 !== peg$FAILED) {
                          peg$reportedPos = s0;
                          s1 = peg$c68(s3);
                          s0 = s1;
                        } else {
                          peg$currPos = s0;
                          s0 = peg$c2;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c2;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c2;
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parseinline_table_assignment() {
                var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10;

                var key = peg$currPos * 49 + 33,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                s1 = [];
                s2 = peg$parseS();
                while (s2 !== peg$FAILED) {
                  s1.push(s2);
                  s2 = peg$parseS();
                }
                if (s1 !== peg$FAILED) {
                  s2 = peg$parsekey();
                  if (s2 !== peg$FAILED) {
                    s3 = [];
                    s4 = peg$parseS();
                    while (s4 !== peg$FAILED) {
                      s3.push(s4);
                      s4 = peg$parseS();
                    }
                    if (s3 !== peg$FAILED) {
                      if (input.charCodeAt(peg$currPos) === 61) {
                        s4 = peg$c18;
                        peg$currPos++;
                      } else {
                        s4 = peg$FAILED;
                        if (peg$silentFails === 0) peg$fail(peg$c19);
                      }
                      if (s4 !== peg$FAILED) {
                        s5 = [];
                        s6 = peg$parseS();
                        while (s6 !== peg$FAILED) {
                          s5.push(s6);
                          s6 = peg$parseS();
                        }
                        if (s5 !== peg$FAILED) {
                          s6 = peg$parsevalue();
                          if (s6 !== peg$FAILED) {
                            s7 = [];
                            s8 = peg$parseS();
                            while (s8 !== peg$FAILED) {
                              s7.push(s8);
                              s8 = peg$parseS();
                            }
                            if (s7 !== peg$FAILED) {
                              if (input.charCodeAt(peg$currPos) === 44) {
                                s8 = peg$c62;
                                peg$currPos++;
                              } else {
                                s8 = peg$FAILED;
                                if (peg$silentFails === 0) peg$fail(peg$c63);
                              }
                              if (s8 !== peg$FAILED) {
                                s9 = [];
                                s10 = peg$parseS();
                                while (s10 !== peg$FAILED) {
                                  s9.push(s10);
                                  s10 = peg$parseS();
                                }
                                if (s9 !== peg$FAILED) {
                                  peg$reportedPos = s0;
                                  s1 = peg$c69(s2, s6);
                                  s0 = s1;
                                } else {
                                  peg$currPos = s0;
                                  s0 = peg$c2;
                                }
                              } else {
                                peg$currPos = s0;
                                s0 = peg$c2;
                              }
                            } else {
                              peg$currPos = s0;
                              s0 = peg$c2;
                            }
                          } else {
                            peg$currPos = s0;
                            s0 = peg$c2;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$c2;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c2;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c2;
                }
                if (s0 === peg$FAILED) {
                  s0 = peg$currPos;
                  s1 = [];
                  s2 = peg$parseS();
                  while (s2 !== peg$FAILED) {
                    s1.push(s2);
                    s2 = peg$parseS();
                  }
                  if (s1 !== peg$FAILED) {
                    s2 = peg$parsekey();
                    if (s2 !== peg$FAILED) {
                      s3 = [];
                      s4 = peg$parseS();
                      while (s4 !== peg$FAILED) {
                        s3.push(s4);
                        s4 = peg$parseS();
                      }
                      if (s3 !== peg$FAILED) {
                        if (input.charCodeAt(peg$currPos) === 61) {
                          s4 = peg$c18;
                          peg$currPos++;
                        } else {
                          s4 = peg$FAILED;
                          if (peg$silentFails === 0) peg$fail(peg$c19);
                        }
                        if (s4 !== peg$FAILED) {
                          s5 = [];
                          s6 = peg$parseS();
                          while (s6 !== peg$FAILED) {
                            s5.push(s6);
                            s6 = peg$parseS();
                          }
                          if (s5 !== peg$FAILED) {
                            s6 = peg$parsevalue();
                            if (s6 !== peg$FAILED) {
                              peg$reportedPos = s0;
                              s1 = peg$c69(s2, s6);
                              s0 = s1;
                            } else {
                              peg$currPos = s0;
                              s0 = peg$c2;
                            }
                          } else {
                            peg$currPos = s0;
                            s0 = peg$c2;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$c2;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c2;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parsesecfragment() {
                var s0, s1, s2;

                var key = peg$currPos * 49 + 34,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                if (input.charCodeAt(peg$currPos) === 46) {
                  s1 = peg$c16;
                  peg$currPos++;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) peg$fail(peg$c17);
                }
                if (s1 !== peg$FAILED) {
                  s2 = peg$parseDIGITS();
                  if (s2 !== peg$FAILED) {
                    peg$reportedPos = s0;
                    s1 = peg$c70(s2);
                    s0 = s1;
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c2;
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parsedate() {
                var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11;

                var key = peg$currPos * 49 + 35,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                s1 = peg$currPos;
                s2 = peg$parseDIGIT_OR_UNDER();
                if (s2 !== peg$FAILED) {
                  s3 = peg$parseDIGIT_OR_UNDER();
                  if (s3 !== peg$FAILED) {
                    s4 = peg$parseDIGIT_OR_UNDER();
                    if (s4 !== peg$FAILED) {
                      s5 = peg$parseDIGIT_OR_UNDER();
                      if (s5 !== peg$FAILED) {
                        if (input.charCodeAt(peg$currPos) === 45) {
                          s6 = peg$c47;
                          peg$currPos++;
                        } else {
                          s6 = peg$FAILED;
                          if (peg$silentFails === 0) peg$fail(peg$c48);
                        }
                        if (s6 !== peg$FAILED) {
                          s7 = peg$parseDIGIT_OR_UNDER();
                          if (s7 !== peg$FAILED) {
                            s8 = peg$parseDIGIT_OR_UNDER();
                            if (s8 !== peg$FAILED) {
                              if (input.charCodeAt(peg$currPos) === 45) {
                                s9 = peg$c47;
                                peg$currPos++;
                              } else {
                                s9 = peg$FAILED;
                                if (peg$silentFails === 0) peg$fail(peg$c48);
                              }
                              if (s9 !== peg$FAILED) {
                                s10 = peg$parseDIGIT_OR_UNDER();
                                if (s10 !== peg$FAILED) {
                                  s11 = peg$parseDIGIT_OR_UNDER();
                                  if (s11 !== peg$FAILED) {
                                    s2 = [
                                      s2,
                                      s3,
                                      s4,
                                      s5,
                                      s6,
                                      s7,
                                      s8,
                                      s9,
                                      s10,
                                      s11,
                                    ];
                                    s1 = s2;
                                  } else {
                                    peg$currPos = s1;
                                    s1 = peg$c2;
                                  }
                                } else {
                                  peg$currPos = s1;
                                  s1 = peg$c2;
                                }
                              } else {
                                peg$currPos = s1;
                                s1 = peg$c2;
                              }
                            } else {
                              peg$currPos = s1;
                              s1 = peg$c2;
                            }
                          } else {
                            peg$currPos = s1;
                            s1 = peg$c2;
                          }
                        } else {
                          peg$currPos = s1;
                          s1 = peg$c2;
                        }
                      } else {
                        peg$currPos = s1;
                        s1 = peg$c2;
                      }
                    } else {
                      peg$currPos = s1;
                      s1 = peg$c2;
                    }
                  } else {
                    peg$currPos = s1;
                    s1 = peg$c2;
                  }
                } else {
                  peg$currPos = s1;
                  s1 = peg$c2;
                }
                if (s1 !== peg$FAILED) {
                  peg$reportedPos = s0;
                  s1 = peg$c71(s1);
                }
                s0 = s1;

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parsetime() {
                var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10;

                var key = peg$currPos * 49 + 36,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                s1 = peg$currPos;
                s2 = peg$parseDIGIT_OR_UNDER();
                if (s2 !== peg$FAILED) {
                  s3 = peg$parseDIGIT_OR_UNDER();
                  if (s3 !== peg$FAILED) {
                    if (input.charCodeAt(peg$currPos) === 58) {
                      s4 = peg$c72;
                      peg$currPos++;
                    } else {
                      s4 = peg$FAILED;
                      if (peg$silentFails === 0) peg$fail(peg$c73);
                    }
                    if (s4 !== peg$FAILED) {
                      s5 = peg$parseDIGIT_OR_UNDER();
                      if (s5 !== peg$FAILED) {
                        s6 = peg$parseDIGIT_OR_UNDER();
                        if (s6 !== peg$FAILED) {
                          if (input.charCodeAt(peg$currPos) === 58) {
                            s7 = peg$c72;
                            peg$currPos++;
                          } else {
                            s7 = peg$FAILED;
                            if (peg$silentFails === 0) peg$fail(peg$c73);
                          }
                          if (s7 !== peg$FAILED) {
                            s8 = peg$parseDIGIT_OR_UNDER();
                            if (s8 !== peg$FAILED) {
                              s9 = peg$parseDIGIT_OR_UNDER();
                              if (s9 !== peg$FAILED) {
                                s10 = peg$parsesecfragment();
                                if (s10 === peg$FAILED) {
                                  s10 = peg$c25;
                                }
                                if (s10 !== peg$FAILED) {
                                  s2 = [s2, s3, s4, s5, s6, s7, s8, s9, s10];
                                  s1 = s2;
                                } else {
                                  peg$currPos = s1;
                                  s1 = peg$c2;
                                }
                              } else {
                                peg$currPos = s1;
                                s1 = peg$c2;
                              }
                            } else {
                              peg$currPos = s1;
                              s1 = peg$c2;
                            }
                          } else {
                            peg$currPos = s1;
                            s1 = peg$c2;
                          }
                        } else {
                          peg$currPos = s1;
                          s1 = peg$c2;
                        }
                      } else {
                        peg$currPos = s1;
                        s1 = peg$c2;
                      }
                    } else {
                      peg$currPos = s1;
                      s1 = peg$c2;
                    }
                  } else {
                    peg$currPos = s1;
                    s1 = peg$c2;
                  }
                } else {
                  peg$currPos = s1;
                  s1 = peg$c2;
                }
                if (s1 !== peg$FAILED) {
                  peg$reportedPos = s0;
                  s1 = peg$c74(s1);
                }
                s0 = s1;

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parsetime_with_offset() {
                var s0,
                  s1,
                  s2,
                  s3,
                  s4,
                  s5,
                  s6,
                  s7,
                  s8,
                  s9,
                  s10,
                  s11,
                  s12,
                  s13,
                  s14,
                  s15,
                  s16;

                var key = peg$currPos * 49 + 37,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                s1 = peg$currPos;
                s2 = peg$parseDIGIT_OR_UNDER();
                if (s2 !== peg$FAILED) {
                  s3 = peg$parseDIGIT_OR_UNDER();
                  if (s3 !== peg$FAILED) {
                    if (input.charCodeAt(peg$currPos) === 58) {
                      s4 = peg$c72;
                      peg$currPos++;
                    } else {
                      s4 = peg$FAILED;
                      if (peg$silentFails === 0) peg$fail(peg$c73);
                    }
                    if (s4 !== peg$FAILED) {
                      s5 = peg$parseDIGIT_OR_UNDER();
                      if (s5 !== peg$FAILED) {
                        s6 = peg$parseDIGIT_OR_UNDER();
                        if (s6 !== peg$FAILED) {
                          if (input.charCodeAt(peg$currPos) === 58) {
                            s7 = peg$c72;
                            peg$currPos++;
                          } else {
                            s7 = peg$FAILED;
                            if (peg$silentFails === 0) peg$fail(peg$c73);
                          }
                          if (s7 !== peg$FAILED) {
                            s8 = peg$parseDIGIT_OR_UNDER();
                            if (s8 !== peg$FAILED) {
                              s9 = peg$parseDIGIT_OR_UNDER();
                              if (s9 !== peg$FAILED) {
                                s10 = peg$parsesecfragment();
                                if (s10 === peg$FAILED) {
                                  s10 = peg$c25;
                                }
                                if (s10 !== peg$FAILED) {
                                  if (input.charCodeAt(peg$currPos) === 45) {
                                    s11 = peg$c47;
                                    peg$currPos++;
                                  } else {
                                    s11 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                      peg$fail(peg$c48);
                                    }
                                  }
                                  if (s11 === peg$FAILED) {
                                    if (input.charCodeAt(peg$currPos) === 43) {
                                      s11 = peg$c44;
                                      peg$currPos++;
                                    } else {
                                      s11 = peg$FAILED;
                                      if (peg$silentFails === 0) {
                                        peg$fail(peg$c45);
                                      }
                                    }
                                  }
                                  if (s11 !== peg$FAILED) {
                                    s12 = peg$parseDIGIT_OR_UNDER();
                                    if (s12 !== peg$FAILED) {
                                      s13 = peg$parseDIGIT_OR_UNDER();
                                      if (s13 !== peg$FAILED) {
                                        if (
                                          input.charCodeAt(peg$currPos) === 58
                                        ) {
                                          s14 = peg$c72;
                                          peg$currPos++;
                                        } else {
                                          s14 = peg$FAILED;
                                          if (peg$silentFails === 0) {
                                            peg$fail(peg$c73);
                                          }
                                        }
                                        if (s14 !== peg$FAILED) {
                                          s15 = peg$parseDIGIT_OR_UNDER();
                                          if (s15 !== peg$FAILED) {
                                            s16 = peg$parseDIGIT_OR_UNDER();
                                            if (s16 !== peg$FAILED) {
                                              s2 = [
                                                s2,
                                                s3,
                                                s4,
                                                s5,
                                                s6,
                                                s7,
                                                s8,
                                                s9,
                                                s10,
                                                s11,
                                                s12,
                                                s13,
                                                s14,
                                                s15,
                                                s16,
                                              ];
                                              s1 = s2;
                                            } else {
                                              peg$currPos = s1;
                                              s1 = peg$c2;
                                            }
                                          } else {
                                            peg$currPos = s1;
                                            s1 = peg$c2;
                                          }
                                        } else {
                                          peg$currPos = s1;
                                          s1 = peg$c2;
                                        }
                                      } else {
                                        peg$currPos = s1;
                                        s1 = peg$c2;
                                      }
                                    } else {
                                      peg$currPos = s1;
                                      s1 = peg$c2;
                                    }
                                  } else {
                                    peg$currPos = s1;
                                    s1 = peg$c2;
                                  }
                                } else {
                                  peg$currPos = s1;
                                  s1 = peg$c2;
                                }
                              } else {
                                peg$currPos = s1;
                                s1 = peg$c2;
                              }
                            } else {
                              peg$currPos = s1;
                              s1 = peg$c2;
                            }
                          } else {
                            peg$currPos = s1;
                            s1 = peg$c2;
                          }
                        } else {
                          peg$currPos = s1;
                          s1 = peg$c2;
                        }
                      } else {
                        peg$currPos = s1;
                        s1 = peg$c2;
                      }
                    } else {
                      peg$currPos = s1;
                      s1 = peg$c2;
                    }
                  } else {
                    peg$currPos = s1;
                    s1 = peg$c2;
                  }
                } else {
                  peg$currPos = s1;
                  s1 = peg$c2;
                }
                if (s1 !== peg$FAILED) {
                  peg$reportedPos = s0;
                  s1 = peg$c74(s1);
                }
                s0 = s1;

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parsedatetime() {
                var s0, s1, s2, s3, s4;

                var key = peg$currPos * 49 + 38,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                s1 = peg$parsedate();
                if (s1 !== peg$FAILED) {
                  if (input.charCodeAt(peg$currPos) === 84) {
                    s2 = peg$c75;
                    peg$currPos++;
                  } else {
                    s2 = peg$FAILED;
                    if (peg$silentFails === 0) peg$fail(peg$c76);
                  }
                  if (s2 !== peg$FAILED) {
                    s3 = peg$parsetime();
                    if (s3 !== peg$FAILED) {
                      if (input.charCodeAt(peg$currPos) === 90) {
                        s4 = peg$c77;
                        peg$currPos++;
                      } else {
                        s4 = peg$FAILED;
                        if (peg$silentFails === 0) peg$fail(peg$c78);
                      }
                      if (s4 !== peg$FAILED) {
                        peg$reportedPos = s0;
                        s1 = peg$c79(s1, s3);
                        s0 = s1;
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c2;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c2;
                }
                if (s0 === peg$FAILED) {
                  s0 = peg$currPos;
                  s1 = peg$parsedate();
                  if (s1 !== peg$FAILED) {
                    if (input.charCodeAt(peg$currPos) === 84) {
                      s2 = peg$c75;
                      peg$currPos++;
                    } else {
                      s2 = peg$FAILED;
                      if (peg$silentFails === 0) peg$fail(peg$c76);
                    }
                    if (s2 !== peg$FAILED) {
                      s3 = peg$parsetime_with_offset();
                      if (s3 !== peg$FAILED) {
                        peg$reportedPos = s0;
                        s1 = peg$c80(s1, s3);
                        s0 = s1;
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c2;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parseS() {
                var s0;

                var key = peg$currPos * 49 + 39,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                if (peg$c81.test(input.charAt(peg$currPos))) {
                  s0 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s0 = peg$FAILED;
                  if (peg$silentFails === 0) peg$fail(peg$c82);
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parseNL() {
                var s0, s1, s2;

                var key = peg$currPos * 49 + 40,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                if (input.charCodeAt(peg$currPos) === 10) {
                  s0 = peg$c83;
                  peg$currPos++;
                } else {
                  s0 = peg$FAILED;
                  if (peg$silentFails === 0) peg$fail(peg$c84);
                }
                if (s0 === peg$FAILED) {
                  s0 = peg$currPos;
                  if (input.charCodeAt(peg$currPos) === 13) {
                    s1 = peg$c85;
                    peg$currPos++;
                  } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) peg$fail(peg$c86);
                  }
                  if (s1 !== peg$FAILED) {
                    if (input.charCodeAt(peg$currPos) === 10) {
                      s2 = peg$c83;
                      peg$currPos++;
                    } else {
                      s2 = peg$FAILED;
                      if (peg$silentFails === 0) peg$fail(peg$c84);
                    }
                    if (s2 !== peg$FAILED) {
                      s1 = [s1, s2];
                      s0 = s1;
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parseNLS() {
                var s0;

                var key = peg$currPos * 49 + 41,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$parseNL();
                if (s0 === peg$FAILED) {
                  s0 = peg$parseS();
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parseEOF() {
                var s0, s1;

                var key = peg$currPos * 49 + 42,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                peg$silentFails++;
                if (input.length > peg$currPos) {
                  s1 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) peg$fail(peg$c6);
                }
                peg$silentFails--;
                if (s1 === peg$FAILED) {
                  s0 = peg$c5;
                } else {
                  peg$currPos = s0;
                  s0 = peg$c2;
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parseHEX() {
                var s0;

                var key = peg$currPos * 49 + 43,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                if (peg$c87.test(input.charAt(peg$currPos))) {
                  s0 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s0 = peg$FAILED;
                  if (peg$silentFails === 0) peg$fail(peg$c88);
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parseDIGIT_OR_UNDER() {
                var s0, s1;

                var key = peg$currPos * 49 + 44,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                if (peg$c89.test(input.charAt(peg$currPos))) {
                  s0 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s0 = peg$FAILED;
                  if (peg$silentFails === 0) peg$fail(peg$c90);
                }
                if (s0 === peg$FAILED) {
                  s0 = peg$currPos;
                  if (input.charCodeAt(peg$currPos) === 95) {
                    s1 = peg$c91;
                    peg$currPos++;
                  } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) peg$fail(peg$c92);
                  }
                  if (s1 !== peg$FAILED) {
                    peg$reportedPos = s0;
                    s1 = peg$c93();
                  }
                  s0 = s1;
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parseASCII_BASIC() {
                var s0;

                var key = peg$currPos * 49 + 45,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                if (peg$c94.test(input.charAt(peg$currPos))) {
                  s0 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s0 = peg$FAILED;
                  if (peg$silentFails === 0) peg$fail(peg$c95);
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parseDIGITS() {
                var s0, s1, s2;

                var key = peg$currPos * 49 + 46,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                s1 = [];
                s2 = peg$parseDIGIT_OR_UNDER();
                if (s2 !== peg$FAILED) {
                  while (s2 !== peg$FAILED) {
                    s1.push(s2);
                    s2 = peg$parseDIGIT_OR_UNDER();
                  }
                } else {
                  s1 = peg$c2;
                }
                if (s1 !== peg$FAILED) {
                  peg$reportedPos = s0;
                  s1 = peg$c96(s1);
                }
                s0 = s1;

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parseESCAPED() {
                var s0, s1;

                var key = peg$currPos * 49 + 47,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                if (input.substr(peg$currPos, 2) === peg$c97) {
                  s1 = peg$c97;
                  peg$currPos += 2;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) peg$fail(peg$c98);
                }
                if (s1 !== peg$FAILED) {
                  peg$reportedPos = s0;
                  s1 = peg$c99();
                }
                s0 = s1;
                if (s0 === peg$FAILED) {
                  s0 = peg$currPos;
                  if (input.substr(peg$currPos, 2) === peg$c100) {
                    s1 = peg$c100;
                    peg$currPos += 2;
                  } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) peg$fail(peg$c101);
                  }
                  if (s1 !== peg$FAILED) {
                    peg$reportedPos = s0;
                    s1 = peg$c102();
                  }
                  s0 = s1;
                  if (s0 === peg$FAILED) {
                    s0 = peg$currPos;
                    if (input.substr(peg$currPos, 2) === peg$c103) {
                      s1 = peg$c103;
                      peg$currPos += 2;
                    } else {
                      s1 = peg$FAILED;
                      if (peg$silentFails === 0) peg$fail(peg$c104);
                    }
                    if (s1 !== peg$FAILED) {
                      peg$reportedPos = s0;
                      s1 = peg$c105();
                    }
                    s0 = s1;
                    if (s0 === peg$FAILED) {
                      s0 = peg$currPos;
                      if (input.substr(peg$currPos, 2) === peg$c106) {
                        s1 = peg$c106;
                        peg$currPos += 2;
                      } else {
                        s1 = peg$FAILED;
                        if (peg$silentFails === 0) peg$fail(peg$c107);
                      }
                      if (s1 !== peg$FAILED) {
                        peg$reportedPos = s0;
                        s1 = peg$c108();
                      }
                      s0 = s1;
                      if (s0 === peg$FAILED) {
                        s0 = peg$currPos;
                        if (input.substr(peg$currPos, 2) === peg$c109) {
                          s1 = peg$c109;
                          peg$currPos += 2;
                        } else {
                          s1 = peg$FAILED;
                          if (peg$silentFails === 0) peg$fail(peg$c110);
                        }
                        if (s1 !== peg$FAILED) {
                          peg$reportedPos = s0;
                          s1 = peg$c111();
                        }
                        s0 = s1;
                        if (s0 === peg$FAILED) {
                          s0 = peg$currPos;
                          if (input.substr(peg$currPos, 2) === peg$c112) {
                            s1 = peg$c112;
                            peg$currPos += 2;
                          } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) peg$fail(peg$c113);
                          }
                          if (s1 !== peg$FAILED) {
                            peg$reportedPos = s0;
                            s1 = peg$c114();
                          }
                          s0 = s1;
                          if (s0 === peg$FAILED) {
                            s0 = peg$currPos;
                            if (input.substr(peg$currPos, 2) === peg$c115) {
                              s1 = peg$c115;
                              peg$currPos += 2;
                            } else {
                              s1 = peg$FAILED;
                              if (peg$silentFails === 0) peg$fail(peg$c116);
                            }
                            if (s1 !== peg$FAILED) {
                              peg$reportedPos = s0;
                              s1 = peg$c117();
                            }
                            s0 = s1;
                            if (s0 === peg$FAILED) {
                              s0 = peg$parseESCAPED_UNICODE();
                            }
                          }
                        }
                      }
                    }
                  }
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              function peg$parseESCAPED_UNICODE() {
                var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10;

                var key = peg$currPos * 49 + 48,
                  cached = peg$cache[key];

                if (cached) {
                  peg$currPos = cached.nextPos;
                  return cached.result;
                }

                s0 = peg$currPos;
                if (input.substr(peg$currPos, 2) === peg$c118) {
                  s1 = peg$c118;
                  peg$currPos += 2;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) peg$fail(peg$c119);
                }
                if (s1 !== peg$FAILED) {
                  s2 = peg$currPos;
                  s3 = peg$parseHEX();
                  if (s3 !== peg$FAILED) {
                    s4 = peg$parseHEX();
                    if (s4 !== peg$FAILED) {
                      s5 = peg$parseHEX();
                      if (s5 !== peg$FAILED) {
                        s6 = peg$parseHEX();
                        if (s6 !== peg$FAILED) {
                          s7 = peg$parseHEX();
                          if (s7 !== peg$FAILED) {
                            s8 = peg$parseHEX();
                            if (s8 !== peg$FAILED) {
                              s9 = peg$parseHEX();
                              if (s9 !== peg$FAILED) {
                                s10 = peg$parseHEX();
                                if (s10 !== peg$FAILED) {
                                  s3 = [s3, s4, s5, s6, s7, s8, s9, s10];
                                  s2 = s3;
                                } else {
                                  peg$currPos = s2;
                                  s2 = peg$c2;
                                }
                              } else {
                                peg$currPos = s2;
                                s2 = peg$c2;
                              }
                            } else {
                              peg$currPos = s2;
                              s2 = peg$c2;
                            }
                          } else {
                            peg$currPos = s2;
                            s2 = peg$c2;
                          }
                        } else {
                          peg$currPos = s2;
                          s2 = peg$c2;
                        }
                      } else {
                        peg$currPos = s2;
                        s2 = peg$c2;
                      }
                    } else {
                      peg$currPos = s2;
                      s2 = peg$c2;
                    }
                  } else {
                    peg$currPos = s2;
                    s2 = peg$c2;
                  }
                  if (s2 !== peg$FAILED) {
                    peg$reportedPos = s0;
                    s1 = peg$c120(s2);
                    s0 = s1;
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c2;
                }
                if (s0 === peg$FAILED) {
                  s0 = peg$currPos;
                  if (input.substr(peg$currPos, 2) === peg$c121) {
                    s1 = peg$c121;
                    peg$currPos += 2;
                  } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) peg$fail(peg$c122);
                  }
                  if (s1 !== peg$FAILED) {
                    s2 = peg$currPos;
                    s3 = peg$parseHEX();
                    if (s3 !== peg$FAILED) {
                      s4 = peg$parseHEX();
                      if (s4 !== peg$FAILED) {
                        s5 = peg$parseHEX();
                        if (s5 !== peg$FAILED) {
                          s6 = peg$parseHEX();
                          if (s6 !== peg$FAILED) {
                            s3 = [s3, s4, s5, s6];
                            s2 = s3;
                          } else {
                            peg$currPos = s2;
                            s2 = peg$c2;
                          }
                        } else {
                          peg$currPos = s2;
                          s2 = peg$c2;
                        }
                      } else {
                        peg$currPos = s2;
                        s2 = peg$c2;
                      }
                    } else {
                      peg$currPos = s2;
                      s2 = peg$c2;
                    }
                    if (s2 !== peg$FAILED) {
                      peg$reportedPos = s0;
                      s1 = peg$c120(s2);
                      s0 = s1;
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c2;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c2;
                  }
                }

                peg$cache[key] = { nextPos: peg$currPos, result: s0 };

                return s0;
              }

              var nodes = [];

              function genError(err, line, col) {
                var ex = new Error(err);
                ex.line = line;
                ex.column = col;
                throw ex;
              }

              function addNode(node) {
                nodes.push(node);
              }

              function node(type, value, line, column, key) {
                var obj = {
                  type: type,
                  value: value,
                  line: line(),
                  column: column(),
                };
                if (key) obj.key = key;
                return obj;
              }

              function convertCodePoint(str, line, col) {
                var num = parseInt("0x" + str);

                if (
                  !isFinite(num) ||
                  Math.floor(num) != num ||
                  num < 0 ||
                  num > 0x10FFFF ||
                  (num > 0xD7FF && num < 0xE000)
                ) {
                  genError("Invalid Unicode escape code: " + str, line, col);
                } else {
                  return fromCodePoint(num);
                }
              }

              function fromCodePoint() {
                var MAX_SIZE = 0x4000;
                var codeUnits = [];
                var highSurrogate;
                var lowSurrogate;
                var index = -1;
                var length = arguments.length;
                if (!length) {
                  return "";
                }
                var result = "";
                while (++index < length) {
                  var codePoint = Number(arguments[index]);
                  if (codePoint <= 0xFFFF) { // BMP code point
                    codeUnits.push(codePoint);
                  } else { // Astral code point; split in surrogate halves
                    // http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
                    codePoint -= 0x10000;
                    highSurrogate = (codePoint >> 10) + 0xD800;
                    lowSurrogate = (codePoint % 0x400) + 0xDC00;
                    codeUnits.push(highSurrogate, lowSurrogate);
                  }
                  if (index + 1 == length || codeUnits.length > MAX_SIZE) {
                    result += String.fromCharCode.apply(null, codeUnits);
                    codeUnits.length = 0;
                  }
                }
                return result;
              }

              peg$result = peg$startRuleFunction();

              if (peg$result !== peg$FAILED && peg$currPos === input.length) {
                return peg$result;
              } else {
                if (peg$result !== peg$FAILED && peg$currPos < input.length) {
                  peg$fail({ type: "end", description: "end of input" });
                }

                throw peg$buildException(
                  null,
                  peg$maxFailExpected,
                  peg$maxFailPos,
                );
              }
            }

            return {
              SyntaxError: SyntaxError,
              parse: parse,
            };
          })();
        }, {}],
      },
      {},
      [1],
    )(1);
  });
});

var toml_1 = function parseTOML(text) {
  return json(JSON.stringify(tomlNode3_0_0.parse(text)));
};

var stringify = function stringify(obj) {
  if (typeof obj !== "object") return;
  let pragmas = Object.keys(obj);
  let out = "";
  pragmas.forEach(function (pragma, i) {
    let props = obj[pragma];
    out += i === 0 ? `@${pragma}\n` : `\n@${pragma}\n`;

    props.forEach(function (prop) {
      if (typeof prop === "string") {
        out += `${prop}\n`;
      }

      if (typeof prop === "number") {
        out += `${prop}\n`;
      }

      if (typeof prop === "boolean") {
        out += `${prop ? "true" : "false"}\n`;
      }

      if (typeof prop === "object") {
        if (Array.isArray(prop)) {
          prop.forEach((p) => {
            out += `${p} `;
          });
          out += "\n";
        } else {
          for (let key in prop) {
            out += `${key}`;
            let subs = prop[key];
            for (let property in subs) {
              out += `\n  ${property} ${subs[property]}`;
            }
            out += `\n`;
          }
        }
      }
    });
  });
  return out;
};

var ajv6_10_2 = createCommonjsModule(function (module, exports) {
  (function (f) {
    {
      module.exports = f();
    }
  })(function () {
    return (function () {
      function r(e, n, t) {
        function o(i, f) {
          if (!n[i]) {
            if (!e[i]) {
              var c = "function" == typeof require && require;
              if (!f && c) return c(i, !0);
              if (u) return u(i, !0);
              var a = new Error("Cannot find module '" + i + "'");
              throw a.code = "MODULE_NOT_FOUND", a;
            }
            var p = n[i] = { exports: {} };
            e[i][0].call(
              p.exports,
              function (r) {
                var n = e[i][1][r];
                return o(n || r);
              },
              p,
              p.exports,
              r,
              e,
              n,
              t,
            );
          }
          return n[i].exports;
        }
        for (
          var u = "function" == typeof require && require, i = 0;
          i < t.length;
          i++
        ) {
          o(t[i]);
        }
        return o;
      }
      return r;
    })()(
      {
        1: [function (require, module, exports) {
          var Cache = module.exports = function Cache() {
            this._cache = {};
          };

          Cache.prototype.put = function Cache_put(key, value) {
            this._cache[key] = value;
          };

          Cache.prototype.get = function Cache_get(key) {
            return this._cache[key];
          };

          Cache.prototype.del = function Cache_del(key) {
            delete this._cache[key];
          };

          Cache.prototype.clear = function Cache_clear() {
            this._cache = {};
          };
        }, {}],
        2: [function (require, module, exports) {
          var MissingRefError = require("./error_classes").MissingRef;

          module.exports = compileAsync;

          /**
 * Creates validating function for passed schema with asynchronous loading of missing schemas.
 * `loadSchema` option should be a function that accepts schema uri and returns promise that resolves with the schema.
 * @this  Ajv
 * @param {Object}   schema schema object
 * @param {Boolean}  meta optional true to compile meta-schema; this parameter can be skipped
 * @param {Function} callback an optional node-style callback, it is called with 2 parameters: error (or null) and validating function.
 * @return {Promise} promise that resolves with a validating function.
 */
          function compileAsync(schema, meta, callback) {
            /* eslint no-shadow: 0 */
            /* global Promise */
            /* jshint validthis: true */
            var self = this;
            if (typeof this._opts.loadSchema != "function") {
              throw new Error("options.loadSchema should be a function");
            }

            if (typeof meta == "function") {
              callback = meta;
              meta = undefined;
            }

            var p = loadMetaSchemaOf(schema).then(function () {
              var schemaObj = self._addSchema(schema, undefined, meta);
              return schemaObj.validate || _compileAsync(schemaObj);
            });

            if (callback) {
              p.then(
                function (v) {
                  callback(null, v);
                },
                callback,
              );
            }

            return p;

            function loadMetaSchemaOf(sch) {
              var $schema = sch.$schema;
              return $schema && !self.getSchema($schema)
                ? compileAsync.call(self, { $ref: $schema }, true)
                : Promise.resolve();
            }

            function _compileAsync(schemaObj) {
              try {
                return self._compile(schemaObj);
              } catch (e) {
                if (e instanceof MissingRefError) return loadMissingSchema(e);
                throw e;
              }

              function loadMissingSchema(e) {
                var ref = e.missingSchema;
                if (added(ref)) {
                  throw new Error(
                    "Schema " + ref + " is loaded but " + e.missingRef +
                      " cannot be resolved",
                  );
                }

                var schemaPromise = self._loadingSchemas[ref];
                if (!schemaPromise) {
                  schemaPromise = self._loadingSchemas[ref] = self._opts
                    .loadSchema(ref);
                  schemaPromise.then(removePromise, removePromise);
                }

                return schemaPromise.then(function (sch) {
                  if (!added(ref)) {
                    return loadMetaSchemaOf(sch).then(function () {
                      if (!added(ref)) {
                        self.addSchema(sch, ref, undefined, meta);
                      }
                    });
                  }
                }).then(function () {
                  return _compileAsync(schemaObj);
                });

                function removePromise() {
                  delete self._loadingSchemas[ref];
                }

                function added(ref) {
                  return self._refs[ref] || self._schemas[ref];
                }
              }
            }
          }
        }, { "./error_classes": 3 }],
        3: [function (require, module, exports) {
          var resolve = require("./resolve");

          module.exports = {
            Validation: errorSubclass(ValidationError),
            MissingRef: errorSubclass(MissingRefError),
          };

          function ValidationError(errors) {
            this.message = "validation failed";
            this.errors = errors;
            this.ajv = this.validation = true;
          }

          MissingRefError.message = function (baseId, ref) {
            return "can't resolve reference " + ref + " from id " + baseId;
          };

          function MissingRefError(baseId, ref, message) {
            this.message = message || MissingRefError.message(baseId, ref);
            this.missingRef = resolve.url(baseId, ref);
            this.missingSchema = resolve.normalizeId(
              resolve.fullPath(this.missingRef),
            );
          }

          function errorSubclass(Subclass) {
            Subclass.prototype = Object.create(Error.prototype);
            Subclass.prototype.constructor = Subclass;
            return Subclass;
          }
        }, { "./resolve": 6 }],
        4: [function (require, module, exports) {
          var util = require("./util");

          var DATE = /^(\d\d\d\d)-(\d\d)-(\d\d)$/;
          var DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
          var TIME = /^(\d\d):(\d\d):(\d\d)(\.\d+)?(z|[+-]\d\d:\d\d)?$/i;
          var HOSTNAME =
            /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[-0-9a-z]{0,61}[0-9a-z])?)*$/i;
          var URI =
            /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)(?:\?(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;
          var URIREF =
            /^(?:[a-z][a-z0-9+\-.]*:)?(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'"()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?(?:\?(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;
          // uri-template: https://tools.ietf.org/html/rfc6570
          var URITEMPLATE =
            /^(?:(?:[^\x00-\x20"'<>%\\^`{|}]|%[0-9a-f]{2})|\{[+#./;?&=,!@|]?(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?(?:,(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?)*\})*$/i;
          // For the source: https://gist.github.com/dperini/729294
          // For test cases: https://mathiasbynens.be/demo/url-regex
          // @todo Delete current URL in favour of the commented out URL rule when this issue is fixed https://github.com/eslint/eslint/issues/7983.
          // var URL = /^(?:(?:https?|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?!10(?:\.\d{1,3}){3})(?!127(?:\.\d{1,3}){3})(?!169\.254(?:\.\d{1,3}){2})(?!192\.168(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u{00a1}-\u{ffff}0-9]+-?)*[a-z\u{00a1}-\u{ffff}0-9]+)(?:\.(?:[a-z\u{00a1}-\u{ffff}0-9]+-?)*[a-z\u{00a1}-\u{ffff}0-9]+)*(?:\.(?:[a-z\u{00a1}-\u{ffff}]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?$/iu;
          var URL =
            /^(?:(?:http[s\u017F]?|ftp):\/\/)(?:(?:[\0-\x08\x0E-\x1F!-\x9F\xA1-\u167F\u1681-\u1FFF\u200B-\u2027\u202A-\u202E\u2030-\u205E\u2060-\u2FFF\u3001-\uD7FF\uE000-\uFEFE\uFF00-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])+(?::(?:[\0-\x08\x0E-\x1F!-\x9F\xA1-\u167F\u1681-\u1FFF\u200B-\u2027\u202A-\u202E\u2030-\u205E\u2060-\u2FFF\u3001-\uD7FF\uE000-\uFEFE\uFF00-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])*)?@)?(?:(?!10(?:\.[0-9]{1,3}){3})(?!127(?:\.[0-9]{1,3}){3})(?!169\.254(?:\.[0-9]{1,3}){2})(?!192\.168(?:\.[0-9]{1,3}){2})(?!172\.(?:1[6-9]|2[0-9]|3[01])(?:\.[0-9]{1,3}){2})(?:[1-9][0-9]?|1[0-9][0-9]|2[01][0-9]|22[0-3])(?:\.(?:1?[0-9]{1,2}|2[0-4][0-9]|25[0-5])){2}(?:\.(?:[1-9][0-9]?|1[0-9][0-9]|2[0-4][0-9]|25[0-4]))|(?:(?:(?:[0-9KSa-z\xA1-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])+-?)*(?:[0-9KSa-z\xA1-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])+)(?:\.(?:(?:[0-9KSa-z\xA1-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])+-?)*(?:[0-9KSa-z\xA1-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])+)*(?:\.(?:(?:[KSa-z\xA1-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]){2,})))(?::[0-9]{2,5})?(?:\/(?:[\0-\x08\x0E-\x1F!-\x9F\xA1-\u167F\u1681-\u1FFF\u200B-\u2027\u202A-\u202E\u2030-\u205E\u2060-\u2FFF\u3001-\uD7FF\uE000-\uFEFE\uFF00-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])*)?$/i;
          var UUID =
            /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
          var JSON_POINTER = /^(?:\/(?:[^~/]|~0|~1)*)*$/;
          var JSON_POINTER_URI_FRAGMENT =
            /^#(?:\/(?:[a-z0-9_\-.!$&'()*+,;:=@]|%[0-9a-f]{2}|~0|~1)*)*$/i;
          var RELATIVE_JSON_POINTER =
            /^(?:0|[1-9][0-9]*)(?:#|(?:\/(?:[^~/]|~0|~1)*)*)$/;

          module.exports = formats;

          function formats(mode) {
            mode = mode == "full" ? "full" : "fast";
            return util.copy(formats[mode]);
          }

          formats.fast = {
            // date: http://tools.ietf.org/html/rfc3339#section-5.6
            date: /^\d\d\d\d-[0-1]\d-[0-3]\d$/,
            // date-time: http://tools.ietf.org/html/rfc3339#section-5.6
            time:
              /^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d:\d\d)?$/i,
            "date-time":
              /^\d\d\d\d-[0-1]\d-[0-3]\d[t\s](?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d:\d\d)$/i,
            // uri: https://github.com/mafintosh/is-my-json-valid/blob/master/formats.js
            uri: /^(?:[a-z][a-z0-9+-.]*:)(?:\/?\/)?[^\s]*$/i,
            "uri-reference":
              /^(?:(?:[a-z][a-z0-9+-.]*:)?\/?\/)?(?:[^\\\s#][^\s#]*)?(?:#[^\\\s]*)?$/i,
            "uri-template": URITEMPLATE,
            url: URL,
            // email (sources from jsen validator):
            // http://stackoverflow.com/questions/201323/using-a-regular-expression-to-validate-an-email-address#answer-8829363
            // http://www.w3.org/TR/html5/forms.html#valid-e-mail-address (search for 'willful violation')
            email:
              /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i,
            hostname: HOSTNAME,
            // optimized https://www.safaribooksonline.com/library/view/regular-expressions-cookbook/9780596802837/ch07s16.html
            ipv4:
              /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/,
            // optimized http://stackoverflow.com/questions/53497/regular-expression-that-matches-valid-ipv6-addresses
            ipv6:
              /^\s*(?:(?:(?:[0-9a-f]{1,4}:){7}(?:[0-9a-f]{1,4}|:))|(?:(?:[0-9a-f]{1,4}:){6}(?::[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(?:(?:[0-9a-f]{1,4}:){5}(?:(?:(?::[0-9a-f]{1,4}){1,2})|:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(?:(?:[0-9a-f]{1,4}:){4}(?:(?:(?::[0-9a-f]{1,4}){1,3})|(?:(?::[0-9a-f]{1,4})?:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?:(?:[0-9a-f]{1,4}:){3}(?:(?:(?::[0-9a-f]{1,4}){1,4})|(?:(?::[0-9a-f]{1,4}){0,2}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?:(?:[0-9a-f]{1,4}:){2}(?:(?:(?::[0-9a-f]{1,4}){1,5})|(?:(?::[0-9a-f]{1,4}){0,3}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?:(?:[0-9a-f]{1,4}:){1}(?:(?:(?::[0-9a-f]{1,4}){1,6})|(?:(?::[0-9a-f]{1,4}){0,4}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?::(?:(?:(?::[0-9a-f]{1,4}){1,7})|(?:(?::[0-9a-f]{1,4}){0,5}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(?:%.+)?\s*$/i,
            regex: regex,
            // uuid: http://tools.ietf.org/html/rfc4122
            uuid: UUID,
            // JSON-pointer: https://tools.ietf.org/html/rfc6901
            // uri fragment: https://tools.ietf.org/html/rfc3986#appendix-A
            "json-pointer": JSON_POINTER,
            "json-pointer-uri-fragment": JSON_POINTER_URI_FRAGMENT,
            // relative JSON-pointer: http://tools.ietf.org/html/draft-luff-relative-json-pointer-00
            "relative-json-pointer": RELATIVE_JSON_POINTER,
          };

          formats.full = {
            date: date,
            time: time,
            "date-time": date_time,
            uri: uri,
            "uri-reference": URIREF,
            "uri-template": URITEMPLATE,
            url: URL,
            email:
              /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i,
            hostname: hostname,
            ipv4:
              /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/,
            ipv6:
              /^\s*(?:(?:(?:[0-9a-f]{1,4}:){7}(?:[0-9a-f]{1,4}|:))|(?:(?:[0-9a-f]{1,4}:){6}(?::[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(?:(?:[0-9a-f]{1,4}:){5}(?:(?:(?::[0-9a-f]{1,4}){1,2})|:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(?:(?:[0-9a-f]{1,4}:){4}(?:(?:(?::[0-9a-f]{1,4}){1,3})|(?:(?::[0-9a-f]{1,4})?:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?:(?:[0-9a-f]{1,4}:){3}(?:(?:(?::[0-9a-f]{1,4}){1,4})|(?:(?::[0-9a-f]{1,4}){0,2}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?:(?:[0-9a-f]{1,4}:){2}(?:(?:(?::[0-9a-f]{1,4}){1,5})|(?:(?::[0-9a-f]{1,4}){0,3}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?:(?:[0-9a-f]{1,4}:){1}(?:(?:(?::[0-9a-f]{1,4}){1,6})|(?:(?::[0-9a-f]{1,4}){0,4}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?::(?:(?:(?::[0-9a-f]{1,4}){1,7})|(?:(?::[0-9a-f]{1,4}){0,5}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(?:%.+)?\s*$/i,
            regex: regex,
            uuid: UUID,
            "json-pointer": JSON_POINTER,
            "json-pointer-uri-fragment": JSON_POINTER_URI_FRAGMENT,
            "relative-json-pointer": RELATIVE_JSON_POINTER,
          };

          function isLeapYear(year) {
            // https://tools.ietf.org/html/rfc3339#appendix-C
            return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
          }

          function date(str) {
            // full-date from http://tools.ietf.org/html/rfc3339#section-5.6
            var matches = str.match(DATE);
            if (!matches) return false;

            var year = +matches[1];
            var month = +matches[2];
            var day = +matches[3];

            return month >= 1 && month <= 12 && day >= 1 &&
              day <= (month == 2 && isLeapYear(year) ? 29 : DAYS[month]);
          }

          function time(str, full) {
            var matches = str.match(TIME);
            if (!matches) return false;

            var hour = matches[1];
            var minute = matches[2];
            var second = matches[3];
            var timeZone = matches[5];
            return ((hour <= 23 && minute <= 59 && second <= 59) ||
              (hour == 23 && minute == 59 && second == 60)) &&
              (!full || timeZone);
          }

          var DATE_TIME_SEPARATOR = /t|\s/i;
          function date_time(str) {
            // http://tools.ietf.org/html/rfc3339#section-5.6
            var dateTime = str.split(DATE_TIME_SEPARATOR);
            return dateTime.length == 2 && date(dateTime[0]) &&
              time(dateTime[1], true);
          }

          function hostname(str) {
            // https://tools.ietf.org/html/rfc1034#section-3.5
            // https://tools.ietf.org/html/rfc1123#section-2
            return str.length <= 255 && HOSTNAME.test(str);
          }

          var NOT_URI_FRAGMENT = /\/|:/;
          function uri(str) {
            // http://jmrware.com/articles/2009/uri_regexp/URI_regex.html + optional protocol + required "."
            return NOT_URI_FRAGMENT.test(str) && URI.test(str);
          }

          var Z_ANCHOR = /[^\\]\\Z/;
          function regex(str) {
            if (Z_ANCHOR.test(str)) return false;
            try {
              new RegExp(str);
              return true;
            } catch (e) {
              return false;
            }
          }
        }, { "./util": 10 }],
        5: [
          function (require, module, exports) {
            var resolve = require("./resolve"),
              util = require("./util"),
              errorClasses = require("./error_classes"),
              stableStringify = require("fast-json-stable-stringify");

            var validateGenerator = require("../dotjs/validate");

            /**
 * Functions below are used inside compiled validations function
 */

            var ucs2length = util.ucs2length;
            var equal = require("fast-deep-equal");

            // this error is thrown by async schemas to return validation errors via exception
            var ValidationError = errorClasses.Validation;

            module.exports = compile;

            /**
 * Compiles schema to validation function
 * @this   Ajv
 * @param  {Object} schema schema object
 * @param  {Object} root object with information about the root schema for this schema
 * @param  {Object} localRefs the hash of local references inside the schema (created by resolve.id), used for inline resolution
 * @param  {String} baseId base ID for IDs in the schema
 * @return {Function} validation function
 */
            function compile(schema, root, localRefs, baseId) {
              /* jshint validthis: true, evil: true */
              /* eslint no-shadow: 0 */
              var self = this,
                opts = this._opts,
                refVal = [undefined],
                refs = {},
                patterns = [],
                patternsHash = {},
                defaults = [],
                defaultsHash = {},
                customRules = [];

              root = root || { schema: schema, refVal: refVal, refs: refs };

              var c = checkCompiling.call(this, schema, root, baseId);
              var compilation = this._compilations[c.index];
              if (c.compiling) return (compilation.callValidate = callValidate);

              var formats = this._formats;
              var RULES = this.RULES;

              try {
                var v = localCompile(schema, root, localRefs, baseId);
                compilation.validate = v;
                var cv = compilation.callValidate;
                if (cv) {
                  cv.schema = v.schema;
                  cv.errors = null;
                  cv.refs = v.refs;
                  cv.refVal = v.refVal;
                  cv.root = v.root;
                  cv.$async = v.$async;
                  if (opts.sourceCode) cv.source = v.source;
                }
                return v;
              } finally {
                endCompiling.call(this, schema, root, baseId);
              }

              /* @this   {*} - custom context, see passContext option */
              function callValidate() {
                /* jshint validthis: true */
                var validate = compilation.validate;
                var result = validate.apply(this, arguments);
                callValidate.errors = validate.errors;
                return result;
              }

              function localCompile(_schema, _root, localRefs, baseId) {
                var isRoot = !_root || (_root && _root.schema == _schema);
                if (_root.schema != root.schema) {
                  return compile.call(self, _schema, _root, localRefs, baseId);
                }

                var $async = _schema.$async === true;

                var sourceCode = validateGenerator({
                  isTop: true,
                  schema: _schema,
                  isRoot: isRoot,
                  baseId: baseId,
                  root: _root,
                  schemaPath: "",
                  errSchemaPath: "#",
                  errorPath: '""',
                  MissingRefError: errorClasses.MissingRef,
                  RULES: RULES,
                  validate: validateGenerator,
                  util: util,
                  resolve: resolve,
                  resolveRef: resolveRef,
                  usePattern: usePattern,
                  useDefault: useDefault,
                  useCustomRule: useCustomRule,
                  opts: opts,
                  formats: formats,
                  logger: self.logger,
                  self: self,
                });

                sourceCode = vars(refVal, refValCode) +
                  vars(patterns, patternCode) +
                  vars(defaults, defaultCode) +
                  vars(customRules, customRuleCode) +
                  sourceCode;

                if (opts.processCode) sourceCode = opts.processCode(sourceCode);
                // console.log('\n\n\n *** \n', JSON.stringify(sourceCode));
                var validate;
                try {
                  var makeValidate = new Function(
                    "self",
                    "RULES",
                    "formats",
                    "root",
                    "refVal",
                    "defaults",
                    "customRules",
                    "equal",
                    "ucs2length",
                    "ValidationError",
                    sourceCode,
                  );

                  validate = makeValidate(
                    self,
                    RULES,
                    formats,
                    root,
                    refVal,
                    defaults,
                    customRules,
                    equal,
                    ucs2length,
                    ValidationError,
                  );

                  refVal[0] = validate;
                } catch (e) {
                  self.logger.error(
                    "Error compiling schema, function code:",
                    sourceCode,
                  );
                  throw e;
                }

                validate.schema = _schema;
                validate.errors = null;
                validate.refs = refs;
                validate.refVal = refVal;
                validate.root = isRoot ? validate : _root;
                if ($async) validate.$async = true;
                if (opts.sourceCode === true) {
                  validate.source = {
                    code: sourceCode,
                    patterns: patterns,
                    defaults: defaults,
                  };
                }

                return validate;
              }

              function resolveRef(baseId, ref, isRoot) {
                ref = resolve.url(baseId, ref);
                var refIndex = refs[ref];
                var _refVal, refCode;
                if (refIndex !== undefined) {
                  _refVal = refVal[refIndex];
                  refCode = "refVal[" + refIndex + "]";
                  return resolvedRef(_refVal, refCode);
                }
                if (!isRoot && root.refs) {
                  var rootRefId = root.refs[ref];
                  if (rootRefId !== undefined) {
                    _refVal = root.refVal[rootRefId];
                    refCode = addLocalRef(ref, _refVal);
                    return resolvedRef(_refVal, refCode);
                  }
                }

                refCode = addLocalRef(ref);
                var v = resolve.call(self, localCompile, root, ref);
                if (v === undefined) {
                  var localSchema = localRefs && localRefs[ref];
                  if (localSchema) {
                    v = resolve.inlineRef(localSchema, opts.inlineRefs)
                      ? localSchema
                      : compile.call(
                        self,
                        localSchema,
                        root,
                        localRefs,
                        baseId,
                      );
                  }
                }

                if (v === undefined) {
                  removeLocalRef(ref);
                } else {
                  replaceLocalRef(ref, v);
                  return resolvedRef(v, refCode);
                }
              }

              function addLocalRef(ref, v) {
                var refId = refVal.length;
                refVal[refId] = v;
                refs[ref] = refId;
                return "refVal" + refId;
              }

              function removeLocalRef(ref) {
                delete refs[ref];
              }

              function replaceLocalRef(ref, v) {
                var refId = refs[ref];
                refVal[refId] = v;
              }

              function resolvedRef(refVal, code) {
                return typeof refVal == "object" || typeof refVal == "boolean"
                  ? { code: code, schema: refVal, inline: true }
                  : { code: code, $async: refVal && !!refVal.$async };
              }

              function usePattern(regexStr) {
                var index = patternsHash[regexStr];
                if (index === undefined) {
                  index = patternsHash[regexStr] = patterns.length;
                  patterns[index] = regexStr;
                }
                return "pattern" + index;
              }

              function useDefault(value) {
                switch (typeof value) {
                  case "boolean":
                  case "number":
                    return "" + value;
                  case "string":
                    return util.toQuotedString(value);
                  case "object":
                    if (value === null) return "null";
                    var valueStr = stableStringify(value);
                    var index = defaultsHash[valueStr];
                    if (index === undefined) {
                      index = defaultsHash[valueStr] = defaults.length;
                      defaults[index] = value;
                    }
                    return "default" + index;
                }
              }

              function useCustomRule(rule, schema, parentSchema, it) {
                if (self._opts.validateSchema !== false) {
                  var deps = rule.definition.dependencies;
                  if (
                    deps && !deps.every(function (keyword) {
                      return Object.prototype.hasOwnProperty.call(
                        parentSchema,
                        keyword,
                      );
                    })
                  ) {
                    throw new Error(
                      "parent schema must have all required keywords: " +
                        deps.join(","),
                    );
                  }

                  var validateSchema = rule.definition.validateSchema;
                  if (validateSchema) {
                    var valid = validateSchema(schema);
                    if (!valid) {
                      var message = "keyword schema is invalid: " +
                        self.errorsText(validateSchema.errors);
                      if (self._opts.validateSchema == "log") {
                        self.logger.error(message);
                      } else throw new Error(message);
                    }
                  }
                }

                var compile = rule.definition.compile,
                  inline = rule.definition.inline,
                  macro = rule.definition.macro;

                var validate;
                if (compile) {
                  validate = compile.call(self, schema, parentSchema, it);
                } else if (macro) {
                  validate = macro.call(self, schema, parentSchema, it);
                  if (opts.validateSchema !== false) {
                    self.validateSchema(validate, true);
                  }
                } else if (inline) {
                  validate = inline.call(
                    self,
                    it,
                    rule.keyword,
                    schema,
                    parentSchema,
                  );
                } else {
                  validate = rule.definition.validate;
                  if (!validate) return;
                }

                if (validate === undefined) {
                  throw new Error(
                    'custom keyword "' + rule.keyword + '"failed to compile',
                  );
                }

                var index = customRules.length;
                customRules[index] = validate;

                return {
                  code: "customRule" + index,
                  validate: validate,
                };
              }
            }

            /**
 * Checks if the schema is currently compiled
 * @this   Ajv
 * @param  {Object} schema schema to compile
 * @param  {Object} root root object
 * @param  {String} baseId base schema ID
 * @return {Object} object with properties "index" (compilation index) and "compiling" (boolean)
 */
            function checkCompiling(schema, root, baseId) {
              /* jshint validthis: true */
              var index = compIndex.call(this, schema, root, baseId);
              if (index >= 0) return { index: index, compiling: true };
              index = this._compilations.length;
              this._compilations[index] = {
                schema: schema,
                root: root,
                baseId: baseId,
              };
              return { index: index, compiling: false };
            }

            /**
 * Removes the schema from the currently compiled list
 * @this   Ajv
 * @param  {Object} schema schema to compile
 * @param  {Object} root root object
 * @param  {String} baseId base schema ID
 */
            function endCompiling(schema, root, baseId) {
              /* jshint validthis: true */
              var i = compIndex.call(this, schema, root, baseId);
              if (i >= 0) this._compilations.splice(i, 1);
            }

            /**
 * Index of schema compilation in the currently compiled list
 * @this   Ajv
 * @param  {Object} schema schema to compile
 * @param  {Object} root root object
 * @param  {String} baseId base schema ID
 * @return {Integer} compilation index
 */
            function compIndex(schema, root, baseId) {
              /* jshint validthis: true */
              for (var i = 0; i < this._compilations.length; i++) {
                var c = this._compilations[i];
                if (
                  c.schema == schema && c.root == root && c.baseId == baseId
                ) {
                  return i;
                }
              }
              return -1;
            }

            function patternCode(i, patterns) {
              return "var pattern" + i + " = new RegExp(" +
                util.toQuotedString(patterns[i]) + ");";
            }

            function defaultCode(i) {
              return "var default" + i + " = defaults[" + i + "];";
            }

            function refValCode(i, refVal) {
              return refVal[i] === undefined
                ? ""
                : "var refVal" + i + " = refVal[" + i + "];";
            }

            function customRuleCode(i) {
              return "var customRule" + i + " = customRules[" + i + "];";
            }

            function vars(arr, statement) {
              if (!arr.length) return "";
              var code = "";
              for (var i = 0; i < arr.length; i++) {
                code += statement(i, arr);
              }
              return code;
            }
          },
          {
            "../dotjs/validate": 38,
            "./error_classes": 3,
            "./resolve": 6,
            "./util": 10,
            "fast-deep-equal": 42,
            "fast-json-stable-stringify": 43,
          },
        ],
        6: [
          function (require, module, exports) {
            var URI = require("uri-js"),
              equal = require("fast-deep-equal"),
              util = require("./util"),
              SchemaObject = require("./schema_obj"),
              traverse = require("json-schema-traverse");

            module.exports = resolve;

            resolve.normalizeId = normalizeId;
            resolve.fullPath = getFullPath;
            resolve.url = resolveUrl;
            resolve.ids = resolveIds;
            resolve.inlineRef = inlineRef;
            resolve.schema = resolveSchema;

            /**
 * [resolve and compile the references ($ref)]
 * @this   Ajv
 * @param  {Function} compile reference to schema compilation funciton (localCompile)
 * @param  {Object} root object with information about the root schema for the current schema
 * @param  {String} ref reference to resolve
 * @return {Object|Function} schema object (if the schema can be inlined) or validation function
 */
            function resolve(compile, root, ref) {
              /* jshint validthis: true */
              var refVal = this._refs[ref];
              if (typeof refVal == "string") {
                if (this._refs[refVal]) refVal = this._refs[refVal];
                else return resolve.call(this, compile, root, refVal);
              }

              refVal = refVal || this._schemas[ref];
              if (refVal instanceof SchemaObject) {
                return inlineRef(refVal.schema, this._opts.inlineRefs)
                  ? refVal.schema
                  : refVal.validate || this._compile(refVal);
              }

              var res = resolveSchema.call(this, root, ref);
              var schema, v, baseId;
              if (res) {
                schema = res.schema;
                root = res.root;
                baseId = res.baseId;
              }

              if (schema instanceof SchemaObject) {
                v = schema.validate ||
                  compile.call(this, schema.schema, root, undefined, baseId);
              } else if (schema !== undefined) {
                v = inlineRef(schema, this._opts.inlineRefs)
                  ? schema
                  : compile.call(this, schema, root, undefined, baseId);
              }

              return v;
            }

            /**
 * Resolve schema, its root and baseId
 * @this Ajv
 * @param  {Object} root root object with properties schema, refVal, refs
 * @param  {String} ref  reference to resolve
 * @return {Object} object with properties schema, root, baseId
 */
            function resolveSchema(root, ref) {
              /* jshint validthis: true */
              var p = URI.parse(ref),
                refPath = _getFullPath(p),
                baseId = getFullPath(this._getId(root.schema));
              if (Object.keys(root.schema).length === 0 || refPath !== baseId) {
                var id = normalizeId(refPath);
                var refVal = this._refs[id];
                if (typeof refVal == "string") {
                  return resolveRecursive.call(this, root, refVal, p);
                } else if (refVal instanceof SchemaObject) {
                  if (!refVal.validate) this._compile(refVal);
                  root = refVal;
                } else {
                  refVal = this._schemas[id];
                  if (refVal instanceof SchemaObject) {
                    if (!refVal.validate) this._compile(refVal);
                    if (id == normalizeId(ref)) {
                      return { schema: refVal, root: root, baseId: baseId };
                    }
                    root = refVal;
                  } else {
                    return;
                  }
                }
                if (!root.schema) return;
                baseId = getFullPath(this._getId(root.schema));
              }
              return getJsonPointer.call(this, p, baseId, root.schema, root);
            }

            /* @this Ajv */
            function resolveRecursive(root, ref, parsedRef) {
              /* jshint validthis: true */
              var res = resolveSchema.call(this, root, ref);
              if (res) {
                var schema = res.schema;
                var baseId = res.baseId;
                root = res.root;
                var id = this._getId(schema);
                if (id) baseId = resolveUrl(baseId, id);
                return getJsonPointer.call(
                  this,
                  parsedRef,
                  baseId,
                  schema,
                  root,
                );
              }
            }

            var PREVENT_SCOPE_CHANGE = util.toHash(
              [
                "properties",
                "patternProperties",
                "enum",
                "dependencies",
                "definitions",
              ],
            );
            /* @this Ajv */
            function getJsonPointer(parsedRef, baseId, schema, root) {
              /* jshint validthis: true */
              parsedRef.fragment = parsedRef.fragment || "";
              if (parsedRef.fragment.slice(0, 1) != "/") return;
              var parts = parsedRef.fragment.split("/");

              for (var i = 1; i < parts.length; i++) {
                var part = parts[i];
                if (part) {
                  part = util.unescapeFragment(part);
                  schema = schema[part];
                  if (schema === undefined) break;
                  var id;
                  if (!PREVENT_SCOPE_CHANGE[part]) {
                    id = this._getId(schema);
                    if (id) baseId = resolveUrl(baseId, id);
                    if (schema.$ref) {
                      var $ref = resolveUrl(baseId, schema.$ref);
                      var res = resolveSchema.call(this, root, $ref);
                      if (res) {
                        schema = res.schema;
                        root = res.root;
                        baseId = res.baseId;
                      }
                    }
                  }
                }
              }
              if (schema !== undefined && schema !== root.schema) {
                return { schema: schema, root: root, baseId: baseId };
              }
            }

            var SIMPLE_INLINED = util.toHash([
              "type",
              "format",
              "pattern",
              "maxLength",
              "minLength",
              "maxProperties",
              "minProperties",
              "maxItems",
              "minItems",
              "maximum",
              "minimum",
              "uniqueItems",
              "multipleOf",
              "required",
              "enum",
            ]);
            function inlineRef(schema, limit) {
              if (limit === false) return false;
              if (limit === undefined || limit === true) {
                return checkNoRef(schema);
              } else if (limit) return countKeys(schema) <= limit;
            }

            function checkNoRef(schema) {
              var item;
              if (Array.isArray(schema)) {
                for (var i = 0; i < schema.length; i++) {
                  item = schema[i];
                  if (
                    typeof item == "object" && !checkNoRef(item)
                  ) {
                    return false;
                  }
                }
              } else {
                for (var key in schema) {
                  if (key == "$ref") return false;
                  item = schema[key];
                  if (typeof item == "object" && !checkNoRef(item)) {
                    return false;
                  }
                }
              }
              return true;
            }

            function countKeys(schema) {
              var count = 0, item;
              if (Array.isArray(schema)) {
                for (var i = 0; i < schema.length; i++) {
                  item = schema[i];
                  if (typeof item == "object") count += countKeys(item);
                  if (count == Infinity) return Infinity;
                }
              } else {
                for (var key in schema) {
                  if (key == "$ref") return Infinity;
                  if (SIMPLE_INLINED[key]) {
                    count++;
                  } else {
                    item = schema[key];
                    if (typeof item == "object") count += countKeys(item) + 1;
                    if (count == Infinity) return Infinity;
                  }
                }
              }
              return count;
            }

            function getFullPath(id, normalize) {
              if (normalize !== false) id = normalizeId(id);
              var p = URI.parse(id);
              return _getFullPath(p);
            }

            function _getFullPath(p) {
              return URI.serialize(p).split("#")[0] + "#";
            }

            var TRAILING_SLASH_HASH = /#\/?$/;
            function normalizeId(id) {
              return id ? id.replace(TRAILING_SLASH_HASH, "") : "";
            }

            function resolveUrl(baseId, id) {
              id = normalizeId(id);
              return URI.resolve(baseId, id);
            }

            /* @this Ajv */
            function resolveIds(schema) {
              var schemaId = normalizeId(this._getId(schema));
              var baseIds = { "": schemaId };
              var fullPaths = { "": getFullPath(schemaId, false) };
              var localRefs = {};
              var self = this;

              traverse(
                schema,
                { allKeys: true },
                function (
                  sch,
                  jsonPtr,
                  rootSchema,
                  parentJsonPtr,
                  parentKeyword,
                  parentSchema,
                  keyIndex,
                ) {
                  if (jsonPtr === "") return;
                  var id = self._getId(sch);
                  var baseId = baseIds[parentJsonPtr];
                  var fullPath = fullPaths[parentJsonPtr] + "/" + parentKeyword;
                  if (keyIndex !== undefined) {
                    fullPath += "/" +
                      (typeof keyIndex == "number"
                        ? keyIndex
                        : util.escapeFragment(keyIndex));
                  }

                  if (typeof id == "string") {
                    id = baseId = normalizeId(
                      baseId ? URI.resolve(baseId, id) : id,
                    );

                    var refVal = self._refs[id];
                    if (typeof refVal == "string") refVal = self._refs[refVal];
                    if (refVal && refVal.schema) {
                      if (!equal(sch, refVal.schema)) {
                        throw new Error(
                          'id "' + id + '" resolves to more than one schema',
                        );
                      }
                    } else if (id != normalizeId(fullPath)) {
                      if (id[0] == "#") {
                        if (localRefs[id] && !equal(sch, localRefs[id])) {
                          throw new Error(
                            'id "' + id + '" resolves to more than one schema',
                          );
                        }
                        localRefs[id] = sch;
                      } else {
                        self._refs[id] = fullPath;
                      }
                    }
                  }
                  baseIds[jsonPtr] = baseId;
                  fullPaths[jsonPtr] = fullPath;
                },
              );

              return localRefs;
            }
          },
          {
            "./schema_obj": 8,
            "./util": 10,
            "fast-deep-equal": 42,
            "json-schema-traverse": 44,
            "uri-js": 45,
          },
        ],
        7: [function (require, module, exports) {
          var ruleModules = require("../dotjs"),
            toHash = require("./util").toHash;

          module.exports = function rules() {
            var RULES = [
              {
                type: "number",
                rules: [
                  { "maximum": ["exclusiveMaximum"] },
                  { "minimum": ["exclusiveMinimum"] },
                  "multipleOf",
                  "format",
                ],
              },
              {
                type: "string",
                rules: ["maxLength", "minLength", "pattern", "format"],
              },
              {
                type: "array",
                rules: [
                  "maxItems",
                  "minItems",
                  "items",
                  "contains",
                  "uniqueItems",
                ],
              },
              {
                type: "object",
                rules: [
                  "maxProperties",
                  "minProperties",
                  "required",
                  "dependencies",
                  "propertyNames",
                  {
                    "properties": ["additionalProperties", "patternProperties"],
                  },
                ],
              },
              {
                rules: [
                  "$ref",
                  "const",
                  "enum",
                  "not",
                  "anyOf",
                  "oneOf",
                  "allOf",
                  "if",
                ],
              },
            ];

            var ALL = ["type", "$comment"];
            var KEYWORDS = [
              "$schema",
              "$id",
              "id",
              "$data",
              "$async",
              "title",
              "description",
              "default",
              "definitions",
              "examples",
              "readOnly",
              "writeOnly",
              "contentMediaType",
              "contentEncoding",
              "additionalItems",
              "then",
              "else",
            ];
            var TYPES = [
              "number",
              "integer",
              "string",
              "array",
              "object",
              "boolean",
              "null",
            ];
            RULES.all = toHash(ALL);
            RULES.types = toHash(TYPES);

            RULES.forEach(function (group) {
              group.rules = group.rules.map(function (keyword) {
                var implKeywords;
                if (typeof keyword == "object") {
                  var key = Object.keys(keyword)[0];
                  implKeywords = keyword[key];
                  keyword = key;
                  implKeywords.forEach(function (k) {
                    ALL.push(k);
                    RULES.all[k] = true;
                  });
                }
                ALL.push(keyword);
                var rule = RULES.all[keyword] = {
                  keyword: keyword,
                  code: ruleModules[keyword],
                  implements: implKeywords,
                };
                return rule;
              });

              RULES.all.$comment = {
                keyword: "$comment",
                code: ruleModules.$comment,
              };

              if (group.type) RULES.types[group.type] = group;
            });

            RULES.keywords = toHash(ALL.concat(KEYWORDS));
            RULES.custom = {};

            return RULES;
          };
        }, { "../dotjs": 27, "./util": 10 }],
        8: [function (require, module, exports) {
          var util = require("./util");

          module.exports = SchemaObject;

          function SchemaObject(obj) {
            util.copy(obj, this);
          }
        }, { "./util": 10 }],
        9: [function (require, module, exports) {
          // https://mathiasbynens.be/notes/javascript-encoding
          // https://github.com/bestiejs/punycode.js - punycode.ucs2.decode
          module.exports = function ucs2length(str) {
            var length = 0,
              len = str.length,
              pos = 0,
              value;
            while (pos < len) {
              length++;
              value = str.charCodeAt(pos++);
              if (value >= 0xD800 && value <= 0xDBFF && pos < len) {
                // high surrogate, and there is a next character
                value = str.charCodeAt(pos);
                if ((value & 0xFC00) == 0xDC00) pos++; // low surrogate
              }
            }
            return length;
          };
        }, {}],
        10: [function (require, module, exports) {
          module.exports = {
            copy: copy,
            checkDataType: checkDataType,
            checkDataTypes: checkDataTypes,
            coerceToTypes: coerceToTypes,
            toHash: toHash,
            getProperty: getProperty,
            escapeQuotes: escapeQuotes,
            equal: require("fast-deep-equal"),
            ucs2length: require("./ucs2length"),
            varOccurences: varOccurences,
            varReplace: varReplace,
            cleanUpCode: cleanUpCode,
            finalCleanUpCode: finalCleanUpCode,
            schemaHasRules: schemaHasRules,
            schemaHasRulesExcept: schemaHasRulesExcept,
            schemaUnknownRules: schemaUnknownRules,
            toQuotedString: toQuotedString,
            getPathExpr: getPathExpr,
            getPath: getPath,
            getData: getData,
            unescapeFragment: unescapeFragment,
            unescapeJsonPointer: unescapeJsonPointer,
            escapeFragment: escapeFragment,
            escapeJsonPointer: escapeJsonPointer,
          };

          function copy(o, to) {
            to = to || {};
            for (var key in o) to[key] = o[key];
            return to;
          }

          function checkDataType(dataType, data, negate) {
            var EQUAL = negate ? " !== " : " === ",
              AND = negate ? " || " : " && ",
              OK = negate ? "!" : "",
              NOT = negate ? "" : "!";
            switch (dataType) {
              case "null":
                return data + EQUAL + "null";
              case "array":
                return OK + "Array.isArray(" + data + ")";
              case "object":
                return "(" + OK + data + AND +
                  "typeof " + data + EQUAL + '"object"' + AND +
                  NOT + "Array.isArray(" + data + "))";
              case "integer":
                return "(typeof " + data + EQUAL + '"number"' + AND +
                  NOT + "(" + data + " % 1)" +
                  AND + data + EQUAL + data + ")";
              default:
                return "typeof " + data + EQUAL + '"' + dataType + '"';
            }
          }

          function checkDataTypes(dataTypes, data) {
            switch (dataTypes.length) {
              case 1:
                return checkDataType(dataTypes[0], data, true);
              default:
                var code = "";
                var types = toHash(dataTypes);
                if (types.array && types.object) {
                  code = types.null ? "(" : "(!" + data + " || ";
                  code += "typeof " + data + ' !== "object")';
                  delete types.null;
                  delete types.array;
                  delete types.object;
                }
                if (types.number) delete types.integer;
                for (var t in types) {
                  code += (code ? " && " : "") + checkDataType(t, data, true);
                }

                return code;
            }
          }

          var COERCE_TO_TYPES = toHash(
            ["string", "number", "integer", "boolean", "null"],
          );
          function coerceToTypes(optionCoerceTypes, dataTypes) {
            if (Array.isArray(dataTypes)) {
              var types = [];
              for (var i = 0; i < dataTypes.length; i++) {
                var t = dataTypes[i];
                if (COERCE_TO_TYPES[t]) types[types.length] = t;
                else if (optionCoerceTypes === "array" && t === "array") {
                  types[types.length] = t;
                }
              }
              if (types.length) {
                return types;
              }
            } else if (COERCE_TO_TYPES[dataTypes]) {
              return [dataTypes];
            } else if (optionCoerceTypes === "array" && dataTypes === "array") {
              return ["array"];
            }
          }

          function toHash(arr) {
            var hash = {};
            for (var i = 0; i < arr.length; i++) hash[arr[i]] = true;
            return hash;
          }

          var IDENTIFIER = /^[a-z$_][a-z$_0-9]*$/i;
          var SINGLE_QUOTE = /'|\\/g;
          function getProperty(key) {
            return typeof key == "number"
              ? "[" + key + "]"
              : IDENTIFIER.test(key)
              ? "." + key
              : "['" + escapeQuotes(key) + "']";
          }

          function escapeQuotes(str) {
            return str.replace(SINGLE_QUOTE, "\\$&")
              .replace(/\n/g, "\\n")
              .replace(/\r/g, "\\r")
              .replace(/\f/g, "\\f")
              .replace(/\t/g, "\\t");
          }

          function varOccurences(str, dataVar) {
            dataVar += "[^0-9]";
            var matches = str.match(new RegExp(dataVar, "g"));
            return matches ? matches.length : 0;
          }

          function varReplace(str, dataVar, expr) {
            dataVar += "([^0-9])";
            expr = expr.replace(/\$/g, "$$$$");
            return str.replace(new RegExp(dataVar, "g"), expr + "$1");
          }

          var EMPTY_ELSE = /else\s*{\s*}/g,
            EMPTY_IF_NO_ELSE = /if\s*\([^)]+\)\s*\{\s*\}(?!\s*else)/g,
            EMPTY_IF_WITH_ELSE = /if\s*\(([^)]+)\)\s*\{\s*\}\s*else(?!\s*if)/g;
          function cleanUpCode(out) {
            return out.replace(EMPTY_ELSE, "")
              .replace(EMPTY_IF_NO_ELSE, "")
              .replace(EMPTY_IF_WITH_ELSE, "if (!($1))");
          }

          var ERRORS_REGEXP = /[^v.]errors/g,
            REMOVE_ERRORS =
              /var errors = 0;|var vErrors = null;|validate.errors = vErrors;/g,
            REMOVE_ERRORS_ASYNC = /var errors = 0;|var vErrors = null;/g,
            RETURN_VALID = "return errors === 0;",
            RETURN_TRUE = "validate.errors = null; return true;",
            RETURN_ASYNC =
              /if \(errors === 0\) return data;\s*else throw new ValidationError\(vErrors\);/,
            RETURN_DATA_ASYNC = "return data;",
            ROOTDATA_REGEXP = /[^A-Za-z_$]rootData[^A-Za-z0-9_$]/g,
            REMOVE_ROOTDATA = /if \(rootData === undefined\) rootData = data;/;

          function finalCleanUpCode(out, async) {
            var matches = out.match(ERRORS_REGEXP);
            if (matches && matches.length == 2) {
              out = async
                ? out.replace(REMOVE_ERRORS_ASYNC, "")
                  .replace(RETURN_ASYNC, RETURN_DATA_ASYNC)
                : out.replace(REMOVE_ERRORS, "")
                  .replace(RETURN_VALID, RETURN_TRUE);
            }

            matches = out.match(ROOTDATA_REGEXP);
            if (!matches || matches.length !== 3) return out;
            return out.replace(REMOVE_ROOTDATA, "");
          }

          function schemaHasRules(schema, rules) {
            if (typeof schema == "boolean") return !schema;
            for (var key in schema) if (rules[key]) return true;
          }

          function schemaHasRulesExcept(schema, rules, exceptKeyword) {
            if (typeof schema == "boolean") {
              return !schema && exceptKeyword != "not";
            }
            for (var key in schema) {
              if (key != exceptKeyword && rules[key]) return true;
            }
          }

          function schemaUnknownRules(schema, rules) {
            if (typeof schema == "boolean") return;
            for (var key in schema) if (!rules[key]) return key;
          }

          function toQuotedString(str) {
            return "'" + escapeQuotes(str) + "'";
          }

          function getPathExpr(currentPath, expr, jsonPointers, isNumber) {
            var path = jsonPointers // false by default
              ? "'/' + " + expr +
                (isNumber ? "" : ".replace(/~/g, '~0').replace(/\\//g, '~1')")
              : (isNumber
                ? "'[' + " + expr + " + ']'"
                : "'[\\'' + " + expr + " + '\\']'");
            return joinPaths(currentPath, path);
          }

          function getPath(currentPath, prop, jsonPointers) {
            var path = jsonPointers // false by default
              ? toQuotedString("/" + escapeJsonPointer(prop))
              : toQuotedString(getProperty(prop));
            return joinPaths(currentPath, path);
          }

          var JSON_POINTER = /^\/(?:[^~]|~0|~1)*$/;
          var RELATIVE_JSON_POINTER = /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/;
          function getData($data, lvl, paths) {
            var up, jsonPointer, data, matches;
            if ($data === "") return "rootData";
            if ($data[0] == "/") {
              if (!JSON_POINTER.test($data)) {throw new Error(
                  "Invalid JSON-pointer: " + $data,
                );}
              jsonPointer = $data;
              data = "rootData";
            } else {
              matches = $data.match(RELATIVE_JSON_POINTER);
              if (!matches) throw new Error("Invalid JSON-pointer: " + $data);
              up = +matches[1];
              jsonPointer = matches[2];
              if (jsonPointer == "#") {
                if (up >= lvl) {
                  throw new Error(
                    "Cannot access property/index " + up +
                      " levels up, current level is " + lvl,
                  );
                }
                return paths[lvl - up];
              }

              if (up > lvl) {
                throw new Error(
                  "Cannot access data " + up + " levels up, current level is " +
                    lvl,
                );
              }
              data = "data" + ((lvl - up) || "");
              if (!jsonPointer) return data;
            }

            var expr = data;
            var segments = jsonPointer.split("/");
            for (var i = 0; i < segments.length; i++) {
              var segment = segments[i];
              if (segment) {
                data += getProperty(unescapeJsonPointer(segment));
                expr += " && " + data;
              }
            }
            return expr;
          }

          function joinPaths(a, b) {
            if (a == '""') return b;
            return (a + " + " + b).replace(/' \+ '/g, "");
          }

          function unescapeFragment(str) {
            return unescapeJsonPointer(decodeURIComponent(str));
          }

          function escapeFragment(str) {
            return encodeURIComponent(escapeJsonPointer(str));
          }

          function escapeJsonPointer(str) {
            return str.replace(/~/g, "~0").replace(/\//g, "~1");
          }

          function unescapeJsonPointer(str) {
            return str.replace(/~1/g, "/").replace(/~0/g, "~");
          }
        }, { "./ucs2length": 9, "fast-deep-equal": 42 }],
        11: [function (require, module, exports) {
          var KEYWORDS = [
            "multipleOf",
            "maximum",
            "exclusiveMaximum",
            "minimum",
            "exclusiveMinimum",
            "maxLength",
            "minLength",
            "pattern",
            "additionalItems",
            "maxItems",
            "minItems",
            "uniqueItems",
            "maxProperties",
            "minProperties",
            "required",
            "additionalProperties",
            "enum",
            "format",
            "const",
          ];

          module.exports = function (metaSchema, keywordsJsonPointers) {
            for (var i = 0; i < keywordsJsonPointers.length; i++) {
              metaSchema = JSON.parse(JSON.stringify(metaSchema));
              var segments = keywordsJsonPointers[i].split("/");
              var keywords = metaSchema;
              var j;
              for (j = 1; j < segments.length; j++) {
                keywords = keywords[segments[j]];
              }

              for (j = 0; j < KEYWORDS.length; j++) {
                var key = KEYWORDS[j];
                var schema = keywords[key];
                if (schema) {
                  keywords[key] = {
                    anyOf: [
                      schema,
                      {
                        $ref:
                          "https://raw.githubusercontent.com/epoberezkin/ajv/master/lib/refs/data.json#",
                      },
                    ],
                  };
                }
              }
            }

            return metaSchema;
          };
        }, {}],
        12: [function (require, module, exports) {
          var metaSchema = require("./refs/json-schema-draft-07.json");

          module.exports = {
            $id:
              "https://github.com/epoberezkin/ajv/blob/master/lib/definition_schema.js",
            definitions: {
              simpleTypes: metaSchema.definitions.simpleTypes,
            },
            type: "object",
            dependencies: {
              schema: ["validate"],
              $data: ["validate"],
              statements: ["inline"],
              valid: { not: { required: ["macro"] } },
            },
            properties: {
              type: metaSchema.properties.type,
              schema: { type: "boolean" },
              statements: { type: "boolean" },
              dependencies: {
                type: "array",
                items: { type: "string" },
              },
              metaSchema: { type: "object" },
              modifying: { type: "boolean" },
              valid: { type: "boolean" },
              $data: { type: "boolean" },
              async: { type: "boolean" },
              errors: {
                anyOf: [
                  { type: "boolean" },
                  { const: "full" },
                ],
              },
            },
          };
        }, { "./refs/json-schema-draft-07.json": 41 }],
        13: [function (require, module, exports) {
          module.exports = function generate__limit(it, $keyword, $ruleType) {
            var out = " ";
            var $lvl = it.level;
            var $dataLvl = it.dataLevel;
            var $schema = it.schema[$keyword];
            var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
            var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
            var $breakOnError = !it.opts.allErrors;
            var $errorKeyword;
            var $data = "data" + ($dataLvl || "");
            var $isData = it.opts.$data && $schema && $schema.$data,
              $schemaValue;
            if ($isData) {
              out += " var schema" + ($lvl) + " = " +
                (it.util.getData($schema.$data, $dataLvl, it.dataPathArr)) +
                "; ";
              $schemaValue = "schema" + $lvl;
            } else {
              $schemaValue = $schema;
            }
            var $isMax = $keyword == "maximum",
              $exclusiveKeyword = $isMax
                ? "exclusiveMaximum"
                : "exclusiveMinimum",
              $schemaExcl = it.schema[$exclusiveKeyword],
              $isDataExcl = it.opts.$data && $schemaExcl && $schemaExcl.$data,
              $op = $isMax ? "<" : ">",
              $notOp = $isMax ? ">" : "<",
              $errorKeyword = undefined;
            if ($isDataExcl) {
              var $schemaValueExcl = it.util.getData(
                  $schemaExcl.$data,
                  $dataLvl,
                  it.dataPathArr,
                ),
                $exclusive = "exclusive" + $lvl,
                $exclType = "exclType" + $lvl,
                $exclIsNumber = "exclIsNumber" + $lvl,
                $opExpr = "op" + $lvl,
                $opStr = "' + " + $opExpr + " + '";
              out += " var schemaExcl" + ($lvl) + " = " + ($schemaValueExcl) +
                "; ";
              $schemaValueExcl = "schemaExcl" + $lvl;
              out += " var " + ($exclusive) + "; var " + ($exclType) +
                " = typeof " + ($schemaValueExcl) + "; if (" + ($exclType) +
                " != 'boolean' && " + ($exclType) + " != 'undefined' && " +
                ($exclType) + " != 'number') { ";
              var $errorKeyword = $exclusiveKeyword;
              var $$outStack = $$outStack || [];
              $$outStack.push(out);
              out = ""; /* istanbul ignore else */
              if (it.createErrors !== false) {
                out += " { keyword: '" + ($errorKeyword || "_exclusiveLimit") +
                  "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                  " , schemaPath: " + (it.util.toQuotedString($errSchemaPath)) +
                  " , params: {} ";
                if (it.opts.messages !== false) {
                  out += " , message: '" + ($exclusiveKeyword) +
                    " should be boolean' ";
                }
                if (it.opts.verbose) {
                  out += " , schema: validate.schema" + ($schemaPath) +
                    " , parentSchema: validate.schema" + (it.schemaPath) +
                    " , data: " + ($data) + " ";
                }
                out += " } ";
              } else {
                out += " {} ";
              }
              var __err = out;
              out = $$outStack.pop();
              if (!it.compositeRule && $breakOnError) {
                /* istanbul ignore if */
                if (it.async) {
                  out += " throw new ValidationError([" + (__err) + "]); ";
                } else {
                  out += " validate.errors = [" + (__err) + "]; return false; ";
                }
              } else {
                out += " var err = " + (__err) +
                  ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
              }
              out += " } else if ( ";
              if ($isData) {
                out += " (" + ($schemaValue) + " !== undefined && typeof " +
                  ($schemaValue) + " != 'number') || ";
              }
              out += " " + ($exclType) + " == 'number' ? ( (" + ($exclusive) +
                " = " + ($schemaValue) + " === undefined || " +
                ($schemaValueExcl) + " " + ($op) + "= " + ($schemaValue) +
                ") ? " + ($data) + " " + ($notOp) + "= " + ($schemaValueExcl) +
                " : " + ($data) + " " + ($notOp) + " " + ($schemaValue) +
                " ) : ( (" + ($exclusive) + " = " + ($schemaValueExcl) +
                " === true) ? " + ($data) + " " + ($notOp) + "= " +
                ($schemaValue) + " : " + ($data) + " " + ($notOp) + " " +
                ($schemaValue) + " ) || " + ($data) + " !== " + ($data) +
                ") { var op" + ($lvl) + " = " + ($exclusive) + " ? '" + ($op) +
                "' : '" + ($op) + "='; ";
              if ($schema === undefined) {
                $errorKeyword = $exclusiveKeyword;
                $errSchemaPath = it.errSchemaPath + "/" + $exclusiveKeyword;
                $schemaValue = $schemaValueExcl;
                $isData = $isDataExcl;
              }
            } else {
              var $exclIsNumber = typeof $schemaExcl == "number",
                $opStr = $op;
              if ($exclIsNumber && $isData) {
                var $opExpr = "'" + $opStr + "'";
                out += " if ( ";
                if ($isData) {
                  out += " (" + ($schemaValue) + " !== undefined && typeof " +
                    ($schemaValue) + " != 'number') || ";
                }
                out += " ( " + ($schemaValue) + " === undefined || " +
                  ($schemaExcl) + " " + ($op) + "= " + ($schemaValue) + " ? " +
                  ($data) + " " + ($notOp) + "= " + ($schemaExcl) + " : " +
                  ($data) + " " + ($notOp) + " " + ($schemaValue) + " ) || " +
                  ($data) + " !== " + ($data) + ") { ";
              } else {
                if ($exclIsNumber && $schema === undefined) {
                  $exclusive = true;
                  $errorKeyword = $exclusiveKeyword;
                  $errSchemaPath = it.errSchemaPath + "/" + $exclusiveKeyword;
                  $schemaValue = $schemaExcl;
                  $notOp += "=";
                } else {
                  if ($exclIsNumber) {
                    $schemaValue = Math[$isMax ? "min" : "max"](
                      $schemaExcl,
                      $schema,
                    );
                  }
                  if ($schemaExcl === ($exclIsNumber ? $schemaValue : true)) {
                    $exclusive = true;
                    $errorKeyword = $exclusiveKeyword;
                    $errSchemaPath = it.errSchemaPath + "/" + $exclusiveKeyword;
                    $notOp += "=";
                  } else {
                    $exclusive = false;
                    $opStr += "=";
                  }
                }
                var $opExpr = "'" + $opStr + "'";
                out += " if ( ";
                if ($isData) {
                  out += " (" + ($schemaValue) + " !== undefined && typeof " +
                    ($schemaValue) + " != 'number') || ";
                }
                out += " " + ($data) + " " + ($notOp) + " " + ($schemaValue) +
                  " || " + ($data) + " !== " + ($data) + ") { ";
              }
            }
            $errorKeyword = $errorKeyword || $keyword;
            var $$outStack = $$outStack || [];
            $$outStack.push(out);
            out = ""; /* istanbul ignore else */
            if (it.createErrors !== false) {
              out += " { keyword: '" + ($errorKeyword || "_limit") +
                "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                " , schemaPath: " + (it.util.toQuotedString($errSchemaPath)) +
                " , params: { comparison: " + ($opExpr) + ", limit: " +
                ($schemaValue) + ", exclusive: " + ($exclusive) + " } ";
              if (it.opts.messages !== false) {
                out += " , message: 'should be " + ($opStr) + " ";
                if ($isData) {
                  out += "' + " + ($schemaValue);
                } else {
                  out += "" + ($schemaValue) + "'";
                }
              }
              if (it.opts.verbose) {
                out += " , schema:  ";
                if ($isData) {
                  out += "validate.schema" + ($schemaPath);
                } else {
                  out += "" + ($schema);
                }
                out += "         , parentSchema: validate.schema" +
                  (it.schemaPath) + " , data: " + ($data) + " ";
              }
              out += " } ";
            } else {
              out += " {} ";
            }
            var __err = out;
            out = $$outStack.pop();
            if (!it.compositeRule && $breakOnError) {
              /* istanbul ignore if */
              if (it.async) {
                out += " throw new ValidationError([" + (__err) + "]); ";
              } else {
                out += " validate.errors = [" + (__err) + "]; return false; ";
              }
            } else {
              out += " var err = " + (__err) +
                ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
            }
            out += " } ";
            if ($breakOnError) {
              out += " else { ";
            }
            return out;
          };
        }, {}],
        14: [function (require, module, exports) {
          module.exports = function generate__limitItems(
            it,
            $keyword,
            $ruleType,
          ) {
            var out = " ";
            var $lvl = it.level;
            var $dataLvl = it.dataLevel;
            var $schema = it.schema[$keyword];
            var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
            var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
            var $breakOnError = !it.opts.allErrors;
            var $errorKeyword;
            var $data = "data" + ($dataLvl || "");
            var $isData = it.opts.$data && $schema && $schema.$data,
              $schemaValue;
            if ($isData) {
              out += " var schema" + ($lvl) + " = " +
                (it.util.getData($schema.$data, $dataLvl, it.dataPathArr)) +
                "; ";
              $schemaValue = "schema" + $lvl;
            } else {
              $schemaValue = $schema;
            }
            var $op = $keyword == "maxItems" ? ">" : "<";
            out += "if ( ";
            if ($isData) {
              out += " (" + ($schemaValue) + " !== undefined && typeof " +
                ($schemaValue) + " != 'number') || ";
            }
            out += " " + ($data) + ".length " + ($op) + " " + ($schemaValue) +
              ") { ";
            var $errorKeyword = $keyword;
            var $$outStack = $$outStack || [];
            $$outStack.push(out);
            out = ""; /* istanbul ignore else */
            if (it.createErrors !== false) {
              out += " { keyword: '" + ($errorKeyword || "_limitItems") +
                "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                " , schemaPath: " + (it.util.toQuotedString($errSchemaPath)) +
                " , params: { limit: " + ($schemaValue) + " } ";
              if (it.opts.messages !== false) {
                out += " , message: 'should NOT have ";
                if ($keyword == "maxItems") {
                  out += "more";
                } else {
                  out += "fewer";
                }
                out += " than ";
                if ($isData) {
                  out += "' + " + ($schemaValue) + " + '";
                } else {
                  out += "" + ($schema);
                }
                out += " items' ";
              }
              if (it.opts.verbose) {
                out += " , schema:  ";
                if ($isData) {
                  out += "validate.schema" + ($schemaPath);
                } else {
                  out += "" + ($schema);
                }
                out += "         , parentSchema: validate.schema" +
                  (it.schemaPath) + " , data: " + ($data) + " ";
              }
              out += " } ";
            } else {
              out += " {} ";
            }
            var __err = out;
            out = $$outStack.pop();
            if (!it.compositeRule && $breakOnError) {
              /* istanbul ignore if */
              if (it.async) {
                out += " throw new ValidationError([" + (__err) + "]); ";
              } else {
                out += " validate.errors = [" + (__err) + "]; return false; ";
              }
            } else {
              out += " var err = " + (__err) +
                ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
            }
            out += "} ";
            if ($breakOnError) {
              out += " else { ";
            }
            return out;
          };
        }, {}],
        15: [function (require, module, exports) {
          module.exports = function generate__limitLength(
            it,
            $keyword,
            $ruleType,
          ) {
            var out = " ";
            var $lvl = it.level;
            var $dataLvl = it.dataLevel;
            var $schema = it.schema[$keyword];
            var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
            var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
            var $breakOnError = !it.opts.allErrors;
            var $errorKeyword;
            var $data = "data" + ($dataLvl || "");
            var $isData = it.opts.$data && $schema && $schema.$data,
              $schemaValue;
            if ($isData) {
              out += " var schema" + ($lvl) + " = " +
                (it.util.getData($schema.$data, $dataLvl, it.dataPathArr)) +
                "; ";
              $schemaValue = "schema" + $lvl;
            } else {
              $schemaValue = $schema;
            }
            var $op = $keyword == "maxLength" ? ">" : "<";
            out += "if ( ";
            if ($isData) {
              out += " (" + ($schemaValue) + " !== undefined && typeof " +
                ($schemaValue) + " != 'number') || ";
            }
            if (it.opts.unicode === false) {
              out += " " + ($data) + ".length ";
            } else {
              out += " ucs2length(" + ($data) + ") ";
            }
            out += " " + ($op) + " " + ($schemaValue) + ") { ";
            var $errorKeyword = $keyword;
            var $$outStack = $$outStack || [];
            $$outStack.push(out);
            out = ""; /* istanbul ignore else */
            if (it.createErrors !== false) {
              out += " { keyword: '" + ($errorKeyword || "_limitLength") +
                "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                " , schemaPath: " + (it.util.toQuotedString($errSchemaPath)) +
                " , params: { limit: " + ($schemaValue) + " } ";
              if (it.opts.messages !== false) {
                out += " , message: 'should NOT be ";
                if ($keyword == "maxLength") {
                  out += "longer";
                } else {
                  out += "shorter";
                }
                out += " than ";
                if ($isData) {
                  out += "' + " + ($schemaValue) + " + '";
                } else {
                  out += "" + ($schema);
                }
                out += " characters' ";
              }
              if (it.opts.verbose) {
                out += " , schema:  ";
                if ($isData) {
                  out += "validate.schema" + ($schemaPath);
                } else {
                  out += "" + ($schema);
                }
                out += "         , parentSchema: validate.schema" +
                  (it.schemaPath) + " , data: " + ($data) + " ";
              }
              out += " } ";
            } else {
              out += " {} ";
            }
            var __err = out;
            out = $$outStack.pop();
            if (!it.compositeRule && $breakOnError) {
              /* istanbul ignore if */
              if (it.async) {
                out += " throw new ValidationError([" + (__err) + "]); ";
              } else {
                out += " validate.errors = [" + (__err) + "]; return false; ";
              }
            } else {
              out += " var err = " + (__err) +
                ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
            }
            out += "} ";
            if ($breakOnError) {
              out += " else { ";
            }
            return out;
          };
        }, {}],
        16: [function (require, module, exports) {
          module.exports = function generate__limitProperties(
            it,
            $keyword,
            $ruleType,
          ) {
            var out = " ";
            var $lvl = it.level;
            var $dataLvl = it.dataLevel;
            var $schema = it.schema[$keyword];
            var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
            var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
            var $breakOnError = !it.opts.allErrors;
            var $errorKeyword;
            var $data = "data" + ($dataLvl || "");
            var $isData = it.opts.$data && $schema && $schema.$data,
              $schemaValue;
            if ($isData) {
              out += " var schema" + ($lvl) + " = " +
                (it.util.getData($schema.$data, $dataLvl, it.dataPathArr)) +
                "; ";
              $schemaValue = "schema" + $lvl;
            } else {
              $schemaValue = $schema;
            }
            var $op = $keyword == "maxProperties" ? ">" : "<";
            out += "if ( ";
            if ($isData) {
              out += " (" + ($schemaValue) + " !== undefined && typeof " +
                ($schemaValue) + " != 'number') || ";
            }
            out += " Object.keys(" + ($data) + ").length " + ($op) + " " +
              ($schemaValue) + ") { ";
            var $errorKeyword = $keyword;
            var $$outStack = $$outStack || [];
            $$outStack.push(out);
            out = ""; /* istanbul ignore else */
            if (it.createErrors !== false) {
              out += " { keyword: '" + ($errorKeyword || "_limitProperties") +
                "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                " , schemaPath: " + (it.util.toQuotedString($errSchemaPath)) +
                " , params: { limit: " + ($schemaValue) + " } ";
              if (it.opts.messages !== false) {
                out += " , message: 'should NOT have ";
                if ($keyword == "maxProperties") {
                  out += "more";
                } else {
                  out += "fewer";
                }
                out += " than ";
                if ($isData) {
                  out += "' + " + ($schemaValue) + " + '";
                } else {
                  out += "" + ($schema);
                }
                out += " properties' ";
              }
              if (it.opts.verbose) {
                out += " , schema:  ";
                if ($isData) {
                  out += "validate.schema" + ($schemaPath);
                } else {
                  out += "" + ($schema);
                }
                out += "         , parentSchema: validate.schema" +
                  (it.schemaPath) + " , data: " + ($data) + " ";
              }
              out += " } ";
            } else {
              out += " {} ";
            }
            var __err = out;
            out = $$outStack.pop();
            if (!it.compositeRule && $breakOnError) {
              /* istanbul ignore if */
              if (it.async) {
                out += " throw new ValidationError([" + (__err) + "]); ";
              } else {
                out += " validate.errors = [" + (__err) + "]; return false; ";
              }
            } else {
              out += " var err = " + (__err) +
                ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
            }
            out += "} ";
            if ($breakOnError) {
              out += " else { ";
            }
            return out;
          };
        }, {}],
        17: [function (require, module, exports) {
          module.exports = function generate_allOf(it, $keyword, $ruleType) {
            var out = " ";
            var $schema = it.schema[$keyword];
            var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
            var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
            var $breakOnError = !it.opts.allErrors;
            var $it = it.util.copy(it);
            var $closingBraces = "";
            $it.level++;
            var $nextValid = "valid" + $it.level;
            var $currentBaseId = $it.baseId,
              $allSchemasEmpty = true;
            var arr1 = $schema;
            if (arr1) {
              var $sch, $i = -1, l1 = arr1.length - 1;
              while ($i < l1) {
                $sch = arr1[$i += 1];
                if (
                  (it.opts.strictKeywords
                    ? typeof $sch == "object" && Object.keys($sch).length > 0
                    : it.util.schemaHasRules($sch, it.RULES.all))
                ) {
                  $allSchemasEmpty = false;
                  $it.schema = $sch;
                  $it.schemaPath = $schemaPath + "[" + $i + "]";
                  $it.errSchemaPath = $errSchemaPath + "/" + $i;
                  out += "  " + (it.validate($it)) + " ";
                  $it.baseId = $currentBaseId;
                  if ($breakOnError) {
                    out += " if (" + ($nextValid) + ") { ";
                    $closingBraces += "}";
                  }
                }
              }
            }
            if ($breakOnError) {
              if ($allSchemasEmpty) {
                out += " if (true) { ";
              } else {
                out += " " + ($closingBraces.slice(0, -1)) + " ";
              }
            }
            out = it.util.cleanUpCode(out);
            return out;
          };
        }, {}],
        18: [function (require, module, exports) {
          module.exports = function generate_anyOf(it, $keyword, $ruleType) {
            var out = " ";
            var $lvl = it.level;
            var $dataLvl = it.dataLevel;
            var $schema = it.schema[$keyword];
            var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
            var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
            var $breakOnError = !it.opts.allErrors;
            var $data = "data" + ($dataLvl || "");
            var $valid = "valid" + $lvl;
            var $errs = "errs__" + $lvl;
            var $it = it.util.copy(it);
            var $closingBraces = "";
            $it.level++;
            var $nextValid = "valid" + $it.level;
            var $noEmptySchema = $schema.every(function ($sch) {
              return (it.opts.strictKeywords
                ? typeof $sch == "object" && Object.keys($sch).length > 0
                : it.util.schemaHasRules($sch, it.RULES.all));
            });
            if ($noEmptySchema) {
              var $currentBaseId = $it.baseId;
              out += " var " + ($errs) + " = errors; var " + ($valid) +
                " = false;  ";
              var $wasComposite = it.compositeRule;
              it.compositeRule = $it.compositeRule = true;
              var arr1 = $schema;
              if (arr1) {
                var $sch, $i = -1, l1 = arr1.length - 1;
                while ($i < l1) {
                  $sch = arr1[$i += 1];
                  $it.schema = $sch;
                  $it.schemaPath = $schemaPath + "[" + $i + "]";
                  $it.errSchemaPath = $errSchemaPath + "/" + $i;
                  out += "  " + (it.validate($it)) + " ";
                  $it.baseId = $currentBaseId;
                  out += " " + ($valid) + " = " + ($valid) + " || " +
                    ($nextValid) + "; if (!" + ($valid) + ") { ";
                  $closingBraces += "}";
                }
              }
              it.compositeRule = $it.compositeRule = $wasComposite;
              out += " " + ($closingBraces) + " if (!" + ($valid) +
                ") {   var err =   "; /* istanbul ignore else */
              if (it.createErrors !== false) {
                out += " { keyword: '" + ("anyOf") +
                  "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                  " , schemaPath: " + (it.util.toQuotedString($errSchemaPath)) +
                  " , params: {} ";
                if (it.opts.messages !== false) {
                  out += " , message: 'should match some schema in anyOf' ";
                }
                if (it.opts.verbose) {
                  out += " , schema: validate.schema" + ($schemaPath) +
                    " , parentSchema: validate.schema" + (it.schemaPath) +
                    " , data: " + ($data) + " ";
                }
                out += " } ";
              } else {
                out += " {} ";
              }
              out +=
                ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
              if (!it.compositeRule && $breakOnError) {
                /* istanbul ignore if */
                if (it.async) {
                  out += " throw new ValidationError(vErrors); ";
                } else {
                  out += " validate.errors = vErrors; return false; ";
                }
              }
              out += " } else {  errors = " + ($errs) +
                "; if (vErrors !== null) { if (" + ($errs) +
                ") vErrors.length = " + ($errs) + "; else vErrors = null; } ";
              if (it.opts.allErrors) {
                out += " } ";
              }
              out = it.util.cleanUpCode(out);
            } else {
              if ($breakOnError) {
                out += " if (true) { ";
              }
            }
            return out;
          };
        }, {}],
        19: [function (require, module, exports) {
          module.exports = function generate_comment(it, $keyword, $ruleType) {
            var out = " ";
            var $schema = it.schema[$keyword];
            var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
            var $breakOnError = !it.opts.allErrors;
            var $comment = it.util.toQuotedString($schema);
            if (it.opts.$comment === true) {
              out += " console.log(" + ($comment) + ");";
            } else if (typeof it.opts.$comment == "function") {
              out += " self._opts.$comment(" + ($comment) + ", " +
                (it.util.toQuotedString($errSchemaPath)) +
                ", validate.root.schema);";
            }
            return out;
          };
        }, {}],
        20: [function (require, module, exports) {
          module.exports = function generate_const(it, $keyword, $ruleType) {
            var out = " ";
            var $lvl = it.level;
            var $dataLvl = it.dataLevel;
            var $schema = it.schema[$keyword];
            var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
            var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
            var $breakOnError = !it.opts.allErrors;
            var $data = "data" + ($dataLvl || "");
            var $valid = "valid" + $lvl;
            var $isData = it.opts.$data && $schema && $schema.$data;
            if ($isData) {
              out += " var schema" + ($lvl) + " = " +
                (it.util.getData($schema.$data, $dataLvl, it.dataPathArr)) +
                "; ";
            }
            if (!$isData) {
              out += " var schema" + ($lvl) + " = validate.schema" +
                ($schemaPath) + ";";
            }
            out += "var " + ($valid) + " = equal(" + ($data) + ", schema" +
              ($lvl) + "); if (!" + ($valid) + ") {   ";
            var $$outStack = $$outStack || [];
            $$outStack.push(out);
            out = ""; /* istanbul ignore else */
            if (it.createErrors !== false) {
              out += " { keyword: '" + ("const") +
                "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                " , schemaPath: " + (it.util.toQuotedString($errSchemaPath)) +
                " , params: { allowedValue: schema" + ($lvl) + " } ";
              if (it.opts.messages !== false) {
                out += " , message: 'should be equal to constant' ";
              }
              if (it.opts.verbose) {
                out += " , schema: validate.schema" + ($schemaPath) +
                  " , parentSchema: validate.schema" + (it.schemaPath) +
                  " , data: " + ($data) + " ";
              }
              out += " } ";
            } else {
              out += " {} ";
            }
            var __err = out;
            out = $$outStack.pop();
            if (!it.compositeRule && $breakOnError) {
              /* istanbul ignore if */
              if (it.async) {
                out += " throw new ValidationError([" + (__err) + "]); ";
              } else {
                out += " validate.errors = [" + (__err) + "]; return false; ";
              }
            } else {
              out += " var err = " + (__err) +
                ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
            }
            out += " }";
            if ($breakOnError) {
              out += " else { ";
            }
            return out;
          };
        }, {}],
        21: [function (require, module, exports) {
          module.exports = function generate_contains(it, $keyword, $ruleType) {
            var out = " ";
            var $lvl = it.level;
            var $dataLvl = it.dataLevel;
            var $schema = it.schema[$keyword];
            var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
            var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
            var $breakOnError = !it.opts.allErrors;
            var $data = "data" + ($dataLvl || "");
            var $valid = "valid" + $lvl;
            var $errs = "errs__" + $lvl;
            var $it = it.util.copy(it);
            var $closingBraces = "";
            $it.level++;
            var $nextValid = "valid" + $it.level;
            var $idx = "i" + $lvl,
              $dataNxt = $it.dataLevel = it.dataLevel + 1,
              $nextData = "data" + $dataNxt,
              $currentBaseId = it.baseId,
              $nonEmptySchema = (it.opts.strictKeywords
                ? typeof $schema == "object" && Object.keys($schema).length > 0
                : it.util.schemaHasRules($schema, it.RULES.all));
            out += "var " + ($errs) + " = errors;var " + ($valid) + ";";
            if ($nonEmptySchema) {
              var $wasComposite = it.compositeRule;
              it.compositeRule = $it.compositeRule = true;
              $it.schema = $schema;
              $it.schemaPath = $schemaPath;
              $it.errSchemaPath = $errSchemaPath;
              out += " var " + ($nextValid) + " = false; for (var " + ($idx) +
                " = 0; " + ($idx) + " < " + ($data) + ".length; " + ($idx) +
                "++) { ";
              $it.errorPath = it.util.getPathExpr(
                it.errorPath,
                $idx,
                it.opts.jsonPointers,
                true,
              );
              var $passData = $data + "[" + $idx + "]";
              $it.dataPathArr[$dataNxt] = $idx;
              var $code = it.validate($it);
              $it.baseId = $currentBaseId;
              if (it.util.varOccurences($code, $nextData) < 2) {
                out += " " + (it.util.varReplace($code, $nextData, $passData)) +
                  " ";
              } else {
                out += " var " + ($nextData) + " = " + ($passData) + "; " +
                  ($code) + " ";
              }
              out += " if (" + ($nextValid) + ") break; }  ";
              it.compositeRule = $it.compositeRule = $wasComposite;
              out += " " + ($closingBraces) + " if (!" + ($nextValid) + ") {";
            } else {
              out += " if (" + ($data) + ".length == 0) {";
            }
            var $$outStack = $$outStack || [];
            $$outStack.push(out);
            out = ""; /* istanbul ignore else */
            if (it.createErrors !== false) {
              out += " { keyword: '" + ("contains") +
                "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                " , schemaPath: " + (it.util.toQuotedString($errSchemaPath)) +
                " , params: {} ";
              if (it.opts.messages !== false) {
                out += " , message: 'should contain a valid item' ";
              }
              if (it.opts.verbose) {
                out += " , schema: validate.schema" + ($schemaPath) +
                  " , parentSchema: validate.schema" + (it.schemaPath) +
                  " , data: " + ($data) + " ";
              }
              out += " } ";
            } else {
              out += " {} ";
            }
            var __err = out;
            out = $$outStack.pop();
            if (!it.compositeRule && $breakOnError) {
              /* istanbul ignore if */
              if (it.async) {
                out += " throw new ValidationError([" + (__err) + "]); ";
              } else {
                out += " validate.errors = [" + (__err) + "]; return false; ";
              }
            } else {
              out += " var err = " + (__err) +
                ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
            }
            out += " } else { ";
            if ($nonEmptySchema) {
              out += "  errors = " + ($errs) +
                "; if (vErrors !== null) { if (" + ($errs) +
                ") vErrors.length = " + ($errs) + "; else vErrors = null; } ";
            }
            if (it.opts.allErrors) {
              out += " } ";
            }
            out = it.util.cleanUpCode(out);
            return out;
          };
        }, {}],
        22: [function (require, module, exports) {
          module.exports = function generate_custom(it, $keyword, $ruleType) {
            var out = " ";
            var $lvl = it.level;
            var $dataLvl = it.dataLevel;
            var $schema = it.schema[$keyword];
            var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
            var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
            var $breakOnError = !it.opts.allErrors;
            var $errorKeyword;
            var $data = "data" + ($dataLvl || "");
            var $valid = "valid" + $lvl;
            var $errs = "errs__" + $lvl;
            var $isData = it.opts.$data && $schema && $schema.$data,
              $schemaValue;
            if ($isData) {
              out += " var schema" + ($lvl) + " = " +
                (it.util.getData($schema.$data, $dataLvl, it.dataPathArr)) +
                "; ";
              $schemaValue = "schema" + $lvl;
            } else {
              $schemaValue = $schema;
            }
            var $rule = this,
              $definition = "definition" + $lvl,
              $rDef = $rule.definition,
              $closingBraces = "";
            var $compile, $inline, $macro, $ruleValidate, $validateCode;
            if ($isData && $rDef.$data) {
              $validateCode = "keywordValidate" + $lvl;
              var $validateSchema = $rDef.validateSchema;
              out += " var " + ($definition) + " = RULES.custom['" +
                ($keyword) + "'].definition; var " + ($validateCode) + " = " +
                ($definition) + ".validate;";
            } else {
              $ruleValidate = it.useCustomRule($rule, $schema, it.schema, it);
              if (!$ruleValidate) return;
              $schemaValue = "validate.schema" + $schemaPath;
              $validateCode = $ruleValidate.code;
              $compile = $rDef.compile;
              $inline = $rDef.inline;
              $macro = $rDef.macro;
            }
            var $ruleErrs = $validateCode + ".errors",
              $i = "i" + $lvl,
              $ruleErr = "ruleErr" + $lvl,
              $asyncKeyword = $rDef.async;
            if ($asyncKeyword && !it.async) {
              throw new Error("async keyword in sync schema");
            }
            if (!($inline || $macro)) {
              out += "" + ($ruleErrs) + " = null;";
            }
            out += "var " + ($errs) + " = errors;var " + ($valid) + ";";
            if ($isData && $rDef.$data) {
              $closingBraces += "}";
              out += " if (" + ($schemaValue) + " === undefined) { " +
                ($valid) + " = true; } else { ";
              if ($validateSchema) {
                $closingBraces += "}";
                out += " " + ($valid) + " = " + ($definition) +
                  ".validateSchema(" + ($schemaValue) + "); if (" + ($valid) +
                  ") { ";
              }
            }
            if ($inline) {
              if ($rDef.statements) {
                out += " " + ($ruleValidate.validate) + " ";
              } else {
                out += " " + ($valid) + " = " + ($ruleValidate.validate) + "; ";
              }
            } else if ($macro) {
              var $it = it.util.copy(it);
              var $closingBraces = "";
              $it.level++;
              var $nextValid = "valid" + $it.level;
              $it.schema = $ruleValidate.validate;
              $it.schemaPath = "";
              var $wasComposite = it.compositeRule;
              it.compositeRule = $it.compositeRule = true;
              var $code = it.validate($it).replace(
                /validate\.schema/g,
                $validateCode,
              );
              it.compositeRule = $it.compositeRule = $wasComposite;
              out += " " + ($code);
            } else {
              var $$outStack = $$outStack || [];
              $$outStack.push(out);
              out = "";
              out += "  " + ($validateCode) + ".call( ";
              if (it.opts.passContext) {
                out += "this";
              } else {
                out += "self";
              }
              if ($compile || $rDef.schema === false) {
                out += " , " + ($data) + " ";
              } else {
                out += " , " + ($schemaValue) + " , " + ($data) +
                  " , validate.schema" + (it.schemaPath) + " ";
              }
              out += " , (dataPath || '')";
              if (it.errorPath != '""') {
                out += " + " + (it.errorPath);
              }
              var $parentData = $dataLvl
                  ? "data" + (($dataLvl - 1) || "")
                  : "parentData",
                $parentDataProperty = $dataLvl ? it.dataPathArr[$dataLvl]
                : "parentDataProperty";
              out += " , " + ($parentData) + " , " + ($parentDataProperty) +
                " , rootData )  ";
              var def_callRuleValidate = out;
              out = $$outStack.pop();
              if ($rDef.errors === false) {
                out += " " + ($valid) + " = ";
                if ($asyncKeyword) {
                  out += "await ";
                }
                out += "" + (def_callRuleValidate) + "; ";
              } else {
                if ($asyncKeyword) {
                  $ruleErrs = "customErrors" + $lvl;
                  out += " var " + ($ruleErrs) + " = null; try { " + ($valid) +
                    " = await " + (def_callRuleValidate) + "; } catch (e) { " +
                    ($valid) + " = false; if (e instanceof ValidationError) " +
                    ($ruleErrs) + " = e.errors; else throw e; } ";
                } else {
                  out += " " + ($ruleErrs) + " = null; " + ($valid) + " = " +
                    (def_callRuleValidate) + "; ";
                }
              }
            }
            if ($rDef.modifying) {
              out += " if (" + ($parentData) + ") " + ($data) + " = " +
                ($parentData) + "[" + ($parentDataProperty) + "];";
            }
            out += "" + ($closingBraces);
            if ($rDef.valid) {
              if ($breakOnError) {
                out += " if (true) { ";
              }
            } else {
              out += " if ( ";
              if ($rDef.valid === undefined) {
                out += " !";
                if ($macro) {
                  out += "" + ($nextValid);
                } else {
                  out += "" + ($valid);
                }
              } else {
                out += " " + (!$rDef.valid) + " ";
              }
              out += ") { ";
              $errorKeyword = $rule.keyword;
              var $$outStack = $$outStack || [];
              $$outStack.push(out);
              out = "";
              var $$outStack = $$outStack || [];
              $$outStack.push(out);
              out = ""; /* istanbul ignore else */
              if (it.createErrors !== false) {
                out += " { keyword: '" + ($errorKeyword || "custom") +
                  "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                  " , schemaPath: " + (it.util.toQuotedString($errSchemaPath)) +
                  " , params: { keyword: '" + ($rule.keyword) + "' } ";
                if (it.opts.messages !== false) {
                  out += " , message: 'should pass \"" + ($rule.keyword) +
                    "\" keyword validation' ";
                }
                if (it.opts.verbose) {
                  out += " , schema: validate.schema" + ($schemaPath) +
                    " , parentSchema: validate.schema" + (it.schemaPath) +
                    " , data: " + ($data) + " ";
                }
                out += " } ";
              } else {
                out += " {} ";
              }
              var __err = out;
              out = $$outStack.pop();
              if (!it.compositeRule && $breakOnError) {
                /* istanbul ignore if */
                if (it.async) {
                  out += " throw new ValidationError([" + (__err) + "]); ";
                } else {
                  out += " validate.errors = [" + (__err) + "]; return false; ";
                }
              } else {
                out += " var err = " + (__err) +
                  ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
              }
              var def_customError = out;
              out = $$outStack.pop();
              if ($inline) {
                if ($rDef.errors) {
                  if ($rDef.errors != "full") {
                    out += "  for (var " + ($i) + "=" + ($errs) + "; " + ($i) +
                      "<errors; " + ($i) + "++) { var " + ($ruleErr) +
                      " = vErrors[" + ($i) + "]; if (" + ($ruleErr) +
                      ".dataPath === undefined) " + ($ruleErr) +
                      ".dataPath = (dataPath || '') + " + (it.errorPath) +
                      "; if (" + ($ruleErr) + ".schemaPath === undefined) { " +
                      ($ruleErr) + '.schemaPath = "' + ($errSchemaPath) +
                      '"; } ';
                    if (it.opts.verbose) {
                      out += " " + ($ruleErr) + ".schema = " + ($schemaValue) +
                        "; " + ($ruleErr) + ".data = " + ($data) + "; ";
                    }
                    out += " } ";
                  }
                } else {
                  if ($rDef.errors === false) {
                    out += " " + (def_customError) + " ";
                  } else {
                    out += " if (" + ($errs) + " == errors) { " +
                      (def_customError) + " } else {  for (var " + ($i) + "=" +
                      ($errs) + "; " + ($i) + "<errors; " + ($i) +
                      "++) { var " + ($ruleErr) + " = vErrors[" + ($i) +
                      "]; if (" + ($ruleErr) + ".dataPath === undefined) " +
                      ($ruleErr) + ".dataPath = (dataPath || '') + " +
                      (it.errorPath) + "; if (" + ($ruleErr) +
                      ".schemaPath === undefined) { " + ($ruleErr) +
                      '.schemaPath = "' + ($errSchemaPath) + '"; } ';
                    if (it.opts.verbose) {
                      out += " " + ($ruleErr) + ".schema = " + ($schemaValue) +
                        "; " + ($ruleErr) + ".data = " + ($data) + "; ";
                    }
                    out += " } } ";
                  }
                }
              } else if ($macro) {
                out += "   var err =   "; /* istanbul ignore else */
                if (it.createErrors !== false) {
                  out += " { keyword: '" + ($errorKeyword || "custom") +
                    "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                    " , schemaPath: " +
                    (it.util.toQuotedString($errSchemaPath)) +
                    " , params: { keyword: '" + ($rule.keyword) + "' } ";
                  if (it.opts.messages !== false) {
                    out += " , message: 'should pass \"" + ($rule.keyword) +
                      "\" keyword validation' ";
                  }
                  if (it.opts.verbose) {
                    out += " , schema: validate.schema" + ($schemaPath) +
                      " , parentSchema: validate.schema" + (it.schemaPath) +
                      " , data: " + ($data) + " ";
                  }
                  out += " } ";
                } else {
                  out += " {} ";
                }
                out +=
                  ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
                if (!it.compositeRule && $breakOnError) {
                  /* istanbul ignore if */
                  if (it.async) {
                    out += " throw new ValidationError(vErrors); ";
                  } else {
                    out += " validate.errors = vErrors; return false; ";
                  }
                }
              } else {
                if ($rDef.errors === false) {
                  out += " " + (def_customError) + " ";
                } else {
                  out += " if (Array.isArray(" + ($ruleErrs) +
                    ")) { if (vErrors === null) vErrors = " + ($ruleErrs) +
                    "; else vErrors = vErrors.concat(" + ($ruleErrs) +
                    "); errors = vErrors.length;  for (var " + ($i) + "=" +
                    ($errs) + "; " + ($i) + "<errors; " + ($i) + "++) { var " +
                    ($ruleErr) + " = vErrors[" + ($i) + "]; if (" + ($ruleErr) +
                    ".dataPath === undefined) " + ($ruleErr) +
                    ".dataPath = (dataPath || '') + " + (it.errorPath) + ";  " +
                    ($ruleErr) + '.schemaPath = "' + ($errSchemaPath) + '";  ';
                  if (it.opts.verbose) {
                    out += " " + ($ruleErr) + ".schema = " + ($schemaValue) +
                      "; " + ($ruleErr) + ".data = " + ($data) + "; ";
                  }
                  out += " } } else { " + (def_customError) + " } ";
                }
              }
              out += " } ";
              if ($breakOnError) {
                out += " else { ";
              }
            }
            return out;
          };
        }, {}],
        23: [function (require, module, exports) {
          module.exports = function generate_dependencies(
            it,
            $keyword,
            $ruleType,
          ) {
            var out = " ";
            var $lvl = it.level;
            var $dataLvl = it.dataLevel;
            var $schema = it.schema[$keyword];
            var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
            var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
            var $breakOnError = !it.opts.allErrors;
            var $data = "data" + ($dataLvl || "");
            var $errs = "errs__" + $lvl;
            var $it = it.util.copy(it);
            var $closingBraces = "";
            $it.level++;
            var $nextValid = "valid" + $it.level;
            var $schemaDeps = {},
              $propertyDeps = {},
              $ownProperties = it.opts.ownProperties;
            for ($property in $schema) {
              var $sch = $schema[$property];
              var $deps = Array.isArray($sch) ? $propertyDeps : $schemaDeps;
              $deps[$property] = $sch;
            }
            out += "var " + ($errs) + " = errors;";
            var $currentErrorPath = it.errorPath;
            out += "var missing" + ($lvl) + ";";
            for (var $property in $propertyDeps) {
              $deps = $propertyDeps[$property];
              if ($deps.length) {
                out += " if ( " + ($data) + (it.util.getProperty($property)) +
                  " !== undefined ";
                if ($ownProperties) {
                  out += " && Object.prototype.hasOwnProperty.call(" + ($data) +
                    ", '" + (it.util.escapeQuotes($property)) + "') ";
                }
                if ($breakOnError) {
                  out += " && ( ";
                  var arr1 = $deps;
                  if (arr1) {
                    var $propertyKey, $i = -1, l1 = arr1.length - 1;
                    while ($i < l1) {
                      $propertyKey = arr1[$i += 1];
                      if ($i) {
                        out += " || ";
                      }
                      var $prop = it.util.getProperty($propertyKey),
                        $useData = $data + $prop;
                      out += " ( ( " + ($useData) + " === undefined ";
                      if ($ownProperties) {
                        out += " || ! Object.prototype.hasOwnProperty.call(" +
                          ($data) + ", '" +
                          (it.util.escapeQuotes($propertyKey)) + "') ";
                      }
                      out += ") && (missing" + ($lvl) + " = " +
                        (it.util.toQuotedString(
                          it.opts.jsonPointers ? $propertyKey : $prop,
                        )) + ") ) ";
                    }
                  }
                  out += ")) {  ";
                  var $propertyPath = "missing" + $lvl,
                    $missingProperty = "' + " + $propertyPath + " + '";
                  if (it.opts._errorDataPathProperty) {
                    it.errorPath = it.opts.jsonPointers
                      ? it.util.getPathExpr(
                        $currentErrorPath,
                        $propertyPath,
                        true,
                      )
                      : $currentErrorPath + " + " + $propertyPath;
                  }
                  var $$outStack = $$outStack || [];
                  $$outStack.push(out);
                  out = ""; /* istanbul ignore else */
                  if (it.createErrors !== false) {
                    out += " { keyword: '" + ("dependencies") +
                      "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                      " , schemaPath: " +
                      (it.util.toQuotedString($errSchemaPath)) +
                      " , params: { property: '" +
                      (it.util.escapeQuotes($property)) +
                      "', missingProperty: '" + ($missingProperty) +
                      "', depsCount: " + ($deps.length) + ", deps: '" +
                      (it.util.escapeQuotes(
                        $deps.length == 1 ? $deps[0] : $deps.join(", "),
                      )) + "' } ";
                    if (it.opts.messages !== false) {
                      out += " , message: 'should have ";
                      if ($deps.length == 1) {
                        out += "property " + (it.util.escapeQuotes($deps[0]));
                      } else {
                        out += "properties " +
                          (it.util.escapeQuotes($deps.join(", ")));
                      }
                      out += " when property " +
                        (it.util.escapeQuotes($property)) + " is present' ";
                    }
                    if (it.opts.verbose) {
                      out += " , schema: validate.schema" + ($schemaPath) +
                        " , parentSchema: validate.schema" + (it.schemaPath) +
                        " , data: " + ($data) + " ";
                    }
                    out += " } ";
                  } else {
                    out += " {} ";
                  }
                  var __err = out;
                  out = $$outStack.pop();
                  if (!it.compositeRule && $breakOnError) {
                    /* istanbul ignore if */
                    if (it.async) {
                      out += " throw new ValidationError([" + (__err) + "]); ";
                    } else {
                      out += " validate.errors = [" + (__err) +
                        "]; return false; ";
                    }
                  } else {
                    out += " var err = " + (__err) +
                      ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
                  }
                } else {
                  out += " ) { ";
                  var arr2 = $deps;
                  if (arr2) {
                    var $propertyKey, i2 = -1, l2 = arr2.length - 1;
                    while (i2 < l2) {
                      $propertyKey = arr2[i2 += 1];
                      var $prop = it.util.getProperty($propertyKey),
                        $missingProperty = it.util.escapeQuotes($propertyKey),
                        $useData = $data + $prop;
                      if (it.opts._errorDataPathProperty) {
                        it.errorPath = it.util.getPath(
                          $currentErrorPath,
                          $propertyKey,
                          it.opts.jsonPointers,
                        );
                      }
                      out += " if ( " + ($useData) + " === undefined ";
                      if ($ownProperties) {
                        out += " || ! Object.prototype.hasOwnProperty.call(" +
                          ($data) + ", '" +
                          (it.util.escapeQuotes($propertyKey)) + "') ";
                      }
                      out += ") {  var err =   "; /* istanbul ignore else */
                      if (it.createErrors !== false) {
                        out += " { keyword: '" + ("dependencies") +
                          "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                          " , schemaPath: " +
                          (it.util.toQuotedString($errSchemaPath)) +
                          " , params: { property: '" +
                          (it.util.escapeQuotes($property)) +
                          "', missingProperty: '" + ($missingProperty) +
                          "', depsCount: " + ($deps.length) + ", deps: '" +
                          (it.util.escapeQuotes(
                            $deps.length == 1 ? $deps[0] : $deps.join(", "),
                          )) + "' } ";
                        if (it.opts.messages !== false) {
                          out += " , message: 'should have ";
                          if ($deps.length == 1) {
                            out += "property " +
                              (it.util.escapeQuotes($deps[0]));
                          } else {
                            out += "properties " +
                              (it.util.escapeQuotes($deps.join(", ")));
                          }
                          out += " when property " +
                            (it.util.escapeQuotes($property)) + " is present' ";
                        }
                        if (it.opts.verbose) {
                          out += " , schema: validate.schema" + ($schemaPath) +
                            " , parentSchema: validate.schema" +
                            (it.schemaPath) + " , data: " + ($data) + " ";
                        }
                        out += " } ";
                      } else {
                        out += " {} ";
                      }
                      out +=
                        ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; } ";
                    }
                  }
                }
                out += " }   ";
                if ($breakOnError) {
                  $closingBraces += "}";
                  out += " else { ";
                }
              }
            }
            it.errorPath = $currentErrorPath;
            var $currentBaseId = $it.baseId;
            for (var $property in $schemaDeps) {
              var $sch = $schemaDeps[$property];
              if (
                (it.opts.strictKeywords
                  ? typeof $sch == "object" && Object.keys($sch).length > 0
                  : it.util.schemaHasRules($sch, it.RULES.all))
              ) {
                out += " " + ($nextValid) + " = true; if ( " + ($data) +
                  (it.util.getProperty($property)) + " !== undefined ";
                if ($ownProperties) {
                  out += " && Object.prototype.hasOwnProperty.call(" + ($data) +
                    ", '" + (it.util.escapeQuotes($property)) + "') ";
                }
                out += ") { ";
                $it.schema = $sch;
                $it.schemaPath = $schemaPath + it.util.getProperty($property);
                $it.errSchemaPath = $errSchemaPath + "/" +
                  it.util.escapeFragment($property);
                out += "  " + (it.validate($it)) + " ";
                $it.baseId = $currentBaseId;
                out += " }  ";
                if ($breakOnError) {
                  out += " if (" + ($nextValid) + ") { ";
                  $closingBraces += "}";
                }
              }
            }
            if ($breakOnError) {
              out += "   " + ($closingBraces) + " if (" + ($errs) +
                " == errors) {";
            }
            out = it.util.cleanUpCode(out);
            return out;
          };
        }, {}],
        24: [function (require, module, exports) {
          module.exports = function generate_enum(it, $keyword, $ruleType) {
            var out = " ";
            var $lvl = it.level;
            var $dataLvl = it.dataLevel;
            var $schema = it.schema[$keyword];
            var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
            var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
            var $breakOnError = !it.opts.allErrors;
            var $data = "data" + ($dataLvl || "");
            var $valid = "valid" + $lvl;
            var $isData = it.opts.$data && $schema && $schema.$data;
            if ($isData) {
              out += " var schema" + ($lvl) + " = " +
                (it.util.getData($schema.$data, $dataLvl, it.dataPathArr)) +
                "; ";
            }
            var $i = "i" + $lvl,
              $vSchema = "schema" + $lvl;
            if (!$isData) {
              out += " var " + ($vSchema) + " = validate.schema" +
                ($schemaPath) + ";";
            }
            out += "var " + ($valid) + ";";
            if ($isData) {
              out += " if (schema" + ($lvl) + " === undefined) " + ($valid) +
                " = true; else if (!Array.isArray(schema" + ($lvl) + ")) " +
                ($valid) + " = false; else {";
            }
            out += "" + ($valid) + " = false;for (var " + ($i) + "=0; " + ($i) +
              "<" + ($vSchema) + ".length; " + ($i) + "++) if (equal(" +
              ($data) + ", " + ($vSchema) + "[" + ($i) + "])) { " + ($valid) +
              " = true; break; }";
            if ($isData) {
              out += "  }  ";
            }
            out += " if (!" + ($valid) + ") {   ";
            var $$outStack = $$outStack || [];
            $$outStack.push(out);
            out = ""; /* istanbul ignore else */
            if (it.createErrors !== false) {
              out += " { keyword: '" + ("enum") +
                "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                " , schemaPath: " + (it.util.toQuotedString($errSchemaPath)) +
                " , params: { allowedValues: schema" + ($lvl) + " } ";
              if (it.opts.messages !== false) {
                out +=
                  " , message: 'should be equal to one of the allowed values' ";
              }
              if (it.opts.verbose) {
                out += " , schema: validate.schema" + ($schemaPath) +
                  " , parentSchema: validate.schema" + (it.schemaPath) +
                  " , data: " + ($data) + " ";
              }
              out += " } ";
            } else {
              out += " {} ";
            }
            var __err = out;
            out = $$outStack.pop();
            if (!it.compositeRule && $breakOnError) {
              /* istanbul ignore if */
              if (it.async) {
                out += " throw new ValidationError([" + (__err) + "]); ";
              } else {
                out += " validate.errors = [" + (__err) + "]; return false; ";
              }
            } else {
              out += " var err = " + (__err) +
                ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
            }
            out += " }";
            if ($breakOnError) {
              out += " else { ";
            }
            return out;
          };
        }, {}],
        25: [function (require, module, exports) {
          module.exports = function generate_format(it, $keyword, $ruleType) {
            var out = " ";
            var $lvl = it.level;
            var $dataLvl = it.dataLevel;
            var $schema = it.schema[$keyword];
            var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
            var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
            var $breakOnError = !it.opts.allErrors;
            var $data = "data" + ($dataLvl || "");
            if (it.opts.format === false) {
              if ($breakOnError) {
                out += " if (true) { ";
              }
              return out;
            }
            var $isData = it.opts.$data && $schema && $schema.$data,
              $schemaValue;
            if ($isData) {
              out += " var schema" + ($lvl) + " = " +
                (it.util.getData($schema.$data, $dataLvl, it.dataPathArr)) +
                "; ";
              $schemaValue = "schema" + $lvl;
            } else {
              $schemaValue = $schema;
            }
            var $unknownFormats = it.opts.unknownFormats,
              $allowUnknown = Array.isArray($unknownFormats);
            if ($isData) {
              var $format = "format" + $lvl,
                $isObject = "isObject" + $lvl,
                $formatType = "formatType" + $lvl;
              out += " var " + ($format) + " = formats[" + ($schemaValue) +
                "]; var " + ($isObject) + " = typeof " + ($format) +
                " == 'object' && !(" + ($format) + " instanceof RegExp) && " +
                ($format) + ".validate; var " + ($formatType) + " = " +
                ($isObject) + " && " + ($format) + ".type || 'string'; if (" +
                ($isObject) + ") { ";
              if (it.async) {
                out += " var async" + ($lvl) + " = " + ($format) + ".async; ";
              }
              out += " " + ($format) + " = " + ($format) +
                ".validate; } if (  ";
              if ($isData) {
                out += " (" + ($schemaValue) + " !== undefined && typeof " +
                  ($schemaValue) + " != 'string') || ";
              }
              out += " (";
              if ($unknownFormats != "ignore") {
                out += " (" + ($schemaValue) + " && !" + ($format) + " ";
                if ($allowUnknown) {
                  out += " && self._opts.unknownFormats.indexOf(" +
                    ($schemaValue) + ") == -1 ";
                }
                out += ") || ";
              }
              out += " (" + ($format) + " && " + ($formatType) + " == '" +
                ($ruleType) + "' && !(typeof " + ($format) +
                " == 'function' ? ";
              if (it.async) {
                out += " (async" + ($lvl) + " ? await " + ($format) + "(" +
                  ($data) + ") : " + ($format) + "(" + ($data) + ")) ";
              } else {
                out += " " + ($format) + "(" + ($data) + ") ";
              }
              out += " : " + ($format) + ".test(" + ($data) + "))))) {";
            } else {
              var $format = it.formats[$schema];
              if (!$format) {
                if ($unknownFormats == "ignore") {
                  it.logger.warn(
                    'unknown format "' + $schema +
                      '" ignored in schema at path "' + it.errSchemaPath + '"',
                  );
                  if ($breakOnError) {
                    out += " if (true) { ";
                  }
                  return out;
                } else if (
                  $allowUnknown && $unknownFormats.indexOf($schema) >= 0
                ) {
                  if ($breakOnError) {
                    out += " if (true) { ";
                  }
                  return out;
                } else {
                  throw new Error(
                    'unknown format "' + $schema +
                      '" is used in schema at path "' + it.errSchemaPath + '"',
                  );
                }
              }
              var $isObject = typeof $format == "object" &&
                !($format instanceof RegExp) && $format.validate;
              var $formatType = $isObject && $format.type || "string";
              if ($isObject) {
                var $async = $format.async === true;
                $format = $format.validate;
              }
              if ($formatType != $ruleType) {
                if ($breakOnError) {
                  out += " if (true) { ";
                }
                return out;
              }
              if ($async) {
                if (!it.async) throw new Error("async format in sync schema");
                var $formatRef = "formats" + it.util.getProperty($schema) +
                  ".validate";
                out += " if (!(await " + ($formatRef) + "(" + ($data) +
                  "))) { ";
              } else {
                out += " if (! ";
                var $formatRef = "formats" + it.util.getProperty($schema);
                if ($isObject) $formatRef += ".validate";
                if (typeof $format == "function") {
                  out += " " + ($formatRef) + "(" + ($data) + ") ";
                } else {
                  out += " " + ($formatRef) + ".test(" + ($data) + ") ";
                }
                out += ") { ";
              }
            }
            var $$outStack = $$outStack || [];
            $$outStack.push(out);
            out = ""; /* istanbul ignore else */
            if (it.createErrors !== false) {
              out += " { keyword: '" + ("format") +
                "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                " , schemaPath: " + (it.util.toQuotedString($errSchemaPath)) +
                " , params: { format:  ";
              if ($isData) {
                out += "" + ($schemaValue);
              } else {
                out += "" + (it.util.toQuotedString($schema));
              }
              out += "  } ";
              if (it.opts.messages !== false) {
                out += " , message: 'should match format \"";
                if ($isData) {
                  out += "' + " + ($schemaValue) + " + '";
                } else {
                  out += "" + (it.util.escapeQuotes($schema));
                }
                out += "\"' ";
              }
              if (it.opts.verbose) {
                out += " , schema:  ";
                if ($isData) {
                  out += "validate.schema" + ($schemaPath);
                } else {
                  out += "" + (it.util.toQuotedString($schema));
                }
                out += "         , parentSchema: validate.schema" +
                  (it.schemaPath) + " , data: " + ($data) + " ";
              }
              out += " } ";
            } else {
              out += " {} ";
            }
            var __err = out;
            out = $$outStack.pop();
            if (!it.compositeRule && $breakOnError) {
              /* istanbul ignore if */
              if (it.async) {
                out += " throw new ValidationError([" + (__err) + "]); ";
              } else {
                out += " validate.errors = [" + (__err) + "]; return false; ";
              }
            } else {
              out += " var err = " + (__err) +
                ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
            }
            out += " } ";
            if ($breakOnError) {
              out += " else { ";
            }
            return out;
          };
        }, {}],
        26: [function (require, module, exports) {
          module.exports = function generate_if(it, $keyword, $ruleType) {
            var out = " ";
            var $lvl = it.level;
            var $dataLvl = it.dataLevel;
            var $schema = it.schema[$keyword];
            var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
            var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
            var $breakOnError = !it.opts.allErrors;
            var $data = "data" + ($dataLvl || "");
            var $valid = "valid" + $lvl;
            var $errs = "errs__" + $lvl;
            var $it = it.util.copy(it);
            $it.level++;
            var $nextValid = "valid" + $it.level;
            var $thenSch = it.schema["then"],
              $elseSch = it.schema["else"],
              $thenPresent = $thenSch !== undefined && (it.opts.strictKeywords
                ? typeof $thenSch == "object" &&
                  Object.keys($thenSch).length > 0
                : it.util.schemaHasRules($thenSch, it.RULES.all)),
              $elsePresent = $elseSch !== undefined && (it.opts.strictKeywords
                ? typeof $elseSch == "object" &&
                  Object.keys($elseSch).length > 0
                : it.util.schemaHasRules($elseSch, it.RULES.all)),
              $currentBaseId = $it.baseId;
            if ($thenPresent || $elsePresent) {
              var $ifClause;
              $it.createErrors = false;
              $it.schema = $schema;
              $it.schemaPath = $schemaPath;
              $it.errSchemaPath = $errSchemaPath;
              out += " var " + ($errs) + " = errors; var " + ($valid) +
                " = true;  ";
              var $wasComposite = it.compositeRule;
              it.compositeRule = $it.compositeRule = true;
              out += "  " + (it.validate($it)) + " ";
              $it.baseId = $currentBaseId;
              $it.createErrors = true;
              out += "  errors = " + ($errs) +
                "; if (vErrors !== null) { if (" + ($errs) +
                ") vErrors.length = " + ($errs) + "; else vErrors = null; }  ";
              it.compositeRule = $it.compositeRule = $wasComposite;
              if ($thenPresent) {
                out += " if (" + ($nextValid) + ") {  ";
                $it.schema = it.schema["then"];
                $it.schemaPath = it.schemaPath + ".then";
                $it.errSchemaPath = it.errSchemaPath + "/then";
                out += "  " + (it.validate($it)) + " ";
                $it.baseId = $currentBaseId;
                out += " " + ($valid) + " = " + ($nextValid) + "; ";
                if ($thenPresent && $elsePresent) {
                  $ifClause = "ifClause" + $lvl;
                  out += " var " + ($ifClause) + " = 'then'; ";
                } else {
                  $ifClause = "'then'";
                }
                out += " } ";
                if ($elsePresent) {
                  out += " else { ";
                }
              } else {
                out += " if (!" + ($nextValid) + ") { ";
              }
              if ($elsePresent) {
                $it.schema = it.schema["else"];
                $it.schemaPath = it.schemaPath + ".else";
                $it.errSchemaPath = it.errSchemaPath + "/else";
                out += "  " + (it.validate($it)) + " ";
                $it.baseId = $currentBaseId;
                out += " " + ($valid) + " = " + ($nextValid) + "; ";
                if ($thenPresent && $elsePresent) {
                  $ifClause = "ifClause" + $lvl;
                  out += " var " + ($ifClause) + " = 'else'; ";
                } else {
                  $ifClause = "'else'";
                }
                out += " } ";
              }
              out += " if (!" + ($valid) +
                ") {   var err =   "; /* istanbul ignore else */
              if (it.createErrors !== false) {
                out += " { keyword: '" + ("if") +
                  "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                  " , schemaPath: " + (it.util.toQuotedString($errSchemaPath)) +
                  " , params: { failingKeyword: " + ($ifClause) + " } ";
                if (it.opts.messages !== false) {
                  out += " , message: 'should match \"' + " + ($ifClause) +
                    " + '\" schema' ";
                }
                if (it.opts.verbose) {
                  out += " , schema: validate.schema" + ($schemaPath) +
                    " , parentSchema: validate.schema" + (it.schemaPath) +
                    " , data: " + ($data) + " ";
                }
                out += " } ";
              } else {
                out += " {} ";
              }
              out +=
                ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
              if (!it.compositeRule && $breakOnError) {
                /* istanbul ignore if */
                if (it.async) {
                  out += " throw new ValidationError(vErrors); ";
                } else {
                  out += " validate.errors = vErrors; return false; ";
                }
              }
              out += " }   ";
              if ($breakOnError) {
                out += " else { ";
              }
              out = it.util.cleanUpCode(out);
            } else {
              if ($breakOnError) {
                out += " if (true) { ";
              }
            }
            return out;
          };
        }, {}],
        27: [
          function (require, module, exports) {
            //all requires must be explicit because browserify won't work with dynamic requires
            module.exports = {
              "$ref": require("./ref"),
              allOf: require("./allOf"),
              anyOf: require("./anyOf"),
              "$comment": require("./comment"),
              const: require("./const"),
              contains: require("./contains"),
              dependencies: require("./dependencies"),
              "enum": require("./enum"),
              format: require("./format"),
              "if": require("./if"),
              items: require("./items"),
              maximum: require("./_limit"),
              minimum: require("./_limit"),
              maxItems: require("./_limitItems"),
              minItems: require("./_limitItems"),
              maxLength: require("./_limitLength"),
              minLength: require("./_limitLength"),
              maxProperties: require("./_limitProperties"),
              minProperties: require("./_limitProperties"),
              multipleOf: require("./multipleOf"),
              not: require("./not"),
              oneOf: require("./oneOf"),
              pattern: require("./pattern"),
              properties: require("./properties"),
              propertyNames: require("./propertyNames"),
              required: require("./required"),
              uniqueItems: require("./uniqueItems"),
              validate: require("./validate"),
            };
          },
          {
            "./_limit": 13,
            "./_limitItems": 14,
            "./_limitLength": 15,
            "./_limitProperties": 16,
            "./allOf": 17,
            "./anyOf": 18,
            "./comment": 19,
            "./const": 20,
            "./contains": 21,
            "./dependencies": 23,
            "./enum": 24,
            "./format": 25,
            "./if": 26,
            "./items": 28,
            "./multipleOf": 29,
            "./not": 30,
            "./oneOf": 31,
            "./pattern": 32,
            "./properties": 33,
            "./propertyNames": 34,
            "./ref": 35,
            "./required": 36,
            "./uniqueItems": 37,
            "./validate": 38,
          },
        ],
        28: [function (require, module, exports) {
          module.exports = function generate_items(it, $keyword, $ruleType) {
            var out = " ";
            var $lvl = it.level;
            var $dataLvl = it.dataLevel;
            var $schema = it.schema[$keyword];
            var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
            var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
            var $breakOnError = !it.opts.allErrors;
            var $data = "data" + ($dataLvl || "");
            var $valid = "valid" + $lvl;
            var $errs = "errs__" + $lvl;
            var $it = it.util.copy(it);
            var $closingBraces = "";
            $it.level++;
            var $nextValid = "valid" + $it.level;
            var $idx = "i" + $lvl,
              $dataNxt = $it.dataLevel = it.dataLevel + 1,
              $nextData = "data" + $dataNxt,
              $currentBaseId = it.baseId;
            out += "var " + ($errs) + " = errors;var " + ($valid) + ";";
            if (Array.isArray($schema)) {
              var $additionalItems = it.schema.additionalItems;
              if ($additionalItems === false) {
                out += " " + ($valid) + " = " + ($data) + ".length <= " +
                  ($schema.length) + "; ";
                var $currErrSchemaPath = $errSchemaPath;
                $errSchemaPath = it.errSchemaPath + "/additionalItems";
                out += "  if (!" + ($valid) + ") {   ";
                var $$outStack = $$outStack || [];
                $$outStack.push(out);
                out = ""; /* istanbul ignore else */
                if (it.createErrors !== false) {
                  out += " { keyword: '" + ("additionalItems") +
                    "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                    " , schemaPath: " +
                    (it.util.toQuotedString($errSchemaPath)) +
                    " , params: { limit: " + ($schema.length) + " } ";
                  if (it.opts.messages !== false) {
                    out += " , message: 'should NOT have more than " +
                      ($schema.length) + " items' ";
                  }
                  if (it.opts.verbose) {
                    out += " , schema: false , parentSchema: validate.schema" +
                      (it.schemaPath) + " , data: " + ($data) + " ";
                  }
                  out += " } ";
                } else {
                  out += " {} ";
                }
                var __err = out;
                out = $$outStack.pop();
                if (!it.compositeRule && $breakOnError) {
                  /* istanbul ignore if */
                  if (it.async) {
                    out += " throw new ValidationError([" + (__err) + "]); ";
                  } else {
                    out += " validate.errors = [" + (__err) +
                      "]; return false; ";
                  }
                } else {
                  out += " var err = " + (__err) +
                    ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
                }
                out += " } ";
                $errSchemaPath = $currErrSchemaPath;
                if ($breakOnError) {
                  $closingBraces += "}";
                  out += " else { ";
                }
              }
              var arr1 = $schema;
              if (arr1) {
                var $sch, $i = -1, l1 = arr1.length - 1;
                while ($i < l1) {
                  $sch = arr1[$i += 1];
                  if (
                    (it.opts.strictKeywords
                      ? typeof $sch == "object" && Object.keys($sch).length > 0
                      : it.util.schemaHasRules($sch, it.RULES.all))
                  ) {
                    out += " " + ($nextValid) + " = true; if (" + ($data) +
                      ".length > " + ($i) + ") { ";
                    var $passData = $data + "[" + $i + "]";
                    $it.schema = $sch;
                    $it.schemaPath = $schemaPath + "[" + $i + "]";
                    $it.errSchemaPath = $errSchemaPath + "/" + $i;
                    $it.errorPath = it.util.getPathExpr(
                      it.errorPath,
                      $i,
                      it.opts.jsonPointers,
                      true,
                    );
                    $it.dataPathArr[$dataNxt] = $i;
                    var $code = it.validate($it);
                    $it.baseId = $currentBaseId;
                    if (it.util.varOccurences($code, $nextData) < 2) {
                      out += " " +
                        (it.util.varReplace($code, $nextData, $passData)) + " ";
                    } else {
                      out += " var " + ($nextData) + " = " + ($passData) +
                        "; " + ($code) + " ";
                    }
                    out += " }  ";
                    if ($breakOnError) {
                      out += " if (" + ($nextValid) + ") { ";
                      $closingBraces += "}";
                    }
                  }
                }
              }
              if (
                typeof $additionalItems == "object" && (it.opts.strictKeywords
                  ? typeof $additionalItems == "object" &&
                    Object.keys($additionalItems).length > 0
                  : it.util.schemaHasRules($additionalItems, it.RULES.all))
              ) {
                $it.schema = $additionalItems;
                $it.schemaPath = it.schemaPath + ".additionalItems";
                $it.errSchemaPath = it.errSchemaPath + "/additionalItems";
                out += " " + ($nextValid) + " = true; if (" + ($data) +
                  ".length > " + ($schema.length) + ") {  for (var " + ($idx) +
                  " = " + ($schema.length) + "; " + ($idx) + " < " + ($data) +
                  ".length; " + ($idx) + "++) { ";
                $it.errorPath = it.util.getPathExpr(
                  it.errorPath,
                  $idx,
                  it.opts.jsonPointers,
                  true,
                );
                var $passData = $data + "[" + $idx + "]";
                $it.dataPathArr[$dataNxt] = $idx;
                var $code = it.validate($it);
                $it.baseId = $currentBaseId;
                if (it.util.varOccurences($code, $nextData) < 2) {
                  out += " " +
                    (it.util.varReplace($code, $nextData, $passData)) + " ";
                } else {
                  out += " var " + ($nextData) + " = " + ($passData) + "; " +
                    ($code) + " ";
                }
                if ($breakOnError) {
                  out += " if (!" + ($nextValid) + ") break; ";
                }
                out += " } }  ";
                if ($breakOnError) {
                  out += " if (" + ($nextValid) + ") { ";
                  $closingBraces += "}";
                }
              }
            } else if (
              (it.opts.strictKeywords
                ? typeof $schema == "object" && Object.keys($schema).length > 0
                : it.util.schemaHasRules($schema, it.RULES.all))
            ) {
              $it.schema = $schema;
              $it.schemaPath = $schemaPath;
              $it.errSchemaPath = $errSchemaPath;
              out += "  for (var " + ($idx) + " = " + (0) + "; " + ($idx) +
                " < " + ($data) + ".length; " + ($idx) + "++) { ";
              $it.errorPath = it.util.getPathExpr(
                it.errorPath,
                $idx,
                it.opts.jsonPointers,
                true,
              );
              var $passData = $data + "[" + $idx + "]";
              $it.dataPathArr[$dataNxt] = $idx;
              var $code = it.validate($it);
              $it.baseId = $currentBaseId;
              if (it.util.varOccurences($code, $nextData) < 2) {
                out += " " + (it.util.varReplace($code, $nextData, $passData)) +
                  " ";
              } else {
                out += " var " + ($nextData) + " = " + ($passData) + "; " +
                  ($code) + " ";
              }
              if ($breakOnError) {
                out += " if (!" + ($nextValid) + ") break; ";
              }
              out += " }";
            }
            if ($breakOnError) {
              out += " " + ($closingBraces) + " if (" + ($errs) +
                " == errors) {";
            }
            out = it.util.cleanUpCode(out);
            return out;
          };
        }, {}],
        29: [function (require, module, exports) {
          module.exports = function generate_multipleOf(
            it,
            $keyword,
            $ruleType,
          ) {
            var out = " ";
            var $lvl = it.level;
            var $dataLvl = it.dataLevel;
            var $schema = it.schema[$keyword];
            var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
            var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
            var $breakOnError = !it.opts.allErrors;
            var $data = "data" + ($dataLvl || "");
            var $isData = it.opts.$data && $schema && $schema.$data,
              $schemaValue;
            if ($isData) {
              out += " var schema" + ($lvl) + " = " +
                (it.util.getData($schema.$data, $dataLvl, it.dataPathArr)) +
                "; ";
              $schemaValue = "schema" + $lvl;
            } else {
              $schemaValue = $schema;
            }
            out += "var division" + ($lvl) + ";if (";
            if ($isData) {
              out += " " + ($schemaValue) + " !== undefined && ( typeof " +
                ($schemaValue) + " != 'number' || ";
            }
            out += " (division" + ($lvl) + " = " + ($data) + " / " +
              ($schemaValue) + ", ";
            if (it.opts.multipleOfPrecision) {
              out += " Math.abs(Math.round(division" + ($lvl) + ") - division" +
                ($lvl) + ") > 1e-" + (it.opts.multipleOfPrecision) + " ";
            } else {
              out += " division" + ($lvl) + " !== parseInt(division" + ($lvl) +
                ") ";
            }
            out += " ) ";
            if ($isData) {
              out += "  )  ";
            }
            out += " ) {   ";
            var $$outStack = $$outStack || [];
            $$outStack.push(out);
            out = ""; /* istanbul ignore else */
            if (it.createErrors !== false) {
              out += " { keyword: '" + ("multipleOf") +
                "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                " , schemaPath: " + (it.util.toQuotedString($errSchemaPath)) +
                " , params: { multipleOf: " + ($schemaValue) + " } ";
              if (it.opts.messages !== false) {
                out += " , message: 'should be multiple of ";
                if ($isData) {
                  out += "' + " + ($schemaValue);
                } else {
                  out += "" + ($schemaValue) + "'";
                }
              }
              if (it.opts.verbose) {
                out += " , schema:  ";
                if ($isData) {
                  out += "validate.schema" + ($schemaPath);
                } else {
                  out += "" + ($schema);
                }
                out += "         , parentSchema: validate.schema" +
                  (it.schemaPath) + " , data: " + ($data) + " ";
              }
              out += " } ";
            } else {
              out += " {} ";
            }
            var __err = out;
            out = $$outStack.pop();
            if (!it.compositeRule && $breakOnError) {
              /* istanbul ignore if */
              if (it.async) {
                out += " throw new ValidationError([" + (__err) + "]); ";
              } else {
                out += " validate.errors = [" + (__err) + "]; return false; ";
              }
            } else {
              out += " var err = " + (__err) +
                ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
            }
            out += "} ";
            if ($breakOnError) {
              out += " else { ";
            }
            return out;
          };
        }, {}],
        30: [function (require, module, exports) {
          module.exports = function generate_not(it, $keyword, $ruleType) {
            var out = " ";
            var $lvl = it.level;
            var $dataLvl = it.dataLevel;
            var $schema = it.schema[$keyword];
            var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
            var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
            var $breakOnError = !it.opts.allErrors;
            var $data = "data" + ($dataLvl || "");
            var $errs = "errs__" + $lvl;
            var $it = it.util.copy(it);
            $it.level++;
            var $nextValid = "valid" + $it.level;
            if (
              (it.opts.strictKeywords
                ? typeof $schema == "object" && Object.keys($schema).length > 0
                : it.util.schemaHasRules($schema, it.RULES.all))
            ) {
              $it.schema = $schema;
              $it.schemaPath = $schemaPath;
              $it.errSchemaPath = $errSchemaPath;
              out += " var " + ($errs) + " = errors;  ";
              var $wasComposite = it.compositeRule;
              it.compositeRule = $it.compositeRule = true;
              $it.createErrors = false;
              var $allErrorsOption;
              if ($it.opts.allErrors) {
                $allErrorsOption = $it.opts.allErrors;
                $it.opts.allErrors = false;
              }
              out += " " + (it.validate($it)) + " ";
              $it.createErrors = true;
              if ($allErrorsOption) $it.opts.allErrors = $allErrorsOption;
              it.compositeRule = $it.compositeRule = $wasComposite;
              out += " if (" + ($nextValid) + ") {   ";
              var $$outStack = $$outStack || [];
              $$outStack.push(out);
              out = ""; /* istanbul ignore else */
              if (it.createErrors !== false) {
                out += " { keyword: '" + ("not") +
                  "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                  " , schemaPath: " + (it.util.toQuotedString($errSchemaPath)) +
                  " , params: {} ";
                if (it.opts.messages !== false) {
                  out += " , message: 'should NOT be valid' ";
                }
                if (it.opts.verbose) {
                  out += " , schema: validate.schema" + ($schemaPath) +
                    " , parentSchema: validate.schema" + (it.schemaPath) +
                    " , data: " + ($data) + " ";
                }
                out += " } ";
              } else {
                out += " {} ";
              }
              var __err = out;
              out = $$outStack.pop();
              if (!it.compositeRule && $breakOnError) {
                /* istanbul ignore if */
                if (it.async) {
                  out += " throw new ValidationError([" + (__err) + "]); ";
                } else {
                  out += " validate.errors = [" + (__err) + "]; return false; ";
                }
              } else {
                out += " var err = " + (__err) +
                  ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
              }
              out += " } else {  errors = " + ($errs) +
                "; if (vErrors !== null) { if (" + ($errs) +
                ") vErrors.length = " + ($errs) + "; else vErrors = null; } ";
              if (it.opts.allErrors) {
                out += " } ";
              }
            } else {
              out += "  var err =   "; /* istanbul ignore else */
              if (it.createErrors !== false) {
                out += " { keyword: '" + ("not") +
                  "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                  " , schemaPath: " + (it.util.toQuotedString($errSchemaPath)) +
                  " , params: {} ";
                if (it.opts.messages !== false) {
                  out += " , message: 'should NOT be valid' ";
                }
                if (it.opts.verbose) {
                  out += " , schema: validate.schema" + ($schemaPath) +
                    " , parentSchema: validate.schema" + (it.schemaPath) +
                    " , data: " + ($data) + " ";
                }
                out += " } ";
              } else {
                out += " {} ";
              }
              out +=
                ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
              if ($breakOnError) {
                out += " if (false) { ";
              }
            }
            return out;
          };
        }, {}],
        31: [function (require, module, exports) {
          module.exports = function generate_oneOf(it, $keyword, $ruleType) {
            var out = " ";
            var $lvl = it.level;
            var $dataLvl = it.dataLevel;
            var $schema = it.schema[$keyword];
            var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
            var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
            var $breakOnError = !it.opts.allErrors;
            var $data = "data" + ($dataLvl || "");
            var $valid = "valid" + $lvl;
            var $errs = "errs__" + $lvl;
            var $it = it.util.copy(it);
            var $closingBraces = "";
            $it.level++;
            var $nextValid = "valid" + $it.level;
            var $currentBaseId = $it.baseId,
              $prevValid = "prevValid" + $lvl,
              $passingSchemas = "passingSchemas" + $lvl;
            out += "var " + ($errs) + " = errors , " + ($prevValid) +
              " = false , " + ($valid) + " = false , " + ($passingSchemas) +
              " = null; ";
            var $wasComposite = it.compositeRule;
            it.compositeRule = $it.compositeRule = true;
            var arr1 = $schema;
            if (arr1) {
              var $sch, $i = -1, l1 = arr1.length - 1;
              while ($i < l1) {
                $sch = arr1[$i += 1];
                if (
                  (it.opts.strictKeywords
                    ? typeof $sch == "object" && Object.keys($sch).length > 0
                    : it.util.schemaHasRules($sch, it.RULES.all))
                ) {
                  $it.schema = $sch;
                  $it.schemaPath = $schemaPath + "[" + $i + "]";
                  $it.errSchemaPath = $errSchemaPath + "/" + $i;
                  out += "  " + (it.validate($it)) + " ";
                  $it.baseId = $currentBaseId;
                } else {
                  out += " var " + ($nextValid) + " = true; ";
                }
                if ($i) {
                  out += " if (" + ($nextValid) + " && " + ($prevValid) +
                    ") { " + ($valid) + " = false; " + ($passingSchemas) +
                    " = [" + ($passingSchemas) + ", " + ($i) + "]; } else { ";
                  $closingBraces += "}";
                }
                out += " if (" + ($nextValid) + ") { " + ($valid) + " = " +
                  ($prevValid) + " = true; " + ($passingSchemas) + " = " +
                  ($i) + "; }";
              }
            }
            it.compositeRule = $it.compositeRule = $wasComposite;
            out += "" + ($closingBraces) + "if (!" + ($valid) +
              ") {   var err =   "; /* istanbul ignore else */
            if (it.createErrors !== false) {
              out += " { keyword: '" + ("oneOf") +
                "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                " , schemaPath: " + (it.util.toQuotedString($errSchemaPath)) +
                " , params: { passingSchemas: " + ($passingSchemas) + " } ";
              if (it.opts.messages !== false) {
                out +=
                  " , message: 'should match exactly one schema in oneOf' ";
              }
              if (it.opts.verbose) {
                out += " , schema: validate.schema" + ($schemaPath) +
                  " , parentSchema: validate.schema" + (it.schemaPath) +
                  " , data: " + ($data) + " ";
              }
              out += " } ";
            } else {
              out += " {} ";
            }
            out +=
              ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
            if (!it.compositeRule && $breakOnError) {
              /* istanbul ignore if */
              if (it.async) {
                out += " throw new ValidationError(vErrors); ";
              } else {
                out += " validate.errors = vErrors; return false; ";
              }
            }
            out += "} else {  errors = " + ($errs) +
              "; if (vErrors !== null) { if (" + ($errs) +
              ") vErrors.length = " + ($errs) + "; else vErrors = null; }";
            if (it.opts.allErrors) {
              out += " } ";
            }
            return out;
          };
        }, {}],
        32: [function (require, module, exports) {
          module.exports = function generate_pattern(it, $keyword, $ruleType) {
            var out = " ";
            var $lvl = it.level;
            var $dataLvl = it.dataLevel;
            var $schema = it.schema[$keyword];
            var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
            var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
            var $breakOnError = !it.opts.allErrors;
            var $data = "data" + ($dataLvl || "");
            var $isData = it.opts.$data && $schema && $schema.$data,
              $schemaValue;
            if ($isData) {
              out += " var schema" + ($lvl) + " = " +
                (it.util.getData($schema.$data, $dataLvl, it.dataPathArr)) +
                "; ";
              $schemaValue = "schema" + $lvl;
            } else {
              $schemaValue = $schema;
            }
            var $regexp = $isData
              ? "(new RegExp(" + $schemaValue + "))"
              : it.usePattern($schema);
            out += "if ( ";
            if ($isData) {
              out += " (" + ($schemaValue) + " !== undefined && typeof " +
                ($schemaValue) + " != 'string') || ";
            }
            out += " !" + ($regexp) + ".test(" + ($data) + ") ) {   ";
            var $$outStack = $$outStack || [];
            $$outStack.push(out);
            out = ""; /* istanbul ignore else */
            if (it.createErrors !== false) {
              out += " { keyword: '" + ("pattern") +
                "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                " , schemaPath: " + (it.util.toQuotedString($errSchemaPath)) +
                " , params: { pattern:  ";
              if ($isData) {
                out += "" + ($schemaValue);
              } else {
                out += "" + (it.util.toQuotedString($schema));
              }
              out += "  } ";
              if (it.opts.messages !== false) {
                out += " , message: 'should match pattern \"";
                if ($isData) {
                  out += "' + " + ($schemaValue) + " + '";
                } else {
                  out += "" + (it.util.escapeQuotes($schema));
                }
                out += "\"' ";
              }
              if (it.opts.verbose) {
                out += " , schema:  ";
                if ($isData) {
                  out += "validate.schema" + ($schemaPath);
                } else {
                  out += "" + (it.util.toQuotedString($schema));
                }
                out += "         , parentSchema: validate.schema" +
                  (it.schemaPath) + " , data: " + ($data) + " ";
              }
              out += " } ";
            } else {
              out += " {} ";
            }
            var __err = out;
            out = $$outStack.pop();
            if (!it.compositeRule && $breakOnError) {
              /* istanbul ignore if */
              if (it.async) {
                out += " throw new ValidationError([" + (__err) + "]); ";
              } else {
                out += " validate.errors = [" + (__err) + "]; return false; ";
              }
            } else {
              out += " var err = " + (__err) +
                ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
            }
            out += "} ";
            if ($breakOnError) {
              out += " else { ";
            }
            return out;
          };
        }, {}],
        33: [function (require, module, exports) {
          module.exports = function generate_properties(
            it,
            $keyword,
            $ruleType,
          ) {
            var out = " ";
            var $lvl = it.level;
            var $dataLvl = it.dataLevel;
            var $schema = it.schema[$keyword];
            var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
            var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
            var $breakOnError = !it.opts.allErrors;
            var $data = "data" + ($dataLvl || "");
            var $errs = "errs__" + $lvl;
            var $it = it.util.copy(it);
            var $closingBraces = "";
            $it.level++;
            var $nextValid = "valid" + $it.level;
            var $key = "key" + $lvl,
              $idx = "idx" + $lvl,
              $dataNxt = $it.dataLevel = it.dataLevel + 1,
              $nextData = "data" + $dataNxt,
              $dataProperties = "dataProperties" + $lvl;
            var $schemaKeys = Object.keys($schema || {}),
              $pProperties = it.schema.patternProperties || {},
              $pPropertyKeys = Object.keys($pProperties),
              $aProperties = it.schema.additionalProperties,
              $someProperties = $schemaKeys.length || $pPropertyKeys.length,
              $noAdditional = $aProperties === false,
              $additionalIsSchema = typeof $aProperties == "object" &&
                Object.keys($aProperties).length,
              $removeAdditional = it.opts.removeAdditional,
              $checkAdditional = $noAdditional || $additionalIsSchema ||
                $removeAdditional,
              $ownProperties = it.opts.ownProperties,
              $currentBaseId = it.baseId;
            var $required = it.schema.required;
            if (
              $required && !(it.opts.$data && $required.$data) &&
              $required.length < it.opts.loopRequired
            ) {
              var $requiredHash = it.util.toHash($required);
            }
            out += "var " + ($errs) + " = errors;var " + ($nextValid) +
              " = true;";
            if ($ownProperties) {
              out += " var " + ($dataProperties) + " = undefined;";
            }
            if ($checkAdditional) {
              if ($ownProperties) {
                out += " " + ($dataProperties) + " = " + ($dataProperties) +
                  " || Object.keys(" + ($data) + "); for (var " + ($idx) +
                  "=0; " + ($idx) + "<" + ($dataProperties) + ".length; " +
                  ($idx) + "++) { var " + ($key) + " = " + ($dataProperties) +
                  "[" + ($idx) + "]; ";
              } else {
                out += " for (var " + ($key) + " in " + ($data) + ") { ";
              }
              if ($someProperties) {
                out += " var isAdditional" + ($lvl) + " = !(false ";
                if ($schemaKeys.length) {
                  if ($schemaKeys.length > 8) {
                    out += " || validate.schema" + ($schemaPath) +
                      ".hasOwnProperty(" + ($key) + ") ";
                  } else {
                    var arr1 = $schemaKeys;
                    if (arr1) {
                      var $propertyKey, i1 = -1, l1 = arr1.length - 1;
                      while (i1 < l1) {
                        $propertyKey = arr1[i1 += 1];
                        out += " || " + ($key) + " == " +
                          (it.util.toQuotedString($propertyKey)) + " ";
                      }
                    }
                  }
                }
                if ($pPropertyKeys.length) {
                  var arr2 = $pPropertyKeys;
                  if (arr2) {
                    var $pProperty, $i = -1, l2 = arr2.length - 1;
                    while ($i < l2) {
                      $pProperty = arr2[$i += 1];
                      out += " || " + (it.usePattern($pProperty)) + ".test(" +
                        ($key) + ") ";
                    }
                  }
                }
                out += " ); if (isAdditional" + ($lvl) + ") { ";
              }
              if ($removeAdditional == "all") {
                out += " delete " + ($data) + "[" + ($key) + "]; ";
              } else {
                var $currentErrorPath = it.errorPath;
                var $additionalProperty = "' + " + $key + " + '";
                if (it.opts._errorDataPathProperty) {
                  it.errorPath = it.util.getPathExpr(
                    it.errorPath,
                    $key,
                    it.opts.jsonPointers,
                  );
                }
                if ($noAdditional) {
                  if ($removeAdditional) {
                    out += " delete " + ($data) + "[" + ($key) + "]; ";
                  } else {
                    out += " " + ($nextValid) + " = false; ";
                    var $currErrSchemaPath = $errSchemaPath;
                    $errSchemaPath = it.errSchemaPath + "/additionalProperties";
                    var $$outStack = $$outStack || [];
                    $$outStack.push(out);
                    out = ""; /* istanbul ignore else */
                    if (it.createErrors !== false) {
                      out += " { keyword: '" + ("additionalProperties") +
                        "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                        " , schemaPath: " +
                        (it.util.toQuotedString($errSchemaPath)) +
                        " , params: { additionalProperty: '" +
                        ($additionalProperty) + "' } ";
                      if (it.opts.messages !== false) {
                        out += " , message: '";
                        if (it.opts._errorDataPathProperty) {
                          out += "is an invalid additional property";
                        } else {
                          out += "should NOT have additional properties";
                        }
                        out += "' ";
                      }
                      if (it.opts.verbose) {
                        out +=
                          " , schema: false , parentSchema: validate.schema" +
                          (it.schemaPath) + " , data: " + ($data) + " ";
                      }
                      out += " } ";
                    } else {
                      out += " {} ";
                    }
                    var __err = out;
                    out = $$outStack.pop();
                    if (!it.compositeRule && $breakOnError) {
                      /* istanbul ignore if */
                      if (it.async) {
                        out += " throw new ValidationError([" + (__err) +
                          "]); ";
                      } else {
                        out += " validate.errors = [" + (__err) +
                          "]; return false; ";
                      }
                    } else {
                      out += " var err = " + (__err) +
                        ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
                    }
                    $errSchemaPath = $currErrSchemaPath;
                    if ($breakOnError) {
                      out += " break; ";
                    }
                  }
                } else if ($additionalIsSchema) {
                  if ($removeAdditional == "failing") {
                    out += " var " + ($errs) + " = errors;  ";
                    var $wasComposite = it.compositeRule;
                    it.compositeRule = $it.compositeRule = true;
                    $it.schema = $aProperties;
                    $it.schemaPath = it.schemaPath + ".additionalProperties";
                    $it.errSchemaPath = it.errSchemaPath +
                      "/additionalProperties";
                    $it.errorPath = it.opts._errorDataPathProperty
                      ? it.errorPath
                      : it.util.getPathExpr(
                        it.errorPath,
                        $key,
                        it.opts.jsonPointers,
                      );
                    var $passData = $data + "[" + $key + "]";
                    $it.dataPathArr[$dataNxt] = $key;
                    var $code = it.validate($it);
                    $it.baseId = $currentBaseId;
                    if (it.util.varOccurences($code, $nextData) < 2) {
                      out += " " +
                        (it.util.varReplace($code, $nextData, $passData)) + " ";
                    } else {
                      out += " var " + ($nextData) + " = " + ($passData) +
                        "; " + ($code) + " ";
                    }
                    out += " if (!" + ($nextValid) + ") { errors = " + ($errs) +
                      "; if (validate.errors !== null) { if (errors) validate.errors.length = errors; else validate.errors = null; } delete " +
                      ($data) + "[" + ($key) + "]; }  ";
                    it.compositeRule = $it.compositeRule = $wasComposite;
                  } else {
                    $it.schema = $aProperties;
                    $it.schemaPath = it.schemaPath + ".additionalProperties";
                    $it.errSchemaPath = it.errSchemaPath +
                      "/additionalProperties";
                    $it.errorPath = it.opts._errorDataPathProperty
                      ? it.errorPath
                      : it.util.getPathExpr(
                        it.errorPath,
                        $key,
                        it.opts.jsonPointers,
                      );
                    var $passData = $data + "[" + $key + "]";
                    $it.dataPathArr[$dataNxt] = $key;
                    var $code = it.validate($it);
                    $it.baseId = $currentBaseId;
                    if (it.util.varOccurences($code, $nextData) < 2) {
                      out += " " +
                        (it.util.varReplace($code, $nextData, $passData)) + " ";
                    } else {
                      out += " var " + ($nextData) + " = " + ($passData) +
                        "; " + ($code) + " ";
                    }
                    if ($breakOnError) {
                      out += " if (!" + ($nextValid) + ") break; ";
                    }
                  }
                }
                it.errorPath = $currentErrorPath;
              }
              if ($someProperties) {
                out += " } ";
              }
              out += " }  ";
              if ($breakOnError) {
                out += " if (" + ($nextValid) + ") { ";
                $closingBraces += "}";
              }
            }
            var $useDefaults = it.opts.useDefaults && !it.compositeRule;
            if ($schemaKeys.length) {
              var arr3 = $schemaKeys;
              if (arr3) {
                var $propertyKey, i3 = -1, l3 = arr3.length - 1;
                while (i3 < l3) {
                  $propertyKey = arr3[i3 += 1];
                  var $sch = $schema[$propertyKey];
                  if (
                    (it.opts.strictKeywords
                      ? typeof $sch == "object" && Object.keys($sch).length > 0
                      : it.util.schemaHasRules($sch, it.RULES.all))
                  ) {
                    var $prop = it.util.getProperty($propertyKey),
                      $passData = $data + $prop,
                      $hasDefault = $useDefaults && $sch.default !== undefined;
                    $it.schema = $sch;
                    $it.schemaPath = $schemaPath + $prop;
                    $it.errSchemaPath = $errSchemaPath + "/" +
                      it.util.escapeFragment($propertyKey);
                    $it.errorPath = it.util.getPath(
                      it.errorPath,
                      $propertyKey,
                      it.opts.jsonPointers,
                    );
                    $it.dataPathArr[$dataNxt] = it.util.toQuotedString(
                      $propertyKey,
                    );
                    var $code = it.validate($it);
                    $it.baseId = $currentBaseId;
                    if (it.util.varOccurences($code, $nextData) < 2) {
                      $code = it.util.varReplace($code, $nextData, $passData);
                      var $useData = $passData;
                    } else {
                      var $useData = $nextData;
                      out += " var " + ($nextData) + " = " + ($passData) + "; ";
                    }
                    if ($hasDefault) {
                      out += " " + ($code) + " ";
                    } else {
                      if ($requiredHash && $requiredHash[$propertyKey]) {
                        out += " if ( " + ($useData) + " === undefined ";
                        if ($ownProperties) {
                          out += " || ! Object.prototype.hasOwnProperty.call(" +
                            ($data) + ", '" +
                            (it.util.escapeQuotes($propertyKey)) + "') ";
                        }
                        out += ") { " + ($nextValid) + " = false; ";
                        var $currentErrorPath = it.errorPath,
                          $currErrSchemaPath = $errSchemaPath,
                          $missingProperty = it.util.escapeQuotes($propertyKey);
                        if (it.opts._errorDataPathProperty) {
                          it.errorPath = it.util.getPath(
                            $currentErrorPath,
                            $propertyKey,
                            it.opts.jsonPointers,
                          );
                        }
                        $errSchemaPath = it.errSchemaPath + "/required";
                        var $$outStack = $$outStack || [];
                        $$outStack.push(out);
                        out = ""; /* istanbul ignore else */
                        if (it.createErrors !== false) {
                          out += " { keyword: '" + ("required") +
                            "' , dataPath: (dataPath || '') + " +
                            (it.errorPath) + " , schemaPath: " +
                            (it.util.toQuotedString($errSchemaPath)) +
                            " , params: { missingProperty: '" +
                            ($missingProperty) + "' } ";
                          if (it.opts.messages !== false) {
                            out += " , message: '";
                            if (it.opts._errorDataPathProperty) {
                              out += "is a required property";
                            } else {
                              out += "should have required property \\'" +
                                ($missingProperty) + "\\'";
                            }
                            out += "' ";
                          }
                          if (it.opts.verbose) {
                            out += " , schema: validate.schema" +
                              ($schemaPath) +
                              " , parentSchema: validate.schema" +
                              (it.schemaPath) + " , data: " + ($data) + " ";
                          }
                          out += " } ";
                        } else {
                          out += " {} ";
                        }
                        var __err = out;
                        out = $$outStack.pop();
                        if (!it.compositeRule && $breakOnError) {
                          /* istanbul ignore if */
                          if (it.async) {
                            out += " throw new ValidationError([" + (__err) +
                              "]); ";
                          } else {
                            out += " validate.errors = [" + (__err) +
                              "]; return false; ";
                          }
                        } else {
                          out += " var err = " + (__err) +
                            ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
                        }
                        $errSchemaPath = $currErrSchemaPath;
                        it.errorPath = $currentErrorPath;
                        out += " } else { ";
                      } else {
                        if ($breakOnError) {
                          out += " if ( " + ($useData) + " === undefined ";
                          if ($ownProperties) {
                            out +=
                              " || ! Object.prototype.hasOwnProperty.call(" +
                              ($data) + ", '" +
                              (it.util.escapeQuotes($propertyKey)) + "') ";
                          }
                          out += ") { " + ($nextValid) + " = true; } else { ";
                        } else {
                          out += " if (" + ($useData) + " !== undefined ";
                          if ($ownProperties) {
                            out +=
                              " &&   Object.prototype.hasOwnProperty.call(" +
                              ($data) + ", '" +
                              (it.util.escapeQuotes($propertyKey)) + "') ";
                          }
                          out += " ) { ";
                        }
                      }
                      out += " " + ($code) + " } ";
                    }
                  }
                  if ($breakOnError) {
                    out += " if (" + ($nextValid) + ") { ";
                    $closingBraces += "}";
                  }
                }
              }
            }
            if ($pPropertyKeys.length) {
              var arr4 = $pPropertyKeys;
              if (arr4) {
                var $pProperty, i4 = -1, l4 = arr4.length - 1;
                while (i4 < l4) {
                  $pProperty = arr4[i4 += 1];
                  var $sch = $pProperties[$pProperty];
                  if (
                    (it.opts.strictKeywords
                      ? typeof $sch == "object" && Object.keys($sch).length > 0
                      : it.util.schemaHasRules($sch, it.RULES.all))
                  ) {
                    $it.schema = $sch;
                    $it.schemaPath = it.schemaPath + ".patternProperties" +
                      it.util.getProperty($pProperty);
                    $it.errSchemaPath = it.errSchemaPath +
                      "/patternProperties/" +
                      it.util.escapeFragment($pProperty);
                    if ($ownProperties) {
                      out += " " + ($dataProperties) + " = " +
                        ($dataProperties) + " || Object.keys(" + ($data) +
                        "); for (var " + ($idx) + "=0; " + ($idx) + "<" +
                        ($dataProperties) + ".length; " + ($idx) +
                        "++) { var " + ($key) + " = " + ($dataProperties) +
                        "[" + ($idx) + "]; ";
                    } else {
                      out += " for (var " + ($key) + " in " + ($data) + ") { ";
                    }
                    out += " if (" + (it.usePattern($pProperty)) + ".test(" +
                      ($key) + ")) { ";
                    $it.errorPath = it.util.getPathExpr(
                      it.errorPath,
                      $key,
                      it.opts.jsonPointers,
                    );
                    var $passData = $data + "[" + $key + "]";
                    $it.dataPathArr[$dataNxt] = $key;
                    var $code = it.validate($it);
                    $it.baseId = $currentBaseId;
                    if (it.util.varOccurences($code, $nextData) < 2) {
                      out += " " +
                        (it.util.varReplace($code, $nextData, $passData)) + " ";
                    } else {
                      out += " var " + ($nextData) + " = " + ($passData) +
                        "; " + ($code) + " ";
                    }
                    if ($breakOnError) {
                      out += " if (!" + ($nextValid) + ") break; ";
                    }
                    out += " } ";
                    if ($breakOnError) {
                      out += " else " + ($nextValid) + " = true; ";
                    }
                    out += " }  ";
                    if ($breakOnError) {
                      out += " if (" + ($nextValid) + ") { ";
                      $closingBraces += "}";
                    }
                  }
                }
              }
            }
            if ($breakOnError) {
              out += " " + ($closingBraces) + " if (" + ($errs) +
                " == errors) {";
            }
            out = it.util.cleanUpCode(out);
            return out;
          };
        }, {}],
        34: [function (require, module, exports) {
          module.exports = function generate_propertyNames(
            it,
            $keyword,
            $ruleType,
          ) {
            var out = " ";
            var $lvl = it.level;
            var $dataLvl = it.dataLevel;
            var $schema = it.schema[$keyword];
            var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
            var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
            var $breakOnError = !it.opts.allErrors;
            var $data = "data" + ($dataLvl || "");
            var $errs = "errs__" + $lvl;
            var $it = it.util.copy(it);
            var $closingBraces = "";
            $it.level++;
            var $nextValid = "valid" + $it.level;
            out += "var " + ($errs) + " = errors;";
            if (
              (it.opts.strictKeywords
                ? typeof $schema == "object" && Object.keys($schema).length > 0
                : it.util.schemaHasRules($schema, it.RULES.all))
            ) {
              $it.schema = $schema;
              $it.schemaPath = $schemaPath;
              $it.errSchemaPath = $errSchemaPath;
              var $key = "key" + $lvl,
                $idx = "idx" + $lvl,
                $i = "i" + $lvl,
                $invalidName = "' + " + $key + " + '",
                $dataNxt = $it.dataLevel = it.dataLevel + 1,
                $nextData = "data" + $dataNxt,
                $dataProperties = "dataProperties" + $lvl,
                $ownProperties = it.opts.ownProperties,
                $currentBaseId = it.baseId;
              if ($ownProperties) {
                out += " var " + ($dataProperties) + " = undefined; ";
              }
              if ($ownProperties) {
                out += " " + ($dataProperties) + " = " + ($dataProperties) +
                  " || Object.keys(" + ($data) + "); for (var " + ($idx) +
                  "=0; " + ($idx) + "<" + ($dataProperties) + ".length; " +
                  ($idx) + "++) { var " + ($key) + " = " + ($dataProperties) +
                  "[" + ($idx) + "]; ";
              } else {
                out += " for (var " + ($key) + " in " + ($data) + ") { ";
              }
              out += " var startErrs" + ($lvl) + " = errors; ";
              var $passData = $key;
              var $wasComposite = it.compositeRule;
              it.compositeRule = $it.compositeRule = true;
              var $code = it.validate($it);
              $it.baseId = $currentBaseId;
              if (it.util.varOccurences($code, $nextData) < 2) {
                out += " " + (it.util.varReplace($code, $nextData, $passData)) +
                  " ";
              } else {
                out += " var " + ($nextData) + " = " + ($passData) + "; " +
                  ($code) + " ";
              }
              it.compositeRule = $it.compositeRule = $wasComposite;
              out += " if (!" + ($nextValid) + ") { for (var " + ($i) +
                "=startErrs" + ($lvl) + "; " + ($i) + "<errors; " + ($i) +
                "++) { vErrors[" + ($i) + "].propertyName = " + ($key) +
                "; }   var err =   "; /* istanbul ignore else */
              if (it.createErrors !== false) {
                out += " { keyword: '" + ("propertyNames") +
                  "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                  " , schemaPath: " + (it.util.toQuotedString($errSchemaPath)) +
                  " , params: { propertyName: '" + ($invalidName) + "' } ";
                if (it.opts.messages !== false) {
                  out += " , message: 'property name \\'" + ($invalidName) +
                    "\\' is invalid' ";
                }
                if (it.opts.verbose) {
                  out += " , schema: validate.schema" + ($schemaPath) +
                    " , parentSchema: validate.schema" + (it.schemaPath) +
                    " , data: " + ($data) + " ";
                }
                out += " } ";
              } else {
                out += " {} ";
              }
              out +=
                ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
              if (!it.compositeRule && $breakOnError) {
                /* istanbul ignore if */
                if (it.async) {
                  out += " throw new ValidationError(vErrors); ";
                } else {
                  out += " validate.errors = vErrors; return false; ";
                }
              }
              if ($breakOnError) {
                out += " break; ";
              }
              out += " } }";
            }
            if ($breakOnError) {
              out += " " + ($closingBraces) + " if (" + ($errs) +
                " == errors) {";
            }
            out = it.util.cleanUpCode(out);
            return out;
          };
        }, {}],
        35: [function (require, module, exports) {
          module.exports = function generate_ref(it, $keyword, $ruleType) {
            var out = " ";
            var $lvl = it.level;
            var $dataLvl = it.dataLevel;
            var $schema = it.schema[$keyword];
            var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
            var $breakOnError = !it.opts.allErrors;
            var $data = "data" + ($dataLvl || "");
            var $valid = "valid" + $lvl;
            var $async, $refCode;
            if ($schema == "#" || $schema == "#/") {
              if (it.isRoot) {
                $async = it.async;
                $refCode = "validate";
              } else {
                $async = it.root.schema.$async === true;
                $refCode = "root.refVal[0]";
              }
            } else {
              var $refVal = it.resolveRef(it.baseId, $schema, it.isRoot);
              if ($refVal === undefined) {
                var $message = it.MissingRefError.message(it.baseId, $schema);
                if (it.opts.missingRefs == "fail") {
                  it.logger.error($message);
                  var $$outStack = $$outStack || [];
                  $$outStack.push(out);
                  out = ""; /* istanbul ignore else */
                  if (it.createErrors !== false) {
                    out += " { keyword: '" + ("$ref") +
                      "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                      " , schemaPath: " +
                      (it.util.toQuotedString($errSchemaPath)) +
                      " , params: { ref: '" + (it.util.escapeQuotes($schema)) +
                      "' } ";
                    if (it.opts.messages !== false) {
                      out += " , message: 'can\\'t resolve reference " +
                        (it.util.escapeQuotes($schema)) + "' ";
                    }
                    if (it.opts.verbose) {
                      out += " , schema: " + (it.util.toQuotedString($schema)) +
                        " , parentSchema: validate.schema" + (it.schemaPath) +
                        " , data: " + ($data) + " ";
                    }
                    out += " } ";
                  } else {
                    out += " {} ";
                  }
                  var __err = out;
                  out = $$outStack.pop();
                  if (!it.compositeRule && $breakOnError) {
                    /* istanbul ignore if */
                    if (it.async) {
                      out += " throw new ValidationError([" + (__err) + "]); ";
                    } else {
                      out += " validate.errors = [" + (__err) +
                        "]; return false; ";
                    }
                  } else {
                    out += " var err = " + (__err) +
                      ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
                  }
                  if ($breakOnError) {
                    out += " if (false) { ";
                  }
                } else if (it.opts.missingRefs == "ignore") {
                  it.logger.warn($message);
                  if ($breakOnError) {
                    out += " if (true) { ";
                  }
                } else {
                  throw new it.MissingRefError(it.baseId, $schema, $message);
                }
              } else if ($refVal.inline) {
                var $it = it.util.copy(it);
                $it.level++;
                var $nextValid = "valid" + $it.level;
                $it.schema = $refVal.schema;
                $it.schemaPath = "";
                $it.errSchemaPath = $schema;
                var $code = it.validate($it).replace(
                  /validate\.schema/g,
                  $refVal.code,
                );
                out += " " + ($code) + " ";
                if ($breakOnError) {
                  out += " if (" + ($nextValid) + ") { ";
                }
              } else {
                $async = $refVal.$async === true ||
                  (it.async && $refVal.$async !== false);
                $refCode = $refVal.code;
              }
            }
            if ($refCode) {
              var $$outStack = $$outStack || [];
              $$outStack.push(out);
              out = "";
              if (it.opts.passContext) {
                out += " " + ($refCode) + ".call(this, ";
              } else {
                out += " " + ($refCode) + "( ";
              }
              out += " " + ($data) + ", (dataPath || '')";
              if (it.errorPath != '""') {
                out += " + " + (it.errorPath);
              }
              var $parentData = $dataLvl
                  ? "data" + (($dataLvl - 1) || "")
                  : "parentData",
                $parentDataProperty = $dataLvl
                  ? it.dataPathArr[$dataLvl]
                  : "parentDataProperty";
              out += " , " + ($parentData) + " , " + ($parentDataProperty) +
                ", rootData)  ";
              var __callValidate = out;
              out = $$outStack.pop();
              if ($async) {
                if (!it.async) {
                  throw new Error("async schema referenced by sync schema");
                }
                if ($breakOnError) {
                  out += " var " + ($valid) + "; ";
                }
                out += " try { await " + (__callValidate) + "; ";
                if ($breakOnError) {
                  out += " " + ($valid) + " = true; ";
                }
                out +=
                  " } catch (e) { if (!(e instanceof ValidationError)) throw e; if (vErrors === null) vErrors = e.errors; else vErrors = vErrors.concat(e.errors); errors = vErrors.length; ";
                if ($breakOnError) {
                  out += " " + ($valid) + " = false; ";
                }
                out += " } ";
                if ($breakOnError) {
                  out += " if (" + ($valid) + ") { ";
                }
              } else {
                out += " if (!" + (__callValidate) +
                  ") { if (vErrors === null) vErrors = " + ($refCode) +
                  ".errors; else vErrors = vErrors.concat(" + ($refCode) +
                  ".errors); errors = vErrors.length; } ";
                if ($breakOnError) {
                  out += " else { ";
                }
              }
            }
            return out;
          };
        }, {}],
        36: [function (require, module, exports) {
          module.exports = function generate_required(it, $keyword, $ruleType) {
            var out = " ";
            var $lvl = it.level;
            var $dataLvl = it.dataLevel;
            var $schema = it.schema[$keyword];
            var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
            var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
            var $breakOnError = !it.opts.allErrors;
            var $data = "data" + ($dataLvl || "");
            var $valid = "valid" + $lvl;
            var $isData = it.opts.$data && $schema && $schema.$data;
            if ($isData) {
              out += " var schema" + ($lvl) + " = " +
                (it.util.getData($schema.$data, $dataLvl, it.dataPathArr)) +
                "; ";
            }
            var $vSchema = "schema" + $lvl;
            if (!$isData) {
              if (
                $schema.length < it.opts.loopRequired &&
                it.schema.properties && Object.keys(it.schema.properties).length
              ) {
                var $required = [];
                var arr1 = $schema;
                if (arr1) {
                  var $property, i1 = -1, l1 = arr1.length - 1;
                  while (i1 < l1) {
                    $property = arr1[i1 += 1];
                    var $propertySch = it.schema.properties[$property];
                    if (
                      !($propertySch && (it.opts.strictKeywords
                        ? typeof $propertySch == "object" &&
                          Object.keys($propertySch).length > 0
                        : it.util.schemaHasRules($propertySch, it.RULES.all)))
                    ) {
                      $required[$required.length] = $property;
                    }
                  }
                }
              } else {
                var $required = $schema;
              }
            }
            if ($isData || $required.length) {
              var $currentErrorPath = it.errorPath,
                $loopRequired = $isData ||
                  $required.length >= it.opts.loopRequired,
                $ownProperties = it.opts.ownProperties;
              if ($breakOnError) {
                out += " var missing" + ($lvl) + "; ";
                if ($loopRequired) {
                  if (!$isData) {
                    out += " var " + ($vSchema) + " = validate.schema" +
                      ($schemaPath) + "; ";
                  }
                  var $i = "i" + $lvl,
                    $propertyPath = "schema" + $lvl + "[" + $i + "]",
                    $missingProperty = "' + " + $propertyPath + " + '";
                  if (it.opts._errorDataPathProperty) {
                    it.errorPath = it.util.getPathExpr(
                      $currentErrorPath,
                      $propertyPath,
                      it.opts.jsonPointers,
                    );
                  }
                  out += " var " + ($valid) + " = true; ";
                  if ($isData) {
                    out += " if (schema" + ($lvl) + " === undefined) " +
                      ($valid) + " = true; else if (!Array.isArray(schema" +
                      ($lvl) + ")) " + ($valid) + " = false; else {";
                  }
                  out += " for (var " + ($i) + " = 0; " + ($i) + " < " +
                    ($vSchema) + ".length; " + ($i) + "++) { " + ($valid) +
                    " = " + ($data) + "[" + ($vSchema) + "[" + ($i) +
                    "]] !== undefined ";
                  if ($ownProperties) {
                    out += " &&   Object.prototype.hasOwnProperty.call(" +
                      ($data) + ", " + ($vSchema) + "[" + ($i) + "]) ";
                  }
                  out += "; if (!" + ($valid) + ") break; } ";
                  if ($isData) {
                    out += "  }  ";
                  }
                  out += "  if (!" + ($valid) + ") {   ";
                  var $$outStack = $$outStack || [];
                  $$outStack.push(out);
                  out = ""; /* istanbul ignore else */
                  if (it.createErrors !== false) {
                    out += " { keyword: '" + ("required") +
                      "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                      " , schemaPath: " +
                      (it.util.toQuotedString($errSchemaPath)) +
                      " , params: { missingProperty: '" + ($missingProperty) +
                      "' } ";
                    if (it.opts.messages !== false) {
                      out += " , message: '";
                      if (it.opts._errorDataPathProperty) {
                        out += "is a required property";
                      } else {
                        out += "should have required property \\'" +
                          ($missingProperty) + "\\'";
                      }
                      out += "' ";
                    }
                    if (it.opts.verbose) {
                      out += " , schema: validate.schema" + ($schemaPath) +
                        " , parentSchema: validate.schema" + (it.schemaPath) +
                        " , data: " + ($data) + " ";
                    }
                    out += " } ";
                  } else {
                    out += " {} ";
                  }
                  var __err = out;
                  out = $$outStack.pop();
                  if (!it.compositeRule && $breakOnError) {
                    /* istanbul ignore if */
                    if (it.async) {
                      out += " throw new ValidationError([" + (__err) + "]); ";
                    } else {
                      out += " validate.errors = [" + (__err) +
                        "]; return false; ";
                    }
                  } else {
                    out += " var err = " + (__err) +
                      ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
                  }
                  out += " } else { ";
                } else {
                  out += " if ( ";
                  var arr2 = $required;
                  if (arr2) {
                    var $propertyKey, $i = -1, l2 = arr2.length - 1;
                    while ($i < l2) {
                      $propertyKey = arr2[$i += 1];
                      if ($i) {
                        out += " || ";
                      }
                      var $prop = it.util.getProperty($propertyKey),
                        $useData = $data + $prop;
                      out += " ( ( " + ($useData) + " === undefined ";
                      if ($ownProperties) {
                        out += " || ! Object.prototype.hasOwnProperty.call(" +
                          ($data) + ", '" +
                          (it.util.escapeQuotes($propertyKey)) + "') ";
                      }
                      out += ") && (missing" + ($lvl) + " = " +
                        (it.util.toQuotedString(
                          it.opts.jsonPointers ? $propertyKey : $prop,
                        )) + ") ) ";
                    }
                  }
                  out += ") {  ";
                  var $propertyPath = "missing" + $lvl,
                    $missingProperty = "' + " + $propertyPath + " + '";
                  if (it.opts._errorDataPathProperty) {
                    it.errorPath = it.opts.jsonPointers
                      ? it.util.getPathExpr(
                        $currentErrorPath,
                        $propertyPath,
                        true,
                      )
                      : $currentErrorPath + " + " + $propertyPath;
                  }
                  var $$outStack = $$outStack || [];
                  $$outStack.push(out);
                  out = ""; /* istanbul ignore else */
                  if (it.createErrors !== false) {
                    out += " { keyword: '" + ("required") +
                      "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                      " , schemaPath: " +
                      (it.util.toQuotedString($errSchemaPath)) +
                      " , params: { missingProperty: '" + ($missingProperty) +
                      "' } ";
                    if (it.opts.messages !== false) {
                      out += " , message: '";
                      if (it.opts._errorDataPathProperty) {
                        out += "is a required property";
                      } else {
                        out += "should have required property \\'" +
                          ($missingProperty) + "\\'";
                      }
                      out += "' ";
                    }
                    if (it.opts.verbose) {
                      out += " , schema: validate.schema" + ($schemaPath) +
                        " , parentSchema: validate.schema" + (it.schemaPath) +
                        " , data: " + ($data) + " ";
                    }
                    out += " } ";
                  } else {
                    out += " {} ";
                  }
                  var __err = out;
                  out = $$outStack.pop();
                  if (!it.compositeRule && $breakOnError) {
                    /* istanbul ignore if */
                    if (it.async) {
                      out += " throw new ValidationError([" + (__err) + "]); ";
                    } else {
                      out += " validate.errors = [" + (__err) +
                        "]; return false; ";
                    }
                  } else {
                    out += " var err = " + (__err) +
                      ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
                  }
                  out += " } else { ";
                }
              } else {
                if ($loopRequired) {
                  if (!$isData) {
                    out += " var " + ($vSchema) + " = validate.schema" +
                      ($schemaPath) + "; ";
                  }
                  var $i = "i" + $lvl,
                    $propertyPath = "schema" + $lvl + "[" + $i + "]",
                    $missingProperty = "' + " + $propertyPath + " + '";
                  if (it.opts._errorDataPathProperty) {
                    it.errorPath = it.util.getPathExpr(
                      $currentErrorPath,
                      $propertyPath,
                      it.opts.jsonPointers,
                    );
                  }
                  if ($isData) {
                    out += " if (" + ($vSchema) + " && !Array.isArray(" +
                      ($vSchema) +
                      ")) {  var err =   "; /* istanbul ignore else */
                    if (it.createErrors !== false) {
                      out += " { keyword: '" + ("required") +
                        "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                        " , schemaPath: " +
                        (it.util.toQuotedString($errSchemaPath)) +
                        " , params: { missingProperty: '" + ($missingProperty) +
                        "' } ";
                      if (it.opts.messages !== false) {
                        out += " , message: '";
                        if (it.opts._errorDataPathProperty) {
                          out += "is a required property";
                        } else {
                          out += "should have required property \\'" +
                            ($missingProperty) + "\\'";
                        }
                        out += "' ";
                      }
                      if (it.opts.verbose) {
                        out += " , schema: validate.schema" + ($schemaPath) +
                          " , parentSchema: validate.schema" + (it.schemaPath) +
                          " , data: " + ($data) + " ";
                      }
                      out += " } ";
                    } else {
                      out += " {} ";
                    }
                    out +=
                      ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; } else if (" +
                      ($vSchema) + " !== undefined) { ";
                  }
                  out += " for (var " + ($i) + " = 0; " + ($i) + " < " +
                    ($vSchema) + ".length; " + ($i) + "++) { if (" + ($data) +
                    "[" + ($vSchema) + "[" + ($i) + "]] === undefined ";
                  if ($ownProperties) {
                    out += " || ! Object.prototype.hasOwnProperty.call(" +
                      ($data) + ", " + ($vSchema) + "[" + ($i) + "]) ";
                  }
                  out += ") {  var err =   "; /* istanbul ignore else */
                  if (it.createErrors !== false) {
                    out += " { keyword: '" + ("required") +
                      "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                      " , schemaPath: " +
                      (it.util.toQuotedString($errSchemaPath)) +
                      " , params: { missingProperty: '" + ($missingProperty) +
                      "' } ";
                    if (it.opts.messages !== false) {
                      out += " , message: '";
                      if (it.opts._errorDataPathProperty) {
                        out += "is a required property";
                      } else {
                        out += "should have required property \\'" +
                          ($missingProperty) + "\\'";
                      }
                      out += "' ";
                    }
                    if (it.opts.verbose) {
                      out += " , schema: validate.schema" + ($schemaPath) +
                        " , parentSchema: validate.schema" + (it.schemaPath) +
                        " , data: " + ($data) + " ";
                    }
                    out += " } ";
                  } else {
                    out += " {} ";
                  }
                  out +=
                    ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; } } ";
                  if ($isData) {
                    out += "  }  ";
                  }
                } else {
                  var arr3 = $required;
                  if (arr3) {
                    var $propertyKey, i3 = -1, l3 = arr3.length - 1;
                    while (i3 < l3) {
                      $propertyKey = arr3[i3 += 1];
                      var $prop = it.util.getProperty($propertyKey),
                        $missingProperty = it.util.escapeQuotes($propertyKey),
                        $useData = $data + $prop;
                      if (it.opts._errorDataPathProperty) {
                        it.errorPath = it.util.getPath(
                          $currentErrorPath,
                          $propertyKey,
                          it.opts.jsonPointers,
                        );
                      }
                      out += " if ( " + ($useData) + " === undefined ";
                      if ($ownProperties) {
                        out += " || ! Object.prototype.hasOwnProperty.call(" +
                          ($data) + ", '" +
                          (it.util.escapeQuotes($propertyKey)) + "') ";
                      }
                      out += ") {  var err =   "; /* istanbul ignore else */
                      if (it.createErrors !== false) {
                        out += " { keyword: '" + ("required") +
                          "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                          " , schemaPath: " +
                          (it.util.toQuotedString($errSchemaPath)) +
                          " , params: { missingProperty: '" +
                          ($missingProperty) + "' } ";
                        if (it.opts.messages !== false) {
                          out += " , message: '";
                          if (it.opts._errorDataPathProperty) {
                            out += "is a required property";
                          } else {
                            out += "should have required property \\'" +
                              ($missingProperty) + "\\'";
                          }
                          out += "' ";
                        }
                        if (it.opts.verbose) {
                          out += " , schema: validate.schema" + ($schemaPath) +
                            " , parentSchema: validate.schema" +
                            (it.schemaPath) + " , data: " + ($data) + " ";
                        }
                        out += " } ";
                      } else {
                        out += " {} ";
                      }
                      out +=
                        ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; } ";
                    }
                  }
                }
              }
              it.errorPath = $currentErrorPath;
            } else if ($breakOnError) {
              out += " if (true) {";
            }
            return out;
          };
        }, {}],
        37: [function (require, module, exports) {
          module.exports = function generate_uniqueItems(
            it,
            $keyword,
            $ruleType,
          ) {
            var out = " ";
            var $lvl = it.level;
            var $dataLvl = it.dataLevel;
            var $schema = it.schema[$keyword];
            var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
            var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
            var $breakOnError = !it.opts.allErrors;
            var $data = "data" + ($dataLvl || "");
            var $valid = "valid" + $lvl;
            var $isData = it.opts.$data && $schema && $schema.$data,
              $schemaValue;
            if ($isData) {
              out += " var schema" + ($lvl) + " = " +
                (it.util.getData($schema.$data, $dataLvl, it.dataPathArr)) +
                "; ";
              $schemaValue = "schema" + $lvl;
            } else {
              $schemaValue = $schema;
            }
            if (($schema || $isData) && it.opts.uniqueItems !== false) {
              if ($isData) {
                out += " var " + ($valid) + "; if (" + ($schemaValue) +
                  " === false || " + ($schemaValue) + " === undefined) " +
                  ($valid) + " = true; else if (typeof " + ($schemaValue) +
                  " != 'boolean') " + ($valid) + " = false; else { ";
              }
              out += " var i = " + ($data) + ".length , " + ($valid) +
                " = true , j; if (i > 1) { ";
              var $itemType = it.schema.items && it.schema.items.type,
                $typeIsArray = Array.isArray($itemType);
              if (
                !$itemType || $itemType == "object" || $itemType == "array" ||
                ($typeIsArray &&
                  ($itemType.indexOf("object") >= 0 ||
                    $itemType.indexOf("array") >= 0))
              ) {
                out += " outer: for (;i--;) { for (j = i; j--;) { if (equal(" +
                  ($data) + "[i], " + ($data) + "[j])) { " + ($valid) +
                  " = false; break outer; } } } ";
              } else {
                out +=
                  " var itemIndices = {}, item; for (;i--;) { var item = " +
                  ($data) + "[i]; ";
                var $method = "checkDataType" + ($typeIsArray ? "s" : "");
                out += " if (" + (it.util[$method]($itemType, "item", true)) +
                  ") continue; ";
                if ($typeIsArray) {
                  out += " if (typeof item == 'string') item = '\"' + item; ";
                }
                out += " if (typeof itemIndices[item] == 'number') { " +
                  ($valid) +
                  " = false; j = itemIndices[item]; break; } itemIndices[item] = i; } ";
              }
              out += " } ";
              if ($isData) {
                out += "  }  ";
              }
              out += " if (!" + ($valid) + ") {   ";
              var $$outStack = $$outStack || [];
              $$outStack.push(out);
              out = ""; /* istanbul ignore else */
              if (it.createErrors !== false) {
                out += " { keyword: '" + ("uniqueItems") +
                  "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                  " , schemaPath: " + (it.util.toQuotedString($errSchemaPath)) +
                  " , params: { i: i, j: j } ";
                if (it.opts.messages !== false) {
                  out +=
                    " , message: 'should NOT have duplicate items (items ## ' + j + ' and ' + i + ' are identical)' ";
                }
                if (it.opts.verbose) {
                  out += " , schema:  ";
                  if ($isData) {
                    out += "validate.schema" + ($schemaPath);
                  } else {
                    out += "" + ($schema);
                  }
                  out += "         , parentSchema: validate.schema" +
                    (it.schemaPath) + " , data: " + ($data) + " ";
                }
                out += " } ";
              } else {
                out += " {} ";
              }
              var __err = out;
              out = $$outStack.pop();
              if (!it.compositeRule && $breakOnError) {
                /* istanbul ignore if */
                if (it.async) {
                  out += " throw new ValidationError([" + (__err) + "]); ";
                } else {
                  out += " validate.errors = [" + (__err) + "]; return false; ";
                }
              } else {
                out += " var err = " + (__err) +
                  ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
              }
              out += " } ";
              if ($breakOnError) {
                out += " else { ";
              }
            } else {
              if ($breakOnError) {
                out += " if (true) { ";
              }
            }
            return out;
          };
        }, {}],
        38: [function (require, module, exports) {
          module.exports = function generate_validate(it, $keyword, $ruleType) {
            var out = "";
            var $async = it.schema.$async === true,
              $refKeywords = it.util.schemaHasRulesExcept(
                it.schema,
                it.RULES.all,
                "$ref",
              ),
              $id = it.self._getId(it.schema);
            if (it.opts.strictKeywords) {
              var $unknownKwd = it.util.schemaUnknownRules(
                it.schema,
                it.RULES.keywords,
              );
              if ($unknownKwd) {
                var $keywordsMsg = "unknown keyword: " + $unknownKwd;
                if (it.opts.strictKeywords === "log") {
                  it.logger.warn($keywordsMsg);
                } else throw new Error($keywordsMsg);
              }
            }
            if (it.isTop) {
              out += " var validate = ";
              if ($async) {
                it.async = true;
                out += "async ";
              }
              out +=
                "function(data, dataPath, parentData, parentDataProperty, rootData) { 'use strict'; ";
              if ($id && (it.opts.sourceCode || it.opts.processCode)) {
                out += " " + ("/\*# sourceURL=" + $id + " */") + " ";
              }
            }
            if (
              typeof it.schema == "boolean" ||
              !($refKeywords || it.schema.$ref)
            ) {
              var $keyword = "false schema";
              var $lvl = it.level;
              var $dataLvl = it.dataLevel;
              var $schema = it.schema[$keyword];
              var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
              var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
              var $breakOnError = !it.opts.allErrors;
              var $errorKeyword;
              var $data = "data" + ($dataLvl || "");
              var $valid = "valid" + $lvl;
              if (it.schema === false) {
                if (it.isTop) {
                  $breakOnError = true;
                } else {
                  out += " var " + ($valid) + " = false; ";
                }
                var $$outStack = $$outStack || [];
                $$outStack.push(out);
                out = ""; /* istanbul ignore else */
                if (it.createErrors !== false) {
                  out += " { keyword: '" + ($errorKeyword || "false schema") +
                    "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                    " , schemaPath: " +
                    (it.util.toQuotedString($errSchemaPath)) + " , params: {} ";
                  if (it.opts.messages !== false) {
                    out += " , message: 'boolean schema is false' ";
                  }
                  if (it.opts.verbose) {
                    out += " , schema: false , parentSchema: validate.schema" +
                      (it.schemaPath) + " , data: " + ($data) + " ";
                  }
                  out += " } ";
                } else {
                  out += " {} ";
                }
                var __err = out;
                out = $$outStack.pop();
                if (!it.compositeRule && $breakOnError) {
                  /* istanbul ignore if */
                  if (it.async) {
                    out += " throw new ValidationError([" + (__err) + "]); ";
                  } else {
                    out += " validate.errors = [" + (__err) +
                      "]; return false; ";
                  }
                } else {
                  out += " var err = " + (__err) +
                    ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
                }
              } else {
                if (it.isTop) {
                  if ($async) {
                    out += " return data; ";
                  } else {
                    out += " validate.errors = null; return true; ";
                  }
                } else {
                  out += " var " + ($valid) + " = true; ";
                }
              }
              if (it.isTop) {
                out += " }; return validate; ";
              }
              return out;
            }
            if (it.isTop) {
              var $top = it.isTop,
                $lvl = it.level = 0,
                $dataLvl = it.dataLevel = 0,
                $data = "data";
              it.rootId = it.resolve.fullPath(it.self._getId(it.root.schema));
              it.baseId = it.baseId || it.rootId;
              delete it.isTop;
              it.dataPathArr = [undefined];
              if (
                it.schema.default !== undefined && it.opts.useDefaults &&
                it.opts.strictDefaults
              ) {
                var $defaultMsg = "default is ignored in the schema root";
                if (it.opts.strictDefaults === "log") {
                  it.logger.warn($defaultMsg);
                } else throw new Error($defaultMsg);
              }
              out += " var vErrors = null; ";
              out += " var errors = 0;     ";
              out += " if (rootData === undefined) rootData = data; ";
            } else {
              var $lvl = it.level,
                $dataLvl = it.dataLevel,
                $data = "data" + ($dataLvl || "");
              if ($id) it.baseId = it.resolve.url(it.baseId, $id);
              if ($async && !it.async) {
                throw new Error("async schema in sync schema");
              }
              out += " var errs_" + ($lvl) + " = errors;";
            }
            var $valid = "valid" + $lvl,
              $breakOnError = !it.opts.allErrors,
              $closingBraces1 = "",
              $closingBraces2 = "";
            var $errorKeyword;
            var $typeSchema = it.schema.type,
              $typeIsArray = Array.isArray($typeSchema);
            if (
              $typeSchema && it.opts.nullable && it.schema.nullable === true
            ) {
              if ($typeIsArray) {
                if ($typeSchema.indexOf("null") == -1) {
                  $typeSchema = $typeSchema.concat("null");
                }
              } else if ($typeSchema != "null") {
                $typeSchema = [$typeSchema, "null"];
                $typeIsArray = true;
              }
            }
            if ($typeIsArray && $typeSchema.length == 1) {
              $typeSchema = $typeSchema[0];
              $typeIsArray = false;
            }
            if (it.schema.$ref && $refKeywords) {
              if (it.opts.extendRefs == "fail") {
                throw new Error(
                  '$ref: validation keywords used in schema at path "' +
                    it.errSchemaPath + '" (see option extendRefs)',
                );
              } else if (it.opts.extendRefs !== true) {
                $refKeywords = false;
                it.logger.warn(
                  '$ref: keywords ignored in schema at path "' +
                    it.errSchemaPath + '"',
                );
              }
            }
            if (it.schema.$comment && it.opts.$comment) {
              out += " " + (it.RULES.all.$comment.code(it, "$comment"));
            }
            if ($typeSchema) {
              if (it.opts.coerceTypes) {
                var $coerceToTypes = it.util.coerceToTypes(
                  it.opts.coerceTypes,
                  $typeSchema,
                );
              }
              var $rulesGroup = it.RULES.types[$typeSchema];
              if (
                $coerceToTypes || $typeIsArray || $rulesGroup === true ||
                ($rulesGroup && !$shouldUseGroup($rulesGroup))
              ) {
                var $schemaPath = it.schemaPath + ".type",
                  $errSchemaPath = it.errSchemaPath + "/type";
                var $schemaPath = it.schemaPath + ".type",
                  $errSchemaPath = it.errSchemaPath + "/type",
                  $method = $typeIsArray ? "checkDataTypes" : "checkDataType";
                out += " if (" + (it.util[$method]($typeSchema, $data, true)) +
                  ") { ";
                if ($coerceToTypes) {
                  var $dataType = "dataType" + $lvl,
                    $coerced = "coerced" + $lvl;
                  out += " var " + ($dataType) + " = typeof " + ($data) + "; ";
                  if (it.opts.coerceTypes == "array") {
                    out += " if (" + ($dataType) +
                      " == 'object' && Array.isArray(" + ($data) + ")) " +
                      ($dataType) + " = 'array'; ";
                  }
                  out += " var " + ($coerced) + " = undefined; ";
                  var $bracesCoercion = "";
                  var arr1 = $coerceToTypes;
                  if (arr1) {
                    var $type, $i = -1, l1 = arr1.length - 1;
                    while ($i < l1) {
                      $type = arr1[$i += 1];
                      if ($i) {
                        out += " if (" + ($coerced) + " === undefined) { ";
                        $bracesCoercion += "}";
                      }
                      if (it.opts.coerceTypes == "array" && $type != "array") {
                        out += " if (" + ($dataType) + " == 'array' && " +
                          ($data) + ".length == 1) { " + ($coerced) + " = " +
                          ($data) + " = " + ($data) + "[0]; " + ($dataType) +
                          " = typeof " + ($data) + ";  } ";
                      }
                      if ($type == "string") {
                        out += " if (" + ($dataType) + " == 'number' || " +
                          ($dataType) + " == 'boolean') " + ($coerced) +
                          " = '' + " + ($data) + "; else if (" + ($data) +
                          " === null) " + ($coerced) + " = ''; ";
                      } else if ($type == "number" || $type == "integer") {
                        out += " if (" + ($dataType) + " == 'boolean' || " +
                          ($data) + " === null || (" + ($dataType) +
                          " == 'string' && " + ($data) + " && " + ($data) +
                          " == +" + ($data) + " ";
                        if ($type == "integer") {
                          out += " && !(" + ($data) + " % 1)";
                        }
                        out += ")) " + ($coerced) + " = +" + ($data) + "; ";
                      } else if ($type == "boolean") {
                        out += " if (" + ($data) + " === 'false' || " +
                          ($data) + " === 0 || " + ($data) + " === null) " +
                          ($coerced) + " = false; else if (" + ($data) +
                          " === 'true' || " + ($data) + " === 1) " +
                          ($coerced) + " = true; ";
                      } else if ($type == "null") {
                        out += " if (" + ($data) + " === '' || " + ($data) +
                          " === 0 || " + ($data) + " === false) " + ($coerced) +
                          " = null; ";
                      } else if (
                        it.opts.coerceTypes == "array" && $type == "array"
                      ) {
                        out += " if (" + ($dataType) + " == 'string' || " +
                          ($dataType) + " == 'number' || " + ($dataType) +
                          " == 'boolean' || " + ($data) + " == null) " +
                          ($coerced) + " = [" + ($data) + "]; ";
                      }
                    }
                  }
                  out += " " + ($bracesCoercion) + " if (" + ($coerced) +
                    " === undefined) {   ";
                  var $$outStack = $$outStack || [];
                  $$outStack.push(out);
                  out = ""; /* istanbul ignore else */
                  if (it.createErrors !== false) {
                    out += " { keyword: '" + ($errorKeyword || "type") +
                      "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                      " , schemaPath: " +
                      (it.util.toQuotedString($errSchemaPath)) +
                      " , params: { type: '";
                    if ($typeIsArray) {
                      out += "" + ($typeSchema.join(","));
                    } else {
                      out += "" + ($typeSchema);
                    }
                    out += "' } ";
                    if (it.opts.messages !== false) {
                      out += " , message: 'should be ";
                      if ($typeIsArray) {
                        out += "" + ($typeSchema.join(","));
                      } else {
                        out += "" + ($typeSchema);
                      }
                      out += "' ";
                    }
                    if (it.opts.verbose) {
                      out += " , schema: validate.schema" + ($schemaPath) +
                        " , parentSchema: validate.schema" + (it.schemaPath) +
                        " , data: " + ($data) + " ";
                    }
                    out += " } ";
                  } else {
                    out += " {} ";
                  }
                  var __err = out;
                  out = $$outStack.pop();
                  if (!it.compositeRule && $breakOnError) {
                    /* istanbul ignore if */
                    if (it.async) {
                      out += " throw new ValidationError([" + (__err) + "]); ";
                    } else {
                      out += " validate.errors = [" + (__err) +
                        "]; return false; ";
                    }
                  } else {
                    out += " var err = " + (__err) +
                      ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
                  }
                  out += " } else {  ";
                  var $parentData = $dataLvl
                      ? "data" + (($dataLvl - 1) || "")
                      : "parentData",
                    $parentDataProperty = $dataLvl
                      ? it.dataPathArr[$dataLvl]
                      : "parentDataProperty";
                  out += " " + ($data) + " = " + ($coerced) + "; ";
                  if (!$dataLvl) {
                    out += "if (" + ($parentData) + " !== undefined)";
                  }
                  out += " " + ($parentData) + "[" + ($parentDataProperty) +
                    "] = " + ($coerced) + "; } ";
                } else {
                  var $$outStack = $$outStack || [];
                  $$outStack.push(out);
                  out = ""; /* istanbul ignore else */
                  if (it.createErrors !== false) {
                    out += " { keyword: '" + ($errorKeyword || "type") +
                      "' , dataPath: (dataPath || '') + " + (it.errorPath) +
                      " , schemaPath: " +
                      (it.util.toQuotedString($errSchemaPath)) +
                      " , params: { type: '";
                    if ($typeIsArray) {
                      out += "" + ($typeSchema.join(","));
                    } else {
                      out += "" + ($typeSchema);
                    }
                    out += "' } ";
                    if (it.opts.messages !== false) {
                      out += " , message: 'should be ";
                      if ($typeIsArray) {
                        out += "" + ($typeSchema.join(","));
                      } else {
                        out += "" + ($typeSchema);
                      }
                      out += "' ";
                    }
                    if (it.opts.verbose) {
                      out += " , schema: validate.schema" + ($schemaPath) +
                        " , parentSchema: validate.schema" + (it.schemaPath) +
                        " , data: " + ($data) + " ";
                    }
                    out += " } ";
                  } else {
                    out += " {} ";
                  }
                  var __err = out;
                  out = $$outStack.pop();
                  if (!it.compositeRule && $breakOnError) {
                    /* istanbul ignore if */
                    if (it.async) {
                      out += " throw new ValidationError([" + (__err) + "]); ";
                    } else {
                      out += " validate.errors = [" + (__err) +
                        "]; return false; ";
                    }
                  } else {
                    out += " var err = " + (__err) +
                      ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
                  }
                }
                out += " } ";
              }
            }
            if (it.schema.$ref && !$refKeywords) {
              out += " " + (it.RULES.all.$ref.code(it, "$ref")) + " ";
              if ($breakOnError) {
                out += " } if (errors === ";
                if ($top) {
                  out += "0";
                } else {
                  out += "errs_" + ($lvl);
                }
                out += ") { ";
                $closingBraces2 += "}";
              }
            } else {
              var arr2 = it.RULES;
              if (arr2) {
                var $rulesGroup, i2 = -1, l2 = arr2.length - 1;
                while (i2 < l2) {
                  $rulesGroup = arr2[i2 += 1];
                  if ($shouldUseGroup($rulesGroup)) {
                    if ($rulesGroup.type) {
                      out += " if (" +
                        (it.util.checkDataType($rulesGroup.type, $data)) +
                        ") { ";
                    }
                    if (it.opts.useDefaults) {
                      if (
                        $rulesGroup.type == "object" && it.schema.properties
                      ) {
                        var $schema = it.schema.properties,
                          $schemaKeys = Object.keys($schema);
                        var arr3 = $schemaKeys;
                        if (arr3) {
                          var $propertyKey, i3 = -1, l3 = arr3.length - 1;
                          while (i3 < l3) {
                            $propertyKey = arr3[i3 += 1];
                            var $sch = $schema[$propertyKey];
                            if ($sch.default !== undefined) {
                              var $passData = $data +
                                it.util.getProperty($propertyKey);
                              if (it.compositeRule) {
                                if (it.opts.strictDefaults) {
                                  var $defaultMsg = "default is ignored for: " +
                                    $passData;
                                  if (it.opts.strictDefaults === "log") {it
                                      .logger.warn($defaultMsg);} else {
                                    throw new Error($defaultMsg);
                                  }
                                }
                              } else {
                                out += " if (" + ($passData) +
                                  " === undefined ";
                                if (it.opts.useDefaults == "empty") {
                                  out += " || " + ($passData) +
                                    " === null || " + ($passData) + " === '' ";
                                }
                                out += " ) " + ($passData) + " = ";
                                if (it.opts.useDefaults == "shared") {
                                  out += " " + (it.useDefault($sch.default)) +
                                    " ";
                                } else {
                                  out += " " + (JSON.stringify($sch.default)) +
                                    " ";
                                }
                                out += "; ";
                              }
                            }
                          }
                        }
                      } else if (
                        $rulesGroup.type == "array" &&
                        Array.isArray(it.schema.items)
                      ) {
                        var arr4 = it.schema.items;
                        if (arr4) {
                          var $sch, $i = -1, l4 = arr4.length - 1;
                          while ($i < l4) {
                            $sch = arr4[$i += 1];
                            if ($sch.default !== undefined) {
                              var $passData = $data + "[" + $i + "]";
                              if (it.compositeRule) {
                                if (it.opts.strictDefaults) {
                                  var $defaultMsg = "default is ignored for: " +
                                    $passData;
                                  if (it.opts.strictDefaults === "log") {
                                    it.logger.warn($defaultMsg);
                                  } else throw new Error($defaultMsg);
                                }
                              } else {
                                out += " if (" + ($passData) +
                                  " === undefined ";
                                if (it.opts.useDefaults == "empty") {
                                  out += " || " + ($passData) +
                                    " === null || " + ($passData) + " === '' ";
                                }
                                out += " ) " + ($passData) + " = ";
                                if (it.opts.useDefaults == "shared") {
                                  out += " " + (it.useDefault($sch.default)) +
                                    " ";
                                } else {
                                  out += " " + (JSON.stringify($sch.default)) +
                                    " ";
                                }
                                out += "; ";
                              }
                            }
                          }
                        }
                      }
                    }
                    var arr5 = $rulesGroup.rules;
                    if (arr5) {
                      var $rule, i5 = -1, l5 = arr5.length - 1;
                      while (i5 < l5) {
                        $rule = arr5[i5 += 1];
                        if ($shouldUseRule($rule)) {
                          var $code = $rule.code(
                            it,
                            $rule.keyword,
                            $rulesGroup.type,
                          );
                          if ($code) {
                            out += " " + ($code) + " ";
                            if ($breakOnError) {
                              $closingBraces1 += "}";
                            }
                          }
                        }
                      }
                    }
                    if ($breakOnError) {
                      out += " " + ($closingBraces1) + " ";
                      $closingBraces1 = "";
                    }
                    if ($rulesGroup.type) {
                      out += " } ";
                      if (
                        $typeSchema && $typeSchema === $rulesGroup.type &&
                        !$coerceToTypes
                      ) {
                        out += " else { ";
                        var $schemaPath = it.schemaPath + ".type",
                          $errSchemaPath = it.errSchemaPath + "/type";
                        var $$outStack = $$outStack || [];
                        $$outStack.push(out);
                        out = ""; /* istanbul ignore else */
                        if (it.createErrors !== false) {
                          out += " { keyword: '" + ($errorKeyword || "type") +
                            "' , dataPath: (dataPath || '') + " +
                            (it.errorPath) + " , schemaPath: " +
                            (it.util.toQuotedString($errSchemaPath)) +
                            " , params: { type: '";
                          if ($typeIsArray) {
                            out += "" + ($typeSchema.join(","));
                          } else {
                            out += "" + ($typeSchema);
                          }
                          out += "' } ";
                          if (it.opts.messages !== false) {
                            out += " , message: 'should be ";
                            if ($typeIsArray) {
                              out += "" + ($typeSchema.join(","));
                            } else {
                              out += "" + ($typeSchema);
                            }
                            out += "' ";
                          }
                          if (it.opts.verbose) {
                            out += " , schema: validate.schema" +
                              ($schemaPath) +
                              " , parentSchema: validate.schema" +
                              (it.schemaPath) + " , data: " + ($data) + " ";
                          }
                          out += " } ";
                        } else {
                          out += " {} ";
                        }
                        var __err = out;
                        out = $$outStack.pop();
                        if (!it.compositeRule && $breakOnError) {
                          /* istanbul ignore if */
                          if (it.async) {
                            out += " throw new ValidationError([" + (__err) +
                              "]); ";
                          } else {
                            out += " validate.errors = [" + (__err) +
                              "]; return false; ";
                          }
                        } else {
                          out += " var err = " + (__err) +
                            ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
                        }
                        out += " } ";
                      }
                    }
                    if ($breakOnError) {
                      out += " if (errors === ";
                      if ($top) {
                        out += "0";
                      } else {
                        out += "errs_" + ($lvl);
                      }
                      out += ") { ";
                      $closingBraces2 += "}";
                    }
                  }
                }
              }
            }
            if ($breakOnError) {
              out += " " + ($closingBraces2) + " ";
            }
            if ($top) {
              if ($async) {
                out += " if (errors === 0) return data;           ";
                out += " else throw new ValidationError(vErrors); ";
              } else {
                out += " validate.errors = vErrors; ";
                out += " return errors === 0;       ";
              }
              out += " }; return validate;";
            } else {
              out += " var " + ($valid) + " = errors === errs_" + ($lvl) + ";";
            }
            out = it.util.cleanUpCode(out);
            if ($top) {
              out = it.util.finalCleanUpCode(out, $async);
            }

            function $shouldUseGroup($rulesGroup) {
              var rules = $rulesGroup.rules;
              for (var i = 0; i < rules.length; i++) {
                if ($shouldUseRule(rules[i])) return true;
              }
            }

            function $shouldUseRule($rule) {
              return it.schema[$rule.keyword] !== undefined ||
                ($rule.implements && $ruleImplementsSomeKeyword($rule));
            }

            function $ruleImplementsSomeKeyword($rule) {
              var impl = $rule.implements;
              for (var i = 0; i < impl.length; i++) {
                if (it.schema[impl[i]] !== undefined) return true;
              }
            }
            return out;
          };
        }, {}],
        39: [function (require, module, exports) {
          var IDENTIFIER = /^[a-z_$][a-z0-9_$-]*$/i;
          var customRuleCode = require("./dotjs/custom");
          var definitionSchema = require("./definition_schema");

          module.exports = {
            add: addKeyword,
            get: getKeyword,
            remove: removeKeyword,
            validate: validateKeyword,
          };

          /**
 * Define custom keyword
 * @this  Ajv
 * @param {String} keyword custom keyword, should be unique (including different from all standard, custom and macro keywords).
 * @param {Object} definition keyword definition object with properties `type` (type(s) which the keyword applies to), `validate` or `compile`.
 * @return {Ajv} this for method chaining
 */
          function addKeyword(keyword, definition) {
            /* jshint validthis: true */
            /* eslint no-shadow: 0 */
            var RULES = this.RULES;
            if (RULES.keywords[keyword]) {
              throw new Error("Keyword " + keyword + " is already defined");
            }

            if (!IDENTIFIER.test(keyword)) {
              throw new Error(
                "Keyword " + keyword + " is not a valid identifier",
              );
            }

            if (definition) {
              this.validateKeyword(definition, true);

              var dataType = definition.type;
              if (Array.isArray(dataType)) {
                for (var i = 0; i < dataType.length; i++) {
                  _addRule(keyword, dataType[i], definition);
                }
              } else {
                _addRule(keyword, dataType, definition);
              }

              var metaSchema = definition.metaSchema;
              if (metaSchema) {
                if (definition.$data && this._opts.$data) {
                  metaSchema = {
                    anyOf: [
                      metaSchema,
                      {
                        "$ref":
                          "https://raw.githubusercontent.com/epoberezkin/ajv/master/lib/refs/data.json#",
                      },
                    ],
                  };
                }
                definition.validateSchema = this.compile(metaSchema, true);
              }
            }

            RULES.keywords[keyword] = RULES.all[keyword] = true;

            function _addRule(keyword, dataType, definition) {
              var ruleGroup;
              for (var i = 0; i < RULES.length; i++) {
                var rg = RULES[i];
                if (rg.type == dataType) {
                  ruleGroup = rg;
                  break;
                }
              }

              if (!ruleGroup) {
                ruleGroup = { type: dataType, rules: [] };
                RULES.push(ruleGroup);
              }

              var rule = {
                keyword: keyword,
                definition: definition,
                custom: true,
                code: customRuleCode,
                implements: definition.implements,
              };
              ruleGroup.rules.push(rule);
              RULES.custom[keyword] = rule;
            }

            return this;
          }

          /**
 * Get keyword
 * @this  Ajv
 * @param {String} keyword pre-defined or custom keyword.
 * @return {Object|Boolean} custom keyword definition, `true` if it is a predefined keyword, `false` otherwise.
 */
          function getKeyword(keyword) {
            /* jshint validthis: true */
            var rule = this.RULES.custom[keyword];
            return rule
              ? rule.definition
              : this.RULES.keywords[keyword] || false;
          }

          /**
 * Remove keyword
 * @this  Ajv
 * @param {String} keyword pre-defined or custom keyword.
 * @return {Ajv} this for method chaining
 */
          function removeKeyword(keyword) {
            /* jshint validthis: true */
            var RULES = this.RULES;
            delete RULES.keywords[keyword];
            delete RULES.all[keyword];
            delete RULES.custom[keyword];
            for (var i = 0; i < RULES.length; i++) {
              var rules = RULES[i].rules;
              for (var j = 0; j < rules.length; j++) {
                if (rules[j].keyword == keyword) {
                  rules.splice(j, 1);
                  break;
                }
              }
            }
            return this;
          }

          /**
 * Validate keyword definition
 * @this  Ajv
 * @param {Object} definition keyword definition object.
 * @param {Boolean} throwError true to throw exception if definition is invalid
 * @return {boolean} validation result
 */
          function validateKeyword(definition, throwError) {
            validateKeyword.errors = null;
            var v = this._validateKeyword = this._validateKeyword ||
              this.compile(definitionSchema, true);

            if (v(definition)) return true;
            validateKeyword.errors = v.errors;
            if (throwError) {
              throw new Error(
                "custom keyword definition is invalid: " +
                  this.errorsText(v.errors),
              );
            } else {
              return false;
            }
          }
        }, { "./definition_schema": 12, "./dotjs/custom": 22 }],
        40: [function (require, module, exports) {
          module.exports = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "$id":
              "https://raw.githubusercontent.com/epoberezkin/ajv/master/lib/refs/data.json#",
            "description":
              "Meta-schema for $data reference (JSON Schema extension proposal)",
            "type": "object",
            "required": ["$data"],
            "properties": {
              "$data": {
                "type": "string",
                "anyOf": [
                  { "format": "relative-json-pointer" },
                  { "format": "json-pointer" },
                ],
              },
            },
            "additionalProperties": false,
          };
        }, {}],
        41: [function (require, module, exports) {
          module.exports = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "$id": "http://json-schema.org/draft-07/schema#",
            "title": "Core schema meta-schema",
            "definitions": {
              "schemaArray": {
                "type": "array",
                "minItems": 1,
                "items": { "$ref": "#" },
              },
              "nonNegativeInteger": {
                "type": "integer",
                "minimum": 0,
              },
              "nonNegativeIntegerDefault0": {
                "allOf": [
                  { "$ref": "#/definitions/nonNegativeInteger" },
                  { "default": 0 },
                ],
              },
              "simpleTypes": {
                "enum": [
                  "array",
                  "boolean",
                  "integer",
                  "null",
                  "number",
                  "object",
                  "string",
                ],
              },
              "stringArray": {
                "type": "array",
                "items": { "type": "string" },
                "uniqueItems": true,
                "default": [],
              },
            },
            "type": ["object", "boolean"],
            "properties": {
              "$id": {
                "type": "string",
                "format": "uri-reference",
              },
              "$schema": {
                "type": "string",
                "format": "uri",
              },
              "$ref": {
                "type": "string",
                "format": "uri-reference",
              },
              "$comment": {
                "type": "string",
              },
              "title": {
                "type": "string",
              },
              "description": {
                "type": "string",
              },
              "default": true,
              "readOnly": {
                "type": "boolean",
                "default": false,
              },
              "examples": {
                "type": "array",
                "items": true,
              },
              "multipleOf": {
                "type": "number",
                "exclusiveMinimum": 0,
              },
              "maximum": {
                "type": "number",
              },
              "exclusiveMaximum": {
                "type": "number",
              },
              "minimum": {
                "type": "number",
              },
              "exclusiveMinimum": {
                "type": "number",
              },
              "maxLength": { "$ref": "#/definitions/nonNegativeInteger" },
              "minLength": {
                "$ref": "#/definitions/nonNegativeIntegerDefault0",
              },
              "pattern": {
                "type": "string",
                "format": "regex",
              },
              "additionalItems": { "$ref": "#" },
              "items": {
                "anyOf": [
                  { "$ref": "#" },
                  { "$ref": "#/definitions/schemaArray" },
                ],
                "default": true,
              },
              "maxItems": { "$ref": "#/definitions/nonNegativeInteger" },
              "minItems": {
                "$ref": "#/definitions/nonNegativeIntegerDefault0",
              },
              "uniqueItems": {
                "type": "boolean",
                "default": false,
              },
              "contains": { "$ref": "#" },
              "maxProperties": { "$ref": "#/definitions/nonNegativeInteger" },
              "minProperties": {
                "$ref": "#/definitions/nonNegativeIntegerDefault0",
              },
              "required": { "$ref": "#/definitions/stringArray" },
              "additionalProperties": { "$ref": "#" },
              "definitions": {
                "type": "object",
                "additionalProperties": { "$ref": "#" },
                "default": {},
              },
              "properties": {
                "type": "object",
                "additionalProperties": { "$ref": "#" },
                "default": {},
              },
              "patternProperties": {
                "type": "object",
                "additionalProperties": { "$ref": "#" },
                "propertyNames": { "format": "regex" },
                "default": {},
              },
              "dependencies": {
                "type": "object",
                "additionalProperties": {
                  "anyOf": [
                    { "$ref": "#" },
                    { "$ref": "#/definitions/stringArray" },
                  ],
                },
              },
              "propertyNames": { "$ref": "#" },
              "const": true,
              "enum": {
                "type": "array",
                "items": true,
                "minItems": 1,
                "uniqueItems": true,
              },
              "type": {
                "anyOf": [
                  { "$ref": "#/definitions/simpleTypes" },
                  {
                    "type": "array",
                    "items": { "$ref": "#/definitions/simpleTypes" },
                    "minItems": 1,
                    "uniqueItems": true,
                  },
                ],
              },
              "format": { "type": "string" },
              "contentMediaType": { "type": "string" },
              "contentEncoding": { "type": "string" },
              "if": { "$ref": "#" },
              "then": { "$ref": "#" },
              "else": { "$ref": "#" },
              "allOf": { "$ref": "#/definitions/schemaArray" },
              "anyOf": { "$ref": "#/definitions/schemaArray" },
              "oneOf": { "$ref": "#/definitions/schemaArray" },
              "not": { "$ref": "#" },
            },
            "default": true,
          };
        }, {}],
        42: [function (require, module, exports) {
          var isArray = Array.isArray;
          var keyList = Object.keys;
          var hasProp = Object.prototype.hasOwnProperty;

          module.exports = function equal(a, b) {
            if (a === b) return true;

            if (a && b && typeof a == "object" && typeof b == "object") {
              var arrA = isArray(a),
                arrB = isArray(b),
                i,
                length,
                key;

              if (arrA && arrB) {
                length = a.length;
                if (length != b.length) return false;
                for (i = length; i-- !== 0;) {
                  if (!equal(a[i], b[i])) return false;
                }
                return true;
              }

              if (arrA != arrB) return false;

              var dateA = a instanceof Date,
                dateB = b instanceof Date;
              if (dateA != dateB) return false;
              if (dateA && dateB) return a.getTime() == b.getTime();

              var regexpA = a instanceof RegExp,
                regexpB = b instanceof RegExp;
              if (regexpA != regexpB) return false;
              if (regexpA && regexpB) return a.toString() == b.toString();

              var keys = keyList(a);
              length = keys.length;

              if (length !== keyList(b).length) {
                return false;
              }

              for (i = length; i-- !== 0;) {
                if (!hasProp.call(b, keys[i])) return false;
              }

              for (i = length; i-- !== 0;) {
                key = keys[i];
                if (!equal(a[key], b[key])) return false;
              }

              return true;
            }

            return a !== a && b !== b;
          };
        }, {}],
        43: [function (require, module, exports) {
          module.exports = function (data, opts) {
            if (!opts) opts = {};
            if (typeof opts === "function") opts = { cmp: opts };
            var cycles = (typeof opts.cycles === "boolean")
              ? opts.cycles
              : false;

            var cmp = opts.cmp && (function (f) {
              return function (node) {
                return function (a, b) {
                  var aobj = { key: a, value: node[a] };
                  var bobj = { key: b, value: node[b] };
                  return f(aobj, bobj);
                };
              };
            })(opts.cmp);

            var seen = [];
            return (function stringify(node) {
              if (node && node.toJSON && typeof node.toJSON === "function") {
                node = node.toJSON();
              }

              if (node === undefined) return;
              if (typeof node == "number") {return isFinite(node) ? "" + node
                : "null";}
              if (typeof node !== "object") return JSON.stringify(node);

              var i, out;
              if (Array.isArray(node)) {
                out = "[";
                for (i = 0; i < node.length; i++) {
                  if (i) out += ",";
                  out += stringify(node[i]) || "null";
                }
                return out + "]";
              }

              if (node === null) return "null";

              if (seen.indexOf(node) !== -1) {
                if (cycles) return JSON.stringify("__cycle__");
                throw new TypeError("Converting circular structure to JSON");
              }

              var seenIndex = seen.push(node) - 1;
              var keys = Object.keys(node).sort(cmp && cmp(node));
              out = "";
              for (i = 0; i < keys.length; i++) {
                var key = keys[i];
                var value = stringify(node[key]);

                if (!value) continue;
                if (out) out += ",";
                out += JSON.stringify(key) + ":" + value;
              }
              seen.splice(seenIndex, 1);
              return "{" + out + "}";
            })(data);
          };
        }, {}],
        44: [function (require, module, exports) {
          var traverse = module.exports = function (schema, opts, cb) {
            // Legacy support for v0.3.1 and earlier.
            if (typeof opts == "function") {
              cb = opts;
              opts = {};
            }

            cb = opts.cb || cb;
            var pre = (typeof cb == "function") ? cb : cb.pre || function () {};
            var post = cb.post || function () {};

            _traverse(opts, pre, post, schema, "", schema);
          };

          traverse.keywords = {
            additionalItems: true,
            items: true,
            contains: true,
            additionalProperties: true,
            propertyNames: true,
            not: true,
          };

          traverse.arrayKeywords = {
            items: true,
            allOf: true,
            anyOf: true,
            oneOf: true,
          };

          traverse.propsKeywords = {
            definitions: true,
            properties: true,
            patternProperties: true,
            dependencies: true,
          };

          traverse.skipKeywords = {
            default: true,
            enum: true,
            const: true,
            required: true,
            maximum: true,
            minimum: true,
            exclusiveMaximum: true,
            exclusiveMinimum: true,
            multipleOf: true,
            maxLength: true,
            minLength: true,
            pattern: true,
            format: true,
            maxItems: true,
            minItems: true,
            uniqueItems: true,
            maxProperties: true,
            minProperties: true,
          };

          function _traverse(
            opts,
            pre,
            post,
            schema,
            jsonPtr,
            rootSchema,
            parentJsonPtr,
            parentKeyword,
            parentSchema,
            keyIndex,
          ) {
            if (schema && typeof schema == "object" && !Array.isArray(schema)) {
              pre(
                schema,
                jsonPtr,
                rootSchema,
                parentJsonPtr,
                parentKeyword,
                parentSchema,
                keyIndex,
              );
              for (var key in schema) {
                var sch = schema[key];
                if (Array.isArray(sch)) {
                  if (key in traverse.arrayKeywords) {
                    for (var i = 0; i < sch.length; i++) {
                      _traverse(
                        opts,
                        pre,
                        post,
                        sch[i],
                        jsonPtr + "/" + key + "/" + i,
                        rootSchema,
                        jsonPtr,
                        key,
                        schema,
                        i,
                      );
                    }
                  }
                } else if (key in traverse.propsKeywords) {
                  if (sch && typeof sch == "object") {
                    for (var prop in sch) {
                      _traverse(
                        opts,
                        pre,
                        post,
                        sch[prop],
                        jsonPtr + "/" + key + "/" + escapeJsonPtr(prop),
                        rootSchema,
                        jsonPtr,
                        key,
                        schema,
                        prop,
                      );
                    }
                  }
                } else if (
                  key in traverse.keywords ||
                  (opts.allKeys && !(key in traverse.skipKeywords))
                ) {
                  _traverse(
                    opts,
                    pre,
                    post,
                    sch,
                    jsonPtr + "/" + key,
                    rootSchema,
                    jsonPtr,
                    key,
                    schema,
                  );
                }
              }
              post(
                schema,
                jsonPtr,
                rootSchema,
                parentJsonPtr,
                parentKeyword,
                parentSchema,
                keyIndex,
              );
            }
          }

          function escapeJsonPtr(str) {
            return str.replace(/~/g, "~0").replace(/\//g, "~1");
          }
        }, {}],
        45: [function (require, module, exports) {
          /** @license URI.js v4.2.1 (c) 2011 Gary Court. License: http://github.com/garycourt/uri-js */
          (function (global, factory) {
            typeof exports === "object" && typeof module !== "undefined"
              ? factory(exports)
              : (factory((global.URI = global.URI || {})));
          }(
            this,
            (function (exports) {
              function merge() {
                for (
                  var _len = arguments.length, sets = Array(_len), _key = 0;
                  _key < _len;
                  _key++
                ) {
                  sets[_key] = arguments[_key];
                }

                if (sets.length > 1) {
                  sets[0] = sets[0].slice(0, -1);
                  var xl = sets.length - 1;
                  for (var x = 1; x < xl; ++x) {
                    sets[x] = sets[x].slice(1, -1);
                  }
                  sets[xl] = sets[xl].slice(1);
                  return sets.join("");
                } else {
                  return sets[0];
                }
              }
              function subexp(str) {
                return "(?:" + str + ")";
              }
              function typeOf(o) {
                return o === undefined ? "undefined" : o === null
                ? "null"
                : Object.prototype.toString.call(o).split(" ").pop().split("]")
                  .shift().toLowerCase();
              }
              function toUpperCase(str) {
                return str.toUpperCase();
              }
              function toArray(obj) {
                return obj !== undefined && obj !== null
                  ? obj instanceof Array
                    ? obj
                    : typeof obj.length !== "number" || obj.split ||
                      obj.setInterval || obj.call
                    ? [obj]
                    : Array.prototype.slice.call(obj)
                  : [];
              }
              function assign(target, source) {
                var obj = target;
                if (source) {
                  for (var key in source) {
                    obj[key] = source[key];
                  }
                }
                return obj;
              }

              function buildExps(isIRI) {
                var ALPHA$$ = "[A-Za-z]",
                  DIGIT$$ = "[0-9]",
                  HEXDIG$$ = merge(DIGIT$$, "[A-Fa-f]"),
                  PCT_ENCODED$ = subexp(
                    subexp(
                      "%[EFef]" + HEXDIG$$ + "%" + HEXDIG$$ + HEXDIG$$ + "%" +
                        HEXDIG$$ + HEXDIG$$,
                    ) + "|" +
                      subexp(
                        "%[89A-Fa-f]" + HEXDIG$$ + "%" + HEXDIG$$ + HEXDIG$$,
                      ) + "|" + subexp("%" + HEXDIG$$ + HEXDIG$$),
                  ),
                  //expanded
                  GEN_DELIMS$$ = "[\\:\\/\\?\\#\\[\\]\\@]",
                  SUB_DELIMS$$ = "[\\!\\$\\&\\'\\(\\)\\*\\+\\,\\;\\=]",
                  RESERVED$$ = merge(GEN_DELIMS$$, SUB_DELIMS$$),
                  UCSCHAR$$ = isIRI
                    ? "[\\xA0-\\u200D\\u2010-\\u2029\\u202F-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFEF]"
                    : "[]",
                  //subset, excludes bidi control characters
                  IPRIVATE$$ = isIRI ? "[\\uE000-\\uF8FF]" : "[]",
                  //subset
                  UNRESERVED$$ = merge(
                    ALPHA$$,
                    DIGIT$$,
                    "[\\-\\.\\_\\~]",
                    UCSCHAR$$,
                  ),
                  SCHEME$ = subexp(
                    ALPHA$$ + merge(ALPHA$$, DIGIT$$, "[\\+\\-\\.]") + "*",
                  ),
                  USERINFO$ = subexp(
                    subexp(
                      PCT_ENCODED$ + "|" +
                        merge(UNRESERVED$$, SUB_DELIMS$$, "[\\:]"),
                    ) + "*",
                  ),
                  DEC_OCTET_RELAXED$ = subexp(
                    subexp("25[0-5]") + "|" + subexp("2[0-4]" + DIGIT$$) + "|" +
                      subexp("1" + DIGIT$$ + DIGIT$$) + "|" +
                      subexp("0?[1-9]" + DIGIT$$) + "|0?0?" + DIGIT$$,
                  ),
                  //relaxed parsing rules
                  IPV4ADDRESS$ = subexp(
                    DEC_OCTET_RELAXED$ + "\\." + DEC_OCTET_RELAXED$ + "\\." +
                      DEC_OCTET_RELAXED$ + "\\." + DEC_OCTET_RELAXED$,
                  ),
                  H16$ = subexp(HEXDIG$$ + "{1,4}"),
                  LS32$ = subexp(
                    subexp(H16$ + "\\:" + H16$) + "|" + IPV4ADDRESS$,
                  ),
                  IPV6ADDRESS1$ = subexp(subexp(H16$ + "\\:") + "{6}" + LS32$),
                  //                           6( h16 ":" ) ls32
                  IPV6ADDRESS2$ = subexp(
                    "\\:\\:" + subexp(H16$ + "\\:") + "{5}" + LS32$,
                  ),
                  //                      "::" 5( h16 ":" ) ls32
                  IPV6ADDRESS3$ = subexp(
                    subexp(H16$) + "?\\:\\:" + subexp(H16$ + "\\:") + "{4}" +
                      LS32$,
                  ),
                  //[               h16 ] "::" 4( h16 ":" ) ls32
                  IPV6ADDRESS4$ = subexp(
                    subexp(subexp(H16$ + "\\:") + "{0,1}" + H16$) + "?\\:\\:" +
                      subexp(H16$ + "\\:") + "{3}" + LS32$,
                  ),
                  //[ *1( h16 ":" ) h16 ] "::" 3( h16 ":" ) ls32
                  IPV6ADDRESS5$ = subexp(
                    subexp(subexp(H16$ + "\\:") + "{0,2}" + H16$) + "?\\:\\:" +
                      subexp(H16$ + "\\:") + "{2}" + LS32$,
                  ),
                  //[ *2( h16 ":" ) h16 ] "::" 2( h16 ":" ) ls32
                  IPV6ADDRESS6$ = subexp(
                    subexp(subexp(H16$ + "\\:") + "{0,3}" + H16$) + "?\\:\\:" +
                      H16$ + "\\:" + LS32$,
                  ),
                  //[ *3( h16 ":" ) h16 ] "::"    h16 ":"   ls32
                  IPV6ADDRESS7$ = subexp(
                    subexp(subexp(H16$ + "\\:") + "{0,4}" + H16$) + "?\\:\\:" +
                      LS32$,
                  ),
                  //[ *4( h16 ":" ) h16 ] "::"              ls32
                  IPV6ADDRESS8$ = subexp(
                    subexp(subexp(H16$ + "\\:") + "{0,5}" + H16$) + "?\\:\\:" +
                      H16$,
                  ),
                  //[ *5( h16 ":" ) h16 ] "::"              h16
                  IPV6ADDRESS9$ = subexp(
                    subexp(subexp(H16$ + "\\:") + "{0,6}" + H16$) + "?\\:\\:",
                  ),
                  //[ *6( h16 ":" ) h16 ] "::"
                  IPV6ADDRESS$ = subexp(
                    [
                      IPV6ADDRESS1$,
                      IPV6ADDRESS2$,
                      IPV6ADDRESS3$,
                      IPV6ADDRESS4$,
                      IPV6ADDRESS5$,
                      IPV6ADDRESS6$,
                      IPV6ADDRESS7$,
                      IPV6ADDRESS8$,
                      IPV6ADDRESS9$,
                    ].join("|"),
                  ),
                  ZONEID$ = subexp(
                    subexp(UNRESERVED$$ + "|" + PCT_ENCODED$) + "+",
                  ),
                  //RFC 6874, with relaxed parsing rules
                  IPVFUTURE$ = subexp(
                    "[vV]" + HEXDIG$$ + "+\\." +
                      merge(UNRESERVED$$, SUB_DELIMS$$, "[\\:]") + "+",
                  ),
                  //RFC 6874
                  REG_NAME$ = subexp(
                    subexp(
                      PCT_ENCODED$ + "|" + merge(UNRESERVED$$, SUB_DELIMS$$),
                    ) + "*",
                  ),
                  PCHAR$ = subexp(
                    PCT_ENCODED$ + "|" +
                      merge(UNRESERVED$$, SUB_DELIMS$$, "[\\:\\@]"),
                  ),
                  SEGMENT_NZ_NC$ = subexp(
                    subexp(
                      PCT_ENCODED$ + "|" +
                        merge(UNRESERVED$$, SUB_DELIMS$$, "[\\@]"),
                    ) + "+",
                  ),
                  QUERY$ = subexp(
                    subexp(PCHAR$ + "|" + merge("[\\/\\?]", IPRIVATE$$)) + "*",
                  );
                return {
                  NOT_SCHEME: new RegExp(
                    merge("[^]", ALPHA$$, DIGIT$$, "[\\+\\-\\.]"),
                    "g",
                  ),
                  NOT_USERINFO: new RegExp(
                    merge("[^\\%\\:]", UNRESERVED$$, SUB_DELIMS$$),
                    "g",
                  ),
                  NOT_HOST: new RegExp(
                    merge("[^\\%\\[\\]\\:]", UNRESERVED$$, SUB_DELIMS$$),
                    "g",
                  ),
                  NOT_PATH: new RegExp(
                    merge("[^\\%\\/\\:\\@]", UNRESERVED$$, SUB_DELIMS$$),
                    "g",
                  ),
                  NOT_PATH_NOSCHEME: new RegExp(
                    merge("[^\\%\\/\\@]", UNRESERVED$$, SUB_DELIMS$$),
                    "g",
                  ),
                  NOT_QUERY: new RegExp(
                    merge(
                      "[^\\%]",
                      UNRESERVED$$,
                      SUB_DELIMS$$,
                      "[\\:\\@\\/\\?]",
                      IPRIVATE$$,
                    ),
                    "g",
                  ),
                  NOT_FRAGMENT: new RegExp(
                    merge(
                      "[^\\%]",
                      UNRESERVED$$,
                      SUB_DELIMS$$,
                      "[\\:\\@\\/\\?]",
                    ),
                    "g",
                  ),
                  ESCAPE: new RegExp(
                    merge("[^]", UNRESERVED$$, SUB_DELIMS$$),
                    "g",
                  ),
                  UNRESERVED: new RegExp(UNRESERVED$$, "g"),
                  OTHER_CHARS: new RegExp(
                    merge("[^\\%]", UNRESERVED$$, RESERVED$$),
                    "g",
                  ),
                  PCT_ENCODED: new RegExp(PCT_ENCODED$, "g"),
                  IPV4ADDRESS: new RegExp("^(" + IPV4ADDRESS$ + ")$"),
                  IPV6ADDRESS: new RegExp(
                    "^\\[?(" + IPV6ADDRESS$ + ")" +
                      subexp(
                        subexp("\\%25|\\%(?!" + HEXDIG$$ + "{2})") + "(" +
                          ZONEID$ + ")",
                      ) + "?\\]?$",
                  ), //RFC 6874, with relaxed parsing rules
                };
              }
              var URI_PROTOCOL = buildExps(false);

              var IRI_PROTOCOL = buildExps(true);

              var slicedToArray = function () {
                function sliceIterator(arr, i) {
                  var _arr = [];
                  var _n = true;
                  var _d = false;
                  var _e = undefined;

                  try {
                    for (
                      var _i = arr[Symbol.iterator](), _s;
                      !(_n = (_s = _i.next()).done);
                      _n = true
                    ) {
                      _arr.push(_s.value);

                      if (i && _arr.length === i)break;
                    }
                  } catch (err) {
                    _d = true;
                    _e = err;
                  } finally {
                    try {
                      if (!_n && _i["return"])_i["return"]();
                    } finally {
                      if (_d) throw _e;
                    }
                  }

                  return _arr;
                }

                return function (arr, i) {
                  if (Array.isArray(arr)) {
                    return arr;
                  } else if (Symbol.iterator in Object(arr)) {
                    return sliceIterator(arr, i);
                  } else {
                    throw new TypeError(
                      "Invalid attempt to destructure non-iterable instance",
                    );
                  }
                };
              }();

              var toConsumableArray = function (arr) {
                if (Array.isArray(arr)) {
                  for (
                    var i = 0, arr2 = Array(arr.length); i < arr.length; i++
                  ) {
                    arr2[i] = arr[i];
                  }

                  return arr2;
                } else {
                  return Array.from(arr);
                }
              };

              /** Highest positive signed 32-bit float value */

              var maxInt = 2147483647; // aka. 0x7FFFFFFF or 2^31-1

              /** Bootstring parameters */
              var base = 36;
              var tMin = 1;
              var tMax = 26;
              var skew = 38;
              var damp = 700;
              var initialBias = 72;
              var initialN = 128; // 0x80
              var delimiter = "-"; // '\x2D'

              /** Regular expressions */
              var regexPunycode = /^xn--/;
              var regexNonASCII = /[^\0-\x7E]/; // non-ASCII chars
              var regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g; // RFC 3490 separators

              /** Error messages */
              var errors = {
                "overflow": "Overflow: input needs wider integers to process",
                "not-basic": "Illegal input >= 0x80 (not a basic code point)",
                "invalid-input": "Invalid input",
              };

              /** Convenience shortcuts */
              var baseMinusTMin = base - tMin;
              var floor = Math.floor;
              var stringFromCharCode = String.fromCharCode;

              /*--------------------------------------------------------------------------*/

              /**
 * A generic error utility function.
 * @private
 * @param {String} type The error type.
 * @returns {Error} Throws a `RangeError` with the applicable error message.
 */
              function error$1(type) {
                throw new RangeError(errors[type]);
              }

              /**
 * A generic `Array#map` utility function.
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} callback The function that gets called for every array
 * item.
 * @returns {Array} A new array of values returned by the callback function.
 */
              function map(array, fn) {
                var result = [];
                var length = array.length;
                while (length--) {
                  result[length] = fn(array[length]);
                }
                return result;
              }

              /**
 * A simple `Array#map`-like wrapper to work with domain name strings or email
 * addresses.
 * @private
 * @param {String} domain The domain name or email address.
 * @param {Function} callback The function that gets called for every
 * character.
 * @returns {Array} A new string of characters returned by the callback
 * function.
 */
              function mapDomain(string, fn) {
                var parts = string.split("@");
                var result = "";
                if (parts.length > 1) {
                  // In email addresses, only the domain name should be punycoded. Leave
                  // the local part (i.e. everything up to `@`) intact.
                  result = parts[0] + "@";
                  string = parts[1];
                }
                // Avoid `split(regex)` for IE8 compatibility. See #17.
                string = string.replace(regexSeparators, "\x2E");
                var labels = string.split(".");
                var encoded = map(labels, fn).join(".");
                return result + encoded;
              }

              /**
 * Creates an array containing the numeric code points of each Unicode
 * character in the string. While JavaScript uses UCS-2 internally,
 * this function will convert a pair of surrogate halves (each of which
 * UCS-2 exposes as separate characters) into a single code point,
 * matching UTF-16.
 * @see `punycode.ucs2.encode`
 * @see <https://mathiasbynens.be/notes/javascript-encoding>
 * @memberOf punycode.ucs2
 * @name decode
 * @param {String} string The Unicode input string (UCS-2).
 * @returns {Array} The new array of code points.
 */
              function ucs2decode(string) {
                var output = [];
                var counter = 0;
                var length = string.length;
                while (counter < length) {
                  var value = string.charCodeAt(counter++);
                  if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
                    // It's a high surrogate, and there is a next character.
                    var extra = string.charCodeAt(counter++);
                    if ((extra & 0xFC00) == 0xDC00) {
                      // Low surrogate.
                      output.push(
                        ((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000,
                      );
                    } else {
                      // It's an unmatched surrogate; only append this code unit, in case the
                      // next code unit is the high surrogate of a surrogate pair.
                      output.push(value);
                      counter--;
                    }
                  } else {
                    output.push(value);
                  }
                }
                return output;
              }

              /**
 * Creates a string based on an array of numeric code points.
 * @see `punycode.ucs2.decode`
 * @memberOf punycode.ucs2
 * @name encode
 * @param {Array} codePoints The array of numeric code points.
 * @returns {String} The new Unicode string (UCS-2).
 */
              var ucs2encode = function ucs2encode(array) {
                return String.fromCodePoint.apply(
                  String,
                  toConsumableArray(array),
                );
              };

              /**
 * Converts a basic code point into a digit/integer.
 * @see `digitToBasic()`
 * @private
 * @param {Number} codePoint The basic numeric code point value.
 * @returns {Number} The numeric value of a basic code point (for use in
 * representing integers) in the range `0` to `base - 1`, or `base` if
 * the code point does not represent a value.
 */
              var basicToDigit = function basicToDigit(codePoint) {
                if (codePoint - 0x30 < 0x0A) {
                  return codePoint - 0x16;
                }
                if (codePoint - 0x41 < 0x1A) {
                  return codePoint - 0x41;
                }
                if (codePoint - 0x61 < 0x1A) {
                  return codePoint - 0x61;
                }
                return base;
              };

              /**
 * Converts a digit/integer into a basic code point.
 * @see `basicToDigit()`
 * @private
 * @param {Number} digit The numeric value of a basic code point.
 * @returns {Number} The basic code point whose value (when used for
 * representing integers) is `digit`, which needs to be in the range
 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
 * used; else, the lowercase form is used. The behavior is undefined
 * if `flag` is non-zero and `digit` has no uppercase form.
 */
              var digitToBasic = function digitToBasic(digit, flag) {
                //  0..25 map to ASCII a..z or A..Z
                // 26..35 map to ASCII 0..9
                return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
              };

              /**
 * Bias adaptation function as per section 3.4 of RFC 3492.
 * https://tools.ietf.org/html/rfc3492#section-3.4
 * @private
 */
              var adapt = function adapt(delta, numPoints, firstTime) {
                var k = 0;
                delta = firstTime ? floor(delta / damp) : delta >> 1;
                delta += floor(delta / numPoints);
                for (
                  ;
                  /* no initialization */ delta > baseMinusTMin * tMax >> 1;
                  k += base
                ) {
                  delta = floor(delta / baseMinusTMin);
                }
                return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
              };

              /**
 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
 * symbols.
 * @memberOf punycode
 * @param {String} input The Punycode string of ASCII-only symbols.
 * @returns {String} The resulting string of Unicode symbols.
 */
              var decode = function decode(input) {
                // Don't use UCS-2.
                var output = [];
                var inputLength = input.length;
                var i = 0;
                var n = initialN;
                var bias = initialBias;

                // Handle the basic code points: let `basic` be the number of input code
                // points before the last delimiter, or `0` if there is none, then copy
                // the first basic code points to the output.

                var basic = input.lastIndexOf(delimiter);
                if (basic < 0) {
                  basic = 0;
                }

                for (var j = 0; j < basic; ++j) {
                  // if it's not a basic code point
                  if (input.charCodeAt(j) >= 0x80) {
                    error$1("not-basic");
                  }
                  output.push(input.charCodeAt(j));
                }

                // Main decoding loop: start just after the last delimiter if any basic code
                // points were copied; start at the beginning otherwise.

                for (
                  var index = basic > 0
                    ? basic + 1
                    : 0;
                  index < inputLength;
                ) {
                  /* no final expression */ // `index` is the index of the next character to be consumed.
                  // Decode a generalized variable-length integer into `delta`,
                  // which gets added to `i`. The overflow checking is easier
                  // if we increase `i` as we go, then subtract off its starting
                  // value at the end to obtain `delta`.
                  var oldi = i;
                  for (var w = 1, k = base;; /* no condition */ k += base) {
                    if (index >= inputLength) {
                      error$1("invalid-input");
                    }

                    var digit = basicToDigit(input.charCodeAt(index++));

                    if (digit >= base || digit > floor((maxInt - i) / w)) {
                      error$1("overflow");
                    }

                    i += digit * w;
                    var t = k <= bias
                      ? tMin
                      : k >= bias + tMax
                      ? tMax
                      : k - bias;

                    if (digit < t) {
                      break;
                    }

                    var baseMinusT = base - t;
                    if (w > floor(maxInt / baseMinusT)) {
                      error$1("overflow");
                    }

                    w *= baseMinusT;
                  }

                  var out = output.length + 1;
                  bias = adapt(i - oldi, out, oldi == 0);

                  // `i` was supposed to wrap around from `out` to `0`,
                  // incrementing `n` each time, so we'll fix that now:
                  if (floor(i / out) > maxInt - n) {
                    error$1("overflow");
                  }

                  n += floor(i / out);
                  i %= out;

                  // Insert `n` at position `i` of the output.
                  output.splice(i++, 0, n);
                }

                return String.fromCodePoint.apply(String, output);
              };

              /**
 * Converts a string of Unicode symbols (e.g. a domain name label) to a
 * Punycode string of ASCII-only symbols.
 * @memberOf punycode
 * @param {String} input The string of Unicode symbols.
 * @returns {String} The resulting Punycode string of ASCII-only symbols.
 */
              var encode = function encode(input) {
                var output = [];

                // Convert the input in UCS-2 to an array of Unicode code points.
                input = ucs2decode(input);

                // Cache the length.
                var inputLength = input.length;

                // Initialize the state.
                var n = initialN;
                var delta = 0;
                var bias = initialBias;

                // Handle the basic code points.
                var _iteratorNormalCompletion = true;
                var _didIteratorError = false;
                var _iteratorError = undefined;

                try {
                  for (
                    var _iterator = input[Symbol.iterator](), _step;
                    !(_iteratorNormalCompletion =
                      (_step = _iterator.next()).done);
                    _iteratorNormalCompletion = true
                  ) {
                    var _currentValue2 = _step.value;

                    if (_currentValue2 < 0x80) {
                      output.push(stringFromCharCode(_currentValue2));
                    }
                  }
                } catch (err) {
                  _didIteratorError = true;
                  _iteratorError = err;
                } finally {
                  try {
                    if (!_iteratorNormalCompletion && _iterator.return) {
                      _iterator.return();
                    }
                  } finally {
                    if (_didIteratorError) {
                      throw _iteratorError;
                    }
                  }
                }

                var basicLength = output.length;
                var handledCPCount = basicLength;

                // `handledCPCount` is the number of code points that have been handled;
                // `basicLength` is the number of basic code points.

                // Finish the basic string with a delimiter unless it's empty.
                if (basicLength) {
                  output.push(delimiter);
                }

                // Main encoding loop:
                while (handledCPCount < inputLength) {
                  // All non-basic code points < n have been handled already. Find the next
                  // larger one:
                  var m = maxInt;
                  var _iteratorNormalCompletion2 = true;
                  var _didIteratorError2 = false;
                  var _iteratorError2 = undefined;

                  try {
                    for (
                      var _iterator2 = input[Symbol.iterator](), _step2;
                      !(_iteratorNormalCompletion2 =
                        (_step2 = _iterator2.next()).done);
                      _iteratorNormalCompletion2 = true
                    ) {
                      var currentValue = _step2.value;

                      if (currentValue >= n && currentValue < m) {
                        m = currentValue;
                      }
                    }

                    // Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
                    // but guard against overflow.
                  } catch (err) {
                    _didIteratorError2 = true;
                    _iteratorError2 = err;
                  } finally {
                    try {
                      if (!_iteratorNormalCompletion2 && _iterator2.return) {
                        _iterator2.return();
                      }
                    } finally {
                      if (_didIteratorError2) {
                        throw _iteratorError2;
                      }
                    }
                  }

                  var handledCPCountPlusOne = handledCPCount + 1;
                  if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
                    error$1("overflow");
                  }

                  delta += (m - n) * handledCPCountPlusOne;
                  n = m;

                  var _iteratorNormalCompletion3 = true;
                  var _didIteratorError3 = false;
                  var _iteratorError3 = undefined;

                  try {
                    for (
                      var _iterator3 = input[Symbol.iterator](), _step3;
                      !(_iteratorNormalCompletion3 =
                        (_step3 = _iterator3.next()).done);
                      _iteratorNormalCompletion3 = true
                    ) {
                      var _currentValue = _step3.value;

                      if (_currentValue < n && ++delta > maxInt) {
                        error$1("overflow");
                      }
                      if (_currentValue == n) {
                        // Represent delta as a generalized variable-length integer.
                        var q = delta;
                        for (var k = base;; /* no condition */ k += base) {
                          var t = k <= bias
                            ? tMin
                            : k >= bias + tMax
                            ? tMax
                            : k - bias;
                          if (q < t) {
                            break;
                          }
                          var qMinusT = q - t;
                          var baseMinusT = base - t;
                          output.push(
                            stringFromCharCode(
                              digitToBasic(t + qMinusT % baseMinusT, 0),
                            ),
                          );
                          q = floor(qMinusT / baseMinusT);
                        }

                        output.push(stringFromCharCode(digitToBasic(q, 0)));
                        bias = adapt(
                          delta,
                          handledCPCountPlusOne,
                          handledCPCount == basicLength,
                        );
                        delta = 0;
                        ++handledCPCount;
                      }
                    }
                  } catch (err) {
                    _didIteratorError3 = true;
                    _iteratorError3 = err;
                  } finally {
                    try {
                      if (!_iteratorNormalCompletion3 && _iterator3.return) {
                        _iterator3.return();
                      }
                    } finally {
                      if (_didIteratorError3) {
                        throw _iteratorError3;
                      }
                    }
                  }

                  ++delta;
                  ++n;
                }
                return output.join("");
              };

              /**
 * Converts a Punycode string representing a domain name or an email address
 * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
 * it doesn't matter if you call it on a string that has already been
 * converted to Unicode.
 * @memberOf punycode
 * @param {String} input The Punycoded domain name or email address to
 * convert to Unicode.
 * @returns {String} The Unicode representation of the given Punycode
 * string.
 */
              var toUnicode = function toUnicode(input) {
                return mapDomain(input, function (string) {
                  return regexPunycode.test(string)
                    ? decode(string.slice(4).toLowerCase())
                    : string;
                });
              };

              /**
 * Converts a Unicode string representing a domain name or an email address to
 * Punycode. Only the non-ASCII parts of the domain name will be converted,
 * i.e. it doesn't matter if you call it with a domain that's already in
 * ASCII.
 * @memberOf punycode
 * @param {String} input The domain name or email address to convert, as a
 * Unicode string.
 * @returns {String} The Punycode representation of the given domain name or
 * email address.
 */
              var toASCII = function toASCII(input) {
                return mapDomain(input, function (string) {
                  return regexNonASCII.test(string)
                    ? "xn--" + encode(string)
                    : string;
                });
              };

              /*--------------------------------------------------------------------------*/

              /** Define the public API */
              var punycode = {
                /**
  * A string representing the current Punycode.js version number.
  * @memberOf punycode
  * @type String
  */
                "version": "2.1.0",
                /**
  * An object of methods to convert from JavaScript's internal character
  * representation (UCS-2) to Unicode code points, and back.
  * @see <https://mathiasbynens.be/notes/javascript-encoding>
  * @memberOf punycode
  * @type Object
  */
                "ucs2": {
                  "decode": ucs2decode,
                  "encode": ucs2encode,
                },
                "decode": decode,
                "encode": encode,
                "toASCII": toASCII,
                "toUnicode": toUnicode,
              };

              /**
 * URI.js
 *
 * @fileoverview An RFC 3986 compliant, scheme extendable URI parsing/validating/resolving library for JavaScript.
 * @author <a href="mailto:gary.court@gmail.com">Gary Court</a>
 * @see http://github.com/garycourt/uri-js
 */
              /**
 * Copyright 2011 Gary Court. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are
 * permitted provided that the following conditions are met:
 *
 *    1. Redistributions of source code must retain the above copyright notice, this list of
 *       conditions and the following disclaimer.
 *
 *    2. Redistributions in binary form must reproduce the above copyright notice, this list
 *       of conditions and the following disclaimer in the documentation and/or other materials
 *       provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY GARY COURT ``AS IS'' AND ANY EXPRESS OR IMPLIED
 * WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
 * FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL GARY COURT OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
 * ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
 * ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * The views and conclusions contained in the software and documentation are those of the
 * authors and should not be interpreted as representing official policies, either expressed
 * or implied, of Gary Court.
 */
              var SCHEMES = {};
              function pctEncChar(chr) {
                var c = chr.charCodeAt(0);
                var e = void 0;
                if (c < 16) e = "%0" + c.toString(16).toUpperCase();
                else if (c < 128) e = "%" + c.toString(16).toUpperCase();
                else if (c < 2048) {
                  e = "%" + (c >> 6 | 192).toString(16).toUpperCase() + "%" +
                    (c & 63 | 128).toString(16).toUpperCase();
                } else {
                  e = "%" + (c >> 12 | 224).toString(16).toUpperCase() + "%" +
                    (c >> 6 & 63 | 128).toString(16).toUpperCase() + "%" +
                    (c & 63 | 128).toString(16).toUpperCase();
                }
                return e;
              }
              function pctDecChars(str) {
                var newStr = "";
                var i = 0;
                var il = str.length;
                while (i < il) {
                  var c = parseInt(str.substr(i + 1, 2), 16);
                  if (c < 128) {
                    newStr += String.fromCharCode(c);
                    i += 3;
                  } else if (c >= 194 && c < 224) {
                    if (il - i >= 6) {
                      var c2 = parseInt(str.substr(i + 4, 2), 16);
                      newStr += String.fromCharCode((c & 31) << 6 | c2 & 63);
                    } else {
                      newStr += str.substr(i, 6);
                    }
                    i += 6;
                  } else if (c >= 224) {
                    if (il - i >= 9) {
                      var _c = parseInt(str.substr(i + 4, 2), 16);
                      var c3 = parseInt(str.substr(i + 7, 2), 16);
                      newStr += String.fromCharCode(
                        (c & 15) << 12 | (_c & 63) << 6 | c3 & 63,
                      );
                    } else {
                      newStr += str.substr(i, 9);
                    }
                    i += 9;
                  } else {
                    newStr += str.substr(i, 3);
                    i += 3;
                  }
                }
                return newStr;
              }
              function _normalizeComponentEncoding(components, protocol) {
                function decodeUnreserved(str) {
                  var decStr = pctDecChars(str);
                  return !decStr.match(protocol.UNRESERVED) ? str : decStr;
                }
                if (components.scheme) {
                  components.scheme = String(components.scheme).replace(
                    protocol.PCT_ENCODED,
                    decodeUnreserved,
                  ).toLowerCase().replace(protocol.NOT_SCHEME, "");
                }
                if (components.userinfo !== undefined) {
                  components.userinfo = String(components.userinfo).replace(
                    protocol.PCT_ENCODED,
                    decodeUnreserved,
                  ).replace(protocol.NOT_USERINFO, pctEncChar).replace(
                    protocol.PCT_ENCODED,
                    toUpperCase,
                  );
                }
                if (components.host !== undefined) {
                  components.host = String(components.host).replace(
                    protocol.PCT_ENCODED,
                    decodeUnreserved,
                  ).toLowerCase().replace(protocol.NOT_HOST, pctEncChar)
                    .replace(protocol.PCT_ENCODED, toUpperCase);
                }
                if (components.path !== undefined) {
                  components.path = String(components.path).replace(
                    protocol.PCT_ENCODED,
                    decodeUnreserved,
                  ).replace(
                    components.scheme
                      ? protocol.NOT_PATH
                      : protocol.NOT_PATH_NOSCHEME,
                    pctEncChar,
                  ).replace(protocol.PCT_ENCODED, toUpperCase);
                }
                if (components.query !== undefined) {
                  components.query = String(components.query).replace(
                    protocol.PCT_ENCODED,
                    decodeUnreserved,
                  ).replace(protocol.NOT_QUERY, pctEncChar).replace(
                    protocol.PCT_ENCODED,
                    toUpperCase,
                  );
                }
                if (components.fragment !== undefined) {
                  components.fragment = String(components.fragment).replace(
                    protocol.PCT_ENCODED,
                    decodeUnreserved,
                  ).replace(protocol.NOT_FRAGMENT, pctEncChar).replace(
                    protocol.PCT_ENCODED,
                    toUpperCase,
                  );
                }
                return components;
              }

              function _stripLeadingZeros(str) {
                return str.replace(/^0*(.*)/, "$1") || "0";
              }
              function _normalizeIPv4(host, protocol) {
                var matches = host.match(protocol.IPV4ADDRESS) || [];

                var _matches = slicedToArray(matches, 2),
                  address = _matches[1];

                if (address) {
                  return address.split(".").map(_stripLeadingZeros).join(".");
                } else {
                  return host;
                }
              }
              function _normalizeIPv6(host, protocol) {
                var matches = host.match(protocol.IPV6ADDRESS) || [];

                var _matches2 = slicedToArray(matches, 3),
                  address = _matches2[1],
                  zone = _matches2[2];

                if (address) {
                  var _address$toLowerCase$ = address.toLowerCase().split("::")
                      .reverse(),
                    _address$toLowerCase$2 = slicedToArray(
                      _address$toLowerCase$,
                      2,
                    ),
                    last = _address$toLowerCase$2[0],
                    first = _address$toLowerCase$2[1];

                  var firstFields = first
                    ? first.split(":").map(_stripLeadingZeros)
                    : [];
                  var lastFields = last.split(":").map(_stripLeadingZeros);
                  var isLastFieldIPv4Address = protocol.IPV4ADDRESS.test(
                    lastFields[lastFields.length - 1],
                  );
                  var fieldCount = isLastFieldIPv4Address ? 7 : 8;
                  var lastFieldsStart = lastFields.length - fieldCount;
                  var fields = Array(fieldCount);
                  for (var x = 0; x < fieldCount; ++x) {
                    fields[x] = firstFields[x] ||
                      lastFields[lastFieldsStart + x] || "";
                  }
                  if (isLastFieldIPv4Address) {
                    fields[fieldCount - 1] = _normalizeIPv4(
                      fields[fieldCount - 1],
                      protocol,
                    );
                  }
                  var allZeroFields = fields.reduce(
                    function (acc, field, index) {
                      if (!field || field === "0") {
                        var lastLongest = acc[acc.length - 1];
                        if (
                          lastLongest &&
                          lastLongest.index + lastLongest.length === index
                        ) {
                          lastLongest.length++;
                        } else {
                          acc.push({ index: index, length: 1 });
                        }
                      }
                      return acc;
                    },
                    [],
                  );
                  var longestZeroFields = allZeroFields.sort(function (a, b) {
                    return b.length - a.length;
                  })[0];
                  var newHost = void 0;
                  if (longestZeroFields && longestZeroFields.length > 1) {
                    var newFirst = fields.slice(0, longestZeroFields.index);
                    var newLast = fields.slice(
                      longestZeroFields.index + longestZeroFields.length,
                    );
                    newHost = newFirst.join(":") + "::" + newLast.join(":");
                  } else {
                    newHost = fields.join(":");
                  }
                  if (zone) {
                    newHost += "%" + zone;
                  }
                  return newHost;
                } else {
                  return host;
                }
              }
              var URI_PARSE =
                /^(?:([^:\/?#]+):)?(?:\/\/((?:([^\/?#@]*)@)?(\[[^\/?#\]]+\]|[^\/?#:]*)(?:\:(\d*))?))?([^?#]*)(?:\?([^#]*))?(?:#((?:.|\n|\r)*))?/i;
              var NO_MATCH_IS_UNDEFINED = "".match(/(){0}/)[1] === undefined;
              function parse(uriString) {
                var options = arguments.length > 1 && arguments[1] !== undefined
                  ? arguments[1] : {};

                var components = {};
                var protocol = options.iri !== false ? IRI_PROTOCOL
                : URI_PROTOCOL;
                if (options.reference === "suffix") {
                  uriString = (options.scheme ? options.scheme + ":" : "") +
                    "//" + uriString;
                }
                var matches = uriString.match(URI_PARSE);
                if (matches) {
                  if (NO_MATCH_IS_UNDEFINED) {
                    //store each component
                    components.scheme = matches[1];
                    components.userinfo = matches[3];
                    components.host = matches[4];
                    components.port = parseInt(matches[5], 10);
                    components.path = matches[6] || "";
                    components.query = matches[7];
                    components.fragment = matches[8];
                    //fix port number
                    if (isNaN(components.port)) {
                      components.port = matches[5];
                    }
                  } else {
                    //IE FIX for improper RegExp matching
                    //store each component
                    components.scheme = matches[1] || undefined;
                    components.userinfo = uriString.indexOf("@") !== -1
                      ? matches[3]
                      : undefined;
                    components.host = uriString.indexOf("//") !== -1
                      ? matches[4] : undefined;
                    components.port = parseInt(matches[5], 10);
                    components.path = matches[6] || "";
                    components.query = uriString.indexOf("?") !== -1
                      ? matches[7] : undefined;
                    components.fragment = uriString.indexOf("#") !== -1
                      ? matches[8] : undefined;
                    //fix port number
                    if (isNaN(components.port)) {
                      components.port =
                        uriString.match(/\/\/(?:.|\n)*\:(?:\/|\?|\#|$)/)
                          ? matches[4] : undefined;
                    }
                  }
                  if (components.host) {
                    //normalize IP hosts
                    components.host = _normalizeIPv6(
                      _normalizeIPv4(components.host, protocol),
                      protocol,
                    );
                  }
                  //determine reference type
                  if (
                    components.scheme === undefined &&
                    components.userinfo === undefined &&
                    components.host === undefined &&
                    components.port === undefined && !components.path &&
                    components.query === undefined
                  ) {
                    components.reference = "same-document";
                  } else if (components.scheme === undefined) {
                    components.reference = "relative";
                  } else if (components.fragment === undefined) {
                    components.reference = "absolute";
                  } else {
                    components.reference = "uri";
                  }
                  //check for reference errors
                  if (
                    options.reference && options.reference !== "suffix" &&
                    options.reference !== components.reference
                  ) {
                    components.error = components.error ||
                      "URI is not a " + options.reference + " reference.";
                  }
                  //find scheme handler
                  var schemeHandler =
                    SCHEMES[
                      (options.scheme || components.scheme || "").toLowerCase()
                    ];
                  //check if scheme can't handle IRIs
                  if (
                    !options.unicodeSupport &&
                    (!schemeHandler || !schemeHandler.unicodeSupport)
                  ) {
                    //if host component is a domain name
                    if (
                      components.host &&
                      (options.domainHost ||
                        schemeHandler && schemeHandler.domainHost)
                    ) {
                      //convert Unicode IDN -> ASCII IDN
                      try {
                        components.host = punycode.toASCII(
                          components.host.replace(
                            protocol.PCT_ENCODED,
                            pctDecChars,
                          ).toLowerCase(),
                        );
                      } catch (e) {
                        components.error = components.error ||
                          "Host's domain name can not be converted to ASCII via punycode: " +
                            e;
                      }
                    }
                    //convert IRI -> URI
                    _normalizeComponentEncoding(components, URI_PROTOCOL);
                  } else {
                    //normalize encodings
                    _normalizeComponentEncoding(components, protocol);
                  }
                  //perform scheme specific parsing
                  if (schemeHandler && schemeHandler.parse) {
                    schemeHandler.parse(components, options);
                  }
                } else {
                  components.error = components.error ||
                    "URI can not be parsed.";
                }
                return components;
              }

              function _recomposeAuthority(components, options) {
                var protocol = options.iri !== false ? IRI_PROTOCOL
                : URI_PROTOCOL;
                var uriTokens = [];
                if (components.userinfo !== undefined) {
                  uriTokens.push(components.userinfo);
                  uriTokens.push("@");
                }
                if (components.host !== undefined) {
                  //normalize IP hosts, add brackets and escape zone separator for IPv6
                  uriTokens.push(
                    _normalizeIPv6(
                      _normalizeIPv4(String(components.host), protocol),
                      protocol,
                    ).replace(protocol.IPV6ADDRESS, function (_, $1, $2) {
                      return "[" + $1 + ($2 ? "%25" + $2 : "") + "]";
                    }),
                  );
                }
                if (typeof components.port === "number") {
                  uriTokens.push(":");
                  uriTokens.push(components.port.toString(10));
                }
                return uriTokens.length ? uriTokens.join("") : undefined;
              }

              var RDS1 = /^\.\.?\//;
              var RDS2 = /^\/\.(\/|$)/;
              var RDS3 = /^\/\.\.(\/|$)/;
              var RDS5 = /^\/?(?:.|\n)*?(?=\/|$)/;
              function removeDotSegments(input) {
                var output = [];
                while (input.length) {
                  if (input.match(RDS1)) {
                    input = input.replace(RDS1, "");
                  } else if (input.match(RDS2)) {
                    input = input.replace(RDS2, "/");
                  } else if (input.match(RDS3)) {
                    input = input.replace(RDS3, "/");
                    output.pop();
                  } else if (input === "." || input === "..") {
                    input = "";
                  } else {
                    var im = input.match(RDS5);
                    if (im) {
                      var s = im[0];
                      input = input.slice(s.length);
                      output.push(s);
                    } else {
                      throw new Error("Unexpected dot segment condition");
                    }
                  }
                }
                return output.join("");
              }

              function serialize(components) {
                var options = arguments.length > 1 && arguments[1] !== undefined
                  ? arguments[1] : {};

                var protocol = options.iri ? IRI_PROTOCOL : URI_PROTOCOL;
                var uriTokens = [];
                //find scheme handler
                var schemeHandler =
                  SCHEMES[
                    (options.scheme || components.scheme || "").toLowerCase()
                  ];
                //perform scheme specific serialization
                if (schemeHandler && schemeHandler.serialize) {
                  schemeHandler.serialize(components, options);
                }
                if (components.host) {
                  //if host component is an IPv6 address
                  if (protocol.IPV6ADDRESS.test(components.host));
                  //TODO: normalize IPv6 address as per RFC 5952

                  //if host component is a domain name
                  else if (
                    options.domainHost ||
                    schemeHandler && schemeHandler.domainHost
                  ) {
                    //convert IDN via punycode
                    try {
                      components.host = !options.iri
                        ? punycode.toASCII(
                          components.host.replace(
                            protocol.PCT_ENCODED,
                            pctDecChars,
                          ).toLowerCase(),
                        )
                        : punycode.toUnicode(components.host);
                    } catch (e) {
                      components.error = components.error ||
                        "Host's domain name can not be converted to " +
                          (!options.iri ? "ASCII" : "Unicode") +
                          " via punycode: " + e;
                    }
                  }
                }
                //normalize encoding
                _normalizeComponentEncoding(components, protocol);
                if (options.reference !== "suffix" && components.scheme) {
                  uriTokens.push(components.scheme);
                  uriTokens.push(":");
                }
                var authority = _recomposeAuthority(components, options);
                if (authority !== undefined) {
                  if (options.reference !== "suffix") {
                    uriTokens.push("//");
                  }
                  uriTokens.push(authority);
                  if (components.path && components.path.charAt(0) !== "/") {
                    uriTokens.push("/");
                  }
                }
                if (components.path !== undefined) {
                  var s = components.path;
                  if (
                    !options.absolutePath &&
                    (!schemeHandler || !schemeHandler.absolutePath)
                  ) {
                    s = removeDotSegments(s);
                  }
                  if (authority === undefined) {
                    s = s.replace(/^\/\//, "/%2F"); //don't allow the path to start with "//"
                  }
                  uriTokens.push(s);
                }
                if (components.query !== undefined) {
                  uriTokens.push("?");
                  uriTokens.push(components.query);
                }
                if (components.fragment !== undefined) {
                  uriTokens.push("#");
                  uriTokens.push(components.fragment);
                }
                return uriTokens.join(""); //merge tokens into a string
              }

              function resolveComponents(base, relative) {
                var options = arguments.length > 2 && arguments[2] !== undefined
                  ? arguments[2] : {};
                var skipNormalization = arguments[3];

                var target = {};
                if (!skipNormalization) {
                  base = parse(serialize(base, options), options); //normalize base components
                  relative = parse(serialize(relative, options), options); //normalize relative components
                }
                options = options || {};
                if (!options.tolerant && relative.scheme) {
                  target.scheme = relative.scheme;
                  //target.authority = relative.authority;
                  target.userinfo = relative.userinfo;
                  target.host = relative.host;
                  target.port = relative.port;
                  target.path = removeDotSegments(relative.path || "");
                  target.query = relative.query;
                } else {
                  if (
                    relative.userinfo !== undefined ||
                    relative.host !== undefined || relative.port !== undefined
                  ) {
                    //target.authority = relative.authority;
                    target.userinfo = relative.userinfo;
                    target.host = relative.host;
                    target.port = relative.port;
                    target.path = removeDotSegments(relative.path || "");
                    target.query = relative.query;
                  } else {
                    if (!relative.path) {
                      target.path = base.path;
                      if (relative.query !== undefined) {
                        target.query = relative.query;
                      } else {
                        target.query = base.query;
                      }
                    } else {
                      if (relative.path.charAt(0) === "/") {
                        target.path = removeDotSegments(relative.path);
                      } else {
                        if (
                          (base.userinfo !== undefined ||
                            base.host !== undefined ||
                            base.port !== undefined) && !base.path
                        ) {
                          target.path = "/" + relative.path;
                        } else if (!base.path) {
                          target.path = relative.path;
                        } else {
                          target.path =
                            base.path.slice(0, base.path.lastIndexOf("/") + 1) +
                            relative.path;
                        }
                        target.path = removeDotSegments(target.path);
                      }
                      target.query = relative.query;
                    }
                    //target.authority = base.authority;
                    target.userinfo = base.userinfo;
                    target.host = base.host;
                    target.port = base.port;
                  }
                  target.scheme = base.scheme;
                }
                target.fragment = relative.fragment;
                return target;
              }

              function resolve(baseURI, relativeURI, options) {
                var schemelessOptions = assign({ scheme: "null" }, options);
                return serialize(
                  resolveComponents(
                    parse(baseURI, schemelessOptions),
                    parse(relativeURI, schemelessOptions),
                    schemelessOptions,
                    true,
                  ),
                  schemelessOptions,
                );
              }

              function normalize(uri, options) {
                if (typeof uri === "string") {
                  uri = serialize(parse(uri, options), options);
                } else if (typeOf(uri) === "object") {
                  uri = parse(serialize(uri, options), options);
                }
                return uri;
              }

              function equal(uriA, uriB, options) {
                if (typeof uriA === "string") {
                  uriA = serialize(parse(uriA, options), options);
                } else if (typeOf(uriA) === "object") {
                  uriA = serialize(uriA, options);
                }
                if (typeof uriB === "string") {
                  uriB = serialize(parse(uriB, options), options);
                } else if (typeOf(uriB) === "object") {
                  uriB = serialize(uriB, options);
                }
                return uriA === uriB;
              }

              function escapeComponent(str, options) {
                return str && str.toString().replace(
                  !options || !options.iri
                    ? URI_PROTOCOL.ESCAPE
                    : IRI_PROTOCOL.ESCAPE,
                  pctEncChar,
                );
              }

              function unescapeComponent(str, options) {
                return str && str.toString().replace(
                  !options || !options.iri
                    ? URI_PROTOCOL.PCT_ENCODED
                    : IRI_PROTOCOL.PCT_ENCODED,
                  pctDecChars,
                );
              }

              var handler = {
                scheme: "http",
                domainHost: true,
                parse: function parse(components, options) {
                  //report missing host
                  if (!components.host) {
                    components.error = components.error ||
                      "HTTP URIs must have a host.";
                  }
                  return components;
                },
                serialize: function serialize(components, options) {
                  //normalize the default port
                  if (
                    components.port ===
                      (String(components.scheme).toLowerCase() !== "https"
                        ? 80
                        : 443) || components.port === ""
                  ) {
                    components.port = undefined;
                  }
                  //normalize the empty path
                  if (!components.path) {
                    components.path = "/";
                  }
                  //NOTE: We do not parse query strings for HTTP URIs
                  //as WWW Form Url Encoded query strings are part of the HTML4+ spec,
                  //and not the HTTP spec.
                  return components;
                },
              };

              var handler$1 = {
                scheme: "https",
                domainHost: handler.domainHost,
                parse: handler.parse,
                serialize: handler.serialize,
              };

              var O = {};
              //RFC 3986
              var UNRESERVED$$ = "[A-Za-z0-9\\-\\.\\_\\~" +
                ("\\xA0-\\u200D\\u2010-\\u2029\\u202F-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFEF") +
                "]";
              var HEXDIG$$ = "[0-9A-Fa-f]"; //case-insensitive
              var PCT_ENCODED$ = subexp(
                subexp(
                  "%[EFef]" + HEXDIG$$ + "%" + HEXDIG$$ + HEXDIG$$ + "%" +
                    HEXDIG$$ + HEXDIG$$,
                ) + "|" +
                  subexp("%[89A-Fa-f]" + HEXDIG$$ + "%" + HEXDIG$$ + HEXDIG$$) +
                  "|" + subexp("%" + HEXDIG$$ + HEXDIG$$),
              ); //expanded
              //RFC 5322, except these symbols as per RFC 6068: @ : / ? # [ ] & ; =
              //const ATEXT$$ = "[A-Za-z0-9\\!\\#\\$\\%\\&\\'\\*\\+\\-\\/\\=\\?\\^\\_\\`\\{\\|\\}\\~]";
              //const WSP$$ = "[\\x20\\x09]";
              //const OBS_QTEXT$$ = "[\\x01-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]";  //(%d1-8 / %d11-12 / %d14-31 / %d127)
              //const QTEXT$$ = merge("[\\x21\\x23-\\x5B\\x5D-\\x7E]", OBS_QTEXT$$);  //%d33 / %d35-91 / %d93-126 / obs-qtext
              //const VCHAR$$ = "[\\x21-\\x7E]";
              //const WSP$$ = "[\\x20\\x09]";
              //const OBS_QP$ = subexp("\\\\" + merge("[\\x00\\x0D\\x0A]", OBS_QTEXT$$));  //%d0 / CR / LF / obs-qtext
              //const FWS$ = subexp(subexp(WSP$$ + "*" + "\\x0D\\x0A") + "?" + WSP$$ + "+");
              //const QUOTED_PAIR$ = subexp(subexp("\\\\" + subexp(VCHAR$$ + "|" + WSP$$)) + "|" + OBS_QP$);
              //const QUOTED_STRING$ = subexp('\\"' + subexp(FWS$ + "?" + QCONTENT$) + "*" + FWS$ + "?" + '\\"');
              var ATEXT$$ =
                "[A-Za-z0-9\\!\\$\\%\\'\\*\\+\\-\\^\\_\\`\\{\\|\\}\\~]";
              var QTEXT$$ =
                "[\\!\\$\\%\\'\\(\\)\\*\\+\\,\\-\\.0-9\\<\\>A-Z\\x5E-\\x7E]";
              var VCHAR$$ = merge(QTEXT$$, '[\\"\\\\]');
              var SOME_DELIMS$$ = "[\\!\\$\\'\\(\\)\\*\\+\\,\\;\\:\\@]";
              var UNRESERVED = new RegExp(UNRESERVED$$, "g");
              var PCT_ENCODED = new RegExp(PCT_ENCODED$, "g");
              var NOT_LOCAL_PART = new RegExp(
                merge("[^]", ATEXT$$, "[\\.]", '[\\"]', VCHAR$$),
                "g",
              );
              var NOT_HFNAME = new RegExp(
                merge("[^]", UNRESERVED$$, SOME_DELIMS$$),
                "g",
              );
              var NOT_HFVALUE = NOT_HFNAME;
              function decodeUnreserved(str) {
                var decStr = pctDecChars(str);
                return !decStr.match(UNRESERVED) ? str : decStr;
              }
              var handler$2 = {
                scheme: "mailto",
                parse: function parse$$1(components, options) {
                  var mailtoComponents = components;
                  var to = mailtoComponents.to = mailtoComponents.path
                    ? mailtoComponents.path.split(",")
                    : [];
                  mailtoComponents.path = undefined;
                  if (mailtoComponents.query) {
                    var unknownHeaders = false;
                    var headers = {};
                    var hfields = mailtoComponents.query.split("&");
                    for (var x = 0, xl = hfields.length; x < xl; ++x) {
                      var hfield = hfields[x].split("=");
                      switch (hfield[0]) {
                        case "to":
                          var toAddrs = hfield[1].split(",");
                          for (
                            var _x = 0, _xl = toAddrs.length; _x < _xl; ++_x
                          ) {
                            to.push(toAddrs[_x]);
                          }
                          break;
                        case "subject":
                          mailtoComponents.subject = unescapeComponent(
                            hfield[1],
                            options,
                          );
                          break;
                        case "body":
                          mailtoComponents.body = unescapeComponent(
                            hfield[1],
                            options,
                          );
                          break;
                        default:
                          unknownHeaders = true;
                          headers[unescapeComponent(hfield[0], options)] =
                            unescapeComponent(hfield[1], options);
                          break;
                      }
                    }
                    if (unknownHeaders)mailtoComponents.headers = headers;
                  }
                  mailtoComponents.query = undefined;
                  for (var _x2 = 0, _xl2 = to.length; _x2 < _xl2; ++_x2) {
                    var addr = to[_x2].split("@");
                    addr[0] = unescapeComponent(addr[0]);
                    if (!options.unicodeSupport) {
                      //convert Unicode IDN -> ASCII IDN
                      try {
                        addr[1] = punycode.toASCII(
                          unescapeComponent(addr[1], options).toLowerCase(),
                        );
                      } catch (e) {
                        mailtoComponents.error = mailtoComponents.error ||
                          "Email address's domain name can not be converted to ASCII via punycode: " +
                            e;
                      }
                    } else {
                      addr[1] = unescapeComponent(addr[1], options)
                        .toLowerCase();
                    }
                    to[_x2] = addr.join("@");
                  }
                  return mailtoComponents;
                },
                serialize: function serialize$$1(mailtoComponents, options) {
                  var components = mailtoComponents;
                  var to = toArray(mailtoComponents.to);
                  if (to) {
                    for (var x = 0, xl = to.length; x < xl; ++x) {
                      var toAddr = String(to[x]);
                      var atIdx = toAddr.lastIndexOf("@");
                      var localPart = toAddr.slice(0, atIdx).replace(
                        PCT_ENCODED,
                        decodeUnreserved,
                      ).replace(PCT_ENCODED, toUpperCase).replace(
                        NOT_LOCAL_PART,
                        pctEncChar,
                      );
                      var domain = toAddr.slice(atIdx + 1);
                      //convert IDN via punycode
                      try {
                        domain = !options.iri
                          ? punycode.toASCII(
                            unescapeComponent(domain, options).toLowerCase(),
                          )
                          : punycode.toUnicode(domain);
                      } catch (e) {
                        components.error = components.error ||
                          "Email address's domain name can not be converted to " +
                            (!options.iri ? "ASCII" : "Unicode") +
                            " via punycode: " + e;
                      }
                      to[x] = localPart + "@" + domain;
                    }
                    components.path = to.join(",");
                  }
                  var headers = mailtoComponents.headers =
                    mailtoComponents.headers || {};
                  if (mailtoComponents.subject) {
                    headers["subject"] = mailtoComponents.subject;
                  }
                  if (mailtoComponents.body) {
                    headers["body"] = mailtoComponents.body;
                  }
                  var fields = [];
                  for (var name in headers) {
                    if (headers[name] !== O[name]) {
                      fields.push(
                        name.replace(PCT_ENCODED, decodeUnreserved).replace(
                          PCT_ENCODED,
                          toUpperCase,
                        ).replace(NOT_HFNAME, pctEncChar) + "=" +
                          headers[name].replace(PCT_ENCODED, decodeUnreserved)
                            .replace(PCT_ENCODED, toUpperCase).replace(
                              NOT_HFVALUE,
                              pctEncChar,
                            ),
                      );
                    }
                  }
                  if (fields.length) {
                    components.query = fields.join("&");
                  }
                  return components;
                },
              };

              var URN_PARSE = /^([^\:]+)\:(.*)/;
              //RFC 2141
              var handler$3 = {
                scheme: "urn",
                parse: function parse$$1(components, options) {
                  var matches = components.path &&
                    components.path.match(URN_PARSE);
                  var urnComponents = components;
                  if (matches) {
                    var scheme = options.scheme || urnComponents.scheme ||
                      "urn";
                    var nid = matches[1].toLowerCase();
                    var nss = matches[2];
                    var urnScheme = scheme + ":" + (options.nid || nid);
                    var schemeHandler = SCHEMES[urnScheme];
                    urnComponents.nid = nid;
                    urnComponents.nss = nss;
                    urnComponents.path = undefined;
                    if (schemeHandler) {
                      urnComponents = schemeHandler.parse(
                        urnComponents,
                        options,
                      );
                    }
                  } else {
                    urnComponents.error = urnComponents.error ||
                      "URN can not be parsed.";
                  }
                  return urnComponents;
                },
                serialize: function serialize$$1(urnComponents, options) {
                  var scheme = options.scheme || urnComponents.scheme || "urn";
                  var nid = urnComponents.nid;
                  var urnScheme = scheme + ":" + (options.nid || nid);
                  var schemeHandler = SCHEMES[urnScheme];
                  if (schemeHandler) {
                    urnComponents = schemeHandler.serialize(
                      urnComponents,
                      options,
                    );
                  }
                  var uriComponents = urnComponents;
                  var nss = urnComponents.nss;
                  uriComponents.path = (nid || options.nid) + ":" + nss;
                  return uriComponents;
                },
              };

              var UUID =
                /^[0-9A-Fa-f]{8}(?:\-[0-9A-Fa-f]{4}){3}\-[0-9A-Fa-f]{12}$/;
              //RFC 4122
              var handler$4 = {
                scheme: "urn:uuid",
                parse: function parse(urnComponents, options) {
                  var uuidComponents = urnComponents;
                  uuidComponents.uuid = uuidComponents.nss;
                  uuidComponents.nss = undefined;
                  if (
                    !options.tolerant &&
                    (!uuidComponents.uuid || !uuidComponents.uuid.match(UUID))
                  ) {
                    uuidComponents.error = uuidComponents.error ||
                      "UUID is not valid.";
                  }
                  return uuidComponents;
                },
                serialize: function serialize(uuidComponents, options) {
                  var urnComponents = uuidComponents;
                  //normalize UUID
                  urnComponents.nss = (uuidComponents.uuid || "").toLowerCase();
                  return urnComponents;
                },
              };

              SCHEMES[handler.scheme] = handler;
              SCHEMES[handler$1.scheme] = handler$1;
              SCHEMES[handler$2.scheme] = handler$2;
              SCHEMES[handler$3.scheme] = handler$3;
              SCHEMES[handler$4.scheme] = handler$4;

              exports.SCHEMES = SCHEMES;
              exports.pctEncChar = pctEncChar;
              exports.pctDecChars = pctDecChars;
              exports.parse = parse;
              exports.removeDotSegments = removeDotSegments;
              exports.serialize = serialize;
              exports.resolveComponents = resolveComponents;
              exports.resolve = resolve;
              exports.normalize = normalize;
              exports.equal = equal;
              exports.escapeComponent = escapeComponent;
              exports.unescapeComponent = unescapeComponent;

              Object.defineProperty(exports, "__esModule", { value: true });
            }),
          ));
        }, {}],
        "ajv": [
          function (require, module, exports) {
            var compileSchema = require("./compile"),
              resolve = require("./compile/resolve"),
              Cache = require("./cache"),
              SchemaObject = require("./compile/schema_obj"),
              stableStringify = require("fast-json-stable-stringify"),
              formats = require("./compile/formats"),
              rules = require("./compile/rules"),
              $dataMetaSchema = require("./data"),
              util = require("./compile/util");

            module.exports = Ajv;

            Ajv.prototype.validate = validate;
            Ajv.prototype.compile = compile;
            Ajv.prototype.addSchema = addSchema;
            Ajv.prototype.addMetaSchema = addMetaSchema;
            Ajv.prototype.validateSchema = validateSchema;
            Ajv.prototype.getSchema = getSchema;
            Ajv.prototype.removeSchema = removeSchema;
            Ajv.prototype.addFormat = addFormat;
            Ajv.prototype.errorsText = errorsText;

            Ajv.prototype._addSchema = _addSchema;
            Ajv.prototype._compile = _compile;

            Ajv.prototype.compileAsync = require("./compile/async");
            var customKeyword = require("./keyword");
            Ajv.prototype.addKeyword = customKeyword.add;
            Ajv.prototype.getKeyword = customKeyword.get;
            Ajv.prototype.removeKeyword = customKeyword.remove;
            Ajv.prototype.validateKeyword = customKeyword.validate;

            var errorClasses = require("./compile/error_classes");
            Ajv.ValidationError = errorClasses.Validation;
            Ajv.MissingRefError = errorClasses.MissingRef;
            Ajv.$dataMetaSchema = $dataMetaSchema;

            var META_SCHEMA_ID = "http://json-schema.org/draft-07/schema";

            var META_IGNORE_OPTIONS = [
              "removeAdditional",
              "useDefaults",
              "coerceTypes",
              "strictDefaults",
            ];
            var META_SUPPORT_DATA = ["/properties"];

            /**
 * Creates validator instance.
 * Usage: `Ajv(opts)`
 * @param {Object} opts optional options
 * @return {Object} ajv instance
 */
            function Ajv(opts) {
              if (!(this instanceof Ajv)) return new Ajv(opts);
              opts = this._opts = util.copy(opts) || {};
              setLogger(this);
              this._schemas = {};
              this._refs = {};
              this._fragments = {};
              this._formats = formats(opts.format);

              this._cache = opts.cache || new Cache();
              this._loadingSchemas = {};
              this._compilations = [];
              this.RULES = rules();
              this._getId = chooseGetId(opts);

              opts.loopRequired = opts.loopRequired || Infinity;
              if (opts.errorDataPath == "property") {opts
                  ._errorDataPathProperty = true;}
              if (opts.serialize === undefined) {
                opts.serialize = stableStringify;
              }
              this._metaOpts = getMetaSchemaOptions(this);

              if (opts.formats) addInitialFormats(this);
              addDefaultMetaSchema(this);
              if (typeof opts.meta == "object") this.addMetaSchema(opts.meta);
              if (opts.nullable) {
                this.addKeyword(
                  "nullable",
                  { metaSchema: { type: "boolean" } },
                );
              }
              addInitialSchemas(this);
            }

            /**
 * Validate data using schema
 * Schema will be compiled and cached (using serialized JSON as key. [fast-json-stable-stringify](https://github.com/epoberezkin/fast-json-stable-stringify) is used to serialize.
 * @this   Ajv
 * @param  {String|Object} schemaKeyRef key, ref or schema object
 * @param  {Any} data to be validated
 * @return {Boolean} validation result. Errors from the last validation will be available in `ajv.errors` (and also in compiled schema: `schema.errors`).
 */
            function validate(schemaKeyRef, data) {
              var v;
              if (typeof schemaKeyRef == "string") {
                v = this.getSchema(schemaKeyRef);
                if (!v) {
                  throw new Error(
                    'no schema with key or ref "' + schemaKeyRef + '"',
                  );
                }
              } else {
                var schemaObj = this._addSchema(schemaKeyRef);
                v = schemaObj.validate || this._compile(schemaObj);
              }

              var valid = v(data);
              if (v.$async !== true)this.errors = v.errors;
              return valid;
            }

            /**
 * Create validating function for passed schema.
 * @this   Ajv
 * @param  {Object} schema schema object
 * @param  {Boolean} _meta true if schema is a meta-schema. Used internally to compile meta schemas of custom keywords.
 * @return {Function} validating function
 */
            function compile(schema, _meta) {
              var schemaObj = this._addSchema(schema, undefined, _meta);
              return schemaObj.validate || this._compile(schemaObj);
            }

            /**
 * Adds schema to the instance.
 * @this   Ajv
 * @param {Object|Array} schema schema or array of schemas. If array is passed, `key` and other parameters will be ignored.
 * @param {String} key Optional schema key. Can be passed to `validate` method instead of schema object or id/ref. One schema per instance can have empty `id` and `key`.
 * @param {Boolean} _skipValidation true to skip schema validation. Used internally, option validateSchema should be used instead.
 * @param {Boolean} _meta true if schema is a meta-schema. Used internally, addMetaSchema should be used instead.
 * @return {Ajv} this for method chaining
 */
            function addSchema(schema, key, _skipValidation, _meta) {
              if (Array.isArray(schema)) {
                for (var i = 0; i < schema.length; i++) {
                  this.addSchema(schema[i], undefined, _skipValidation, _meta);
                }
                return this;
              }
              var id = this._getId(schema);
              if (id !== undefined && typeof id != "string") {
                throw new Error("schema id must be string");
              }
              key = resolve.normalizeId(key || id);
              checkUnique(this, key);
              this._schemas[key] = this._addSchema(
                schema,
                _skipValidation,
                _meta,
                true,
              );
              return this;
            }

            /**
 * Add schema that will be used to validate other schemas
 * options in META_IGNORE_OPTIONS are alway set to false
 * @this   Ajv
 * @param {Object} schema schema object
 * @param {String} key optional schema key
 * @param {Boolean} skipValidation true to skip schema validation, can be used to override validateSchema option for meta-schema
 * @return {Ajv} this for method chaining
 */
            function addMetaSchema(schema, key, skipValidation) {
              this.addSchema(schema, key, skipValidation, true);
              return this;
            }

            /**
 * Validate schema
 * @this   Ajv
 * @param {Object} schema schema to validate
 * @param {Boolean} throwOrLogError pass true to throw (or log) an error if invalid
 * @return {Boolean} true if schema is valid
 */
            function validateSchema(schema, throwOrLogError) {
              var $schema = schema.$schema;
              if ($schema !== undefined && typeof $schema != "string") {
                throw new Error("$schema must be a string");
              }
              $schema = $schema || this._opts.defaultMeta || defaultMeta(this);
              if (!$schema) {
                this.logger.warn("meta-schema not available");
                this.errors = null;
                return true;
              }
              var valid = this.validate($schema, schema);
              if (!valid && throwOrLogError) {
                var message = "schema is invalid: " + this.errorsText();
                if (this._opts.validateSchema == "log") {
                  this.logger.error(message);
                } else throw new Error(message);
              }
              return valid;
            }

            function defaultMeta(self) {
              var meta = self._opts.meta;
              self._opts.defaultMeta = typeof meta == "object"
                ? self._getId(meta) || meta
                : self.getSchema(META_SCHEMA_ID)
                ? META_SCHEMA_ID
                : undefined;
              return self._opts.defaultMeta;
            }

            /**
 * Get compiled schema from the instance by `key` or `ref`.
 * @this   Ajv
 * @param  {String} keyRef `key` that was passed to `addSchema` or full schema reference (`schema.id` or resolved id).
 * @return {Function} schema validating function (with property `schema`).
 */
            function getSchema(keyRef) {
              var schemaObj = _getSchemaObj(this, keyRef);
              switch (typeof schemaObj) {
                case "object":
                  return schemaObj.validate || this._compile(schemaObj);
                case "string":
                  return this.getSchema(schemaObj);
                case "undefined":
                  return _getSchemaFragment(this, keyRef);
              }
            }

            function _getSchemaFragment(self, ref) {
              var res = resolve.schema.call(self, { schema: {} }, ref);
              if (res) {
                var schema = res.schema,
                  root = res.root,
                  baseId = res.baseId;
                var v = compileSchema.call(
                  self,
                  schema,
                  root,
                  undefined,
                  baseId,
                );
                self._fragments[ref] = new SchemaObject({
                  ref: ref,
                  fragment: true,
                  schema: schema,
                  root: root,
                  baseId: baseId,
                  validate: v,
                });
                return v;
              }
            }

            function _getSchemaObj(self, keyRef) {
              keyRef = resolve.normalizeId(keyRef);
              return self._schemas[keyRef] || self._refs[keyRef] ||
                self._fragments[keyRef];
            }

            /**
 * Remove cached schema(s).
 * If no parameter is passed all schemas but meta-schemas are removed.
 * If RegExp is passed all schemas with key/id matching pattern but meta-schemas are removed.
 * Even if schema is referenced by other schemas it still can be removed as other schemas have local references.
 * @this   Ajv
 * @param  {String|Object|RegExp} schemaKeyRef key, ref, pattern to match key/ref or schema object
 * @return {Ajv} this for method chaining
 */
            function removeSchema(schemaKeyRef) {
              if (schemaKeyRef instanceof RegExp) {
                _removeAllSchemas(this, this._schemas, schemaKeyRef);
                _removeAllSchemas(this, this._refs, schemaKeyRef);
                return this;
              }
              switch (typeof schemaKeyRef) {
                case "undefined":
                  _removeAllSchemas(this, this._schemas);
                  _removeAllSchemas(this, this._refs);
                  this._cache.clear();
                  return this;
                case "string":
                  var schemaObj = _getSchemaObj(this, schemaKeyRef);
                  if (schemaObj)this._cache.del(schemaObj.cacheKey);
                  delete this._schemas[schemaKeyRef];
                  delete this._refs[schemaKeyRef];
                  return this;
                case "object":
                  var serialize = this._opts.serialize;
                  var cacheKey = serialize ? serialize(schemaKeyRef)
                  : schemaKeyRef;
                  this._cache.del(cacheKey);
                  var id = this._getId(schemaKeyRef);
                  if (id) {
                    id = resolve.normalizeId(id);
                    delete this._schemas[id];
                    delete this._refs[id];
                  }
              }
              return this;
            }

            function _removeAllSchemas(self, schemas, regex) {
              for (var keyRef in schemas) {
                var schemaObj = schemas[keyRef];
                if (!schemaObj.meta && (!regex || regex.test(keyRef))) {
                  self._cache.del(schemaObj.cacheKey);
                  delete schemas[keyRef];
                }
              }
            }

            /* @this   Ajv */
            function _addSchema(schema, skipValidation, meta, shouldAddSchema) {
              if (typeof schema != "object" && typeof schema != "boolean") {
                throw new Error("schema should be object or boolean");
              }
              var serialize = this._opts.serialize;
              var cacheKey = serialize ? serialize(schema) : schema;
              var cached = this._cache.get(cacheKey);
              if (cached) return cached;

              shouldAddSchema = shouldAddSchema ||
                this._opts.addUsedSchema !== false;

              var id = resolve.normalizeId(this._getId(schema));
              if (id && shouldAddSchema) checkUnique(this, id);

              var willValidate = this._opts.validateSchema !== false &&
                !skipValidation;
              var recursiveMeta;
              if (
                willValidate &&
                !(recursiveMeta = id &&
                  id == resolve.normalizeId(schema.$schema))
              ) {
                this.validateSchema(schema, true);
              }

              var localRefs = resolve.ids.call(this, schema);

              var schemaObj = new SchemaObject({
                id: id,
                schema: schema,
                localRefs: localRefs,
                cacheKey: cacheKey,
                meta: meta,
              });

              if (id[0] != "#" && shouldAddSchema)this._refs[id] = schemaObj;
              this._cache.put(cacheKey, schemaObj);

              if (willValidate && recursiveMeta) {
                this.validateSchema(schema, true);
              }

              return schemaObj;
            }

            /* @this   Ajv */
            function _compile(schemaObj, root) {
              if (schemaObj.compiling) {
                schemaObj.validate = callValidate;
                callValidate.schema = schemaObj.schema;
                callValidate.errors = null;
                callValidate.root = root ? root : callValidate;
                if (schemaObj.schema.$async === true) {
                  callValidate.$async = true;
                }
                return callValidate;
              }
              schemaObj.compiling = true;

              var currentOpts;
              if (schemaObj.meta) {
                currentOpts = this._opts;
                this._opts = this._metaOpts;
              }

              var v;
              try {
                v = compileSchema.call(
                  this,
                  schemaObj.schema,
                  root,
                  schemaObj.localRefs,
                );
              } catch (e) {
                delete schemaObj.validate;
                throw e;
              } finally {
                schemaObj.compiling = false;
                if (schemaObj.meta) this._opts = currentOpts;
              }

              schemaObj.validate = v;
              schemaObj.refs = v.refs;
              schemaObj.refVal = v.refVal;
              schemaObj.root = v.root;
              return v;

              /* @this   {*} - custom context, see passContext option */
              function callValidate() {
                /* jshint validthis: true */
                var _validate = schemaObj.validate;
                var result = _validate.apply(this, arguments);
                callValidate.errors = _validate.errors;
                return result;
              }
            }

            function chooseGetId(opts) {
              switch (opts.schemaId) {
                case "auto":
                  return _get$IdOrId;
                case "id":
                  return _getId;
                default:
                  return _get$Id;
              }
            }

            /* @this   Ajv */
            function _getId(schema) {
              if (schema.$id) {
                this.logger.warn("schema $id ignored", schema.$id);
              }
              return schema.id;
            }

            /* @this   Ajv */
            function _get$Id(schema) {
              if (schema.id) this.logger.warn("schema id ignored", schema.id);
              return schema.$id;
            }

            function _get$IdOrId(schema) {
              if (schema.$id && schema.id && schema.$id != schema.id) {
                throw new Error("schema $id is different from id");
              }
              return schema.$id || schema.id;
            }

            /**
 * Convert array of error message objects to string
 * @this   Ajv
 * @param  {Array<Object>} errors optional array of validation errors, if not passed errors from the instance are used.
 * @param  {Object} options optional options with properties `separator` and `dataVar`.
 * @return {String} human readable string with all errors descriptions
 */
            function errorsText(errors, options) {
              errors = errors || this.errors;
              if (!errors) return "No errors";
              options = options || {};
              var separator = options.separator === undefined ? ", "
              : options.separator;
              var dataVar = options.dataVar === undefined ? "data"
              : options.dataVar;

              var text = "";
              for (var i = 0; i < errors.length; i++) {
                var e = errors[i];
                if (e) {
                  text += dataVar + e.dataPath + " " + e.message + separator;
                }
              }
              return text.slice(0, -separator.length);
            }

            /**
 * Add custom format
 * @this   Ajv
 * @param {String} name format name
 * @param {String|RegExp|Function} format string is converted to RegExp; function should return boolean (true when valid)
 * @return {Ajv} this for method chaining
 */
            function addFormat(name, format) {
              if (typeof format == "string") format = new RegExp(format);
              this._formats[name] = format;
              return this;
            }

            function addDefaultMetaSchema(self) {
              var $dataSchema;
              if (self._opts.$data) {
                $dataSchema = require("./refs/data.json");
                self.addMetaSchema($dataSchema, $dataSchema.$id, true);
              }
              if (self._opts.meta === false) return;
              var metaSchema = require("./refs/json-schema-draft-07.json");
              if (self._opts.$data) {
                metaSchema = $dataMetaSchema(metaSchema, META_SUPPORT_DATA);
              }
              self.addMetaSchema(metaSchema, META_SCHEMA_ID, true);
              self._refs["http://json-schema.org/schema"] = META_SCHEMA_ID;
            }

            function addInitialSchemas(self) {
              var optsSchemas = self._opts.schemas;
              if (!optsSchemas) return;
              if (Array.isArray(optsSchemas)) self.addSchema(optsSchemas);
              else {
                for (var key in optsSchemas) {self.addSchema(
                    optsSchemas[key],
                    key,
                  );}
              }
            }

            function addInitialFormats(self) {
              for (var name in self._opts.formats) {
                var format = self._opts.formats[name];
                self.addFormat(name, format);
              }
            }

            function checkUnique(self, id) {
              if (self._schemas[id] || self._refs[id]) {
                throw new Error(
                  'schema with key or id "' + id + '" already exists',
                );
              }
            }

            function getMetaSchemaOptions(self) {
              var metaOpts = util.copy(self._opts);
              for (var i = 0; i < META_IGNORE_OPTIONS.length; i++) {
                delete metaOpts[META_IGNORE_OPTIONS[i]];
              }
              return metaOpts;
            }

            function setLogger(self) {
              var logger = self._opts.logger;
              if (logger === false) {
                self.logger = { log: noop, warn: noop, error: noop };
              } else {
                if (logger === undefined)logger = console;
                if (
                  !(typeof logger == "object" && logger.log && logger.warn &&
                    logger.error)
                ) {
                  throw new Error(
                    "logger must implement log, warn and error methods",
                  );
                }
                self.logger = logger;
              }
            }

            function noop() {}
          },
          {
            "./cache": 1,
            "./compile": 5,
            "./compile/async": 2,
            "./compile/error_classes": 3,
            "./compile/formats": 4,
            "./compile/resolve": 6,
            "./compile/rules": 7,
            "./compile/schema_obj": 8,
            "./compile/util": 10,
            "./data": 11,
            "./keyword": 39,
            "./refs/data.json": 40,
            "./refs/json-schema-draft-07.json": 41,
            "fast-json-stable-stringify": 43,
          },
        ],
      },
      {},
      [],
    )("ajv");
  });
});

unwrapExports(ajv6_10_2);

var definitions = {
  strictName: {
    type: "string",
    pattern: "^[a-z][a-z0-9\\-]+$",
  },
  looseName: {
    type: "string",
    pattern: "^[a-z][a-zA-Z0-9\\-_]+$",
  },
  macros: {
    type: "string",
    pattern: "^[a-z][a-zA-Z0-9\\-_/.]+$",
  },
  region: {
    type: "string",
    "enum": [
      "us-east-1",
      "us-east-2",
      "us-west-1",
      "us-west-2",
      "ca-central-1",
      "eu-west-1",
      "eu-central-1",
      "eu-west-2",
      "eu-west-3",
      "eu-north-1",
      "ap-northeast-1",
      "ap-northeast-2",
      "ap-southeast-1",
      "ap-southeast-2",
      "ap-south-1",
      "sa-east-1",
      "us-gov-west-1",
      "us-gov-east-1",
    ],
  },
  table: {
    type: "object",
    title: "DynamoDB table",
    propertyNames: {
      pattern: "^[a-z][a-z|0-9|\\-]+$",
    },
    minProperties: 1,
    maxProperties: 1,
  },
};
var $schema = "http://json-schema.org/draft-07/schema#";
var $id = "https://arc.codes/schema.json";
var type = "object";
var title = "OpenJS Architect JSON Schema";
var required = [
  "app",
];
var additionalProperties = {
  type: [
    "array",
    "object",
  ],
  items: {
    type: [
      "string",
      "number",
      "boolean",
      "array",
      "object",
    ],
  },
};
var properties = {
  app: {
    $id: "#/properties/app",
    title: "@app",
    description: "Application namespace",
    type: [
      "string",
      "array",
    ],
    maxItems: 1,
    items: {
      $ref: "#/definitions/looseName",
    },
  },
  aws: {
    $id: "#/properties/aws",
    title: "@aws",
    description: "AWS specific configuration",
    type: [
      "array",
      "object",
    ],
    maxItems: 4,
    uniqueItems: true,
    items: {
      type: [
        "array",
        "object",
      ],
      maxItems: 2,
      items: [
        {
          type: "string",
          "enum": [
            "region",
            "profile",
            "bucket",
            "runtime",
          ],
        },
        {
          type: "string",
        },
      ],
    },
    required: [
      "bucket",
    ],
    properties: {
      region: {
        $ref: "#/definitions/region",
      },
      profile: {
        type: "string",
      },
      bucket: {
        type: "string",
      },
      runtime: {
        type: "string",
      },
    },
  },
  "static": {
    $id: "#/properties/static",
    title: "@static",
    description: "Static asset & S3 configuration",
    uniqueItems: true,
    type: [
      "array",
      "object",
    ],
    maxItems: 6,
    items: {
      type: "array",
      items: [
        {
          type: "string",
          "enum": [
            "folder",
            "fingerprint",
            "ignore",
            "spa",
            "staging",
            "production",
          ],
        },
        {
          type: [
            "string",
            "boolean",
            "array",
            "object",
          ],
        },
      ],
    },
    properties: {
      folder: {
        type: "string",
      },
      fingerprint: {
        type: "boolean",
      },
      ignore: {
        type: [
          "string",
          "object",
          "array",
        ],
      },
      spa: {
        type: "boolean",
      },
    },
  },
  ws: {
    $id: "#/properties/ws",
    type: "array",
    title: "@ws",
    description: "API Gateway WebSocket configuration",
    uniqueItems: true,
    items: {
      $ref: "#/definitions/strictName",
    },
  },
  http: {
    $id: "#/properties/http",
    title: "@http",
    description: "API Gateway configuration",
    type: "array",
    uniqueItems: true,
    items: {
      type: [
        "array",
        "object",
      ],
      maxItems: 2,
      maxProperties: 1,
      properties: {
        get: {
          type: "string",
          pattern: "^[a-zA-Z0-9\\/\\-:\\._]+$",
        },
        post: {
          type: "string",
          pattern: "^[a-zA-Z0-9\\/\\-:\\._]+$",
        },
        put: {
          type: "string",
          pattern: "^[a-zA-Z0-9\\/\\-:\\._]+$",
        },
        patch: {
          type: "string",
          pattern: "^[a-zA-Z0-9\\/\\-:\\._]+$",
        },
        "delete": {
          type: "string",
          pattern: "^[a-zA-Z0-9\\/\\-:\\._]+$",
        },
      },
      items: [
        {
          type: "string",
          "enum": [
            "get",
            "post",
            "put",
            "delete",
            "patch",
          ],
        },
        {
          type: "string",
          pattern: "^[a-zA-Z0-9\\/\\-:\\._]+$",
        },
      ],
    },
  },
  events: {
    $id: "#/properties/events",
    type: "array",
    title: "@events",
    description: "Events configuration",
    uniqueItems: true,
    items: {
      $ref: "#/definitions/strictName",
    },
  },
  queues: {
    $id: "#/properties/queues",
    type: "array",
    title: "@queues",
    description: "Queues configuration",
    uniqueItems: true,
    items: {
      $ref: "#/definitions/strictName",
    },
  },
  macros: {
    $id: "#/properties/macros",
    type: "array",
    title: "@macros",
    description: "Deployment macros configuration",
    uniqueItems: true,
    items: {
      $ref: "#/definitions/macros",
    },
  },
  scheduled: {
    $id: "#/properties/scheduled",
    type: [
      "array",
      "object",
    ],
    title: "@scheduled",
    description: "Scheduled event configuration",
    uniqueItems: true,
    items: {
      $id: "#/properties/scheduled/items",
      type: [
        "array",
        "object",
      ],
      title: "scheduled handlers",
      items: [
        {
          type: "string",
          pattern: "^[a-z][a-z|\\-|0-9]+$",
        },
        {
          type: "string",
          pattern: "^(rate|cron)",
        },
      ],
    },
  },
  tables: {
    $id: "#/properties/tables",
    type: "array",
    title: "@tables",
    description: "DynamoDB database tables configuration",
    uniqueItems: true,
    items: {
      $ref: "#/definitions/table",
    },
  },
  indexes: {
    $id: "#/properties/indexes",
    type: "array",
    title: "@indexes",
    description: "DynamoDB global secondary indexes configuration",
    uniqueItems: true,
    items: {
      $ref: "#/definitions/table",
    },
  },
};
var schema = {
  definitions: definitions,
  $schema: $schema,
  $id: $id,
  type: type,
  title: title,
  required: required,
  additionalProperties: additionalProperties,
  properties: properties,
};

var schema$1 = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  definitions: definitions,
  $schema: $schema,
  $id: $id,
  type: type,
  title: title,
  required: required,
  additionalProperties: additionalProperties,
  properties: properties,
  "default": schema,
});

var schema$2 = getCjsExportFromNamespace(schema$1);

/**
 * @param {object} arc
 * @returns {boolean|string} returns either 'false' or a string of errors
 */
var validate = function validate(arc) {
  let defn = new ajv6_10_2({ allErrors: true });
  let valid = defn.validate(schema$2, arc);

  let isValid = valid && !defn.errors;
  let isInvalid = !valid && defn.errors;
  if (isValid) {
    return false;
  } else if (isInvalid) {
    let message = ["Architect schema validation error"];
    let unknownErrors = 0;
    let findPragma = /\w+(?=\[)/;
    let findPosition = /(?<=[\[])\d+(?=[\]])/;
    let pragmas = {
      app: "app name",
      aws: "setting",
      events: "event",
      http: "route",
      indexes: "index or key",
      macros: "macro",
      queues: "event",
      scheduled: "event",
      static: "setting",
      tables: "table or key",
      ws: "route",
    };

    for (let error of defn.errors) {
      try {
        // Suss out the pragma and position of the offending statement
        let pragma = error.dataPath.match(findPragma)[0];
        let position = error.dataPath.match(findPosition)[0];
        let offender = arc[pragma][position];

        // Depending on what the user did we may get strings, arrays, or objects
        if (Array.isArray(offender)) {
          offender = offender.join(" ");
        } else if (offender instanceof Object) {
          offender = Object.keys(offender)[position];
        }

        let msg = `  @${pragma} invalid ${pragmas[pragma]}: "${offender}"`;
        if (!message.includes(msg)) message.push(msg);
      } catch (err) {
        ++unknownErrors;
      }
    }
    if (message.length > 2) message[0] += "s";
    if (unknownErrors) {
      message.push(
        `  ${unknownErrors} unknown validation error${
          unknownErrors > 1
            ? "s"
            : ""
        }`,
      );
    }
    return message.join("\n");
  } // Shouldn't be possible but jic ajv does something funky
  else throw Error("Invalid error reporting state");
};

/**
 * @param {string} code
 * @returns {object} parsed arc object
 */
function parse(code) {
  return parser(lexer(code));
}

parse.lexer = lexer;
parse.parser = parser;
parse.json = json;
parse.yaml = yaml_1;
parse.toml = toml_1;
parse.stringify = stringify;
parse.validate = validate;

var deno = parse;

export default deno;
