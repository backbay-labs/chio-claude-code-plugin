import { createRequire as __chioCreateRequire } from 'node:module';
const require = __chioCreateRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/@chio/bridge/node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/nodes/identity.js"(exports) {
    "use strict";
    var ALIAS = Symbol.for("yaml.alias");
    var DOC = Symbol.for("yaml.document");
    var MAP = Symbol.for("yaml.map");
    var PAIR = Symbol.for("yaml.pair");
    var SCALAR = Symbol.for("yaml.scalar");
    var SEQ = Symbol.for("yaml.seq");
    var NODE_TYPE = Symbol.for("yaml.node.type");
    var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
    var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
    var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
    var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
    var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
    var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
    function isCollection(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
    exports.ALIAS = ALIAS;
    exports.DOC = DOC;
    exports.MAP = MAP;
    exports.NODE_TYPE = NODE_TYPE;
    exports.PAIR = PAIR;
    exports.SCALAR = SCALAR;
    exports.SEQ = SEQ;
    exports.hasAnchor = hasAnchor;
    exports.isAlias = isAlias;
    exports.isCollection = isCollection;
    exports.isDocument = isDocument;
    exports.isMap = isMap;
    exports.isNode = isNode;
    exports.isPair = isPair;
    exports.isScalar = isScalar;
    exports.isSeq = isSeq;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/visit.js
var require_visit = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/visit.js"(exports) {
    "use strict";
    var identity = require_identity();
    var BREAK = Symbol("break visit");
    var SKIP = Symbol("skip children");
    var REMOVE = Symbol("remove node");
    function visit(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        visit_(null, node, visitor_, Object.freeze([]));
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    function visit_(key, node, visitor, path) {
      const ctrl = callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visit_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = visit_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = visit_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = visit_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key, node, visitor, path) {
      const ctrl = await callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visitAsync_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = await visitAsync_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = await visitAsync_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = await visitAsync_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    function initVisitor(visitor) {
      if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
          Alias: visitor.Node,
          Map: visitor.Node,
          Scalar: visitor.Node,
          Seq: visitor.Node
        }, visitor.Value && {
          Map: visitor.Value,
          Scalar: visitor.Value,
          Seq: visitor.Value
        }, visitor.Collection && {
          Map: visitor.Collection,
          Seq: visitor.Collection
        }, visitor);
      }
      return visitor;
    }
    function callVisitor(key, node, visitor, path) {
      if (typeof visitor === "function")
        return visitor(key, node, path);
      if (identity.isMap(node))
        return visitor.Map?.(key, node, path);
      if (identity.isSeq(node))
        return visitor.Seq?.(key, node, path);
      if (identity.isPair(node))
        return visitor.Pair?.(key, node, path);
      if (identity.isScalar(node))
        return visitor.Scalar?.(key, node, path);
      if (identity.isAlias(node))
        return visitor.Alias?.(key, node, path);
      return void 0;
    }
    function replaceNode(key, path, node) {
      const parent = path[path.length - 1];
      if (identity.isCollection(parent)) {
        parent.items[key] = node;
      } else if (identity.isPair(parent)) {
        if (key === "key")
          parent.key = node;
        else
          parent.value = node;
      } else if (identity.isDocument(parent)) {
        parent.contents = node;
      } else {
        const pt = identity.isAlias(parent) ? "alias" : "scalar";
        throw new Error(`Cannot replace node with ${pt} parent`);
      }
    }
    exports.visit = visit;
    exports.visitAsync = visitAsync;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/doc/directives.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    var escapeChars = {
      "!": "%21",
      ",": "%2C",
      "[": "%5B",
      "]": "%5D",
      "{": "%7B",
      "}": "%7D"
    };
    var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
    var Directives = class _Directives {
      constructor(yaml, tags) {
        this.docStart = null;
        this.docEnd = false;
        this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, _Directives.defaultTags, tags);
      }
      clone() {
        const copy = new _Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
      }
      /**
       * During parsing, get a Directives instance for the current document and
       * update the stream state according to the current version's spec.
       */
      atDocument() {
        const res = new _Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
          case "1.1":
            this.atNextDocument = true;
            break;
          case "1.2":
            this.atNextDocument = false;
            this.yaml = {
              explicit: _Directives.defaultYaml.explicit,
              version: "1.2"
            };
            this.tags = Object.assign({}, _Directives.defaultTags);
            break;
        }
        return res;
      }
      /**
       * @param onError - May be called even if the action was successful
       * @returns `true` on success
       */
      add(line, onError) {
        if (this.atNextDocument) {
          this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
          this.tags = Object.assign({}, _Directives.defaultTags);
          this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name = parts.shift();
        switch (name) {
          case "%TAG": {
            if (parts.length !== 2) {
              onError(0, "%TAG directive should contain exactly two parts");
              if (parts.length < 2)
                return false;
            }
            const [handle, prefix] = parts;
            this.tags[handle] = prefix;
            return true;
          }
          case "%YAML": {
            this.yaml.explicit = true;
            if (parts.length !== 1) {
              onError(0, "%YAML directive should contain exactly one part");
              return false;
            }
            const [version] = parts;
            if (version === "1.1" || version === "1.2") {
              this.yaml.version = version;
              return true;
            } else {
              const isValid = /^\d+\.\d+$/.test(version);
              onError(6, `Unsupported YAML version ${version}`, isValid);
              return false;
            }
          }
          default:
            onError(0, `Unknown directive ${name}`, true);
            return false;
        }
      }
      /**
       * Resolves a tag, matching handles to those defined in %TAG directives.
       *
       * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
       *   `'!local'` tag, or `null` if unresolvable.
       */
      tagName(source, onError) {
        if (source === "!")
          return "!";
        if (source[0] !== "!") {
          onError(`Not a valid tag: ${source}`);
          return null;
        }
        if (source[1] === "<") {
          const verbatim = source.slice(2, -1);
          if (verbatim === "!" || verbatim === "!!") {
            onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
            return null;
          }
          if (source[source.length - 1] !== ">")
            onError("Verbatim tags must end with a >");
          return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
          onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
          try {
            return prefix + decodeURIComponent(suffix);
          } catch (error) {
            onError(String(error));
            return null;
          }
        }
        if (handle === "!")
          return source;
        onError(`Could not resolve tag: ${source}`);
        return null;
      }
      /**
       * Given a fully resolved tag, returns its printable string form,
       * taking into account current tag prefixes and defaults.
       */
      tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
          if (tag.startsWith(prefix))
            return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === "!" ? tag : `!<${tag}>`;
      }
      toString(doc) {
        const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
          const tags = {};
          visit.visit(doc.contents, (_key, node) => {
            if (identity.isNode(node) && node.tag)
              tags[node.tag] = true;
          });
          tagNames = Object.keys(tags);
        } else
          tagNames = [];
        for (const [handle, prefix] of tagEntries) {
          if (handle === "!!" && prefix === "tag:yaml.org,2002:")
            continue;
          if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
            lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join("\n");
      }
    };
    Directives.defaultYaml = { explicit: false, version: "1.2" };
    Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
    exports.Directives = Directives;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/doc/anchors.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    function anchorIsValid(anchor) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit.visit(root, {
        Value(_key, node) {
          if (node.anchor)
            anchors.add(node.anchor);
        }
      });
      return anchors;
    }
    function findNewAnchor(prefix, exclude) {
      for (let i = 1; true; ++i) {
        const name = `${prefix}${i}`;
        if (!exclude.has(name))
          return name;
      }
    }
    function createNodeAnchors(doc, prefix) {
      const aliasObjects = [];
      const sourceObjects = /* @__PURE__ */ new Map();
      let prevAnchors = null;
      return {
        onAnchor: (source) => {
          aliasObjects.push(source);
          prevAnchors ?? (prevAnchors = anchorNames(doc));
          const anchor = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor);
          return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
          for (const source of aliasObjects) {
            const ref = sourceObjects.get(source);
            if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
              ref.node.anchor = ref.anchor;
            } else {
              const error = new Error("Failed to resolve repeated object (this should not happen)");
              error.source = source;
              throw error;
            }
          }
        },
        sourceObjects
      };
    }
    exports.anchorIsValid = anchorIsValid;
    exports.anchorNames = anchorNames;
    exports.createNodeAnchors = createNodeAnchors;
    exports.findNewAnchor = findNewAnchor;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/doc/applyReviver.js"(exports) {
    "use strict";
    function applyReviver(reviver, obj, key, val) {
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (let i = 0, len = val.length; i < len; ++i) {
            const v0 = val[i];
            const v1 = applyReviver(reviver, val, String(i), v0);
            if (v1 === void 0)
              delete val[i];
            else if (v1 !== v0)
              val[i] = v1;
          }
        } else if (val instanceof Map) {
          for (const k of Array.from(val.keys())) {
            const v0 = val.get(k);
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              val.delete(k);
            else if (v1 !== v0)
              val.set(k, v1);
          }
        } else if (val instanceof Set) {
          for (const v0 of Array.from(val)) {
            const v1 = applyReviver(reviver, val, v0, v0);
            if (v1 === void 0)
              val.delete(v0);
            else if (v1 !== v0) {
              val.delete(v0);
              val.add(v1);
            }
          }
        } else {
          for (const [k, v0] of Object.entries(val)) {
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              delete val[k];
            else if (v1 !== v0)
              val[k] = v1;
          }
        }
      }
      return reviver.call(obj, key, val);
    }
    exports.applyReviver = applyReviver;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/nodes/toJS.js"(exports) {
    "use strict";
    var identity = require_identity();
    function toJS(value, arg, ctx) {
      if (Array.isArray(value))
        return value.map((v, i) => toJS(v, String(i), ctx));
      if (value && typeof value.toJSON === "function") {
        if (!ctx || !identity.hasAnchor(value))
          return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: void 0 };
        ctx.anchors.set(value, data);
        ctx.onCreate = (res2) => {
          data.res = res2;
          delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
          ctx.onCreate(res);
        return res;
      }
      if (typeof value === "bigint" && !ctx?.keep)
        return Number(value);
      return value;
    }
    exports.toJS = toJS;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/nodes/Node.js"(exports) {
    "use strict";
    var applyReviver = require_applyReviver();
    var identity = require_identity();
    var toJS = require_toJS();
    var NodeBase = class {
      constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
      }
      /** Create a copy of this node.  */
      clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** A plain JavaScript representation of this node. */
      toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc))
          throw new TypeError("A document argument is required");
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc,
          keep: true,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
    };
    exports.NodeBase = NodeBase;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/nodes/Alias.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var visit = require_visit();
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var Alias = class extends Node.NodeBase {
      constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, "tag", {
          set() {
            throw new Error("Alias nodes cannot have tags");
          }
        });
      }
      /**
       * Resolve the value of this alias within `doc`, finding the last
       * instance of the `source` anchor before this node.
       */
      resolve(doc, ctx) {
        if (ctx?.maxAliasCount === 0)
          throw new ReferenceError("Alias resolution is disabled");
        let nodes;
        if (ctx?.aliasResolveCache) {
          nodes = ctx.aliasResolveCache;
        } else {
          nodes = [];
          visit.visit(doc, {
            Node: (_key, node) => {
              if (identity.isAlias(node) || identity.hasAnchor(node))
                nodes.push(node);
            }
          });
          if (ctx)
            ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node of nodes) {
          if (node === this)
            break;
          if (node.anchor === this.source)
            found = node;
        }
        return found;
      }
      toJSON(_arg, ctx) {
        if (!ctx)
          return { source: this.source };
        const { anchors: anchors2, doc, maxAliasCount } = ctx;
        const source = this.resolve(doc, ctx);
        if (!source) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new ReferenceError(msg);
        }
        let data = anchors2.get(source);
        if (!data) {
          toJS.toJS(source, null, ctx);
          data = anchors2.get(source);
        }
        if (data?.res === void 0) {
          const msg = "This should not happen: Alias anchor was not resolved?";
          throw new ReferenceError(msg);
        }
        if (maxAliasCount >= 0) {
          data.count += 1;
          if (data.aliasCount === 0)
            data.aliasCount = getAliasCount(doc, source, anchors2);
          if (data.count * data.aliasCount > maxAliasCount) {
            const msg = "Excessive alias count indicates a resource exhaustion attack";
            throw new ReferenceError(msg);
          }
        }
        return data.res;
      }
      toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
          anchors.anchorIsValid(this.source);
          if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new Error(msg);
          }
          if (ctx.implicitKey)
            return `${src} `;
        }
        return src;
      }
    };
    function getAliasCount(doc, node, anchors2) {
      if (identity.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors2 && source && anchors2.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
      } else if (identity.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
          const c = getAliasCount(doc, item, anchors2);
          if (c > count)
            count = c;
        }
        return count;
      } else if (identity.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors2);
        const vc = getAliasCount(doc, node.value, anchors2);
        return Math.max(kc, vc);
      }
      return 1;
    }
    exports.Alias = Alias;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/nodes/Scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
    var Scalar = class extends Node.NodeBase {
      constructor(value) {
        super(identity.SCALAR);
        this.value = value;
      }
      toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
      }
      toString() {
        return String(this.value);
      }
    };
    Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
    Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
    Scalar.PLAIN = "PLAIN";
    Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
    Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
    exports.Scalar = Scalar;
    exports.isScalarValue = isScalarValue;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/doc/createNode.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var defaultTagPrefix = "tag:yaml.org,2002:";
    function findTagObject(value, tagName, tags) {
      if (tagName) {
        const match = tags.filter((t) => t.tag === tagName);
        const tagObj = match.find((t) => !t.format) ?? match[0];
        if (!tagObj)
          throw new Error(`Tag ${tagName} not found`);
        return tagObj;
      }
      return tags.find((t) => t.identify?.(value) && !t.format);
    }
    function createNode(value, tagName, ctx) {
      if (identity.isDocument(value))
        value = value.contents;
      if (identity.isNode(value))
        return value;
      if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
      }
      if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
        value = value.valueOf();
      }
      const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
      let ref = void 0;
      if (aliasDuplicateObjects && value && typeof value === "object") {
        ref = sourceObjects.get(value);
        if (ref) {
          ref.anchor ?? (ref.anchor = onAnchor(value));
          return new Alias.Alias(ref.anchor);
        } else {
          ref = { anchor: null, node: null };
          sourceObjects.set(value, ref);
        }
      }
      if (tagName?.startsWith("!!"))
        tagName = defaultTagPrefix + tagName.slice(2);
      let tagObj = findTagObject(value, tagName, schema.tags);
      if (!tagObj) {
        if (value && typeof value.toJSON === "function") {
          value = value.toJSON();
        }
        if (!value || typeof value !== "object") {
          const node2 = new Scalar.Scalar(value);
          if (ref)
            ref.node = node2;
          return node2;
        }
        tagObj = value instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value) ? schema[identity.SEQ] : schema[identity.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
      if (tagName)
        node.tag = tagName;
      else if (!tagObj.default)
        node.tag = tagObj.tag;
      if (ref)
        ref.node = node;
      return node;
    }
    exports.createNode = createNode;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/nodes/Collection.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var identity = require_identity();
    var Node = require_Node();
    function collectionFromPath(schema, path, value) {
      let v = value;
      for (let i = path.length - 1; i >= 0; --i) {
        const k = path[i];
        if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
          const a = [];
          a[k] = v;
          v = a;
        } else {
          v = /* @__PURE__ */ new Map([[k, v]]);
        }
      }
      return createNode.createNode(v, void 0, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
          throw new Error("This should not happen, please report a bug.");
        },
        schema,
        sourceObjects: /* @__PURE__ */ new Map()
      });
    }
    var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
    var Collection = class extends Node.NodeBase {
      constructor(type, schema) {
        super(type);
        Object.defineProperty(this, "schema", {
          value: schema,
          configurable: true,
          enumerable: false,
          writable: true
        });
      }
      /**
       * Create a copy of this collection.
       *
       * @param schema - If defined, overwrites the original's schema
       */
      clone(schema) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
          copy.schema = schema;
        copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /**
       * Adds a value to the collection. For `!!map` and `!!omap` the value must
       * be a Pair instance or a `{ key, value }` object, which may not have a key
       * that already exists in the map.
       */
      addIn(path, value) {
        if (isEmptyPath(path))
          this.add(value);
        else {
          const [key, ...rest] = path;
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.addIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.delete(key);
        const node = this.get(key, true);
        if (identity.isCollection(node))
          return node.deleteIn(rest);
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        const [key, ...rest] = path;
        const node = this.get(key, true);
        if (rest.length === 0)
          return !keepScalar && identity.isScalar(node) ? node.value : node;
        else
          return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every((node) => {
          if (!identity.isPair(node))
            return false;
          const n = node.value;
          return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        const [key, ...rest] = path;
        if (rest.length === 0) {
          this.set(key, value);
        } else {
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.setIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
    };
    exports.Collection = Collection;
    exports.collectionFromPath = collectionFromPath;
    exports.isEmptyPath = isEmptyPath;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/stringify/stringifyComment.js"(exports) {
    "use strict";
    var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
    function indentComment(comment, indent) {
      if (/^\n+$/.test(comment))
        return comment.substring(1);
      return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
    }
    var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
    exports.indentComment = indentComment;
    exports.lineComment = lineComment;
    exports.stringifyComment = stringifyComment;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/stringify/foldFlowLines.js"(exports) {
    "use strict";
    var FOLD_FLOW = "flow";
    var FOLD_BLOCK = "block";
    var FOLD_QUOTED = "quoted";
    function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
      if (!lineWidth || lineWidth < 0)
        return text;
      if (lineWidth < minContentWidth)
        minContentWidth = 0;
      const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
      if (text.length <= endStep)
        return text;
      const folds = [];
      const escapedFolds = {};
      let end = lineWidth - indent.length;
      if (typeof indentAtStart === "number") {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
          folds.push(0);
        else
          end = lineWidth - indentAtStart;
      }
      let split = void 0;
      let prev = void 0;
      let overflow = false;
      let i = -1;
      let escStart = -1;
      let escEnd = -1;
      if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text, i, indent.length);
        if (i !== -1)
          end = i + endStep;
      }
      for (let ch; ch = text[i += 1]; ) {
        if (mode === FOLD_QUOTED && ch === "\\") {
          escStart = i;
          switch (text[i + 1]) {
            case "x":
              i += 3;
              break;
            case "u":
              i += 5;
              break;
            case "U":
              i += 9;
              break;
            default:
              i += 1;
          }
          escEnd = i;
        }
        if (ch === "\n") {
          if (mode === FOLD_BLOCK)
            i = consumeMoreIndentedLines(text, i, indent.length);
          end = i + indent.length + endStep;
          split = void 0;
        } else {
          if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
            const next = text[i + 1];
            if (next && next !== " " && next !== "\n" && next !== "	")
              split = i;
          }
          if (i >= end) {
            if (split) {
              folds.push(split);
              end = split + endStep;
              split = void 0;
            } else if (mode === FOLD_QUOTED) {
              while (prev === " " || prev === "	") {
                prev = ch;
                ch = text[i += 1];
                overflow = true;
              }
              const j = i > escEnd + 1 ? i - 2 : escStart - 1;
              if (escapedFolds[j])
                return text;
              folds.push(j);
              escapedFolds[j] = true;
              end = j + endStep;
              split = void 0;
            } else {
              overflow = true;
            }
          }
        }
        prev = ch;
      }
      if (overflow && onOverflow)
        onOverflow();
      if (folds.length === 0)
        return text;
      if (onFold)
        onFold();
      let res = text.slice(0, folds[0]);
      for (let i2 = 0; i2 < folds.length; ++i2) {
        const fold = folds[i2];
        const end2 = folds[i2 + 1] || text.length;
        if (fold === 0)
          res = `
${indent}${text.slice(0, end2)}`;
        else {
          if (mode === FOLD_QUOTED && escapedFolds[fold])
            res += `${text[fold]}\\`;
          res += `
${indent}${text.slice(fold + 1, end2)}`;
        }
      }
      return res;
    }
    function consumeMoreIndentedLines(text, i, indent) {
      let end = i;
      let start = i + 1;
      let ch = text[start];
      while (ch === " " || ch === "	") {
        if (i < start + indent) {
          ch = text[++i];
        } else {
          do {
            ch = text[++i];
          } while (ch && ch !== "\n");
          end = i;
          start = i + 1;
          ch = text[start];
        }
      }
      return end;
    }
    exports.FOLD_BLOCK = FOLD_BLOCK;
    exports.FOLD_FLOW = FOLD_FLOW;
    exports.FOLD_QUOTED = FOLD_QUOTED;
    exports.foldFlowLines = foldFlowLines;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/stringify/stringifyString.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var foldFlowLines = require_foldFlowLines();
    var getFoldOptions = (ctx, isBlock) => ({
      indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
      lineWidth: ctx.options.lineWidth,
      minContentWidth: ctx.options.minContentWidth
    });
    var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
    function lineLengthOverLimit(str, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0)
        return false;
      const limit = lineWidth - indentLength;
      const strLen = str.length;
      if (strLen <= limit)
        return false;
      for (let i = 0, start = 0; i < strLen; ++i) {
        if (str[i] === "\n") {
          if (i - start > limit)
            return true;
          start = i + 1;
          if (strLen - start <= limit)
            return false;
        }
      }
      return true;
    }
    function doubleQuotedString(value, ctx) {
      const json = JSON.stringify(value);
      if (ctx.options.doubleQuotedAsJSON)
        return json;
      const { implicitKey } = ctx;
      const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      let str = "";
      let start = 0;
      for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
          str += json.slice(start, i) + "\\ ";
          i += 1;
          start = i;
          ch = "\\";
        }
        if (ch === "\\")
          switch (json[i + 1]) {
            case "u":
              {
                str += json.slice(start, i);
                const code = json.substr(i + 2, 4);
                switch (code) {
                  case "0000":
                    str += "\\0";
                    break;
                  case "0007":
                    str += "\\a";
                    break;
                  case "000b":
                    str += "\\v";
                    break;
                  case "001b":
                    str += "\\e";
                    break;
                  case "0085":
                    str += "\\N";
                    break;
                  case "00a0":
                    str += "\\_";
                    break;
                  case "2028":
                    str += "\\L";
                    break;
                  case "2029":
                    str += "\\P";
                    break;
                  default:
                    if (code.substr(0, 2) === "00")
                      str += "\\x" + code.substr(2);
                    else
                      str += json.substr(i, 6);
                }
                i += 5;
                start = i + 1;
              }
              break;
            case "n":
              if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
                i += 1;
              } else {
                str += json.slice(start, i) + "\n\n";
                while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                  str += "\n";
                  i += 2;
                }
                str += indent;
                if (json[i + 2] === " ")
                  str += "\\";
                i += 1;
                start = i + 1;
              }
              break;
            default:
              i += 1;
          }
      }
      str = start ? str + json.slice(start) : json;
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
    }
    function singleQuotedString(value, ctx) {
      if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
        return doubleQuotedString(value, ctx);
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
      return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function quotedString(value, ctx) {
      const { singleQuote } = ctx.options;
      let qs;
      if (singleQuote === false)
        qs = doubleQuotedString;
      else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
          qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
          qs = doubleQuotedString;
        else
          qs = singleQuote ? singleQuotedString : doubleQuotedString;
      }
      return qs(value, ctx);
    }
    var blockEndNewlines;
    try {
      blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
    } catch {
      blockEndNewlines = /\n+(?!\n|$)/g;
    }
    function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
      const { blockQuote, commentString, lineWidth } = ctx.options;
      if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
      }
      const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
      const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
      if (!value)
        return literal ? "|\n" : ">\n";
      let chomp;
      let endStart;
      for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== "\n" && ch !== "	" && ch !== " ")
          break;
      }
      let end = value.substring(endStart);
      const endNlPos = end.indexOf("\n");
      if (endNlPos === -1) {
        chomp = "-";
      } else if (value === end || endNlPos !== end.length - 1) {
        chomp = "+";
        if (onChompKeep)
          onChompKeep();
      } else {
        chomp = "";
      }
      if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === "\n")
          end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
      }
      let startWithSpace = false;
      let startEnd;
      let startNlPos = -1;
      for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === " ")
          startWithSpace = true;
        else if (ch === "\n")
          startNlPos = startEnd;
        else
          break;
      }
      let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
      if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
      }
      const indentSize = indent ? "2" : "1";
      let header = (startWithSpace ? indentSize : "") + chomp;
      if (comment) {
        header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
        if (onComment)
          onComment();
      }
      if (!literal) {
        const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
          foldOptions.onOverflow = () => {
            literalFallback = true;
          };
        }
        const body2 = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
          return `>${header}
${indent}${body2}`;
      }
      value = value.replace(/\n+/g, `$&${indent}`);
      return `|${header}
${indent}${start}${value}${end}`;
    }
    function plainString(item, ctx, onComment, onChompKeep) {
      const { type, value } = item;
      const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
      if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
        return quotedString(value, ctx);
      }
      if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
      }
      if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes("\n")) {
        return blockString(item, ctx, onComment, onChompKeep);
      }
      if (containsDocumentMarker(value)) {
        if (indent === "") {
          ctx.forceBlockIndent = true;
          return blockString(item, ctx, onComment, onChompKeep);
        } else if (implicitKey && indent === indentStep) {
          return quotedString(value, ctx);
        }
      }
      const str = value.replace(/\n+/g, `$&
${indent}`);
      if (actualString) {
        const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
          return quotedString(value, ctx);
      }
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function stringifyString(item, ctx, onComment, onChompKeep) {
      const { implicitKey, inFlow } = ctx;
      const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
      let { type } = item;
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
          type = Scalar.Scalar.QUOTE_DOUBLE;
      }
      const _stringify = (_type) => {
        switch (_type) {
          case Scalar.Scalar.BLOCK_FOLDED:
          case Scalar.Scalar.BLOCK_LITERAL:
            return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
          case Scalar.Scalar.QUOTE_DOUBLE:
            return doubleQuotedString(ss.value, ctx);
          case Scalar.Scalar.QUOTE_SINGLE:
            return singleQuotedString(ss.value, ctx);
          case Scalar.Scalar.PLAIN:
            return plainString(ss, ctx, onComment, onChompKeep);
          default:
            return null;
        }
      };
      let res = _stringify(type);
      if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t = implicitKey && defaultKeyType || defaultStringType;
        res = _stringify(t);
        if (res === null)
          throw new Error(`Unsupported default string type ${t}`);
      }
      return res;
    }
    exports.stringifyString = stringifyString;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/stringify/stringify.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var identity = require_identity();
    var stringifyComment = require_stringifyComment();
    var stringifyString = require_stringifyString();
    function createStringifyContext(doc, options) {
      const opt = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: "PLAIN",
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: "false",
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: "null",
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: "true",
        verifyAliasOrder: true
      }, doc.schema.toStringOptions, options);
      let inFlow;
      switch (opt.collectionStyle) {
        case "block":
          inFlow = false;
          break;
        case "flow":
          inFlow = true;
          break;
        default:
          inFlow = null;
      }
      return {
        anchors: /* @__PURE__ */ new Set(),
        doc,
        flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
        indent: "",
        indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
        inFlow,
        options: opt
      };
    }
    function getTagObject(tags, item) {
      if (item.tag) {
        const match = tags.filter((t) => t.tag === item.tag);
        if (match.length > 0)
          return match.find((t) => t.format === item.format) ?? match[0];
      }
      let tagObj = void 0;
      let obj;
      if (identity.isScalar(item)) {
        obj = item.value;
        let match = tags.filter((t) => t.identify?.(obj));
        if (match.length > 1) {
          const testMatch = match.filter((t) => t.test);
          if (testMatch.length > 0)
            match = testMatch;
        }
        tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
      } else {
        obj = item;
        tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
      }
      if (!tagObj) {
        const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
        throw new Error(`Tag not resolved for ${name} value`);
      }
      return tagObj;
    }
    function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
      if (!doc.directives)
        return "";
      const props = [];
      const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
      if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
      }
      const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
      if (tag)
        props.push(doc.directives.tagString(tag));
      return props.join(" ");
    }
    function stringify(item, ctx, onComment, onChompKeep) {
      if (identity.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
      if (identity.isAlias(item)) {
        if (ctx.doc.directives)
          return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
          throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        } else {
          if (ctx.resolvedAliases)
            ctx.resolvedAliases.add(item);
          else
            ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
          item = item.resolve(ctx.doc);
        }
      }
      let tagObj = void 0;
      const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
      const props = stringifyProps(node, tagObj, ctx);
      if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str;
      return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
    }
    exports.createStringifyContext = createStringifyContext;
    exports.stringify = stringify;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/stringify/stringifyPair.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
      const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
      let keyComment = identity.isNode(key) && key.comment || null;
      if (simpleKeys) {
        if (keyComment) {
          throw new Error("With simple keys, key nodes cannot have comments");
        }
        if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
          const msg = "With simple keys, collection cannot be used as a key value";
          throw new Error(msg);
        }
      }
      let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
      ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
      });
      let keyCommentDone = false;
      let chompKeep = false;
      let str = stringify.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
      if (!explicitKey && !ctx.inFlow && str.length > 1024) {
        if (simpleKeys)
          throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value == null) {
          if (keyCommentDone && onComment)
            onComment();
          return str === "" ? "?" : explicitKey ? `? ${str}` : str;
        }
      } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
        str = `? ${str}`;
        if (keyComment && !keyCommentDone) {
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep)
          onChompKeep();
        return str;
      }
      if (keyCommentDone)
        keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        str = `? ${str}
${indent}:`;
      } else {
        str = `${str}:`;
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      }
      let vsb, vcb, valueComment;
      if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
      } else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === "object")
          value = doc.createNode(value);
      }
      ctx.implicitKey = false;
      if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str.length + 1;
      chompKeep = false;
      if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
        ctx.indent = ctx.indent.substring(2);
      }
      let valueCommentDone = false;
      const valueStr = stringify.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
      let ws = " ";
      if (keyComment || vsb || vcb) {
        ws = vsb ? "\n" : "";
        if (vcb) {
          const cs = commentString(vcb);
          ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === "" && !ctx.inFlow) {
          if (ws === "\n" && valueComment)
            ws = "\n\n";
        } else {
          ws += `
${ctx.indent}`;
        }
      } else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf("\n");
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
          let hasPropsLine = false;
          if (hasNewline && (vs0 === "&" || vs0 === "!")) {
            let sp0 = valueStr.indexOf(" ");
            if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
              sp0 = valueStr.indexOf(" ", sp0 + 1);
            }
            if (sp0 === -1 || nl0 < sp0)
              hasPropsLine = true;
          }
          if (!hasPropsLine)
            ws = `
${ctx.indent}`;
        }
      } else if (valueStr === "" || valueStr[0] === "\n") {
        ws = "";
      }
      str += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment)
          onComment();
      } else if (valueComment && !valueCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str;
    }
    exports.stringifyPair = stringifyPair;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/log.js
var require_log = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/log.js"(exports) {
    "use strict";
    var node_process = __require("process");
    function debug(logLevel, ...messages) {
      if (logLevel === "debug")
        console.log(...messages);
    }
    function warn(logLevel, warning) {
      if (logLevel === "debug" || logLevel === "warn") {
        if (typeof node_process.emitWarning === "function")
          node_process.emitWarning(warning);
        else
          console.warn(warning);
      }
    }
    exports.debug = debug;
    exports.warn = warn;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/schema/yaml-1.1/merge.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var MERGE_KEY = "<<";
    var merge = {
      identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
      default: "key",
      tag: "tag:yaml.org,2002:merge",
      test: /^<<$/,
      resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
      }),
      stringify: () => MERGE_KEY
    };
    var isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
    function addMergeToJSMap(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (identity.isSeq(source))
        for (const it of source.items)
          mergeValue(ctx, map, it);
      else if (Array.isArray(source))
        for (const it of source)
          mergeValue(ctx, map, it);
      else
        mergeValue(ctx, map, source);
    }
    function mergeValue(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (!identity.isMap(source))
        throw new Error("Merge sources must be maps or map aliases");
      const srcMap = source.toJSON(null, ctx, Map);
      for (const [key, value2] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key))
            map.set(key, value2);
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
          Object.defineProperty(map, key, {
            value: value2,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      return map;
    }
    function resolveAliasValue(ctx, value) {
      return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
    }
    exports.addMergeToJSMap = addMergeToJSMap;
    exports.isMergeKey = isMergeKey;
    exports.merge = merge;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/nodes/addPairToJSMap.js"(exports) {
    "use strict";
    var log = require_log();
    var merge = require_merge();
    var stringify = require_stringify();
    var identity = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key, value }) {
      if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
      else if (merge.isMergeKey(ctx, key))
        merge.addMergeToJSMap(ctx, map, value);
      else {
        const jsKey = toJS.toJS(key, "", ctx);
        if (map instanceof Map) {
          map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        } else if (map instanceof Set) {
          map.add(jsKey);
        } else {
          const stringKey = stringifyKey(key, jsKey, ctx);
          const jsValue = toJS.toJS(value, stringKey, ctx);
          if (stringKey in map)
            Object.defineProperty(map, stringKey, {
              value: jsValue,
              writable: true,
              enumerable: true,
              configurable: true
            });
          else
            map[stringKey] = jsValue;
        }
      }
      return map;
    }
    function stringifyKey(key, jsKey, ctx) {
      if (jsKey === null)
        return "";
      if (typeof jsKey !== "object")
        return String(jsKey);
      if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify.createStringifyContext(ctx.doc, {});
        strCtx.anchors = /* @__PURE__ */ new Set();
        for (const node of ctx.anchors.keys())
          strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
          let jsonStr = JSON.stringify(strKey);
          if (jsonStr.length > 40)
            jsonStr = jsonStr.substring(0, 36) + '..."';
          log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
          ctx.mapKeyWarned = true;
        }
        return strKey;
      }
      return JSON.stringify(jsKey);
    }
    exports.addPairToJSMap = addPairToJSMap;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/nodes/Pair.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyPair = require_stringifyPair();
    var addPairToJSMap = require_addPairToJSMap();
    var identity = require_identity();
    function createPair(key, value, ctx) {
      const k = createNode.createNode(key, void 0, ctx);
      const v = createNode.createNode(value, void 0, ctx);
      return new Pair(k, v);
    }
    var Pair = class _Pair {
      constructor(key, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value;
      }
      clone(schema) {
        let { key, value } = this;
        if (identity.isNode(key))
          key = key.clone(schema);
        if (identity.isNode(value))
          value = value.clone(schema);
        return new _Pair(key, value);
      }
      toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
      }
      toString(ctx, onComment, onChompKeep) {
        return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
      }
    };
    exports.Pair = Pair;
    exports.createPair = createPair;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/stringify/stringifyCollection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyCollection(collection, ctx, options) {
      const flow = ctx.inFlow ?? collection.flow;
      const stringify2 = flow ? stringifyFlowCollection : stringifyBlockCollection;
      return stringify2(collection, ctx, options);
    }
    function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
      const { indent, options: { commentString } } = ctx;
      const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
      let chompKeep = false;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment2 = null;
        if (identity.isNode(item)) {
          if (!chompKeep && item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
          if (item.comment)
            comment2 = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (!chompKeep && ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
          }
        }
        chompKeep = false;
        let str2 = stringify.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
        if (comment2)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment2));
        if (chompKeep && comment2)
          chompKeep = false;
        lines.push(blockItemPrefix + str2);
      }
      let str;
      if (lines.length === 0) {
        str = flowChars.start + flowChars.end;
      } else {
        str = lines[0];
        for (let i = 1; i < lines.length; ++i) {
          const line = lines[i];
          str += line ? `
${indent}${line}` : "\n";
        }
      }
      if (comment) {
        str += "\n" + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
          onComment();
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
      const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
      itemIndent += indentStep;
      const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
      });
      let reqNewline = false;
      let linesAtValue = 0;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
          if (item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, false);
          if (item.comment)
            comment = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, false);
            if (ik.comment)
              reqNewline = true;
          }
          const iv = identity.isNode(item.value) ? item.value : null;
          if (iv) {
            if (iv.comment)
              comment = iv.comment;
            if (iv.commentBefore)
              reqNewline = true;
          } else if (item.value == null && ik?.comment) {
            comment = ik.comment;
          }
        }
        if (comment)
          reqNewline = true;
        let str = stringify.stringify(item, itemCtx, () => comment = null);
        reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
        if (i < items.length - 1) {
          str += ",";
        } else if (ctx.options.trailingComma) {
          if (ctx.options.lineWidth > 0) {
            reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
          }
          if (reqNewline) {
            str += ",";
          }
        }
        if (comment)
          str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        lines.push(str);
        linesAtValue = lines.length;
      }
      const { start, end } = flowChars;
      if (lines.length === 0) {
        return start + end;
      } else {
        if (!reqNewline) {
          const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
          reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
          let str = start;
          for (const line of lines)
            str += line ? `
${indentStep}${indent}${line}` : "\n";
          return `${str}
${indent}${end}`;
        } else {
          return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
        }
      }
    }
    function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
      if (comment && chompKeep)
        comment = comment.replace(/^\n+/, "");
      if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart());
      }
    }
    exports.stringifyCollection = stringifyCollection;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/nodes/YAMLMap.js"(exports) {
    "use strict";
    var stringifyCollection = require_stringifyCollection();
    var addPairToJSMap = require_addPairToJSMap();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    function findPair(items, key) {
      const k = identity.isScalar(key) ? key.value : key;
      for (const it of items) {
        if (identity.isPair(it)) {
          if (it.key === key || it.key === k)
            return it;
          if (identity.isScalar(it.key) && it.key.value === k)
            return it;
        }
      }
      return void 0;
    }
    var YAMLMap = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:map";
      }
      constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
      }
      /**
       * A generic collection parsing method that can be extended
       * to other node classes that inherit from YAMLMap
       */
      static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value) => {
          if (typeof replacer === "function")
            value = replacer.call(obj, key, value);
          else if (Array.isArray(replacer) && !replacer.includes(key))
            return;
          if (value !== void 0 || keepUndefined)
            map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
          for (const [key, value] of obj)
            add(key, value);
        } else if (obj && typeof obj === "object") {
          for (const key of Object.keys(obj))
            add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === "function") {
          map.items.sort(schema.sortMapEntries);
        }
        return map;
      }
      /**
       * Adds a value to the collection.
       *
       * @param overwrite - If not set `true`, using a key that is already in the
       *   collection will throw. Otherwise, overwrites the previous value.
       */
      add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
          _pair = pair;
        else if (!pair || typeof pair !== "object" || !("key" in pair)) {
          _pair = new Pair.Pair(pair, pair?.value);
        } else
          _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
          if (!overwrite)
            throw new Error(`Key ${_pair.key} already set`);
          if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
            prev.value.value = _pair.value;
          else
            prev.value = _pair.value;
        } else if (sortEntries) {
          const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
          if (i === -1)
            this.items.push(_pair);
          else
            this.items.splice(i, 0, _pair);
        } else {
          this.items.push(_pair);
        }
      }
      delete(key) {
        const it = findPair(this.items, key);
        if (!it)
          return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node = it?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
      }
      has(key) {
        return !!findPair(this.items, key);
      }
      set(key, value) {
        this.add(new Pair.Pair(key, value), true);
      }
      /**
       * @param ctx - Conversion context, originally set in Document#toJS()
       * @param {Class} Type - If set, forces the returned collection type
       * @returns Instance of Type, Map, or Object
       */
      toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const item of this.items)
          addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        for (const item of this.items) {
          if (!identity.isPair(item))
            throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
          ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "",
          flowChars: { start: "{", end: "}" },
          itemIndent: ctx.indent || "",
          onChompKeep,
          onComment
        });
      }
    };
    exports.YAMLMap = YAMLMap;
    exports.findPair = findPair;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/schema/common/map.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLMap = require_YAMLMap();
    var map = {
      collection: "map",
      default: true,
      nodeClass: YAMLMap.YAMLMap,
      tag: "tag:yaml.org,2002:map",
      resolve(map2, onError) {
        if (!identity.isMap(map2))
          onError("Expected a mapping for this tag");
        return map2;
      },
      createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
    };
    exports.map = map;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/nodes/YAMLSeq.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyCollection = require_stringifyCollection();
    var Collection = require_Collection();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var toJS = require_toJS();
    var YAMLSeq = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:seq";
      }
      constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
      }
      add(value) {
        this.items.push(value);
      }
      /**
       * Removes a value from the collection.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       *
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return void 0;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       */
      has(key) {
        const idx = asItemIndex(key);
        return typeof idx === "number" && idx < this.items.length;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       *
       * If `key` does not contain a representation of an integer, this will throw.
       * It may be wrapped in a `Scalar`.
       */
      set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value))
          prev.value = value;
        else
          this.items[idx] = value;
      }
      toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate)
          ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items)
          seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "- ",
          flowChars: { start: "[", end: "]" },
          itemIndent: (ctx.indent || "") + "  ",
          onChompKeep,
          onComment
        });
      }
      static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
          let i = 0;
          for (let it of obj) {
            if (typeof replacer === "function") {
              const key = obj instanceof Set ? it : String(i++);
              it = replacer.call(obj, key, it);
            }
            seq.items.push(createNode.createNode(it, void 0, ctx));
          }
        }
        return seq;
      }
    };
    function asItemIndex(key) {
      let idx = identity.isScalar(key) ? key.value : key;
      if (idx && typeof idx === "string")
        idx = Number(idx);
      return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
    }
    exports.YAMLSeq = YAMLSeq;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/schema/common/seq.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLSeq = require_YAMLSeq();
    var seq = {
      collection: "seq",
      default: true,
      nodeClass: YAMLSeq.YAMLSeq,
      tag: "tag:yaml.org,2002:seq",
      resolve(seq2, onError) {
        if (!identity.isSeq(seq2))
          onError("Expected a sequence for this tag");
        return seq2;
      },
      createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
    };
    exports.seq = seq;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/schema/common/string.js"(exports) {
    "use strict";
    var stringifyString = require_stringifyString();
    var string = {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
      }
    };
    exports.string = string;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/schema/common/null.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var nullTag = {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^(?:~|[Nn]ull|NULL)?$/,
      resolve: () => new Scalar.Scalar(null),
      stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
    };
    exports.nullTag = nullTag;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/schema/core/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var boolTag = {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
      resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
      stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
          const sv = source[0] === "t" || source[0] === "T";
          if (value === sv)
            return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
      }
    };
    exports.boolTag = boolTag;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/stringify/stringifyNumber.js"(exports) {
    "use strict";
    function stringifyNumber({ format, minFractionDigits, tag, value }) {
      if (typeof value === "bigint")
        return String(value);
      const num = typeof value === "number" ? value : Number(value);
      if (!isFinite(num))
        return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
      let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
      if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
        let i = n.indexOf(".");
        if (i < 0) {
          i = n.length;
          n += ".";
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
          n += "0";
      }
      return n;
    }
    exports.stringifyNumber = stringifyNumber;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/schema/core/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str));
        const dot = str.indexOf(".");
        if (dot !== -1 && str[str.length - 1] === "0")
          node.minFractionDigits = str.length - dot - 1;
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/schema/core/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
      return stringifyNumber.stringifyNumber(node);
    }
    var intOct = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^0o[0-7]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
      stringify: (node) => intStringify(node, 8, "0o")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/schema/core/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.boolTag,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float
    ];
    exports.schema = schema;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/schema/json/schema.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var map = require_map();
    var seq = require_seq();
    function intIdentify(value) {
      return typeof value === "bigint" || Number.isInteger(value);
    }
    var stringifyJSON = ({ value }) => JSON.stringify(value);
    var jsonScalars = [
      {
        identify: (value) => typeof value === "string",
        default: true,
        tag: "tag:yaml.org,2002:str",
        resolve: (str) => str,
        stringify: stringifyJSON
      },
      {
        identify: (value) => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: "tag:yaml.org,2002:null",
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
      },
      {
        identify: (value) => typeof value === "boolean",
        default: true,
        tag: "tag:yaml.org,2002:bool",
        test: /^true$|^false$/,
        resolve: (str) => str === "true",
        stringify: stringifyJSON
      },
      {
        identify: intIdentify,
        default: true,
        tag: "tag:yaml.org,2002:int",
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
      },
      {
        identify: (value) => typeof value === "number",
        default: true,
        tag: "tag:yaml.org,2002:float",
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: (str) => parseFloat(str),
        stringify: stringifyJSON
      }
    ];
    var jsonError = {
      default: true,
      tag: "",
      test: /^/,
      resolve(str, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
        return str;
      }
    };
    var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
    exports.schema = schema;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/schema/yaml-1.1/binary.js"(exports) {
    "use strict";
    var node_buffer = __require("buffer");
    var Scalar = require_Scalar();
    var stringifyString = require_stringifyString();
    var binary = {
      identify: (value) => value instanceof Uint8Array,
      // Buffer inherits from Uint8Array
      default: false,
      tag: "tag:yaml.org,2002:binary",
      /**
       * Returns a Buffer in node and an Uint8Array in browsers
       *
       * To use the resulting buffer as an image, you'll want to do something like:
       *
       *   const blob = new Blob([buffer], { type: 'image/jpeg' })
       *   document.querySelector('#photo').src = URL.createObjectURL(blob)
       */
      resolve(src, onError) {
        if (typeof node_buffer.Buffer === "function") {
          return node_buffer.Buffer.from(src, "base64");
        } else if (typeof atob === "function") {
          const str = atob(src.replace(/[\n\r]/g, ""));
          const buffer = new Uint8Array(str.length);
          for (let i = 0; i < str.length; ++i)
            buffer[i] = str.charCodeAt(i);
          return buffer;
        } else {
          onError("This environment does not support reading binary tags; either Buffer or atob is required");
          return src;
        }
      },
      stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
          return "";
        const buf = value;
        let str;
        if (typeof node_buffer.Buffer === "function") {
          str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
        } else if (typeof btoa === "function") {
          let s = "";
          for (let i = 0; i < buf.length; ++i)
            s += String.fromCharCode(buf[i]);
          str = btoa(s);
        } else {
          throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
          const n = Math.ceil(str.length / lineWidth);
          const lines = new Array(n);
          for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
            lines[i] = str.substr(o, lineWidth);
          }
          str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
        }
        return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
      }
    };
    exports.binary = binary;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/schema/yaml-1.1/pairs.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLSeq = require_YAMLSeq();
    function resolvePairs(seq, onError) {
      if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
          let item = seq.items[i];
          if (identity.isPair(item))
            continue;
          else if (identity.isMap(item)) {
            if (item.items.length > 1)
              onError("Each pair must have its own sequence indicator");
            const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
            if (item.commentBefore)
              pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
            if (item.comment) {
              const cn = pair.value ?? pair.key;
              cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
            }
            item = pair;
          }
          seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
      } else
        onError("Expected a sequence for this tag");
      return seq;
    }
    function createPairs(schema, iterable, ctx) {
      const { replacer } = ctx;
      const pairs2 = new YAMLSeq.YAMLSeq(schema);
      pairs2.tag = "tag:yaml.org,2002:pairs";
      let i = 0;
      if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
          if (typeof replacer === "function")
            it = replacer.call(iterable, String(i++), it);
          let key, value;
          if (Array.isArray(it)) {
            if (it.length === 2) {
              key = it[0];
              value = it[1];
            } else
              throw new TypeError(`Expected [key, value] tuple: ${it}`);
          } else if (it && it instanceof Object) {
            const keys = Object.keys(it);
            if (keys.length === 1) {
              key = keys[0];
              value = it[key];
            } else {
              throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
            }
          } else {
            key = it;
          }
          pairs2.items.push(Pair.createPair(key, value, ctx));
        }
      return pairs2;
    }
    var pairs = {
      collection: "seq",
      default: false,
      tag: "tag:yaml.org,2002:pairs",
      resolve: resolvePairs,
      createNode: createPairs
    };
    exports.createPairs = createPairs;
    exports.pairs = pairs;
    exports.resolvePairs = resolvePairs;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/schema/yaml-1.1/omap.js"(exports) {
    "use strict";
    var identity = require_identity();
    var toJS = require_toJS();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var pairs = require_pairs();
    var YAMLOMap = class _YAMLOMap extends YAMLSeq.YAMLSeq {
      constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = _YAMLOMap.tag;
      }
      /**
       * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
       * but TypeScript won't allow widening the signature of a child method.
       */
      toJSON(_, ctx) {
        if (!ctx)
          return super.toJSON(_);
        const map = /* @__PURE__ */ new Map();
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const pair of this.items) {
          let key, value;
          if (identity.isPair(pair)) {
            key = toJS.toJS(pair.key, "", ctx);
            value = toJS.toJS(pair.value, key, ctx);
          } else {
            key = toJS.toJS(pair, "", ctx);
          }
          if (map.has(key))
            throw new Error("Ordered maps must not include duplicate keys");
          map.set(key, value);
        }
        return map;
      }
      static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap2 = new this();
        omap2.items = pairs$1.items;
        return omap2;
      }
    };
    YAMLOMap.tag = "tag:yaml.org,2002:omap";
    var omap = {
      collection: "seq",
      identify: (value) => value instanceof Map,
      nodeClass: YAMLOMap,
      default: false,
      tag: "tag:yaml.org,2002:omap",
      resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
          if (identity.isScalar(key)) {
            if (seenKeys.includes(key.value)) {
              onError(`Ordered maps must not include duplicate keys: ${key.value}`);
            } else {
              seenKeys.push(key.value);
            }
          }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
      },
      createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
    };
    exports.YAMLOMap = YAMLOMap;
    exports.omap = omap;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/schema/yaml-1.1/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function boolStringify({ value, source }, ctx) {
      const boolObj = value ? trueTag : falseTag;
      if (source && boolObj.test.test(source))
        return source;
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
    var trueTag = {
      identify: (value) => value === true,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
      resolve: () => new Scalar.Scalar(true),
      stringify: boolStringify
    };
    var falseTag = {
      identify: (value) => value === false,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
      resolve: () => new Scalar.Scalar(false),
      stringify: boolStringify
    };
    exports.falseTag = falseTag;
    exports.trueTag = trueTag;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/schema/yaml-1.1/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str.replace(/_/g, "")),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
        const dot = str.indexOf(".");
        if (dot !== -1) {
          const f = str.substring(dot + 1).replace(/_/g, "");
          if (f[f.length - 1] === "0")
            node.minFractionDigits = f.length;
        }
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/schema/yaml-1.1/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    function intResolve(str, offset, radix, { intAsBigInt }) {
      const sign = str[0];
      if (sign === "-" || sign === "+")
        offset += 1;
      str = str.substring(offset).replace(/_/g, "");
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str = `0b${str}`;
            break;
          case 8:
            str = `0o${str}`;
            break;
          case 16:
            str = `0x${str}`;
            break;
        }
        const n2 = BigInt(str);
        return sign === "-" ? BigInt(-1) * n2 : n2;
      }
      const n = parseInt(str, radix);
      return sign === "-" ? -1 * n : n;
    }
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value)) {
        const str = value.toString(radix);
        return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
      }
      return stringifyNumber.stringifyNumber(node);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
      stringify: (node) => intStringify(node, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
      stringify: (node) => intStringify(node, 8, "0")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intBin = intBin;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/schema/yaml-1.1/set.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSet = class _YAMLSet extends YAMLMap.YAMLMap {
      constructor(schema) {
        super(schema);
        this.tag = _YAMLSet.tag;
      }
      add(key) {
        let pair;
        if (identity.isPair(key))
          pair = key;
        else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
          pair = new Pair.Pair(key.key, null);
        else
          pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
          this.items.push(pair);
      }
      /**
       * If `keepPair` is `true`, returns the Pair matching `key`.
       * Otherwise, returns the value of that Pair's key.
       */
      get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
      }
      set(key, value) {
        if (typeof value !== "boolean")
          throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value) {
          this.items.splice(this.items.indexOf(prev), 1);
        } else if (!prev && value) {
          this.items.push(new Pair.Pair(key));
        }
      }
      toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        if (this.hasAllNullValues(true))
          return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
          throw new Error("Set items must all have null values");
      }
      static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set2 = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
          for (let value of iterable) {
            if (typeof replacer === "function")
              value = replacer.call(iterable, value, value);
            set2.items.push(Pair.createPair(value, null, ctx));
          }
        return set2;
      }
    };
    YAMLSet.tag = "tag:yaml.org,2002:set";
    var set = {
      collection: "map",
      identify: (value) => value instanceof Set,
      nodeClass: YAMLSet,
      default: false,
      tag: "tag:yaml.org,2002:set",
      createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
      resolve(map, onError) {
        if (identity.isMap(map)) {
          if (map.hasAllNullValues(true))
            return Object.assign(new YAMLSet(), map);
          else
            onError("Set items must all have null values");
        } else
          onError("Expected a mapping for this tag");
        return map;
      }
    };
    exports.YAMLSet = YAMLSet;
    exports.set = set;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/schema/yaml-1.1/timestamp.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    function parseSexagesimal(str, asBigInt) {
      const sign = str[0];
      const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
      const num = (n) => asBigInt ? BigInt(n) : Number(n);
      const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
      return sign === "-" ? num(-1) * res : res;
    }
    function stringifySexagesimal(node) {
      let { value } = node;
      let num = (n) => n;
      if (typeof value === "bigint")
        num = (n) => BigInt(n);
      else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node);
      let sign = "";
      if (value < 0) {
        sign = "-";
        value *= num(-1);
      }
      const _60 = num(60);
      const parts = [value % _60];
      if (value < 60) {
        parts.unshift(0);
      } else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60);
        if (value >= 60) {
          value = (value - parts[0]) / _60;
          parts.unshift(value);
        }
      }
      return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
    }
    var intTime = {
      identify: (value) => typeof value === "bigint" || Number.isInteger(value),
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
      resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
      stringify: stringifySexagesimal
    };
    var floatTime = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: (str) => parseSexagesimal(str, false),
      stringify: stringifySexagesimal
    };
    var timestamp = {
      identify: (value) => value instanceof Date,
      default: true,
      tag: "tag:yaml.org,2002:timestamp",
      // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
      // may be omitted altogether, resulting in a date format. In such a case, the time part is
      // assumed to be 00:00:00Z (start of day, UTC).
      test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
      resolve(str) {
        const match = str.match(timestamp.test);
        if (!match)
          throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
        let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== "Z") {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30)
            d *= 60;
          date -= 6e4 * d;
        }
        return new Date(date);
      },
      stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
    };
    exports.floatTime = floatTime;
    exports.intTime = intTime;
    exports.timestamp = timestamp;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/schema/yaml-1.1/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var binary = require_binary();
    var bool = require_bool2();
    var float = require_float2();
    var int = require_int2();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set = require_set();
    var timestamp = require_timestamp();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.trueTag,
      bool.falseTag,
      int.intBin,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge.merge,
      omap.omap,
      pairs.pairs,
      set.set,
      timestamp.intTime,
      timestamp.floatTime,
      timestamp.timestamp
    ];
    exports.schema = schema;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/schema/tags.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = require_schema();
    var schema$1 = require_schema2();
    var binary = require_binary();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema3();
    var set = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ["core", schema.schema],
      ["failsafe", [map.map, seq.seq, string.string]],
      ["json", schema$1.schema],
      ["yaml11", schema$2.schema],
      ["yaml-1.1", schema$2.schema]
    ]);
    var tagsByName = {
      binary: binary.binary,
      bool: bool.boolTag,
      float: float.float,
      floatExp: float.floatExp,
      floatNaN: float.floatNaN,
      floatTime: timestamp.floatTime,
      int: int.int,
      intHex: int.intHex,
      intOct: int.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge.merge,
      null: _null.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set.set,
      timestamp: timestamp.timestamp
    };
    var coreKnownTags = {
      "tag:yaml.org,2002:binary": binary.binary,
      "tag:yaml.org,2002:merge": merge.merge,
      "tag:yaml.org,2002:omap": omap.omap,
      "tag:yaml.org,2002:pairs": pairs.pairs,
      "tag:yaml.org,2002:set": set.set,
      "tag:yaml.org,2002:timestamp": timestamp.timestamp
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
      }
      let tags = schemaTags;
      if (!tags) {
        if (Array.isArray(customTags))
          tags = [];
        else {
          const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
      }
      if (Array.isArray(customTags)) {
        for (const tag of customTags)
          tags = tags.concat(tag);
      } else if (typeof customTags === "function") {
        tags = customTags(tags.slice());
      }
      if (addMergeTag)
        tags = tags.concat(merge.merge);
      return tags.reduce((tags2, tag) => {
        const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
        if (!tagObj) {
          const tagName = JSON.stringify(tag);
          const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags2.includes(tagObj))
          tags2.push(tagObj);
        return tags2;
      }, []);
    }
    exports.coreKnownTags = coreKnownTags;
    exports.getTags = getTags;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/schema/Schema.js"(exports) {
    "use strict";
    var identity = require_identity();
    var map = require_map();
    var seq = require_seq();
    var string = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    var Schema = class _Schema {
      constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
        this.name = typeof schema === "string" && schema || "core";
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
      }
      clone() {
        const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
      }
    };
    exports.Schema = Schema;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/stringify/stringifyDocument.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyDocument(doc, options) {
      const lines = [];
      let hasDirectives = options.directives === true;
      if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
          lines.push(dir);
          hasDirectives = true;
        } else if (doc.directives.docStart)
          hasDirectives = true;
      }
      if (hasDirectives)
        lines.push("---");
      const ctx = stringify.createStringifyContext(doc, options);
      const { commentString } = ctx.options;
      if (doc.commentBefore) {
        if (lines.length !== 1)
          lines.unshift("");
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ""));
      }
      let chompKeep = false;
      let contentComment = null;
      if (doc.contents) {
        if (identity.isNode(doc.contents)) {
          if (doc.contents.spaceBefore && hasDirectives)
            lines.push("");
          if (doc.contents.commentBefore) {
            const cs = commentString(doc.contents.commentBefore);
            lines.push(stringifyComment.indentComment(cs, ""));
          }
          ctx.forceBlockIndent = !!doc.comment;
          contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
        let body2 = stringify.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
        if (contentComment)
          body2 += stringifyComment.lineComment(body2, "", commentString(contentComment));
        if ((body2[0] === "|" || body2[0] === ">") && lines[lines.length - 1] === "---") {
          lines[lines.length - 1] = `--- ${body2}`;
        } else
          lines.push(body2);
      } else {
        lines.push(stringify.stringify(doc.contents, ctx));
      }
      if (doc.directives?.docEnd) {
        if (doc.comment) {
          const cs = commentString(doc.comment);
          if (cs.includes("\n")) {
            lines.push("...");
            lines.push(stringifyComment.indentComment(cs, ""));
          } else {
            lines.push(`... ${cs}`);
          }
        } else {
          lines.push("...");
        }
      } else {
        let dc = doc.comment;
        if (dc && chompKeep)
          dc = dc.replace(/^\n+/, "");
        if (dc) {
          if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
            lines.push("");
          lines.push(stringifyComment.indentComment(commentString(dc), ""));
        }
      }
      return lines.join("\n") + "\n";
    }
    exports.stringifyDocument = stringifyDocument;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/doc/Document.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var toJS = require_toJS();
    var Schema = require_Schema();
    var stringifyDocument = require_stringifyDocument();
    var anchors = require_anchors();
    var applyReviver = require_applyReviver();
    var createNode = require_createNode();
    var directives = require_directives();
    var Document = class _Document {
      constructor(value, replacer, options) {
        this.commentBefore = null;
        this.comment = null;
        this.errors = [];
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === "function" || Array.isArray(replacer)) {
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const opt = Object.assign({
          intAsBigInt: false,
          keepSourceTokens: false,
          logLevel: "warn",
          prettyErrors: true,
          strict: true,
          stringKeys: false,
          uniqueKeys: true,
          version: "1.2"
        }, options);
        this.options = opt;
        let { version } = opt;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit)
            version = this.directives.yaml.version;
        } else
          this.directives = new directives.Directives({ version });
        this.setSchema(version, options);
        this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
      }
      /**
       * Create a deep copy of this Document and its contents.
       *
       * Custom Node values that inherit from `Object` still refer to their original instances.
       */
      clone() {
        const copy = Object.create(_Document.prototype, {
          [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
          copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** Adds a value to the document. */
      add(value) {
        if (assertCollection(this.contents))
          this.contents.add(value);
      }
      /** Adds a value to the document. */
      addIn(path, value) {
        if (assertCollection(this.contents))
          this.contents.addIn(path, value);
      }
      /**
       * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
       *
       * If `node` already has an anchor, `name` is ignored.
       * Otherwise, the `node.anchor` value will be set to `name`,
       * or if an anchor with that name is already present in the document,
       * `name` will be used as a prefix for a new unique anchor.
       * If `name` is undefined, the generated anchor will use 'a' as a prefix.
       */
      createAlias(node, name) {
        if (!node.anchor) {
          const prev = anchors.anchorNames(this);
          node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
        }
        return new Alias.Alias(node.anchor);
      }
      createNode(value, replacer, options) {
        let _replacer = void 0;
        if (typeof replacer === "function") {
          value = replacer.call({ "": value }, "", value);
          _replacer = replacer;
        } else if (Array.isArray(replacer)) {
          const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
          const asStr = replacer.filter(keyToStr).map(String);
          if (asStr.length > 0)
            replacer = replacer.concat(asStr);
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(
          this,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          anchorPrefix || "a"
        );
        const ctx = {
          aliasDuplicateObjects: aliasDuplicateObjects ?? true,
          keepUndefined: keepUndefined ?? false,
          onAnchor,
          onTagObj,
          replacer: _replacer,
          schema: this.schema,
          sourceObjects
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node))
          node.flow = true;
        setAnchors();
        return node;
      }
      /**
       * Convert a key and a value into a `Pair` using the current schema,
       * recursively wrapping all values as `Scalar` or `Collection` nodes.
       */
      createPair(key, value, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        if (Collection.isEmptyPath(path)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      get(key, keepScalar) {
        return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
      }
      /**
       * Returns item at `path`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        if (Collection.isEmptyPath(path))
          return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity.isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
      }
      /**
       * Checks if the document includes a value with the key `key`.
       */
      has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
      }
      /**
       * Checks if the document includes a value at `path`.
       */
      hasIn(path) {
        if (Collection.isEmptyPath(path))
          return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path) : false;
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      set(key, value) {
        if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, [key], value);
        } else if (assertCollection(this.contents)) {
          this.contents.set(key, value);
        }
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        if (Collection.isEmptyPath(path)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path, value);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version, options = {}) {
        if (typeof version === "number")
          version = String(version);
        let opt;
        switch (version) {
          case "1.1":
            if (this.directives)
              this.directives.yaml.version = "1.1";
            else
              this.directives = new directives.Directives({ version: "1.1" });
            opt = { resolveKnownTags: false, schema: "yaml-1.1" };
            break;
          case "1.2":
          case "next":
            if (this.directives)
              this.directives.yaml.version = version;
            else
              this.directives = new directives.Directives({ version });
            opt = { resolveKnownTags: true, schema: "core" };
            break;
          case null:
            if (this.directives)
              delete this.directives;
            opt = null;
            break;
          default: {
            const sv = JSON.stringify(version);
            throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
          }
        }
        if (options.schema instanceof Object)
          this.schema = options.schema;
        else if (opt)
          this.schema = new Schema.Schema(Object.assign(opt, options));
        else
          throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
      }
      // json & jsonArg are only used from toJSON()
      toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: this,
          keep: !json,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
      /**
       * A JSON representation of the document `contents`.
       *
       * @param jsonArg Used by `JSON.stringify` to indicate the array index or
       *   property name.
       */
      toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
      }
      /** A YAML representation of the document. */
      toString(options = {}) {
        if (this.errors.length > 0)
          throw new Error("Document with errors cannot be stringified");
        if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
          const s = JSON.stringify(options.indent);
          throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
      }
    };
    function assertCollection(contents) {
      if (identity.isCollection(contents))
        return true;
      throw new Error("Expected a YAML collection as document contents");
    }
    exports.Document = Document;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/errors.js
var require_errors = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/errors.js"(exports) {
    "use strict";
    var YAMLError = class extends Error {
      constructor(name, pos, code, message) {
        super();
        this.name = name;
        this.code = code;
        this.message = message;
        this.pos = pos;
      }
    };
    var YAMLParseError = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLParseError", pos, code, message);
      }
    };
    var YAMLWarning = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLWarning", pos, code, message);
      }
    };
    var prettifyError = (src, lc) => (error) => {
      if (error.pos[0] === -1)
        return;
      error.linePos = error.pos.map((pos) => lc.linePos(pos));
      const { line, col } = error.linePos[0];
      error.message += ` at line ${line}, column ${col}`;
      let ci = col - 1;
      let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
      if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = "\u2026" + lineStr.substring(trimStart);
        ci -= trimStart - 1;
      }
      if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + "\u2026";
      if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
          prev = prev.substring(0, 79) + "\u2026\n";
        lineStr = prev + lineStr;
      }
      if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = " ".repeat(ci) + "^".repeat(count);
        error.message += `:

${lineStr}
${pointer}
`;
      }
    };
    exports.YAMLError = YAMLError;
    exports.YAMLParseError = YAMLParseError;
    exports.YAMLWarning = YAMLWarning;
    exports.prettifyError = prettifyError;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/compose/resolve-props.js"(exports) {
    "use strict";
    function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
      let spaceBefore = false;
      let atNewline = startOnNewline;
      let hasSpace = startOnNewline;
      let comment = "";
      let commentSep = "";
      let hasNewline = false;
      let reqSpace = false;
      let tab = null;
      let anchor = null;
      let tag = null;
      let newlineAfterProp = null;
      let comma = null;
      let found = null;
      let start = null;
      for (const token2 of tokens) {
        if (reqSpace) {
          if (token2.type !== "space" && token2.type !== "newline" && token2.type !== "comma")
            onError(token2.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
          reqSpace = false;
        }
        if (tab) {
          if (atNewline && token2.type !== "comment" && token2.type !== "newline") {
            onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
          }
          tab = null;
        }
        switch (token2.type) {
          case "space":
            if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token2.source.includes("	")) {
              tab = token2;
            }
            hasSpace = true;
            break;
          case "comment": {
            if (!hasSpace)
              onError(token2, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = token2.source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += commentSep + cb;
            commentSep = "";
            atNewline = false;
            break;
          }
          case "newline":
            if (atNewline) {
              if (comment)
                comment += token2.source;
              else if (!found || indicator !== "seq-item-ind")
                spaceBefore = true;
            } else
              commentSep += token2.source;
            atNewline = true;
            hasNewline = true;
            if (anchor || tag)
              newlineAfterProp = token2;
            hasSpace = true;
            break;
          case "anchor":
            if (anchor)
              onError(token2, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
            if (token2.source.endsWith(":"))
              onError(token2.offset + token2.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
            anchor = token2;
            start ?? (start = token2.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          case "tag": {
            if (tag)
              onError(token2, "MULTIPLE_TAGS", "A node can have at most one tag");
            tag = token2;
            start ?? (start = token2.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          }
          case indicator:
            if (anchor || tag)
              onError(token2, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token2.source} indicator`);
            if (found)
              onError(token2, "UNEXPECTED_TOKEN", `Unexpected ${token2.source} in ${flow ?? "collection"}`);
            found = token2;
            atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
            hasSpace = false;
            break;
          case "comma":
            if (flow) {
              if (comma)
                onError(token2, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
              comma = token2;
              atNewline = false;
              hasSpace = false;
              break;
            }
          // else fallthrough
          default:
            onError(token2, "UNEXPECTED_TOKEN", `Unexpected ${token2.type} token`);
            atNewline = false;
            hasSpace = false;
        }
      }
      const last = tokens[tokens.length - 1];
      const end = last ? last.offset + last.source.length : offset;
      if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
        onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      }
      if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
      };
    }
    exports.resolveProps = resolveProps;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/compose/util-contains-newline.js"(exports) {
    "use strict";
    function containsNewline(key) {
      if (!key)
        return null;
      switch (key.type) {
        case "alias":
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          if (key.source.includes("\n"))
            return true;
          if (key.end) {
            for (const st of key.end)
              if (st.type === "newline")
                return true;
          }
          return false;
        case "flow-collection":
          for (const it of key.items) {
            for (const st of it.start)
              if (st.type === "newline")
                return true;
            if (it.sep) {
              for (const st of it.sep)
                if (st.type === "newline")
                  return true;
            }
            if (containsNewline(it.key) || containsNewline(it.value))
              return true;
          }
          return false;
        default:
          return true;
      }
    }
    exports.containsNewline = containsNewline;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/compose/util-flow-indent-check.js"(exports) {
    "use strict";
    var utilContainsNewline = require_util_contains_newline();
    function flowIndentCheck(indent, fc, onError) {
      if (fc?.type === "flow-collection") {
        const end = fc.end[0];
        if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
          const msg = "Flow end indicator should be more indented than parent";
          onError(end, "BAD_INDENT", msg, true);
        }
      }
    }
    exports.flowIndentCheck = flowIndentCheck;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/compose/util-map-includes.js"(exports) {
    "use strict";
    var identity = require_identity();
    function mapIncludes(ctx, items, search) {
      const { uniqueKeys } = ctx.options;
      if (uniqueKeys === false)
        return false;
      const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
      return items.some((pair) => isEqual(pair.key, search));
    }
    exports.mapIncludes = mapIncludes;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/compose/resolve-block-map.js"(exports) {
    "use strict";
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    var utilMapIncludes = require_util_map_includes();
    var startColMsg = "All mapping items must start at the same column";
    function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
      const map = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      let offset = bm.offset;
      let commentEnd = null;
      for (const collItem of bm.items) {
        const { start, key, sep, value } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: bm.indent,
          startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
          if (key) {
            if (key.type === "block-seq")
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
            else if ("indent" in key && key.indent !== bm.indent)
              onError(offset, "BAD_INDENT", startColMsg);
          }
          if (!keyProps.anchor && !keyProps.tag && !sep) {
            commentEnd = keyProps.end;
            if (keyProps.comment) {
              if (map.comment)
                map.comment += "\n" + keyProps.comment;
              else
                map.comment = keyProps.comment;
            }
            continue;
          }
          if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
            onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
          }
        } else if (keyProps.found?.indent !== bm.indent) {
          onError(offset, "BAD_INDENT", startColMsg);
        }
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        const valueProps = resolveProps.resolveProps(sep ?? [], {
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: bm.indent,
          startOnNewline: !key || key.type === "block-scalar"
        });
        offset = valueProps.end;
        if (valueProps.found) {
          if (implicitKey) {
            if (value?.type === "block-map" && !valueProps.hasNewline)
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
            if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
              onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
          if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
          offset = valueNode.range[2];
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        } else {
          if (implicitKey)
            onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
          if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        }
      }
      if (commentEnd && commentEnd < offset)
        onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
      map.range = [bm.offset, offset, commentEnd ?? offset];
      return map;
    }
    exports.resolveBlockMap = resolveBlockMap;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/compose/resolve-block-seq.js"(exports) {
    "use strict";
    var YAMLSeq = require_YAMLSeq();
    var resolveProps = require_resolve_props();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
      const seq = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = bs.offset;
      let commentEnd = null;
      for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
          indicator: "seq-item-ind",
          next: value,
          offset,
          onError,
          parentIndent: bs.indent,
          startOnNewline: true
        });
        if (!props.found) {
          if (props.anchor || props.tag || value) {
            if (value?.type === "block-seq")
              onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
            else
              onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
          } else {
            commentEnd = props.end;
            if (props.comment)
              seq.comment = props.comment;
            continue;
          }
        }
        const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
      }
      seq.range = [bs.offset, offset, commentEnd ?? offset];
      return seq;
    }
    exports.resolveBlockSeq = resolveBlockSeq;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/compose/resolve-end.js"(exports) {
    "use strict";
    function resolveEnd(end, offset, reqSpace, onError) {
      let comment = "";
      if (end) {
        let hasSpace = false;
        let sep = "";
        for (const token2 of end) {
          const { source, type } = token2;
          switch (type) {
            case "space":
              hasSpace = true;
              break;
            case "comment": {
              if (reqSpace && !hasSpace)
                onError(token2, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
              const cb = source.substring(1) || " ";
              if (!comment)
                comment = cb;
              else
                comment += sep + cb;
              sep = "";
              break;
            }
            case "newline":
              if (comment)
                sep += source;
              hasSpace = true;
              break;
            default:
              onError(token2, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
          }
          offset += source.length;
        }
      }
      return { comment, offset };
    }
    exports.resolveEnd = resolveEnd;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/compose/resolve-flow-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilMapIncludes = require_util_map_includes();
    var blockMsg = "Block collections are not allowed within flow collections";
    var isBlock = (token2) => token2 && (token2.type === "block-map" || token2.type === "block-seq");
    function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
      const isMap = fc.start.source === "{";
      const fcName = isMap ? "flow map" : "flow sequence";
      const NodeClass = tag?.nodeClass ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
      const coll = new NodeClass(ctx.schema);
      coll.flow = true;
      const atRoot = ctx.atRoot;
      if (atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = fc.offset + fc.start.source.length;
      for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep, value } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep && !value) {
            if (i === 0 && props.comma)
              onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
            else if (i < fc.items.length - 1)
              onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
            if (props.comment) {
              if (coll.comment)
                coll.comment += "\n" + props.comment;
              else
                coll.comment = props.comment;
            }
            offset = props.end;
            continue;
          }
          if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key))
            onError(
              key,
              // checked by containsNewline()
              "MULTILINE_IMPLICIT_KEY",
              "Implicit keys of flow sequence pairs need to be on a single line"
            );
        }
        if (i === 0) {
          if (props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        } else {
          if (!props.comma)
            onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
          if (props.comment) {
            let prevItemComment = "";
            loop: for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
            if (prevItemComment) {
              let prev = coll.items[coll.items.length - 1];
              if (identity.isPair(prev))
                prev = prev.value ?? prev.key;
              if (prev.comment)
                prev.comment += "\n" + prevItemComment;
              else
                prev.comment = prevItemComment;
              props.comment = props.comment.substring(prevItemComment.length + 1);
            }
          }
        }
        if (!isMap && !sep && !props.found) {
          const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep, null, props, onError);
          coll.items.push(valueNode);
          offset = valueNode.range[2];
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else {
          ctx.atKey = true;
          const keyStart = props.end;
          const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
          if (isBlock(key))
            onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
          ctx.atKey = false;
          const valueProps = resolveProps.resolveProps(sep ?? [], {
            flow: fcName,
            indicator: "map-value-ind",
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
          });
          if (valueProps.found) {
            if (!isMap && !props.found && ctx.options.strict) {
              if (sep)
                for (const st of sep) {
                  if (st === valueProps.found)
                    break;
                  if (st.type === "newline") {
                    onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                    break;
                  }
                }
              if (props.start < valueProps.found.offset - 1024)
                onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
            }
          } else if (value) {
            if ("source" in value && value.source?.[0] === ":")
              onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
            else
              onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError) : null;
          if (valueNode) {
            if (isBlock(value))
              onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
          } else if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          if (isMap) {
            const map = coll;
            if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
              onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
            map.items.push(pair);
          } else {
            const map = new YAMLMap.YAMLMap(ctx.schema);
            map.flow = true;
            map.items.push(pair);
            const endRange = (valueNode ?? keyNode).range;
            map.range = [keyNode.range[0], endRange[1], endRange[2]];
            coll.items.push(map);
          }
          offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
      }
      const expectedEnd = isMap ? "}" : "]";
      const [ce, ...ee] = fc.end;
      let cePos = offset;
      if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
      else {
        const name = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
        if (ce && ce.source.length !== 1)
          ee.unshift(ce);
      }
      if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
          if (coll.comment)
            coll.comment += "\n" + end.comment;
          else
            coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
      } else {
        coll.range = [fc.offset, cePos, cePos];
      }
      return coll;
    }
    exports.resolveFlowCollection = resolveFlowCollection;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/compose/compose-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveBlockMap = require_resolve_block_map();
    var resolveBlockSeq = require_resolve_block_seq();
    var resolveFlowCollection = require_resolve_flow_collection();
    function resolveCollection(CN, ctx, token2, onError, tagName, tag) {
      const coll = token2.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token2, onError, tag) : token2.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token2, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token2, onError, tag);
      const Coll = coll.constructor;
      if (tagName === "!" || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
      }
      if (tagName)
        coll.tag = tagName;
      return coll;
    }
    function composeCollection(CN, ctx, token2, props, onError) {
      const tagToken = props.tag;
      const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
      if (token2.type === "block-seq") {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
          const message = "Missing newline after block sequence props";
          onError(lastProp, "MISSING_CHAR", message);
        }
      }
      const expType = token2.type === "block-map" ? "map" : token2.type === "block-seq" ? "seq" : token2.start.source === "{" ? "map" : "seq";
      if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
        return resolveCollection(CN, ctx, token2, onError, tagName);
      }
      let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
      if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
          ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
          tag = kt;
        } else {
          if (kt) {
            onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
          } else {
            onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
          }
          return resolveCollection(CN, ctx, token2, onError, tagName);
        }
      }
      const coll = resolveCollection(CN, ctx, token2, onError, tagName, tag);
      const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
      const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
      node.range = coll.range;
      node.tag = tagName;
      if (tag?.format)
        node.format = tag.format;
      return node;
    }
    exports.composeCollection = composeCollection;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/compose/resolve-block-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function resolveBlockScalar(ctx, scalar, onError) {
      const start = scalar.offset;
      const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
      if (!header)
        return { value: "", type: null, comment: "", range: [start, start, start] };
      const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
      const lines = scalar.source ? splitLines(scalar.source) : [];
      let chompStart = lines.length;
      for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === "" || content === "\r")
          chompStart = i;
        else
          break;
      }
      if (chompStart === 0) {
        const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
        let end2 = start + header.length;
        if (scalar.source)
          end2 += scalar.source.length;
        return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
      }
      let trimIndent = scalar.indent + header.indent;
      let offset = scalar.offset + header.length;
      let contentStart = 0;
      for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === "" || content === "\r") {
          if (header.indent === 0 && indent.length > trimIndent)
            trimIndent = indent.length;
        } else {
          if (indent.length < trimIndent) {
            const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
            onError(offset + indent.length, "MISSING_CHAR", message);
          }
          if (header.indent === 0)
            trimIndent = indent.length;
          contentStart = i;
          if (trimIndent === 0 && !ctx.atRoot) {
            const message = "Block scalar values in collections must be indented";
            onError(offset, "BAD_INDENT", message);
          }
          break;
        }
        offset += indent.length + content.length + 1;
      }
      for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
          chompStart = i + 1;
      }
      let value = "";
      let sep = "";
      let prevMoreIndented = false;
      for (let i = 0; i < contentStart; ++i)
        value += lines[i][0].slice(trimIndent) + "\n";
      for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === "\r";
        if (crlf)
          content = content.slice(0, -1);
        if (content && indent.length < trimIndent) {
          const src = header.indent ? "explicit indentation indicator" : "first line";
          const message = `Block scalar lines must not be less indented than their ${src}`;
          onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
          indent = "";
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
        } else if (indent.length > trimIndent || content[0] === "	") {
          if (sep === " ")
            sep = "\n";
          else if (!prevMoreIndented && sep === "\n")
            sep = "\n\n";
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
          prevMoreIndented = true;
        } else if (content === "") {
          if (sep === "\n")
            value += "\n";
          else
            sep = "\n";
        } else {
          value += sep + content;
          sep = " ";
          prevMoreIndented = false;
        }
      }
      switch (header.chomp) {
        case "-":
          break;
        case "+":
          for (let i = chompStart; i < lines.length; ++i)
            value += "\n" + lines[i][0].slice(trimIndent);
          if (value[value.length - 1] !== "\n")
            value += "\n";
          break;
        default:
          value += "\n";
      }
      const end = start + header.length + scalar.source.length;
      return { value, type, comment: header.comment, range: [start, end, end] };
    }
    function parseBlockScalarHeader({ offset, props }, strict, onError) {
      if (props[0].type !== "block-scalar-header") {
        onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
        return null;
      }
      const { source } = props[0];
      const mode = source[0];
      let indent = 0;
      let chomp = "";
      let error = -1;
      for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === "-" || ch === "+"))
          chomp = ch;
        else {
          const n = Number(ch);
          if (!indent && n)
            indent = n;
          else if (error === -1)
            error = offset + i;
        }
      }
      if (error !== -1)
        onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
      let hasSpace = false;
      let comment = "";
      let length = source.length;
      for (let i = 1; i < props.length; ++i) {
        const token2 = props[i];
        switch (token2.type) {
          case "space":
            hasSpace = true;
          // fallthrough
          case "newline":
            length += token2.source.length;
            break;
          case "comment":
            if (strict && !hasSpace) {
              const message = "Comments must be separated from other tokens by white space characters";
              onError(token2, "MISSING_CHAR", message);
            }
            length += token2.source.length;
            comment = token2.source.substring(1);
            break;
          case "error":
            onError(token2, "UNEXPECTED_TOKEN", token2.message);
            length += token2.source.length;
            break;
          /* istanbul ignore next should not happen */
          default: {
            const message = `Unexpected token in block scalar header: ${token2.type}`;
            onError(token2, "UNEXPECTED_TOKEN", message);
            const ts = token2.source;
            if (ts && typeof ts === "string")
              length += ts.length;
          }
        }
      }
      return { mode, indent, chomp, comment, length };
    }
    function splitLines(source) {
      const split = source.split(/\n( *)/);
      const first = split[0];
      const m = first.match(/^( *)/);
      const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
      const lines = [line0];
      for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
      return lines;
    }
    exports.resolveBlockScalar = resolveBlockScalar;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/compose/resolve-flow-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var resolveEnd = require_resolve_end();
    function resolveFlowScalar(scalar, strict, onError) {
      const { offset, type, source, end } = scalar;
      let _type;
      let value;
      const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
      switch (type) {
        case "scalar":
          _type = Scalar.Scalar.PLAIN;
          value = plainValue(source, _onError);
          break;
        case "single-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_SINGLE;
          value = singleQuotedValue(source, _onError);
          break;
        case "double-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_DOUBLE;
          value = doubleQuotedValue(source, _onError);
          break;
        /* istanbul ignore next should not happen */
        default:
          onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
          return {
            value: "",
            type: null,
            comment: "",
            range: [offset, offset + source.length, offset + source.length]
          };
      }
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
      return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
      };
    }
    function plainValue(source, onError) {
      let badChar = "";
      switch (source[0]) {
        /* istanbul ignore next should not happen */
        case "	":
          badChar = "a tab character";
          break;
        case ",":
          badChar = "flow indicator character ,";
          break;
        case "%":
          badChar = "directive indicator character %";
          break;
        case "|":
        case ">": {
          badChar = `block scalar indicator ${source[0]}`;
          break;
        }
        case "@":
        case "`": {
          badChar = `reserved character ${source[0]}`;
          break;
        }
      }
      if (badChar)
        onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
      return foldLines(source);
    }
    function singleQuotedValue(source, onError) {
      if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
      return foldLines(source.slice(1, -1)).replace(/''/g, "'");
    }
    function foldLines(source) {
      let first, line;
      try {
        first = new RegExp("(.*?)(?<![ 	])[ 	]*\r?\n", "sy");
        line = new RegExp("[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?\n", "sy");
      } catch {
        first = /(.*?)[ \t]*\r?\n/sy;
        line = /[ \t]*(.*?)[ \t]*\r?\n/sy;
      }
      let match = first.exec(source);
      if (!match)
        return source;
      let res = match[1];
      let sep = " ";
      let pos = first.lastIndex;
      line.lastIndex = pos;
      while (match = line.exec(source)) {
        if (match[1] === "") {
          if (sep === "\n")
            res += sep;
          else
            sep = "\n";
        } else {
          res += sep + match[1];
          sep = " ";
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match = last.exec(source);
      return res + sep + (match?.[1] ?? "");
    }
    function doubleQuotedValue(source, onError) {
      let res = "";
      for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === "\r" && source[i + 1] === "\n")
          continue;
        if (ch === "\n") {
          const { fold, offset } = foldNewline(source, i);
          res += fold;
          i = offset;
        } else if (ch === "\\") {
          let next = source[++i];
          const cc = escapeCodes[next];
          if (cc)
            res += cc;
          else if (next === "\n") {
            next = source[i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "\r" && source[i + 1] === "\n") {
            next = source[++i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "x" || next === "u" || next === "U") {
            const length = next === "x" ? 2 : next === "u" ? 4 : 8;
            res += parseCharCode(source, i + 1, length, onError);
            i += length;
          } else {
            const raw = source.substr(i - 1, 2);
            onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
            res += raw;
          }
        } else if (ch === " " || ch === "	") {
          const wsStart = i;
          let next = source[i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
          if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
            res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        } else {
          res += ch;
        }
      }
      if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
      return res;
    }
    function foldNewline(source, offset) {
      let fold = "";
      let ch = source[offset + 1];
      while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[offset + 2] !== "\n")
          break;
        if (ch === "\n")
          fold += "\n";
        offset += 1;
        ch = source[offset + 1];
      }
      if (!fold)
        fold = " ";
      return { fold, offset };
    }
    var escapeCodes = {
      "0": "\0",
      // null character
      a: "\x07",
      // bell character
      b: "\b",
      // backspace
      e: "\x1B",
      // escape character
      f: "\f",
      // form feed
      n: "\n",
      // line feed
      r: "\r",
      // carriage return
      t: "	",
      // horizontal tab
      v: "\v",
      // vertical tab
      N: "\x85",
      // Unicode next line
      _: "\xA0",
      // Unicode non-breaking space
      L: "\u2028",
      // Unicode line separator
      P: "\u2029",
      // Unicode paragraph separator
      " ": " ",
      '"': '"',
      "/": "/",
      "\\": "\\",
      "	": "	"
    };
    function parseCharCode(source, offset, length, onError) {
      const cc = source.substr(offset, length);
      const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok ? parseInt(cc, 16) : NaN;
      try {
        return String.fromCodePoint(code);
      } catch {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        return raw;
      }
    }
    exports.resolveFlowScalar = resolveFlowScalar;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/compose/compose-scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    function composeScalar(ctx, token2, tagToken, onError) {
      const { value, type, comment, range } = token2.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token2, onError) : resolveFlowScalar.resolveFlowScalar(token2, ctx.options.strict, onError);
      const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
      let tag;
      if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
      } else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
      else if (token2.type === "scalar")
        tag = findScalarTagByTest(ctx, value, token2, onError);
      else
        tag = ctx.schema[identity.SCALAR];
      let scalar;
      try {
        const res = tag.resolve(value, (msg) => onError(tagToken ?? token2, "TAG_RESOLVE_FAILED", msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token2, "TAG_RESOLVE_FAILED", msg);
        scalar = new Scalar.Scalar(value);
      }
      scalar.range = range;
      scalar.source = value;
      if (type)
        scalar.type = type;
      if (tagName)
        scalar.tag = tagName;
      if (tag.format)
        scalar.format = tag.format;
      if (comment)
        scalar.comment = comment;
      return scalar;
    }
    function findScalarTagByName(schema, value, tagName, tagToken, onError) {
      if (tagName === "!")
        return schema[identity.SCALAR];
      const matchWithTest = [];
      for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
          if (tag.default && tag.test)
            matchWithTest.push(tag);
          else
            return tag;
        }
      }
      for (const tag of matchWithTest)
        if (tag.test?.test(value))
          return tag;
      const kt = schema.knownTags[tagName];
      if (kt && !kt.collection) {
        schema.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
        return kt;
      }
      onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
      return schema[identity.SCALAR];
    }
    function findScalarTagByTest({ atKey, directives, schema }, value, token2, onError) {
      const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity.SCALAR];
      if (schema.compat) {
        const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
          const ts = directives.tagString(tag.tag);
          const cs = directives.tagString(compat.tag);
          const msg = `Value may be parsed as either ${ts} or ${cs}`;
          onError(token2, "TAG_RESOLVE_FAILED", msg, true);
        }
      }
      return tag;
    }
    exports.composeScalar = composeScalar;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/compose/util-empty-scalar-position.js"(exports) {
    "use strict";
    function emptyScalarPosition(offset, before, pos) {
      if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
          let st = before[i];
          switch (st.type) {
            case "space":
            case "comment":
            case "newline":
              offset -= st.source.length;
              continue;
          }
          st = before[++i];
          while (st?.type === "space") {
            offset += st.source.length;
            st = before[++i];
          }
          break;
        }
      }
      return offset;
    }
    exports.emptyScalarPosition = emptyScalarPosition;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/compose/compose-node.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var composeCollection = require_compose_collection();
    var composeScalar = require_compose_scalar();
    var resolveEnd = require_resolve_end();
    var utilEmptyScalarPosition = require_util_empty_scalar_position();
    var CN = { composeNode, composeEmptyNode };
    function composeNode(ctx, token2, props, onError) {
      const atKey = ctx.atKey;
      const { spaceBefore, comment, anchor, tag } = props;
      let node;
      let isSrcToken = true;
      switch (token2.type) {
        case "alias":
          node = composeAlias(ctx, token2, onError);
          if (anchor || tag)
            onError(token2, "ALIAS_PROPS", "An alias node must not specify any properties");
          break;
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "block-scalar":
          node = composeScalar.composeScalar(ctx, token2, tag, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
          break;
        case "block-map":
        case "block-seq":
        case "flow-collection":
          try {
            node = composeCollection.composeCollection(CN, ctx, token2, props, onError);
            if (anchor)
              node.anchor = anchor.source.substring(1);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            onError(token2, "RESOURCE_EXHAUSTION", message);
          }
          break;
        default: {
          const message = token2.type === "error" ? token2.message : `Unsupported token (type: ${token2.type})`;
          onError(token2, "UNEXPECTED_TOKEN", message);
          isSrcToken = false;
        }
      }
      node ?? (node = composeEmptyNode(ctx, token2.offset, void 0, null, props, onError));
      if (anchor && node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
        const msg = "With stringKeys, all keys must be strings";
        onError(tag ?? token2, "NON_STRING_KEY", msg);
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        if (token2.type === "scalar" && token2.source === "")
          node.comment = comment;
        else
          node.commentBefore = comment;
      }
      if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token2;
      return node;
    }
    function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
      const token2 = {
        type: "scalar",
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ""
      };
      const node = composeScalar.composeScalar(ctx, token2, tag, onError);
      if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === "")
          onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        node.comment = comment;
        node.range[2] = end;
      }
      return node;
    }
    function composeAlias({ options }, { offset, source, end }, onError) {
      const alias = new Alias.Alias(source.substring(1));
      if (alias.source === "")
        onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
      if (alias.source.endsWith(":"))
        onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
      alias.range = [offset, valueEnd, re.offset];
      if (re.comment)
        alias.comment = re.comment;
      return alias;
    }
    exports.composeEmptyNode = composeEmptyNode;
    exports.composeNode = composeNode;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/compose/compose-doc.js"(exports) {
    "use strict";
    var Document = require_Document();
    var composeNode = require_compose_node();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    function composeDoc(options, directives, { offset, start, value, end }, onError) {
      const opts = Object.assign({ _directives: directives }, options);
      const doc = new Document.Document(void 0, opts);
      const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
      };
      const props = resolveProps.resolveProps(start, {
        indicator: "doc-start",
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
      });
      if (props.found) {
        doc.directives.docStart = true;
        if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
          onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
      }
      doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
      const contentEnd = doc.contents.range[2];
      const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
      if (re.comment)
        doc.comment = re.comment;
      doc.range = [offset, contentEnd, re.offset];
      return doc;
    }
    exports.composeDoc = composeDoc;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/compose/composer.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var directives = require_directives();
    var Document = require_Document();
    var errors = require_errors();
    var identity = require_identity();
    var composeDoc = require_compose_doc();
    var resolveEnd = require_resolve_end();
    function getErrorPos(src) {
      if (typeof src === "number")
        return [src, src + 1];
      if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
      const { offset, source } = src;
      return [offset, offset + (typeof source === "string" ? source.length : 1)];
    }
    function parsePrelude(prelude) {
      let comment = "";
      let atComment = false;
      let afterEmptyLine = false;
      for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
          case "#":
            comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
            atComment = true;
            afterEmptyLine = false;
            break;
          case "%":
            if (prelude[i + 1]?.[0] !== "#")
              i += 1;
            atComment = false;
            break;
          default:
            if (!atComment)
              afterEmptyLine = true;
            atComment = false;
        }
      }
      return { comment, afterEmptyLine };
    }
    var Composer = class {
      constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
          const pos = getErrorPos(source);
          if (warning)
            this.warnings.push(new errors.YAMLWarning(pos, code, message));
          else
            this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        this.directives = new directives.Directives({ version: options.version || "1.2" });
        this.options = options;
      }
      decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        if (comment) {
          const dc = doc.contents;
          if (afterDoc) {
            doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
          } else if (afterEmptyLine || doc.directives.docStart || !dc) {
            doc.commentBefore = comment;
          } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
            let it = dc.items[0];
            if (identity.isPair(it))
              it = it.key;
            const cb = it.commentBefore;
            it.commentBefore = cb ? `${comment}
${cb}` : comment;
          } else {
            const cb = dc.commentBefore;
            dc.commentBefore = cb ? `${comment}
${cb}` : comment;
          }
        }
        if (afterDoc) {
          for (let i = 0; i < this.errors.length; ++i)
            doc.errors.push(this.errors[i]);
          for (let i = 0; i < this.warnings.length; ++i)
            doc.warnings.push(this.warnings[i]);
        } else {
          doc.errors = this.errors;
          doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
      }
      /**
       * Current stream status information.
       *
       * Mostly useful at the end of input for an empty stream.
       */
      streamInfo() {
        return {
          comment: parsePrelude(this.prelude).comment,
          directives: this.directives,
          errors: this.errors,
          warnings: this.warnings
        };
      }
      /**
       * Compose tokens into documents.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token2 of tokens)
          yield* this.next(token2);
        yield* this.end(forceDoc, endOffset);
      }
      /** Advance the composer by one CST token. */
      *next(token2) {
        if (node_process.env.LOG_STREAM)
          console.dir(token2, { depth: null });
        switch (token2.type) {
          case "directive":
            this.directives.add(token2.source, (offset, message, warning) => {
              const pos = getErrorPos(token2);
              pos[0] += offset;
              this.onError(pos, "BAD_DIRECTIVE", message, warning);
            });
            this.prelude.push(token2.source);
            this.atDirectives = true;
            break;
          case "document": {
            const doc = composeDoc.composeDoc(this.options, this.directives, token2, this.onError);
            if (this.atDirectives && !doc.directives.docStart)
              this.onError(token2, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
            this.decorate(doc, false);
            if (this.doc)
              yield this.doc;
            this.doc = doc;
            this.atDirectives = false;
            break;
          }
          case "byte-order-mark":
          case "space":
            break;
          case "comment":
          case "newline":
            this.prelude.push(token2.source);
            break;
          case "error": {
            const msg = token2.source ? `${token2.message}: ${JSON.stringify(token2.source)}` : token2.message;
            const error = new errors.YAMLParseError(getErrorPos(token2), "UNEXPECTED_TOKEN", msg);
            if (this.atDirectives || !this.doc)
              this.errors.push(error);
            else
              this.doc.errors.push(error);
            break;
          }
          case "doc-end": {
            if (!this.doc) {
              const msg = "Unexpected doc-end without preceding document";
              this.errors.push(new errors.YAMLParseError(getErrorPos(token2), "UNEXPECTED_TOKEN", msg));
              break;
            }
            this.doc.directives.docEnd = true;
            const end = resolveEnd.resolveEnd(token2.end, token2.offset + token2.source.length, this.doc.options.strict, this.onError);
            this.decorate(this.doc, true);
            if (end.comment) {
              const dc = this.doc.comment;
              this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
            }
            this.doc.range[2] = end.offset;
            break;
          }
          default:
            this.errors.push(new errors.YAMLParseError(getErrorPos(token2), "UNEXPECTED_TOKEN", `Unsupported token ${token2.type}`));
        }
      }
      /**
       * Call at end of input to yield any remaining document.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
          this.decorate(this.doc, true);
          yield this.doc;
          this.doc = null;
        } else if (forceDoc) {
          const opts = Object.assign({ _directives: this.directives }, this.options);
          const doc = new Document.Document(void 0, opts);
          if (this.atDirectives)
            this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
          doc.range = [0, endOffset, endOffset];
          this.decorate(doc, false);
          yield doc;
        }
      }
    };
    exports.Composer = Composer;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/parse/cst-scalar.js"(exports) {
    "use strict";
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    var errors = require_errors();
    var stringifyString = require_stringifyString();
    function resolveAsScalar(token2, strict = true, onError) {
      if (token2) {
        const _onError = (pos, code, message) => {
          const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
          if (onError)
            onError(offset, code, message);
          else
            throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token2.type) {
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return resolveFlowScalar.resolveFlowScalar(token2, strict, _onError);
          case "block-scalar":
            return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token2, _onError);
        }
      }
      return null;
    }
    function createScalarToken(value, context) {
      const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      const end = context.end ?? [
        { type: "newline", offset: -1, indent, source: "\n" }
      ];
      switch (source[0]) {
        case "|":
        case ">": {
          const he = source.indexOf("\n");
          const head = source.substring(0, he);
          const body2 = source.substring(he + 1) + "\n";
          const props = [
            { type: "block-scalar-header", offset, indent, source: head }
          ];
          if (!addEndtoBlockProps(props, end))
            props.push({ type: "newline", offset: -1, indent, source: "\n" });
          return { type: "block-scalar", offset, indent, props, source: body2 };
        }
        case '"':
          return { type: "double-quoted-scalar", offset, indent, source, end };
        case "'":
          return { type: "single-quoted-scalar", offset, indent, source, end };
        default:
          return { type: "scalar", offset, indent, source, end };
      }
    }
    function setScalarValue(token2, value, context = {}) {
      let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
      let indent = "indent" in token2 ? token2.indent : null;
      if (afterKey && typeof indent === "number")
        indent += 2;
      if (!type)
        switch (token2.type) {
          case "single-quoted-scalar":
            type = "QUOTE_SINGLE";
            break;
          case "double-quoted-scalar":
            type = "QUOTE_DOUBLE";
            break;
          case "block-scalar": {
            const header = token2.props[0];
            if (header.type !== "block-scalar-header")
              throw new Error("Invalid block scalar header");
            type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
            break;
          }
          default:
            type = "PLAIN";
        }
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      switch (source[0]) {
        case "|":
        case ">":
          setBlockScalarValue(token2, source);
          break;
        case '"':
          setFlowScalarValue(token2, source, "double-quoted-scalar");
          break;
        case "'":
          setFlowScalarValue(token2, source, "single-quoted-scalar");
          break;
        default:
          setFlowScalarValue(token2, source, "scalar");
      }
    }
    function setBlockScalarValue(token2, source) {
      const he = source.indexOf("\n");
      const head = source.substring(0, he);
      const body2 = source.substring(he + 1) + "\n";
      if (token2.type === "block-scalar") {
        const header = token2.props[0];
        if (header.type !== "block-scalar-header")
          throw new Error("Invalid block scalar header");
        header.source = head;
        token2.source = body2;
      } else {
        const { offset } = token2;
        const indent = "indent" in token2 ? token2.indent : -1;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, "end" in token2 ? token2.end : void 0))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        for (const key of Object.keys(token2))
          if (key !== "type" && key !== "offset")
            delete token2[key];
        Object.assign(token2, { type: "block-scalar", indent, props, source: body2 });
      }
    }
    function addEndtoBlockProps(props, end) {
      if (end)
        for (const st of end)
          switch (st.type) {
            case "space":
            case "comment":
              props.push(st);
              break;
            case "newline":
              props.push(st);
              return true;
          }
      return false;
    }
    function setFlowScalarValue(token2, source, type) {
      switch (token2.type) {
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          token2.type = type;
          token2.source = source;
          break;
        case "block-scalar": {
          const end = token2.props.slice(1);
          let oa = source.length;
          if (token2.props[0].type === "block-scalar-header")
            oa -= token2.props[0].source.length;
          for (const tok of end)
            tok.offset += oa;
          delete token2.props;
          Object.assign(token2, { type, source, end });
          break;
        }
        case "block-map":
        case "block-seq": {
          const offset = token2.offset + source.length;
          const nl = { type: "newline", offset, indent: token2.indent, source: "\n" };
          delete token2.items;
          Object.assign(token2, { type, source, end: [nl] });
          break;
        }
        default: {
          const indent = "indent" in token2 ? token2.indent : -1;
          const end = "end" in token2 && Array.isArray(token2.end) ? token2.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
          for (const key of Object.keys(token2))
            if (key !== "type" && key !== "offset")
              delete token2[key];
          Object.assign(token2, { type, indent, source, end });
        }
      }
    }
    exports.createScalarToken = createScalarToken;
    exports.resolveAsScalar = resolveAsScalar;
    exports.setScalarValue = setScalarValue;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/parse/cst-stringify.js"(exports) {
    "use strict";
    var stringify = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
    function stringifyToken(token2) {
      switch (token2.type) {
        case "block-scalar": {
          let res = "";
          for (const tok of token2.props)
            res += stringifyToken(tok);
          return res + token2.source;
        }
        case "block-map":
        case "block-seq": {
          let res = "";
          for (const item of token2.items)
            res += stringifyItem(item);
          return res;
        }
        case "flow-collection": {
          let res = token2.start.source;
          for (const item of token2.items)
            res += stringifyItem(item);
          for (const st of token2.end)
            res += st.source;
          return res;
        }
        case "document": {
          let res = stringifyItem(token2);
          if (token2.end)
            for (const st of token2.end)
              res += st.source;
          return res;
        }
        default: {
          let res = token2.source;
          if ("end" in token2 && token2.end)
            for (const st of token2.end)
              res += st.source;
          return res;
        }
      }
    }
    function stringifyItem({ start, key, sep, value }) {
      let res = "";
      for (const st of start)
        res += st.source;
      if (key)
        res += stringifyToken(key);
      if (sep)
        for (const st of sep)
          res += st.source;
      if (value)
        res += stringifyToken(value);
      return res;
    }
    exports.stringify = stringify;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/parse/cst-visit.js"(exports) {
    "use strict";
    var BREAK = Symbol("break visit");
    var SKIP = Symbol("skip children");
    var REMOVE = Symbol("remove item");
    function visit(cst, visitor) {
      if ("type" in cst && cst.type === "document")
        cst = { start: cst.start, value: cst.value };
      _visit(Object.freeze([]), cst, visitor);
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    visit.itemAtPath = (cst, path) => {
      let item = cst;
      for (const [field, index] of path) {
        const tok = item?.[field];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path) => {
      const parent = visit.itemAtPath(cst, path.slice(0, -1));
      const field = path[path.length - 1][0];
      const coll = parent?.[field];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path, item, visitor) {
      let ctrl = visitor(item, path);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field of ["key", "value"]) {
        const token2 = item[field];
        if (token2 && "items" in token2) {
          for (let i = 0; i < token2.items.length; ++i) {
            const ci = _visit(Object.freeze(path.concat([[field, i]])), token2.items[i], visitor);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              token2.items.splice(i, 1);
              i -= 1;
            }
          }
          if (typeof ctrl === "function" && field === "key")
            ctrl = ctrl(item, path);
        }
      }
      return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
    }
    exports.visit = visit;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/parse/cst.js"(exports) {
    "use strict";
    var cstScalar = require_cst_scalar();
    var cstStringify = require_cst_stringify();
    var cstVisit = require_cst_visit();
    var BOM = "\uFEFF";
    var DOCUMENT = "";
    var FLOW_END = "";
    var SCALAR = "";
    var isCollection = (token2) => !!token2 && "items" in token2;
    var isScalar = (token2) => !!token2 && (token2.type === "scalar" || token2.type === "single-quoted-scalar" || token2.type === "double-quoted-scalar" || token2.type === "block-scalar");
    function prettyToken(token2) {
      switch (token2) {
        case BOM:
          return "<BOM>";
        case DOCUMENT:
          return "<DOC>";
        case FLOW_END:
          return "<FLOW_END>";
        case SCALAR:
          return "<SCALAR>";
        default:
          return JSON.stringify(token2);
      }
    }
    function tokenType(source) {
      switch (source) {
        case BOM:
          return "byte-order-mark";
        case DOCUMENT:
          return "doc-mode";
        case FLOW_END:
          return "flow-error-end";
        case SCALAR:
          return "scalar";
        case "---":
          return "doc-start";
        case "...":
          return "doc-end";
        case "":
        case "\n":
        case "\r\n":
          return "newline";
        case "-":
          return "seq-item-ind";
        case "?":
          return "explicit-key-ind";
        case ":":
          return "map-value-ind";
        case "{":
          return "flow-map-start";
        case "}":
          return "flow-map-end";
        case "[":
          return "flow-seq-start";
        case "]":
          return "flow-seq-end";
        case ",":
          return "comma";
      }
      switch (source[0]) {
        case " ":
        case "	":
          return "space";
        case "#":
          return "comment";
        case "%":
          return "directive-line";
        case "*":
          return "alias";
        case "&":
          return "anchor";
        case "!":
          return "tag";
        case "'":
          return "single-quoted-scalar";
        case '"':
          return "double-quoted-scalar";
        case "|":
        case ">":
          return "block-scalar-header";
      }
      return null;
    }
    exports.createScalarToken = cstScalar.createScalarToken;
    exports.resolveAsScalar = cstScalar.resolveAsScalar;
    exports.setScalarValue = cstScalar.setScalarValue;
    exports.stringify = cstStringify.stringify;
    exports.visit = cstVisit.visit;
    exports.BOM = BOM;
    exports.DOCUMENT = DOCUMENT;
    exports.FLOW_END = FLOW_END;
    exports.SCALAR = SCALAR;
    exports.isCollection = isCollection;
    exports.isScalar = isScalar;
    exports.prettyToken = prettyToken;
    exports.tokenType = tokenType;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/parse/lexer.js"(exports) {
    "use strict";
    var cst = require_cst();
    function isEmpty(ch) {
      switch (ch) {
        case void 0:
        case " ":
        case "\n":
        case "\r":
        case "	":
          return true;
        default:
          return false;
      }
    }
    var hexDigits = new Set("0123456789ABCDEFabcdef");
    var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
    var flowIndicatorChars = new Set(",[]{}");
    var invalidAnchorChars = new Set(" ,[]{}\n\r	");
    var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
    var Lexer = class {
      constructor() {
        this.atEnd = false;
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        this.buffer = "";
        this.flowKey = false;
        this.flowLevel = 0;
        this.indentNext = 0;
        this.indentValue = 0;
        this.lineEndPos = null;
        this.next = null;
        this.pos = 0;
      }
      /**
       * Generate YAML tokens from the `source` string. If `incomplete`,
       * a part of the last line may be left as a buffer for the next call.
       *
       * @returns A generator of lexical tokens
       */
      *lex(source, incomplete = false) {
        if (source) {
          if (typeof source !== "string")
            throw TypeError("source is not a string");
          this.buffer = this.buffer ? this.buffer + source : source;
          this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? "stream";
        while (next && (incomplete || this.hasChars(1)))
          next = yield* this.parseNext(next);
      }
      atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === " " || ch === "	")
          ch = this.buffer[++i];
        if (!ch || ch === "#" || ch === "\n")
          return true;
        if (ch === "\r")
          return this.buffer[i + 1] === "\n";
        return false;
      }
      charAt(n) {
        return this.buffer[this.pos + n];
      }
      continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
          let indent = 0;
          while (ch === " ")
            ch = this.buffer[++indent + offset];
          if (ch === "\r") {
            const next = this.buffer[indent + offset + 1];
            if (next === "\n" || !next && !this.atEnd)
              return offset + indent + 1;
          }
          return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
        }
        if (ch === "-" || ch === ".") {
          const dt = this.buffer.substr(offset, 3);
          if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
            return -1;
        }
        return offset;
      }
      getLine() {
        let end = this.lineEndPos;
        if (typeof end !== "number" || end !== -1 && end < this.pos) {
          end = this.buffer.indexOf("\n", this.pos);
          this.lineEndPos = end;
        }
        if (end === -1)
          return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === "\r")
          end -= 1;
        return this.buffer.substring(this.pos, end);
      }
      hasChars(n) {
        return this.pos + n <= this.buffer.length;
      }
      setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
      }
      peek(n) {
        return this.buffer.substr(this.pos, n);
      }
      *parseNext(next) {
        switch (next) {
          case "stream":
            return yield* this.parseStream();
          case "line-start":
            return yield* this.parseLineStart();
          case "block-start":
            return yield* this.parseBlockStart();
          case "doc":
            return yield* this.parseDocument();
          case "flow":
            return yield* this.parseFlowCollection();
          case "quoted-scalar":
            return yield* this.parseQuotedScalar();
          case "block-scalar":
            return yield* this.parseBlockScalar();
          case "plain-scalar":
            return yield* this.parsePlainScalar();
        }
      }
      *parseStream() {
        let line = this.getLine();
        if (line === null)
          return this.setNext("stream");
        if (line[0] === cst.BOM) {
          yield* this.pushCount(1);
          line = line.substring(1);
        }
        if (line[0] === "%") {
          let dirEnd = line.length;
          let cs = line.indexOf("#");
          while (cs !== -1) {
            const ch = line[cs - 1];
            if (ch === " " || ch === "	") {
              dirEnd = cs - 1;
              break;
            } else {
              cs = line.indexOf("#", cs + 1);
            }
          }
          while (true) {
            const ch = line[dirEnd - 1];
            if (ch === " " || ch === "	")
              dirEnd -= 1;
            else
              break;
          }
          const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
          yield* this.pushCount(line.length - n);
          this.pushNewline();
          return "stream";
        }
        if (this.atLineEnd()) {
          const sp = yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - sp);
          yield* this.pushNewline();
          return "stream";
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
      }
      *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
          return this.setNext("line-start");
        if (ch === "-" || ch === ".") {
          if (!this.atEnd && !this.hasChars(4))
            return this.setNext("line-start");
          const s = this.peek(3);
          if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
            yield* this.pushCount(3);
            this.indentValue = 0;
            this.indentNext = 0;
            return s === "---" ? "doc" : "stream";
          }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
          this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
      }
      *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
          return this.setNext("block-start");
        if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
          const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
          this.indentNext = this.indentValue + 1;
          this.indentValue += n;
          return "block-start";
        }
        return "doc";
      }
      *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
          return this.setNext("doc");
        let n = yield* this.pushIndicators();
        switch (line[n]) {
          case "#":
            yield* this.pushCount(line.length - n);
          // fallthrough
          case void 0:
            yield* this.pushNewline();
            return yield* this.parseLineStart();
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel = 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            return "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "doc";
          case '"':
          case "'":
            return yield* this.parseQuotedScalar();
          case "|":
          case ">":
            n += yield* this.parseBlockScalarHeader();
            n += yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - n);
            yield* this.pushNewline();
            return yield* this.parseBlockScalar();
          default:
            return yield* this.parsePlainScalar();
        }
      }
      *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
          nl = yield* this.pushNewline();
          if (nl > 0) {
            sp = yield* this.pushSpaces(false);
            this.indentValue = indent = sp;
          } else {
            sp = 0;
          }
          sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
          return this.setNext("flow");
        if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
          const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
          if (!atFlowEndMarker) {
            this.flowLevel = 0;
            yield cst.FLOW_END;
            return yield* this.parseLineStart();
          }
        }
        let n = 0;
        while (line[n] === ",") {
          n += yield* this.pushCount(1);
          n += yield* this.pushSpaces(true);
          this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
          case void 0:
            return "flow";
          case "#":
            yield* this.pushCount(line.length - n);
            return "flow";
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel += 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            this.flowKey = true;
            this.flowLevel -= 1;
            return this.flowLevel ? "flow" : "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "flow";
          case '"':
          case "'":
            this.flowKey = true;
            return yield* this.parseQuotedScalar();
          case ":": {
            const next = this.charAt(1);
            if (this.flowKey || isEmpty(next) || next === ",") {
              this.flowKey = false;
              yield* this.pushCount(1);
              yield* this.pushSpaces(true);
              return "flow";
            }
          }
          // fallthrough
          default:
            this.flowKey = false;
            return yield* this.parsePlainScalar();
        }
      }
      *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
          while (end !== -1 && this.buffer[end + 1] === "'")
            end = this.buffer.indexOf("'", end + 2);
        } else {
          while (end !== -1) {
            let n = 0;
            while (this.buffer[end - 1 - n] === "\\")
              n += 1;
            if (n % 2 === 0)
              break;
            end = this.buffer.indexOf('"', end + 1);
          }
        }
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf("\n", this.pos);
        if (nl !== -1) {
          while (nl !== -1) {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = qb.indexOf("\n", cs);
          }
          if (nl !== -1) {
            end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
          }
        }
        if (end === -1) {
          if (!this.atEnd)
            return this.setNext("quoted-scalar");
          end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? "flow" : "doc";
      }
      *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
          const ch = this.buffer[++i];
          if (ch === "+")
            this.blockScalarKeep = true;
          else if (ch > "0" && ch <= "9")
            this.blockScalarIndent = Number(ch) - 1;
          else if (ch !== "-")
            break;
        }
        return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
      }
      *parseBlockScalar() {
        let nl = this.pos - 1;
        let indent = 0;
        let ch;
        loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case "\n":
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === "\n")
                break;
            }
            // fallthrough
            default:
              break loop;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("block-scalar");
        if (indent >= this.indentNext) {
          if (this.blockScalarIndent === -1)
            this.indentNext = indent;
          else {
            this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
          }
          do {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = this.buffer.indexOf("\n", cs);
          } while (nl !== -1);
          if (nl === -1) {
            if (!this.atEnd)
              return this.setNext("block-scalar");
            nl = this.buffer.length;
          }
        }
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === " ")
          ch = this.buffer[++i];
        if (ch === "	") {
          while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
            ch = this.buffer[++i];
          nl = i - 1;
        } else if (!this.blockScalarKeep) {
          do {
            let i2 = nl - 1;
            let ch2 = this.buffer[i2];
            if (ch2 === "\r")
              ch2 = this.buffer[--i2];
            const lastChar = i2;
            while (ch2 === " ")
              ch2 = this.buffer[--i2];
            if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
              nl = i2;
            else
              break;
          } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
      }
      *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while (ch = this.buffer[++i]) {
          if (ch === ":") {
            const next = this.buffer[i + 1];
            if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
              break;
            end = i;
          } else if (isEmpty(ch)) {
            let next = this.buffer[i + 1];
            if (ch === "\r") {
              if (next === "\n") {
                i += 1;
                ch = "\n";
                next = this.buffer[i + 1];
              } else
                end = i;
            }
            if (next === "#" || inFlow && flowIndicatorChars.has(next))
              break;
            if (ch === "\n") {
              const cs = this.continueScalar(i + 1);
              if (cs === -1)
                break;
              i = Math.max(i, cs - 2);
            }
          } else {
            if (inFlow && flowIndicatorChars.has(ch))
              break;
            end = i;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("plain-scalar");
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? "flow" : "doc";
      }
      *pushCount(n) {
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos += n;
          return n;
        }
        return 0;
      }
      *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
          yield s;
          this.pos += s.length;
          return s.length;
        } else if (allowEmpty)
          yield "";
        return 0;
      }
      *pushIndicators() {
        let n = 0;
        loop: while (true) {
          switch (this.charAt(0)) {
            case "!":
              n += yield* this.pushTag();
              n += yield* this.pushSpaces(true);
              continue loop;
            case "&":
              n += yield* this.pushUntil(isNotAnchorChar);
              n += yield* this.pushSpaces(true);
              continue loop;
            case "-":
            // this is an error
            case "?":
            // this is an error outside flow collections
            case ":": {
              const inFlow = this.flowLevel > 0;
              const ch1 = this.charAt(1);
              if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
                if (!inFlow)
                  this.indentNext = this.indentValue + 1;
                else if (this.flowKey)
                  this.flowKey = false;
                n += yield* this.pushCount(1);
                n += yield* this.pushSpaces(true);
                continue loop;
              }
            }
          }
          break loop;
        }
        return n;
      }
      *pushTag() {
        if (this.charAt(1) === "<") {
          let i = this.pos + 2;
          let ch = this.buffer[i];
          while (!isEmpty(ch) && ch !== ">")
            ch = this.buffer[++i];
          return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
        } else {
          let i = this.pos + 1;
          let ch = this.buffer[i];
          while (ch) {
            if (tagChars.has(ch))
              ch = this.buffer[++i];
            else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
              ch = this.buffer[i += 3];
            } else
              break;
          }
          return yield* this.pushToIndex(i, false);
        }
      }
      *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === "\n")
          return yield* this.pushCount(1);
        else if (ch === "\r" && this.charAt(1) === "\n")
          return yield* this.pushCount(2);
        else
          return 0;
      }
      *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
          ch = this.buffer[++i];
        } while (ch === " " || allowTabs && ch === "	");
        const n = i - this.pos;
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos = i;
        }
        return n;
      }
      *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
          ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
      }
    };
    exports.Lexer = Lexer;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/parse/line-counter.js"(exports) {
    "use strict";
    var LineCounter = class {
      constructor() {
        this.lineStarts = [];
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        this.linePos = (offset) => {
          let low = 0;
          let high = this.lineStarts.length;
          while (low < high) {
            const mid = low + high >> 1;
            if (this.lineStarts[mid] < offset)
              low = mid + 1;
            else
              high = mid;
          }
          if (this.lineStarts[low] === offset)
            return { line: low + 1, col: 1 };
          if (low === 0)
            return { line: 0, col: offset };
          const start = this.lineStarts[low - 1];
          return { line: low, col: offset - start + 1 };
        };
      }
    };
    exports.LineCounter = LineCounter;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/parse/parser.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var cst = require_cst();
    var lexer = require_lexer();
    function includesToken(list, type) {
      for (let i = 0; i < list.length; ++i)
        if (list[i].type === type)
          return true;
      return false;
    }
    function findNonEmptyIndex(list) {
      for (let i = 0; i < list.length; ++i) {
        switch (list[i].type) {
          case "space":
          case "comment":
          case "newline":
            break;
          default:
            return i;
        }
      }
      return -1;
    }
    function isFlowToken(token2) {
      switch (token2?.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "flow-collection":
          return true;
        default:
          return false;
      }
    }
    function getPrevProps(parent) {
      switch (parent.type) {
        case "document":
          return parent.start;
        case "block-map": {
          const it = parent.items[parent.items.length - 1];
          return it.sep ?? it.start;
        }
        case "block-seq":
          return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
          return [];
      }
    }
    function getFirstKeyStartProps(prev) {
      if (prev.length === 0)
        return [];
      let i = prev.length;
      loop: while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
      while (prev[++i]?.type === "space") {
      }
      return prev.splice(i, prev.length);
    }
    function arrayPushArray(target, source) {
      if (source.length < 1e5)
        Array.prototype.push.apply(target, source);
      else
        for (let i = 0; i < source.length; ++i)
          target.push(source[i]);
    }
    function fixFlowSeqItems(fc) {
      if (fc.start.type === "flow-seq-start") {
        for (const it of fc.items) {
          if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
            if (it.key)
              it.value = it.key;
            delete it.key;
            if (isFlowToken(it.value)) {
              if (it.value.end)
                arrayPushArray(it.value.end, it.sep);
              else
                it.value.end = it.sep;
            } else
              arrayPushArray(it.start, it.sep);
            delete it.sep;
          }
        }
      }
    }
    var Parser = class {
      /**
       * @param onNewLine - If defined, called separately with the start position of
       *   each new line (in `parse()`, including the start of input).
       */
      constructor(onNewLine) {
        this.atNewLine = true;
        this.atScalar = false;
        this.indent = 0;
        this.offset = 0;
        this.onKeyLine = false;
        this.stack = [];
        this.source = "";
        this.type = "";
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
      }
      /**
       * Parse `source` as a YAML stream.
       * If `incomplete`, a part of the last line may be left as a buffer for the next call.
       *
       * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
       *
       * @returns A generator of tokens representing each directive, document, and other structure.
       */
      *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
          this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
          yield* this.next(lexeme);
        if (!incomplete)
          yield* this.end();
      }
      /**
       * Advance the parser by the `source` of one lexical token.
       */
      *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
          console.log("|", cst.prettyToken(source));
        if (this.atScalar) {
          this.atScalar = false;
          yield* this.step();
          this.offset += source.length;
          return;
        }
        const type = cst.tokenType(source);
        if (!type) {
          const message = `Not a YAML token: ${source}`;
          yield* this.pop({ type: "error", offset: this.offset, message, source });
          this.offset += source.length;
        } else if (type === "scalar") {
          this.atNewLine = false;
          this.atScalar = true;
          this.type = "scalar";
        } else {
          this.type = type;
          yield* this.step();
          switch (type) {
            case "newline":
              this.atNewLine = true;
              this.indent = 0;
              if (this.onNewLine)
                this.onNewLine(this.offset + source.length);
              break;
            case "space":
              if (this.atNewLine && source[0] === " ")
                this.indent += source.length;
              break;
            case "explicit-key-ind":
            case "map-value-ind":
            case "seq-item-ind":
              if (this.atNewLine)
                this.indent += source.length;
              break;
            case "doc-mode":
            case "flow-error-end":
              return;
            default:
              this.atNewLine = false;
          }
          this.offset += source.length;
        }
      }
      /** Call at end of input to push out any remaining constructions */
      *end() {
        while (this.stack.length > 0)
          yield* this.pop();
      }
      get sourceToken() {
        const st = {
          type: this.type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
        return st;
      }
      *step() {
        const top = this.peek(1);
        if (this.type === "doc-end" && top?.type !== "doc-end") {
          while (this.stack.length > 0)
            yield* this.pop();
          this.stack.push({
            type: "doc-end",
            offset: this.offset,
            source: this.source
          });
          return;
        }
        if (!top)
          return yield* this.stream();
        switch (top.type) {
          case "document":
            return yield* this.document(top);
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return yield* this.scalar(top);
          case "block-scalar":
            return yield* this.blockScalar(top);
          case "block-map":
            return yield* this.blockMap(top);
          case "block-seq":
            return yield* this.blockSequence(top);
          case "flow-collection":
            return yield* this.flowCollection(top);
          case "doc-end":
            return yield* this.documentEnd(top);
        }
        yield* this.pop();
      }
      peek(n) {
        return this.stack[this.stack.length - n];
      }
      *pop(error) {
        const token2 = error ?? this.stack.pop();
        if (!token2) {
          const message = "Tried to pop an empty stack";
          yield { type: "error", offset: this.offset, source: "", message };
        } else if (this.stack.length === 0) {
          yield token2;
        } else {
          const top = this.peek(1);
          if (token2.type === "block-scalar") {
            token2.indent = "indent" in top ? top.indent : 0;
          } else if (token2.type === "flow-collection" && top.type === "document") {
            token2.indent = 0;
          }
          if (token2.type === "flow-collection")
            fixFlowSeqItems(token2);
          switch (top.type) {
            case "document":
              top.value = token2;
              break;
            case "block-scalar":
              top.props.push(token2);
              break;
            case "block-map": {
              const it = top.items[top.items.length - 1];
              if (it.value) {
                top.items.push({ start: [], key: token2, sep: [] });
                this.onKeyLine = true;
                return;
              } else if (it.sep) {
                it.value = token2;
              } else {
                Object.assign(it, { key: token2, sep: [] });
                this.onKeyLine = !it.explicitKey;
                return;
              }
              break;
            }
            case "block-seq": {
              const it = top.items[top.items.length - 1];
              if (it.value)
                top.items.push({ start: [], value: token2 });
              else
                it.value = token2;
              break;
            }
            case "flow-collection": {
              const it = top.items[top.items.length - 1];
              if (!it || it.value)
                top.items.push({ start: [], key: token2, sep: [] });
              else if (it.sep)
                it.value = token2;
              else
                Object.assign(it, { key: token2, sep: [] });
              return;
            }
            /* istanbul ignore next should not happen */
            default:
              yield* this.pop();
              yield* this.pop(token2);
          }
          if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token2.type === "block-map" || token2.type === "block-seq")) {
            const last = token2.items[token2.items.length - 1];
            if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token2.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token2.indent))) {
              if (top.type === "document")
                top.end = last.start;
              else
                top.items.push({ start: last.start });
              token2.items.splice(-1, 1);
            }
          }
        }
      }
      *stream() {
        switch (this.type) {
          case "directive-line":
            yield { type: "directive", offset: this.offset, source: this.source };
            return;
          case "byte-order-mark":
          case "space":
          case "comment":
          case "newline":
            yield this.sourceToken;
            return;
          case "doc-mode":
          case "doc-start": {
            const doc = {
              type: "document",
              offset: this.offset,
              start: []
            };
            if (this.type === "doc-start")
              doc.start.push(this.sourceToken);
            this.stack.push(doc);
            return;
          }
        }
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML stream`,
          source: this.source
        };
      }
      *document(doc) {
        if (doc.value)
          return yield* this.lineEnd(doc);
        switch (this.type) {
          case "doc-start": {
            if (findNonEmptyIndex(doc.start) !== -1) {
              yield* this.pop();
              yield* this.step();
            } else
              doc.start.push(this.sourceToken);
            return;
          }
          case "anchor":
          case "tag":
          case "space":
          case "comment":
          case "newline":
            doc.start.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
          this.stack.push(bv);
        else {
          yield {
            type: "error",
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML document`,
            source: this.source
          };
        }
      }
      *scalar(scalar) {
        if (this.type === "map-value-ind") {
          const prev = getPrevProps(this.peek(2));
          const start = getFirstKeyStartProps(prev);
          let sep;
          if (scalar.end) {
            sep = scalar.end;
            sep.push(this.sourceToken);
            delete scalar.end;
          } else
            sep = [this.sourceToken];
          const map = {
            type: "block-map",
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else
          yield* this.lineEnd(scalar);
      }
      *blockScalar(scalar) {
        switch (this.type) {
          case "space":
          case "comment":
          case "newline":
            scalar.props.push(this.sourceToken);
            return;
          case "scalar":
            scalar.source = this.source;
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine) {
              let nl = this.source.indexOf("\n") + 1;
              while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf("\n", nl) + 1;
              }
            }
            yield* this.pop();
            break;
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.step();
        }
      }
      *blockMap(map) {
        const it = map.items[map.items.length - 1];
        switch (this.type) {
          case "newline":
            this.onKeyLine = false;
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "space":
          case "comment":
            if (it.value) {
              map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              if (this.atIndentedComment(it.start, map.indent)) {
                const prev = map.items[map.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  map.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
        }
        if (this.indent >= map.indent) {
          const atMapIndent = !this.onKeyLine && this.indent === map.indent;
          const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
          let start = [];
          if (atNextItem && it.sep && !it.value) {
            const nl = [];
            for (let i = 0; i < it.sep.length; ++i) {
              const st = it.sep[i];
              switch (st.type) {
                case "newline":
                  nl.push(i);
                  break;
                case "space":
                  break;
                case "comment":
                  if (st.indent > map.indent)
                    nl.length = 0;
                  break;
                default:
                  nl.length = 0;
              }
            }
            if (nl.length >= 2)
              start = it.sep.splice(nl[1]);
          }
          switch (this.type) {
            case "anchor":
            case "tag":
              if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start });
                this.onKeyLine = true;
              } else if (it.sep) {
                it.sep.push(this.sourceToken);
              } else {
                it.start.push(this.sourceToken);
              }
              return;
            case "explicit-key-ind":
              if (!it.sep && !it.explicitKey) {
                it.start.push(this.sourceToken);
                it.explicitKey = true;
              } else if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start, explicitKey: true });
              } else {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [this.sourceToken], explicitKey: true }]
                });
              }
              this.onKeyLine = true;
              return;
            case "map-value-ind":
              if (it.explicitKey) {
                if (!it.sep) {
                  if (includesToken(it.start, "newline")) {
                    Object.assign(it, { key: null, sep: [this.sourceToken] });
                  } else {
                    const start2 = getFirstKeyStartProps(it.start);
                    this.stack.push({
                      type: "block-map",
                      offset: this.offset,
                      indent: this.indent,
                      items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                    });
                  }
                } else if (it.value) {
                  map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                  });
                } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                  const start2 = getFirstKeyStartProps(it.start);
                  const key = it.key;
                  const sep = it.sep;
                  sep.push(this.sourceToken);
                  delete it.key;
                  delete it.sep;
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key, sep }]
                  });
                } else if (start.length > 0) {
                  it.sep = it.sep.concat(start, this.sourceToken);
                } else {
                  it.sep.push(this.sourceToken);
                }
              } else {
                if (!it.sep) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else if (it.value || atNextItem) {
                  map.items.push({ start, key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [], key: null, sep: [this.sourceToken] }]
                  });
                } else {
                  it.sep.push(this.sourceToken);
                }
              }
              this.onKeyLine = true;
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs);
              } else {
                Object.assign(it, { key: fs, sep: [] });
                this.onKeyLine = true;
              }
              return;
            }
            default: {
              const bv = this.startBlockValue(map);
              if (bv) {
                if (bv.type === "block-seq") {
                  if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                    yield* this.pop({
                      type: "error",
                      offset: this.offset,
                      message: "Unexpected block-seq-ind on same line with key",
                      source: this.source
                    });
                    return;
                  }
                } else if (atMapIndent) {
                  map.items.push({ start });
                }
                this.stack.push(bv);
                return;
              }
            }
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
          case "newline":
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                seq.items.push({ start: [this.sourceToken] });
            } else
              it.start.push(this.sourceToken);
            return;
          case "space":
          case "comment":
            if (it.value)
              seq.items.push({ start: [this.sourceToken] });
            else {
              if (this.atIndentedComment(it.start, seq.indent)) {
                const prev = seq.items[seq.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  seq.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
          case "anchor":
          case "tag":
            if (it.value || this.indent <= seq.indent)
              break;
            it.start.push(this.sourceToken);
            return;
          case "seq-item-ind":
            if (this.indent !== seq.indent)
              break;
            if (it.value || includesToken(it.start, "seq-item-ind"))
              seq.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
        }
        if (this.indent > seq.indent) {
          const bv = this.startBlockValue(seq);
          if (bv) {
            this.stack.push(bv);
            return;
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === "flow-error-end") {
          let top;
          do {
            yield* this.pop();
            top = this.peek(1);
          } while (top?.type === "flow-collection");
        } else if (fc.end.length === 0) {
          switch (this.type) {
            case "comma":
            case "explicit-key-ind":
              if (!it || it.sep)
                fc.items.push({ start: [this.sourceToken] });
              else
                it.start.push(this.sourceToken);
              return;
            case "map-value-ind":
              if (!it || it.value)
                fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              return;
            case "space":
            case "comment":
            case "newline":
            case "anchor":
            case "tag":
              if (!it || it.value)
                fc.items.push({ start: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                it.start.push(this.sourceToken);
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (!it || it.value)
                fc.items.push({ start: [], key: fs, sep: [] });
              else if (it.sep)
                this.stack.push(fs);
              else
                Object.assign(it, { key: fs, sep: [] });
              return;
            }
            case "flow-map-end":
            case "flow-seq-end":
              fc.end.push(this.sourceToken);
              return;
          }
          const bv = this.startBlockValue(fc);
          if (bv)
            this.stack.push(bv);
          else {
            yield* this.pop();
            yield* this.step();
          }
        } else {
          const parent = this.peek(2);
          if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
            yield* this.pop();
            yield* this.step();
          } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            fixFlowSeqItems(fc);
            const sep = fc.end.splice(1, fc.end.length);
            sep.push(this.sourceToken);
            const map = {
              type: "block-map",
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
          } else {
            yield* this.lineEnd(fc);
          }
        }
      }
      flowScalar(type) {
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        return {
          type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
      }
      startBlockValue(parent) {
        switch (this.type) {
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return this.flowScalar(this.type);
          case "block-scalar-header":
            return {
              type: "block-scalar",
              offset: this.offset,
              indent: this.indent,
              props: [this.sourceToken],
              source: ""
            };
          case "flow-map-start":
          case "flow-seq-start":
            return {
              type: "flow-collection",
              offset: this.offset,
              indent: this.indent,
              start: this.sourceToken,
              items: [],
              end: []
            };
          case "seq-item-ind":
            return {
              type: "block-seq",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken] }]
            };
          case "explicit-key-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            start.push(this.sourceToken);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, explicitKey: true }]
            };
          }
          case "map-value-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, key: null, sep: [this.sourceToken] }]
            };
          }
        }
        return null;
      }
      atIndentedComment(start, indent) {
        if (this.type !== "comment")
          return false;
        if (this.indent <= indent)
          return false;
        return start.every((st) => st.type === "newline" || st.type === "space");
      }
      *documentEnd(docEnd) {
        if (this.type !== "doc-mode") {
          if (docEnd.end)
            docEnd.end.push(this.sourceToken);
          else
            docEnd.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
        }
      }
      *lineEnd(token2) {
        switch (this.type) {
          case "comma":
          case "doc-start":
          case "doc-end":
          case "flow-seq-end":
          case "flow-map-end":
          case "map-value-ind":
            yield* this.pop();
            yield* this.step();
            break;
          case "newline":
            this.onKeyLine = false;
          // fallthrough
          case "space":
          case "comment":
          default:
            if (token2.end)
              token2.end.push(this.sourceToken);
            else
              token2.end = [this.sourceToken];
            if (this.type === "newline")
              yield* this.pop();
        }
      }
    };
    exports.Parser = Parser;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/public-api.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var errors = require_errors();
    var log = require_log();
    var identity = require_identity();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    function parseOptions(options) {
      const prettyErrors = options.prettyErrors !== false;
      const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null;
      return { lineCounter: lineCounter$1, prettyErrors };
    }
    function parseAllDocuments(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      const docs = Array.from(composer$1.compose(parser$1.parse(source)));
      if (prettyErrors && lineCounter2)
        for (const doc of docs) {
          doc.errors.forEach(errors.prettifyError(source, lineCounter2));
          doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
        }
      if (docs.length > 0)
        return docs;
      return Object.assign([], { empty: true }, composer$1.streamInfo());
    }
    function parseDocument(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      let doc = null;
      for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
          doc = _doc;
        else if (doc.options.logLevel !== "silent") {
          doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
          break;
        }
      }
      if (prettyErrors && lineCounter2) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
      return doc;
    }
    function parse(src, reviver, options) {
      let _reviver = void 0;
      if (typeof reviver === "function") {
        _reviver = reviver;
      } else if (options === void 0 && reviver && typeof reviver === "object") {
        options = reviver;
      }
      const doc = parseDocument(src, options);
      if (!doc)
        return null;
      doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
      if (doc.errors.length > 0) {
        if (doc.options.logLevel !== "silent")
          throw doc.errors[0];
        else
          doc.errors = [];
      }
      return doc.toJS(Object.assign({ reviver: _reviver }, options));
    }
    function stringify(value, replacer, options) {
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
      }
      if (typeof options === "string")
        options = options.length;
      if (typeof options === "number") {
        const indent = Math.round(options);
        options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
      }
      if (value === void 0) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
          return void 0;
      }
      if (identity.isDocument(value) && !_replacer)
        return value.toString(options);
      return new Document.Document(value, _replacer, options).toString(options);
    }
    exports.parse = parse;
    exports.parseAllDocuments = parseAllDocuments;
    exports.parseDocument = parseDocument;
    exports.stringify = stringify;
  }
});

// node_modules/@chio/bridge/node_modules/yaml/dist/index.js
var require_dist = __commonJS({
  "node_modules/@chio/bridge/node_modules/yaml/dist/index.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var Schema = require_Schema();
    var errors = require_errors();
    var Alias = require_Alias();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var cst = require_cst();
    var lexer = require_lexer();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    var publicApi = require_public_api();
    var visit = require_visit();
    exports.Composer = composer.Composer;
    exports.Document = Document.Document;
    exports.Schema = Schema.Schema;
    exports.YAMLError = errors.YAMLError;
    exports.YAMLParseError = errors.YAMLParseError;
    exports.YAMLWarning = errors.YAMLWarning;
    exports.Alias = Alias.Alias;
    exports.isAlias = identity.isAlias;
    exports.isCollection = identity.isCollection;
    exports.isDocument = identity.isDocument;
    exports.isMap = identity.isMap;
    exports.isNode = identity.isNode;
    exports.isPair = identity.isPair;
    exports.isScalar = identity.isScalar;
    exports.isSeq = identity.isSeq;
    exports.Pair = Pair.Pair;
    exports.Scalar = Scalar.Scalar;
    exports.YAMLMap = YAMLMap.YAMLMap;
    exports.YAMLSeq = YAMLSeq.YAMLSeq;
    exports.CST = cst;
    exports.Lexer = lexer.Lexer;
    exports.LineCounter = lineCounter.LineCounter;
    exports.Parser = parser.Parser;
    exports.parse = publicApi.parse;
    exports.parseAllDocuments = publicApi.parseAllDocuments;
    exports.parseDocument = publicApi.parseDocument;
    exports.stringify = publicApi.stringify;
    exports.visit = visit.visit;
    exports.visitAsync = visit.visitAsync;
  }
});

// src/control/service.ts
import { createServer } from "node:http";
import { createHash as createHash4, randomBytes as randomBytes2, randomUUID as randomUUID3, timingSafeEqual } from "node:crypto";
import { closeSync as closeSync4, existsSync as existsSync2, fsyncSync as fsyncSync4, lstatSync as lstatSync4, mkdirSync as mkdirSync4, openSync as openSync4, readFileSync as readFileSync4, readdirSync as readdirSync4, renameSync as renameSync3, writeFileSync as writeFileSync4 } from "node:fs";
import { join as join4, resolve as resolve5 } from "node:path";

// node_modules/@chio-protocol/sdk/dist/invariants/errors.js
var ChioInvariantError = class extends Error {
  code;
  constructor(code, message, options) {
    super(message, options);
    this.name = "ChioInvariantError";
    this.code = code;
  }
};

// node_modules/@chio-protocol/sdk/dist/invariants/json.js
function compareUtf16(a, b) {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}
function canonicalizeString(value) {
  return JSON.stringify(value);
}
function canonicalizeJson(value) {
  if (value === null) {
    return "null";
  }
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) {
        throw new ChioInvariantError("canonical_json", "canonical JSON does not support non-finite numbers");
      }
      return JSON.stringify(value);
    case "string":
      return canonicalizeString(value);
    case "object":
      if (Array.isArray(value)) {
        return `[${value.map((item) => canonicalizeJson(item)).join(",")}]`;
      }
      const entries = Object.entries(value);
      for (const [, entryValue] of entries) {
        if (entryValue === void 0) {
          throw new ChioInvariantError("canonical_json", "canonical JSON does not support undefined object fields");
        }
      }
      return `{${entries.sort(([left], [right]) => compareUtf16(left, right)).map(([key, entryValue]) => `${canonicalizeString(key)}:${canonicalizeJson(entryValue)}`).join(",")}}`;
    default:
      throw new ChioInvariantError("canonical_json", `canonical JSON does not support values of type ${typeof value}`);
  }
}

// node_modules/@chio-protocol/sdk/dist/invariants/crypto.js
var ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
var ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
var P256_SPKI_PREFIX = Buffer.from("3059301306072a8648ce3d020106082a8648ce3d030107034200", "hex");
var P384_SPKI_PREFIX = Buffer.from("3076301006072a8648ce3d020106052b81040022036200", "hex");

// node_modules/@chio-protocol/sdk/dist/invariants/manifest.js
var REQUIRED_PERMISSION_FIELDS = [
  "read_paths",
  "write_paths",
  "network_hosts",
  "environment_variables"
];
var REQUIRED_PERMISSION_FIELD_SET = new Set(REQUIRED_PERMISSION_FIELDS);
var U64_MAX_EXCLUSIVE = 2 ** 64;

// node_modules/@chio/bridge/dist/errors.js
var ChioBridgeError = class extends Error {
  code;
  detail;
  constructor(code, message, detail) {
    super(message);
    this.name = "ChioBridgeError";
    this.code = code;
    this.detail = detail;
  }
};

// node_modules/@chio/bridge/node_modules/@chio-protocol/sdk/dist/transport/messages.js
function rpcIdsEqual(left, right) {
  return left === right;
}
function parseJsonRpcMessage(input) {
  return JSON.parse(input);
}
function parseRpcMessages(rawBody) {
  const trimmed = rawBody.trim();
  if (!trimmed) {
    return [];
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  const messages = [];
  let buffer = [];
  for (const line of rawBody.split(/\r?\n/)) {
    if (!line.trim()) {
      if (buffer.length > 0) {
        messages.push(parseJsonRpcMessage(buffer.join("\n")));
        buffer = [];
      }
      continue;
    }
    if (line.startsWith("data:")) {
      buffer.push(line.slice(5).trimStart());
    }
  }
  if (buffer.length > 0) {
    messages.push(parseJsonRpcMessage(buffer.join("\n")));
  }
  return messages;
}
function isTerminalMessage(message, expectedId) {
  return expectedId !== void 0 && rpcIdsEqual(message.id, expectedId) && !message.method;
}
async function readRpcMessagesUntilTerminal(response, expectedId, onMessage = async () => {
}) {
  if (!response.body) {
    const parsedMessages = parseRpcMessages(await response.text());
    const messages2 = [];
    for (const message of parsedMessages) {
      messages2.push(message);
      if (isTerminalMessage(message, expectedId)) {
        break;
      }
      await onMessage(message);
    }
    return messages2;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const messages = [];
  const eventData = [];
  let rawBody = "";
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      rawBody += decoder.decode();
      break;
    }
    const chunk = decoder.decode(value, { stream: true });
    rawBody += chunk;
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) {
        if (eventData.length > 0) {
          const message = parseJsonRpcMessage(eventData.join("\n"));
          messages.push(message);
          if (isTerminalMessage(message, expectedId)) {
            await reader.cancel();
            return messages;
          }
          await onMessage(message);
          eventData.length = 0;
        }
        continue;
      }
      if (line.startsWith("data:")) {
        eventData.push(line.slice(5).trimStart());
      }
    }
  }
  if (buffer.trim()) {
    if (buffer.startsWith("data:")) {
      eventData.push(buffer.slice(5).trimStart());
    }
  }
  if (eventData.length > 0) {
    const message = parseJsonRpcMessage(eventData.join("\n"));
    messages.push(message);
    if (!isTerminalMessage(message, expectedId)) {
      await onMessage(message);
    }
  }
  if (messages.length === 0) {
    const parsedMessages = parseRpcMessages(rawBody);
    for (const message of parsedMessages) {
      messages.push(message);
      if (isTerminalMessage(message, expectedId)) {
        return messages;
      }
      await onMessage(message);
    }
  }
  return messages;
}
function terminalMessage(messages, expectedId) {
  const match = messages.find((message) => rpcIdsEqual(message.id, expectedId) && !message.method);
  if (!match) {
    throw new Error(`no terminal response for JSON-RPC id ${expectedId}`);
  }
  const error = match.error;
  if (error && typeof error === "object") {
    const message = "message" in error && typeof error.message === "string" ? error.message : `JSON-RPC error for id ${expectedId}`;
    throw new Error(message);
  }
  return match;
}

// node_modules/@chio/bridge/node_modules/@chio-protocol/sdk/dist/transport/session.js
function responseHeaders(response) {
  return Object.fromEntries(response.headers.entries());
}
function buildRpcHeaders(authToken, sessionId, protocolVersion) {
  const headers = {
    Authorization: `Bearer ${authToken}`,
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json"
  };
  if (sessionId) {
    headers["MCP-Session-Id"] = sessionId;
  }
  if (protocolVersion) {
    headers["MCP-Protocol-Version"] = protocolVersion;
  }
  return headers;
}
function buildSessionDeleteHeaders(authToken, sessionId) {
  return {
    Authorization: `Bearer ${authToken}`,
    "MCP-Session-Id": sessionId
  };
}
async function postRpc(baseUrl, authToken, sessionId, protocolVersion, body2, onMessage = async () => {
}, fetchImpl = fetch) {
  const response = await fetchImpl(`${baseUrl}/mcp`, {
    method: "POST",
    headers: buildRpcHeaders(authToken, sessionId, protocolVersion),
    body: JSON.stringify(body2)
  });
  return {
    request: body2,
    status: response.status,
    headers: responseHeaders(response),
    messages: await readRpcMessagesUntilTerminal(response, body2.id, onMessage)
  };
}
async function postNotification(baseUrl, authToken, sessionId, protocolVersion, body2, onMessage = async () => {
}, fetchImpl = fetch) {
  const response = await fetchImpl(`${baseUrl}/mcp`, {
    method: "POST",
    headers: buildRpcHeaders(authToken, sessionId, protocolVersion),
    body: JSON.stringify(body2)
  });
  return {
    request: body2,
    status: response.status,
    headers: responseHeaders(response),
    messages: await readRpcMessagesUntilTerminal(response, void 0, onMessage)
  };
}
async function deleteSession(baseUrl, authToken, sessionId, fetchImpl = fetch) {
  const response = await fetchImpl(`${baseUrl}/mcp`, {
    method: "DELETE",
    headers: buildSessionDeleteHeaders(authToken, sessionId)
  });
  return {
    status: response.status,
    headers: responseHeaders(response)
  };
}

// node_modules/@chio/bridge/node_modules/@chio-protocol/sdk/dist/types.js
function isJsonRpcFailure(message) {
  return "error" in message;
}

// node_modules/@chio/bridge/node_modules/@chio-protocol/sdk/dist/session/session.js
var ChioSession = class {
  authToken;
  baseUrl;
  handshake;
  protocolVersion;
  sessionId;
  #fetchImpl;
  #nextRequestId;
  #onMessage;
  constructor(options) {
    this.authToken = options.authToken;
    this.baseUrl = options.baseUrl;
    this.handshake = options.handshake ?? null;
    this.protocolVersion = options.protocolVersion;
    this.sessionId = options.sessionId;
    this.#fetchImpl = options.fetchImpl ?? fetch;
    this.#nextRequestId = 2;
    this.#onMessage = options.onMessage ?? (async () => {
    });
  }
  setMessageHandler(onMessage) {
    this.#onMessage = onMessage;
  }
  async request(method, params, onMessage = this.#onMessage) {
    const request = {
      jsonrpc: "2.0",
      id: this.#nextId(),
      method
    };
    if (params !== void 0) {
      request.params = params;
    }
    return postRpc(this.baseUrl, this.authToken, this.sessionId, this.protocolVersion, request, onMessage, this.#fetchImpl);
  }
  async sendEnvelope(body2, onMessage = this.#onMessage) {
    return postRpc(this.baseUrl, this.authToken, this.sessionId, this.protocolVersion, body2, onMessage, this.#fetchImpl);
  }
  async requestResult(method, params, onMessage = this.#onMessage) {
    const exchange = await this.request(method, params, onMessage);
    return terminalMessage(exchange.messages, exchange.request.id);
  }
  async notification(method, params, onMessage = this.#onMessage) {
    const notification = {
      jsonrpc: "2.0",
      method
    };
    if (params !== void 0) {
      notification.params = params;
    }
    return postNotification(this.baseUrl, this.authToken, this.sessionId, this.protocolVersion, notification, onMessage, this.#fetchImpl);
  }
  async listTools(params = {}) {
    return this.#result("tools/list", params);
  }
  async callTool(name, args = {}) {
    return this.#result("tools/call", {
      name,
      arguments: args
    });
  }
  async listResources(params = {}) {
    return this.#result("resources/list", params);
  }
  async readResource(uri) {
    return this.#result("resources/read", { uri });
  }
  async subscribeResource(uri) {
    return this.#result("resources/subscribe", { uri });
  }
  async unsubscribeResource(uri) {
    return this.#result("resources/unsubscribe", { uri });
  }
  async listResourceTemplates(params = {}) {
    return this.#result("resources/templates/list", params);
  }
  async listPrompts(params = {}) {
    return this.#result("prompts/list", params);
  }
  async getPrompt(name, args) {
    const params = { name };
    if (args) {
      params.arguments = args;
    }
    return this.#result("prompts/get", params);
  }
  async complete(params) {
    return this.#result("completion/complete", params);
  }
  async setLogLevel(level) {
    return this.notification("logging/setLevel", { level });
  }
  async listTasks(params = {}) {
    return this.#result("tasks/list", params);
  }
  async getTask(taskId) {
    return this.#result("tasks/get", { taskId });
  }
  async getTaskResult(taskId) {
    return this.#result("tasks/result", { taskId });
  }
  async cancelTask(taskId) {
    return this.#result("tasks/cancel", { taskId });
  }
  async close() {
    return deleteSession(this.baseUrl, this.authToken, this.sessionId, this.#fetchImpl);
  }
  #nextId() {
    const id = this.#nextRequestId;
    this.#nextRequestId += 1;
    return id;
  }
  async #result(method, params) {
    const response = await this.requestResult(method, params);
    if (isJsonRpcFailure(response)) {
      throw new Error(response.error.message);
    }
    return response.result;
  }
};

// node_modules/@chio/bridge/node_modules/@chio-protocol/sdk/dist/invariants/errors.js
var ChioInvariantError2 = class extends Error {
  code;
  constructor(code, message, options) {
    super(message, options);
    this.name = "ChioInvariantError";
    this.code = code;
  }
};

// node_modules/@chio/bridge/node_modules/@chio-protocol/sdk/dist/invariants/json.js
function compareUtf162(a, b) {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}
function canonicalizeString2(value) {
  return JSON.stringify(value);
}
function canonicalizeJson2(value) {
  if (value === null) {
    return "null";
  }
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) {
        throw new ChioInvariantError2("canonical_json", "canonical JSON does not support non-finite numbers");
      }
      return JSON.stringify(value);
    case "string":
      return canonicalizeString2(value);
    case "object":
      if (Array.isArray(value)) {
        return `[${value.map((item) => canonicalizeJson2(item)).join(",")}]`;
      }
      const entries = Object.entries(value);
      for (const [, entryValue] of entries) {
        if (entryValue === void 0) {
          throw new ChioInvariantError2("canonical_json", "canonical JSON does not support undefined object fields");
        }
      }
      return `{${entries.sort(([left], [right]) => compareUtf162(left, right)).map(([key, entryValue]) => `${canonicalizeString2(key)}:${canonicalizeJson2(entryValue)}`).join(",")}}`;
    default:
      throw new ChioInvariantError2("canonical_json", `canonical JSON does not support values of type ${typeof value}`);
  }
}

// node_modules/@chio/bridge/node_modules/@chio-protocol/sdk/dist/invariants/crypto.js
import { createHash, createPrivateKey, createPublicKey, sign as signMessage, verify as verifySignature } from "node:crypto";
var ED25519_PKCS8_PREFIX2 = Buffer.from("302e020100300506032b657004220420", "hex");
var ED25519_SPKI_PREFIX2 = Buffer.from("302a300506032b6570032100", "hex");
var P256_SPKI_PREFIX2 = Buffer.from("3059301306072a8648ce3d020106082a8648ce3d030107034200", "hex");
var P384_SPKI_PREFIX2 = Buffer.from("3076301006072a8648ce3d020106052b81040022036200", "hex");
var P256_RAW_POINT_BYTES = 65;
var P384_RAW_POINT_BYTES = 97;
function normalizeHex(hex) {
  return hex.startsWith("0x") ? hex.slice(2).toLowerCase() : hex.toLowerCase();
}
function hexToBuffer(hex, expectedBytes, code) {
  const normalized = normalizeHex(hex);
  if (!/^[0-9a-f]+$/i.test(normalized)) {
    throw new ChioInvariantError2(code, "value is not valid hexadecimal");
  }
  if (normalized.length !== expectedBytes * 2) {
    throw new ChioInvariantError2(code, `expected ${expectedBytes} bytes of hex, got ${normalized.length / 2}`);
  }
  return Buffer.from(normalized, "hex");
}
function createEd25519PublicKey(publicKeyHex) {
  try {
    return createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX2, hexToBuffer(publicKeyHex, 32, "invalid_public_key")]),
      format: "der",
      type: "spki"
    });
  } catch (cause) {
    if (cause instanceof ChioInvariantError2) {
      throw cause;
    }
    throw new ChioInvariantError2("invalid_public_key", "value is not a valid Ed25519 public key", { cause });
  }
}
function sha256Hex2(input) {
  return createHash("sha256").update(input).digest("hex");
}
function publicKeyHexMatches2(left, right) {
  return normalizeHex(left) === normalizeHex(right);
}
function verifyEd25519Signature2(message, publicKeyHex, signatureHex) {
  const signatureBytes = hexToBuffer(signatureHex, 64, "invalid_signature");
  const key = createEd25519PublicKey(publicKeyHex);
  return verifySignature(null, Buffer.isBuffer(message) ? message : Buffer.from(message, "utf8"), key, signatureBytes);
}
function hexBodyToBuffer(hexBody) {
  if (hexBody.length === 0 || hexBody.length % 2 !== 0) {
    throw new ChioInvariantError2("invalid_signature", "signature hex body must be a non-empty even-length string");
  }
  if (!/^[0-9a-f]+$/i.test(hexBody)) {
    throw new ChioInvariantError2("invalid_signature", "signature hex body is not valid hexadecimal");
  }
  return Buffer.from(hexBody, "hex");
}
function createEcdsaPublicKey(publicKeyHex, curve) {
  const rawHex = normalizeHex(publicKeyHex);
  if (!/^[0-9a-f]+$/i.test(rawHex)) {
    throw new ChioInvariantError2("invalid_public_key", "public key is not valid hexadecimal");
  }
  const rawBytes = Buffer.from(rawHex, "hex");
  const expectedRawLen = curve === "P-256" ? P256_RAW_POINT_BYTES : P384_RAW_POINT_BYTES;
  const prefix = curve === "P-256" ? P256_SPKI_PREFIX2 : P384_SPKI_PREFIX2;
  let spki;
  if (rawBytes.length === expectedRawLen && rawBytes[0] === 4) {
    spki = Buffer.concat([prefix, rawBytes]);
  } else if (rawBytes.length > expectedRawLen) {
    spki = rawBytes;
  } else {
    throw new ChioInvariantError2("invalid_public_key", `value is not a valid ${curve} public key (expected ${expectedRawLen} raw bytes or SPKI DER)`);
  }
  try {
    return createPublicKey({
      key: spki,
      format: "der",
      type: "spki"
    });
  } catch (cause) {
    throw new ChioInvariantError2("invalid_public_key", `value is not a valid ${curve} public key`, { cause });
  }
}
function verifyEcdsaSignature(message, publicKeyHex, signatureHexBody, curve) {
  const hashAlgorithm = curve === "P-256" ? "sha256" : "sha384";
  const signatureDer = hexBodyToBuffer(signatureHexBody);
  const key = createEcdsaPublicKey(publicKeyHex, curve);
  try {
    return verifySignature(hashAlgorithm, message, { key, dsaEncoding: "der" }, signatureDer);
  } catch (cause) {
    throw new ChioInvariantError2("invalid_signature", `value is not a valid ${curve} signature`, { cause });
  }
}
function verifyChioSignature2(signedBytes, signature, publicKey) {
  const message = Buffer.isBuffer(signedBytes) ? signedBytes : Buffer.from(signedBytes, "utf8");
  if (signature.startsWith("p256:")) {
    return verifyEcdsaSignature(message, publicKey, signature.slice("p256:".length), "P-256");
  }
  if (signature.startsWith("p384:")) {
    return verifyEcdsaSignature(message, publicKey, signature.slice("p384:".length), "P-384");
  }
  if (signature.startsWith("hybrid:")) {
    throw new ChioInvariantError2("invalid_signature", "hybrid post-quantum signatures are not supported by this SDK build");
  }
  return verifyEd25519Signature2(message, publicKey, signature);
}

// node_modules/@chio/bridge/node_modules/@chio-protocol/sdk/dist/invariants/receipt.js
function safeVerifyReceiptSignature(signedBytes, signature, publicKey) {
  try {
    return verifyChioSignature2(signedBytes, signature, publicKey);
  } catch (error) {
    if (error instanceof ChioInvariantError2) {
      return false;
    }
    throw error;
  }
}
function receiptIdInput(receipt) {
  const input = {
    action: receipt.action,
    capability_id: receipt.capability_id,
    content_hash: receipt.content_hash,
    receipt_kind: receipt.receipt_kind,
    boundary_class: receipt.boundary_class,
    tool_origin: receipt.tool_origin,
    redaction_mode: receipt.redaction_mode,
    kernel_key: receipt.kernel_key,
    policy_hash: receipt.policy_hash,
    timestamp: receipt.timestamp,
    tool_name: receipt.tool_name,
    tool_server: receipt.tool_server
  };
  if (receipt.evidence !== void 0 && receipt.evidence.length > 0) {
    input.evidence = receipt.evidence;
  }
  if (receipt.decision !== void 0) {
    input.decision = receipt.decision;
  }
  if (receipt.observation_outcome !== void 0) {
    input.observation_outcome = receipt.observation_outcome;
  }
  if (receipt.actor_chain !== void 0 && receipt.actor_chain.length > 0) {
    input.actor_chain = receipt.actor_chain;
  }
  if (receipt.metadata !== void 0 && receipt.metadata !== null) {
    input.metadata = receipt.metadata;
  }
  input.trust_level = receipt.trust_level;
  if (receipt.tenant_id !== void 0) {
    input.tenant_id = receipt.tenant_id;
  }
  return input;
}
function contentAddressedReceiptId(receipt) {
  return sha256Hex2(canonicalizeJson2(receiptIdInput(receipt)));
}
function receiptSigningBodyCanonicalJson2(receipt) {
  return canonicalizeJson2({
    id: receipt.id,
    body: receiptIdInput(receipt)
  });
}
function receiptSemantics(receipt) {
  return { receipt_kind: receipt.receipt_kind, boundary_class: receipt.boundary_class };
}
function resultLabel(receiptKind, boundaryClass, decision) {
  if (receiptKind === "mediated_decision" && boundaryClass === "prevent" && decision === "allow") {
    return "Authorized";
  }
  if (receiptKind === "trace_observation") {
    return "Observed";
  }
  if (receiptKind === "advisory_evaluation") {
    return "Advisory";
  }
  switch (decision) {
    case "allow":
      return "Allowed";
    case "deny":
      return "Denied";
    case "cancelled":
      return "Cancelled";
    case "incomplete":
      return "Incomplete";
    case "none":
      return "Invalid";
  }
}
function validObservationOutcome(value) {
  return value === "observed" || value === "evaluated" || value === "dropped";
}
function semanticallySignable(receipt, decision) {
  if (receipt.receipt_kind === "mediated_decision") {
    return receipt.boundary_class === "prevent" && receipt.trust_level === "mediated" && decision !== "none" && receipt.observation_outcome === void 0;
  }
  if (receipt.receipt_kind === "trace_observation") {
    return receipt.boundary_class === "detect_only" && receipt.trust_level === "verified" && decision === "none" && validObservationOutcome(receipt.observation_outcome);
  }
  if (receipt.receipt_kind === "advisory_evaluation") {
    return receipt.boundary_class === "advisory_only" && receipt.trust_level === "advisory" && decision === "none" && validObservationOutcome(receipt.observation_outcome);
  }
  return false;
}
function verifyReceipt2(receipt, trustedSigners = []) {
  const signingBodyCanonicalJson = receiptSigningBodyCanonicalJson2(receipt);
  const parameterCanonicalJson = canonicalizeJson2(receipt.action.parameters);
  const decision = receipt.decision?.verdict ?? "none";
  const semantics = receiptSemantics(receipt);
  const semanticAuthorized = semantics.receipt_kind === "mediated_decision" && semantics.boundary_class === "prevent" && decision === "allow";
  const signerTrusted = trustedSigners.length > 0 && trustedSigners.some((signer) => publicKeyHexMatches2(signer, receipt.kernel_key));
  const receiptIdValid = receipt.id === contentAddressedReceiptId(receipt);
  const signatureValid = receiptIdValid && semanticallySignable(receipt, decision) && safeVerifyReceiptSignature(signingBodyCanonicalJson, receipt.signature, receipt.kernel_key);
  const parameterHashValid = receipt.action.parameter_hash === sha256Hex2(parameterCanonicalJson);
  const authorized = semanticAuthorized && signatureValid && parameterHashValid && receiptIdValid && signerTrusted;
  return {
    signature_valid: signatureValid,
    parameter_hash_valid: parameterHashValid,
    receipt_id_valid: receiptIdValid,
    decision,
    receipt_kind: semantics.receipt_kind,
    boundary_class: semantics.boundary_class,
    trust_level: receipt.trust_level,
    result: resultLabel(semantics.receipt_kind, semantics.boundary_class, decision),
    authorized,
    signer_key_hex: receipt.kernel_key,
    signer_trusted: signerTrusted,
    ok: signatureValid && parameterHashValid && receiptIdValid && signerTrusted
  };
}
function verifyReceiptWithTrustedSigners2(receipt, trustedSigners) {
  return verifyReceipt2(receipt, trustedSigners);
}

// node_modules/@chio/bridge/node_modules/@chio-protocol/sdk/dist/invariants/manifest.js
var REQUIRED_PERMISSION_FIELDS2 = [
  "read_paths",
  "write_paths",
  "network_hosts",
  "environment_variables"
];
var REQUIRED_PERMISSION_FIELD_SET2 = new Set(REQUIRED_PERMISSION_FIELDS2);
var U64_MAX_EXCLUSIVE2 = 2 ** 64;

// node_modules/@chio/bridge/node_modules/@chio-protocol/sdk/dist/invariants/signing.js
function verifyUtf8MessageEd255192(input, publicKeyHex, signatureHex) {
  return verifyEd25519Signature2(input, publicKeyHex, signatureHex);
}

// node_modules/@chio/bridge/node_modules/@chio-protocol/sdk/dist/finding.js
var BPS = 10000n;
var BPS_DENOMINATOR = BPS * BPS * BPS;

// node_modules/@chio/bridge/node_modules/@chio-protocol/sdk/dist/cognition_market.js
var PURCHASE_DOMAIN = Buffer.from("chio.finding.public-purchase-request.v1\0", "utf8");
var VERIFIED_FIX_SUBMISSION_DOMAIN = Buffer.from("chio.finding.verified-fix-submission-id.v1\0", "utf8");
var VOLUNTARY_RETRACTION_DOMAIN = Buffer.from("chio.finding.voluntary-retraction-request-id.v1\0", "utf8");
var PROOF_RESPONSE_MAX_BYTES = 24 * 1024 * 1024;
var PURCHASE_RESULT_MAX_BYTES = 16 * 1024 * 1024;
var JSON_RESPONSE_MAX_BYTES = 2 * 1024 * 1024;

// node_modules/@chio/bridge/dist/types.js
var RULE_KEYS = [
  "forbidden_paths",
  "path_allowlist",
  "egress",
  "secret_patterns",
  "patch_integrity",
  "shell_commands",
  "tool_access",
  "computer_use",
  "remote_desktop_channels",
  "input_injection",
  // Wave 1.6: first-class rule variants in arc-policy
  // (see arc/crates/arc-policy/src/models.rs#Rules, ~L143).
  "velocity",
  "human_in_loop"
];
var EXTENSION_KEYS = [
  "posture",
  "origins",
  "detection",
  "reputation",
  "runtime_assurance",
  // Wave 1.6: chio passthrough extensions. arc kernel does not
  // interpret this block; chio-bridge enforces it downstream.
  "chio"
];

// node_modules/@chio/bridge/dist/policy.js
var import_yaml = __toESM(require_dist(), 1);
var RULE_KEY_SET = new Set(RULE_KEYS);
var EXTENSION_KEY_SET = new Set(EXTENSION_KEYS);

// node_modules/@chio/bridge/dist/approval.js
function verifyApprovalToolCall(input, expected) {
  try {
    const params = input;
    const intent = params?._meta?.chioGovernedIntent;
    const token2 = params?._meta?.chioApprovalToken;
    const now = Math.floor(Date.now() / 1e3);
    if (params?.name !== expected.tool || canonicalizeJson2(params.arguments) !== canonicalizeJson2(expected.arguments) || params?._meta?.chioRequestId !== expected.requestId || intent?.server_id !== expected.serverId || intent.tool_name !== expected.tool || intent?.body?.kind !== "bound_tool_invocation" || intent.body.value?.capability_id !== expected.capabilityId || intent.body.value.parameters_hash !== "0x" + sha256Hex2(canonicalizeJson2(expected.arguments)) || intent.context?.mcpSessionId !== expected.sessionId || intent.context?.capabilityId !== expected.capabilityId || !token2 || !["approved", "denied"].includes(token2.decision) || token2.subject !== expected.subjectKey || token2.request_id !== expected.requestId || typeof token2.approver !== "string" || !expected.trustedSigners.some((key) => key.toLowerCase() === token2.approver.toLowerCase()) || token2.governed_intent_hash !== sha256Hex2(canonicalizeJson2(intent)) || typeof token2.id !== "string" || !token2.id || !Number.isSafeInteger(token2.issued_at) || !Number.isSafeInteger(token2.expires_at) || token2.issued_at > now + 5 || token2.expires_at <= now || token2.expires_at <= token2.issued_at || token2.expires_at - token2.issued_at > 3600 || token2.algorithm !== void 0 || token2.threshold_proposal_hash !== void 0)
      return void 0;
    const body2 = {
      id: token2.id,
      approver: token2.approver,
      subject: token2.subject,
      governed_intent_hash: token2.governed_intent_hash,
      request_id: token2.request_id,
      issued_at: token2.issued_at,
      expires_at: token2.expires_at,
      decision: token2.decision
    };
    if (!verifyUtf8MessageEd255192(canonicalizeJson2(body2), token2.approver, token2.signature))
      return void 0;
    return { decision: token2.decision, params: JSON.parse(canonicalizeJson2(params)) };
  } catch {
    return void 0;
  }
}

// node_modules/@chio/bridge/dist/execution.js
function validateContext(authority, config, requiredTools) {
  const denied = () => ({ ok: false, reason: "authenticated session credential does not match the retained caller, capability, resource owner, tool scope or lifetime" });
  const binding = authority?.sessionCredential;
  const now = Math.floor(Date.now() / 1e3);
  if (authority?.schema !== "chio.mcp.execution-context.v1" || authority.evidenceVersion !== "1" || authority.deliveryAcknowledgementVersion !== "1" || authority.subjectKey !== config.subjectKey || authority.serverId !== config.serverId || !Array.isArray(authority.capabilityIds) || authority.capabilityIds.length !== 1 || authority.capabilityIds[0] !== config.capabilityId || binding?.schema !== "chio.mcp.session-credential.v1" || binding.sessionId !== config.sessionId || binding.subjectKey !== config.subjectKey || binding.serverId !== config.serverId || binding.endpointPath !== "/mcp" || !Array.isArray(binding.capabilityIds) || binding.capabilityIds.length !== 1 || binding.capabilityIds[0] !== config.capabilityId || !Array.isArray(binding.allowedTools) || !binding.allowedTools.length || binding.allowedTools.some((name) => typeof name !== "string" || !/^[a-zA-Z0-9_.-]{1,128}$/.test(name)) || new Set(binding.allowedTools).size !== binding.allowedTools.length || !Number.isSafeInteger(binding.issuedAt) || binding.issuedAt > now + 5 || !Number.isSafeInteger(binding.expiresAt) || binding.expiresAt <= now || binding.expiresAt <= binding.issuedAt || binding.expiresAt - binding.issuedAt > 3600)
    return denied();
  if (requiredTools && (requiredTools.length !== binding.allowedTools.length || [...requiredTools].sort().some((name, index) => name !== [...binding.allowedTools].sort()[index])))
    return denied();
  return { ok: true, sessionCredential: JSON.parse(JSON.stringify(binding)) };
}
function verifyBoundReceipt(input, expected) {
  try {
    if (!input || typeof input !== "object" || !expected.trustedSigners.length)
      return false;
    const receipt = input;
    const verification = verifyReceiptWithTrustedSigners2(receipt, expected.trustedSigners);
    const metadata = receipt.metadata;
    return verification.ok && receipt.receipt_kind === "mediated_decision" && receipt.boundary_class === "prevent" && receipt.trust_level === "mediated" && receipt.capability_id === expected.capabilityId && receipt.tool_server === expected.serverId && receipt.tool_name === expected.tool && metadata?.receipt_context?.request_id === expected.requestId && metadata?.attribution?.subject_key === expected.subjectKey && canonicalizeJson2(receipt.action.parameters) === canonicalizeJson2(expected.parameters);
  } catch {
    return false;
  }
}
function verifyReceivedOutcome(outcome, expected) {
  try {
    const receipt = outcome.receipt;
    const delivery = outcome.delivery;
    if (outcome.state !== "completed" || outcome.evidence !== "verified" || !receipt || !delivery || outcome.requestId !== expected.requestId || !verifyBoundReceipt(receipt, expected))
      return false;
    const admission = receipt.metadata?.admission_operation;
    return receipt.decision?.verdict === "allow" && admission?.schema === "chio.admission-receipt.v1" && admission.request_id === expected.requestId && admission.projected_state === "completed" && admission.projected_dispatch_state === "terminal" && typeof admission.tool_outcome_id === "string" && outcome.result !== void 0 && receipt.content_hash === sha256Hex2(canonicalizeJson2(outcome.result)) && delivery.schema === "chio.mcp.delivery-ack.v1" && delivery.requestId === expected.requestId && delivery.receiptId === receipt.id && delivery.resultHash === receipt.content_hash && /^[a-f0-9]{64}$/.test(delivery.requestHash) && typeof delivery.acknowledgement === "string" && /^[A-Za-z0-9_-]{43}$/.test(delivery.acknowledgement);
  } catch {
    return false;
  }
}
function verifyCompletedOutcome(outcome, config, request) {
  try {
    const params = { name: request.tool, arguments: request.arguments, _meta: { chioRequestId: request.requestId, ...request.approval } };
    return verifyReceivedOutcome(outcome, { ...config, tool: request.tool, parameters: request.arguments, requestId: request.requestId }) && outcome.delivery.requestHash === sha256Hex2(canonicalizeJson2({ method: "tools/call", params }));
  } catch {
    return false;
  }
}
function createMcpExecutionClient(options) {
  const endpoint = new URL(options.endpoint);
  if (endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname))) {
    throw new ChioBridgeError("invalid_arg", "MCP endpoint requires HTTPS or loopback HTTP");
  }
  if (endpoint.username || endpoint.password || endpoint.hash || endpoint.search) {
    throw new ChioBridgeError("invalid_arg", "MCP endpoint must not contain credentials, query or fragment");
  }
  if (!options.sessionId || !options.bearerToken || !options.capabilityId || !options.serverId || !/^[a-f0-9]{64}$/i.test(options.subjectKey) || !options.trustedSigners.length || options.trustedSigners.some((key) => !/^[a-f0-9]{64}$/i.test(key))) {
    throw new ChioBridgeError("invalid_arg", "execution requires a retained session, delegated bearer, capability, server, subject and pinned signer keys");
  }
  const timeoutMs = options.timeoutMs ?? 3e4;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0)
    throw new ChioBridgeError("invalid_arg", "invalid execution timeout");
  const config = { ...options, trustedSigners: [...options.trustedSigners] };
  const operations = /* @__PURE__ */ new Map();
  return {
    /** Run in the trusted launcher before making credentials readable to an agent. */
    async validateSession(control = {}) {
      const deadline = AbortSignal.timeout(timeoutMs);
      const signal = control.signal ? AbortSignal.any([deadline, control.signal]) : deadline;
      const fetchImpl = (input, init) => (config.fetchImpl ?? fetch)(input, { ...init, signal, redirect: "error" });
      try {
        const session = new ChioSession({ baseUrl: config.endpoint, authToken: config.bearerToken, sessionId: config.sessionId, protocolVersion: "2025-11-25", fetchImpl });
        const response = await session.requestResult("chio/execution-context");
        return validateContext("result" in response ? response.result : void 0, config, control.allowedTools);
      } catch {
        return { ok: false, reason: "delegated session validation failed before dispatch" };
      }
    },
    /** The durable owner must save the verified outcome before invoking this method. */
    async acknowledge(outcome) {
      const delivery = outcome?.delivery;
      const receipt = outcome?.receipt;
      try {
        if (outcome.state !== "completed" || outcome.evidence !== "verified" || !delivery || !receipt || delivery.schema !== "chio.mcp.delivery-ack.v1" || delivery.requestId !== outcome.requestId || delivery.receiptId !== receipt.id || delivery.resultHash !== receipt.content_hash || delivery.resultHash !== sha256Hex2(canonicalizeJson2(outcome.result)) || !verifyBoundReceipt(receipt, { ...config, tool: receipt.tool_name, parameters: receipt.action.parameters, requestId: outcome.requestId })) {
          return { acknowledged: false, reason: "only an exact verified completed result can be acknowledged" };
        }
      } catch {
        return { acknowledged: false, reason: "malformed durable outcome cannot be acknowledged" };
      }
      const signal = AbortSignal.timeout(timeoutMs);
      const fetchImpl = (input, init) => (config.fetchImpl ?? fetch)(input, { ...init, signal, redirect: "error" });
      try {
        const session = new ChioSession({ baseUrl: config.endpoint, authToken: config.bearerToken, sessionId: config.sessionId, protocolVersion: "2025-11-25", fetchImpl });
        const response = await session.requestResult("chio/acknowledge", delivery);
        const result = "result" in response ? response.result : void 0;
        if (result?.schema !== delivery.schema || result.requestId !== delivery.requestId || result.receiptId !== delivery.receiptId || result.acknowledged !== true)
          throw new Error("invalid acknowledgement response");
        return { acknowledged: true, requestId: delivery.requestId, receiptId: delivery.receiptId };
      } catch {
        return { acknowledged: false, reason: "acknowledgement not confirmed; retain durable result and retry only acknowledgement" };
      }
    },
    execute(request, control = {}) {
      if (!request.requestId || request.requestId.length > 2048 || !request.tool || !request.arguments || typeof request.arguments !== "object" || Array.isArray(request.arguments)) {
        return Promise.resolve({ state: "not_dispatched", evidence: "unverified", requestId: request.requestId, reason: "invalid execution request" });
      }
      let snapshot;
      let digest2;
      try {
        snapshot = JSON.parse(canonicalizeJson2(request));
        digest2 = sha256Hex2(canonicalizeJson2({ tool: snapshot.tool, arguments: snapshot.arguments, ...snapshot.approval ? { approval: snapshot.approval } : {} }));
      } catch {
        return Promise.resolve({ state: "not_dispatched", evidence: "unverified", requestId: request.requestId, reason: "request is not canonical JSON" });
      }
      const prior = operations.get(snapshot.requestId);
      if (prior) {
        if (prior.digest !== digest2)
          return Promise.resolve({ state: "not_dispatched", evidence: "unverified", requestId: snapshot.requestId, reason: "request ID reused with different arguments" });
        return prior.outcome;
      }
      const outcome = dispatch(snapshot, control.signal);
      operations.set(snapshot.requestId, { digest: digest2, outcome });
      return outcome;
    }
  };
  async function dispatch(request, signal) {
    let sent = false;
    const failure = (reason) => ({
      state: sent ? "unknown" : "not_dispatched",
      evidence: "unverified",
      requestId: request.requestId,
      reason
    });
    if (signal?.aborted)
      return failure("cancelled before admission");
    const deadline = AbortSignal.timeout(timeoutMs);
    const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
    const fetchImpl = (input, init) => (config.fetchImpl ?? fetch)(input, { ...init, signal: combined, redirect: "error" });
    let session;
    try {
      session = new ChioSession({
        baseUrl: config.endpoint,
        authToken: config.bearerToken,
        sessionId: config.sessionId,
        protocolVersion: "2025-11-25",
        fetchImpl
      });
      const context = await session.requestResult("chio/execution-context");
      const authority = validateContext("result" in context ? context.result : void 0, config);
      if (!authority.ok)
        return failure(authority.reason);
      if (!authority.sessionCredential.allowedTools.includes(request.tool))
        return failure("tool is outside the authenticated session credential scope");
      const params = { name: request.tool, arguments: request.arguments, _meta: { chioRequestId: request.requestId, ...request.approval } };
      if (request.approval && verifyApprovalToolCall(params, { ...config, sessionId: config.sessionId, tool: request.tool, arguments: request.arguments, requestId: request.requestId })?.decision !== "approved")
        return failure("approval does not authorize the exact retained action");
      if (combined.aborted)
        return failure("cancelled before dispatch");
      sent = true;
      const response = await session.requestResult("tools/call", params);
      if (!("result" in response))
        return failure("kernel RPC error after dispatch; reconcile the resource before retry");
      const result = response.result;
      const envelope = result?._meta?.chioEvidence;
      if (envelope?.schema !== "chio.mcp.execution-evidence.v1" || envelope.requestId !== request.requestId)
        return failure("missing or substituted execution evidence");
      if (!verifyBoundReceipt(envelope.receipt, { ...config, tool: request.tool, parameters: request.arguments, requestId: request.requestId }))
        return failure("execution receipt failed trusted request verification");
      const receipt = envelope.receipt;
      if (receipt.decision?.verdict === "deny") {
        if (receipt.decision.guard === "kernel" && receipt.decision.reason?.startsWith("durable admission failed:")) {
          return {
            state: "unknown",
            evidence: "verified",
            requestId: request.requestId,
            receipt,
            reason: "durable admission rejected this attempt; the original operation requires reconciliation"
          };
        }
        return { state: "denied", evidence: "verified", requestId: request.requestId, receipt, reason: receipt.decision.reason };
      }
      const admission = receipt.metadata?.admission_operation;
      if (receipt.decision?.verdict !== "allow" || admission?.schema !== "chio.admission-receipt.v1" || admission.request_id !== request.requestId || admission.projected_state !== "completed" || admission.projected_dispatch_state !== "terminal" || typeof admission.tool_outcome_id !== "string" || envelope.terminalState !== "completed" || envelope.outputKind !== "value" || envelope.output === void 0 || receipt.content_hash !== sha256Hex2(canonicalizeJson2(envelope.output))) {
        return { state: "unknown", evidence: "verified", requestId: request.requestId, receipt, reason: "no verified completed result; preserve the operation fence" };
      }
      const delivery = result?._meta?.chioDelivery;
      if (!delivery || delivery.schema !== "chio.mcp.delivery-ack.v1" || delivery.requestId !== request.requestId || delivery.receiptId !== receipt.id || delivery.resultHash !== receipt.content_hash || delivery.requestHash !== sha256Hex2(canonicalizeJson2({ method: "tools/call", params })) || typeof delivery.acknowledgement !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(delivery.acknowledgement)) {
        return { state: "unknown", evidence: "verified", requestId: request.requestId, receipt, reason: "verified result lacks exact retained delivery acknowledgement; preserve operation fence" };
      }
      return { state: "completed", evidence: "verified", requestId: request.requestId, receipt, result: envelope.output, delivery };
    } catch {
      return failure(sent ? "execution outcome unknown; no automatic retry" : "kernel unavailable or malformed handshake before dispatch");
    }
  }
}

// node_modules/@chio/bridge/dist/gateway.js
import { createHash as createHash2 } from "node:crypto";
import { constants, closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { resolve, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
function operationKey(requestId) {
  return createHash2("sha256").update(requestId).digest("hex");
}
function gatewayApprovalPath(config, requestId) {
  return join(resolve(config.journalDir), "approvals", `${operationKey(requestId)}.json`);
}
function gatewayBinding(config) {
  return canonicalizeJson2({
    sessionId: config.sessionId,
    kernelSessionId: config.execution.sessionId,
    endpoint: config.execution.endpoint,
    subjectKey: config.execution.subjectKey,
    capabilityId: config.execution.capabilityId,
    serverId: config.execution.serverId,
    trustedSigners: config.execution.trustedSigners,
    tools: config.tools,
    ...config.approval ? { approval: config.approval } : {}
  });
}
function syncDirectory(path) {
  const fd = openSync(path, constants.O_RDONLY);
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
function privatePath(path, directory) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile()) || (stat.mode & 63) !== 0) {
    throw new Error("operator config and journal must be private regular paths");
  }
}
function readGatewayConfig(path) {
  privatePath(path, false);
  if (lstatSync(path).size > 1024 * 1024)
    throw new Error("gateway config exceeds size limit");
  const config = JSON.parse(readFileSync(path, "utf8"));
  if (!config?.execution?.sessionId || !config.sessionId || !config.journalDir || !Array.isArray(config.tools) || !config.tools.length) {
    throw new Error("gateway requires an operator-established kernel session, journal and explicit tools");
  }
  if (config.execution.fetchImpl !== void 0)
    throw new Error("config cannot provide executable transport");
  const names = /* @__PURE__ */ new Set();
  for (const tool of config.tools) {
    if (!tool || typeof tool.name !== "string" || !/^[a-zA-Z0-9_.-]{1,128}$/.test(tool.name) || names.has(tool.name) || !tool.inputSchema || typeof tool.inputSchema !== "object" || Array.isArray(tool.inputSchema))
      throw new Error("invalid or duplicate operator tool");
    names.add(tool.name);
  }
  if (config.approval && (!Array.isArray(config.approval.requiredTools) || !config.approval.requiredTools.length || config.approval.requiredTools.some((name) => !names.has(name)) || !config.approval.purpose || !Number.isSafeInteger(config.approval.ttlSeconds) || config.approval.ttlSeconds < 1 || config.approval.ttlSeconds > 3600))
    throw new Error("invalid approval configuration");
  if (names.has("chio_resume"))
    throw new Error("chio_resume is reserved for explicit gateway resumption");
  return config;
}
function createGateway(config, executor = createMcpExecutionClient(config.execution), delivery = {}) {
  const snapshot = JSON.parse(JSON.stringify(config));
  const directory = resolve(snapshot.journalDir);
  mkdirSync(directory, { recursive: true, mode: 448 });
  privatePath(directory, true);
  if (readdirSync(directory).includes("recovery.lock"))
    throw new Error("operator recovery is active");
  const lockPath = join(directory, "gateway.lock");
  const lock = openSync(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 384);
  writeFileSync(lock, JSON.stringify({ pid: process.pid, hostname: hostname(), sessionId: snapshot.sessionId }));
  fsyncSync(lock);
  closeSync(lock);
  syncDirectory(directory);
  const binding = gatewayBinding(snapshot);
  const bindingPath = join(directory, "authority.binding");
  if (readdirSync(directory).includes("authority.binding")) {
    privatePath(bindingPath, false);
    if (readFileSync(bindingPath, "utf8") !== binding)
      throw new Error("journal belongs to a different authority or configuration");
  } else {
    if (readdirSync(directory).some((name) => name.endsWith(".json")))
      throw new Error("operation journal is missing its authority binding");
    const fd = openSync(bindingPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 384);
    try {
      writeFileSync(fd, binding);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    syncDirectory(directory);
  }
  const records2 = /* @__PURE__ */ new Map();
  for (const filename of readdirSync(directory).filter((name) => name.endsWith(".json"))) {
    const path = join(directory, filename);
    privatePath(path, false);
    const record = JSON.parse(readFileSync(path, "utf8"));
    if (!record.requestId || !record.digest || !["awaiting_approval", "pending", "not_dispatched", "unknown", "denied", "completed"].includes(record.state))
      throw new Error("invalid operation journal");
    if (record.state !== "pending" && (!record.outcome || record.outcome.state !== record.state || record.outcome.requestId !== record.requestId))
      throw new Error("inconsistent operation journal result");
    if (record.state === "awaiting_approval" && (!record.proposal || record.proposal.request_id !== record.requestId))
      throw new Error("missing approval proposal");
    if (record.state === "completed" && (!record.request || !record.outcome || record.requestId !== record.request.requestId || record.digest !== operationKey(canonicalizeJson2({ name: record.request.tool, args: record.request.arguments })) || !verifyCompletedOutcome(record.outcome, snapshot.execution, record.request))) {
      throw new Error("cached completion does not bind a trusted original request and result");
    }
    if (records2.has(record.requestId))
      throw new Error("duplicate operation journal identity");
    records2.set(record.requestId, record);
  }
  let closed = false;
  let busy = false;
  const tools = new Map(snapshot.tools.map((tool) => [tool.name, tool]));
  const fenced = () => [...records2.values()].some((record) => record.state !== "not_dispatched" && !(record.state === "completed" && record.acknowledged === true && (!delivery.requireHostAcknowledgement || record.hostDeliveryConfirmed === true)));
  function persist(record) {
    const key = operationKey(record.requestId);
    const path = join(directory, `${key}.json`);
    const temp = join(directory, `${key}.${process.pid}.tmp`);
    const fd = openSync(temp, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 384);
    try {
      writeFileSync(fd, JSON.stringify(record));
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(temp, path);
    syncDirectory(directory);
    records2.set(record.requestId, record);
  }
  async function confirmDelivery(record) {
    const outcome = record.outcome;
    if (outcome.state === "completed" && !record.acknowledged && executor.acknowledge && (!delivery.requireHostAcknowledgement || record.hostDeliveryConfirmed === true)) {
      const acknowledgement = await executor.acknowledge(outcome);
      if (acknowledgement.acknowledged)
        persist({ ...record, acknowledged: true });
    }
    return outcome;
  }
  async function dispatch(record, request, signal) {
    busy = true;
    try {
      persist({ ...record, state: "pending", outcome: void 0, request });
      let outcome = await executor.execute(request, signal ? { signal } : {});
      if (outcome.state === "completed" && !verifyCompletedOutcome(outcome, snapshot.execution, request)) {
        outcome = { state: "unknown", evidence: "unverified", requestId: request.requestId, reason: "completed result failed durable request verification" };
      }
      const completed = { ...record, state: outcome.state, outcome, acknowledged: false, hostDeliveryRequired: delivery.requireHostAcknowledgement === true, request };
      persist(completed);
      return await confirmDelivery(completed);
    } catch {
      return { state: "unknown", evidence: "unverified", requestId: record.requestId, reason: "dispatch or persistence interrupted; no automatic retry" };
    } finally {
      busy = false;
    }
  }
  const resumeTool = { name: "chio_resume", description: "Explicitly resume one exact operator-approved proposal, retaining its original request identity. Never retries an unknown effect.", inputSchema: { type: "object", properties: { requestId: { type: "string" }, tool: { type: "string" }, arguments: { type: "object" } }, required: ["requestId", "tool", "arguments"], additionalProperties: false } };
  return {
    /** Trusted launcher observed this exact result in native host history. */
    async acknowledgeReceivedOutcome(input) {
      try {
        const outcome = input;
        const record = records2.get(outcome?.requestId);
        if (!record?.request || !verifyCompletedOutcome(outcome, snapshot.execution, record.request))
          throw new Error("host result differs from retained request or signed output");
        return await this.acknowledgeDelivery(outcome.delivery);
      } catch {
        return { acknowledged: false, reason: "host-received result is not the exact verified terminal outcome" };
      }
    },
    /** Proof of receiving the exact retained result. This never dispatches a tool. */
    async acknowledgeDelivery(proof) {
      try {
        const requestId = proof?.requestId;
        if (closed || typeof requestId !== "string")
          throw new Error("invalid delivery proof");
        const record = records2.get(requestId);
        if (!record || record.state !== "completed" || !record.request || record.outcome?.state !== "completed" || !verifyCompletedOutcome(record.outcome, snapshot.execution, record.request) || canonicalizeJson2(proof) !== canonicalizeJson2(record.outcome.delivery))
          throw new Error("delivery proof does not match retained outcome");
        const confirmed = { ...record, hostDeliveryConfirmed: true };
        persist(confirmed);
        await confirmDelivery(confirmed);
        if (!records2.get(requestId)?.acknowledged)
          throw new Error("kernel acknowledgement not confirmed");
        return { acknowledged: true, requestId, receiptId: record.outcome.receipt.id };
      } catch {
        return { acknowledged: false, reason: "host delivery proof or kernel acknowledgement is unresolved; preserve the operation" };
      }
    },
    listTools: () => snapshot.approval ? [...snapshot.tools, resumeTool] : snapshot.tools,
    async call(id, name, args, signal) {
      const requestId = name === "chio_resume" ? String(args.requestId ?? "") : `${snapshot.sessionId}:${createHash2("sha256").update(canonicalizeJson2({ id })).digest("hex")}`;
      const refused = (reason) => ({ state: "not_dispatched", evidence: "unverified", requestId, reason });
      if (closed || busy)
        return refused("gateway closed or another operation in flight");
      const resuming = name === "chio_resume";
      if (resuming && !snapshot.approval)
        return refused("explicit approval resumption is not configured");
      const tool = resuming ? String(args.tool ?? "") : name;
      const parameters = resuming ? args.arguments : args;
      if (!tools.has(tool) || !parameters || typeof parameters !== "object" || Array.isArray(parameters))
        return refused("tool or arguments are outside the operator allowlist");
      let digest2;
      try {
        digest2 = operationKey(canonicalizeJson2({ name: tool, args: parameters }));
      } catch {
        return refused("invalid canonical arguments");
      }
      const prior = records2.get(requestId);
      if (prior) {
        if (prior.digest !== digest2)
          return refused("operation identity conflicts with retained request");
        if (prior.state !== "awaiting_approval")
          return prior.outcome ? confirmDelivery(prior) : { state: "unknown", evidence: "unverified", requestId, reason: "interrupted dispatch requires resource reconciliation" };
        if (!resuming)
          return prior.outcome;
        if (signal?.aborted)
          return refused("cancelled before approval resumption");
        let approved;
        try {
          const path = gatewayApprovalPath(snapshot, requestId);
          privatePath(path, false);
          if (lstatSync(path).size > 1024 * 1024)
            throw new Error("oversized artifact");
          const artifact = JSON.parse(readFileSync(path, "utf8"));
          approved = verifyApprovalToolCall(artifact.toolCallParams, { ...snapshot.execution, sessionId: snapshot.execution.sessionId, tool, arguments: parameters, requestId });
        } catch {
        }
        if (!approved)
          return { ...prior.outcome, reason: "approval missing, expired, substituted or untrusted; proposal remains undispatched" };
        if (approved.decision === "denied") {
          const outcome = refused("operator denied the proposal before dispatch");
          persist({ ...prior, state: "not_dispatched", outcome });
          return outcome;
        }
        return dispatch(prior, { tool, arguments: parameters, requestId, approval: { chioGovernedIntent: approved.params._meta.chioGovernedIntent, chioApprovalToken: approved.params._meta.chioApprovalToken } }, signal);
      }
      if (resuming)
        return refused("no retained proposal matches this request");
      if (fenced())
        return refused("an unresolved operation fences this gateway; operator reconciliation required");
      if (signal?.aborted)
        return refused("cancelled before admission");
      if (snapshot.approval?.requiredTools.includes(tool)) {
        const proposal2 = { session_id: snapshot.execution.sessionId, capability_id: snapshot.execution.capabilityId, request_id: requestId, tool_name: tool, arguments: JSON.parse(canonicalizeJson2(parameters)), purpose: snapshot.approval.purpose, ttl_seconds: snapshot.approval.ttlSeconds };
        const outcome = { state: "awaiting_approval", evidence: "unverified", requestId, proposal: proposal2, reason: "proposal retained without dispatch; operator decision and explicit chio_resume are required" };
        persist({ requestId, digest: digest2, state: "awaiting_approval", proposal: proposal2, outcome });
        return outcome;
      }
      return dispatch({ requestId, digest: digest2, state: "pending" }, { tool, arguments: parameters, requestId }, signal);
    },
    close() {
      if (!closed) {
        closed = true;
        unlinkSync(lockPath);
        syncDirectory(directory);
      }
    }
  };
}
function gatewayToolResult(outcome) {
  const toolError = "result" in outcome && outcome.result !== null && typeof outcome.result === "object" && outcome.result.isError === true;
  return {
    isError: outcome.state !== "completed" || toolError,
    content: [{ type: "text", text: JSON.stringify(outcome) }]
  };
}
async function main() {
  if (process.argv.length !== 3)
    throw new Error("usage: chio-mcp-gateway /absolute/operator-config.json");
  const configPath = process.argv[2];
  if (resolve(configPath) !== configPath)
    throw new Error("config path must be absolute");
  const gateway = createGateway(readGatewayConfig(configPath));
  const reader = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const active = /* @__PURE__ */ new Map();
  let initialized = false;
  let queued = Promise.resolve();
  const send = (value) => process.stdout.write(JSON.stringify(value) + "\n");
  reader.on("line", (line) => {
    if (Buffer.byteLength(line) > 1024 * 1024) {
      send({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "request exceeds size limit" } });
      return;
    }
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "invalid JSON" } });
      return;
    }
    if (message?.method === "notifications/cancelled") {
      active.get(JSON.stringify(message.params?.requestId))?.abort();
      return;
    }
    if (message?.method === "notifications/initialized") {
      initialized = true;
      return;
    }
    if (message?.id === void 0)
      return;
    const key = JSON.stringify(message.id);
    const controller = message.method === "tools/call" ? new AbortController() : void 0;
    if (controller) {
      if (active.has(key)) {
        send({ jsonrpc: "2.0", id: message.id, error: { code: -32600, message: "request ID is already in flight" } });
        return;
      }
      active.set(key, controller);
    }
    queued = queued.then(async () => {
      const error = (code, text) => send({ jsonrpc: "2.0", id: message.id, error: { code, message: text } });
      const result = (value) => send({ jsonrpc: "2.0", id: message.id, result: value });
      if (message.jsonrpc !== "2.0" || !["string", "number"].includes(typeof message.id)) {
        error(-32600, "invalid request");
        return;
      }
      if (message.method === "initialize") {
        result({ protocolVersion: "2025-11-25", capabilities: { tools: {} }, serverInfo: { name: "chio-mcp-gateway", version: "0.3.0" } });
        return;
      }
      if (message.method === "ping") {
        result({});
        return;
      }
      if (!initialized) {
        error(-32600, "session not initialized");
        return;
      }
      if (message.method === "tools/list") {
        result({ tools: gateway.listTools() });
        return;
      }
      if (message.method !== "tools/call") {
        error(-32601, "unsupported method");
        return;
      }
      const args = message.params?.arguments;
      if (!args || typeof args !== "object" || Array.isArray(args)) {
        error(-32602, "tool arguments must be an object");
        return;
      }
      const outcome = await gateway.call(message.id, message.params.name, args, controller?.signal);
      result(gatewayToolResult(outcome));
    }).catch(() => {
      send({ jsonrpc: "2.0", id: message.id, error: { code: -32603, message: "gateway failed; no automatic retry" } });
    }).finally(() => {
      if (controller)
        active.delete(key);
    });
  });
  await new Promise((done) => reader.on("close", done));
  await queued;
  gateway.close();
}
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main().catch(() => {
    process.stderr.write("Chio gateway startup or persistence failed; protected tools unavailable.\n");
    process.exitCode = 1;
  });
}

// node_modules/@chio/bridge/dist/gateway-operator.js
import { closeSync as closeSync2, fsyncSync as fsyncSync2, lstatSync as lstatSync2, mkdirSync as mkdirSync2, openSync as openSync2, readFileSync as readFileSync2, readdirSync as readdirSync2, realpathSync as realpathSync2, unlinkSync as unlinkSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { hostname as hostname2 } from "node:os";
import { dirname, join as join2, resolve as resolve2 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
function syncDirectory2(path) {
  const fd = openSync2(path, "r");
  try {
    fsyncSync2(fd);
  } finally {
    closeSync2(fd);
  }
}
function privateJson(path) {
  privatePath(path, false);
  if (lstatSync2(path).size > 1024 * 1024)
    throw new Error("oversized private file");
  return JSON.parse(readFileSync2(path, "utf8"));
}
function ownerState(owner) {
  if (!owner || owner.hostname !== hostname2() || !Number.isSafeInteger(owner.pid) || owner.pid < 1)
    return "unverifiable";
  try {
    process.kill(owner.pid, 0);
    return "alive";
  } catch (error) {
    return error.code === "ESRCH" ? "dead" : "unverifiable";
  }
}
function checkBinding(config) {
  privatePath(config.journalDir, true);
  const binding = join2(config.journalDir, "authority.binding");
  privatePath(binding, false);
  if (readFileSync2(binding, "utf8") !== gatewayBinding(config))
    throw new Error("journal authority does not match operator configuration");
}
function gatewayStatus(config) {
  checkBinding(config);
  const names = readdirSync2(config.journalDir);
  const lockPath = join2(config.journalDir, "gateway.lock");
  const owner = names.includes("gateway.lock") ? privateJson(lockPath) : void 0;
  const operations = names.filter((name) => name.endsWith(".json")).map((name) => {
    const record = privateJson(join2(config.journalDir, name));
    if (!record.requestId || !["pending", "awaiting_approval", "not_dispatched", "unknown", "denied", "completed"].includes(record.state))
      throw new Error("corrupt operation journal");
    return { requestId: record.requestId, state: record.state, acknowledged: record.acknowledged === true, hostDeliveryRequired: record.hostDeliveryRequired !== false, hostDeliveryConfirmed: record.hostDeliveryConfirmed === true };
  });
  return {
    schema: "chio.gateway.status.v1",
    sessionId: config.sessionId,
    lock: owner ? { ...owner, state: ownerState(owner) } : { state: "missing" },
    operations,
    fenced: operations.some((record) => record.state !== "not_dispatched" && !(record.state === "completed" && record.acknowledged && (!record.hostDeliveryRequired || record.hostDeliveryConfirmed)))
  };
}
function recoverGatewayLock(config) {
  checkBinding(config);
  const recoveryPath = join2(config.journalDir, "recovery.lock");
  const recovery = openSync2(recoveryPath, "wx", 384);
  try {
    writeFileSync2(recovery, JSON.stringify({ pid: process.pid, hostname: hostname2() }));
    fsyncSync2(recovery);
    syncDirectory2(config.journalDir);
    const lockPath = join2(config.journalDir, "gateway.lock");
    const before = lstatSync2(lockPath);
    const raw = readFileSync2(lockPath, "utf8");
    const owner = privateJson(lockPath);
    if (owner.sessionId !== config.sessionId || ownerState(owner) !== "dead")
      throw new Error("gateway owner is alive or cannot be proved dead on this machine");
    const status = gatewayStatus(config);
    const after = lstatSync2(lockPath);
    if (before.dev !== after.dev || before.ino !== after.ino || raw !== readFileSync2(lockPath, "utf8"))
      throw new Error("gateway lock changed during recovery");
    unlinkSync2(lockPath);
    syncDirectory2(config.journalDir);
    return { ...status, lock: { state: "recovered-dead-owner" }, recovered: true, journalsRetained: true };
  } finally {
    closeSync2(recovery);
    unlinkSync2(recoveryPath);
    syncDirectory2(config.journalDir);
  }
}
function proposal(config, requestId) {
  checkBinding(config);
  const record = privateJson(join2(config.journalDir, operationKey(requestId) + ".json"));
  if (record.requestId !== requestId || record.state !== "awaiting_approval" || !record.proposal)
    throw new Error("only an undispatched retained proposal can be decided");
  if (record.proposal.session_id !== config.execution.sessionId || record.proposal.capability_id !== config.execution.capabilityId)
    throw new Error("proposal authority changed");
  return record.proposal;
}
async function main2() {
  const [action, configPath, ...args] = process.argv.slice(2);
  if (!configPath || resolve2(configPath) !== configPath)
    throw new Error("usage: chio-gateway-operator status|recover-lock|delivery-export|delivery-acknowledge|approval-submit|approval-decide CONFIG [arguments]");
  const config = readGatewayConfig(configPath);
  if (action === "status" && args.length === 0) {
    process.stdout.write(JSON.stringify(gatewayStatus(config)) + "\n");
    return;
  }
  if (action === "recover-lock" && args.length === 0) {
    process.stdout.write(JSON.stringify(recoverGatewayLock(config)) + "\n");
    return;
  }
  if (action === "delivery-export" && args.length === 2) {
    const [requestId2, output2] = args;
    checkBinding(config);
    const record = privateJson(join2(config.journalDir, operationKey(requestId2) + ".json"));
    if (record.state !== "completed" || !record.request || record.outcome?.state !== "completed" || record.requestId !== requestId2 || !verifyCompletedOutcome(record.outcome, config.execution, record.request))
      throw new Error("only a verified retained completion can be exported");
    const fd = openSync2(output2, "wx", 384);
    try {
      writeFileSync2(fd, JSON.stringify({ schema: "chio.gateway.delivered-outcome.v1", request: record.request, outcome: record.outcome }, null, 2) + "\n");
      fsyncSync2(fd);
    } finally {
      closeSync2(fd);
    }
    syncDirectory2(dirname(output2));
    process.stdout.write(JSON.stringify({ output: output2, requestId: requestId2, protectedDispatch: false, acknowledgedByExport: false }) + "\n");
    return;
  }
  if (action === "delivery-acknowledge" && args.length === 1) {
    const received = privateJson(args[0]);
    if (received.schema !== "chio.gateway.delivered-outcome.v1" || !received.request || !verifyCompletedOutcome(received.outcome, config.execution, received.request))
      throw new Error("received outcome is not a trusted exact completion");
    const gateway = createGateway(config, void 0, { requireHostAcknowledgement: true });
    try {
      const result = await gateway.acknowledgeDelivery(received.outcome.delivery);
      if (!result.acknowledged)
        throw new Error(result.reason);
      process.stdout.write(JSON.stringify({ ...result, protectedDispatch: false }) + "\n");
    } finally {
      gateway.close();
    }
    return;
  }
  const [requestId, operatorPath, artifactOrId, decision] = args;
  if (!requestId || !operatorPath || !artifactOrId || !["approval-submit", "approval-decide"].includes(action ?? ""))
    throw new Error("approval-submit CONFIG REQUEST_ID OPERATOR_FILE NEW_OUTPUT; approval-decide CONFIG REQUEST_ID OPERATOR_FILE APPROVAL_ID approved|denied");
  const proposed = proposal(config, requestId);
  const operator = privateJson(operatorPath);
  if (typeof operator.adminToken !== "string" || !operator.adminToken || operator.adminToken === config.execution.bearerToken)
    throw new Error("distinct operator-only admin credential required");
  const endpoint = new URL(config.execution.endpoint);
  if (endpoint.pathname !== "/" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname)))
    throw new Error("invalid operator endpoint");
  let route = "/admin/approvals";
  let body2 = proposed;
  let output = artifactOrId;
  if (action === "approval-decide") {
    if (!["approved", "denied"].includes(decision ?? ""))
      throw new Error("explicit approval decision required");
    route += "/" + encodeURIComponent(artifactOrId) + "/decision";
    body2 = { decision };
    output = gatewayApprovalPath(config, requestId);
    mkdirSync2(dirname(output), { recursive: true, mode: 448 });
    privatePath(dirname(output), true);
  } else if (decision !== void 0)
    throw new Error("unexpected submit argument");
  const descriptor = openSync2(output, "wx", 384);
  let saved = false;
  try {
    const response = await fetch(new URL(route, endpoint), { method: "POST", headers: { Authorization: `Bearer ${operator.adminToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body2), redirect: "error", signal: AbortSignal.timeout(3e4) });
    if (!response.ok)
      throw new Error("operator endpoint rejected the request");
    const value = await response.json();
    if (value.dispatchPerformedByThisEndpoint !== false || value.record?.request_id !== requestId || value.record?.session_id !== config.execution.sessionId || value.record?.capability_id !== config.execution.capabilityId)
      throw new Error("operator record does not bind the retained proposal");
    if (action === "approval-decide" && !verifyApprovalToolCall(value.toolCallParams, { ...config.execution, sessionId: config.execution.sessionId, tool: proposed.tool_name, arguments: proposed.arguments, requestId }))
      throw new Error("operator decision lacks a trusted exact-action signature");
    writeFileSync2(descriptor, JSON.stringify(value, null, 2) + "\n");
    fsyncSync2(descriptor);
    syncDirectory2(dirname(output));
    saved = true;
    process.stdout.write(JSON.stringify({ output, status: value.status, approvalId: value.record.id, protectedDispatch: false }) + "\n");
  } finally {
    closeSync2(descriptor);
    if (!saved) {
      unlinkSync2(output);
      syncDirectory2(dirname(output));
    }
  }
}
if (process.argv[1] && realpathSync2(process.argv[1]) === realpathSync2(fileURLToPath2(import.meta.url)))
  main2().catch((error) => {
    process.stderr.write(`Gateway operator action failed: ${error instanceof Error ? error.message : "invalid request"}. No protected tool was dispatched.
`);
    process.exitCode = 1;
  });

// src/workflow/control.ts
import { randomBytes, randomUUID as randomUUID2 } from "node:crypto";
import { existsSync, readdirSync as readdirSync3 } from "node:fs";
import { join as join3, resolve as resolve4 } from "node:path";

// src/workflow/store.ts
import { createHash as createHash3, randomUUID } from "node:crypto";
import { closeSync as closeSync3, fsyncSync as fsyncSync3, lstatSync as lstatSync3, mkdirSync as mkdirSync3, openSync as openSync3, readFileSync as readFileSync3, renameSync as renameSync2, unlinkSync as unlinkSync3, writeFileSync as writeFileSync3 } from "node:fs";
import { dirname as dirname2 } from "node:path";
function digest(value) {
  return createHash3("sha256").update(canonicalizeJson(value)).digest("hex");
}
function privateRead(path) {
  privatePath(path, false);
  if (lstatSync3(path).size > 1024 * 1024) throw new Error("private workflow record exceeds limit");
  return JSON.parse(readFileSync3(path, "utf8"));
}
function privateDirectory(path) {
  mkdirSync3(path, { recursive: true, mode: 448 });
  privatePath(path, true);
}
function privateSave(path, value, exclusive = false) {
  privatePath(dirname2(path), true);
  const contents = JSON.stringify(value);
  if (Buffer.byteLength(contents) > 1024 * 1024) throw new Error("workflow record exceeds limit");
  const temporary = exclusive ? path : path + "." + randomUUID() + ".tmp";
  const fd = openSync3(temporary, "wx", 384);
  try {
    writeFileSync3(fd, contents);
    fsyncSync3(fd);
  } finally {
    closeSync3(fd);
  }
  if (!exclusive) renameSync2(temporary, path);
  const directory = openSync3(dirname2(path), "r");
  try {
    fsyncSync3(directory);
  } finally {
    closeSync3(directory);
  }
}

// src/workflow/tasks.ts
import { spawn } from "node:child_process";
import { realpathSync as realpathSync3 } from "node:fs";
import { resolve as resolve3 } from "node:path";
var token = /^[a-zA-Z0-9_.-]{1,128}$/;
function identifier(value) {
  return typeof value === "string" && token.test(value);
}
function artifactValid(value) {
  return !!value && typeof value.label === "string" && value.label.length <= 256 && (value.kind === "git_commit" ? /^[0-9a-f]{40}$/.test(value.digest) : value.kind === "sha256" && /^[0-9a-f]{64}$/.test(value.digest));
}
function validateTemplate(value) {
  if (!value || !identifier(value.id) || typeof value.title !== "string" || value.title.length > 256 || !identifier(value.serverId) || typeof value.expectedCapabilityId !== "string" || !value.expectedCapabilityId || value.expectedCapabilityId.length > 512 || !Array.isArray(value.allowedTools) || !value.allowedTools.length || value.allowedTools.length > 64 || value.allowedTools.some((v) => !identifier(v) || v === "chio_resume") || new Set(value.allowedTools).size !== value.allowedTools.length || !Number.isSafeInteger(value.ttlSeconds) || value.ttlSeconds < 1 || value.ttlSeconds > 3600 || !value.approval || !Array.isArray(value.approval.requiredTools) || !value.approval.requiredTools.length || value.approval.requiredTools.some((v) => !value.allowedTools.includes(v)) || typeof value.approval.purpose !== "string" || value.approval.purpose.length > 1024 || !Number.isSafeInteger(value.approval.ttlSeconds) || value.approval.ttlSeconds < 1 || value.approval.ttlSeconds > value.ttlSeconds || !value.scope || value.scope.source !== "operator_template" || value.scope.budget !== "unavailable" || [value.scope.resources, value.scope.destinations, value.scope.restrictions].some((a) => !Array.isArray(a) || a.length > 64 || a.some((s) => typeof s !== "string" || s.length > 1024)) || !Array.isArray(value.requirements) || !value.requirements.length || value.requirements.length > 32 || new Set(value.requirements.map((r) => r.id)).size !== value.requirements.length) throw new Error("invalid operator task template");
  for (const r of value.requirements) {
    if (!r || !identifier(r.id) || typeof r.title !== "string" || r.title.length > 256) throw new Error("invalid completion requirement");
    const c = r.collector;
    if (c?.kind === "command") {
      if (typeof c.cwd !== "string" || resolve3(c.cwd) !== c.cwd || !Array.isArray(c.argv) || !c.argv.length || c.argv.length > 64 || c.argv.some((a) => typeof a !== "string" || a.length > 4096) || !c.argv[0]?.startsWith("/") || !Number.isSafeInteger(c.timeoutMs) || c.timeoutMs < 1 || c.timeoutMs > 6e4) throw new Error("invalid operator command collector");
    } else if (c?.kind === "json") {
      const url = new URL(c.url);
      if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "127.0.0.1")) throw new Error("collector requires HTTPS or exact loopback");
      if (url.username || url.password || url.hash || url.search || !c.artifactPointer.startsWith("/") || !c.statePointer.startsWith("/") || typeof c.passedValue !== "string" || !Array.isArray(c.failedValues) || c.failedValues.some((v) => typeof v !== "string")) throw new Error("invalid JSON collector");
    } else if (c?.kind === "github") {
      let base;
      try {
        base = new URL(c.apiBase ?? "https://api.github.com");
      } catch {
        base = void 0;
      }
      if (!base || typeof c.repository !== "string" || !/^[A-Za-z0-9-]{1,39}\/(?!\.\.?$)[A-Za-z0-9._-]{1,100}$/.test(c.repository) || base.protocol !== "https:" && !(base.protocol === "http:" && base.hostname === "127.0.0.1") || base.username || base.password || base.search || base.hash || c.checks !== void 0 && (!Array.isArray(c.checks) || !c.checks.length || c.checks.length > 64 || c.checks.some((name) => typeof name !== "string" || !name || name.length > 256)) || c.tokenFile !== void 0 && (typeof c.tokenFile !== "string" || resolve3(c.tokenFile) !== c.tokenFile)) throw new Error("invalid GitHub collector");
    } else throw new Error("unsupported evidence collector");
  }
  return value;
}
function readCatalog(path) {
  const value = privateRead(path);
  if (value.schema !== "chio.task.catalog.v1" || !Array.isArray(value.templates) || !value.templates.length || value.templates.length > 32 || new Set(value.templates.map((t) => t.id)).size !== value.templates.length) throw new Error("invalid operator catalog");
  return value.templates.map(validateTemplate);
}
function templateView(value) {
  return { id: value.id, title: value.title, revision: digest(value), allowedTools: value.allowedTools, ttlSeconds: value.ttlSeconds, scope: value.scope };
}
function taskRevision(task) {
  return digest({
    id: task.id,
    sessionId: task.sessionId,
    binding: task.binding,
    title: task.title,
    goal: task.goal,
    artifact: task.artifact,
    template: task.template,
    checkout: task.checkout ?? null
  });
}
function readTask(path, sessionId, binding) {
  const task = privateRead(path);
  if (task.schema !== "chio.task.v1" || typeof task.id !== "string" || !/^[0-9a-f-]{36}$/.test(task.id) || typeof task.sessionId !== "string" || !/^[0-9a-f]{64}$/.test(task.binding) || typeof task.title !== "string" || task.title.length > 256 || typeof task.goal !== "string" || task.goal.length > 4096 || !artifactValid(task.artifact) || !Array.isArray(task.observations) || task.observations.length > 1024 || sessionId !== void 0 && task.sessionId !== sessionId || binding !== void 0 && task.binding !== binding || task.checkout !== void 0 && (typeof task.checkout !== "string" || resolve3(task.checkout) !== task.checkout)) throw new Error("task has invalid or foreign binding");
  validateTemplate(task.template);
  if (task.observations.some((o) => !o || !task.template.requirements.some((r) => r.id === o.requirementId) || !/^[0-9a-f]{64}$/.test(o.revision) || !artifactValid(o.artifact) || !["outstanding", "running", "passed", "failed"].includes(o.state) || !Number.isSafeInteger(o.observedAt) || o.observedAt > Date.now() + 5e3 || typeof o.source !== "string" || o.source.length > 1024)) throw new Error("invalid retained evidence observation");
  return task;
}
async function run(argv, cwd, timeoutMs) {
  const grouped = process.platform !== "win32";
  const child = spawn(argv[0], argv.slice(1), { cwd, shell: false, detached: grouped, env: { PATH: process.env.PATH ?? "", LANG: "C.UTF-8", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" }, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", size = 0, overflow = false, timedOut = false;
  let kill;
  const signal = (value) => {
    if (!child.pid) return;
    try {
      if (grouped) process.kill(-child.pid, value);
      else child.kill(value);
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  };
  const stop = () => {
    signal("SIGTERM");
    kill ??= setTimeout(() => signal("SIGKILL"), 1e3);
  };
  const capture = (data) => {
    size += data.length;
    if (size > 1024 * 1024 && !overflow) {
      overflow = true;
      stop();
    }
  };
  child.stdout.on("data", (data) => {
    capture(data);
    if (!overflow) stdout += data.toString();
  });
  child.stderr.on("data", capture);
  const timeout = setTimeout(() => {
    timedOut = true;
    stop();
  }, timeoutMs);
  try {
    const code = await new Promise((done, reject) => {
      child.once("error", reject);
      child.once("close", (code2) => done(code2 ?? -1));
    });
    if (overflow) throw new Error("collector output exceeds limit");
    if (timedOut) throw new Error("collector deadline exceeded; no completion evidence recorded");
    return { code, stdout };
  } finally {
    clearTimeout(timeout);
    if (kill) {
      clearTimeout(kill);
      signal("SIGKILL");
    }
  }
}
async function checkoutMatches(task, requireClean) {
  if (!task.checkout) return true;
  if (task.artifact.kind !== "git_commit" || realpathSync3(task.checkout) !== task.checkout) return false;
  const head = await run(["/usr/bin/git", "-C", task.checkout, "rev-parse", "--verify", "HEAD"], task.checkout, 3e3);
  if (head.code !== 0 || head.stdout.trim() !== task.artifact.digest) return false;
  if (!requireClean) return true;
  const status = await run(["/usr/bin/git", "-C", task.checkout, "status", "--porcelain", "--untracked-files=all"], task.checkout, 3e3);
  return status.code === 0 && status.stdout.trim() === "";
}
async function projectTask(task) {
  const revision = taskRevision(task);
  const matches = await checkoutMatches(task, true);
  const requirements = task.template.requirements.map((r) => {
    const observation = task.observations.filter((o) => o.requirementId === r.id).at(-1);
    const fresh = observation?.revision === revision && digest(observation.artifact) === digest(task.artifact) && matches;
    const state = !matches || observation && !fresh ? "stale" : observation?.state ?? "outstanding";
    return {
      id: r.id,
      title: r.title,
      state,
      evidenceClass: observation && fresh ? "trusted_collector_observation" : "none",
      ...observation ? { observedAt: observation.observedAt, source: observation.source } : {}
    };
  });
  const readiness = requirements.every((r) => r.state === "passed") ? "ready" : requirements.some((r) => r.state === "failed") ? "failed" : "outstanding";
  return { id: task.id, sessionId: task.sessionId, revision, title: task.title, goal: task.goal, artifact: task.artifact, readiness, requirements, scope: task.template.scope };
}

// src/workflow/outcome.ts
function verifiedOriginal(config, record) {
  return record.state === "completed" && !!record.request && record.request.requestId === record.requestId && record.outcome?.state === "completed" && record.outcome.requestId === record.requestId && record.digest === digest({ name: record.request.tool, args: record.request.arguments }) && verifyCompletedOutcome(record.outcome, config.execution, record.request);
}

// src/workflow/control.ts
function uuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
}
function publicContinuation(r) {
  return { id: r.id, requestId: r.requestId, state: r.state, delivery: r.delivery, receiptConfirmed: r.receiptConfirmed === true || r.delivery === "confirmed", ...r.outcomeHash ? { outcomeHash: r.outcomeHash } : {} };
}
function createWorkflowControl(access, options = {}, readOnly = false) {
  const directory = join3(access.config.journalDir, "workflow");
  const continuations = join3(directory, "continuations");
  const proposals = join3(directory, "proposals");
  const taskRequests = join3(directory, "task-requests");
  for (const path of [directory, continuations, proposals, taskRequests]) {
    if (!readOnly) privateDirectory(path);
    else if (existsSync(path)) privatePath(path, true);
  }
  for (const [field, path] of [["task", options.taskPath], ["catalog", options.catalogPath]]) {
    if (path && resolve4(path) !== join3(directory, field + ".json")) throw new Error("workflow file must be in this journal's private workflow directory");
  }
  const jobs = /* @__PURE__ */ new Map();
  let closed = false;
  function find(requestId) {
    if (typeof requestId !== "string" || !requestId || requestId.length > 256) throw new Error("invalid retained operation id");
    const record = access.read().find((r) => r.requestId === requestId);
    if (!record) throw new Error("no original operation for this session");
    return record;
  }
  function readContinuation(id, persist = !readOnly) {
    if (!uuid(id)) throw new Error("invalid continuation id");
    const path = join3(continuations, id + ".json");
    let r = privateRead(path);
    if (r.schema !== "chio.control.continuation.v1" || r.id !== id || r.binding !== access.binding || r.sessionId !== access.config.sessionId || !["submitted", "completed", "unknown"].includes(r.state) || !["pending", "confirmed"].includes(r.delivery) || !/^[0-9a-f]{64}$/.test(r.revision)) throw new Error("foreign or invalid continuation");
    const original = find(r.requestId);
    const verified = verifiedOriginal(access.config, original);
    if (r.state !== "completed" && !jobs.has(id) && verified) {
      r = { ...r, state: "completed", outcome: original.outcome, outcomeHash: digest(original.outcome), challenge: randomBytes(32).toString("hex") };
      if (persist) privateSave(path, r);
    }
    if (r.state === "completed") {
      if (!verified || !r.outcome || digest(r.outcome) !== digest(original.outcome) || digest(r.outcome) !== r.outcomeHash || !/^[0-9a-f]{64}$/.test(r.challenge ?? "")) throw new Error("continuation does not bind the verified original result");
      if (r.delivery !== "confirmed" && r.served && r.receiptConfirmed === true && original.hostDeliveryConfirmed === true && original.acknowledged === true) {
        r = { ...r, delivery: "confirmed" };
        if (persist) privateSave(path, r);
      }
    }
    return r;
  }
  function retained(persist = !readOnly) {
    if (readOnly && persist) throw new Error("read-only continuation projection");
    if (!existsSync(continuations)) return [];
    const names = readdirSync3(continuations).filter((n) => n.endsWith(".json"));
    if (names.length > 1e3) throw new Error("continuation retention requires maintenance");
    return names.map((name) => publicContinuation(readContinuation(name.slice(0, -5), persist)));
  }
  async function project2() {
    const task = options.taskPath ? await projectTask(readTask(options.taskPath, access.config.sessionId, access.binding)) : void 0;
    return {
      ...task ? { task } : {},
      templates: options.catalogPath ? readCatalog(options.catalogPath).map(templateView) : [],
      continuation: !!options.resume && !!options.acknowledge,
      proposals: !!options.propose
    };
  }
  async function startContinuation(input) {
    if (readOnly || closed || !options.resume || !options.acknowledge || !await access.live()) throw new Error("live parent continuation transport required");
    if (Object.keys(input).some((k) => !["requestId", "revision"].includes(k))) throw new Error("continuation accepts an original id and revision only");
    const record = find(input.requestId), view = access.view(record);
    if (view.state !== "awaiting_approval" || view.review?.decision !== "granted" || input.revision !== view.review.revision || !record.proposal) throw new Error("no exact accepted grant for continuation");
    const claim = join3(continuations, digest(record.requestId) + ".claim");
    privateSave(claim, { requestId: record.requestId, revision: view.review.revision }, true);
    const id = randomUUID2(), path = join3(continuations, id + ".json");
    const pending = {
      schema: "chio.control.continuation.v1",
      id,
      sessionId: access.config.sessionId,
      binding: access.binding,
      requestId: record.requestId,
      revision: view.review.revision,
      state: "submitted",
      delivery: "pending"
    };
    privateSave(path, pending, true);
    const job = (async () => {
      try {
        const original = find(record.requestId), current = access.view(original);
        if (readOnly || closed || !await access.live() || current.review?.decision !== "granted" || current.review.revision !== pending.revision || !original.proposal) throw new Error("grant or action changed before dispatch");
        const result = await options.resume(id, original.requestId, original.proposal.tool_name, original.proposal.arguments);
        const stored = find(original.requestId);
        if (result.state !== "completed" || result.evidence !== "verified" || !stored.request || !verifyCompletedOutcome(result, access.config.execution, stored.request) || !verifiedOriginal(access.config, stored) || digest(result) !== digest(stored.outcome)) throw new Error("continuation outcome remains unresolved");
        privateSave(path, { ...pending, state: "completed", outcome: result, outcomeHash: digest(result), challenge: randomBytes(32).toString("hex") });
      } catch {
        privateSave(path, { ...pending, state: "unknown" });
      }
    })();
    jobs.set(id, job);
    void job.finally(() => jobs.delete(id)).catch(() => {
    });
    return publicContinuation(pending);
  }
  function outcome(id) {
    if (readOnly) throw new Error("read-only continuation projection");
    const r = readContinuation(id);
    if (r.state !== "completed") return { ready: false, continuation: publicContinuation(r) };
    const original = find(r.requestId);
    if (!r.outcome || !original.request || !verifyCompletedOutcome(r.outcome, access.config.execution, original.request) || digest(r.outcome) !== r.outcomeHash || !/^[0-9a-f]{64}$/.test(r.challenge ?? "")) throw new Error("retained continuation output is invalid");
    privateSave(join3(continuations, r.id + ".json"), { ...r, served: true });
    return { ready: true, schema: "chio.control.outcome.v1", continuation: publicContinuation(r), outcome: r.outcome, outcomeHash: r.outcomeHash, challenge: r.challenge };
  }
  async function acknowledge(id, input) {
    if (readOnly || closed || !options.acknowledge) throw new Error("parent outcome acknowledgement unavailable");
    const r = readContinuation(id);
    if (Object.keys(input).some((k) => !["outcomeHash", "challenge"].includes(k)) || r.state !== "completed" || !r.served || !r.outcome || input.outcomeHash !== r.outcomeHash || input.challenge !== r.challenge) throw new Error("exact served native-control outcome proof required");
    const original = find(r.requestId);
    if (!original.request || !verifyCompletedOutcome(r.outcome, access.config.execution, original.request) || digest(r.outcome) !== r.outcomeHash) throw new Error("output changed before acknowledgement");
    if (r.delivery === "confirmed") return { acknowledged: true, requestId: r.requestId, channel: "native_control" };
    privateSave(join3(continuations, r.id + ".ack-claim"), { requestId: r.requestId, outcomeHash: r.outcomeHash }, true);
    privateSave(join3(continuations, r.id + ".json"), { ...r, receiptConfirmed: true });
    const result = await options.acknowledge(r.outcome);
    if (!result.acknowledged || result.requestId !== r.requestId) throw new Error("kernel delivery acknowledgement remains unresolved");
    privateSave(join3(continuations, r.id + ".json"), { ...r, receiptConfirmed: true, delivery: "confirmed" });
    return { acknowledged: true, requestId: r.requestId, channel: "native_control" };
  }
  async function propose(input) {
    if (readOnly || closed || !options.propose || !await access.live() || !uuid(input.id) || typeof input.tool !== "string" || !input.arguments || typeof input.arguments !== "object" || Array.isArray(input.arguments) || Object.keys(input).some((k) => !["id", "tool", "arguments"].includes(k))) throw new Error("bounded proposal requires a live parent transport");
    if (!access.config.tools.some((t) => t.name === input.tool) || !access.config.approval?.requiredTools.includes(input.tool)) throw new Error("proposal tool must require exact review; no effect fallback");
    const path = join3(proposals, input.id + ".json");
    const revision = digest({ sessionId: access.config.sessionId, binding: access.binding, input });
    if (existsSync(path)) {
      const prior = privateRead(path);
      if (prior.revision !== revision) throw new Error("proposal id conflicts with original arguments");
      if (!["submitted", "awaiting_approval", "unknown"].includes(prior.state)) throw new Error("corrupt retained proposal");
      return { ...prior, ...prior.requestId ? { state: access.view(find(prior.requestId)).state } : {}, dispatchPerformed: false };
    }
    privateSave(path, { revision, state: "submitted" }, true);
    try {
      const result = await options.propose(input.id, input.tool, input.arguments);
      if (result.state !== "awaiting_approval" || access.view(find(result.requestId)).review?.decision !== "required") throw new Error("proposal was not retained for exact review");
      const retained2 = { revision, state: "awaiting_approval", requestId: result.requestId };
      privateSave(path, retained2);
      return { ...retained2, dispatchPerformed: false };
    } catch {
      privateSave(path, { revision, state: "unknown" });
      throw new Error("proposal unresolved; inspect original id without resubmission");
    }
  }
  function selectTemplate(input) {
    if (readOnly || !options.catalogPath || !uuid(input.id) || typeof input.templateId !== "string" || Object.keys(input).some((k) => !["id", "templateId", "revision"].includes(k))) throw new Error("invalid task selection");
    const template = readCatalog(options.catalogPath).find((t) => t.id === input.templateId);
    if (!template || templateView(template).revision !== input.revision) throw new Error("task template changed");
    const path = join3(taskRequests, input.id + ".json");
    privateSave(path, { schema: "chio.task.request.v1", sessionId: access.config.sessionId, binding: access.binding, ...input, state: "requested", createdAt: Date.now() }, true);
    return { id: input.id, state: "requested", templateId: template.id, authorityAccepted: false, dispatchPerformed: false };
  }
  function explain(requestId) {
    const r = find(requestId), view = access.view(r);
    const receipt = r.outcome && "receipt" in r.outcome ? r.outcome.receipt : void 0;
    const verified = !!r.request && !!receipt && verifyBoundReceipt(receipt, { ...access.config.execution, tool: r.request.tool, parameters: r.request.arguments, requestId: r.requestId });
    const signedReason = verified ? receipt.decision?.reason : void 0;
    return {
      requestId: r.requestId,
      state: view.state,
      reason: signedReason?.slice(0, 4096) ?? r.outcome?.reason?.slice(0, 4096) ?? "No structured denial reason was retained.",
      source: signedReason ? "verified_kernel_receipt" : "retained_gateway",
      ...verified ? { receiptId: receipt.id } : {},
      policyRehearsal: "unavailable",
      resourcePreview: "unavailable",
      informationFlow: "unknown"
    };
  }
  return {
    project: project2,
    retained,
    startContinuation,
    outcome,
    acknowledge,
    propose,
    selectTemplate,
    explain,
    async close() {
      closed = true;
      await Promise.allSettled([...jobs.values()]);
    }
  };
}

// src/control/report.ts
var clean = (value) => String(value ?? "").replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, " ");
var md = (value) => clean(value).replace(/[\\`*_\[\]()<>!#|&~]/g, "\\$&");
var cell = (value) => md(value) || "\u2014";
var time = (ms) => new Date(ms).toISOString();
function table(headers, rows) {
  return [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`, ...rows.map((row) => `| ${row.map(cell).join(" | ")} |`)];
}
function renderSessionReport({ status, continuations, generatedAt, relayEvents }) {
  const lines = [
    "# Chio session report",
    "",
    `- Session: ${md(status.sessionId)}`,
    `- Scope: ${["isolated_kernel_mcp", "demo_fixture"].includes(status.scope) ? md(status.scope) : "not recorded in the journal (the launcher holds it)"}`,
    `- Authority: ${md(status.authority)} \xB7 expires ${time(status.authorityExpiresAt * 1e3)}`,
    `- Projection revision: ${md(status.revision)}`,
    `- Dispatch fence: ${status.fenced ? "retained" : "clear"}`,
    `- Generated: ${time(generatedAt)}`,
    "",
    "## Operations",
    "",
    ...table(
      ["Request", "Tool", "State", "Evidence", "Next action", "Receipt", "Kernel ACK", "Delivery"],
      status.operations.map((op) => [
        op.requestId,
        op.tool,
        op.state,
        op.evidence,
        op.nextAction,
        op.receiptId,
        op.acknowledged ? "confirmed" : "unconfirmed",
        op.hostDeliveryConfirmed ? op.deliveryChannel ?? "confirmed (channel not recorded)" : "unconfirmed"
      ])
    ),
    "",
    "Evidence: verified means the gateway checked the receipt signature against the session's pinned signers; this report does not re-verify it.",
    "",
    "## Decisions",
    "",
    ...status.intents.length ? table(["Intent", "Kind", "State", "Request", "Expires"], status.intents.map((i) => [i.id, i.kind, i.state, i.requestId, time(i.expiresAt)])) : ["No review intents retained."],
    "",
    "## Continuations",
    "",
    ...continuations.length ? table(["Continuation", "Original request", "State", "Delivery", "Model context"], continuations.map((c) => [c.id, c.requestId, c.state, c.delivery, c.modelContext ?? "not available to the operator report"])) : ["No continuations retained."],
    ""
  ];
  const task = status.workflow?.task;
  lines.push("## Task", "");
  if (task) lines.push(
    `- ${md(task.title)} \xB7 ${md(task.readiness)}`,
    `- Artifact: ${md(task.artifact.kind)} ${md(task.artifact.digest)} \xB7 ${md(task.artifact.label)}`,
    "",
    ...table(["Requirement", "State", "Evidence class", "Source", "Observed"], task.requirements.map((r) => [r.title, r.state, r.evidenceClass, r.source, r.observedAt ? time(r.observedAt) : void 0]))
  );
  else lines.push("No task contract is bound to this session.");
  lines.push("");
  if (Array.isArray(relayEvents)) {
    const forwarded = relayEvents.filter((e) => e?.requestClass === "conversation" && e.forwarded);
    const unknown = forwarded.filter((e) => !e.usage).length;
    const sum = (key) => forwarded.reduce((total, e) => total + (Number.isSafeInteger(e.usage?.[key]) ? e.usage[key] : 0), 0);
    const models = [...new Set(forwarded.map((e) => md(e.model)))];
    lines.push(
      "## Model usage",
      "",
      `- Relay-metered: ${forwarded.length} request${forwarded.length === 1 ? "" : "s"} \xB7 ${sum("input_tokens")} in \xB7 ${sum("output_tokens")} out \xB7 ${sum("cache_read_input_tokens")} cache read \xB7 ${sum("cache_creation_input_tokens")} cache write tokens${unknown ? ` \xB7 ${unknown} with unknown usage` : ""}`,
      `- Models: ${models.join(", ") || "\u2014"}`,
      "- Provider-reported counts, not billing records.",
      "- Source: the relay events file supplied by the operator; this report does not authenticate it.",
      ""
    );
  }
  lines.push(
    "## What this report is",
    "",
    "Generated from the operator's private journal and the session's authorized projection. Receipts are referenced by id; this report does not verify them. Verify receipts with the kernel's evidence tools. Launcher-held facts (scope, relay model context, budget refusals) appear in the launch profile's `launch.json` and `exit.json`. It contains no credentials, approval tokens or raw resource results.",
    ""
  );
  return lines.join("\n");
}

// src/control/service.ts
var LIMIT = 1024 * 1024;
var kinds = ["approve", "decline", "revoke"];
function hash(value) {
  return createHash4("sha256").update(canonicalizeJson(value)).digest("hex");
}
function privateJson2(path) {
  privatePath(path, false);
  if (lstatSync4(path).size > LIMIT) throw new Error("private record exceeds projection limit");
  return JSON.parse(readFileSync4(path, "utf8"));
}
function syncDirectory3(path) {
  const fd = openSync4(path, "r");
  try {
    fsyncSync4(fd);
  } finally {
    closeSync4(fd);
  }
}
function save(path, value, exclusive = false) {
  const output = exclusive ? path : `${path}.${randomUUID3()}.tmp`;
  const fd = openSync4(output, "wx", 384);
  try {
    writeFileSync4(fd, JSON.stringify(value));
    fsyncSync4(fd);
  } finally {
    closeSync4(fd);
  }
  if (!exclusive) renameSync3(output, path);
  syncDirectory3(resolve5(path, ".."));
}
function intentDirectory(config) {
  const path = join4(config.journalDir, "control-intents");
  mkdirSync4(path, { recursive: true, mode: 448 });
  privatePath(path, true);
  return path;
}
function intentRecords(config) {
  const dir = join4(config.journalDir, "control-intents");
  if (!existsSync2(dir)) return [];
  privatePath(dir, true);
  const names = readdirSync4(dir).filter((name) => name.endsWith(".json"));
  if (names.length > 1e3) throw new Error("control intent retention requires operator maintenance");
  return names.map((name) => {
    const r = privateJson2(join4(dir, name));
    if (r.schema !== "chio.control.intent.v1" || r.sessionId !== config.sessionId || r.binding !== hash(gatewayBinding(config))) throw new Error("control intent binding changed");
    return r;
  });
}
function publicIntent({ id, kind, state, sessionId, requestId, expiresAt }) {
  return { id, kind, state, sessionId, ...requestId ? { requestId } : {}, expiresAt };
}
function records(config) {
  gatewayStatus(config);
  const names = readdirSync4(config.journalDir).filter((name) => name.endsWith(".json"));
  if (names.length > 1e3) throw new Error("operation projection bound exceeded");
  return names.sort().map((name) => {
    const r = privateJson2(join4(config.journalDir, name));
    if (name !== `${operationKey(r.requestId)}.json` || !r.digest) throw new Error("operation identity changed");
    return r;
  });
}
function approval(config, record) {
  if (!record.proposal) return void 0;
  const path = gatewayApprovalPath(config, record.requestId);
  if (!existsSync2(resolve5(path, ".."))) return void 0;
  if (!readdirSync4(resolve5(path, "..")).includes(`${operationKey(record.requestId)}.json`)) return void 0;
  const artifact = privateJson2(path);
  return verifyApprovalToolCall(artifact.toolCallParams, {
    ...config.execution,
    sessionId: config.execution.sessionId,
    requestId: record.requestId,
    tool: record.proposal.tool_name,
    arguments: record.proposal.arguments
  });
}
function reviewRevision(config, record) {
  return hash({ binding: gatewayBinding(config), requestId: record.requestId, digest: record.digest, state: record.state, proposal: record.proposal ?? null });
}
function project(config, record) {
  const verified = verifiedOriginal(config, record);
  const state = record.state === "completed" && !verified ? "unknown" : record.state;
  let decision = "required";
  if (record.proposal) {
    const approved = approval(config, record);
    if (approved) decision = approved.decision === "approved" ? "granted" : "declined";
    else if (existsSync2(join4(config.journalDir, "approvals")) && readdirSync4(join4(config.journalDir, "approvals")).includes(`${operationKey(record.requestId)}.json`)) decision = "expired";
  }
  const nextAction = state === "pending" || state === "unknown" ? "reconcile_original" : state === "denied" ? "linked_continuation" : state === "awaiting_approval" ? decision === "granted" ? "explicit_resume" : decision === "required" ? "review" : "linked_continuation" : state === "completed" && (!record.acknowledged || record.hostDeliveryRequired !== false && !record.hostDeliveryConfirmed) ? "acknowledge_delivery" : "none";
  const view = {
    requestId: record.requestId,
    state,
    evidence: verified ? "verified" : "unverified",
    acknowledged: verified && record.acknowledged === true,
    hostDeliveryConfirmed: verified && record.hostDeliveryConfirmed === true,
    nextAction,
    ...record.request?.tool || record.proposal?.tool_name ? { tool: record.request?.tool ?? record.proposal.tool_name } : {},
    ...verified && record.outcome?.state === "completed" && record.outcome.receipt ? { receiptId: record.outcome.receipt.id } : {}
  };
  if (record.proposal && state === "awaiting_approval") {
    if (record.proposal.session_id !== config.execution.sessionId || record.proposal.capability_id !== config.execution.capabilityId || record.digest !== operationKey(canonicalizeJson({ name: record.proposal.tool_name, args: record.proposal.arguments }))) throw new Error("proposal does not bind the retained action");
    view.review = {
      revision: reviewRevision(config, record),
      purpose: record.proposal.purpose,
      arguments: record.proposal.arguments,
      capabilityId: record.proposal.capability_id,
      ttlSeconds: record.proposal.ttl_seconds,
      restrictions: "kernel_policy",
      budgetImpact: "unavailable",
      decision
    };
  }
  return view;
}
async function controlStatus(options) {
  const config = options.config;
  const operations = records(config).map((record) => project(config, record));
  const intents = intentRecords(config).map(publicIntent);
  let authority = "disconnected";
  if (options.authorityExpiresAt <= Math.floor(Date.now() / 1e3)) authority = "expired";
  else if (intents.some((intent) => intent.kind === "revoke" && intent.state === "confirmed")) authority = "revoked";
  else {
    try {
      const valid = options.validateAuthority ? await options.validateAuthority() : (await createMcpExecutionClient({ ...config.execution, timeoutMs: Math.min(config.execution.timeoutMs ?? 3e3, 3e3) }).validateSession({ allowedTools: config.tools.map((tool) => tool.name) })).ok;
      if (valid) authority = "live";
    } catch {
    }
  }
  const workflow = options.workflow;
  for (const [field, path] of [["task", workflow?.taskPath], ["catalog", workflow?.catalogPath]]) {
    if (path && resolve5(path) !== join4(config.journalDir, "workflow", field + ".json")) throw new Error("foreign workflow path");
  }
  const task = workflow?.taskPath ? await projectTask(readTask(workflow.taskPath, config.sessionId, hash(gatewayBinding(config)))) : void 0;
  const templates = workflow?.catalogPath ? readCatalog(workflow.catalogPath).map(templateView) : [];
  const taskRequestDir = join4(config.journalDir, "workflow", "task-requests");
  const requestNames = existsSync2(taskRequestDir) ? readdirSync4(taskRequestDir).filter((name) => name.endsWith(".json")) : [];
  if (requestNames.length > 1e3) throw new Error("task request retention requires maintenance");
  const requests = requestNames.map((name) => {
    const r = privateJson2(join4(taskRequestDir, name));
    if (r.schema !== "chio.task.request.v1" || name !== r.id + ".json" || !/^[0-9a-f-]{36}$/.test(r.id) || r.sessionId !== config.sessionId || r.binding !== hash(gatewayBinding(config)) || typeof r.templateId !== "string" || !/^[0-9a-f]{64}$/.test(r.revision) || !Number.isSafeInteger(r.createdAt) || r.createdAt > Date.now() + 5e3) throw new Error("invalid or foreign task request");
    const template = templates.find((t) => t.id === r.templateId);
    const state = !template || template.revision !== r.revision ? "stale" : Date.now() >= r.createdAt + Math.min(9e4, template.ttlSeconds * 1e3) ? "expired" : "requested";
    return { id: r.id, templateId: r.templateId, state, createdAt: r.createdAt };
  });
  const unresolved = operations.filter((op) => op.state === "pending" || op.state === "unknown" || op.state === "completed" && op.nextAction !== "none").length;
  return {
    schema: "chio.control.status.v1",
    sessionId: config.sessionId,
    checkedAt: Date.now(),
    scope: options.scope ?? "kernel_mcp",
    authority,
    authorityExpiresAt: options.authorityExpiresAt,
    protectedTools: config.tools.map((tool) => tool.name),
    revision: hash(gatewayBinding(config)),
    awaitingReview: operations.filter((op) => op.review?.decision === "required").length,
    unresolved,
    fenced: gatewayStatus(config).fenced || operations.some((op) => op.state === "pending" || op.state === "unknown"),
    operations,
    intents,
    workflow: { ...task ? { task } : {}, templates, requests, continuation: !!workflow?.resume && !!workflow?.acknowledge, proposals: !!workflow?.propose }
  };
}
function requestIntent(options, input) {
  const config = options.config;
  const kind = input.kind;
  if (!kinds.includes(kind) || typeof input.revision !== "string" || Object.keys(input).some((key) => !["kind", "revision", "requestId"].includes(key))) throw new Error("invalid review intent");
  if (options.authorityExpiresAt <= Math.floor(Date.now() / 1e3)) throw new Error("authority expired");
  if (kind === "revoke") {
    if (input.requestId !== void 0 || input.revision !== hash(gatewayBinding(config))) throw new Error("revocation binding changed");
  } else {
    if (typeof input.requestId !== "string" || input.requestId.length > 256) throw new Error("exact operation required");
    const record2 = records(config).find((record3) => record3.requestId === input.requestId);
    if (!record2 || record2.state !== "awaiting_approval" || project(config, record2).review?.decision !== "required" || reviewRevision(config, record2) !== input.revision) throw new Error("review is stale, already decided, or belongs to another action");
  }
  const existing = intentRecords(config);
  if (existing.some((intent) => intent.kind !== "alternative" && intent.requestId === input.requestId && intent.revision === input.revision)) throw new Error("review intent already recorded; inspect its original outcome");
  const record = {
    schema: "chio.control.intent.v1",
    id: randomUUID3(),
    kind,
    state: "requested",
    sessionId: config.sessionId,
    ...typeof input.requestId === "string" ? { requestId: input.requestId } : {},
    revision: input.revision,
    binding: hash(gatewayBinding(config)),
    createdAt: Date.now(),
    expiresAt: Math.min(Date.now() + 9e4, options.authorityExpiresAt * 1e3)
  };
  save(join4(intentDirectory(config), `${record.id}.json`), record, true);
  return publicIntent(record);
}
function reply(response, code, value) {
  response.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  response.end(JSON.stringify(value));
}
async function body(request) {
  if (request.headers["content-type"] !== "application/json") throw new Error("JSON required");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 4096) throw new Error("intent body too large");
    chunks.push(chunk);
  }
  const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("intent object required");
  return value;
}
async function controlReport(options) {
  const status = await controlStatus(options);
  const config = options.config;
  const workflow = createWorkflowControl({ config, binding: hash(gatewayBinding(config)), read: () => records(config), view: (record) => project(config, record), live: async () => false }, options.workflow, true);
  try {
    return { status, continuations: workflow.retained(false) };
  } finally {
    await workflow.close();
  }
}
async function startControlServer(options) {
  const pinned = { ...options, config: JSON.parse(JSON.stringify(options.config)) };
  records(pinned.config);
  const workflow = createWorkflowControl({
    config: pinned.config,
    binding: hash(gatewayBinding(pinned.config)),
    read: () => records(pinned.config),
    view: (record) => project(pinned.config, record),
    live: async () => (await controlStatus(pinned)).authority === "live"
  }, pinned.workflow);
  const token2 = randomBytes2(32).toString("hex");
  let statusReads = 0;
  let sessionMismatch = false;
  let closing;
  const server = createServer((request, response) => {
    void (async () => {
      const got = Buffer.from(request.headers.authorization ?? "");
      const expected = Buffer.from(`Bearer ${token2}`);
      if (request.headers.origin || got.length !== expected.length || !timingSafeEqual(got, expected)) return reply(response, 401, { error: "unauthorized" });
      if (pinned.authorityExpiresAt <= Math.floor(Date.now() / 1e3)) return reply(response, 401, { error: "scoped credential expired" });
      const root = `/sessions/${encodeURIComponent(pinned.config.sessionId)}`;
      if (pinned.onSessionMismatch && /^\/sessions\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//.test(request.url ?? "") && !request.url?.startsWith(root + "/")) {
        if (!sessionMismatch) {
          sessionMismatch = true;
          pinned.onSessionMismatch();
        }
        return reply(response, 404, { error: "host session changed; original transport remains fenced" });
      }
      if (sessionMismatch) return reply(response, 409, { error: "host session changed; launch a newly bound host" });
      if (request.method === "GET" && request.url === root + "/status") {
        const status = await controlStatus(pinned);
        statusReads += 1;
        const continuations = workflow.retained().map((c) => c.delivery === "confirmed" && pinned.modelContextConfirmed?.(c.requestId) ? { ...c, modelContext: "confirmed" } : c);
        for (const operation of status.operations) {
          if (operation.hostDeliveryConfirmed) operation.deliveryChannel = continuations.some((c) => c.requestId === operation.requestId && c.receiptConfirmed === true) ? "native_control" : pinned.modelDeliveryConfirmed?.(operation.requestId) ? "model_tool_result" : "unclassified";
        }
        return reply(response, 200, { ...status, continuations, ...pinned.modelUsage ? { modelUsage: pinned.modelUsage() } : {} });
      }
      if (request.method === "POST" && request.url === root + "/intents") return reply(response, 202, { intent: requestIntent(pinned, await body(request)), authorityAccepted: false, dispatchPerformed: false });
      if (request.method === "POST" && request.url === root + "/continuations") return reply(response, 202, { continuation: await workflow.startContinuation(await body(request)) });
      if (request.method === "POST" && request.url === root + "/proposals") return reply(response, 202, await workflow.propose(await body(request)));
      if (request.method === "POST" && request.url === root + "/task-requests") return reply(response, 202, workflow.selectTemplate(await body(request)));
      const continuationRoute = request.url?.startsWith(root + "/continuations/") ? request.url.slice((root + "/continuations/").length).split("/") : [];
      if (continuationRoute.length === 2 && request.method === "GET" && continuationRoute[1] === "outcome") {
        let result = workflow.outcome(continuationRoute[0]);
        if (!result.ready && result.continuation.state === "submitted") {
          await new Promise((resolveWait) => setTimeout(resolveWait, 200));
          result = workflow.outcome(continuationRoute[0]);
        }
        return reply(response, result.ready ? 200 : 202, result);
      }
      if (continuationRoute.length === 2 && request.method === "POST" && continuationRoute[1] === "ack") return reply(response, 200, await workflow.acknowledge(continuationRoute[0], await body(request)));
      if (request.method === "GET" && request.url?.startsWith(root + "/explanations/")) return reply(response, 200, workflow.explain(decodeURIComponent(request.url.slice((root + "/explanations/").length))));
      return reply(response, 404, { error: "no route for this session" });
    })().catch(() => reply(response, 409, { error: "control request unavailable, stale, or unresolved; inspect the original operation without automatic retry" }));
  });
  server.requestTimeout = 5e3;
  server.headersTimeout = 5e3;
  server.timeout = 5e3;
  await new Promise((resolveReady, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveReady);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing control listener");
  return {
    url: `http://127.0.0.1:${address.port}`,
    port: address.port,
    token: token2,
    retainedContinuations: () => workflow.retained(),
    get statusReads() {
      return statusReads;
    },
    get sessionMismatch() {
      return sessionMismatch;
    },
    close: () => closing ??= (async () => {
      await workflow.close();
      await new Promise((resolveClose, reject) => {
        server.close((error) => error ? reject(error) : resolveClose());
        server.closeAllConnections();
      });
    })()
  };
}
async function confirmControlIntent(config, operator, id) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("invalid intent id");
  records(config);
  const path = join4(intentDirectory(config), `${id}.json`);
  const intent = privateJson2(path);
  if (intent.id !== id || intent.schema !== "chio.control.intent.v1" || intent.sessionId !== config.sessionId || intent.binding !== hash(gatewayBinding(config)) || intent.state !== "requested" || intent.expiresAt <= Date.now() || intent.kind === "alternative") throw new Error("intent cannot be confirmed; inspect the original or create a permitted linked action");
  if (!operator.adminToken || operator.adminToken === config.execution.bearerToken) throw new Error("distinct operator-only credential required");
  const endpoint = new URL(config.execution.endpoint);
  if (endpoint.pathname !== "/" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && endpoint.hostname === "127.0.0.1")) throw new Error("invalid authority endpoint");
  const lockPath = join4(intentDirectory(config), `${id}.lock`);
  const lock = openSync4(lockPath, "wx", 384);
  closeSync4(lock);
  const record = intent.requestId ? records(config).find((record2) => record2.requestId === intent.requestId) : void 0;
  if (intent.kind === "revoke" ? intent.revision !== hash(gatewayBinding(config)) : !record || record.state !== "awaiting_approval" || reviewRevision(config, record) !== intent.revision || project(config, record).review?.decision !== "required") throw new Error("intent action changed after review");
  intent.state = "submitted";
  save(path, intent);
  const post = async (route, value) => {
    const response = await fetch(new URL(route, endpoint), {
      method: "POST",
      headers: { Authorization: `Bearer ${operator.adminToken}`, "Content-Type": "application/json" },
      ...value === void 0 ? {} : { body: JSON.stringify(value) },
      redirect: "error",
      signal: AbortSignal.timeout(1e4)
    });
    if (!response.ok) throw new Error("kernel rejected operator decision");
    const text = await response.text();
    if (text.length > LIMIT) throw new Error("authority response exceeds limit");
    return JSON.parse(text);
  };
  try {
    if (intent.kind === "revoke") {
      const result = await post(`/admin/sessions/${encodeURIComponent(config.execution.sessionId)}/trust`);
      if (result.sessionId !== config.execution.sessionId || result.revoked !== true || !Array.isArray(result.capabilities) || !result.capabilities.some((cap) => cap.capabilityId === config.execution.capabilityId && cap.revoked === true)) throw new Error("kernel did not confirm this session's capability revocation");
      intent.state = "confirmed";
    } else {
      const proposal2 = record.proposal;
      const submitted = await post("/admin/approvals", proposal2);
      const binds = (value) => value.dispatchPerformedByThisEndpoint === false && value.record?.request_id === record.requestId && value.record?.session_id === config.execution.sessionId && value.record?.capability_id === config.execution.capabilityId && typeof value.record?.id === "string";
      if (!binds(submitted)) throw new Error("kernel proposal acknowledgement changed the authority binding");
      const artifact = await post(`/admin/approvals/${encodeURIComponent(submitted.record.id)}/decision`, { decision: intent.kind === "approve" ? "approved" : "denied" });
      const verified = verifyApprovalToolCall(artifact.toolCallParams, { ...config.execution, sessionId: config.execution.sessionId, requestId: record.requestId, tool: proposal2.tool_name, arguments: proposal2.arguments });
      if (!binds(artifact) || !verified || verified.decision !== (intent.kind === "approve" ? "approved" : "denied")) throw new Error("kernel decision lacks the exact trusted signature");
      if (reviewRevision(config, records(config).find((r) => r.requestId === record.requestId)) !== intent.revision) throw new Error("operation changed while authority was submitted");
      mkdirSync4(join4(config.journalDir, "approvals"), { recursive: true, mode: 448 });
      privatePath(join4(config.journalDir, "approvals"), true);
      save(gatewayApprovalPath(config, record.requestId), artifact, true);
      intent.state = intent.kind === "approve" ? "granted" : "declined";
    }
    save(path, intent);
    return publicIntent(intent);
  } catch (error) {
    intent.state = "unknown";
    save(path, intent);
    throw error;
  }
}
export {
  confirmControlIntent,
  controlReport,
  controlStatus,
  renderSessionReport,
  startControlServer
};
