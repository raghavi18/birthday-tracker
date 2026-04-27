// =========================================================================
// Export page controller
// =========================================================================
(function () {
  UI.activateNav();

  document.getElementById("csvBtn").href = API.exportCsvUrl();
  document.getElementById("xlsxBtn").href = API.exportXlsxUrl();

  const status = document.getElementById("backupStatus");

  async function loadBackupInfo() {
    try {
      const info = await API.backupInfo();
      status.classList.remove("is-loading");
      if (!info.exists) {
        status.innerHTML = `<div class="banner banner--warning is-visible">No backup snapshot has been written yet. Add or edit a member to trigger the first backup.</div>`;
        return;
      }
      const dt = new Date(info.modified_at);
      const niceDate = dt.toLocaleString(undefined, {
        year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit"
      });
      const sizeKb = (info.size_bytes / 1024).toFixed(1);
      status.innerHTML = `
        <table class="data-table" style="background: transparent;">
          <tbody>
            <tr>
              <td data-label="Last backup" style="font-weight:600; width: 200px;">Last backup written</td>
              <td data-label="Last backup">${niceDate}</td>
            </tr>
            <tr>
              <td data-label="Snapshot size" style="font-weight:600;">Snapshot size</td>
              <td data-label="Snapshot size">${sizeKb} KB</td>
            </tr>
            <tr>
              <td data-label="Snapshot file" style="font-weight:600;">Snapshot file</td>
              <td data-label="Snapshot file"><code>backups/latest.json</code></td>
            </tr>
          </tbody>
        </table>
      `;
    } catch (err) {
      status.classList.remove("is-loading");
      status.innerHTML = `<div class="banner banner--error is-visible">${
        err.network ? "Could not reach the backend." : "Failed to load backup info."
      }</div>`;
    }
  }

  loadBackupInfo();
})();
