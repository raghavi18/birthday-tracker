// =========================================================================
// Calendar page controller
// =========================================================================
(function () {
  UI.activateNav();

  const grid       = document.getElementById("calendarGrid");
  const monthLabel = document.getElementById("monthLabel");
  const prevBtn    = document.getElementById("prevMonth");
  const nextBtn    = document.getElementById("nextMonth");

  let viewYear  = new Date().getFullYear();
  let viewMonth = new Date().getMonth(); // 0-indexed
  let allMembers = [];

  async function loadMembers() {
    try {
      allMembers = await API.listMembers();
      render();
    } catch (err) {
      grid.classList.remove("is-loading");
      grid.innerHTML = `<div class="banner banner--error is-visible" style="grid-column:1/-1">${
        err.network ? "Could not reach the backend." : "Failed to load members."
      }</div>`;
      console.error(err);
    }
  }

  function isLeapYear(y) {
    return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
  }

  function membersForCell(year, month0Indexed, day) {
    const month1Indexed = month0Indexed + 1;
    return allMembers.filter(m => {
      // Leap-day handling: Feb 29 birthdays show on Feb 28 in non-leap years.
      if (m.birthday_month === 2 && m.birthday_day === 29) {
        if (month1Indexed === 2) {
          if (isLeapYear(year)) return day === 29;
          return day === 28;
        }
        return false;
      }
      return m.birthday_month === month1Indexed && m.birthday_day === day;
    });
  }

  function render() {
    grid.classList.remove("is-loading");
    monthLabel.textContent = `${UI.MONTHS_LONG[viewMonth]} ${viewYear}`;

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

    // Use Mon-first weekday labels.
    const headers = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
      .map(d => `<div class="calendar-grid__head">${d}</div>`)
      .join("");

    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    // JS getDay(): 0=Sun..6=Sat. We want Monday = 0.
    const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrev   = new Date(viewYear, viewMonth, 0).getDate();

    // Build cells: leading days from previous month, this month, trailing.
    // Use Date arithmetic so month rollover/year rollover is automatic.
    const cells = [];
    for (let i = firstWeekday - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth, 1 - 1 - i);
      cells.push({ day: d.getDate(), month: d.getMonth(), year: d.getFullYear(), outside: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, month: viewMonth, year: viewYear, outside: false });
    }
    let trailing = 1;
    while (cells.length % 7 !== 0) {
      const d = new Date(viewYear, viewMonth + 1, trailing++);
      cells.push({ day: d.getDate(), month: d.getMonth(), year: d.getFullYear(), outside: true });
    }

    const cellsHtml = cells.map((c, idx) => {
      const cellDate = new Date(c.year, c.month, c.day);
      const cellKey  = `${cellDate.getFullYear()}-${cellDate.getMonth()}-${cellDate.getDate()}`;
      const isToday  = cellKey === todayKey;
      const ms = c.outside
        ? []
        : membersForCell(viewYear, viewMonth, c.day);
      const hasBdays = ms.length > 0;

      const chips = ms.slice(0, 3).map(m => `
        <span class="chip" title="${UI.escapeHtml(m.name)} — ${UI.escapeHtml(m.role)}">
          ${UI.escapeHtml(UI.initials(m.name))}
        </span>
      `).join("");
      const more = ms.length > 3
        ? `<span class="chip chip--more">+${ms.length - 3} more</span>`
        : "";

      const classes = [
        "calendar-cell",
        c.outside ? "calendar-cell--out" : "",
        isToday ? "calendar-cell--today" : "",
        hasBdays ? "calendar-cell--has-bdays" : "",
      ].filter(Boolean).join(" ");

      return `
        <div class="${classes}" data-day="${c.day}" data-month="${c.month}" data-year="${c.year}" data-idx="${idx}">
          <div class="calendar-cell__date">${c.day}</div>
          <div class="calendar-cell__chips">${chips}${more}</div>
        </div>`;
    }).join("");

    grid.innerHTML = headers + cellsHtml;

    // Wire up click → popover for cells with birthdays
    grid.querySelectorAll(".calendar-cell--has-bdays").forEach(cell => {
      cell.addEventListener("click", (ev) => {
        ev.stopPropagation();
        showPopover(cell);
      });
    });

    // Click anywhere else dismisses any open popover
    document.addEventListener("click", dismissPopover, { once: true });
  }

  function dismissPopover() {
    const existing = document.querySelector(".popover");
    if (existing) existing.remove();
  }

  function showPopover(cell) {
    dismissPopover();
    const day   = parseInt(cell.dataset.day, 10);
    const month = parseInt(cell.dataset.month, 10);
    const year  = parseInt(cell.dataset.year, 10);
    if (month !== viewMonth) return;
    const ms = membersForCell(year, month, day);
    if (!ms.length) return;

    const pop = document.createElement("div");
    pop.className = "popover";
    pop.innerHTML = `
      <h4 class="popover__title">${UI.MONTHS_LONG[month]} ${day}</h4>
      <ul class="popover__list">
        ${ms.map(m => `
          <li>
            <div class="popover__name">${UI.escapeHtml(m.name)}</div>
            <div class="popover__role">${UI.escapeHtml(m.role)}</div>
          </li>
        `).join("")}
      </ul>`;
    cell.style.position = "relative";
    cell.appendChild(pop);

    // Re-arm dismiss listener (excludes click on the popover itself)
    setTimeout(() => {
      const handler = (ev) => {
        if (!pop.contains(ev.target)) {
          pop.remove();
          document.removeEventListener("click", handler);
        }
      };
      document.addEventListener("click", handler);
    }, 0);
  }

  prevBtn.addEventListener("click", () => {
    viewMonth--;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    render();
  });
  nextBtn.addEventListener("click", () => {
    viewMonth++;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    render();
  });

  loadMembers();
})();
