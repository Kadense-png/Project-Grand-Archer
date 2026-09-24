// Stats come from the Forum's own localStorage data — no separate profile database. Avatar/favoredBuild/bio save through GAAuth's meta store, same browser-only setup as everything else.

(function () {
  const POSTS_KEY = "ga_forum_posts";
  const MAX_AVATAR_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB — generous, canvas resize handles the rest
  const AVATAR_SIZE = 240; // px, square, after resize

  let editing = false;

  function loadPosts() {
    try { return JSON.parse(localStorage.getItem(POSTS_KEY)) || []; }
    catch { return []; }
  }

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function rankTitle(activity) {
    if (activity === 0) return "Trainee";
    if (activity < 5) return "Field Hunter";
    if (activity < 15) return "Seasoned Archer";
    return "Veteran Archer";
  }

  function likesReceived(posts, name) {
    return posts
      .filter(p => p.author === name)
      .reduce((sum, p) => sum + (p.likedBy ? p.likedBy.length : 0), 0);
  }

  function computeStats(posts, name) {
    const threads = posts.filter(p => p.author === name).length;
    let replies = 0;
    posts.forEach(p => (p.replies || []).forEach(r => { if (r.author === name) replies++; }));
    const likes = likesReceived(posts, name);
    const totalPosts = threads + replies;
    // Flavor stats only — not meant to model the real game's numbers, just scale with activity.
    const hunterRank = 1 + threads * 4 + replies * 2 + Math.floor(likes / 3);
    const karma = likes * 3 + totalPosts * 2;
    return { threads, replies, likes, totalPosts, hunterRank, karma };
  }

  function recentThreads(posts, name, limit) {
    return posts
      .filter(p => p.author === name)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

// Reads the file, draws it into a square canvas, exports a compact JPEG data URL — keeps localStorage usage sane regardless of source photo size.
  function resizeImageFile(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) {
        reject(new Error("That's not an image file."));
        return;
      }
      if (file.size > MAX_AVATAR_UPLOAD_BYTES) {
        reject(new Error("That image is too large — try something under 10MB."));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Couldn't read that file."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Couldn't load that image."));
        img.onload = () => {
          const side = Math.min(img.width, img.height);
          const sx = (img.width - side) / 2;
          const sy = (img.height - side) / 2;
          const canvas = document.createElement("canvas");
          canvas.width = AVATAR_SIZE;
          canvas.height = AVATAR_SIZE;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

// Markup
  const DEFAULT_AVATAR_SVG = `
    <svg viewBox="0 0 24 24" class="avatar-default-icon" aria-hidden="true">
      <circle cx="12" cy="8" r="4" fill="currentColor"/>
      <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" fill="currentColor"/>
    </svg>
  `;

  function avatarHTML(avatarSrc) {
    return avatarSrc
      ? `<img src="${avatarSrc}" alt="">`
      : DEFAULT_AVATAR_SVG;
  }

  function buildOptionsHTML(selected) {
    return window.GAAuth.PROFILE_BUILD_OPTIONS
      .map(opt => `<option value="${escapeHTML(opt)}" ${opt === selected ? "selected" : ""}>${escapeHTML(opt)}</option>`)
      .join("");
  }

  function sidebarHTML(d) {
    const favoredDisplay = editing
      ? `<select class="favored-select" id="favored-build-select">
           <option value="" ${!d.favoredBuild ? "selected" : ""}>Not set</option>
           ${buildOptionsHTML(d.favoredBuild)}
         </select>`
      : `<p class="favored-value">${d.favoredBuild ? escapeHTML(d.favoredBuild) : "Not set yet"}</p>`;

    const actions = editing
      ? `<button type="button" class="btn btn-primary profile-save">Save</button>
         <button type="button" class="btn-small profile-cancel">Cancel</button>`
      : `<button type="button" class="btn-small profile-edit-toggle">Edit Profile</button>
         <button type="button" class="btn-small profile-change-avatar">Change Avatar</button>`;

    return `
      <div class="profile-sidebar">
        <div class="profile-avatar-circle">${avatarHTML(d.avatar)}</div>
        <input type="file" accept="image/*" id="avatar-input" class="visually-hidden">
        <p class="avatar-error" hidden></p>

        <h2 class="profile-name">${escapeHTML(d.name)}</h2>
        <p class="profile-hr-line">HR ${d.hunterRank} &middot; ${d.rank}</p>

        <div class="profile-favored-block">
          <p class="favored-label">Favored Build</p>
          ${favoredDisplay}
        </div>

        <div class="profile-sidebar-actions">
          ${actions}
          <button type="button" class="btn-small profile-logout">Log Out</button>
        </div>
      </div>
    `;
  }

  function mainHTML(d) {
    const bioBlock = editing
      ? `<textarea id="bio-textarea" class="about-textarea" maxlength="400" placeholder="Tell the Division a bit about how you hunt&hellip;">${escapeHTML(d.bio || "")}</textarea>`
      : `<div class="about-box">${d.bio ? escapeHTML(d.bio).replace(/\n/g, "<br>") : `<span class="empty-state">No bio yet — click Edit Profile to add one.</span>`}</div>`;

    return `
      <div class="profile-main">
        <p class="section-tag">About Me</p>
        ${bioBlock}

        <p class="section-tag profile-stats-tag">Stats</p>
        <div class="profile-stats">
          <div class="stat"><span class="stat-value">${d.hunterRank}</span><span class="stat-label">Hunter Rank</span></div>
          <div class="stat"><span class="stat-value">${d.totalPosts}</span><span class="stat-label">Posts</span></div>
          <div class="stat"><span class="stat-value">${d.likes}</span><span class="stat-label">Total Likes</span></div>
          <div class="stat"><span class="stat-value">${d.karma.toLocaleString()}</span><span class="stat-label">Karma</span></div>
        </div>

        <p class="section-tag">Recent Posts</p>
        ${d.recent.length
          ? `<ul class="posts-list">${d.recent.map(postRowHTML).join("")}</ul>`
          : `<p class="empty-state">No threads started yet — head to the <a href="GrandArcher-Forum.html">Forum</a> and introduce yourself.</p>`}
      </div>
    `;
  }

  function postRowHTML(post) {
    const likeCount = post.likedBy ? post.likedBy.length : 0;
    return `
      <li class="post-row">
        <a href="GrandArcher-Forum.html#post-${post.id}" class="post-row-title">${escapeHTML(post.title)}</a>
        <span class="post-row-likes">&#128077; ${likeCount}</span>
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

// Wiring
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

  function wireProfile(root, name) {
    const logoutBtn = root.querySelector(".profile-logout");
    if (logoutBtn) logoutBtn.addEventListener("click", () => window.GAAuth.logout());

    const editToggle = root.querySelector(".profile-edit-toggle");
    if (editToggle) editToggle.addEventListener("click", () => { editing = true; render(); });

    const cancelBtn = root.querySelector(".profile-cancel");
    if (cancelBtn) cancelBtn.addEventListener("click", () => { editing = false; render(); });

    const saveBtn = root.querySelector(".profile-save");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        const select = root.querySelector("#favored-build-select");
        const textarea = root.querySelector("#bio-textarea");
        window.GAAuth.updateProfile(name, {
          favoredBuild: select ? select.value || null : undefined,
          bio: textarea ? textarea.value.trim() : undefined
        });
        editing = false;
        render();
      });
    }

    const avatarInput = root.querySelector("#avatar-input");
    const changeAvatarBtn = root.querySelector(".profile-change-avatar");
    const avatarCircle = root.querySelector(".profile-avatar-circle");
    const avatarError = root.querySelector(".avatar-error");
    if (changeAvatarBtn && avatarInput) {
      changeAvatarBtn.addEventListener("click", () => avatarInput.click());
    }
    if (avatarCircle && avatarInput) {
      avatarCircle.addEventListener("click", () => avatarInput.click());
      avatarCircle.style.cursor = "pointer";
    }
    if (avatarInput) {
      avatarInput.addEventListener("change", () => {
        const file = avatarInput.files && avatarInput.files[0];
        if (!file) return;
        if (avatarError) avatarError.hidden = true;
        resizeImageFile(file)
          .then(dataUrl => {
            window.GAAuth.updateProfile(name, { avatar: dataUrl });
          })
          .catch(err => {
            if (avatarError) {
              avatarError.hidden = false;
              avatarError.textContent = err.message;
            }
          })
          .finally(() => { avatarInput.value = ""; });
      });
    }
  }

  function render() {
    const root = document.getElementById("profile-root");
    if (!root || !window.GAAuth) return;

    const name = window.GAAuth.getCurrentUser();

    if (!name) {
      editing = false;
      root.innerHTML = loggedOutHTML();
      wireLoggedOut(root);
      return;
    }

    const posts = loadPosts();
    const stats = computeStats(posts, name);
    const profile = window.GAAuth.getProfile(name);

    const data = Object.assign({
      name,
      role: window.GAAuth.role(name),
      avatar: profile.avatar || null,
      favoredBuild: profile.favoredBuild || null,
      bio: profile.bio || "",
      rank: rankTitle(stats.totalPosts),
      recent: recentThreads(posts, name, 5)
    }, stats);

    root.innerHTML = `<div class="profile-layout">${sidebarHTML(data)}${mainHTML(data)}</div>`;
    wireProfile(root, name);
  }

  document.addEventListener("DOMContentLoaded", render);
  document.addEventListener("ga-auth-changed", render);
})();
