/* ===================================================================
   Grand Archer Division — Hunter Profile
   No separate profile database — this reads the same ga_forum_posts
   the Forum writes to and counts up whoever's logged in (auth.js).
   Your stats are just your Forum activity, tallied.
=================================================================== */

(function () {
  const POSTS_KEY = "ga_forum_posts";

  function loadPosts() {
    try { return JSON.parse(localStorage.getItem(POSTS_KEY)) || []; }
    catch { return []; }
  }

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

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

  function rankTitle(threads, replies) {
    const total = threads + replies;
    if (total === 0) return "Trainee";
    if (total < 5) return "Field Hunter";
    if (total < 15) return "Seasoned Archer";
    return "Veteran of the Division";
  }

  /* "Favored build" is just whichever playstyle tag shows up most
     often across the hunter's own threads — real signal instead of
     a field they'd have to fill in and keep up to date themselves. */
  function favoredTag(posts, name) {
    const counts = {};
    posts.filter(p => p.author === name).forEach(p => {
      (p.tags || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; });
    });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return entries.length ? entries[0][0] : "Not decided yet";
  }

  function likesReceived(posts, name) {
    return posts
      .filter(p => p.author === name)
      .reduce((sum, p) => sum + (p.likedBy ? p.likedBy.length : 0), 0);
  }

  function buildActivity(posts, name) {
    const items = [];
    posts.forEach(p => {
      if (p.author === name) {
        items.push({ type: "thread", title: p.title, id: p.id, timestamp: p.timestamp, snippet: p.body });
      }
      (p.replies || []).forEach(r => {
        if (r.author === name) {
          items.push({ type: "reply", title: p.title, id: p.id, timestamp: r.timestamp, snippet: r.body });
        }
      });
    });
    return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, 6);
  }

  function activityItemHTML(item) {
    const label = item.type === "thread" ? "Started a thread" : "Replied to";
    const snippet = item.snippet.length > 130 ? item.snippet.slice(0, 130).trim() + "…" : item.snippet;
    return `
      <li class="activity-item">
        <span class="activity-kind">${label}</span>
        <a href="GrandArcher-Forum.html#post-${item.id}" class="activity-title">${escapeHTML(item.title)}</a>
        <p class="activity-snippet">${escapeHTML(snippet)}</p>
        <span class="activity-time">${timeAgo(item.timestamp)}</span>
      </li>
    `;
  }

  function authTabsAndForms(idPrefix) {
    const users = window.GAAuth.listUsers();
    const options = Object.keys(users)
      .map(n => `<option value="${escapeHTML(n)}">${escapeHTML(n)}</option>`)
      .join("");
    return `
      <div class="auth-tabs" role="tablist">
        <button type="button" class="auth-tab active" data-tab="login" role="tab">Log In</button>
        <button type="button" class="auth-tab" data-tab="signup" role="tab">Sign Up</button>
      </div>
      <form class="auth-form profile-auth-form" data-form="login">
        <label for="${idPrefix}-select" class="visually-hidden">Choose a hunter</label>
        <select id="${idPrefix}-select">${options}</select>
        <button type="submit" class="btn btn-primary">Log In</button>
      </form>
      <form class="auth-form profile-auth-form" data-form="signup" hidden>
        <label for="${idPrefix}-name" class="visually-hidden">New hunter name</label>
        <input type="text" id="${idPrefix}-name" placeholder="Pick a hunter name" maxlength="24" required>
        <button type="submit" class="btn btn-primary">Create Account</button>
        <p class="auth-error" hidden></p>
      </form>
    `;
  }

  function loggedOutHTML() {
    return `
      <div class="profile-guest">
        <p class="section-tag">Not Logged In</p>
        <h2>You're Browsing as a Guest</h2>
        <p>Log in — or sign up with any hunter name, no password required — to see your threads, replies, and standing in the Division.</p>
        ${authTabsAndForms("profile-auth")}
      </div>
    `;
  }

  function wireLoggedOut(root) {
    root.querySelectorAll(".auth-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        root.querySelectorAll(".auth-tab").forEach(t => t.classList.toggle("active", t === tab));
        root.querySelectorAll(".auth-form").forEach(f => { f.hidden = f.dataset.form !== tab.dataset.tab; });
      });
    });

    const loginForm = root.querySelector('[data-form="login"]');
    if (loginForm) {
      loginForm.addEventListener("submit", e => {
        e.preventDefault();
        window.GAAuth.login(loginForm.querySelector("select").value);
      });
    }

    const signupForm = root.querySelector('[data-form="signup"]');
    if (signupForm) {
      signupForm.addEventListener("submit", e => {
        e.preventDefault();
        const input = signupForm.querySelector("input");
        const errorEl = signupForm.querySelector(".auth-error");
        const result = window.GAAuth.signup(input.value);
        if (!result.ok) {
          errorEl.hidden = false;
          errorEl.textContent = result.reason === "taken"
            ? "That name's already claimed — try another."
            : "Enter a name first.";
        }
      });
    }
  }

  function profileHTML(d) {
    const joinedLine = d.joined
      ? "Joined " + new Date(d.joined).toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : "Founding Hunter";
    const roleLabel = d.role === "member" ? "Member" : d.role.charAt(0).toUpperCase() + d.role.slice(1);

    return `
      <div class="profile-card">
        <div class="profile-identity">
          <span class="profile-avatar" aria-hidden="true">${escapeHTML(d.name.charAt(0).toUpperCase())}</span>
          <div class="profile-identity-text">
            <h2>${escapeHTML(d.name)}</h2>
            <div class="profile-badges">
              <span class="role-badge ${d.role}">${roleLabel}</span>
              <span class="rank-badge">${d.rank}</span>
            </div>
            <p class="profile-joined">${joinedLine}</p>
          </div>
          <button type="button" class="btn-small profile-logout">Log Out</button>
        </div>

        <div class="profile-stats">
          <div class="stat"><span class="stat-value">${d.threads}</span><span class="stat-label">Threads</span></div>
          <div class="stat"><span class="stat-value">${d.replies}</span><span class="stat-label">Replies</span></div>
          <div class="stat"><span class="stat-value">${d.likes}</span><span class="stat-label">Likes Received</span></div>
          <div class="stat"><span class="stat-value">L${d.level}</span><span class="stat-label">Hunter Level</span></div>
        </div>

        <p class="profile-favored"><span class="section-tag">Favored Build</span>${escapeHTML(d.tag)}</p>
      </div>

      <div class="profile-activity">
        <h2 class="forum-heading">Recent Activity</h2>
        ${d.activity.length
          ? `<ul class="activity-list">${d.activity.map(activityItemHTML).join("")}</ul>`
          : `<p class="empty-state">No activity yet — head to the <a href="GrandArcher-Forum.html">Forum</a> and introduce yourself.</p>`}
      </div>
    `;
  }

  function wireProfile(root) {
    const logoutBtn = root.querySelector(".profile-logout");
    if (logoutBtn) logoutBtn.addEventListener("click", () => window.GAAuth.logout());
  }

  function render() {
    const root = document.getElementById("profile-root");
    if (!root || !window.GAAuth) return;

    const name = window.GAAuth.getCurrentUser();

    if (!name) {
      root.innerHTML = loggedOutHTML();
      wireLoggedOut(root);
      return;
    }

    const posts = loadPosts();
    const threads = posts.filter(p => p.author === name).length;
    let replies = 0;
    posts.forEach(p => (p.replies || []).forEach(r => { if (r.author === name) replies++; }));

    const data = {
      name,
      role: window.GAAuth.role(name),
      joined: window.GAAuth.joinedAt(name),
      threads,
      replies,
      likes: likesReceived(posts, name),
      level: 1 + Math.floor((threads * 3 + replies) / 5),
      rank: rankTitle(threads, replies),
      tag: favoredTag(posts, name),
      activity: buildActivity(posts, name)
    };

    root.innerHTML = profileHTML(data);
    wireProfile(root);
  }

  document.addEventListener("DOMContentLoaded", render);
  document.addEventListener("ga-auth-changed", render);
})();