/* ===================================================================
   Grand Archer Division — Hunter Forum
   Everything here runs in the browser only. Posts, roles, votes, and
   the logged-in identity all live in localStorage, so they survive a
   refresh but never leave this one browser/device. There is no
   server — this is a demo of the moderation workflow, not a real
   multi-user backend.
=================================================================== */

const KEYS = {
  posts: "ga_forum_posts",
  users: "ga_forum_users",
  currentUser: "ga_forum_current_user",
  schemaVersion: "ga_forum_schema_version"
};

/* Bump this whenever the shape of a post/user object changes (new
   fields like likedBy/tags, a renamed founder, etc.). On mismatch,
   loadPosts()/loadUsers() wipe the old saved data and reseed fresh
   instead of crashing on missing fields from an older version. */
const SCHEMA_VERSION = 2;

const FOUNDER_NAME = "Kadense";

/* ---------------------------------------------------------------
   Seed data — only written the very first time the page loads on
   a given browser. After that, everything below is ignored in
   favor of whatever's already in localStorage.
--------------------------------------------------------------- */
function seedUsers() {
  return {
    [FOUNDER_NAME]: "founder",
    "GuestHunter": "member"
  };
}

function seedPosts() {
  const now = Date.now();
  return [
    {
      id: "p1",
      author: FOUNDER_NAME,
      title: "Division Notice — read before posting",
      body: "Welcome to the Hunter Forum. Before submitting an inquiry, search existing threads to see if another hunter has already asked the same question. Keep discussions useful to your fellow hunters.",
      tags: ["Notice"],
      pinned: true,
      timestamp: now - 1000 * 60 * 60 * 24 * 6,
      likedBy: [FOUNDER_NAME],
      dislikedBy: [],
      replies: []
    },
    {
      id: "p2",
      author: "GuestHunter",
      title: "Is Dragonpiercer still worth it after the recent balance pass?",
      body: "Feels like my burst window shrank a bit. Should I swap to Dash Dancing entirely, or is there still a strong reason to keep Dragonpiercer in the kit?",
      tags: ["Question", "Dragonpiercer"],
      pinned: false,
      timestamp: now - 1000 * 60 * 60 * 30,
      likedBy: [FOUNDER_NAME, "GuestHunter"],
      dislikedBy: [],
      replies: [
        {
          author: FOUNDER_NAME,
          body: "Still the same rotation on my end — the window just asks for slightly tighter timing now. Still the strongest way to cut tails on Bow.",
          timestamp: now - 1000 * 60 * 60 * 20
        }
      ]
    },
    {
      id: "p3",
      author: "GuestHunter",
      title: "How do I consistently land Discerning Dodge?",
      body: "The timing window feels impossibly tight. I keep eating hits instead of triggering DD. Any tips for training the timing, or is there gear that helps with the window?",
      tags: ["Question", "Discerning Dodge"],
      pinned: false,
      timestamp: now - 1000 * 60 * 60 * 5,
      likedBy: [],
      dislikedBy: [],
      replies: []
    }
  ];
}

/* ---------------------------------------------------------------
   Migration — if this browser has data saved under an older schema
   (missing fields, old founder name, etc.), wipe it and reseed
   rather than letting the mismatch crash the render.
--------------------------------------------------------------- */
function ensureCurrentSchema() {
  const stored = localStorage.getItem(KEYS.schemaVersion);
  if (stored === String(SCHEMA_VERSION)) return;
  localStorage.removeItem(KEYS.posts);
  localStorage.removeItem(KEYS.users);
  localStorage.removeItem(KEYS.currentUser);
  localStorage.setItem(KEYS.schemaVersion, String(SCHEMA_VERSION));
}

/* ---------------------------------------------------------------
   Storage helpers
--------------------------------------------------------------- */
function loadUsers() {
  const raw = localStorage.getItem(KEYS.users);
  if (!raw) {
    const seeded = seedUsers();
    localStorage.setItem(KEYS.users, JSON.stringify(seeded));
    return seeded;
  }
  try { return JSON.parse(raw); } catch { return seedUsers(); }
}

function saveUsers(u) { localStorage.setItem(KEYS.users, JSON.stringify(u)); }

function loadPosts() {
  const raw = localStorage.getItem(KEYS.posts);
  if (!raw) {
    const seeded = seedPosts();
    localStorage.setItem(KEYS.posts, JSON.stringify(seeded));
    return seeded;
  }
  try { return JSON.parse(raw); } catch { return seedPosts(); }
}

function savePosts(p) { localStorage.setItem(KEYS.posts, JSON.stringify(p)); }

function loadCurrentUser(u) {
  const stored = localStorage.getItem(KEYS.currentUser);
  if (stored && u[stored]) return stored;
  localStorage.setItem(KEYS.currentUser, FOUNDER_NAME);
  return FOUNDER_NAME;
}

function saveCurrentUser(name) { localStorage.setItem(KEYS.currentUser, name); }

/* ---------------------------------------------------------------
   State
--------------------------------------------------------------- */
ensureCurrentSchema();
let users = loadUsers();
let posts = loadPosts();
let currentUser = loadCurrentUser(users);
let searchTerm = "";

function role(username) { return users[username] || "member"; }
function isModerator(username) {
  const r = role(username);
  return r === "founder" || r === "moderator";
}

/* Defensive normalization: guarantees every post has the fields
   newer code expects, even if it somehow slipped in from an older
   or hand-edited localStorage entry. */
function normalizePost(p) {
  p.tags = Array.isArray(p.tags) ? p.tags : [];
  p.likedBy = Array.isArray(p.likedBy) ? p.likedBy : [];
  p.dislikedBy = Array.isArray(p.dislikedBy) ? p.dislikedBy : [];
  p.replies = Array.isArray(p.replies) ? p.replies : [];
  return p;
}
posts = posts.map(normalizePost);

/* ---------------------------------------------------------------
   Formatting helpers
--------------------------------------------------------------- */
function timeAgo(ts) {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min !== 1 ? "s" : ""} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr !== 1 ? "s" : ""} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} day${day !== 1 ? "s" : ""} ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo} month${mo !== 1 ? "s" : ""} ago`;
  const yr = Math.floor(mo / 12);
  return `${yr} year${yr !== 1 ? "s" : ""} ago`;
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function roleBadge(username) {
  const r = role(username);
  if (r === "founder") return `<span class="role-badge founder">Founder</span>`;
  if (r === "moderator") return `<span class="role-badge moderator">Mod</span>`;
  return "";
}

/* Members post anonymously to the public eye; staff choose to sign
   their name. The real author is still tracked internally so pin/
   promote controls keep working regardless of the display name. */
function displayName(username) {
  return isModerator(username) ? username : "Anonymous";
}

/* ---------------------------------------------------------------
   Rendering
--------------------------------------------------------------- */
function renderIdentityBar() {
  const select = document.getElementById("identity-select");
  select.innerHTML = Object.keys(users)
    .map(name => `<option value="${name}" ${name === currentUser ? "selected" : ""}>${name}</option>`)
    .join("");
  document.getElementById("identity-role").innerHTML =
    `<span class="role-badge ${role(currentUser)}">${role(currentUser) === "member" ? "Member" : role(currentUser)}</span>`;
}

function tagPills(tags) {
  if (!tags || !tags.length) return "";
  return `<div class="tag-pills">${tags.map(t => `<span class="tag-pill">${escapeHTML(t)}</span>`).join("")}</div>`;
}

function voteButtons(post) {
  const liked = post.likedBy.includes(currentUser);
  const disliked = post.dislikedBy.includes(currentUser);
  return `
    <div class="vote-group">
      <button class="vote-btn like-btn ${liked ? "active" : ""}" data-id="${post.id}" aria-label="Like this post" aria-pressed="${liked}">
        <span aria-hidden="true">&#9650;</span> ${post.likedBy.length}
      </button>
      <button class="vote-btn dislike-btn ${disliked ? "active" : ""}" data-id="${post.id}" aria-label="Dislike this post" aria-pressed="${disliked}">
        <span aria-hidden="true">&#9660;</span> ${post.dislikedBy.length}
      </button>
    </div>
  `;
}

function threadCardHTML(post) {
  const viewerIsMod = isModerator(currentUser);
  const authorIsMod = isModerator(post.author);

  const pinBtn = viewerIsMod
    ? `<button class="btn-small pin-btn" data-id="${post.id}">${post.pinned ? "Unpin" : "Pin"}</button>`
    : "";

  const promoteBtn = viewerIsMod && !authorIsMod
    ? `<button class="btn-small promote-btn" data-user="${post.author}">Promote to Moderator</button>`
    : "";

  const repliesHTML = post.replies.length
    ? `<ul class="replies">${post.replies.map(r => `
        <li>
          <span class="reply-meta">
            <span class="${isModerator(r.author) ? "" : "anon"}">${displayName(r.author)}</span>
            ${roleBadge(r.author)} &middot; ${timeAgo(r.timestamp)}
          </span>
          ${escapeHTML(r.body)}
        </li>`).join("")}</ul>`
    : "";

  return `
    <li class="thread-card ${post.pinned ? "pinned" : ""}" id="post-${post.id}" data-id="${post.id}">
      ${post.pinned ? `<p class="pinned-banner">📌 Pinned by Moderator</p>` : ""}
      <div class="thread-top">
        <div>
          <h3>${escapeHTML(post.title)}</h3>
          <p class="thread-body">${escapeHTML(post.body)}</p>
          ${tagPills(post.tags)}
          <p class="thread-meta">
            <span class="${isModerator(post.author) ? "" : "anon"}">${displayName(post.author)}</span>
            ${roleBadge(post.author)} &middot; ${timeAgo(post.timestamp)}
          </p>
        </div>
        ${voteButtons(post)}
      </div>
      <div class="thread-actions">
        ${pinBtn}
        ${promoteBtn}
        <button class="btn-small copy-link-btn" data-id="${post.id}">Copy Link</button>
      </div>
      ${repliesHTML}
      <form class="reply-bar" data-id="${post.id}">
        <input type="text" placeholder="Reply anonymously&hellip;" required maxlength="400">
        <button type="submit" class="btn-small">Post Reply</button>
      </form>
    </li>
  `;
}

function matchesSearch(post, term) {
  if (!term) return true;
  const haystack = [post.title, post.body, ...(post.tags || [])].join(" ").toLowerCase();
  return haystack.includes(term.toLowerCase());
}

function render() {
  renderIdentityBar();

  const filtered = posts.filter(p => matchesSearch(p, searchTerm));
  const pinned = filtered.filter(p => p.pinned).sort((a, b) => b.timestamp - a.timestamp);
  const rest = filtered.filter(p => !p.pinned).sort((a, b) => b.timestamp - a.timestamp);

  const pinnedSection = document.getElementById("pinned-section");
  const pinnedList = document.getElementById("pinned-list");
  if (pinned.length) {
    pinnedSection.style.display = "";
    pinnedList.innerHTML = pinned.map(threadCardHTML).join("");
  } else {
    pinnedSection.style.display = "none";
  }

  const threadList = document.getElementById("thread-list");
  threadList.innerHTML = rest.length
    ? rest.map(threadCardHTML).join("")
    : `<li class="empty-state">${searchTerm ? "No threads match your search." : "No threads yet — be the first to post."}</li>`;

  attachCardEvents();
}

/* ---------------------------------------------------------------
   Events
--------------------------------------------------------------- */
function copyPostLink(id, btn) {
  const url = `${location.origin}${location.pathname}#post-${id}`;
  const done = () => {
    const original = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = original; }, 1500);
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(url).then(done).catch(() => fallbackCopy(url, done));
  } else {
    fallbackCopy(url, done);
  }
}

function fallbackCopy(text, done) {
  const temp = document.createElement("textarea");
  temp.value = text;
  temp.style.position = "fixed";
  temp.style.opacity = "0";
  document.body.appendChild(temp);
  temp.select();
  try { document.execCommand("copy"); done(); } catch { /* clipboard unavailable */ }
  document.body.removeChild(temp);
}

function attachCardEvents() {
  document.querySelectorAll(".pin-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const post = posts.find(p => p.id === btn.dataset.id);
      post.pinned = !post.pinned;
      savePosts(posts);
      render();
    });
  });

  document.querySelectorAll(".promote-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      users[btn.dataset.user] = "moderator";
      saveUsers(users);
      render();
    });
  });

  document.querySelectorAll(".like-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const post = posts.find(p => p.id === btn.dataset.id);
      const i = post.likedBy.indexOf(currentUser);
      if (i > -1) { post.likedBy.splice(i, 1); }
      else {
        post.likedBy.push(currentUser);
        const d = post.dislikedBy.indexOf(currentUser);
        if (d > -1) post.dislikedBy.splice(d, 1);
      }
      savePosts(posts);
      render();
    });
  });

  document.querySelectorAll(".dislike-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const post = posts.find(p => p.id === btn.dataset.id);
      const i = post.dislikedBy.indexOf(currentUser);
      if (i > -1) { post.dislikedBy.splice(i, 1); }
      else {
        post.dislikedBy.push(currentUser);
        const l = post.likedBy.indexOf(currentUser);
        if (l > -1) post.likedBy.splice(l, 1);
      }
      savePosts(posts);
      render();
    });
  });

  document.querySelectorAll(".copy-link-btn").forEach(btn => {
    btn.addEventListener("click", () => copyPostLink(btn.dataset.id, btn));
  });

  document.querySelectorAll(".reply-bar").forEach(form => {
    form.addEventListener("submit", e => {
      e.preventDefault();
      const input = form.querySelector("input");
      const body = input.value.trim();
      if (!body) return;
      const post = posts.find(p => p.id === form.dataset.id);
      post.replies.push({ author: currentUser, body, timestamp: Date.now() });
      savePosts(posts);
      render();
    });
  });
}

function highlightFromHash() {
  if (!location.hash.startsWith("#post-")) return;
  const el = document.getElementById(location.hash.slice(1));
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("highlight-flash");
  setTimeout(() => el.classList.remove("highlight-flash"), 2200);
}

function init() {
  render();
  highlightFromHash();

  document.getElementById("identity-select").addEventListener("change", e => {
    currentUser = e.target.value;
    saveCurrentUser(currentUser);
    render();
  });

  document.getElementById("add-hunter-form").addEventListener("submit", e => {
    e.preventDefault();
    const input = document.getElementById("new-hunter-name");
    const name = input.value.trim();
    if (!name || users[name]) { input.value = ""; return; }
    users[name] = "member";
    saveUsers(users);
    currentUser = name;
    saveCurrentUser(currentUser);
    input.value = "";
    render();
  });

  const askBtn = document.getElementById("ask-question-btn");
  const newPostWrapper = document.getElementById("new-post-wrapper");
  askBtn.addEventListener("click", () => {
    const opening = !newPostWrapper.classList.contains("open");
    newPostWrapper.classList.toggle("open", opening);
    askBtn.textContent = opening ? "Cancel" : "+ Ask a Question";
    if (opening) {
      newPostWrapper.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("post-title").focus();
    }
  });

  document.getElementById("new-post-form").addEventListener("submit", e => {
    e.preventDefault();
    const title = document.getElementById("post-title").value.trim();
    const body = document.getElementById("post-body").value.trim();
    const tagsRaw = document.getElementById("post-tags").value.trim();
    const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean).slice(0, 4) : [];
    if (!title || !body) return;
    posts.push({
      id: "p" + Date.now(),
      author: currentUser,
      title,
      body,
      tags,
      pinned: false,
      timestamp: Date.now(),
      likedBy: [],
      dislikedBy: [],
      replies: []
    });
    savePosts(posts);
    e.target.reset();
    newPostWrapper.classList.remove("open");
    askBtn.textContent = "+ Ask a Question";
    render();
  });

  document.getElementById("forum-search").addEventListener("input", e => {
    searchTerm = e.target.value;
    render();
  });

  document.getElementById("reset-demo").addEventListener("click", () => {
    if (!confirm("Reset the forum back to its starting demo state? This clears everything stored in this browser.")) return;
    localStorage.removeItem(KEYS.posts);
    localStorage.removeItem(KEYS.users);
    localStorage.removeItem(KEYS.currentUser);
    localStorage.removeItem(KEYS.schemaVersion);
    ensureCurrentSchema();
    users = loadUsers();
    posts = loadPosts().map(normalizePost);
    currentUser = loadCurrentUser(users);
    render();
  });
}

document.addEventListener("DOMContentLoaded", init);
