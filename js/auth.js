/* ===================================================================
   Grand Archer Division — site-wide session/login
   Shares the same localStorage "hunter" store the Forum already reads
   and writes (ga_forum_users, ga_forum_current_user), so logging in
   from the header and switching identity in the Forum both point at
   the same person. No passwords, too much work: same demo
   account switcher as the Forum. But I've put it in a trenchcoat
   and said it's something new.
=================================================================== */

(function () {
  const KEYS = {
    users: "ga_forum_users",
    currentUser: "ga_forum_current_user",
    sessionActive: "ga_session_active",
    userMeta: "ga_user_meta"
  };

  const FOUNDER_NAME = "Kadense";

  function seedUsers() {
    return { [FOUNDER_NAME]: "founder", "GuestHunter": "member" };
  }

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

  function loadMeta() {
    const raw = localStorage.getItem(KEYS.userMeta);
    try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  }

  function saveMeta(m) { localStorage.setItem(KEYS.userMeta, JSON.stringify(m)); }

  function isSessionActive() {
    return localStorage.getItem(KEYS.sessionActive) === "1";
  }

  /* Only returns a name if someone has actually logged in through the
     nav or the Profile page — NOT just whatever the Forum's identity
     switcher happens to be previewing right now. */
  function getCurrentUser() {
    if (!isSessionActive()) return null;
    const users = loadUsers();
    const stored = localStorage.getItem(KEYS.currentUser);
    return stored && users[stored] ? stored : null;
  }

  function role(name) {
    const users = loadUsers();
    return users[name] || "member";
  }

  function listUsers() { return loadUsers(); }

  function joinedAt(name) {
    const meta = loadMeta();
    return meta[name] ? meta[name].joinedAt : null;
  }

  function notifyChange() {
    document.dispatchEvent(new Event("ga-auth-changed"));
  }

  function setActiveUser(name) {
    localStorage.setItem(KEYS.currentUser, name);
    localStorage.setItem(KEYS.sessionActive, "1");
  }

  function login(name) {
    const users = loadUsers();
    if (!users[name]) return false;
    setActiveUser(name);
    notifyChange();
    return true;
  }

  function signup(rawName) {
    const name = (rawName || "").trim();
    if (!name) return { ok: false, reason: "empty" };
    const users = loadUsers();
    if (users[name]) return { ok: false, reason: "taken" };
    users[name] = "member";
    saveUsers(users);
    const meta = loadMeta();
    meta[name] = { joinedAt: Date.now() };
    saveMeta(meta);
    setActiveUser(name);
    notifyChange();
    return { ok: true, name };
  }

  function logout() {
    localStorage.setItem(KEYS.sessionActive, "0");
    notifyChange();
  }

  window.GAAuth = {
    getCurrentUser, isSessionActive, login, signup, logout,
    role, joinedAt, listUsers, FOUNDER_NAME
  };

  /* -----------------------------------------------------------------
     Nav wiring — replaces the header's "Log In" pill with a working
     dropdown, or, if someone's already logged in, a name + quick menu.
     Runs on whatever page includes this file; requires nothing more
     than the existing <a class="nav-login"> already in every header.
  ----------------------------------------------------------------- */
  function onProfilePage() {
    return /GrandArcher-Profile\.html$/i.test(location.pathname);
  }

  function goToProfileOrRefresh() {
    if (onProfilePage()) notifyChange();
    else location.href = "GrandArcher-Profile.html";
  }

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function buildLoginPanelHTML() {
    const users = listUsers();
    const options = Object.keys(users)
      .map(n => `<option value="${escapeHTML(n)}">${escapeHTML(n)}</option>`)
      .join("");
    return `
      <div class="auth-tabs" role="tablist">
        <button type="button" class="auth-tab active" data-tab="login" role="tab">Log In</button>
        <button type="button" class="auth-tab" data-tab="signup" role="tab">Sign Up</button>
      </div>
      <form class="auth-form" data-form="login">
        <label for="auth-login-select" class="visually-hidden">Choose a hunter</label>
        <select id="auth-login-select">${options}</select>
        <button type="submit" class="btn btn-primary btn-small-full">Log In</button>
      </form>
      <form class="auth-form" data-form="signup" hidden>
        <label for="auth-signup-name" class="visually-hidden">New hunter name</label>
        <input type="text" id="auth-signup-name" placeholder="Pick a hunter name" maxlength="24" required>
        <button type="submit" class="btn btn-primary btn-small-full">Create Account</button>
        <p class="auth-error" hidden></p>
      </form>
      <p class="auth-fineprint">No password — this is the same demo account switcher the Forum uses. Any name works.</p>
    `;
  }

  function buildUserPanelHTML(name) {
    const r = role(name);
    const roleLabel = r === "member" ? "Member" : r.charAt(0).toUpperCase() + r.slice(1);
    return `
      <div class="auth-user-info">
        <span class="nav-avatar" aria-hidden="true">${escapeHTML(name.charAt(0).toUpperCase())}</span>
        <div>
          <p class="auth-user-name">${escapeHTML(name)}</p>
          <span class="role-badge ${r}">${roleLabel}</span>
        </div>
      </div>
      <a href="GrandArcher-Profile.html" class="auth-menu-link">View Profile</a>
      <button type="button" class="auth-menu-link auth-logout">Log Out</button>
    `;
  }

  function initNavAuth() {
    const trigger = document.querySelector(".nav-login");
    if (!trigger) return;

    const wrap = document.createElement("div");
    wrap.className = "nav-auth";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "nav-login";
    button.setAttribute("aria-haspopup", "true");
    button.setAttribute("aria-expanded", "false");

    const panel = document.createElement("div");
    panel.className = "login-dropdown";
    panel.hidden = true;

    trigger.replaceWith(wrap);
    wrap.appendChild(button);
    wrap.appendChild(panel);

    function closePanel() {
      panel.hidden = true;
      button.setAttribute("aria-expanded", "false");
    }

    function wireInside() {
      panel.querySelectorAll(".auth-tab").forEach(tab => {
        tab.addEventListener("click", () => {
          panel.querySelectorAll(".auth-tab").forEach(t => t.classList.toggle("active", t === tab));
          panel.querySelectorAll(".auth-form").forEach(f => { f.hidden = f.dataset.form !== tab.dataset.tab; });
        });
      });

      const loginForm = panel.querySelector('[data-form="login"]');
      if (loginForm) {
        loginForm.addEventListener("submit", e => {
          e.preventDefault();
          const name = loginForm.querySelector("select").value;
          if (login(name)) goToProfileOrRefresh();
        });
      }

      const signupForm = panel.querySelector('[data-form="signup"]');
      if (signupForm) {
        signupForm.addEventListener("submit", e => {
          e.preventDefault();
          const input = signupForm.querySelector("input");
          const errorEl = signupForm.querySelector(".auth-error");
          const result = signup(input.value);
          if (result.ok) {
            goToProfileOrRefresh();
          } else {
            errorEl.hidden = false;
            errorEl.textContent = result.reason === "taken"
              ? "That name's already claimed — try another."
              : "Enter a name first.";
          }
        });
      }

      const logoutBtn = panel.querySelector(".auth-logout");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
          logout();
          closePanel();
          if (onProfilePage()) notifyChange();
        });
      }
    }

    function paint() {
      const name = getCurrentUser();
      closePanel();
      if (name) {
        button.classList.add("nav-login--user");
        button.innerHTML = `<span class="nav-avatar" aria-hidden="true">${escapeHTML(name.charAt(0).toUpperCase())}</span>${escapeHTML(name)}`;
        panel.innerHTML = buildUserPanelHTML(name);
      } else {
        button.classList.remove("nav-login--user");
        button.textContent = "Log In";
        panel.innerHTML = buildLoginPanelHTML();
      }
      wireInside();
    }

    button.addEventListener("click", () => {
      const opening = panel.hidden;
      panel.hidden = !opening;
      button.setAttribute("aria-expanded", String(opening));
    });

    document.addEventListener("click", e => {
      if (!wrap.contains(e.target)) closePanel();
    });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && !panel.hidden) {
        closePanel();
        button.focus();
      }
    });

    document.addEventListener("ga-auth-changed", paint);

    paint();
  }

  document.addEventListener("DOMContentLoaded", initNavAuth);
})();
