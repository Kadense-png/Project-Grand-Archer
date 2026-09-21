/* ===================================================================
   Grand Archer Division — Hunter Forum
   Everything here runs in the browser only. Posts, roles, and the
   logged-in identity all live in localStorage, so they survive a
   refresh but never leave this one browser/device. There is no
   server — this is a demo of the moderation workflow, not a real
   multi-user backend.
=================================================================== */

const KEYS = {
  posts: "ga_forum_posts",
  users: "ga_forum_users",
  currentUser: "ga_forum_current_user"
};

const FOUNDER_NAME = "ArrowStorm_99";

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
      body: "Keep it civil, keep it on-topic, and keep the melee jokes to a minimum. Anonymous questions are welcome — there's no such thing as a dumb one here.",
      pinned: true,
      timestamp: now - 1000 * 60 * 60 * 24 * 6,
      replies: []
    },
    {
      id: "p2",
      author: "GuestHunter",
      title: "Is Dragonpiercer still worth it after the recent balance pass?",
      body: "Feels like my burst window shrank a bit. Anyone else adjusting their rotation, or is it still Charging Sidestep into Power Shot into Dragonpiercer?",
      pinned: false,
      timestamp: now - 1000 * 60 * 60 * 30,
      replies: [
        {
          author: FOUNDER_NAME,
          body: "Still the same rotation on my end — the window just asks for slightly tighter timing now.",
          timestamp: now - 1000 * 60 * 60 * 20
        }
      ]
    },
    {
      id: "p3",
      author: "GuestHunter",
      title: "How do I comfortably land Discerning Dodge more consistently?",
      body: "I can hit it maybe 1 in 4 tries. Is this a timing thing or is my build missing something?",
      pinned: false,
      timestamp: now - 1000 * 60 * 60 * 5,
      replies: []
    }
  ];
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

function saveUsers(users) {
  localStorage.setItem(KEYS.users, JSON.stringify(users));
}

function loadPosts() {
  const raw = localStorage.getItem(KEYS.posts);
  if (!raw) {
    const seeded = seedPosts();
    localStorage.setItem(KEYS.posts, JSON.stringify(seeded));
    return seeded;
  }
  try { return JSON.parse(raw); } catch { return seedPosts(); }
}

function savePosts(posts) {
  localStorage.setItem(KEYS.posts, JSON.stringify(posts));
}

function loadCurrentUser(users) {
  const stored = localStorage.getItem(KEYS.currentUser);
  if (stored && users[stored]) return stored;
  localStorage.setItem(KEYS.currentUser, FOUNDER_NAME);
  return FOUNDER_NAME;
}

function saveCurrentUser(name) {
  localStorage.setItem(KEYS.currentUser, name);
}

/* ---------------------------------------------------------------
   State
--------------------------------------------------------------- */
let users = loadUsers();
let posts = loadPosts();
let currentUser = loadCurrentUser(users);

function role(username) {
  return users[username] || "member";
}

function isModerator(username) {
  const r = role(username);
  return r === "founder" || r === "moderator";
}

/* ---------------------------------------------------------------
   Rendering
--------------------------------------------------------------- */
function formatDate(ts) {
  return new Date(ts).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
  });
}

function roleBadge(username) {
  const r = role(username);
  const label = r === "founder" ? "Founder" : r === "moderator" ? "Moderator" : "Member";
  return `<span class="role-badge ${r}">${label}</span>`;
}

function renderIdentityBar() {
  const select = document.getElementById("identity-select");
  select.innerHTML = Object.keys(users)
    .map(name => `<option value="${name}" ${name === currentUser ? "selected" : ""}>${name}</option>`)
    .join("");

  document.getElementById("identity-role").innerHTML = roleBadge(currentUser);
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

  const replyBtn = `<button class="btn-small reply-toggle" data-id="${post.id}">Reply</button>`;

  const repliesHTML = post.replies.length
    ? `<ul class="replies">${post.replies.map(r => `
        <li>
          <span class="reply-meta">${r.author} ${roleBadge(r.author)} &middot; ${formatDate(r.timestamp)}</span>
          ${escapeHTML(r.body)}
        </li>`).join("")}</ul>`
    : "";

  return `
    <li class="thread-card ${post.pinned ? "pinned" : ""}" data-id="${post.id}">
      <p class="thread-meta">
        <span class="author">${post.author}</span> ${roleBadge(post.author)}
        <span>&middot; ${formatDate(post.timestamp)}</span>
        ${post.pinned ? '<span>&middot; 📌 Pinned</span>' : ""}
      </p>
      <h3>${escapeHTML(post.title)}</h3>
      <p class="thread-body">${escapeHTML(post.body)}</p>
      <div class="thread-actions">
        ${replyBtn}
        ${pinBtn}
        ${promoteBtn}
      </div>
      <form class="reply-form" data-id="${post.id}">
        <input type="text" placeholder="Write a reply&hellip;" required maxlength="400">
        <button type="submit" class="btn btn-primary" style="padding:10px 20px;">Send</button>
      </form>
      ${repliesHTML}
    </li>
  `;
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function render() {
  renderIdentityBar();

  const pinned = posts.filter(p => p.pinned).sort((a, b) => b.timestamp - a.timestamp);
  const rest = posts.filter(p => !p.pinned).sort((a, b) => b.timestamp - a.timestamp);

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
    : `<li class="empty-state">No threads yet — be the first to post.</li>`;

  attachCardEvents();
}

/* ---------------------------------------------------------------
   Events
--------------------------------------------------------------- */
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

  document.querySelectorAll(".reply-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const form = document.querySelector(`.reply-form[data-id="${btn.dataset.id}"]`);
      form.classList.toggle("open");
      if (form.classList.contains("open")) form.querySelector("input").focus();
    });
  });

  document.querySelectorAll(".reply-form").forEach(form => {
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

function init() {
  render();

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

  document.getElementById("new-post-form").addEventListener("submit", e => {
    e.preventDefault();
    const title = document.getElementById("post-title").value.trim();
    const body = document.getElementById("post-body").value.trim();
    if (!title || !body) return;
    posts.push({
      id: "p" + Date.now(),
      author: currentUser,
      title,
      body,
      pinned: false,
      timestamp: Date.now(),
      replies: []
    });
    savePosts(posts);
    e.target.reset();
    render();
  });

  document.getElementById("reset-demo").addEventListener("click", () => {
    if (!confirm("Reset the forum back to its starting demo state? This clears everything stored in this browser.")) return;
    localStorage.removeItem(KEYS.posts);
    localStorage.removeItem(KEYS.users);
    localStorage.removeItem(KEYS.currentUser);
    users = loadUsers();
    posts = loadPosts();
    currentUser = loadCurrentUser(users);
    render();
  });
}

document.addEventListener("DOMContentLoaded", init);