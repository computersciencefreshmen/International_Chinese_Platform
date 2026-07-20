"""Cross-role browser smoke test for the complete platform workflow.

The suite deliberately establishes every authenticated session through the
real login page.  It then uses the request context attached to each browser
context for verbose setup transitions while keeping the important user-facing
checkpoints in the UI.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import traceback
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from playwright.sync_api import (
    APIRequestContext,
    Browser,
    BrowserContext,
    Page,
    Playwright,
    expect,
    sync_playwright,
)


BASE_URL = os.getenv("E2E_BASE_URL", "http://localhost:7777").rstrip("/")
API_URL = f"{BASE_URL}/api/v1"
ARTIFACT_DIR = Path("test-results/e2e")
DEMO_PASSWORD = "Demo123!"
ACCOUNTS = {
    "student": ("student@example.com", "我是学生", "/student/home"),
    "teacher": ("teacher@example.com", "我是老师", "/teacher/home"),
    "administrator": (
        "admin@example.com",
        "我是管理员",
        "/administrator/courseDocking",
    ),
}


def step(message: str) -> None:
    print(f"[e2e] {message}", flush=True)


def wait_for_health(timeout_seconds: int = 90) -> None:
    """Poll the production health endpoint before opening a browser."""

    deadline = time.monotonic() + timeout_seconds
    health_url = f"{API_URL}/health"
    last_error: BaseException | None = None

    while time.monotonic() < deadline:
        try:
            request = urllib.request.Request(
                health_url,
                headers={"Accept": "application/json"},
            )
            with urllib.request.urlopen(request, timeout=2) as response:
                payload = json.loads(response.read().decode("utf-8"))
                if response.status == 200 and payload.get("data", {}).get(
                    "status"
                ) == "ok":
                    step(f"service ready at {health_url}")
                    return
        except (
            OSError,
            TimeoutError,
            urllib.error.URLError,
            json.JSONDecodeError,
        ) as error:
            last_error = error

        time.sleep(0.5)

    raise RuntimeError(
        f"service did not become healthy within {timeout_seconds}s: {last_error}"
    )


def api_call(
    request: APIRequestContext,
    method: str,
    path: str,
    *,
    data: dict[str, Any] | None = None,
    params: dict[str, Any] | None = None,
) -> Any:
    """Call an authenticated API using the cookie jar from a UI context."""

    options: dict[str, Any] = {
        "method": method,
        "headers": {
            "Accept": "application/json",
            "Origin": BASE_URL,
        },
        "fail_on_status_code": False,
    }
    if data is not None:
        options["data"] = data
    if params is not None:
        options["params"] = params

    response = request.fetch(f"{API_URL}{path}", **options)
    raw_body = response.text()
    try:
        body = json.loads(raw_body)
    except json.JSONDecodeError as error:
        raise AssertionError(
            f"{method} {path} returned non-JSON HTTP {response.status}: "
            f"{raw_body[:500]}"
        ) from error

    if not response.ok or body.get("code") != 0:
        raise AssertionError(
            f"{method} {path} failed with HTTP {response.status}: "
            f"{json.dumps(body, ensure_ascii=False)}"
        )

    return body.get("data")


def wait_for_network(page: Page) -> None:
    try:
        page.wait_for_load_state("networkidle", timeout=15_000)
    except Exception:
        # A WebSocket or a very slow decorative asset must not mask the
        # concrete locator assertions that follow each navigation.
        page.wait_for_load_state("domcontentloaded", timeout=15_000)


def open_page(page: Page, path: str) -> None:
    page.goto(f"{BASE_URL}{path}", wait_until="domcontentloaded")
    wait_for_network(page)


def login_through_ui(page: Page, role: str) -> dict[str, Any]:
    email, role_label, expected_path = ACCOUNTS[role]
    step(f"logging in {role} through the UI")
    open_page(page, "/login")

    page.locator("main").get_by_text(role_label, exact=True).click()
    page.locator("#email").fill(email)
    page.locator("#password").fill(DEMO_PASSWORD)
    page.locator("main input[type='checkbox']").check()
    page.locator("main").get_by_role(
        "button", name="登录", exact=True
    ).click()
    page.wait_for_url(re.compile(rf"{re.escape(BASE_URL)}{expected_path}(?:\?.*)?$"))
    wait_for_network(page)

    profile = api_call(page.context.request, "GET", "/auth/session")
    assert profile["role"] == role, (
        f"UI login established the wrong role: expected {role}, "
        f"received {profile.get('role')}"
    )
    assert profile["email"] == email
    return profile


class WorkflowSuite:
    def __init__(self, playwright: Playwright) -> None:
        launch_options: dict[str, Any] = {"headless": True}
        executable_path = os.getenv("E2E_BROWSER_EXECUTABLE", "").strip()
        if executable_path:
            launch_options["executable_path"] = executable_path

        self.browser: Browser = playwright.chromium.launch(**launch_options)
        self.contexts: dict[str, BrowserContext] = {}
        self.pages: dict[str, Page] = {}
        self.console_messages: list[str] = []
        self.run_id = uuid.uuid4().hex[:10]

        for role in ACCOUNTS:
            context = self.browser.new_context(
                viewport={"width": 1440, "height": 1000},
                locale="zh-CN",
                timezone_id="Asia/Shanghai",
            )
            context.tracing.start(screenshots=True, snapshots=True, sources=True)
            page = context.new_page()
            page.set_default_timeout(20_000)
            page.on(
                "console",
                lambda message, current_role=role: self.console_messages.append(
                    f"[{current_role}] console.{message.type}: {message.text}"
                ),
            )
            page.on(
                "pageerror",
                lambda error, current_role=role: self.console_messages.append(
                    f"[{current_role}] pageerror: {error}"
                ),
            )
            self.contexts[role] = context
            self.pages[role] = page

    def close(self, *, failed: bool) -> None:
        ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
        if failed:
            (ARTIFACT_DIR / "browser.log").write_text(
                "\n".join(self.console_messages), encoding="utf-8"
            )

        for role, context in self.contexts.items():
            page = self.pages[role]
            if failed:
                try:
                    page.screenshot(
                        path=str(ARTIFACT_DIR / f"failure-{role}.png"),
                        full_page=True,
                    )
                except Exception as error:
                    self.console_messages.append(
                        f"[{role}] unable to capture screenshot: {error}"
                    )

            try:
                if failed:
                    context.tracing.stop(
                        path=str(ARTIFACT_DIR / f"trace-{role}.zip")
                    )
                else:
                    context.tracing.stop()
            except Exception as error:
                if failed:
                    self.console_messages.append(
                        f"[{role}] unable to save trace: {error}"
                    )
            context.close()

        if failed:
            (ARTIFACT_DIR / "browser.log").write_text(
                "\n".join(self.console_messages), encoding="utf-8"
            )
        self.browser.close()

    def establish_sessions(self) -> dict[str, dict[str, Any]]:
        return {
            role: login_through_ui(self.pages[role], role) for role in ACCOUNTS
        }

    def course_review_workflow(self) -> str:
        teacher = self.contexts["teacher"].request
        administrator = self.contexts["administrator"].request
        student = self.contexts["student"].request
        teacher_page = self.pages["teacher"]
        administrator_page = self.pages["administrator"]
        student_page = self.pages["student"]

        initial_title = f"E2E 跨文化会话 {self.run_id}"
        revised_title = f"{initial_title} 修订版"
        rejection_note = f"请补充跨文化任务说明 {self.run_id}"

        step("course: teacher creates a draft and submits it")
        course = api_call(
            teacher,
            "POST",
            "/courses",
            data={
                "title": initial_title,
                "summary": "用真实场景练习问候、追问与观点表达。",
                "description": "包含课前输入、课堂任务、同伴练习与课后复盘。",
                "level": "intermediate",
                "category": "文化口语",
                "coverUrl": None,
                "durationMinutes": 45,
                "priceCents": 8800,
                "capacity": 12,
            },
        )
        course_id = course["id"]
        submitted = api_call(teacher, "POST", f"/courses/{course_id}/submit")
        assert submitted["status"] == "pending"

        open_page(teacher_page, "/teacher/onlineCourses")
        teacher_card = teacher_page.locator("article.course-card").filter(
            has_text=initial_title
        )
        expect(teacher_card).to_be_visible()
        expect(teacher_card.get_by_text("待审核", exact=True)).to_be_visible()

        step("course: administrator sees and rejects the pending course")
        open_page(administrator_page, "/administrator/auditCenter")
        expect(
            administrator_page.get_by_text(initial_title, exact=True).first
        ).to_be_visible()
        rejected = api_call(
            administrator,
            "POST",
            f"/admin/course-reviews/{course_id}",
            data={"action": "reject", "note": rejection_note},
        )
        assert rejected["course"]["status"] == "rejected"

        open_page(administrator_page, "/administrator/auditCenter")
        administrator_page.get_by_role(
            "button", name="已驳回", exact=True
        ).click()
        expect(
            administrator_page.get_by_text(initial_title, exact=True).first
        ).to_be_visible()

        hidden = api_call(
            student,
            "GET",
            "/courses",
            params={"search": initial_title, "page": 1, "pageSize": 20},
        )
        assert hidden["items"] == [], "a rejected course leaked into student catalog"

        step("course: teacher revises, resubmits, and administrator approves")
        updated = api_call(
            teacher,
            "PATCH",
            f"/courses/{course_id}",
            data={
                "title": revised_title,
                "summary": "新增跨文化比较任务，并明确每个环节的学习产出。",
                "description": (
                    "课前阅读场景材料；课堂完成角色扮演和追问；"
                    "课后提交表达复盘。"
                ),
            },
        )
        assert updated["status"] == "rejected"
        resubmitted = api_call(
            teacher, "POST", f"/courses/{course_id}/submit"
        )
        assert resubmitted["status"] == "pending"

        open_page(teacher_page, "/teacher/onlineCourses")
        revised_card = teacher_page.locator("article.course-card").filter(
            has_text=revised_title
        )
        expect(revised_card).to_be_visible()
        expect(revised_card.get_by_text("待审核", exact=True)).to_be_visible()

        approved = api_call(
            administrator,
            "POST",
            f"/admin/course-reviews/{course_id}",
            data={
                "action": "approve",
                "note": "学习目标、活动与产出已经对齐，同意发布。",
            },
        )
        assert approved["course"]["status"] == "published"

        step("course: student finds the approved course in the real catalog UI")
        open_page(student_page, "/student/course")
        search = student_page.get_by_placeholder("搜索课程、简介或教师")
        search.fill(revised_title)
        search.press("Enter")
        expect(student_page.get_by_text(revised_title, exact=True).first).to_be_visible()

        return course_id

    def appointment_classroom_workflow(
        self, *, course_id: str, teacher_id: str
    ) -> None:
        student = self.contexts["student"].request
        teacher = self.contexts["teacher"].request
        student_page = self.pages["student"]
        teacher_page = self.pages["teacher"]
        topic = f"E2E 即时口语课堂 {self.run_id}"
        scheduled_start = datetime.now(timezone.utc) + timedelta(minutes=8)

        step("appointment: student requests a near-term lesson")
        appointment = api_call(
            student,
            "POST",
            "/appointments",
            data={
                "teacherId": teacher_id,
                "courseId": course_id,
                "topic": topic,
                "message": "希望练习跨文化寒暄和自然追问。",
                "scheduledStart": scheduled_start.isoformat(),
                "durationMinutes": 15,
            },
        )
        appointment_id = appointment["id"]
        assert appointment["status"] == "pending"

        open_page(teacher_page, "/teacher/teachingDocking")
        pending_card = teacher_page.locator("article.appointment-card").filter(
            has_text=topic
        )
        expect(pending_card).to_be_visible()
        expect(pending_card.get_by_text("等待处理", exact=True)).to_be_visible()

        step("appointment: teacher accepts and creates the dedicated classroom")
        accepted = api_call(
            teacher,
            "PATCH",
            f"/appointments/{appointment_id}/respond",
            data={"action": "accept", "note": "课堂材料已经准备好。"},
        )
        assert accepted["status"] == "accepted"
        assert accepted["classroom"]["id"]

        step("appointment: student sees the booking and enters through the UI")
        open_page(student_page, "/student/home")
        student_card = student_page.locator(".appointment-list article").filter(
            has_text=topic
        )
        expect(student_card).to_be_visible()
        expect(student_card.get_by_text("已确认", exact=True)).to_be_visible()
        student_card.get_by_role("button", name="进入课堂", exact=True).click()
        student_page.wait_for_url(re.compile(r"/student/liveClass\?classroomId="))
        expect(
            student_page.get_by_role("heading", name="实时互动课堂", exact=True)
        ).to_be_visible()
        expect(student_page.get_by_text("课堂消息", exact=True)).to_be_visible()

        step("appointment: student confirms classroom completion in the UI")
        student_page.get_by_role(
            "button", name="结束课堂", exact=True
        ).click()
        confirmation = student_page.locator(".el-message-box")
        expect(confirmation).to_be_visible()
        confirmation.get_by_role(
            "button", name="结束课堂", exact=True
        ).click()
        student_page.wait_for_url(re.compile(r"/student/home(?:\?.*)?$"))

        completed = api_call(
            student,
            "GET",
            "/appointments",
            params={"status": "completed", "page": 1, "pageSize": 100},
        )
        matching = [item for item in completed["items"] if item["id"] == appointment_id]
        assert len(matching) == 1 and matching[0]["status"] == "completed"

    def assignment_workflow(self, *, course_id: str) -> None:
        teacher = self.contexts["teacher"].request
        student = self.contexts["student"].request
        teacher_page = self.pages["teacher"]
        student_page = self.pages["student"]
        assignment_title = f"E2E 表达复盘 {self.run_id}"
        prompt = f"请写一句包含“因为…所以…”的课堂复盘（{self.run_id}）。"
        feedback = f"结构完整，连接词使用自然。E2E-{self.run_id}"

        step("assignment: teacher creates and publishes a real assignment")
        assignment = api_call(
            teacher,
            "POST",
            f"/courses/{course_id}/assignments",
            data={
                "title": assignment_title,
                "instructions": "结合刚才的口语课堂完成一段简短复盘。",
                "dueAt": (
                    datetime.now(timezone.utc) + timedelta(days=2)
                ).isoformat(),
                "maxScore": 100,
                "questions": [
                    {
                        "type": "text",
                        "prompt": prompt,
                        "correctAnswer": "因为我认真练习，所以表达更自然了。",
                        "points": 100,
                        "explanation": "关注关联词是否完整、语序是否自然。",
                    }
                ],
            },
        )
        assignment_id = assignment["id"]
        question_id = assignment["questions"][0]["id"]
        published = api_call(
            teacher, "POST", f"/assignments/{assignment_id}/publish"
        )
        assert published["status"] == "published"

        open_page(
            teacher_page,
            f"/teacher/courseDetails?id={course_id}&assignmentId={assignment_id}",
        )
        expect(
            teacher_page.get_by_text(assignment_title, exact=True).first
        ).to_be_visible()

        step("assignment: student sees it in the workbook and submits")
        open_page(
            student_page,
            f"/student/homeWork?courseId={course_id}&assignmentId={assignment_id}",
        )
        expect(
            student_page.get_by_text(assignment_title, exact=True).first
        ).to_be_visible()
        submission = api_call(
            student,
            "POST",
            f"/assignments/{assignment_id}/submissions",
            data={
                "answers": {
                    question_id: "因为今天反复练习，所以我的表达更自然了。"
                },
                "action": "submit",
            },
        )
        assert submission["status"] == "submitted"

        step("assignment: teacher grades, then student sees score and feedback")
        graded = api_call(
            teacher,
            "PATCH",
            f"/submissions/{submission['id']}/grade",
            data={"score": 93, "feedback": feedback},
        )
        assert graded["status"] == "graded"
        assert graded["score"] == 93

        open_page(
            student_page,
            f"/student/homeWork?submissionId={submission['id']}",
        )
        feedback_card = student_page.locator(".feedback-card")
        expect(feedback_card).to_be_visible()
        expect(feedback_card.get_by_text("93", exact=True)).to_be_visible()
        expect(feedback_card.get_by_text(feedback, exact=True)).to_be_visible()

    def teacher_verification_workflow(
        self,
        *,
        teacher_id: str,
        teacher_email: str,
        teacher_display_name: str,
    ) -> None:
        administrator = self.contexts["administrator"].request
        student = self.contexts["student"].request
        administrator_page = self.pages["administrator"]
        student_page = self.pages["student"]
        revocation_reason = f"E2E 定期复核教师材料 {self.run_id}"
        approval_note = f"E2E 已完成人工复核 {self.run_id}"

        def restore_verified_state() -> None:
            """Best-effort cleanup when an assertion interrupts the UI flow."""

            try:
                pending = api_call(
                    administrator,
                    "GET",
                    "/admin/teacher-verifications",
                    params={
                        "status": "pending",
                        "search": teacher_email,
                        "page": 1,
                        "pageSize": 10,
                    },
                )
                if any(item["id"] == teacher_id for item in pending["items"]):
                    api_call(
                        administrator,
                        "POST",
                        f"/admin/teacher-verifications/{teacher_id}",
                        data={
                            "action": "approve",
                            "note": f"E2E 失败清理：恢复种子教师认证 {self.run_id}",
                        },
                    )
                    step("teacher verification: cleanup restored verified state")
            except BaseException as error:
                step(
                    "teacher verification: unable to restore verified state: "
                    f"{error}"
                )

        try:
            step("teacher verification: administrator opens the verified queue")
            open_page(administrator_page, "/administrator/auditCenter")
            administrator_page.get_by_role(
                "button", name="教师身份认证", exact=True
            ).click()
            verification_panel = administrator_page.locator(
                "section.teacher-verification"
            )
            expect(verification_panel).to_be_visible()
            verification_panel.get_by_role(
                "button", name="已认证", exact=True
            ).click()
            admin_search = verification_panel.get_by_placeholder(
                "搜索教师、邮箱或任职机构"
            )
            admin_search.fill(teacher_email)
            admin_search.press("Enter")

            verified_row = verification_panel.locator(
                "tr.el-table__row"
            ).filter(has_text=teacher_email).first
            expect(verified_row).to_be_visible()
            expect(
                verified_row.get_by_text(teacher_display_name, exact=True)
            ).to_be_visible()

            step("teacher verification: administrator revokes through the UI")
            verified_row.get_by_role(
                "button", name="撤销认证", exact=True
            ).click()
            revoke_dialog = administrator_page.locator(".el-dialog:visible")
            expect(revoke_dialog).to_be_visible()
            revoke_dialog.locator("textarea").fill(revocation_reason)
            revoke_dialog.get_by_role(
                "button", name="确认撤销", exact=True
            ).click()
            expect(revoke_dialog).to_be_hidden()
            expect(verified_row).to_have_count(0)

            step(
                "teacher verification: student cannot discover, open, or book "
                "the revoked teacher"
            )
            open_page(student_page, "/student/order")
            student_search = student_page.get_by_placeholder(
                "搜索教师、学校或教学方向"
            )
            student_search.fill(teacher_display_name)
            student_search.press("Enter")
            hidden_card = student_page.locator("article.teacher-card").filter(
                has_text=teacher_display_name
            )
            expect(hidden_card).to_have_count(0)
            expect(
                student_page.get_by_text(
                    "没有找到符合条件的教师", exact=True
                )
            ).to_be_visible()

            open_page(
                student_page,
                f"/student/teacherDetail?teacherId={teacher_id}",
            )
            expect(
                student_page.get_by_text("教师资料无法加载", exact=True)
            ).to_be_visible()

            booking_response = student.fetch(
                f"{API_URL}/appointments",
                method="POST",
                headers={
                    "Accept": "application/json",
                    "Origin": BASE_URL,
                },
                data={
                    "teacherId": teacher_id,
                    "courseId": None,
                    "topic": f"E2E 认证门禁预约 {self.run_id}",
                    "message": "该请求应被教师认证门禁拒绝。",
                    "scheduledStart": (
                        datetime.now(timezone.utc) + timedelta(days=30)
                    ).isoformat(),
                    "durationMinutes": 15,
                },
                fail_on_status_code=False,
            )
            booking_body = json.loads(booking_response.text())
            assert booking_response.status == 409, (
                "a revoked teacher unexpectedly accepted an appointment: "
                f"HTTP {booking_response.status} {booking_response.text()}"
            )
            assert booking_body.get("msg") == "该教师尚未通过平台认证，暂不可预约"

            step("teacher verification: administrator reapproves through the UI")
            verification_panel.get_by_role(
                "button", name="待认证", exact=True
            ).click()
            pending_row = verification_panel.locator(
                "tr.el-table__row"
            ).filter(has_text=teacher_email).first
            expect(pending_row).to_be_visible()
            pending_row.get_by_role(
                "button", name="通过认证", exact=True
            ).click()
            approve_dialog = administrator_page.locator(".el-dialog:visible")
            expect(approve_dialog).to_be_visible()
            approve_dialog.locator("textarea").fill(approval_note)
            approve_dialog.get_by_role(
                "button", name="确认通过", exact=True
            ).click()
            expect(approve_dialog).to_be_hidden()
            expect(pending_row).to_have_count(0)

            step("teacher verification: student discovers the teacher again")
            open_page(student_page, "/student/order")
            student_search = student_page.get_by_placeholder(
                "搜索教师、学校或教学方向"
            )
            student_search.fill(teacher_display_name)
            student_search.press("Enter")
            restored_card = student_page.locator("article.teacher-card").filter(
                has_text=teacher_display_name
            )
            expect(restored_card).to_be_visible()
            expect(
                restored_card.get_by_text("已认证", exact=True)
            ).to_be_visible()
        finally:
            restore_verified_state()

    def run(self) -> None:
        profiles = self.establish_sessions()
        course_id = self.course_review_workflow()
        self.appointment_classroom_workflow(
            course_id=course_id,
            teacher_id=profiles["teacher"]["id"],
        )
        self.assignment_workflow(course_id=course_id)
        self.teacher_verification_workflow(
            teacher_id=profiles["teacher"]["id"],
            teacher_email=profiles["teacher"]["email"],
            teacher_display_name=profiles["teacher"]["displayName"],
        )


def main() -> int:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    wait_for_health()
    suite: WorkflowSuite | None = None
    failed = False

    try:
        with sync_playwright() as playwright:
            suite = WorkflowSuite(playwright)
            try:
                suite.run()
                step("all four cross-role workflows passed")
            except BaseException:
                failed = True
                raise
            finally:
                suite.close(failed=failed)
        return 0
    except BaseException:
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
