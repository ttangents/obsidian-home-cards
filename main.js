/*
 * Home Cards: a configurable start page for Obsidian.
 * Bundled by esbuild; the source is in src/.
 */
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => HomeCardsPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian7 = require("obsidian");

// src/compose/values.ts
function frontmatterValue(cache, key) {
  if (!cache?.frontmatter || !key) return void 0;
  return cache.frontmatter[key];
}
function asStringList(value) {
  const one = (v) => {
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    return null;
  };
  const list = Array.isArray(value) ? value : [value];
  return list.map(one).filter((v) => v !== null);
}
function firstValue(value) {
  return asStringList(value)[0] ?? "";
}
function parseDateLike(raw) {
  const s = raw.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (dateOnly) {
    const d2 = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    return Number.isNaN(d2.getTime()) ? null : d2;
  }
  if (!/^\d{4}-\d{2}-\d{2}[T ]/.test(s)) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function formatDate(d) {
  return d.toLocaleDateString(void 0, { day: "numeric", month: "short", year: "numeric" });
}
function splitList(raw) {
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}
function memoLast(fn) {
  let lastIn;
  let lastOut;
  let primed = false;
  return (input) => {
    if (!primed || input !== lastIn) {
      lastIn = input;
      lastOut = fn(input);
      primed = true;
    }
    return lastOut;
  };
}

// src/compose/text.ts
var TRAILING_DATE = /([,\s]+|^)(?:on\s+)?(@\d{4}-?\d{2}-?\d{2}|\d{4}-\d{2}-\d{2})(\s+update)?\s*$/i;
function isRealDateStamp(stamp) {
  const digits = stamp.replace(/[@-]/g, "");
  if (digits.length !== 8) return false;
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}
var titlePrefixList = memoLast(splitList);
function cleanTitle(name, s) {
  let t = name;
  for (const p of titlePrefixList(s.titlePrefixes)) {
    if (t.startsWith(p)) {
      t = t.slice(p.length).trim();
      break;
    }
  }
  if (s.stripTrailingDates) {
    const m = TRAILING_DATE.exec(t);
    if (m && isRealDateStamp(m[2])) t = t.slice(0, m.index).replace(/[,\s]+$/, "");
  }
  return t || name;
}
var PROSE_SECTION = "paragraph";
var MIN_SENTENCE = 12;
var SENTENCE = /\S.*?(?:[.?!]+(?=\s|$)|$)/g;
function splitSentences(text) {
  return text.match(SENTENCE) ?? [];
}
var openerList = memoLast((raw) => splitList(raw).map((o) => o.toLowerCase()));
function flatten(markdown) {
  return markdown.replace(/!?\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`=~]/g, "").replace(/\s+/g, " ").trim();
}
function dekSignature(s) {
  return `${s.showDeks}\0${s.summaryProperty}\0${s.boilerplateOpeners}`;
}
async function extractDek(app, file, cache, s) {
  if (!s.showDeks) return "";
  const override = firstValue(frontmatterValue(cache, s.summaryProperty));
  if (override) return override;
  const block = (cache?.sections ?? []).find((sec) => sec.type === PROSE_SECTION);
  if (!block) return "";
  let text;
  try {
    const content = await app.vault.cachedRead(file);
    text = content.slice(block.position.start.offset, block.position.end.offset);
  } catch {
    return "";
  }
  const flat = flatten(text);
  if (!flat) return "";
  const openers = openerList(s.boilerplateOpeners);
  for (const sentence of splitSentences(flat).slice(0, 3)) {
    const lower = sentence.toLowerCase();
    if (openers.some((o) => lower.startsWith(o))) continue;
    if (sentence.length >= MIN_SENTENCE) return sentence;
  }
  return "";
}

// src/compose/dek-cache.ts
var DekCache = class {
  constructor(capacity = 500) {
    this.capacity = capacity;
    this.entries = /* @__PURE__ */ new Map();
    this.signature = "";
  }
  get(app, file, settings) {
    const signature = dekSignature(settings);
    if (signature !== this.signature) {
      this.entries.clear();
      this.signature = signature;
    }
    const hit = this.entries.get(file.path);
    if (hit && hit.mtime === file.stat.mtime) {
      this.entries.delete(file.path);
      this.entries.set(file.path, hit);
      return hit.dek;
    }
    const dek = extractDek(app, file, app.metadataCache.getFileCache(file), settings).catch(
      () => ""
    );
    this.entries.set(file.path, { mtime: file.stat.mtime, dek });
    while (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next().value;
      if (oldest === void 0) break;
      this.entries.delete(oldest);
    }
    return dek;
  }
};

// src/render/bases-view.ts
var import_obsidian2 = require("obsidian");

// src/compose/scope.ts
function globToTest(pattern) {
  const source = pattern.toLowerCase().split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  const re = new RegExp(`^${source}$`);
  return (value) => re.test(value.toLowerCase());
}
var anyOf = (tests) => (v) => tests.some((t) => t(v));
function compileTags(raw) {
  const patterns = splitList(raw).map((p) => p.replace(/^#/, ""));
  if (!patterns.length) return null;
  return anyOf(
    patterns.map((p) => {
      const exact = globToTest(p);
      if (p.includes("*")) return exact;
      const descend = globToTest(`${p}/*`);
      return (tag) => exact(tag) || descend(tag);
    })
  );
}
function compileFolders(raw) {
  const patterns = splitList(raw);
  if (!patterns.length) return null;
  return anyOf(
    patterns.map((p) => {
      if (p.includes("/")) {
        const clean = p.replace(/^\/+/, "").replace(/\/+$/, "").replace(/\/\*$/, "");
        const exact = globToTest(clean);
        const descend = globToTest(`${clean}/*`);
        return (folder) => exact(folder) || descend(folder);
      }
      const segment = globToTest(p);
      return (folder) => folder.split("/").some(segment);
    })
  );
}
function compileProps(raw) {
  const rules = splitList(raw).map((entry) => {
    const eq = entry.indexOf("=");
    if (eq === -1) return { key: entry.toLowerCase(), value: null };
    return {
      key: entry.slice(0, eq).trim().toLowerCase(),
      value: entry.slice(eq + 1).trim().toLowerCase()
    };
  });
  if (!rules.length) return null;
  return (cache) => rules.some((rule) => matchesRule(cache, rule));
}
function matchesRule(cache, rule) {
  const fm = cache?.frontmatter;
  if (!fm) return false;
  const key = Object.keys(fm).find((k) => k.toLowerCase() === rule.key);
  if (key === void 0) return false;
  const value = fm[key];
  if (value === null || value === void 0 || value === "") return false;
  if (rule.value === null) return true;
  const list = Array.isArray(value) ? value : [value];
  return list.some(
    (v) => (typeof v === "string" || typeof v === "number" || typeof v === "boolean") && String(v).replace(/^#/, "").toLowerCase() === rule.value
  );
}
function tagsOf(cache) {
  const out = [];
  const fm = cache?.frontmatter?.tags;
  for (const t of Array.isArray(fm) ? fm : fm != null ? [fm] : []) {
    if (typeof t === "string") out.push(t.replace(/^#/, ""));
  }
  for (const t of cache?.tags ?? []) out.push(t.tag.replace(/^#/, ""));
  return out;
}
function compileScope(scope) {
  const tags = compileTags(scope.filterTags);
  const props = compileProps(scope.filterProps);
  const folders = compileFolders(scope.filterFolders);
  if (!tags && !props && !folders) return null;
  return (file, cache) => {
    if (tags && !tagsOf(cache).some(tags)) return false;
    if (props && !props(cache)) return false;
    if (folders) {
      const folder = file.parent && file.parent.path !== "/" ? file.parent.path : "";
      if (!folders(folder)) return false;
    }
    return true;
  };
}

// src/compose/card.ts
function footer(ctx, file, rubric, lead) {
  const cache = ctx.app.metadataCache.getFileCache(file);
  const bits = [];
  if (lead) bits.push(lead);
  const raw = firstValue(frontmatterValue(cache, ctx.metaKey)) || firstValue(frontmatterValue(cache, "date"));
  if (raw) {
    const date = parseDateLike(raw);
    if (date) bits.push(formatDate(date));
    else if (raw !== rubric) bits.push(raw);
  }
  if (ctx.settings.showFileSize) {
    bits.push(`${Math.max(1, Math.round(file.stat.size / 1024))} KB`);
  }
  return bits.join(" \xB7 ");
}
async function buildCard(ctx, file, lead) {
  const { app, settings } = ctx;
  const cache = app.metadataCache.getFileCache(file);
  const rubric = firstValue(frontmatterValue(cache, settings.typeProperty));
  const tags = settings.showTags ? [...new Set(tagsOf(cache).map((t) => t.trim()).filter(Boolean))].slice(0, settings.maxTags) : [];
  const dek = ctx.deks ? await ctx.deks(file) : null;
  return {
    file,
    title: cleanTitle(file.basename, settings),
    rubric,
    icon: ctx.icons.get(rubric.toLowerCase()) ?? "",
    tags,
    dek,
    meta: footer(ctx, file, rubric, lead),
    search: [file.basename, rubric, dek ?? "", ...tags].join(" ").toLowerCase()
  };
}

// src/compose/rank.ts
var collator = new Intl.Collator(void 0, { numeric: true });
var byTitle = (settings) => (file) => cleanTitle(file.basename, settings);
function sortByKey(vault, files, key, dir, settings) {
  const title = byTitle(settings);
  const sign = dir === "desc" ? -1 : 1;
  return files.map((file) => {
    const value = key ? firstValue(frontmatterValue(vault.cacheOf(file), key)) : "";
    return {
      file,
      has: value !== "",
      key: value || String(file.stat.mtime).padStart(16, "0"),
      title: title(file)
    };
  }).sort((a, b) => {
    if (a.has !== b.has) return a.has ? -1 : 1;
    const primary = sign * collator.compare(a.key, b.key);
    return primary || collator.compare(a.title, b.title);
  }).map((d) => d.file);
}
function byPopularity(vault, files, most, settings) {
  const counts = vault.inboundCounts();
  const title = byTitle(settings);
  const sign = most ? -1 : 1;
  return files.map((file) => ({ file, n: counts.get(file.path) ?? 0, title: title(file) })).sort((a, b) => sign * (a.n - b.n) || collator.compare(a.title, b.title)).map(({ file, n }) => ({ file, lead: `${n} ${n === 1 ? "link" : "links"}` }));
}
var plain = (files) => files.map((file) => ({ file }));
function rankSection(vault, cfg, settings) {
  const scope = compileScope(cfg);
  const cacheOf = (f) => vault.cacheOf(f);
  const pool = scope ? vault.files.filter((f) => scope(f, cacheOf(f))) : vault.files;
  switch (cfg.kind) {
    case "recent-opened": {
      const byPath = new Map(pool.map((f) => [f.path, f]));
      return plain(
        vault.app.workspace.getLastOpenFiles().map((p) => byPath.get(p)).filter((f) => f !== void 0)
      );
    }
    case "recent-created":
      return plain([...pool].sort((a, b) => b.stat.ctime - a.stat.ctime));
    case "recent-modified":
      return plain([...pool].sort((a, b) => b.stat.mtime - a.stat.mtime));
    case "most-linked":
    case "least-linked":
      return byPopularity(vault, pool, cfg.kind === "most-linked", settings);
    case "tag": {
      const want = cfg.tag.replace(/^#/, "").toLowerCase();
      if (!want) return [];
      const hits = pool.filter(
        (f) => tagsOf(cacheOf(f)).some((t) => {
          const tag = t.toLowerCase();
          return tag === want || tag.startsWith(`${want}/`);
        })
      );
      return plain(sortByKey(vault, hits, cfg.sortKey, cfg.sortDir, settings));
    }
    case "property": {
      if (!cfg.propertyKey) return [];
      const want = cfg.propertyValue.trim().toLowerCase();
      const hits = pool.filter((f) => {
        const raw = frontmatterValue(cacheOf(f), cfg.propertyKey);
        if (raw == null || raw === "") return false;
        return !want || asStringList(raw).some((v) => v.toLowerCase() === want);
      });
      return plain(sortByKey(vault, hits, cfg.sortKey || cfg.propertyKey, cfg.sortDir, settings));
    }
  }
}

// src/compose/vault.ts
var VaultSnapshot = class {
  constructor(app) {
    this.app = app;
    this.inbound = null;
    this.files = app.vault.getMarkdownFiles();
  }
  cacheOf(file) {
    return this.app.metadataCache.getFileCache(file);
  }
  /** Inbound link totals per path; computed on first use. */
  inboundCounts() {
    return this.inbound ??= inboundCounts(this.app);
  }
};
function discoverProperties(app) {
  const keys = /* @__PURE__ */ new Set();
  for (const file of app.vault.getMarkdownFiles()) {
    const fm = app.metadataCache.getFileCache(file)?.frontmatter;
    if (!fm) continue;
    for (const k of Object.keys(fm)) if (k !== "position") keys.add(k);
  }
  return [...keys].sort((a, b) => a.localeCompare(b));
}
function inboundCounts(app) {
  const totals = /* @__PURE__ */ new Map();
  const table = app.metadataCache.resolvedLinks ?? {};
  for (const targets of Object.values(table)) {
    for (const [target, n] of Object.entries(targets ?? {})) {
      totals.set(target, (totals.get(target) ?? 0) + n);
    }
  }
  return totals;
}
async function loadTypifyIcons(app, typeKey) {
  const out = /* @__PURE__ */ new Map();
  const path = `${app.vault.configDir}/plugins/typify/data.json`;
  try {
    if (!await app.vault.adapter.exists(path)) return out;
    const parsed = JSON.parse(await app.vault.adapter.read(path));
    for (const style of parsed.statusStyles ?? []) {
      const name = (style.name ?? "").trim();
      const icon = (style.icon ?? "").trim();
      if (!name || !icon) continue;
      if (!(style.appliesTo ?? ["type"]).includes(typeKey)) continue;
      out.set(name.toLowerCase(), icon);
    }
  } catch {
    return /* @__PURE__ */ new Map();
  }
  return out;
}

// src/compose/compose.ts
async function iconsFor(app, settings) {
  return settings.showGlyph && settings.typifyIcons ? loadTypifyIcons(app, settings.typeProperty) : /* @__PURE__ */ new Map();
}
async function composeSections(app, settings, deks) {
  const icons = await iconsFor(app, settings);
  const vault = new VaultSnapshot(app);
  const taken = /* @__PURE__ */ new Set();
  const out = [];
  for (const cfg of settings.sections) {
    if (!cfg.enabled) continue;
    const picked = [];
    let claimed = 0;
    for (const r of rankSection(vault, cfg, settings)) {
      if (settings.dedupe && taken.has(r.file.path)) {
        claimed++;
        continue;
      }
      picked.push(r);
      if (picked.length >= cfg.count) break;
    }
    for (const r of picked) taken.add(r.file.path);
    const ctx = {
      app,
      settings,
      metaKey: cfg.sortKey || cfg.propertyKey || "date",
      icons,
      deks
    };
    const cards = await Promise.all(picked.map((r) => buildCard(ctx, r.file, r.lead)));
    out.push({ config: cfg, cards, claimed });
  }
  return out;
}

// src/render/appearance.ts
function applyAppearance(root, s) {
  root.addClass("home-cards");
  root.dataset.surface = s.cardSurface;
  if (s.background === "plain") delete root.dataset.pattern;
  else root.dataset.pattern = s.background;
  root.toggleClass("hc-accent-rubrics", s.accentRubrics);
  root.setCssProps({
    "--hc-card-min": `${s.cardMinWidth}px`,
    "--hc-dek-lines": String(s.dekLines)
  });
}

// src/render/card.ts
var import_obsidian = require("obsidian");
var NO_DEK = "No opening sentence.";
function noteOpener(app) {
  return (file, newLeaf) => void app.workspace.getLeaf(newLeaf ? "tab" : false).openFile(file);
}
function renderGlyph(head, card) {
  const glyph = head.createSpan({ cls: "hc-glyph" });
  if (card.icon) {
    (0, import_obsidian.setIcon)(glyph, card.icon);
    if (glyph.firstElementChild) {
      glyph.addClass("has-icon");
      return;
    }
  }
  glyph.setText(card.title.charAt(0).toUpperCase());
}
function renderPills(parent, card, opts) {
  const type = opts.showRubric ? card.rubric : "";
  if (!type && !card.tags.length) return;
  const pills = parent.createDiv({ cls: "hc-pills" });
  if (type) pills.createSpan({ cls: "hc-pill is-type", text: type });
  for (const t of card.tags) pills.createSpan({ cls: "hc-pill is-tag", text: t });
}
function renderDek(el, card) {
  if (card.dek === null) {
    const dek = el.createEl("p", { cls: "hc-dek" });
    dek.dataset.hcDekPath = card.file.path;
    dek.dataset.hcPending = "";
    return;
  }
  el.createEl("p", {
    cls: card.dek ? "hc-dek" : "hc-dek is-empty",
    text: card.dek || NO_DEK
  });
}
function settleDek(el, dek) {
  delete el.dataset.hcPending;
  el.toggleClass("is-empty", !dek);
  el.setText(dek || NO_DEK);
}
function renderCard(parent, card, opts, open) {
  const el = parent.createEl("article", { cls: "hc-card" });
  el.dataset.search = card.search;
  el.tabIndex = 0;
  const head = el.createDiv({ cls: "hc-card-head" });
  if (opts.showGlyph) renderGlyph(head, card);
  const text = head.createDiv({ cls: "hc-card-headtext" });
  text.createEl("h3", { cls: "hc-title", text: card.title });
  renderPills(text, card, opts);
  if (opts.showDeks) renderDek(el, card);
  if (card.meta) el.createEl("footer", { cls: "hc-foot", text: card.meta });
  const go = (evt) => open(card.file, evt.metaKey || evt.ctrlKey);
  el.addEventListener("click", go);
  el.addEventListener("keydown", (evt) => {
    if (evt.key !== "Enter" && evt.key !== " ") return;
    evt.preventDefault();
    go(evt);
  });
  return el;
}
function renderSection(parent, title, cards, opts, open, emptyText = "") {
  const section = parent.createDiv({ cls: "hc-section" });
  if (title) {
    const head = section.createDiv({ cls: "hc-section-head" });
    head.createEl("h2", { text: title });
    head.createSpan({ cls: "hc-count", text: String(cards.length) });
  }
  if (!cards.length && emptyText) {
    section.createDiv({ cls: "hc-empty", text: emptyText });
    return section;
  }
  const grid = section.createDiv({ cls: "hc-grid" });
  for (const card of cards) renderCard(grid, card, opts, open);
  return section;
}

// src/render/lazy-deks.ts
function observeDeks(root, fill) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        observer.unobserve(el);
        const path = el.dataset.hcDekPath;
        if (path) fill(path, el);
      }
    },
    // Start one viewport early so the text is there on arrival.
    { root: null, rootMargin: "100% 0px" }
  );
  for (const el of Array.from(root.querySelectorAll("[data-hc-dek-path]"))) {
    observer.observe(el);
  }
  return () => observer.disconnect();
}

// src/render/bases-view.ts
var BASES_VIEW_ID = "home-cards";
var HomeCardsBasesView = class extends import_obsidian2.BasesView {
  constructor(controller, containerEl, plugin) {
    super(controller);
    this.plugin = plugin;
    this.type = BASES_VIEW_ID;
    /** Invalidates async renders that land after newer data or an unload. */
    this.generation = 0;
    this.disposeObserver = null;
    this.root = containerEl.createDiv({ cls: "hc-in-bases" });
    this.registerEvent(plugin.onRefresh(() => this.onDataUpdated()));
  }
  onunload() {
    this.generation++;
    this.stopObserving();
    this.root.remove();
  }
  /**
   * Bases calls this on every query re-run and replaces `this.data`
   * wholesale, so the view keeps nothing from a previous run.
   */
  onDataUpdated() {
    const token = ++this.generation;
    this.stopObserving();
    this.render(token).catch((err) => {
      console.error("Home Cards: Bases render failed", err);
      if (token !== this.generation) return;
      this.root.empty();
      this.root.createDiv({
        cls: "hc-empty",
        text: "Could not render this view. See the console for details."
      });
    });
  }
  async render(token) {
    const { app } = this;
    const { plugin } = this;
    const settings = plugin.settings;
    const groups = this.data.groupedData;
    const ctx = {
      app,
      settings,
      metaKey: "date",
      icons: await iconsFor(app, settings)
    };
    const sections = await Promise.all(
      groups.map(async (group) => ({
        title: group.hasKey() ? group.key?.toString() ?? "" : "",
        cards: await Promise.all(group.entries.map((entry) => buildCard(ctx, entry.file)))
      }))
    );
    if (token !== this.generation) return;
    const root = this.root;
    root.empty();
    applyAppearance(root, settings);
    root.dataset.view = "grid";
    const open = noteOpener(app);
    for (const { title, cards } of sections) {
      renderSection(root, title, cards, settings, open);
    }
    this.disposeObserver = observeDeks(root, (path, el) => {
      const file = app.vault.getFileByPath(path);
      if (!file) return;
      void plugin.dekCache.get(app, file, plugin.settings).then((dek) => {
        if (token === this.generation) settleDek(el, dek);
      });
    });
  }
  stopObserving() {
    this.disposeObserver?.();
    this.disposeObserver = null;
  }
};
function registerBasesView(plugin) {
  return plugin.registerBasesView(BASES_VIEW_ID, {
    name: "Home cards",
    icon: "layout-grid",
    factory: (controller, containerEl) => new HomeCardsBasesView(controller, containerEl, plugin)
  });
}

// src/render/home-view.ts
var import_obsidian3 = require("obsidian");

// src/compose/greeting.ts
var OCCASIONS = [
  { month: 1, day: 1, texts: ["Happy New Year", "Bonne ann\xE9e", "Feliz a\xF1o nuevo"] },
  { month: 2, day: 14, texts: ["Happy Valentine's Day"] },
  { month: 3, day: 14, texts: ["Happy Pi Day", "Happy 3.14159"] },
  { month: 3, day: 17, texts: ["Happy St. Patrick's Day", "Sl\xE1inte"] },
  { month: 4, day: 1, texts: ["Trust nothing today", "Happy April Fools'"] },
  { month: 5, day: 4, texts: ["May the Fourth be with you"] },
  { month: 5, day: 25, texts: ["Happy Towel Day", "Don't panic"] },
  { month: 10, day: 31, texts: ["Happy Halloween", "Boo"] },
  { month: 12, day: 24, texts: ["Merry Christmas Eve"] },
  { month: 12, day: 25, texts: ["Merry Christmas", "Joyeux No\xEBl", "Feliz Navidad"] },
  { month: 12, day: 31, texts: ["Happy New Year's Eve", "See you next year"] }
];
var ANYTIME = [
  "Hello",
  "Hola",
  "Bonjour",
  "Ciao",
  "Namaste",
  "Salaam",
  "Shalom",
  "Konnichiwa",
  "Ni hao",
  "Annyeong",
  "Sawasdee",
  "Selamat",
  "Habari",
  "Aloha",
  "Kia ora",
  "G'day",
  "Howdy",
  "Hej",
  "Servus",
  "Salut",
  "Welcome back"
];
var BY_HOUR = [
  {
    from: 5,
    to: 12,
    texts: [
      "Good morning",
      "Buongiorno",
      "Guten Morgen",
      "Buenos d\xEDas",
      "Bom dia",
      "Ohay\u014D",
      "Rise and shine",
      "Top of the morning",
      "Suprabhat",
      "Coffee first"
    ]
  },
  {
    from: 12,
    to: 17,
    texts: ["Good afternoon", "Buenas tardes", "Bon apr\xE8s-midi", "Guten Tag", "Boa tarde"]
  },
  {
    from: 17,
    to: 22,
    texts: ["Good evening", "Bonsoir", "Guten Abend", "Buonasera", "Boa noite", "Shubh sandhya"]
  }
];
var LATE_NIGHT = [
  "Burning the midnight oil",
  "Still up",
  "The vault never sleeps",
  "Good night owl",
  "Up late"
];
var FRIDAY = ["Happy Friday", "Nearly the weekend"];
var WEEKEND = ["Happy weekend", "Easy does it"];
function pick(list, rng) {
  return list[Math.floor(rng() * list.length) % list.length];
}
function greetingFor(now, options = {}) {
  const { occasions = true, rng = Math.random } = options;
  const occasion = occasions && OCCASIONS.find((o) => o.month === now.getMonth() + 1 && o.day === now.getDate());
  if (occasion) return pick(occasion.texts, rng);
  const hour = now.getHours();
  const bucket = BY_HOUR.find((b) => hour >= b.from && hour < b.to)?.texts ?? LATE_NIGHT;
  const day = now.getDay();
  const pool = [
    ...bucket,
    ...ANYTIME,
    ...day === 5 ? FRIDAY : [],
    ...day === 0 || day === 6 ? WEEKEND : []
  ];
  return pick(pool, rng);
}

// src/settings/schema.ts
var SECTION_KINDS = [
  { id: "recent-opened", label: "Recently opened" },
  { id: "recent-created", label: "Recently created" },
  { id: "recent-modified", label: "Recently modified" },
  { id: "property", label: "By property" },
  { id: "tag", label: "By tag" },
  { id: "most-linked", label: "Most popular" },
  { id: "least-linked", label: "Least popular" }
];
var VIEW_MODES = [
  { id: "grid", label: "Grid", icon: "layout-grid" },
  { id: "rows", label: "Rows", icon: "list" }
];
var SURFACES = [
  { id: "flat", label: "Flat" },
  { id: "elevated", label: "Elevated" },
  { id: "frosted", label: "Frosted" },
  { id: "outline", label: "Outline" }
];
var BACKGROUNDS = [
  { id: "plain", label: "Plain" },
  { id: "diamonds", label: "Diamonds" },
  { id: "leaves", label: "Leaves" },
  { id: "stitches", label: "Stitches" },
  { id: "suns", label: "Suns" }
];
function isChoice(registry, value) {
  return registry.some((c) => c.id === value);
}
function labelOf(registry, id) {
  return registry.find((c) => c.id === id)?.label ?? id;
}
var BLANK_SECTION = {
  id: "",
  title: "",
  kind: "recent-modified",
  count: 8,
  enabled: true,
  propertyKey: "",
  propertyValue: "",
  sortKey: "",
  sortDir: "desc",
  tag: "",
  filterTags: "",
  filterProps: "",
  filterFolders: ""
};
function defaultSections() {
  return [
    { ...BLANK_SECTION, id: "opened", kind: "recent-opened" },
    { ...BLANK_SECTION, id: "created", kind: "recent-created" },
    { ...BLANK_SECTION, id: "most", kind: "most-linked" },
    { ...BLANK_SECTION, id: "least", kind: "least-linked" }
  ];
}
function defaultSettings() {
  return {
    sections: defaultSections(),
    dedupe: true,
    greetingEnabled: true,
    greetingOccasions: true,
    greetingName: "",
    showNoteCount: true,
    openOnStartup: false,
    defaultView: "grid",
    cardMinWidth: 262,
    cardSurface: "flat",
    background: "plain",
    accentRubrics: true,
    typeProperty: "type",
    showGlyph: true,
    typifyIcons: false,
    showRubric: true,
    showTags: true,
    maxTags: 3,
    showDeks: true,
    dekLines: 3,
    showFileSize: false,
    summaryProperty: "summary",
    boilerplateOpeners: "this note, this document, this page",
    titlePrefixes: "",
    stripTrailingDates: true
  };
}
var LIMITS = {
  count: { min: 1, max: 24 },
  cardMinWidth: { min: 180, max: 420 },
  maxTags: { min: 1, max: 6 },
  dekLines: { min: 1, max: 8 }
};
function newSectionId() {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
function autoTitle(cfg) {
  switch (cfg.kind) {
    case "tag":
      return cfg.tag ? `#${cfg.tag.replace(/^#/, "")}` : labelOf(SECTION_KINDS, cfg.kind);
    case "property": {
      const k = cfg.propertyKey;
      if (!k) return labelOf(SECTION_KINDS, cfg.kind);
      if (cfg.propertyValue) return `${k}: ${cfg.propertyValue}`;
      return `By ${k.charAt(0).toLowerCase()}${k.slice(1)}`;
    }
    default:
      return labelOf(SECTION_KINDS, cfg.kind);
  }
}
function sectionTitle(cfg) {
  return cfg.title.trim() || autoTitle(cfg);
}

// src/render/home-view.ts
var VIEW_TYPE_HOME = "home-cards-view";
var HomeView = class extends import_obsidian3.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.shell = null;
    this.greeting = "";
    this.query = "";
    /** Invalidates composes that finish after a newer one or a close. */
    this.generation = 0;
    this.mode = plugin.settings.defaultView;
  }
  getViewType() {
    return VIEW_TYPE_HOME;
  }
  getDisplayText() {
    return "Home";
  }
  getIcon() {
    return "layout-grid";
  }
  async onOpen() {
    this.greeting = greetingFor(/* @__PURE__ */ new Date(), {
      occasions: this.plugin.settings.greetingOccasions
    });
    this.shell = this.buildShell(this.contentEl);
    this.registerEvent(this.plugin.onRefresh(() => void this.refresh()));
    await this.refresh();
  }
  async onClose() {
    this.generation++;
    this.shell = null;
    this.contentEl.empty();
  }
  /** Re-read settings and recompose. Safe to call at any time. */
  async refresh() {
    const shell = this.shell;
    if (!shell) return;
    applyAppearance(shell.root, this.plugin.settings);
    this.paintHeader(shell);
    await this.recompose(shell);
  }
  // ------------------------------------------------------------- header
  buildShell(container) {
    const root = container.createDiv({ cls: "home-cards" });
    const wrap = root.createDiv({ cls: "hc-wrap" });
    const top = wrap.createDiv({ cls: "hc-top" });
    const masthead = top.createDiv({ cls: "hc-masthead" });
    const greeting = masthead.createEl("h1", { cls: "hc-greeting" });
    const dateline = masthead.createDiv({ cls: "hc-dateline" });
    const controls = top.createDiv({ cls: "hc-controls" });
    const search = controls.createEl("input", {
      cls: "hc-search",
      attr: { type: "search", placeholder: "Filter notes\u2026", spellcheck: "false" }
    });
    search.addEventListener("input", () => {
      this.query = search.value;
      this.applyFilter();
    });
    const seg = controls.createDiv({ cls: "hc-seg" });
    const toggles = /* @__PURE__ */ new Map();
    for (const mode of VIEW_MODES) {
      const btn = seg.createEl("button", { attr: { "aria-label": `${mode.label} view` } });
      (0, import_obsidian3.setIcon)(btn, mode.icon);
      btn.addEventListener("click", () => this.setMode(mode.id));
      toggles.set(mode.id, btn);
    }
    const recompose = seg.createEl("button", {
      cls: "hc-reload",
      attr: { "aria-label": "Recompose" }
    });
    (0, import_obsidian3.setIcon)(recompose, "refresh-cw");
    recompose.addEventListener("click", () => void this.refresh());
    const body = wrap.createDiv({ cls: "hc-body" });
    body.createDiv({ cls: "hc-loading", text: "Composing\u2026" });
    const shell = { root, greeting, dateline, toggles, body };
    this.paintMode(shell);
    return shell;
  }
  paintHeader(shell) {
    const s = this.plugin.settings;
    const name = s.greetingName.trim();
    shell.greeting.toggle(s.greetingEnabled);
    shell.greeting.setText(name ? `${this.greeting}, ${name}` : this.greeting);
    const bits = [
      (/* @__PURE__ */ new Date()).toLocaleDateString(void 0, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      })
    ];
    if (s.showNoteCount) bits.push(`${this.app.vault.getMarkdownFiles().length} notes`);
    shell.dateline.setText(bits.join("  \xB7  "));
  }
  /** Layout switches are pure CSS: no recompose, no network of listeners. */
  setMode(mode) {
    this.mode = mode;
    if (this.shell) this.paintMode(this.shell);
  }
  paintMode(shell) {
    shell.root.dataset.view = this.mode;
    for (const [mode, btn] of shell.toggles) {
      const on = mode === this.mode;
      btn.toggleClass("is-active", on);
      btn.setAttr("aria-pressed", String(on));
    }
  }
  // --------------------------------------------------------------- body
  async recompose(shell) {
    const token = ++this.generation;
    const { app, plugin } = this;
    const settings = plugin.settings;
    let sections;
    try {
      sections = await composeSections(
        app,
        settings,
        (file) => plugin.dekCache.get(app, file, settings)
      );
    } catch (err) {
      console.error("Home Cards: compose failed", err);
      if (token === this.generation) {
        shell.body.empty();
        shell.body.createDiv({
          cls: "hc-empty",
          text: "Could not compose the page. See the console for details."
        });
      }
      return;
    }
    if (token !== this.generation) return;
    const next = createDiv();
    if (!sections.length) {
      next.createDiv({ cls: "hc-empty", text: "Turn on a section in Settings \u2192 Home Cards to fill this page." });
    } else if (!app.vault.getMarkdownFiles().length) {
      next.createDiv({ cls: "hc-empty", text: "Cards appear here as you write notes." });
    } else {
      const open = noteOpener(app);
      for (const { config, cards, claimed } of sections) {
        const empty = claimed ? "Every matching note already appears in a section above." : "This section has no matching notes.";
        renderSection(next, sectionTitle(config), cards, settings, open, empty);
      }
    }
    shell.body.replaceChildren(...Array.from(next.childNodes));
    this.applyFilter();
  }
  applyFilter() {
    const body = this.shell?.body;
    if (!body) return;
    const q = this.query.trim().toLowerCase();
    for (const section of body.findAll(".hc-section")) {
      const cards = section.findAll(".hc-card");
      let shown = 0;
      for (const card of cards) {
        const hit = !q || (card.dataset.search ?? "").includes(q);
        card.toggleClass("is-hidden", !hit);
        if (hit) shown++;
      }
      section.find(".hc-count")?.setText(String(shown));
      section.toggleClass("is-hidden", q !== "" && shown === 0);
    }
  }
};

// src/settings/normalize.ts
var isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var str = (v, fallback) => typeof v === "string" ? v : fallback;
var bool = (v, fallback) => typeof v === "boolean" ? v : fallback;
function int(v, fallback, range) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(range.max, Math.max(range.min, Math.round(n)));
}
function choice(registry, v, fallback) {
  return registry.some((c) => c.id === v) ? v : fallback;
}
var LEGACY_TITLES = /* @__PURE__ */ new Set([
  "Recently opened",
  "Recently created",
  "Recently modified",
  "By dateline",
  "Referenced but never written",
  "New section"
]);
function migrate(raw) {
  const r = { ...raw };
  if (r.defaultView === "masonry" || r.defaultView === "tiles") r.defaultView = "grid";
  if (typeof r.paperStyle === "string" && r.paperStyle !== "blank") r.background = "suns";
  if (r.backgroundPattern === true) r.background = "suns";
  const retiredPatterns = {
    hearts: "diamonds",
    interlace: "diamonds",
    regal: "diamonds",
    crosses: "diamonds",
    waves: "stitches"
  };
  if (typeof r.background === "string" && r.background in retiredPatterns) {
    r.background = retiredPatterns[r.background];
  }
  const surfaceMap = { secondary: "flat", "primary-alt": "elevated", transparent: "outline" };
  if (typeof r.cardSurface === "string" && r.cardSurface in surfaceMap) {
    r.cardSurface = surfaceMap[r.cardSurface];
  }
  if (!("showFileSize" in r) && typeof r.showWordCount === "boolean") {
    r.showFileSize = r.showWordCount;
  }
  return r;
}
function normalizeSection(e, index) {
  const legacyUnresolved = e.kind === "unresolved";
  const title = str(e.title, "");
  const cfg = {
    id: str(e.id, "") || `s${index}-${newSectionId()}`,
    title: legacyUnresolved || LEGACY_TITLES.has(title.trim()) ? "" : title,
    kind: legacyUnresolved ? "most-linked" : choice(SECTION_KINDS, e.kind, BLANK_SECTION.kind),
    count: int(e.count, BLANK_SECTION.count, LIMITS.count),
    enabled: e.enabled !== false,
    propertyKey: str(e.propertyKey, ""),
    propertyValue: str(e.propertyValue, ""),
    sortKey: str(e.sortKey, ""),
    sortDir: e.sortDir === "asc" ? "asc" : "desc",
    tag: str(e.tag, ""),
    filterTags: str(e.filterTags, ""),
    filterProps: str(e.filterProps, ""),
    filterFolders: str(e.filterFolders, "")
  };
  if (!legacyUnresolved) return [cfg];
  return [cfg, { ...BLANK_SECTION, id: `${cfg.id}-least`, kind: "least-linked" }];
}
function normalizeSections(raw) {
  if (!Array.isArray(raw)) return defaultSections();
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  raw.forEach((entry, i) => {
    if (!isObject(entry)) return;
    for (const cfg of normalizeSection(entry, i)) {
      while (seen.has(cfg.id)) cfg.id += "x";
      seen.add(cfg.id);
      out.push(cfg);
    }
  });
  return out.length ? out : defaultSections();
}
function normalizeSettings(stored) {
  const d = defaultSettings();
  if (!isObject(stored)) return d;
  const r = migrate(stored);
  return {
    sections: normalizeSections(r.sections),
    dedupe: bool(r.dedupe, d.dedupe),
    greetingEnabled: bool(r.greetingEnabled, d.greetingEnabled),
    greetingOccasions: bool(r.greetingOccasions, d.greetingOccasions),
    greetingName: str(r.greetingName, d.greetingName),
    showNoteCount: bool(r.showNoteCount, d.showNoteCount),
    openOnStartup: bool(r.openOnStartup, d.openOnStartup),
    defaultView: choice(VIEW_MODES, r.defaultView, d.defaultView),
    cardMinWidth: int(r.cardMinWidth, d.cardMinWidth, LIMITS.cardMinWidth),
    cardSurface: choice(SURFACES, r.cardSurface, d.cardSurface),
    background: choice(BACKGROUNDS, r.background, d.background),
    accentRubrics: bool(r.accentRubrics, d.accentRubrics),
    // Blank falls back to the default: a card always has a type key.
    typeProperty: str(r.typeProperty, d.typeProperty).trim() || d.typeProperty,
    showGlyph: bool(r.showGlyph, d.showGlyph),
    typifyIcons: bool(r.typifyIcons, d.typifyIcons),
    showRubric: bool(r.showRubric, d.showRubric),
    showTags: bool(r.showTags, d.showTags),
    maxTags: int(r.maxTags, d.maxTags, LIMITS.maxTags),
    showDeks: bool(r.showDeks, d.showDeks),
    dekLines: int(r.dekLines, d.dekLines, LIMITS.dekLines),
    showFileSize: bool(r.showFileSize, d.showFileSize),
    summaryProperty: str(r.summaryProperty, d.summaryProperty).trim(),
    boilerplateOpeners: str(r.boilerplateOpeners, d.boilerplateOpeners),
    titlePrefixes: str(r.titlePrefixes, d.titlePrefixes),
    stripTrailingDates: bool(r.stripTrailingDates, d.stripTrailingDates)
  };
}

// src/settings-tab/tab.ts
var import_obsidian6 = require("obsidian");

// src/settings-tab/sections.ts
var import_obsidian5 = require("obsidian");

// src/settings-tab/widgets.ts
var import_obsidian4 = require("obsidian");
function settingGroup(parent, heading, cls) {
  const group = parent.createDiv({ cls: "setting-group" });
  if (cls) group.addClass(cls);
  if (heading) new import_obsidian4.Setting(group).setName(heading).setHeading();
  return group.createDiv({ cls: "setting-items" });
}
function hint(parent, text) {
  parent.createEl("p", { cls: "hc-hint", text });
}
function addChoices(dropdown, registry) {
  for (const c of registry) dropdown.addOption(c.id, c.label);
  return dropdown;
}

// src/settings-tab/sections.ts
var SectionsPane = class {
  constructor(plugin, redraw) {
    this.plugin = plugin;
    this.redraw = redraw;
    /** Open editors, by section id. View state: never persisted. */
    this.expanded = /* @__PURE__ */ new Set();
    /**
     * Frontmatter keys, gathered once per visit to the settings tab.
     * `discoverProperties` walks every note, and the pane redraws on each
     * structural edit.
     */
    this.properties = null;
  }
  /** Called when the settings tab closes, so the next visit sees new keys. */
  forget() {
    this.properties = null;
  }
  render(root) {
    const s = this.plugin.settings;
    hint(
      root,
      "Sections render top to bottom. A note appears in the first section that claims it, so order sets precedence."
    );
    const props = this.properties ??= discoverProperties(this.plugin.app);
    for (const cfg of s.sections) {
      this.renderSection(settingGroup(root, void 0, "hc-sec-group"), cfg, props);
    }
    const addRow = root.createDiv({ cls: "hc-addrow" });
    addRow.createEl("button", { cls: "mod-cta", text: "Add section" }).addEventListener("click", () => {
      const cfg = { ...BLANK_SECTION, id: newSectionId() };
      s.sections.push(cfg);
      this.expanded.add(cfg.id);
      void this.restructure();
    });
    new import_obsidian5.Setting(settingGroup(root)).setName("One section per note").setDesc("Stops a note filling a slot in more than one section.").addToggle(
      (t) => t.setValue(s.dedupe).onChange((v) => {
        s.dedupe = v;
        this.plugin.touch();
      })
    );
  }
  async restructure() {
    await this.plugin.commit();
    this.redraw();
  }
  /**
   * Collapsed: one summary row. Expanded: the same row followed by the
   * editor's rows in the same container, so the group stays one card.
   */
  renderSection(items, cfg, props) {
    const sections = this.plugin.settings.sections;
    const open = this.expanded.has(cfg.id);
    const position = () => sections.indexOf(cfg);
    const move = (by) => {
      const i = position();
      const j = i + by;
      if (i < 0 || j < 0 || j >= sections.length) return;
      [sections[i], sections[j]] = [sections[j], sections[i]];
      void this.restructure();
    };
    const head = items.createDiv({ cls: "setting-item hc-sec-head" });
    head.toggleClass("is-off", !cfg.enabled);
    const toggleOpen = () => {
      if (open) this.expanded.delete(cfg.id);
      else this.expanded.add(cfg.id);
      this.redraw();
    };
    new import_obsidian5.ExtraButtonComponent(head).setIcon(open ? "chevron-down" : "chevron-right").setTooltip(open ? "Collapse" : "Expand").onClick(toggleOpen).extraSettingsEl.addClass("hc-twisty");
    const info = head.createDiv({ cls: "setting-item-info hc-sec-label" });
    info.addEventListener("click", toggleOpen);
    const name = info.createDiv({ cls: "setting-item-name" });
    const meta = info.createDiv({ cls: "setting-item-description" });
    const paintSummary = () => {
      const derived = !cfg.title.trim();
      name.setText(sectionTitle(cfg));
      name.toggleClass("is-derived", derived);
      const cards = `${cfg.count} ${cfg.count === 1 ? "card" : "cards"}`;
      meta.setText(derived ? cards : `${labelOf(SECTION_KINDS, cfg.kind)} \xB7 ${cards}`);
    };
    paintSummary();
    const controls = head.createDiv({ cls: "setting-item-control" });
    new import_obsidian5.ToggleComponent(controls).setValue(cfg.enabled).setTooltip("Show this section").onChange((on) => {
      cfg.enabled = on;
      head.toggleClass("is-off", !on);
      this.plugin.touch();
    });
    const index = position();
    const button = (icon, label, disabled, action) => new import_obsidian5.ExtraButtonComponent(controls).setIcon(icon).setTooltip(label).setDisabled(disabled).onClick(action);
    button("arrow-up", "Move up", index === 0, () => move(-1));
    button("arrow-down", "Move down", index === sections.length - 1, () => move(1));
    button("trash-2", "Remove section", false, () => {
      const i = position();
      if (i < 0) return;
      sections.splice(i, 1);
      this.expanded.delete(cfg.id);
      void this.restructure();
    });
    if (open) this.renderEditor(items, cfg, props, paintSummary);
  }
  renderEditor(items, cfg, props, paintSummary) {
    const touch = () => {
      paintSummary();
      this.plugin.touch();
    };
    const row = (name, desc) => {
      const setting = new import_obsidian5.Setting(items).setName(name).setClass("hc-subrow");
      if (desc) setting.setDesc(desc);
      return setting;
    };
    const text = (name, desc, placeholder, key) => row(name, desc).addText(
      (t) => t.setPlaceholder(placeholder).setValue(cfg[key]).onChange((v) => {
        cfg[key] = v;
        touch();
      })
    );
    row("Heading", "Leave empty to follow the source.").addText(
      (t) => t.setPlaceholder(autoTitle(cfg)).setValue(cfg.title).onChange((v) => {
        cfg.title = v;
        touch();
      })
    );
    row("Source").addDropdown(
      (d) => addChoices(d, SECTION_KINDS).setValue(cfg.kind).onChange((v) => {
        if (!isChoice(SECTION_KINDS, v)) return;
        cfg.kind = v;
        void this.restructure();
      })
    );
    row("Cards").addSlider(
      (sl) => sl.setLimits(LIMITS.count.min, LIMITS.count.max, 1).setValue(cfg.count).setDynamicTooltip().onChange((v) => {
        cfg.count = v;
        touch();
      })
    );
    if (cfg.kind === "property") {
      const desc = props.length ? "Only notes carrying it appear here." : "The notes in this vault have no properties yet. Add some, then reopen settings.";
      row("Property", desc).addDropdown((d) => {
        d.addOption("", "Pick a property");
        for (const k of props) d.addOption(k, k);
        if (cfg.propertyKey && !props.includes(cfg.propertyKey)) {
          d.addOption(cfg.propertyKey, `${cfg.propertyKey} (not in vault)`);
        }
        d.setValue(cfg.propertyKey).onChange((v) => {
          cfg.propertyKey = v;
          if (!cfg.sortKey) cfg.sortKey = v;
          void this.restructure();
        });
      });
      text("Value", "Optional. Empty includes every note with the property.", "e.g. Report", "propertyValue");
    }
    if (cfg.kind === "tag") {
      text("Tag", "Matches the tag and anything nested under it.", "my/deliverable", "tag");
    }
    text("Filter by tag", "Comma separated. Bare tags include descendants.", "firm/vendor*, my/deliverable", "filterTags");
    text("Filter by property", "`key` requires the property; `key=value` matches it.", "type=Organization, status", "filterProps");
    text("Filter by folder", "Path patterns with /, otherwise folder names.", "/Stuff/*, interviews", "filterFolders");
    if (cfg.kind === "property" || cfg.kind === "tag") {
      row("Sort by", "Notes without the property fall back to file modification time.").addDropdown((d) => {
        d.addOption("", "File modified");
        for (const k of props) d.addOption(k, k);
        if (cfg.sortKey && !props.includes(cfg.sortKey)) {
          d.addOption(cfg.sortKey, `${cfg.sortKey} (not in vault)`);
        }
        d.setValue(cfg.sortKey).onChange((v) => {
          cfg.sortKey = v;
          this.plugin.touch();
        });
      }).addDropdown(
        (d) => d.addOption("desc", "Newest first").addOption("asc", "Oldest first").setValue(cfg.sortDir).onChange((v) => {
          cfg.sortDir = v === "asc" ? "asc" : "desc";
          this.plugin.touch();
        })
      );
    }
  }
};

// src/settings-tab/tab.ts
var PANES = [
  { id: "sections", label: "Sections" },
  { id: "cards", label: "Cards" },
  { id: "layout", label: "Layout" }
];
var HomeCardsSettingTab = class extends import_obsidian6.PluginSettingTab {
  constructor(plugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
    /** Which pane is showing. View state: never persisted. */
    this.pane = "sections";
    this.sections = new SectionsPane(plugin, () => this.display());
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("home-cards-settings");
    const bar = containerEl.createDiv({ cls: "hc-tabs", attr: { role: "tablist" } });
    for (const pane of PANES) {
      const on = pane.id === this.pane;
      const b = bar.createEl("button", {
        text: pane.label,
        attr: { role: "tab", "aria-selected": String(on) }
      });
      b.toggleClass("is-active", on);
      b.addEventListener("click", () => {
        this.pane = pane.id;
        this.display();
      });
    }
    const body = containerEl.createDiv({ cls: "hc-tabbody" });
    switch (this.pane) {
      case "sections":
        this.sections.render(body);
        break;
      case "cards":
        this.cardsPane(body);
        break;
      case "layout":
        this.layoutPane(body);
        break;
    }
  }
  /** Obsidian calls this when the tab closes: write any pending edit. */
  hide() {
    this.sections.forget();
    void this.plugin.flush();
  }
  /** Write now, then redraw so dependent controls appear or disappear. */
  async restructure() {
    await this.plugin.commit();
    this.display();
  }
  // ------------------------------------------------------------------ cards
  cardsPane(root) {
    const s = this.plugin.settings;
    hint(root, "What each card carries, and where its text comes from.");
    const content = settingGroup(root);
    new import_obsidian6.Setting(content).setName("Glyph").setDesc("A mark in the corner of each card.").addDropdown(
      (d) => d.addOption("off", "None").addOption("letter", "Initial letter").addOption("typify", "Icon from Typify").setValue(!s.showGlyph ? "off" : s.typifyIcons ? "typify" : "letter").onChange((v) => {
        s.showGlyph = v !== "off";
        s.typifyIcons = v === "typify";
        void this.restructure();
      })
    );
    if (s.showGlyph && s.typifyIcons) {
      hint(
        content,
        "Requires the Typify plugin. Home Cards reads Typify's icons and matches them on each note's type. Types without a Typify icon keep the initial letter."
      );
    }
    new import_obsidian6.Setting(content).setName("Type label").setDesc("The value of this property, shown as the first pill on each card.").addText(
      (t) => t.setValue(s.typeProperty).setDisabled(!s.showRubric).onChange((v) => {
        s.typeProperty = v.trim() || "type";
        this.plugin.touch();
      })
    ).addToggle(
      (t) => t.setValue(s.showRubric).onChange((v) => {
        s.showRubric = v;
        void this.restructure();
      })
    );
    new import_obsidian6.Setting(content).setName("Tags").setDesc("Frontmatter tags first, then inline tags.").addToggle(
      (t) => t.setValue(s.showTags).onChange((v) => {
        s.showTags = v;
        void this.restructure();
      })
    ).addSlider(
      (sl) => sl.setLimits(LIMITS.maxTags.min, LIMITS.maxTags.max, 1).setValue(s.maxTags).setDynamicTooltip().setDisabled(!s.showTags).onChange((v) => {
        s.maxTags = v;
        this.plugin.touch();
      })
    );
    new import_obsidian6.Setting(content).setName("Opening sentence").setDesc("The first prose sentence, and how many lines it may run to.").addToggle(
      (t) => t.setValue(s.showDeks).onChange((v) => {
        s.showDeks = v;
        void this.restructure();
      })
    ).addSlider(
      (sl) => sl.setLimits(LIMITS.dekLines.min, LIMITS.dekLines.max, 1).setValue(s.dekLines).setDynamicTooltip().setDisabled(!s.showDeks).onChange((v) => {
        s.dekLines = v;
        this.plugin.touch();
      })
    );
    new import_obsidian6.Setting(content).setName("File size in the footer").setDesc("The footer always carries the value the section sorts on.").addToggle(
      (t) => t.setValue(s.showFileSize).onChange((v) => {
        s.showFileSize = v;
        this.plugin.touch();
      })
    );
    const text = settingGroup(root, "Text extraction");
    new import_obsidian6.Setting(text).setName("Summary property").setDesc("When a note defines it, it wins over the first sentence.").addText(
      (t) => t.setValue(s.summaryProperty).onChange((v) => {
        s.summaryProperty = v.trim();
        this.plugin.touch();
      })
    );
    new import_obsidian6.Setting(text).setName("Skip openings beginning with").setDesc("Comma separated. Self-referential first sentences get passed over.").addTextArea(
      (t) => t.setValue(s.boilerplateOpeners).onChange((v) => {
        s.boilerplateOpeners = v;
        this.plugin.touch();
      })
    );
    new import_obsidian6.Setting(text).setName("Strip from headlines").setDesc("Comma separated title prefixes. The toggle also strips trailing date stamps.").addText(
      (t) => t.setValue(s.titlePrefixes).onChange((v) => {
        s.titlePrefixes = v;
        this.plugin.touch();
      })
    ).addToggle(
      (t) => t.setTooltip("Strip trailing dates").setValue(s.stripTrailingDates).onChange((v) => {
        s.stripTrailingDates = v;
        this.plugin.touch();
      })
    );
  }
  // ----------------------------------------------------------------- layout
  layoutPane(root) {
    const s = this.plugin.settings;
    hint(
      root,
      "Color, type and spacing come from your active theme. These settings choose the surface cards sit on and how the grid reflows."
    );
    const page = settingGroup(root);
    new import_obsidian6.Setting(page).setName("Default view").addDropdown(
      (d) => addChoices(d, VIEW_MODES).setValue(s.defaultView).onChange((v) => {
        if (!isChoice(VIEW_MODES, v)) return;
        s.defaultView = v;
        this.plugin.touch();
      })
    );
    new import_obsidian6.Setting(page).setName("Minimum card width").setDesc("Cards reflow to fill the pane; this sets how narrow they may get.").addSlider(
      (sl) => sl.setLimits(LIMITS.cardMinWidth.min, LIMITS.cardMinWidth.max, 2).setValue(s.cardMinWidth).setDynamicTooltip().onChange((v) => {
        s.cardMinWidth = v;
        this.plugin.touch();
      })
    );
    new import_obsidian6.Setting(page).setName("Card surface").setDesc(
      "Flat sits on the theme surface; Elevated lifts on a shadow; Frosted blurs whatever lies behind the card; Outline keeps only the border."
    ).addDropdown(
      (d) => addChoices(d, SURFACES).setValue(s.cardSurface).onChange((v) => {
        if (!isChoice(SURFACES, v)) return;
        s.cardSurface = v;
        this.plugin.touch();
      })
    );
    new import_obsidian6.Setting(page).setName("Type labels in accent color").setDesc("Off uses the theme's muted text color.").addToggle(
      (t) => t.setValue(s.accentRubrics).onChange((v) => {
        s.accentRubrics = v;
        this.plugin.touch();
      })
    );
    const background = settingGroup(root, "Background");
    new import_obsidian6.Setting(background).setName("Pattern").setDesc("Plain follows the theme. Each pattern switches between a light and a dark tile with the theme's mode.");
    this.swatchGallery(background);
    const header = settingGroup(root, "Header");
    new import_obsidian6.Setting(header).setName("Greeting").setDesc("Follows the time of day and the calendar, with a word from another language now and then. Add a name to be greeted by it.").addText(
      (t) => t.setPlaceholder("Your name").setValue(s.greetingName).setDisabled(!s.greetingEnabled).onChange((v) => {
        s.greetingName = v;
        this.plugin.touch();
      })
    ).addToggle(
      (t) => t.setValue(s.greetingEnabled).onChange((v) => {
        s.greetingEnabled = v;
        void this.restructure();
      })
    );
    new import_obsidian6.Setting(header).setName("Holiday greetings").setDesc("On fixed-date holidays such as New Year's Day and Christmas, the greeting marks the day. Applies the next time you open the home page.").addToggle(
      (t) => t.setValue(s.greetingOccasions).setDisabled(!s.greetingEnabled).onChange((v) => {
        s.greetingOccasions = v;
        this.plugin.touch();
      })
    );
    new import_obsidian6.Setting(header).setName("Show note count").addToggle(
      (t) => t.setValue(s.showNoteCount).onChange((v) => {
        s.showNoteCount = v;
        this.plugin.touch();
      })
    );
    new import_obsidian6.Setting(header).setName("Open on startup").addToggle(
      (t) => t.setValue(s.openOnStartup).onChange((v) => {
        s.openOnStartup = v;
        this.plugin.touch();
      })
    );
  }
  /**
   * One swatch per background, each painted with the same custom property
   * the page uses, so a preview cannot drift from the real background.
   * Selection repaints in place; the pane keeps its scroll position.
   */
  swatchGallery(parent) {
    const s = this.plugin.settings;
    const grid = parent.createDiv({ cls: "hc-swatches", attr: { role: "radiogroup" } });
    const items = BACKGROUNDS.map((bg) => {
      const item = grid.createEl("button", { cls: "hc-swatch-item", attr: { role: "radio" } });
      const face = item.createDiv({ cls: "hc-swatch" });
      if (bg.id !== "plain") face.dataset.pattern = bg.id;
      item.createDiv({ cls: "hc-swatch-label", text: bg.label });
      item.addEventListener("click", () => {
        if (s.background === bg.id) return;
        s.background = bg.id;
        paint();
        void this.plugin.commit();
      });
      return { id: bg.id, item };
    });
    const paint = () => {
      for (const { id, item } of items) {
        const on = s.background === id;
        item.toggleClass("is-selected", on);
        item.setAttr("aria-checked", String(on));
      }
    };
    paint();
  }
};

// src/main.ts
var REFRESH = "refresh";
var SAVE_DELAY_MS = 400;
var RESOLVE_DELAY_MS = 1500;
var HomeCardsPlugin = class extends import_obsidian7.Plugin {
  constructor() {
    super(...arguments);
    this.settings = defaultSettings();
    /** Shared by every view. Bounded, and self-invalidating on mtime and settings. */
    this.dekCache = new DekCache();
    /**
     * Views subscribe here to redraw after a settings change or a metadata
     * update. The plugin holds no view references; each view's Component
     * releases its subscription when the view closes.
     */
    this.events = new import_obsidian7.Events();
    /** True while an edit sits in memory that data.json does not have. */
    this.dirty = false;
    this.flushSoon = (0, import_obsidian7.debounce)(() => void this.flush(), SAVE_DELAY_MS, true);
  }
  async onload() {
    await this.loadSettings();
    this.registerView(VIEW_TYPE_HOME, (leaf) => new HomeView(leaf, this));
    registerBasesView(this);
    this.addSettingTab(new HomeCardsSettingTab(this));
    this.addRibbonIcon("layout-grid", "Open home page", () => void this.activateView());
    this.addCommand({ id: "open", name: "Open", callback: () => void this.activateView() });
    this.addCommand({ id: "recompose", name: "Recompose", callback: () => this.refreshViews() });
    const settle = (0, import_obsidian7.debounce)(() => this.refreshViews(), RESOLVE_DELAY_MS, true);
    this.registerEvent(this.app.metadataCache.on("resolved", settle));
    if (this.settings.openOnStartup) {
      this.app.workspace.onLayoutReady(() => void this.activateView());
    }
  }
  onunload() {
    void this.write();
  }
  // ------------------------------------------------------------ persistence
  /** Record an edit; write once the edits stop. For keystrokes and sliders. */
  touch() {
    this.dirty = true;
    this.flushSoon();
  }
  /** Record an edit and write it now. For structural changes. */
  async commit() {
    this.dirty = true;
    await this.flush();
  }
  /** Write a pending edit, if any, and redraw the views that show it. */
  async flush() {
    if (await this.write()) this.refreshViews();
  }
  /** Write a pending edit. Resolves true when there was one. */
  async write() {
    this.flushSoon.cancel();
    if (!this.dirty) return false;
    this.dirty = false;
    try {
      await this.saveData(this.settings);
    } catch (err) {
      this.dirty = true;
      console.error("Home Cards: could not save settings", err);
    }
    return true;
  }
  async loadSettings() {
    let stored = null;
    try {
      stored = await this.loadData();
    } catch (err) {
      console.error("Home Cards: settings unreadable, using defaults", err);
    }
    this.settings = normalizeSettings(stored);
  }
  // ------------------------------------------------------------------ views
  /** Reveal the Home view, opening it in a new tab if none exists. */
  async activateView() {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_HOME)[0];
    if (existing) {
      await workspace.revealLeaf(existing);
      return;
    }
    const leaf = workspace.getLeaf("tab");
    await leaf.setViewState({ type: VIEW_TYPE_HOME, active: true });
    await workspace.revealLeaf(leaf);
  }
  /** Subscribe to redraw requests; pass the result to `registerEvent`. */
  onRefresh(callback) {
    return this.events.on(REFRESH, callback);
  }
  /** Ask every open Home and Bases view to redraw. */
  refreshViews() {
    this.events.trigger(REFRESH);
  }
};
