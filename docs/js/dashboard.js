// =========================================================================
// Dashboard page controller
// =========================================================================
(function () {
  UI.activateNav();

  const todayContainer    = document.getElementById("todayContainer");
  const upcomingContainer = document.getElementById("upcomingContainer");
  const todayLabel        = document.getElementById("todayLabel");
  const todayCount        = document.getElementById("todayCount");
  const upcomingCount     = document.getElementById("upcomingCount");

  function buildBirthdayMailto(member) {
    const subject = `Happy Birthday, ${member.name.split(" ")[0]}! 🎂`;
    const body = [
      `Dear ${member.name.split(" ")[0]},`,
      ``,
      `Wishing you a very happy birthday! Hope today brings you a moment of celebration amid everything we've all got going on.`,
      ``,
      `Thank you for being part of the team — really glad to be working alongside you.`,
      ``,
      `Best,`,
      `The Team`,
    ].join("\n");
    return `mailto:${encodeURIComponent(member.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function renderTodaysBirthdays(list) {
    if (!list.length) {
      todayContainer.classList.remove("is-loading");
      todayContainer.innerHTML = `
        <div class="empty-today">
          <span class="empty-today__icon">○</span>
          No birthdays today. Enjoy the quiet!
        </div>`;
      todayCount.textContent = "0 today";
      return;
    }
    todayCount.textContent = `${list.length} today`;
    todayContainer.classList.remove("is-loading");
    const supportsMailto = !!document.createElement("a").click;
    todayContainer.classList.add("card-grid");
    todayContainer.innerHTML = list.map(m => `
      <article class="today-card">
        <div>
          <div class="today-card__header">
            <div class="today-card__cake" aria-hidden="true">🎂</div>
            <div>
              <h4 class="today-card__name">${UI.escapeHtml(m.name)}</h4>
              <div class="today-card__role">${UI.escapeHtml(m.role)}</div>
              ${m.leap_note ? `<div class="today-card__leap">Leap day — observed today</div>` : ""}
            </div>
          </div>
        </div>
        <div class="today-card__action">
          <a class="btn btn--accent" href="${buildBirthdayMailto(m)}"
             data-fallback-email="${UI.escapeHtml(m.email)}">
            Send Birthday Wish
          </a>
          <div class="form__hint" style="margin-top:8px;">${UI.escapeHtml(m.email)}</div>
        </div>
      </article>
    `).join("");

    // Mailto fallback: if clicking the link can't open a mail client (e.g. some
    // mobile webviews), the user can still copy the email shown beneath.
    todayContainer.querySelectorAll("a[data-fallback-email]").forEach(a => {
      a.addEventListener("click", (ev) => {
        // No reliable JS way to detect mailto failure. The hint text under the
        // button surfaces the address regardless. Best-effort.
      });
    });
  }

  function renderUpcoming(list) {
    upcomingContainer.classList.remove("is-loading");
    if (!list.length) {
      upcomingContainer.innerHTML = `
        <div class="empty-today">No birthdays in the next 7 days.</div>`;
      upcomingCount.textContent = "0 upcoming";
      return;
    }
    upcomingCount.textContent = `${list.length} upcoming`;
    upcomingContainer.innerHTML = `
      <div class="upcoming-list">
        ${list.map(m => `
          <div class="upcoming-row">
            <div class="upcoming-row__date">${UI.formatBirthday(m.birthday_month, m.birthday_day)}</div>
            <div>
              <div class="upcoming-row__name">${UI.escapeHtml(m.name)}</div>
              <div class="upcoming-row__role">${UI.escapeHtml(m.role)}</div>
            </div>
            <div class="upcoming-row__days">
              ${m.days_until === 1 ? "Tomorrow" : `In ${m.days_until} days`}
            </div>
            <div class="upcoming-row__email">${UI.escapeHtml(m.email)}</div>
          </div>
        `).join("")}
      </div>`;
  }

  async function load() {
    try {
      const data = await API.dashboard();
      const todayDate = new Date();
      todayLabel.textContent = todayDate.toLocaleDateString(undefined, {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });
      renderTodaysBirthdays(data.todays_birthdays || []);
      renderUpcoming(data.upcoming || []);
    } catch (err) {
      const msg = err.network
        ? "Could not reach the backend. Make sure the API is running and the URL in config.js is correct."
        : "Something went wrong loading the dashboard.";
      todayContainer.classList.remove("is-loading");
      upcomingContainer.classList.remove("is-loading");
      todayContainer.innerHTML = `<div class="banner banner--error is-visible">${UI.escapeHtml(msg)}</div>`;
      upcomingContainer.innerHTML = "";
      console.error(err);
    }
  }

  load();
})();
