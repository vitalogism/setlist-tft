(() => {
  "use strict";

  const D = window.SET_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const view = $("#view");

  /* ---------- helpers ---------- */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const RED = "\u0001";
  // Escape, then mark missing numbers and redactions.
  const fmt = (s) => esc(s)
    .replace(/\bX\b/g, '<span class="num" title="Not in the preview data yet">X</span>')
    .split(RED).join('<span class="redact">hidden</span>');
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable: progress lasts this visit */ } },
  };

  const ICONS = {
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M9.9 4.2A10 10 0 0 1 12 4c7 0 10 8 10 8a13 13 0 0 1-1.7 2.7"/><path d="M6.6 6.6A13.5 13.5 0 0 0 2 12s3 8 10 8a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m2 2 20 20"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    flip: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    swap: '<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  };
  const icon = (n) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

  /* ---------- data ---------- */
  const units = D.units;
  const unitById = Object.fromEntries(units.map((u) => [u.id, u]));
  // Seraphine's Rising Star / Superstar repeat the Indie text; keep one.
  const traits = D.traits.filter((t) => !["DA_19_RisingStar", "DA_19_Superstar"].includes(t.id));
  const traitByName = Object.fromEntries(traits.map((t) => [t.name, t]));
  const fieldable = units.filter((u) => u.traits.length);

  const TOPICS = {
    unlocks: { items: units.filter((u) => u.unlock), noun: "unlocks" },
    traits: { items: traits, noun: "traits" },
    abilities: { items: units.filter((u) => u.ability.desc), noun: "abilities" },
  };
  const byId = (tab, id) => TOPICS[tab].items.find((x) => x.id === id);

  // Hide a champion's own name inside a clue that would give it away.
  function hideUnit(text, u) {
    const parts = new Set([u.name]);
    u.name.split(/[\s&.]+/).forEach((w) => w.length >= 4 && parts.add(w));
    const alts = [...parts].sort((a, b) => b.length - a.length).map(reEsc).join("|");
    return text.replace(new RegExp(`(?<![\\w'])(?:${alts})(?:'s)?(?![\\w])`, "g"), RED);
  }
  function hideTrait(text, t) {
    const n = reEsc(t.name);
    const forms = [n + "s?"];
    if (/man$/.test(t.name)) forms.push(reEsc(t.name.replace(/man$/, "men")));
    if (/y$/.test(t.name)) forms.push(reEsc(t.name.replace(/y$/, "ies")));
    return text.replace(new RegExp(`(?<![\\w])(?:${forms.join("|")})(?![\\w])`, "gi"), RED);
  }

  /* ---------- progress ---------- */
  const MAX = 3, LEARNED = 2;
  const progress = store.get("setlist.progress", {});
  for (const k in TOPICS) progress[k] = progress[k] || {};
  const level = (tab, id) => progress[tab][id] || 0;
  function setLevel(tab, id, v) { progress[tab][id] = Math.max(0, Math.min(MAX, v)); store.set("setlist.progress", progress); updateMeters(); }
  const learned = (tab) => TOPICS[tab].items.filter((x) => level(tab, x.id) >= LEARNED).length;

  function updateMeters() {
    for (const tab in TOPICS) {
      const el = $(`[data-progress="${tab}"]`);
      el.textContent = `${learned(tab)} of ${TOPICS[tab].items.length} learned`;
    }
    const n = learned(state.tab), total = TOPICS[state.tab].items.length;
    $("#meter-fill").style.width = `${(n / total) * 100}%`;
    $("#meter-text").textContent = `${n} / ${total} learned`;
  }
  // Least-known first, shuffled within a band so rounds don't repeat in order.
  const weighted = (tab, items) => items.map((x) => [level(tab, x.id) + Math.random() * 1.2, x]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);

  /* ---------- building blocks ---------- */
  const initials = (name) => name.replace(/[^A-Za-z ]/g, "").split(" ").map((w) => w[0]).join("").slice(0, 2);
  const portrait = (u, extra = "") => `<div class="portrait cost-${u.cost} ${extra}"><img src="${u.img}" alt="" loading="lazy" data-fb="${esc(initials(u.name))}"></div>`;
  const traitIcon = (t) => `<div class="trait-icon"><img src="${t.icon}" alt="" loading="lazy" data-fb="${esc(initials(t.name))}"></div>`;
  const costTag = (u) => `<span class="cost cost-${u.cost}">${u.cost}-cost</span>`;
  const traitPills = (u) => u.traits.map((t) => `<span class="trait-pill">${esc(t)}</span>`).join("");
  const breaks = (t) => t.breakpoints.length ? `<span class="breaks" aria-label="Breakpoints">${t.breakpoints.map((b) => `<span>${b}</span>`).join("")}</span>` : "";
  const levelBars = (tab, id) => { const l = level(tab, id); return `<span class="level" title="Recall ${l}/${MAX}">${[1, 2, 3].map((i) => `<i class="${i <= l ? "on" : ""}"></i>`).join("")}</span>`; };
  const steps = (list, text = fmt) => list.length > 1 ? `<ol>${list.map((c) => `<li>${text(c)}</li>`).join("")}</ol>` : `<p class="face-text">${text(list[0])}</p>`;
  const members = (t) => t.units.map((id) => unitById[id]).filter(Boolean)
    .map((u) => `<span class="member cost-${u.cost}" style="--cc:var(--c${u.cost === 7 ? 1 : u.cost})"><img src="${u.img}" alt="" loading="lazy" data-fb="">${esc(u.name)}</span>`).join("");

  // Broken image: swap for initials so layout holds.
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (img.tagName !== "IMG" || img.dataset.fb == null) return;
    const s = document.createElement("span");
    s.className = img.classList.contains("opt-img") ? "opt-img fallback" : "fallback";
    s.textContent = img.dataset.fb;
    img.replaceWith(s);
  }, true);

  /* ---------- state ---------- */
  const saved = store.get("setlist.ui", {});
  const state = {
    tab: TOPICS[saved.tab] ? saved.tab : "unlocks",
    mode: ["study", "cards", "quiz"].includes(saved.mode) ? saved.mode : "study",
    study: {}, cards: {}, quiz: {},
  };
  const [hTab, hMode] = location.hash.slice(1).split("/");
  if (TOPICS[hTab]) state.tab = hTab;
  if (["study", "cards", "quiz"].includes(hMode)) state.mode = hMode;

  function go(tab, mode) {
    state.tab = tab; state.mode = mode;
    store.set("setlist.ui", { tab, mode });
    history.replaceState(null, "", `#${tab}/${mode}`);
    $$(".tab").forEach((b) => { const on = b.dataset.tab === tab; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; });
    $$(".mode").forEach((b) => b.setAttribute("aria-checked", b.dataset.mode === mode));
    $("#stage").setAttribute("aria-labelledby", `tab-${tab}`);
    updateMeters();
    ({ study: renderStudy, cards: renderCards, quiz: renderQuiz })[mode]();
  }

  /* ---------- STUDY ---------- */
  function renderStudy() {
    const tab = state.tab;
    const s = (state.study[tab] = state.study[tab] || { q: "", filter: null, covered: false });
    const chipVals = tab === "traits"
      ? ["Band", "Origin", "Class", "Unique"].filter((t) => traits.some((x) => x.type === t))
      : [...new Set(TOPICS[tab].items.map((u) => u.cost))].sort((a, b) => a - b);
    const chipLabel = (v) => tab === "traits" ? v : `<span class="cost cost-${v}">${v}</span>`;
    const placeholder = { unlocks: "Search champions or conditions", traits: "Search traits or champions", abilities: "Search champions or abilities" }[tab];

    view.innerHTML = `
      <div class="filters">
        <label class="search">${icon("search")}<input type="search" placeholder="${placeholder}" value="${esc(s.q)}" aria-label="${placeholder}"></label>
        ${chipVals.map((v) => `<button class="chip" data-f="${v}" aria-pressed="${s.filter == v}">${chipLabel(v)}</button>`).join("")}
        <span class="spacer"></span>
        <button class="chip" id="cover" aria-pressed="${s.covered}">${icon(s.covered ? "eyeOff" : "eye")}${s.covered ? "Answers covered" : "Cover answers"}</button>
      </div>
      <div class="list ${s.covered ? "covered" : ""}" id="list"></div>`;

    const drawList = () => {
      const q = s.q.trim().toLowerCase();
      const rows = TOPICS[tab].items.filter((x) => {
        if (s.filter != null && String(tab === "traits" ? x.type : x.cost) !== String(s.filter)) return false;
        if (!q) return true;
        const hay = tab === "traits"
          ? [x.name, x.desc, ...x.units.map((id) => unitById[id]?.name || "")]
          : [x.name, ...x.traits, tab === "unlocks" ? x.unlock.join(" ") : `${x.ability.name} ${x.ability.desc}`];
        return hay.join(" ").toLowerCase().includes(q);
      });
      $("#list").innerHTML = rows.length ? rows.map((x) => studyRow(tab, x)).join("") : `<p class="empty">Nothing matches “${esc(s.q)}”.</p>`;
    };
    drawList();

    $(".search input", view).addEventListener("input", (e) => { s.q = e.target.value; drawList(); });
    $$(".chip[data-f]", view).forEach((b) => b.addEventListener("click", () => {
      s.filter = s.filter == b.dataset.f ? null : b.dataset.f;
      $$(".chip[data-f]", view).forEach((c) => c.setAttribute("aria-pressed", s.filter == c.dataset.f));
      drawList();
    }));
    $("#cover").addEventListener("click", () => { s.covered = !s.covered; renderStudy(); });
    $("#list").addEventListener("click", (e) => {
      const a = e.target.closest(".row-answer");
      if (a && s.covered) a.classList.toggle("peek");
    });
    $("#list").addEventListener("keydown", (e) => {
      const a = e.target.closest(".row-answer");
      if (a && s.covered && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); a.classList.toggle("peek"); }
    });
  }

  function studyRow(tab, x) {
    const cover = state.study[tab].covered ? 'tabindex="0" role="button" aria-label="Reveal answer"' : "";
    if (tab === "traits") {
      return `<div class="row">
        ${traitIcon(x)}
        <div class="row-who"><span class="row-name">${esc(x.name)}</span><span class="row-sub">${esc(x.type)} ${breaks(x)}</span></div>
        <div class="row-answer" ${cover}><div><p>${fmt(x.desc)}</p>${x.units.length ? `<div class="members">${members(x)}</div>` : ""}</div></div>
        ${levelBars(tab, x.id)}
      </div>`;
    }
    const answer = tab === "unlocks"
      ? (x.unlock.length > 1 ? `<ol>${x.unlock.map((c) => `<li>${fmt(c)}</li>`).join("")}</ol>` : `<div>${fmt(x.unlock[0])}</div>`)
      : `<div><span class="ability-name">${esc(x.ability.name)}</span><p>${fmt(x.ability.desc)}</p></div>`;
    return `<div class="row">
      ${portrait(x)}
      <div class="row-who"><span class="row-name">${esc(x.name)}</span><span class="row-sub">${costTag(x)} ${traitPills(x)}</span></div>
      <div class="row-answer" ${cover}>${answer}</div>
      ${levelBars(tab, x.id)}
    </div>`;
  }

  /* ---------- FLASHCARDS ---------- */
  const DIRS = {
    unlocks: ["Champion → how to unlock", "Condition → champion"],
    traits: ["Trait → what it does", "Effect → trait"],
    abilities: ["Champion → ability", "Ability → champion"],
  };
  const ROUND = 15;

  function newRound(tab, c) {
    c.queue = weighted(tab, TOPICS[tab].items).slice(0, ROUND).map((x) => x.id);
    c.size = c.queue.length; c.done = 0; c.got = 0; c.again = 0; c.flipped = false;
  }

  function faces(tab, x, dir) {
    const art = (u, body) => `<div class="face-art"><img src="${u.img}" alt="" data-fb=""></div><div class="face-body">${body}</div>`;
    const text = (body) => `<div class="face-body">${body}</div>`;
    const champBody = (u, q) => `<span class="row-sub">${costTag(u)} ${traitPills(u)}</span><h2 class="face-title">${esc(u.name)}</h2>${q ? `<span class="face-q">${q}</span>` : ""}`;

    if (tab === "unlocks") {
      const cond = steps(x.unlock);
      const hidden = steps(x.unlock, (c) => fmt(hideUnit(c, x)));
      return dir === 0
        ? { front: ["art", art(x, champBody(x, "How do you unlock this champion?"))], back: ["text", text(`<span class="face-q">${icon("lock")} Unlock ${esc(x.name)}</span>${cond}`)] }
        : { front: ["text", text(`<span class="face-q">Whose unlock condition is this?</span>${hidden}`)], back: ["art", art(x, champBody(x))] };
    }
    if (tab === "abilities") {
      const ab = `<span class="face-q">${esc(x.name)}’s ability</span><h2 class="face-title">${esc(x.ability.name)}</h2><p class="face-text small">${fmt(x.ability.desc)}</p>`;
      return dir === 0
        ? { front: ["art", art(x, champBody(x, "What does their ability do?"))], back: ["text", text(ab)] }
        : { front: ["text", text(`<span class="face-q">Whose ability is this?</span><h2 class="face-title">${fmt(hideUnit(x.ability.name, x))}</h2><p class="face-text small">${fmt(hideUnit(x.ability.desc, x))}</p>`)], back: ["art", art(x, champBody(x))] };
    }
    const head = `<div class="face-head">${traitIcon(x)}<div><span class="row-sub">${esc(x.type)} ${breaks(x)}</span><h2 class="face-title">${esc(x.name)}</h2></div></div>`;
    const full = `${head}<p class="face-text">${fmt(x.desc)}</p>${x.units.length ? `<div class="members">${members(x)}</div>` : ""}`;
    return dir === 0
      ? { front: ["text", text(`${head}<span class="face-q">What does it do, and who has it?</span>`)], back: ["text", text(full)] }
      : { front: ["text", text(`<span class="face-q">Which trait is this?</span><p class="face-text">${fmt(hideTrait(x.desc, x))}</p>`)], back: ["text", text(full)] };
  }

  function renderCards() {
    const tab = state.tab;
    const c = (state.cards[tab] = state.cards[tab] || { dir: 0 });
    if (!c.queue) newRound(tab, c);

    if (!c.queue.length) {
      view.innerHTML = `<div class="deck">
        <div class="prompt" style="width:min(620px,100%)"><div class="prompt-body">
          <p class="q">Round complete</p>
          <p class="stem title">${c.got} got it · ${c.again} again</p>
          <p class="hint">${learned(tab)} of ${TOPICS[tab].items.length} ${TOPICS[tab].noun} learned. Next round leads with the ones you know least.</p>
        </div></div>
        <div class="actions"><button class="btn primary" id="next-round">Next round ${icon("arrow")}</button></div>
      </div>`;
      $("#next-round").addEventListener("click", () => { newRound(tab, c); renderCards(); });
      $("#next-round").focus();
      return;
    }

    const x = byId(tab, c.queue[0]);
    const f = faces(tab, x, c.dir);
    view.innerHTML = `<div class="deck">
      <div class="deck-meta">
        <span>Card ${c.done + 1} · ${c.queue.length} left this round</span>
        <span class="dir">${DIRS[tab].map((d, i) => `<button class="chip" data-dir="${i}" aria-pressed="${c.dir === i}">${i ? icon("swap") : ""}${esc(d)}</button>`).join("")}</span>
      </div>
      <div class="flip">
        <button class="card ${c.flipped ? "flipped" : ""}" id="card" aria-label="${c.flipped ? "Answer side. Press to see the question" : "Question side. Press to reveal the answer"}">
          <div class="face front ${f.front[0]}">${f.front[1]}</div>
          <div class="face back ${f.back[0]}">${f.back[1]}</div>
        </button>
      </div>
      <div class="actions">
        <button class="btn bad" id="again" ${c.flipped ? "" : "disabled"}>${icon("x")} Again <kbd>1</kbd></button>
        <button class="btn" id="flip">${icon("flip")} Flip <kbd>Space</kbd></button>
        <button class="btn good" id="got" ${c.flipped ? "" : "disabled"}>${icon("check")} Got it <kbd>2</kbd></button>
      </div>
      <p class="hint">Flip, check yourself honestly, then mark it. “Again” brings the card back later this round.</p>
    </div>`;

    const flip = () => {
      c.flipped = !c.flipped;
      $("#card").classList.toggle("flipped", c.flipped);
      $("#card").setAttribute("aria-label", c.flipped ? "Answer side. Press to see the question" : "Question side. Press to reveal the answer");
      $("#again").disabled = $("#got").disabled = !c.flipped;
    };
    const mark = (ok) => {
      if (!c.flipped) return;
      const id = c.queue.shift();
      if (ok) { setLevel(tab, id, level(tab, id) + 1); c.got++; }
      else { setLevel(tab, id, 0); c.again++; c.queue.push(id); }
      c.done++; c.flipped = false;
      renderCards();
      $("#card")?.focus();
    };
    $("#card").addEventListener("click", flip);
    $("#flip").addEventListener("click", flip);
    $("#again").addEventListener("click", () => mark(false));
    $("#got").addEventListener("click", () => mark(true));
    $$("[data-dir]", view).forEach((b) => b.addEventListener("click", () => { c.dir = +b.dataset.dir; c.flipped = false; renderCards(); }));
    keyHandler = (e) => {
      if (e.key === " " || e.key === "Enter") { if (document.activeElement?.closest(".actions, .dir")) return; e.preventDefault(); flip(); }
      else if (e.key === "1") mark(false);
      else if (e.key === "2") mark(true);
    };
  }

  /* ---------- QUIZ ---------- */
  // Distractors: other items, preferring ones a player would plausibly confuse.
  function distractors(pool, answer, n, near) {
    const rest = shuffle(pool.filter((p) => p !== answer));
    rest.sort((a, b) => (near ? near(a) - near(b) : 0));
    return rest.slice(0, n);
  }
  const champOpt = (u) => ({ img: u.img, label: esc(u.name), fb: initials(u.name) });
  const traitOpt = (t) => ({ img: t.icon, label: esc(t.name), fb: initials(t.name), icon: true });

  const QUESTIONS = {
    unlocks(x) {
      const pool = TOPICS.unlocks.items;
      if (Math.random() < 0.5) {
        const opts = [x, ...distractors(pool, x, 3, (u) => Math.abs(u.cost - x.cost) + Math.random() * 2)];
        return { q: "Who unlocks when you do this?", stem: steps(x.unlock, (c) => fmt(hideUnit(c, x))), opts: opts.map((u) => ({ ...champOpt(u), ok: u === x })) };
      }
      const opts = [x, ...distractors(pool, x, 3)];
      return { q: "How do you unlock this champion?", art: x, stem: `<span class="row-sub">${costTag(x)}</span><p class="stem title">${esc(x.name)}</p>`,
        opts: opts.map((u) => ({ label: fmt(hideUnit(u.unlock.join(" "), x)), ok: u === x, text: true })) };
    },
    traits(x) {
      const kinds = ["name"];
      if (x.units.length) kinds.push("member", "carries");
      const kind = pick(kinds);
      if (kind === "name") {
        const opts = [x, ...distractors(traits, x, 3, (t) => (t.type === x.type ? 0 : 1) + Math.random())];
        return { q: "Which trait does this?", stem: `<p class="stem">${fmt(hideTrait(x.desc, x))}</p>`, opts: opts.map((t) => ({ ...traitOpt(t), ok: t === x })) };
      }
      if (kind === "member") {
        const yes = unitById[pick(x.units)];
        const no = distractors(fieldable.filter((u) => !u.traits.includes(x.name)), null, 3, (u) => Math.abs(u.cost - yes.cost) + Math.random() * 2);
        return { q: `Which champion is ${esc(x.name)}?`, trait: x, stem: `<p class="stem title">${esc(x.name)}</p><span class="row-sub">${esc(x.type)} ${breaks(x)}</span>`,
          opts: [yes, ...no].map((u) => ({ ...champOpt(u), ok: u === yes })) };
      }
      const u = unitById[pick(x.units)];
      const others = traits.filter((t) => !u.traits.includes(t.name));
      const opts = [x, ...distractors(others, null, 3, (t) => (t.type === x.type ? 0 : 1) + Math.random())];
      return { q: `Which trait does ${esc(u.name)} have?`, art: u, stem: `<span class="row-sub">${costTag(u)}</span><p class="stem title">${esc(u.name)}</p>`,
        opts: opts.map((t) => ({ ...traitOpt(t), ok: t === x })) };
    },
    abilities(x) {
      const pool = TOPICS.abilities.items;
      const opts = [x, ...distractors(pool, x, 3, (u) => Math.abs(u.cost - x.cost) + Math.random() * 2)];
      const o = opts.map((u) => ({ ...champOpt(u), ok: u === x }));
      if (Math.random() < 0.6) return { q: "Whose ability is this?", stem: `<p class="stem">${fmt(hideUnit(x.ability.desc, x))}</p>`, opts: o };
      return { q: "Which champion casts this ability?", stem: `<p class="stem title">${fmt(hideUnit(x.ability.name, x))}</p>`, opts: o };
    },
  };

  function explain(tab, x) {
    if (tab === "unlocks") return `<strong>${esc(x.name)}</strong> unlocks: ${x.unlock.map(fmt).join(" ")}`;
    if (tab === "abilities") return `<strong>${esc(x.name)}</strong> casts <strong>${esc(x.ability.name)}</strong>: ${fmt(x.ability.desc)}`;
    const who = x.units.map((id) => unitById[id]?.name).filter(Boolean).join(", ");
    return `<strong>${esc(x.name)}</strong> (${esc(x.type)}${x.breakpoints.length > 1 ? ", " + x.breakpoints.join("/") : ""}): ${fmt(x.desc)}${who ? ` Champions: ${esc(who)}.` : ""}`;
  }

  function nextQuestion(tab, z) {
    const items = weighted(tab, TOPICS[tab].items);
    let x = items[0];
    if (z.last && x.id === z.last && items.length > 1) x = items[1];
    z.last = x.id;
    z.cur = { x, ...QUESTIONS[tab](x) };
    z.cur.opts = shuffle(z.cur.opts);
    z.picked = null;
  }

  function renderQuiz() {
    const tab = state.tab;
    const z = (state.quiz[tab] = state.quiz[tab] || { right: 0, total: 0, streak: 0, best: 0 });
    if (!z.cur) nextQuestion(tab, z);
    const c = z.cur;
    const answered = z.picked != null;
    const okIdx = c.opts.findIndex((o) => o.ok);

    const side = c.art ? portrait(c.art) : c.trait ? traitIcon(c.trait) : "";
    view.innerHTML = `<div class="quiz">
      <div class="quiz-meta">
        <span>${z.right} of ${z.total} correct</span>
        <span class="streak">Streak <b>${z.streak}</b> · Best <b>${z.best}</b></span>
      </div>
      <div class="prompt">${side}<div class="prompt-body"><p class="q">${c.q}</p>${c.stem}</div></div>
      <div class="options" role="group" aria-label="Answers">
        ${c.opts.map((o, i) => {
          let cls = "option" + (o.text ? " text" : "");
          if (answered) cls += o.ok ? " correct" : i === z.picked ? " wrong" : " dim";
          const img = o.img ? `<img class="opt-img" src="${o.img}" alt="" loading="lazy" data-fb="${esc(o.fb)}" ${o.icon ? 'style="object-fit:contain;padding:8px;background:var(--panel-3)"' : ""}>` : "";
          return `<button class="${cls}" data-i="${i}" ${answered ? "disabled" : ""}><kbd>${i + 1}</kbd>${img}<span class="opt-label">${o.label}</span></button>`;
        }).join("")}
      </div>
      ${answered ? `<div class="feedback" aria-live="polite">
        <p class="feedback-text">${z.picked === okIdx ? `<span class="verdict good">${icon("check")} Correct.</span>` : `<span class="verdict bad">${icon("x")} Not quite.</span>`} ${explain(tab, c.x)}</p>
        <button class="btn primary" id="next">Next <kbd>Enter</kbd></button>
      </div>` : ""}
    </div>`;

    const answer = (i) => {
      if (z.picked != null || !c.opts[i]) return;
      z.picked = i; z.total++;
      if (c.opts[i].ok) { z.right++; z.streak++; z.best = Math.max(z.best, z.streak); setLevel(tab, c.x.id, level(tab, c.x.id) + 1); }
      else { z.streak = 0; setLevel(tab, c.x.id, level(tab, c.x.id) - 1); }
      renderQuiz();
      $("#next").focus();
    };
    const next = () => { if (z.picked == null) return; nextQuestion(tab, z); renderQuiz(); $(".option")?.focus(); };
    $$(".option", view).forEach((b) => b.addEventListener("click", () => answer(+b.dataset.i)));
    $("#next")?.addEventListener("click", next);
    keyHandler = (e) => {
      if (/^[1-4]$/.test(e.key)) answer(+e.key - 1);
      else if (e.key === "Enter" && z.picked != null && document.activeElement?.id !== "next") { e.preventDefault(); next(); }
    };
  }

  /* ---------- wiring ---------- */
  let keyHandler = null;
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.target.matches("input, textarea")) return;
    if (state.mode !== "study" && keyHandler) keyHandler(e);
  });

  $$(".tab").forEach((b) => {
    b.addEventListener("click", () => go(b.dataset.tab, state.mode));
    b.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const tabs = $$(".tab"), i = tabs.indexOf(b), n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      n.focus(); go(n.dataset.tab, state.mode);
    });
  });
  $$(".mode").forEach((b) => b.addEventListener("click", () => { keyHandler = null; go(state.tab, b.dataset.mode); }));
  $("#reset").addEventListener("click", () => {
    if (!confirm(`Reset your ${state.tab} progress? Recall levels for this tab go back to zero.`)) return;
    progress[state.tab] = {}; store.set("setlist.progress", progress);
    delete state.cards[state.tab]; delete state.quiz[state.tab];
    go(state.tab, state.mode);
  });

  const when = D.meta.generated ? new Date(D.meta.generated).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";
  $("#data-date").textContent = `generated ${when}`;
  go(state.tab, state.mode);
})();
