// =========================================================================
// Birthday Tracker — Shared API client + UI helpers
// =========================================================================
(function (global) {
  const BASE = global.APP_CONFIG.API_BASE;

  async function request(path, { method = "GET", body } = {}) {
    const headers = {};
    let payload = undefined;
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(BASE + path, { method, headers, body: payload });
    } catch (err) {
      const e = new Error("Network error — could not reach the backend.");
      e.network = true;
      throw e;
    }
    let data = null;
    const text = await res.text();
    if (text) {
      try { data = JSON.parse(text); } catch (_) { data = text; }
    }
    if (!res.ok) {
      const err = new Error("Request failed");
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  global.API = {
    listMembers:     ()           => request("/api/members"),
    createMember:    (m)          => request("/api/members", { method: "POST", body: m }),
    updateMember:    (id, m)      => request(`/api/members/${id}`, { method: "PUT",  body: m }),
    deleteMember:    (id)         => request(`/api/members/${id}`, { method: "DELETE" }),
    dashboard:       ()           => request("/api/dashboard"),
    backupInfo:      ()           => request("/api/backup/latest"),
    exportCsvUrl:    () => `${BASE}/api/export/csv`,
    exportXlsxUrl:   () => `${BASE}/api/export/xlsx`,
  };

  // -----------------------------------------------------------------------
  // Helpers used across pages
  // -----------------------------------------------------------------------
  const MONTHS_LONG = ["January","February","March","April","May","June",
    "July","August","September","October","November","December"];
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec"];
  const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  function formatBirthday(month, day) {
    return `${MONTHS_SHORT[month - 1]} ${day}`;
  }

  function initials(name) {
    return name.trim().split(/\s+/).map(p => p[0] || "").join("").slice(0, 3).toUpperCase();
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  // Toast notifications
  function showToast(message, { type = "info", duration = 3500 } = {}) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.classList.toggle("toast--error", type === "error");
    el.textContent = message;
    requestAnimationFrame(() => el.classList.add("is-visible"));
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("is-visible"), duration);
  }

  // Highlight active nav link based on current page
  function activateNav() {
    const path = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav a").forEach(a => {
      const href = a.getAttribute("href");
      if (href === path) a.classList.add("is-active");
    });
  }

  global.UI = {
    MONTHS_LONG, MONTHS_SHORT, DAYS_IN_MONTH,
    formatBirthday, initials, escapeHtml, showToast, activateNav,
  };
})(window);
