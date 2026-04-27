// =========================================================================
// Members page controller — registration, edit, delete, search, paginate.
// =========================================================================
(function () {
  UI.activateNav();

  // -------- DOM refs --------
  const form        = document.getElementById("memberForm");
  const formBanner  = document.getElementById("formBanner");
  const formMode    = document.getElementById("formMode");
  const formHint    = document.getElementById("formHint");
  const submitBtn   = document.getElementById("submitBtn");
  const resetBtn    = document.getElementById("resetBtn");

  const memberIdInp = document.getElementById("memberId");
  const nameInp     = document.getElementById("name");
  const roleInp     = document.getElementById("role");
  const monthSel    = document.getElementById("birthMonth");
  const daySel      = document.getElementById("birthDay");
  const emailInp    = document.getElementById("email");

  const tableContainer = document.getElementById("tableContainer");
  const memberCount    = document.getElementById("memberCount");
  const searchInput    = document.getElementById("searchInput");

  const deleteModal    = document.getElementById("deleteModal");
  const deleteMessage  = document.getElementById("deleteMessage");
  const cancelDeleteBtn = document.getElementById("cancelDelete");
  const confirmDeleteBtn = document.getElementById("confirmDelete");

  // -------- State --------
  let members = [];
  let editingId = null;
  let pendingDeleteId = null;
  let lastSubmittedPayload = null; // for soft-duplicate confirm flow
  let searchTerm = "";
  let currentPage = 1;
  const PAGE_SIZE = 25;

  // -------- Build month/day pickers --------
  for (let m = 1; m <= 12; m++) {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = UI.MONTHS_LONG[m - 1];
    monthSel.appendChild(opt);
  }

  function rebuildDayOptions() {
    const m = parseInt(monthSel.value, 10);
    daySel.innerHTML = `<option value="">Day</option>`;
    if (!m) { daySel.disabled = true; return; }
    daySel.disabled = false;
    const max = UI.DAYS_IN_MONTH[m - 1]; // 29 for Feb (leap-day allowed)
    for (let d = 1; d <= max; d++) {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      daySel.appendChild(opt);
    }
  }
  monthSel.addEventListener("change", () => {
    const previousDay = parseInt(daySel.value, 10);
    rebuildDayOptions();
    // Try to keep the day if it's still valid
    if (previousDay && previousDay <= UI.DAYS_IN_MONTH[parseInt(monthSel.value, 10) - 1]) {
      daySel.value = previousDay;
    }
  });

  // -------- Banners + per-field errors --------
  function clearErrors() {
    form.querySelectorAll(".form__field").forEach(f => f.classList.remove("has-error"));
    formBanner.classList.remove("is-visible", "banner--error", "banner--warning", "banner--success");
    formBanner.innerHTML = "";
  }

  function showFieldErrors(errs) {
    Object.entries(errs).forEach(([key, msg]) => {
      const id = `err_${key}`;
      const node = document.getElementById(id);
      if (!node) return;
      node.textContent = msg;
      node.parentElement.classList.add("has-error");
    });
  }

  function showBanner(html, kind) {
    formBanner.innerHTML = html;
    formBanner.classList.add("is-visible", `banner--${kind}`);
  }

  // -------- Form: fill / reset --------
  function resetForm() {
    editingId = null;
    lastSubmittedPayload = null;
    formMode.textContent = "Add a new member";
    submitBtn.textContent = "Save Member";
    memberIdInp.value = "";
    nameInp.value = "";
    roleInp.value = "";
    monthSel.value = "";
    rebuildDayOptions();
    emailInp.value = "";
    clearErrors();
    formHint.textContent = "No year is collected — only month and day.";
  }

  function loadIntoForm(member) {
    editingId = member.id;
    lastSubmittedPayload = null;
    formMode.textContent = `Editing: ${member.name}`;
    submitBtn.textContent = "Save Changes";
    memberIdInp.value = member.id;
    nameInp.value = member.name;
    roleInp.value = member.role;
    monthSel.value = member.birthday_month;
    rebuildDayOptions();
    daySel.value = member.birthday_day;
    emailInp.value = member.email;
    clearErrors();
    formHint.textContent = `ID #${member.id} · created ${member.created_at?.slice(0, 10) || ""}`;
    // Scroll the form into view for clarity
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  resetBtn.addEventListener("click", resetForm);

  // -------- Form submit --------
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    clearErrors();

    const payload = {
      name: nameInp.value.trim(),
      role: roleInp.value.trim(),
      birthday_month: monthSel.value ? parseInt(monthSel.value, 10) : null,
      birthday_day: daySel.value ? parseInt(daySel.value, 10) : null,
      email: emailInp.value.trim().toLowerCase(),
    };

    // Light client-side validation (server is the source of truth)
    const localErrors = {};
    if (!payload.name) localErrors.name = "Name is required.";
    else if (payload.name.length < 2) localErrors.name = "Name must be at least 2 characters.";
    if (!payload.role) localErrors.role = "Role is required.";
    if (!payload.birthday_month || !payload.birthday_day) localErrors.birthday = "Pick a month and a day.";
    if (!payload.email) localErrors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) localErrors.email = "Invalid email format.";

    if (Object.keys(localErrors).length) {
      showFieldErrors(localErrors);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Saving…";

    try {
      let saved;
      if (editingId) {
        saved = await API.updateMember(editingId, payload);
      } else {
        saved = await API.createMember(payload);
      }
      UI.showToast(editingId ? "Member updated." : "Member added.");
      resetForm();
      await reloadMembers();
    } catch (err) {
      handleSaveError(err, payload);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = editingId ? "Save Changes" : "Save Member";
    }
  });

  function handleSaveError(err, payload) {
    if (err.network) {
      showBanner("Could not reach the backend. Check that the API is running.", "error");
      return;
    }
    if (!err.data) {
      showBanner("Something went wrong saving this member.", "error");
      return;
    }
    // Server-side soft duplicate
    if (err.status === 409 && err.data.warning?.type === "soft_duplicate") {
      const w = err.data.warning;
      const existing = w.existing || {};
      showBanner(
        `<strong>${UI.escapeHtml(w.message)}</strong>
         <div style="margin-top:6px;font-size:13px;">
           Existing record: <code>${UI.escapeHtml(existing.name || "")}</code> · <code>${UI.escapeHtml(existing.email || "")}</code>
         </div>
         <div class="banner__actions">
           <button class="btn btn--small" id="confirmDup">Yes, this is a different person — save</button>
           <button class="btn btn--secondary btn--small" id="cancelDup">Cancel</button>
         </div>`,
        "warning"
      );
      lastSubmittedPayload = payload;
      document.getElementById("confirmDup").onclick = async () => {
        clearErrors();
        try {
          await API.createMember({ ...lastSubmittedPayload, confirm_duplicate: true });
          UI.showToast("Member added.");
          resetForm();
          await reloadMembers();
        } catch (e2) {
          handleSaveError(e2, lastSubmittedPayload);
        }
      };
      document.getElementById("cancelDup").onclick = () => {
        clearErrors();
      };
      return;
    }
    // Field errors
    if (err.data.errors) {
      showFieldErrors(err.data.errors);
      // Surface a generic banner if there's no field-bound error displayable
      const unknownKeys = Object.keys(err.data.errors).filter(k => !document.getElementById(`err_${k}`));
      if (unknownKeys.length) {
        showBanner(unknownKeys.map(k => `${k}: ${err.data.errors[k]}`).join("<br>"), "error");
      }
      return;
    }
    showBanner("Save failed.", "error");
  }

  // -------- Table --------
  function renderTable() {
    const filtered = members.filter(m => {
      if (!searchTerm) return true;
      const t = searchTerm.toLowerCase();
      return m.name.toLowerCase().includes(t)
          || m.role.toLowerCase().includes(t)
          || m.email.toLowerCase().includes(t);
    });

    memberCount.textContent = `${filtered.length} of ${members.length}`;

    if (!members.length) {
      tableContainer.classList.remove("is-loading");
      tableContainer.innerHTML = `<div class="data-table__empty">No members yet — add the first one above.</div>`;
      return;
    }
    if (!filtered.length) {
      tableContainer.classList.remove("is-loading");
      tableContainer.innerHTML = `<div class="data-table__empty">No members match "${UI.escapeHtml(searchTerm)}".</div>`;
      return;
    }

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageRows = filtered.slice(start, start + PAGE_SIZE);

    tableContainer.classList.remove("is-loading");
    tableContainer.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Birthday</th>
            <th>Email</th>
            <th style="text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${pageRows.map(m => `
            <tr data-id="${m.id}">
              <td data-label="Name">${UI.escapeHtml(m.name)}</td>
              <td data-label="Role">${UI.escapeHtml(m.role)}</td>
              <td data-label="Birthday">${UI.formatBirthday(m.birthday_month, m.birthday_day)}</td>
              <td data-label="Email">${UI.escapeHtml(m.email)}</td>
              <td data-label="Actions">
                <div class="row-actions">
                  <button class="btn btn--secondary btn--small js-edit" data-id="${m.id}">Edit</button>
                  <button class="btn btn--danger btn--small js-delete" data-id="${m.id}">Delete</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      ${totalPages > 1 ? `
        <div class="pagination">
          <button class="btn btn--secondary btn--small" id="prevPage" ${currentPage === 1 ? "disabled" : ""}>← Prev</button>
          <span class="pagination__info">Page ${currentPage} of ${totalPages}</span>
          <button class="btn btn--secondary btn--small" id="nextPage" ${currentPage === totalPages ? "disabled" : ""}>Next →</button>
        </div>` : ""}
    `;

    tableContainer.querySelectorAll(".js-edit").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.dataset.id, 10);
        const m = members.find(x => x.id === id);
        if (m) loadIntoForm(m);
      });
    });
    tableContainer.querySelectorAll(".js-delete").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.dataset.id, 10);
        const m = members.find(x => x.id === id);
        if (m) openDeleteModal(m);
      });
    });
    const prev = document.getElementById("prevPage");
    const next = document.getElementById("nextPage");
    if (prev) prev.addEventListener("click", () => { currentPage--; renderTable(); });
    if (next) next.addEventListener("click", () => { currentPage++; renderTable(); });
  }

  searchInput.addEventListener("input", () => {
    searchTerm = searchInput.value.trim();
    currentPage = 1;
    renderTable();
  });

  // -------- Delete --------
  function openDeleteModal(member) {
    pendingDeleteId = member.id;
    deleteMessage.textContent = `Are you sure you want to remove ${member.name}? This cannot be undone.`;
    deleteModal.classList.add("is-visible");
  }
  function closeDeleteModal() {
    pendingDeleteId = null;
    deleteModal.classList.remove("is-visible");
  }
  cancelDeleteBtn.addEventListener("click", closeDeleteModal);
  deleteModal.addEventListener("click", (ev) => {
    if (ev.target === deleteModal) closeDeleteModal();
  });
  confirmDeleteBtn.addEventListener("click", async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    closeDeleteModal();
    try {
      await API.deleteMember(id);
      UI.showToast("Member removed.");
      // If we were editing the same record, also reset the form.
      if (editingId === id) resetForm();
      await reloadMembers();
    } catch (err) {
      UI.showToast("Delete failed.", { type: "error" });
      console.error(err);
    }
  });

  // -------- Loading --------
  async function reloadMembers() {
    try {
      members = await API.listMembers();
      renderTable();
    } catch (err) {
      tableContainer.classList.remove("is-loading");
      tableContainer.innerHTML = `<div class="banner banner--error is-visible">${
        err.network ? "Could not reach the backend." : "Failed to load members."
      }</div>`;
      console.error(err);
    }
  }

  reloadMembers();
})();
