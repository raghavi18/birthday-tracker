"""
End-to-end browser test for the Birthday Tracker frontend.
Spins up the Flask backend and a static-file server for the frontend,
then runs Playwright through every page exercising real workflows.
"""
import asyncio
import datetime
import os
import socket
import subprocess
import sys
import time
from playwright.async_api import async_playwright

ROOT = "/home/claude/birthday-tracker"

PASS = 0
FAIL = 0
FAILURES = []


def check(label, condition, detail=""):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  PASS  {label}")
    else:
        FAIL += 1
        FAILURES.append(f"{label} :: {detail}")
        print(f"  FAIL  {label}  ::  {detail}")


def free_port():
    s = socket.socket()
    s.bind(("", 0))
    p = s.getsockname()[1]
    s.close()
    return p


async def main():
    # Pick free ports
    api_port = 5050
    web_port = 8765

    # Clean DB
    db = os.path.join(ROOT, "backend", "birthdays.db")
    if os.path.exists(db):
        os.remove(db)
    backups = os.path.join(ROOT, "backend", "backups")
    for f in os.listdir(backups):
        if f.endswith(".json"):
            os.remove(os.path.join(backups, f))

    # Start Flask backend
    flask_proc = subprocess.Popen(
        [sys.executable, "app.py"],
        cwd=os.path.join(ROOT, "backend"),
        env={**os.environ, "PORT": str(api_port)},
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    # Start static file server for frontend
    web_proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(web_port)],
        cwd=os.path.join(ROOT, "frontend"),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    # Wait for both to be live
    for _ in range(30):
        try:
            import urllib.request
            urllib.request.urlopen(f"http://localhost:{api_port}/api/health", timeout=1)
            urllib.request.urlopen(f"http://localhost:{web_port}/", timeout=1)
            break
        except Exception:
            time.sleep(0.2)
    else:
        print("Servers failed to start.")
        flask_proc.terminate()
        web_proc.terminate()
        sys.exit(1)

    print("Servers up. Launching browser...")

    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch()
            context = await browser.new_context(viewport={"width": 1280, "height": 900})
            page = await context.new_page()

            # Capture console errors. Filter out:
            #   - Expected HTTP 4xx responses (these are how the API communicates
            #     validation errors and are intentional - the browser always logs them)
            #   - favicon.ico 403/404 noise from the static dev server
            console_errors = []
            def is_expected(text):
                t = (text or "").lower()
                if "favicon" in t: return True
                if "failed to load resource" in t and "status of 4" in t: return True
                return False
            page.on("pageerror", lambda exc: console_errors.append(f"pageerror: {exc}"))
            page.on("console", lambda msg: (
                console_errors.append(f"console.{msg.type}: {msg.text}")
                if msg.type == "error" and not is_expected(msg.text) else None
            ))

            BASE = f"http://localhost:{web_port}"

            # ----------------- DASHBOARD (empty) -----------------
            print("\n=== DASHBOARD (empty state) ===")
            await page.goto(f"{BASE}/index.html")
            await page.wait_for_function(
                "document.getElementById('todayContainer') && !document.getElementById('todayContainer').classList.contains('is-loading')"
            )
            today_html = await page.inner_html("#todayContainer")
            check("dashboard renders empty today state", "No birthdays today" in today_html, today_html[:200])
            upcoming_html = await page.inner_html("#upcomingContainer")
            check("dashboard renders empty upcoming state", "No birthdays in the next 7" in upcoming_html, upcoming_html[:200])

            # Verify nav exists
            nav_links = await page.locator(".nav a").all_inner_texts()
            check("nav has 4 links", len(nav_links) == 4, str(nav_links))

            # ----------------- MEMBERS PAGE - ADD A MEMBER -----------------
            print("\n=== MEMBERS - Add member ===")
            await page.goto(f"{BASE}/members.html")
            await page.wait_for_selector("#tableContainer")

            today = datetime.date.today()

            await page.fill("#name", "Eve Evans")
            await page.fill("#role", "Senior Consultant")
            await page.select_option("#birthMonth", str(today.month))
            await page.wait_for_function(f"document.getElementById('birthDay').options.length > 1")
            await page.select_option("#birthDay", str(today.day))
            await page.fill("#email", "eve@example.com")
            await page.click("#submitBtn")

            # Wait for the table to show the new member
            await page.wait_for_function(
                "document.querySelector('.data-table') && document.querySelector('.data-table tbody tr')"
            )
            table_html = await page.inner_html("#tableContainer")
            check("Eve appears in table", "Eve Evans" in table_html, table_html[:300])
            check("Eve role in table", "Senior Consultant" in table_html, table_html[:300])

            # ----------------- MEMBERS - DUPLICATE EMAIL -----------------
            print("\n=== MEMBERS - Duplicate email blocks ===")
            await page.fill("#name", "Eve Two")
            await page.fill("#role", "Manager")
            await page.select_option("#birthMonth", "6")
            await page.wait_for_function("document.getElementById('birthDay').options.length > 1")
            await page.select_option("#birthDay", "10")
            await page.fill("#email", "eve@example.com")
            await page.click("#submitBtn")
            await page.wait_for_selector("#err_email", state="visible")
            err_text = await page.inner_text("#err_email")
            check("dup email shows error", "already exists" in err_text.lower(), err_text)

            # Reset
            await page.click("#resetBtn")
            err_visible = await page.is_visible("#err_email")
            # err_email div is always present, but the .has-error class should be removed
            field_class = await page.get_attribute("div.form__field:has(#email)", "class")
            check("reset clears error class", "has-error" not in (field_class or ""), field_class or "")

            # ----------------- MEMBERS - SOFT DUPLICATE WARNING -----------------
            print("\n=== MEMBERS - Soft duplicate warning ===")
            await page.fill("#name", "Eve Evans")
            await page.fill("#role", "Other Role")
            await page.select_option("#birthMonth", str(today.month))
            await page.wait_for_function("document.getElementById('birthDay').options.length > 1")
            await page.select_option("#birthDay", str(today.day))
            await page.fill("#email", "eve.alt@example.com")
            await page.click("#submitBtn")
            await page.wait_for_selector("#formBanner.is-visible.banner--warning")
            banner_text = await page.inner_text("#formBanner")
            check("soft dup warning shown", "different person" in banner_text.lower(), banner_text)
            check("confirm button present", await page.is_visible("#confirmDup"))
            await page.click("#confirmDup")
            # Wait for the second Eve to appear in the table
            await page.wait_for_function(
                "document.querySelectorAll('.data-table tbody tr').length === 2"
            )
            row_count = await page.locator(".data-table tbody tr").count()
            check("two Eves now exist", row_count == 2, f"row_count={row_count}")

            # ----------------- MEMBERS - EDIT -----------------
            print("\n=== MEMBERS - Edit ===")
            # Click the first Edit button
            await page.locator(".js-edit").first.click()
            await page.wait_for_function("document.getElementById('memberId').value !== ''")
            current_role = await page.input_value("#role")
            check("edit pre-fills role", current_role in ("Senior Consultant", "Other Role"), current_role)

            await page.fill("#role", "Engagement Manager")
            await page.click("#submitBtn")
            await page.wait_for_function(
                "document.querySelector('.data-table').innerText.includes('Engagement Manager')"
            )
            check("edit updates table", True)

            # Form should reset after edit
            edit_id = await page.input_value("#memberId")
            check("form reset after edit", edit_id == "", f"id was {edit_id!r}")

            # ----------------- MEMBERS - SEARCH -----------------
            print("\n=== MEMBERS - Search ===")
            await page.fill("#searchInput", "evans")
            # Both Eves match
            await page.wait_for_timeout(200)
            visible_rows = await page.locator(".data-table tbody tr").count()
            check("search 'evans' matches 2", visible_rows == 2, f"got {visible_rows}")

            await page.fill("#searchInput", "zzznotreal")
            await page.wait_for_function("document.querySelector('.data-table__empty')")
            check("search with no match shows empty state", True)
            await page.fill("#searchInput", "")
            await page.wait_for_timeout(150)

            # ----------------- MEMBERS - DELETE -----------------
            print("\n=== MEMBERS - Delete ===")
            initial_rows = await page.locator(".data-table tbody tr").count()
            await page.locator(".js-delete").first.click()
            await page.wait_for_selector("#deleteModal.is-visible")
            check("delete modal opens", True)
            await page.click("#confirmDelete")
            await page.wait_for_function(
                f"document.querySelectorAll('.data-table tbody tr').length === {initial_rows - 1}"
            )
            new_rows = await page.locator(".data-table tbody tr").count()
            check("delete removes a row", new_rows == initial_rows - 1, f"{initial_rows} -> {new_rows}")

            # ----------------- DASHBOARD WITH DATA -----------------
            print("\n=== DASHBOARD with data ===")
            # Add a person 2 days from now via the form quickly
            future = today + datetime.timedelta(days=2)
            await page.fill("#name", "Frank Future")
            await page.fill("#role", "Director")
            await page.select_option("#birthMonth", str(future.month))
            await page.wait_for_function("document.getElementById('birthDay').options.length > 1")
            await page.select_option("#birthDay", str(future.day))
            await page.fill("#email", "frank@example.com")
            await page.click("#submitBtn")
            await page.wait_for_function(
                "document.querySelector('.data-table').innerText.includes('Frank')"
            )

            await page.goto(f"{BASE}/index.html")
            await page.wait_for_function(
                "!document.getElementById('todayContainer').classList.contains('is-loading')"
            )
            today_html = await page.inner_html("#todayContainer")
            check("today shows Eve", "Eve Evans" in today_html, today_html[:300])
            mailto_count = await page.locator('a[href^="mailto:"]').count()
            check("today section has at least one mailto", mailto_count >= 1, f"count={mailto_count}")

            upcoming_html = await page.inner_html("#upcomingContainer")
            check("upcoming shows Frank", "Frank Future" in upcoming_html, upcoming_html[:300])
            check("upcoming shows 'In 2 days'", "In 2 days" in upcoming_html or "Tomorrow" in upcoming_html, upcoming_html[:300])

            # ----------------- CALENDAR -----------------
            print("\n=== CALENDAR ===")
            await page.goto(f"{BASE}/calendar.html")
            await page.wait_for_function("document.querySelectorAll('.calendar-cell').length > 0")
            month_label = await page.inner_text("#monthLabel")
            check("calendar shows current month", str(today.year) in month_label, month_label)
            # The current day cell should be highlighted as today
            today_cell_count = await page.locator(".calendar-cell--today").count()
            check("calendar has a 'today' cell", today_cell_count == 1, f"count={today_cell_count}")
            # Should have at least 1 cell with bdays (Eve, today)
            bday_cells = await page.locator(".calendar-cell--has-bdays").count()
            check("calendar has at least one bday cell", bday_cells >= 1, f"count={bday_cells}")

            # Click a bday cell and check popover appears
            await page.locator(".calendar-cell--has-bdays").first.click()
            await page.wait_for_selector(".popover")
            popover_text = await page.inner_text(".popover")
            check("popover shows a name", "Eve" in popover_text or "Frank" in popover_text, popover_text)

            # Test month navigation
            await page.click("#nextMonth")
            await page.wait_for_function(f"!document.getElementById('monthLabel').innerText.includes('{month_label}')")
            new_label = await page.inner_text("#monthLabel")
            check("next month navigates", new_label != month_label, f"{month_label} -> {new_label}")

            await page.click("#prevMonth")
            await page.click("#prevMonth")
            check("prev month works (no crash)", True)

            # ----------------- EXPORT PAGE -----------------
            print("\n=== EXPORT ===")
            await page.goto(f"{BASE}/export.html")
            await page.wait_for_function("!document.getElementById('backupStatus').classList.contains('is-loading')")
            backup_html = await page.inner_html("#backupStatus")
            check("backup status loaded", "Last backup" in backup_html or "No backup" in backup_html, backup_html[:200])

            csv_href = await page.get_attribute("#csvBtn", "href")
            xlsx_href = await page.get_attribute("#xlsxBtn", "href")
            check("CSV link points to API", csv_href and "/api/export/csv" in csv_href, csv_href or "")
            check("XLSX link points to API", xlsx_href and "/api/export/xlsx" in xlsx_href, xlsx_href or "")

            # Actually trigger the download
            async with page.expect_download() as dl_info:
                await page.click("#csvBtn")
            dl = await dl_info.value
            csv_path = await dl.path()
            check("CSV downloaded", csv_path is not None, str(csv_path))
            if csv_path:
                with open(csv_path, "r") as f:
                    csv_content = f.read()
                check("CSV contains Eve", "Eve Evans" in csv_content, csv_content[:300])
                check("CSV contains Frank", "Frank Future" in csv_content, csv_content[:300])
                check("CSV has header row", csv_content.startswith("ID,Name,Role"), csv_content[:60])

            # ----------------- CONSOLE ERRORS CHECK -----------------
            print("\n=== CONSOLE ===")
            check("no JS console errors", len(console_errors) == 0, str(console_errors))

            # ----------------- MOBILE VIEWPORT -----------------
            print("\n=== MOBILE VIEWPORT ===")
            mobile_ctx = await browser.new_context(viewport={"width": 380, "height": 700})
            mpage = await mobile_ctx.new_page()
            mpage.on("pageerror", lambda exc: console_errors.append(f"mobile: {exc}"))
            await mpage.goto(f"{BASE}/index.html")
            await mpage.wait_for_function(
                "!document.getElementById('todayContainer').classList.contains('is-loading')"
            )
            check("mobile dashboard loads", True)
            await mpage.goto(f"{BASE}/members.html")
            await mpage.wait_for_selector("#tableContainer")
            check("mobile members loads", True)
            await mobile_ctx.close()

            await browser.close()
    finally:
        flask_proc.terminate()
        web_proc.terminate()
        flask_proc.wait(timeout=5)
        web_proc.wait(timeout=5)

    print(f"\n=== SUMMARY ===\nPASSED: {PASS}\nFAILED: {FAIL}")
    if FAILURES:
        for f in FAILURES:
            print(f"  - {f}")
        sys.exit(1)
    print("All E2E tests passed.")


if __name__ == "__main__":
    asyncio.run(main())
