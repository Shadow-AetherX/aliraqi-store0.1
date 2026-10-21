/* =====================================================================
   العراقي ستور — AL-IRAQI STORE — script.js
   كتالوج إلكتروني ثابت: Google Sheet (CSV) ← واجهة ← واتساب
   نفس الكود بيشتغل للجملة (بالكرتونة) وللقطاعي (بالقطعة) حسب config.js
===================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------------
     0) الإعدادات
  ------------------------------------------------------------------ */
  const S = Object.assign(
    {
      mode: "wholesale",
      storeName: "العراقي ستور",
      whatsappNumber: "",
      googleSheetCsvUrl: "",
      feedbackEndpoint: "",
      imageProxy: true,
      mobileColumns: 1,
      welcomeEveryVisit: false,
      welcomeBannerImage: "",
      currency: "جنيه",
      maxQuantity: 9999,
    },
    window.SITE || {}
  );
  const WHOLESALE = S.mode !== "retail";
  const ORDER_TITLE = WHOLESALE ? "طلب جملة" : "طلب قطاعي";
  const UNIT_ONE = WHOLESALE ? "كرتونة" : "قطعة";
  const UNIT_MANY = WHOLESALE ? "كراتين" : "قطع";
  const K = {
    cart: `aliraqi_cart_${S.mode}_v2`,
    rows: `aliraqi_rows_${S.mode}_v2`,
    seq: `aliraqi_order_seq_${S.mode}_v2`,
    cust: `aliraqi_customer_${S.mode}_v1`,
    welcome: `aliraqi_welcome_${S.mode}_v1`,
    fbLast: `aliraqi_feedback_last_${S.mode}_v1`,
  };
  document.documentElement.style.setProperty("--mob-cols", String(S.mobileColumns === 2 ? 2 : 1));

  const $ = (id) => document.getElementById(id);
  const el = {
    grid: $("grid"), chips: $("chips"), navBar: $("navBar"),
    loading: $("loadingState"), error: $("errorState"), emptyData: $("emptyData"), noResults: $("noResults"),
    retry: $("retryBtn"), reset: $("resetBtn"),
    search: $("searchInput"), searchForm: $("searchForm"),
    catBtn: $("catGridBtn"), catSheet: $("catSheet"), catList: $("catList"),
    top: $("topBtn"), waFab: $("waFab"), fabs: $("fabs"),
    bar: $("orderBar"), barLine: $("orderLine"), reviewBtn: $("reviewBtn"), clearBtn: $("clearBtn"),
    review: $("reviewSheet"), reviewLines: $("reviewLines"), reviewSummary: $("reviewSummary"), reviewGrand: $("reviewGrand"),
    custName: $("custName"), custPhone: $("custPhone"), custNameHint: $("custNameHint"), custPhoneHint: $("custPhoneHint"),
    sendWa: $("sendWaBtn"), pdfBtn: $("pdfBtn"), busy: $("busy"), busyText: $("busyText"),
    fbSheet: $("feedbackSheet"), fbForm: $("fbForm"), fbMsg: $("fbMsg"), fbMsgHint: $("fbMsgHint"), fbName: $("fbName"),
    fbPhone: $("fbPhone"), fbWebsite: $("fbWebsite"), fbSend: $("fbSend"), fbNote: $("fbNote"),
    fbBtn: $("feedbackBtn"), fbBtn2: $("feedbackBtn2"),
    lb: $("lightbox"), lbImg: $("lbImg"), lbClose: $("lbClose"), lbPrev: $("lbPrev"), lbNext: $("lbNext"), lbCounter: $("lbCounter"),
    welcome: $("welcome"), welcomeGo: $("welcomeGo"), welcomeArt: $("welcomeArt"),
    toasts: $("toasts"),
  };

  /* ------------------------------------------------------------------
     1) أدوات عامة
  ------------------------------------------------------------------ */
  function h(tag, props, ...kids) {
    const n = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach((k) => {
        const v = props[k];
        if (v === undefined || v === null || v === false) return;
        if (k === "class") n.className = v;
        else if (k === "text") n.textContent = v;
        else if (k.startsWith("on")) n.addEventListener(k.slice(2).toLowerCase(), v);
        else n.setAttribute(k, v === true ? "" : v);
      });
    }
    kids.flat().forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      n.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
    });
    return n;
  }
  const round2 = (n) => Math.round(n * 100) / 100;
  function money(v, fixed) {
    const r = round2(v);
    const opts = fixed ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { minimumFractionDigits: Number.isInteger(r) ? 0 : 2, maximumFractionDigits: 2 };
    return `${r.toLocaleString("en-US", opts)} ${S.currency}`;
  }
  function normQty(raw) {
    let n = Math.trunc(Number(raw));
    if (!Number.isFinite(n)) n = 1;
    return Math.max(1, Math.min(S.maxQuantity, n));
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }

  let toastTimer = 0;
  function toast(msg, type, ms) {
    const t = h("div", { class: `toast ${type || ""}`, text: msg });
    el.toasts.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add("show")));
    const kill = () => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); };
    setTimeout(kill, ms || 2400);
    while (el.toasts.children.length > 3) el.toasts.firstChild.remove();
    return kill;
  }

  /* ------------------------------------------------------------------
     2) الطبقات (نوافذ) + زرار الرجوع في الموبايل بيقفلها بدل ما يخرج من الموقع
  ------------------------------------------------------------------ */
  const LAYERS = [];
  let lastFocus = [];
  function openLayer(name, rootEl, closeFn, focusEl) {
    lastFocus.push(document.activeElement);
    LAYERS.push({ name, rootEl, closeFn });
    try { history.pushState({ layer: name }, ""); } catch (e) { /* ignore */ }
    rootEl.hidden = false;
    document.body.classList.add("modal-open");
    requestAnimationFrame(() => focusEl && focusEl.focus && focusEl.focus({ preventScroll: true }));
  }
  function closeTopLayer() {
    if (!LAYERS.length) return;
    let hasState = false;
    try { hasState = history.state && history.state.layer; } catch (e) { /* ignore */ }
    if (hasState) history.back();
    else popLayer();
  }
  function popLayer() {
    const L = LAYERS.pop();
    if (!L) return;
    L.rootEl.hidden = true;
    if (L.closeFn) L.closeFn();
    if (!LAYERS.length) document.body.classList.remove("modal-open");
    const f = lastFocus.pop();
    if (f && f.focus && document.contains(f)) { try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }
  window.addEventListener("popstate", popLayer);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && LAYERS.length) { e.preventDefault(); closeTopLayer(); return; }
    if (e.key === "Tab" && LAYERS.length) {
      const root = LAYERS[LAYERS.length - 1].rootEl;
      const f = [...root.querySelectorAll('button:not([disabled]),input:not([disabled]):not([tabindex="-1"]),textarea,a[href],[tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    }
  });
  document.addEventListener("click", (e) => {
    const c = e.target.closest && e.target.closest("[data-close]");
    if (c && LAYERS.length && LAYERS[LAYERS.length - 1].rootEl.contains(c)) closeTopLayer();
  });

  /* ------------------------------------------------------------------
     3) الداتا: CSV ← منتجات
  ------------------------------------------------------------------ */
  const FIELD_ALIASES = {
    id: ["id", "code", "item_id", "sku", "كود", "كود الصنف", "كود المنتج"],
    name: ["name", "product_name", "title", "اسم", "اسم الصنف", "اسم المنتج"],
    category: ["category", "type", "القسم", "التصنيف", "قسم"],
    image: ["image", "img", "photo", "image_url", "صورة", "رابط الصورة", "الصورة"],
    pcs: ["pcs_per_carton", "carton_qty", "pcs", "pieces_per_carton", "عدد القطع بالكرتونة", "عدد القطع في الكرتونة", "عدد القطعة بالكرتونة"],
    piece_price: ["piece_price", "price_piece", "base_price", "baseprice", "base price", "بيس برايس", "البيس برايس", "سعر القطعة", "سعر_القطعة"],
    retail_price: ["retail_price", "price_retail", "سعر القطاعي", "سعر التجزئة", "سعر البيع للجمهور", "سعر الجمهور"],
    carton_price: ["carton_price", "price_carton", "سعر الكرتونة", "سعر_الكرتونة"],
    carton_unit_price: ["carton_unit_price", "unit_price", "سعر القطعة في الكرتونة", "سعر القطعة اللي في الكرتونة", "سعر الوحدة", "سعر وحدة الكرتونة"],
    availability: ["availability", "status", "التوفر", "الحالة", "متوفر"],
    description: ["description", "desc", "details", "الوصف", "تفاصيل"],
    badge: ["badge", "badges", "label", "tag", "شارة", "بادج", "ملصق"],
    featured: ["featured", "مميز", "منتج مميز"],
  };
  const AVAILABLE = new Set(["available", "متوفر", "yes", "1", "true", "نعم"]);
  const FEATURED_TRUE = new Set(["1", "yes", "y", "true", "نعم", "✓", "featured", "مميز"]);

  function normHeader(x) {
    return String(x === undefined || x === null ? "" : x).replace(/^﻿/, "").trim().replace(/\s+/g, " ").toLowerCase();
  }
  function pick(row, list) {
    for (const a of list) {
      const k = normHeader(a);
      if (k in row) {
        const v = row[k];
        if (v !== undefined && v !== null && String(v).trim() !== "") return v;
      }
    }
    return undefined;
  }
  function num(v) {
    if (v === undefined || v === null) return null;
    const c = String(v).trim().replace(/,/g, "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
    if (c === "") return null;
    const n = Number(c);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  /* قارئ CSV صغير (بيدعم علامات التنصيص والأسطر الجديدة داخل الخانة) */
  function parseCSV(text) {
    const rows = [];
    let row = [], f = "", q = false;
    const s = String(text || "").replace(/^﻿/, "");
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) {
        if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(f); f = ""; }
      else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
      else if (c !== "\r") f += c;
    }
    if (f !== "" || row.length) { row.push(f); rows.push(row); }
    return rows.filter((r) => r.some((x) => String(x).trim() !== ""));
  }
  function csvToObjects(text) {
    const rows = parseCSV(text);
    if (rows.length < 2) return [];
    const seen = {};
    const head = rows[0].map((raw) => {
      const k = normHeader(raw);
      seen[k] = (seen[k] || 0) + 1;
      return seen[k] > 1 ? `${k}_${seen[k] - 1}` : k;
    });
    return rows.slice(1).map((r) => {
      const o = {};
      head.forEach((k, i) => { if (k && !(k in o)) o[k] = r[i] === undefined ? "" : r[i]; });
      return o;
    });
  }

  /* الصور */
  const FALLBACK =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'><rect width='400' height='400' fill='#eef2f8'/>" +
        "<g fill='none' stroke='#c3cddb' stroke-width='10'><circle cx='200' cy='150' r='55'/></g>" +
        "<path d='M120 300 L170 230 L215 270 L260 210 L300 300 Z' fill='#c3cddb'/>" +
        "<text x='200' y='355' font-size='24' text-anchor='middle' font-family='sans-serif' fill='#93a1b5'>لا توجد صورة</text></svg>"
    );
  const isHttp = (v) => { if (!/^https?:\/\//i.test(v)) return false; try { new URL(v); return true; } catch (e) { return false; } };
  const isRelImg = (v) => !/^https?:\/\//i.test(v) && !/^\/\//.test(v) && !v.includes(":") && !v.includes("..") && /\.(png|jpe?g|webp|gif|svg)$/i.test(v);
  function parseImages(row) {
    const vals = [];
    const base = pick(row, FIELD_ALIASES.image);
    if (base !== undefined) vals.push(base);
    Object.keys(row).forEach((k) => {
      if (/^(image|img|photo|صورة|الصورة)[\s_-]*\d+$/i.test(k) && String(row[k]).trim() !== "") vals.push(row[k]);
    });
    const out = [];
    vals.forEach((raw) => String(raw).split(/[,،|؛;\n\r]+/).map((x) => x.trim()).filter(Boolean).forEach((u) => {
      if ((isHttp(u) || isRelImg(u)) && !out.includes(u)) out.push(u);
    }));
    return out;
  }
  function driveId(u) {
    const m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=|thumbnail\?(?:[^#]*&)?id=)([\w-]{10,})/);
    return m ? m[1] : null;
  }
  /* صورة بالمقاس المناسب (WebP صغيرة) بدل الصورة الأصلية الكبيرة — ده أهم سبب لسرعة الظهور */
  function imgUrl(u, w, q) {
    if (!u || u === FALLBACK || !S.imageProxy || !/^https?:\/\//i.test(u)) return u;
    const d = driveId(u);
    if (d) return `https://drive.google.com/thumbnail?id=${d}&sz=w${w}`;
    if (/^https:\/\/(wsrv\.nl|images\.weserv\.nl)\//i.test(u)) return u;
    return `https://wsrv.nl/?url=${encodeURIComponent(u)}&w=${w}&q=${q || 80}&output=webp&we`;
  }
  /* بيحمّل الصورة بالترتيب: المصغّرة ← الأصلية ← البديلة، ويرجّع أول واحدة اشتغلت */
  function loadImage(cands, done) {
    let i = 0;
    (function next() {
      if (i >= cands.length) return done(FALLBACK);
      const u = cands[i++];
      if (!u || u === FALLBACK) return done(FALLBACK);
      const im = new Image();
      im.decoding = "async";
      im.onload = () => { (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => done(u)); };
      im.onerror = next;
      im.src = u;
    })();
  }
  const cands = (u, w) => { const a = imgUrl(u, w); return a === u ? [u] : [a, u]; };
  function preload(u, w) { if (u && u !== FALLBACK) { const im = new Image(); im.decoding = "async"; im.src = imgUrl(u, w); } }

  /* المنتجات */
  function buildProducts(rows) {
    const out = [];
    const used = new Set();
    rows.forEach((row, i) => {
      try {
        const id = String(pick(row, FIELD_ALIASES.id) ?? "").trim();
        const name = String(pick(row, FIELD_ALIASES.name) ?? "").trim();
        if (!id || !name) return;
        let pcs = num(pick(row, FIELD_ALIASES.pcs));
        pcs = pcs !== null && Math.trunc(pcs) > 0 ? Math.trunc(pcs) : null;
        const piece = num(pick(row, FIELD_ALIASES.piece_price));
        const retail = num(pick(row, FIELD_ALIASES.retail_price));
        let carton = num(pick(row, FIELD_ALIASES.carton_price));
        const cup = num(pick(row, FIELD_ALIASES.carton_unit_price));
        if (carton === null && cup !== null && pcs) carton = round2(cup * pcs);
        if (piece === null && carton === null && retail === null) return;

        const rawAvail = pick(row, FIELD_ALIASES.availability);
        const available = rawAvail !== undefined && AVAILABLE.has(String(rawAvail).trim().toLowerCase());

        const badges = [];
        const rb = pick(row, FIELD_ALIASES.badge);
        if (rb !== undefined) String(rb).split(/[,،|؛;\n\r]+/).forEach((x) => { const t = x.trim().replace(/\s+/g, " ").slice(0, 24); if (t && !badges.includes(t)) badges.push(t); });
        const rf = pick(row, FIELD_ALIASES.featured);
        if (rf !== undefined && FEATURED_TRUE.has(String(rf).trim().toLowerCase()) && !badges.includes("مميز")) badges.push("مميز");

        let key = id, n = 2;
        while (used.has(key)) key = `${id}~${n++}`;
        used.add(key);

        out.push({
          key, id, name, order: i,
          category: String(pick(row, FIELD_ALIASES.category) ?? "").trim() || "أخرى",
          description: String(pick(row, FIELD_ALIASES.description) ?? "").trim(),
          images: parseImages(row),
          pcs, piece, carton, retail, available,
          badges: badges.slice(0, 2),
        });
      } catch (err) {
        console.warn(`[Data] تجاهل الصف #${i + 2}:`, err);
      }
    });
    return out;
  }
  const unitPrice = (p) => (WHOLESALE ? p.carton : p.retail !== null ? p.retail : p.piece);
  const canBuy = (p) => p.available && unitPrice(p) !== null;

  /* ------------------------------------------------------------------
     4) الحالة
  ------------------------------------------------------------------ */
  let PRODUCTS = [];
  let MAP = new Map();
  let CART = {};
  let ACTIVE_CAT = "الكل";
  let TERM = "";
  const SYNC = new Map();
  let lastCsv = null;

  function saveCart() { lsSet(K.cart, JSON.stringify(CART)); }
  function readCart() {
    try {
      const o = JSON.parse(lsGet(K.cart) || "{}");
      const r = {};
      if (o && typeof o === "object") Object.keys(o).forEach((k) => { if (Number.isFinite(Number(o[k]))) r[k] = normQty(o[k]); });
      return r;
    } catch (e) { return {}; }
  }

  /* ------------------------------------------------------------------
     5) تحميل البيانات (كاش للزيارات الجاية + تحديث في الخلفية)
  ------------------------------------------------------------------ */
  function setView(state) {
    el.loading.hidden = state !== "loading";
    el.error.hidden = state !== "error";
    el.emptyData.hidden = state !== "empty";
    el.grid.hidden = state !== "ready";
    if (state !== "ready") el.noResults.hidden = true;
  }
  let loadSeq = 0;
  async function fetchCsv() {
    const url = S.googleSheetCsvUrl;
    if (!url) throw new Error("no csv url");
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = setTimeout(() => ctl && ctl.abort(), 20000);
    try {
      const res = await fetch(url, { cache: "no-cache", signal: ctl ? ctl.signal : undefined });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.text();
    } finally { clearTimeout(timer); }
  }
  function applyCsv(text, isFresh) {
    const products = buildProducts(csvToObjects(text));
    PRODUCTS = products;
    MAP = new Map(products.map((p) => [p.key, p]));

    // استرجاع السلة: بنشيل أي صنف اتحذف أو بقى غير متوفر
    const saved = readCart();
    const kept = {};
    let dropped = 0;
    Object.keys(saved).forEach((k) => { const p = MAP.get(k); if (p && canBuy(p)) kept[k] = saved[k]; else dropped++; });
    CART = kept;
    if (dropped && isFresh) toast(`تم حذف ${dropped} صنف من الطلب لأنه لم يعد متاحًا`, "err", 3600);
    saveCart();

    buildChips();
    if (!PRODUCTS.length) { setView("empty"); updateBar(); return; }
    setView("ready");
    renderGrid();
    updateBar();
  }
  async function init() {
    const seq = ++loadSeq;
    const cached = lsGet(K.rows);
    if (cached) {
      try { applyCsv(cached, false); lastCsv = cached; } catch (e) { setView("loading"); }
    } else setView("loading");
    try {
      const fresh = await fetchCsv();
      if (seq !== loadSeq) return;
      if (fresh !== lastCsv) {
        const y = window.scrollY;
        const hadCache = lastCsv !== null;
        applyCsv(fresh, true);
        lastCsv = fresh;
        lsSet(K.rows, fresh);
        if (hadCache) { window.scrollTo(0, y); toast("تم تحديث الأصناف والأسعار", "ok"); }
      }
    } catch (err) {
      console.error("[Sheet] تعذّر تحميل الداتا:", err);
      if (lastCsv === null) setView("error");
    }
  }

  /* ------------------------------------------------------------------
     6) الأقسام + البحث
  ------------------------------------------------------------------ */
  function categoriesInfo() {
    const counts = new Map();
    PRODUCTS.forEach((p) => counts.set(p.category, (counts.get(p.category) || 0) + 1));
    return counts;
  }
  function buildChips() {
    const counts = categoriesInfo();
    const cats = ["الكل", ...counts.keys()];
    if (!cats.includes(ACTIVE_CAT)) ACTIVE_CAT = "الكل";
    el.chips.replaceChildren();
    el.catList.replaceChildren();
    cats.forEach((c) => {
      const active = c === ACTIVE_CAT;
      el.chips.appendChild(h("button", { type: "button", class: "chip" + (active ? " active" : ""), role: "tab", "aria-selected": String(active), "data-cat": c, text: c, onclick: () => selectCategory(c) }));
      const cnt = c === "الكل" ? PRODUCTS.length : counts.get(c);
      el.catList.appendChild(
        h("button", { type: "button", class: "cat-item" + (active ? " active" : ""), "data-cat": c, onclick: () => { closeTopLayer(); selectCategory(c); } },
          h("span", { class: "n", text: c === "الكل" ? "كل المنتجات" : c }), h("span", { class: "c", text: String(cnt) }), h("span", { class: "a", "aria-hidden": "true", text: "‹" }))
      );
    });
  }
  function selectCategory(c) {
    ACTIVE_CAT = c;
    TERM = "";
    el.search.value = "";
    let activeChip = null;
    [...el.chips.children].forEach((x) => { const on = x.dataset.cat === c; x.classList.toggle("active", on); x.setAttribute("aria-selected", String(on)); if (on) activeChip = x; });
    [...el.catList.children].forEach((x) => x.classList.toggle("active", x.dataset.cat === c));
    if (activeChip) activeChip.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    renderGrid();
    scrollToCatalogTop();
  }
  function scrollToCatalogTop() {
    const navH = el.navBar.offsetHeight;
    const top = $("catalog").getBoundingClientRect().top + window.scrollY - navH - 6;
    if (window.scrollY > top) window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
  }

  function normAr(s) {
    return String(s || "")
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
      .replace(/[إأآا]/g, "ا").replace(/[ً-ْٰـ]/g, "").replace(/ة/g, "ه").replace(/ى/g, "ي")
      .toLowerCase().replace(/\s+/g, " ").trim();
  }
  function relevance(p, t) {
    const id = normAr(p.id), name = normAr(p.name), cat = normAr(p.category), desc = normAr(p.description);
    if (id === t) return 100;
    if (id.includes(t)) return 80;
    if (name === t) return 70;
    if (name.includes(t)) return 60;
    if (cat.includes(t)) return 40;
    if (desc.includes(t)) return 20;
    const words = t.split(" ").filter(Boolean);
    if (words.length > 1 && words.every((w) => name.includes(w) || id.includes(w) || cat.includes(w))) return 50;
    return 0;
  }
  function filtered() {
    const t = normAr(TERM);
    if (t) {
      return PRODUCTS.map((p) => ({ p, s: relevance(p, t) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.p.order - b.p.order).map((x) => x.p);
    }
    const list = ACTIVE_CAT === "الكل" ? PRODUCTS : PRODUCTS.filter((p) => p.category === ACTIVE_CAT);
    return list.slice().sort((a, b) => a.order - b.order);
  }

  /* ------------------------------------------------------------------
     7) كارت المنتج
  ------------------------------------------------------------------ */
  const IO = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) { IO.unobserve(en.target); en.target._load && en.target._load(); } });
      }, { rootMargin: "900px 0px" })
    : null;

  const ICON_BOX = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M21 8.2 12 3 3 8.2v7.6L12 21l9-5.2V8.2Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M3.3 8.4 12 13.4l8.7-5M12 13.4V21" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>';
  const ICON_CHAT = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.2 3.6a.6.6 0 0 1-1-.46V16H6.5A2.5 2.5 0 0 1 4 13.5v-8Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
  function svgNode(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
  const waLink = (text) => `https://wa.me/${String(S.whatsappNumber).trim()}?text=${encodeURIComponent(text)}`;

  function specRow(label, value, cls) {
    return h("tr", null, h("th", { scope: "row", text: label }), h("td", { class: cls || "", text: value }));
  }

  function buildCard(p, index) {
    const images = p.images.length ? p.images : [FALLBACK];
    let cur = 0;
    let tok = 0;

    const img = h("img", { alt: p.name, decoding: "async", draggable: "false" });
    const media = h("div", { class: "media loading", tabindex: "0", role: "button", "aria-label": `تكبير صور: ${p.name}` }, img);
    const counter = images.length > 1 ? h("span", { class: "g-count", text: `1/${images.length}` }) : null;

    function show(i) {
      cur = (i + images.length) % images.length;
      const my = ++tok;
      const spin = setTimeout(() => { if (my === tok) media.classList.add("loading"); }, 140);
      loadImage(cands(images[cur], 700), (src) => {
        if (my !== tok) return;
        clearTimeout(spin);
        media.classList.remove("loading");
        img.src = src;
        img.classList.add("ready");
        img.alt = images.length > 1 ? `${p.name} — صورة ${cur + 1} من ${images.length}` : p.name;
        if (counter) counter.textContent = `${cur + 1}/${images.length}`;
        // نحمّل الصورة اللي بعدها وقبلها في الخلفية عشان التنقل يبقى لحظي
        if (images.length > 1) { preload(images[(cur + 1) % images.length], 700); preload(images[(cur - 1 + images.length) % images.length], 700); }
      });
    }
    media._load = () => show(0);
    if (index < 2 || !IO) show(0);
    else IO.observe(media);

    if (images.length > 1) {
      media.appendChild(h("button", { type: "button", class: "g-arrow prev", "aria-label": "الصورة السابقة", text: "›", onclick: (e) => { e.stopPropagation(); show(cur - 1); } }));
      media.appendChild(h("button", { type: "button", class: "g-arrow next", "aria-label": "الصورة التالية", text: "‹", onclick: (e) => { e.stopPropagation(); show(cur + 1); } }));
      media.appendChild(counter);
      let sx = 0, sy = 0, st = 0, swiped = false;
      media.addEventListener("touchstart", (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); swiped = false; }, { passive: true });
      media.addEventListener("touchend", (e) => {
        const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3 && Date.now() - st < 700) {
          swiped = true;
          show(dx < 0 ? cur + 1 : cur - 1);
          setTimeout(() => { swiped = false; }, 400);
        }
      }, { passive: true });
      media._swiped = () => swiped;
    }
    const openLB = () => { if (media._swiped && media._swiped()) return; openLightbox(images, cur, p.name, media); };
    media.addEventListener("click", openLB);
    media.addEventListener("keydown", (e) => {
      if (e.target !== media) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openLB(); }
      else if (images.length > 1 && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { e.preventDefault(); show(e.key === "ArrowLeft" ? cur + 1 : cur - 1); }
    });

    if (p.badges.length || !p.available) {
      const bs = h("div", { class: "badges" });
      if (!p.available) bs.appendChild(h("span", { class: "badge stock", text: "غير متوفر حاليًا" }));
      p.badges.forEach((b) => bs.appendChild(h("span", { class: "badge", text: b })));
      media.appendChild(bs);
    }
    const ask = h("a", {
      class: "ask-btn", href: waLink(`مرحبًا ${S.storeName}، عندي استفسار عن الصنف: ${p.name} (كود: ${p.id})`),
      target: "_blank", rel: "noopener", "aria-label": "استفسر عن الصنف عبر واتساب", title: "استفسر عن الصنف",
      onclick: (e) => e.stopPropagation(),
    });
    ask.appendChild(svgNode(ICON_CHAT));
    media.appendChild(ask);

    // جدول البيانات
    const rows = [specRow("كود المنتج", p.id, "code")];
    if (WHOLESALE) {
      rows.push(specRow("الكمية داخل الكرتونة", p.pcs ? `${p.pcs} قطعة` : "—"));
      rows.push(specRow("سعر القطعة", p.piece !== null ? money(p.piece) : "—", "price"));
      rows.push(specRow("سعر الكرتونة", p.carton !== null ? money(p.carton) : "—", "price"));
    } else {
      rows.push(specRow("القسم", p.category));
      rows.push(specRow("سعر القطعة", unitPrice(p) !== null ? money(unitPrice(p)) : "—", "price"));
    }
    const frame = h("div", { class: "card-frame" },
      media,
      h("h3", { class: "card-title", text: p.name }),
      p.description ? h("p", { class: "card-desc", text: p.description }) : null,
      h("table", { class: "spec" }, h("tbody", null, rows))
    );

    // منطقة الإضافة
    const act = h("div", { class: "card-act" });
    function sync() {
      const q = CART[p.key] || 0;
      act.replaceChildren();
      if (!canBuy(p)) {
        act.appendChild(h("button", { type: "button", class: "btn-add", disabled: true, text: p.available ? "السعر غير متاح حاليًا" : "غير متوفر حاليًا" }));
        return;
      }
      if (!q) {
        const b = h("button", { type: "button", class: "btn-add", onclick: () => setQty(p, 1, true) });
        b.appendChild(svgNode(ICON_BOX));
        b.appendChild(document.createTextNode(WHOLESALE ? "إضافة كرتونة" : "إضافة للطلب"));
        act.appendChild(b);
        return;
      }
      const input = h("input", { type: "number", min: "1", max: String(S.maxQuantity), step: "1", inputmode: "numeric", value: String(q), "aria-label": `الكمية (${UNIT_MANY})` });
      input.addEventListener("change", () => { const v = Number(input.value); setQty(p, v >= 1 ? v : 0); });
      input.addEventListener("focus", () => input.select());
      const st = h("div", { class: "stepper" },
        h("button", { type: "button", "aria-label": "زيادة", text: "+", onclick: () => setQty(p, q + 1) }),
        input,
        h("button", { type: "button", "aria-label": "تقليل", text: "−", onclick: () => setQty(p, q - 1) })
      );
      act.appendChild(st);
      const total = q * unitPrice(p);
      act.appendChild(h("p", { class: "line-note" }, `${q} ${q === 1 ? UNIT_ONE : q === 2 && !WHOLESALE ? "قطعتين" : UNIT_MANY} — إجمالي الصنف: `, h("b", { text: money(total) })));
    }
    SYNC.set(p.key, sync);
    sync();

    return h("article", { class: "card" + (p.available ? "" : " unavailable"), "data-key": p.key }, frame, act);
  }

  function setQty(p, qty, announce) {
    const q = Math.floor(Number(qty));
    if (!Number.isFinite(q) || q <= 0) delete CART[p.key];
    else CART[p.key] = normQty(q);
    saveCart();
    const f = SYNC.get(p.key);
    if (f) f();
    updateBar();
    if (announce) { warmPdfLibs(); }
    if (!reviewEl().hidden) renderReview();
  }
  const reviewEl = () => el.review;

  /* ------------------------------------------------------------------
     8) رسم الصفحة
  ------------------------------------------------------------------ */
  function sectionNode(title, items, startIndex) {
    return h("section", { class: "section" },
      h("div", { class: "section-head" },
        h("span", { class: "section-icon", "aria-hidden": "true" }, svgNode('<svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 3 3 8l9 5 9-5-9-5zM3 12.5l9 5 9-5M3 16.5l9 5 9-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>')),
        h("h2", { text: title }),
        h("span", { class: "section-count", text: String(items.length) })),
      h("div", { class: "products" }, items.map((p, i) => buildCard(p, startIndex + i))));
  }
  function groupByCategory(list) {
    const m = new Map();
    list.forEach((p) => { if (!m.has(p.category)) m.set(p.category, []); m.get(p.category).push(p); });
    return m;
  }
  function renderGrid() {
    SYNC.clear();
    const list = filtered();
    el.noResults.hidden = list.length !== 0;
    el.grid.hidden = list.length === 0;
    if (!list.length) { el.grid.replaceChildren(); return; }

    const avail = list.filter((p) => p.available);
    const unavail = list.filter((p) => !p.available);
    const frag = document.createDocumentFragment();
    let idx = 0;
    const addGroups = (arr, target) => {
      groupByCategory(arr).forEach((items, cat) => { target.appendChild(sectionNode(cat, items, idx)); idx += items.length; });
    };

    if (TERM.trim()) {
      frag.appendChild(sectionNode(`نتائج البحث`, avail.concat(unavail), 0));
    } else if (ACTIVE_CAT === "الكل") {
      addGroups(avail, frag);
      if (unavail.length) {
        const zone = h("section", { class: "unavail-zone" }, h("h2", { class: "unavail-title" }, "أصناف غير متوفرة حاليًا ", h("span", { class: "section-count", text: String(unavail.length) })));
        addGroups(unavail, zone);
        frag.appendChild(zone);
      }
    } else {
      frag.appendChild(sectionNode(ACTIVE_CAT, avail.concat(unavail), 0));
    }
    el.grid.replaceChildren(frag);
  }

  /* ------------------------------------------------------------------
     9) الطلب
  ------------------------------------------------------------------ */
  function orderLines() {
    return PRODUCTS.filter((p) => CART[p.key] && canBuy(p)).map((p) => {
      const q = CART[p.key];
      return { p, q, unit: unitPrice(p), total: round2(q * unitPrice(p)), pieces: WHOLESALE ? (p.pcs ? q * p.pcs : null) : q };
    });
  }
  function totals(lines) {
    const t = { items: lines.length, units: 0, pieces: 0, piecesKnown: true, grand: 0 };
    lines.forEach((l) => {
      t.units += l.q;
      if (l.pieces === null) t.piecesKnown = false; else t.pieces += l.pieces;
      t.grand = round2(t.grand + l.total);
    });
    return t;
  }
  function updateBar() {
    const lines = orderLines();
    const t = totals(lines);
    if (!lines.length) {
      el.bar.hidden = true;
      document.documentElement.style.setProperty("--bar-h", "0px");
      return;
    }
    el.barLine.replaceChildren(
      h("b", { text: String(t.items) }), " صنف · ", h("b", { text: String(t.units) }), ` ${t.units === 1 ? UNIT_ONE : UNIT_MANY} · الإجمالي `,
      h("span", { class: "ol-total", text: money(t.grand, true) })
    );
    el.bar.hidden = false;
    requestAnimationFrame(() => document.documentElement.style.setProperty("--bar-h", `${el.bar.offsetHeight + 12}px`));
  }
  function clearOrder() {
    if (!Object.keys(CART).length) return;
    if (!el.clearBtn._armed) {
      el.clearBtn._armed = true;
      el.clearBtn.textContent = "تأكيد الإفراغ؟";
      el.clearBtn._t = setTimeout(resetClearBtn, 3000);
      return;
    }
    resetClearBtn();
    const keys = Object.keys(CART);
    CART = {};
    saveCart();
    keys.forEach((k) => { const f = SYNC.get(k); if (f) f(); });
    updateBar();
    if (!el.review.hidden) closeTopLayer();
    toast("تم إفراغ الطلب");
  }
  function resetClearBtn() { clearTimeout(el.clearBtn._t); el.clearBtn._armed = false; el.clearBtn.textContent = "إفراغ الطلب"; }

  /* مراجعة الطلب */
  function openReview() {
    const c = JSON.parse(lsGet(K.cust) || "null");
    if (c) { if (!el.custName.value) el.custName.value = c.name || ""; if (!el.custPhone.value) el.custPhone.value = c.phone || ""; }
    renderReview();
    openLayer("review", el.review, null, el.custName);
  }
  function renderReview() {
    const lines = orderLines();
    if (!lines.length) {
      if (!el.review.hidden) closeTopLayer();
      return;
    }
    const t = totals(lines);
    el.reviewLines.replaceChildren(...lines.map((l) => {
      const p = l.p;
      const rows = [rvRow("الكود", p.id, true)];
      if (WHOLESALE) {
        rows.push(rvRow("كراتين", String(l.q)));
        rows.push(rvRow("قطع/كرتونة", p.pcs ? String(p.pcs) : "—"));
        rows.push(rvRow("سعر الكرتونة", money(l.unit, true)));
      } else {
        rows.push(rvRow("الكمية (قطع)", String(l.q)));
        rows.push(rvRow("سعر القطعة", money(l.unit, true)));
      }
      rows.push(rvRow("الإجمالي", money(l.total, true), false, true));
      const im = h("img", { alt: "", width: "78", height: "78", loading: "lazy", decoding: "async" });
      loadImage(cands(p.images[0] || FALLBACK, 160), (s) => { im.src = s; });
      return h("div", { class: "rv-line" }, im,
        h("div", { class: "rv-info" },
          h("p", { class: "rv-name", text: p.name }), rows,
          h("div", { class: "rv-ctl" },
            h("div", { class: "rv-step" },
              h("button", { type: "button", "aria-label": "زيادة", text: "+", onclick: () => setQty(p, l.q + 1) }),
              h("span", { text: String(l.q) }),
              h("button", { type: "button", "aria-label": "تقليل", text: "−", onclick: () => setQty(p, l.q - 1) })),
            h("button", { type: "button", class: "rv-del", text: "حذف", onclick: () => setQty(p, 0) }))));
    }));
    el.reviewSummary.textContent = `إجمالي ${t.items} صنف و ${t.units} ${t.units === 1 ? UNIT_ONE : UNIT_MANY}`;
    el.reviewGrand.textContent = money(t.grand, true);
  }
  function rvRow(label, value, ltr, total) {
    const b = h("b", { text: value });
    if (ltr) { b.style.direction = "ltr"; b.style.unicodeBidi = "plaintext"; }
    return h("div", { class: "rv-row" + (total ? " total" : "") }, h("span", { text: label }), b);
  }

  /* بيانات العميل */
  function normPhone(raw) {
    const s = String(raw === undefined || raw === null ? "" : raw).trim();
    if (!s) return { empty: true, valid: false, e164: "", display: "" };
    let d = s.replace(/[٠-٩]/g, (ch) => String(ch.charCodeAt(0) - 1632)).replace(/\D/g, "");
    if (d.startsWith("0020")) d = d.slice(2);
    else if (d.startsWith("0") && d.length === 11) d = "20" + d.slice(1);
    else if (d.length === 10 && d.startsWith("1")) d = "20" + d;
    const valid = /^201[0125]\d{8}$/.test(d);
    if (!valid) return { empty: false, valid: false, e164: "", display: "" };
    return { empty: false, valid: true, e164: d, display: `+${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 8)} ${d.slice(8)}` };
  }
  function customer() {
    const name = String(el.custName.value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
    return { name, phone: normPhone(el.custPhone.value) };
  }
  let showCustErrors = false;
  function paintCustHints() {
    const c = customer();
    const nameBad = showCustErrors && c.name.length < 2;
    const phoneBad = (!c.phone.empty && !c.phone.valid) || (showCustErrors && c.phone.empty);
    el.custNameHint.hidden = !nameBad;
    el.custNameHint.textContent = nameBad ? "اسم العميل / المحل مطلوب" : "";
    el.custName.classList.toggle("invalid", nameBad);
    el.custPhoneHint.hidden = !phoneBad;
    el.custPhoneHint.textContent = phoneBad ? (c.phone.empty ? "رقم الجوال مطلوب — مثال: 01012345678" : "الرقم غير صحيح — مثال: 01012345678") : "";
    el.custPhone.classList.toggle("invalid", phoneBad);
  }
  function requireCustomer() {
    const c = customer();
    if (c.name.length >= 2 && c.phone.valid) {
      lsSet(K.cust, JSON.stringify({ name: c.name, phone: el.custPhone.value.trim() }));
      return c;
    }
    showCustErrors = true;
    paintCustHints();
    toast("اكتب اسمك ورقم جوالك الأول عشان تكمل", "err", 3200);
    (c.name.length >= 2 ? el.custPhone : el.custName).focus();
    return null;
  }

  /* رقم الطلب (محلي على الجهاز) */
  const p2 = (n) => String(n).padStart(2, "0");
  let ORDER_META = null;
  function orderMeta(lines) {
    const fp = lines.map((l) => `${l.p.key}:${l.q}`).join("|");
    if (!ORDER_META || ORDER_META.fp !== fp) {
      const d = new Date();
      const stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}`;
      let seq = 0;
      try { const s = JSON.parse(lsGet(K.seq) || "null"); if (s && s.date === stamp && Number.isInteger(s.seq)) seq = s.seq; } catch (e) { seq = 0; }
      seq += 1;
      lsSet(K.seq, JSON.stringify({ date: stamp, seq }));
      ORDER_META = { fp, date: d, number: `ALR${WHOLESALE ? "W" : "R"}-${stamp}-${String(seq).padStart(4, "0")}` };
    }
    return ORDER_META;
  }
  const fmtDate = (d) => `${d.getFullYear()}/${p2(d.getMonth() + 1)}/${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;

  function buildWaMessage(lines, t, meta, c, compact) {
    const L = [];
    L.push(`*${ORDER_TITLE} — ${S.storeName}*`);
    L.push(`رقم الطلب: ${meta.number}`);
    L.push(`العميل: ${c.name}`);
    L.push(`الجوال: ${c.phone.display}`);
    L.push("────────────");
    lines.forEach((l, i) => {
      if (compact) L.push(`${i + 1}) ${l.p.id} × ${l.q}`);
      else {
        const qty = WHOLESALE ? `${l.q} كرتونة${l.pieces ? ` (${l.pieces} قطعة)` : ""}` : `${l.q} قطعة`;
        L.push(`${i + 1}) ${l.p.name}`);
        L.push(`    كود: ${l.p.id} — ${qty} × ${money(l.unit)} = ${money(l.total)}`);
      }
    });
    L.push("────────────");
    L.push(`عدد الأصناف: ${t.items}`);
    L.push(`إجمالي ${UNIT_MANY}: ${t.units}`);
    if (WHOLESALE && t.piecesKnown) L.push(`إجمالي القطع: ${t.pieces}`);
    L.push(`*الإجمالي: ${money(t.grand, true)}*`);
    return L.join("\n");
  }
  function sendWhatsapp() {
    const lines = orderLines();
    if (!lines.length) return;
    const c = requireCustomer();
    if (!c) return;
    const t = totals(lines);
    const meta = orderMeta(lines);
    let msg = buildWaMessage(lines, t, meta, c, false);
    if (encodeURIComponent(msg).length > 3600) msg = buildWaMessage(lines, t, meta, c, true);
    window.open(waLink(msg), "_blank", "noopener");
    toast("اتفتح واتساب — راجع الرسالة واضغط إرسال", "ok", 3600);
  }

  /* ------------------------------------------------------------------
     10) PDF (بيتحمّل لما نحتاجه بس)
  ------------------------------------------------------------------ */
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = res; s.onerror = () => rej(new Error("load " + src));
      document.head.appendChild(s);
    });
  }
  let pdfLibsPromise = null;
  function ensurePdfLibs() {
    if (window.html2canvas && window.jspdf) return Promise.resolve();
    if (pdfLibsPromise) return pdfLibsPromise;
    const sets = [
      ["https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js", "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"],
      ["https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js", "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"],
    ];
    pdfLibsPromise = (async () => {
      for (const set of sets) {
        try { await Promise.all(set.map(loadScript)); if (window.html2canvas && window.jspdf) return; } catch (e) { /* جرّب المصدر التاني */ }
      }
      throw new Error("pdf libs");
    })().catch((e) => { pdfLibsPromise = null; throw e; });
    return pdfLibsPromise;
  }
  let warmed = false;
  function warmPdfLibs() {
    if (warmed) return;
    warmed = true;
    (window.requestIdleCallback || ((f) => setTimeout(f, 1500)))(() => ensurePdfLibs().catch(() => { warmed = false; }));
  }

  const PAGE_W = 900, PAGE_H = Math.round((900 * 297) / 210), PAD_T = 26, PAD_B = 48, PAD_S = 24, CONTENT_W = PAGE_W - PAD_S * 2;
  function injectPdfCss() {
    if ($("pdfStyles")) return;
    const s = h("style", { id: "pdfStyles" });
    s.textContent = `
.pdf-page{position:relative;box-sizing:border-box;width:${PAGE_W}px;height:${PAGE_H}px;padding:${PAD_T}px ${PAD_S}px ${PAD_B}px;background:#fff;color:#1c2a3c;direction:rtl;text-align:right;font-family:'Cairo','Tajawal',Arial,sans-serif;overflow:hidden;line-height:1.5;}
.pdf-page *{box-sizing:border-box;}
.pdf-page.pdf-measure{height:auto;overflow:visible;}
.pdf-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:14px;border-bottom:3px solid #13325f;}
.pdf-brand{display:flex;align-items:center;gap:14px;}
.pdf-brand img{width:64px;height:64px;border-radius:16px;}
.pdf-brand b{display:block;font-size:30px;font-weight:800;color:#13325f;line-height:1.15;}
.pdf-brand small{display:block;font-family:'Montserrat',Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:.18em;color:#118262;margin-top:2px;}
.pdf-brand span{display:block;font-size:14px;color:#6b7a8d;}
.pdf-meta{min-width:290px;font-size:14px;line-height:1.9;}
.pdf-meta div{display:flex;gap:10px;justify-content:space-between;}
.pdf-meta span{color:#6b7a8d;}
.pdf-meta b{font-weight:700;}
.pdf-title{margin:14px 0 0;font-size:18px;font-weight:800;color:#13325f;}
.pdf-table-wrap{margin-top:12px;}
.pdf-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:14px;}
.pdf-table th{background:#13325f;color:#fff;font-weight:800;font-size:13px;padding:9px 4px;text-align:center;line-height:1.3;}
.pdf-table td{padding:6px 5px;border-bottom:1px solid #dde4ee;text-align:center;vertical-align:middle;font-weight:600;overflow-wrap:anywhere;word-break:break-word;}
.pdf-table td.n{text-align:right;font-weight:700;}
.pdf-table td.c{direction:ltr;unicode-bidi:plaintext;font-size:12px;color:#6b7a8d;}
.pdf-table td.t{font-weight:800;white-space:nowrap;}
.pdf-thumb{display:block;width:54px;height:54px;margin:0 auto;object-fit:cover;border-radius:8px;background:#f1f4f9;border:1px solid #e3e9f2;}
.pdf-sum{width:340px;margin:18px auto 0 0;border:1px solid #dde4ee;border-radius:10px;overflow:hidden;}
.pdf-sum div{display:flex;justify-content:space-between;gap:10px;padding:9px 14px;font-size:15px;border-bottom:1px solid #eef1f6;}
.pdf-sum div:last-child{background:#13325f;color:#fff;font-weight:800;font-size:17px;border-bottom:none;}
.pdf-note{margin:16px 0 0;font-size:12px;color:#6b7a8d;line-height:1.8;}
.pdf-foot{position:absolute;left:0;right:0;bottom:16px;text-align:center;font-size:12px;color:#6b7a8d;}`;
    document.head.appendChild(s);
  }
  const pe = (tag, cls, text) => h(tag, cls ? { class: cls } : null, text == null ? null : String(text));
  const thumbCache = new Map();
  function thumb(u) {
    if (!u || u === FALLBACK) return Promise.resolve(null);
    if (thumbCache.has(u)) return thumbCache.get(u);
    const p = new Promise((resolve) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      const timer = setTimeout(() => { im.onload = im.onerror = null; resolve(null); }, 6000);
      im.onload = () => {
        clearTimeout(timer);
        try {
          const Z = 200, c = document.createElement("canvas");
          c.width = Z; c.height = Z;
          const x = c.getContext("2d");
          x.fillStyle = "#fff"; x.fillRect(0, 0, Z, Z);
          const side = Math.min(im.naturalWidth, im.naturalHeight) || Z;
          x.drawImage(im, (im.naturalWidth - side) / 2, (im.naturalHeight - side) / 2, side, side, 0, 0, Z, Z);
          resolve(c.toDataURL("image/jpeg", 0.82));
        } catch (e) { resolve(null); }
      };
      im.onerror = () => { clearTimeout(timer); resolve(null); };
      im.src = imgUrl(u, 140);
    });
    thumbCache.set(u, p);
    return p;
  }
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  async function waitFonts() {
    if (!document.fonts || !document.fonts.load) return;
    try {
      await Promise.race([Promise.all(["600 14px Cairo", "700 14px Cairo", "800 14px Cairo", "800 30px Cairo", "700 12px Montserrat"].map((f) => document.fonts.load(f, "اAa1"))), new Promise((r) => setTimeout(r, 2500))]);
      await document.fonts.ready;
    } catch (e) { /* نكمل */ }
  }

  function pdfParts(lines, t, meta, c, thumbs) {
    const head = pe("div", "pdf-head");
    const logo = h("img", { src: "logo.svg", alt: "" });
    const brand = pe("div", "pdf-brand");
    brand.append(logo, h("div", null, pe("b", null, S.storeName), pe("small", null, "AL-IRAQI STORE"), pe("span", null, WHOLESALE ? "كتالوج الجملة" : "كتالوج القطاعي")));
    const metaBox = pe("div", "pdf-meta");
    const addMeta = (l, v, ltr) => { const b = pe("b", null, v); if (ltr) { b.style.direction = "ltr"; b.style.unicodeBidi = "isolate"; } metaBox.appendChild(h("div", null, pe("span", null, l), b)); };
    addMeta("رقم الطلب", meta.number, true);
    addMeta("التاريخ", fmtDate(meta.date), true);
    addMeta("العميل", c.name);
    addMeta("الجوال", c.phone.display, true);
    head.append(brand, metaBox);

    const cols = [{ h: "الصورة", w: 74 }, { h: "الصنف", w: 0 }, { h: "الكود", w: 110 }];
    if (WHOLESALE) { cols.push({ h: "كراتين", w: 66 }, { h: "قطع/كرتونة", w: 84 }, { h: "سعر الكرتونة", w: 102 }); }
    else cols.push({ h: "الكمية", w: 70 }, { h: "سعر القطعة", w: 102 });
    cols.push({ h: "الإجمالي", w: 116 });
    cols[1].w = Math.max(150, CONTENT_W - cols.reduce((s, x) => s + x.w, 0));

    const thead = document.createElement("thead");
    const hr = document.createElement("tr");
    cols.forEach((x) => hr.appendChild(pe("th", null, x.h)));
    thead.appendChild(hr);

    const rows = lines.map((l, i) => {
      const tr = document.createElement("tr");
      const td0 = document.createElement("td");
      const im = h("img", { class: "pdf-thumb", alt: "", src: thumbs[i] || FALLBACK });
      td0.appendChild(im);
      tr.appendChild(td0);
      tr.appendChild(pe("td", "n", l.p.name));
      tr.appendChild(pe("td", "c", l.p.id));
      if (WHOLESALE) {
        tr.appendChild(pe("td", null, l.q));
        tr.appendChild(pe("td", null, l.p.pcs ? l.p.pcs : "—"));
        tr.appendChild(pe("td", null, money(l.unit)));
      } else {
        tr.appendChild(pe("td", null, l.q));
        tr.appendChild(pe("td", null, money(l.unit)));
      }
      tr.appendChild(pe("td", "t", money(l.total)));
      return tr;
    });

    const sum = pe("div", "pdf-sum");
    const addSum = (l, v) => sum.appendChild(h("div", null, pe("span", null, l), pe("b", null, v)));
    addSum("إجمالي الأصناف", t.items);
    addSum(`إجمالي ${UNIT_MANY}`, t.units);
    if (WHOLESALE && t.piecesKnown) addSum("إجمالي القطع", t.pieces);
    addSum("الإجمالي النهائي", money(t.grand, true));
    const note = pe("p", "pdf-note", "بيان طلب مبدئي — الأسعار والتوفر خاضعة لتأكيد المتجر. رقم الطلب محلي على هذا الجهاز فقط.");
    return { head, cols, thead, rows, sum, note };
  }
  function tableShell(cols) {
    const tb = pe("table", "pdf-table");
    const cg = document.createElement("colgroup");
    cols.forEach((x) => { const col = document.createElement("col"); col.style.width = x.w + "px"; cg.appendChild(col); });
    tb.appendChild(cg);
    return tb;
  }
  function planPages(stage, parts) {
    const { head, cols, thead, rows, sum, note } = parts;
    const box = pe("div", "pdf-page pdf-measure");
    const wrap = pe("div", "pdf-table-wrap");
    const table = tableShell(cols);
    const tbody = document.createElement("tbody");
    table.append(thead, tbody);
    rows.forEach((r) => tbody.appendChild(r));
    wrap.appendChild(table);
    box.append(head, wrap, sum, note);
    stage.appendChild(box);
    const R = (e) => e.getBoundingClientRect();
    const headBlock = R(wrap).top - R(head).top;
    const theadH = R(thead).height;
    const rowH = rows.map((r) => R(r).height + 0.5);
    const tailH = R(note).bottom - R(table).bottom + 2;
    box.remove();
    rows.forEach((r) => r.remove());
    const avail = PAGE_H - PAD_T - PAD_B - 6;
    const pages = [];
    let cur = { first: true, rows: [], tail: false };
    let used = headBlock + theadH;
    rowH.forEach((hh, i) => {
      if (used + hh > avail && cur.rows.length) { pages.push(cur); cur = { first: false, rows: [], tail: false }; used = theadH; }
      cur.rows.push(i); used += hh;
    });
    if (used + tailH <= avail) { cur.tail = true; pages.push(cur); }
    else if (cur.rows.length > 1) { const m = cur.rows.pop(); pages.push(cur); pages.push({ first: false, rows: [m], tail: true }); }
    else { pages.push(cur); pages.push({ first: false, rows: [], tail: true }); }
    return pages;
  }
  function assemble(parts, spec, idx, total, meta) {
    const page = pe("div", "pdf-page");
    if (spec.first) page.appendChild(parts.head.cloneNode(true));
    if (spec.rows.length) {
      const wrap = pe("div", "pdf-table-wrap");
      if (!spec.first) wrap.style.marginTop = "0";
      const tb = tableShell(parts.cols);
      tb.appendChild(parts.thead.cloneNode(true));
      const body = document.createElement("tbody");
      spec.rows.forEach((i) => body.appendChild(parts.rows[i].cloneNode(true)));
      tb.appendChild(body);
      wrap.appendChild(tb);
      page.appendChild(wrap);
    }
    if (spec.tail) { page.appendChild(parts.sum.cloneNode(true)); page.appendChild(parts.note.cloneNode(true)); }
    page.appendChild(pe("div", "pdf-foot", `صفحة ${idx + 1} من ${total} — ${meta.number}`));
    return page;
  }
  function setBusy(on, text) { el.busy.hidden = !on; if (text) el.busyText.textContent = text; }

  async function exportPdf() {
    const lines = orderLines();
    if (!lines.length) return;
    const c = requireCustomer();
    if (!c) return;
    el.pdfBtn.disabled = true;
    try {
      setBusy(true, "جاري تجهيز الملف…");
      await ensurePdfLibs();
      const t = totals(lines);
      const meta = orderMeta(lines);
      const thumbs = await Promise.all(lines.map((l) => thumb(l.p.images[0])));
      injectPdfCss();
      await waitFonts();
      const stage = h("div", { style: `position:fixed;left:-99999px;top:0;width:${PAGE_W}px;pointer-events:none;` });
      document.body.appendChild(stage);
      try {
        const parts = pdfParts(lines, t, meta, c, thumbs);
        const plan = planPages(stage, parts);
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
        const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
        for (let i = 0; i < plan.length; i++) {
          setBusy(true, plan.length > 1 ? `جاري رسم صفحة ${i + 1} من ${plan.length}…` : "جاري رسم الفاتورة…");
          await nextFrame();
          const page = assemble(parts, plan[i], i, plan.length, meta);
          stage.appendChild(page);
          let canvas = null;
          for (const scale of [3, 2, 1.5]) {
            try {
              canvas = await window.html2canvas(page, { scale, useCORS: true, backgroundColor: "#ffffff", windowWidth: PAGE_W, width: PAGE_W, height: PAGE_H, logging: false, imageTimeout: 4000, ignoreElements: (n) => n.parentNode === document.body && n !== stage });
              break;
            } catch (err) { canvas = null; }
          }
          if (!canvas) { page.querySelectorAll("img").forEach((x) => x.remove()); canvas = await window.html2canvas(page, { scale: 2, backgroundColor: "#ffffff", windowWidth: PAGE_W, logging: false }); }
          page.remove();
          if (i > 0) pdf.addPage();
          pdf.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", 0, 0, pw, ph, undefined, "FAST");
          canvas.width = canvas.height = 0;
        }
        setBusy(true, "جاري حفظ الملف…");
        const blob = pdf.output("blob");
        const url = URL.createObjectURL(blob);
        const a = h("a", { href: url, download: `${meta.number}.pdf`, rel: "noopener" });
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        toast("تم تحميل ملف الطلب PDF ✓", "ok", 3200);
      } finally { stage.remove(); }
    } catch (err) {
      console.error("[PDF]", err);
      toast("تعذّر إنشاء ملف PDF — تأكد من الإنترنت وجرّب تاني", "err", 4200);
    } finally {
      setBusy(false);
      el.pdfBtn.disabled = false;
    }
  }

  /* ------------------------------------------------------------------
     11) الملاحظات والتعليقات
  ------------------------------------------------------------------ */
  function openFeedback() {
    el.fbNote.textContent = "";
    openLayer("feedback", el.fbSheet, null, el.fbMsg);
  }
  async function submitFeedback(e) {
    e.preventDefault();
    if (el.fbWebsite.value) return; // فخ للبوتات
    const msg = el.fbMsg.value.trim();
    if (msg.length < 3) {
      el.fbMsgHint.hidden = false; el.fbMsgHint.textContent = "اكتب رسالتك الأول (3 حروف على الأقل)";
      el.fbMsg.classList.add("invalid"); el.fbMsg.focus(); return;
    }
    el.fbMsgHint.hidden = true; el.fbMsg.classList.remove("invalid");
    const last = Number(lsGet(K.fbLast) || 0);
    if (Date.now() - last < 20000) { el.fbNote.textContent = "استنى ثواني قبل إرسال ملاحظة تانية"; return; }
    const type = (el.fbForm.querySelector('input[name="fbType"]:checked') || {}).value || "أخرى";
    const payload = {
      time: new Date().toISOString(), site: S.mode === "retail" ? "قطاعي" : "جملة", type, message: msg,
      name: el.fbName.value.trim().slice(0, 60), phone: el.fbPhone.value.trim().slice(0, 20),
      page: location.href.slice(0, 200), agent: navigator.userAgent.slice(0, 140),
    };
    el.fbSend.disabled = true;
    el.fbNote.textContent = "جاري الإرسال…";
    const viaWhatsapp = () => {
      const text = `*${type} على الموقع (${payload.site})*\n${msg}${payload.name ? `\nالاسم: ${payload.name}` : ""}${payload.phone ? `\nالجوال: ${payload.phone}` : ""}`;
      window.open(waLink(text), "_blank", "noopener");
    };
    try {
      if (S.feedbackEndpoint) {
        await fetch(S.feedbackEndpoint, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
        lsSet(K.fbLast, String(Date.now()));
        el.fbForm.reset();
        closeTopLayer();
        toast("وصلتنا ملاحظتك — شكرًا ليك 🙏", "ok", 3600);
      } else {
        lsSet(K.fbLast, String(Date.now()));
        viaWhatsapp();
        el.fbForm.reset();
        closeTopLayer();
        toast("كمّل الإرسال من واتساب", "ok", 3200);
      }
    } catch (err) {
      el.fbNote.textContent = "تعذّر الإرسال. تقدر تبعتها لنا على واتساب:";
      el.fbNote.appendChild(h("button", { type: "button", class: "btn-outline", style: "margin-top:8px;width:100%", text: "إرسال عبر واتساب", onclick: viaWhatsapp }));
    } finally { el.fbSend.disabled = false; }
  }

  /* ------------------------------------------------------------------
     12) تكبير الصورة
  ------------------------------------------------------------------ */
  let LB = { images: [], i: 0, tok: 0 };
  function lbRender() {
    const u = LB.images[LB.i];
    const my = ++LB.tok;
    const small = imgUrl(u, 700);
    // بنعرض نسخة الكارت (متخزنة في الكاش) فورًا وبعدها نبدّلها بالنسخة الكبيرة لما تخلص
    el.lbImg.src = small;
    el.lbImg.onerror = () => { el.lbImg.onerror = null; el.lbImg.src = u === FALLBACK ? FALLBACK : u; };
    const big = imgUrl(u, 1400, 85);
    if (big !== small) {
      const im = new Image();
      im.onload = () => { if (my === LB.tok) el.lbImg.src = big; };
      im.src = big;
    }
    const multi = LB.images.length > 1;
    el.lbPrev.hidden = !multi; el.lbNext.hidden = !multi;
    el.lbCounter.textContent = `${LB.i + 1}/${LB.images.length}`;
    if (multi) { preload(LB.images[(LB.i + 1) % LB.images.length], 1000); preload(LB.images[(LB.i - 1 + LB.images.length) % LB.images.length], 1000); }
  }
  function openLightbox(images, start, name) {
    LB = { images, i: start || 0, tok: 0 };
    el.lb.setAttribute("aria-label", `تكبير صورة: ${name}`);
    lbRender();
    openLayer("lightbox", el.lb, null, el.lbClose);
  }
  const lbGo = (n) => { if (LB.images.length < 2) return; LB.i = (n + LB.images.length) % LB.images.length; lbRender(); };
  let lx = 0, ly = 0, lt = 0;
  el.lb.addEventListener("touchstart", (e) => { const t = e.touches[0]; lx = t.clientX; ly = t.clientY; lt = Date.now(); }, { passive: true });
  el.lb.addEventListener("touchend", (e) => {
    const t = e.changedTouches[0], dx = t.clientX - lx, dy = t.clientY - ly;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.3 && Date.now() - lt < 700) lbGo(dx < 0 ? LB.i + 1 : LB.i - 1);
  }, { passive: true });
  el.lb.addEventListener("click", (e) => { if (e.target === el.lb) closeTopLayer(); });
  el.lbClose.addEventListener("click", closeTopLayer);
  el.lbPrev.addEventListener("click", () => lbGo(LB.i - 1));
  el.lbNext.addEventListener("click", () => lbGo(LB.i + 1));
  document.addEventListener("keydown", (e) => {
    if (el.lb.hidden) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); lbGo(LB.i + 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); lbGo(LB.i - 1); }
  });

  /* ------------------------------------------------------------------
     13) رسالة الترحيب
  ------------------------------------------------------------------ */
  function maybeWelcome() {
    const today = new Date().toISOString().slice(0, 10);
    if (!S.welcomeEveryVisit && lsGet(K.welcome) === today) return;
    if (S.welcomeBannerImage) {
      el.welcomeArt.replaceChildren(h("img", { src: S.welcomeBannerImage, alt: "", style: "width:100%;height:auto;border-radius:0;box-shadow:none;" }));
      el.welcomeArt.style.padding = "0";
    }
    setTimeout(() => {
      if (LAYERS.length) return;
      lsSet(K.welcome, today);
      openLayer("welcome", el.welcome, null, el.welcome.querySelector(".welcome-card"));
    }, 450);
  }

  /* ------------------------------------------------------------------
     14) ربط الأحداث
  ------------------------------------------------------------------ */
  if (/^\d{8,15}$/.test(String(S.whatsappNumber).trim())) el.waFab.href = waLink(`مرحبًا ${S.storeName}، عندي استفسار.`);
  else el.waFab.hidden = true;

  let st;
  el.search.addEventListener("input", () => { clearTimeout(st); st = setTimeout(() => { TERM = el.search.value; renderGrid(); if (TERM) scrollToCatalogTop(); }, 180); });
  el.searchForm.addEventListener("submit", (e) => { e.preventDefault(); clearTimeout(st); TERM = el.search.value; renderGrid(); scrollToCatalogTop(); el.search.blur(); });
  el.reset.addEventListener("click", () => { TERM = ""; ACTIVE_CAT = "الكل"; el.search.value = ""; buildChips(); renderGrid(); });
  el.retry.addEventListener("click", () => { setView("loading"); init(); });
  el.catBtn.addEventListener("click", () => {
    const a = el.catList.querySelector(".cat-item.active");
    openLayer("cats", el.catSheet, null, null);
    requestAnimationFrame(() => a && a.scrollIntoView({ block: "center" }));
  });
  el.reviewBtn.addEventListener("click", openReview);
  el.clearBtn.addEventListener("click", clearOrder);
  el.sendWa.addEventListener("click", sendWhatsapp);
  el.pdfBtn.addEventListener("click", exportPdf);
  el.custName.addEventListener("input", paintCustHints);
  el.custPhone.addEventListener("input", paintCustHints);
  el.fbBtn.addEventListener("click", openFeedback);
  el.fbBtn2.addEventListener("click", openFeedback);
  el.fbForm.addEventListener("submit", submitFeedback);
  el.fbMsg.addEventListener("input", () => { el.fbMsgHint.hidden = true; el.fbMsg.classList.remove("invalid"); });
  el.welcomeGo.addEventListener("click", closeTopLayer);
  el.top.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; el.top.classList.toggle("show", window.scrollY > 600); });
  }, { passive: true });
  window.addEventListener("resize", () => { if (!el.bar.hidden) document.documentElement.style.setProperty("--bar-h", `${el.bar.offsetHeight + 12}px`); });

  window.__aliraqi = { get products() { return PRODUCTS; }, get cart() { return CART; } };
  maybeWelcome();
  init();
})();
