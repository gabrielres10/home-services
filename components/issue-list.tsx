import { groupIssuesForDisplay } from "@/lib/domain/issue-display";
import type { ValidationIssue } from "@/lib/domain/types";

export function IssueList({ issues }: { issues: ValidationIssue[] }) {
  const notices = groupIssuesForDisplay(issues);
  if (notices.length === 0) {
    return null;
  }

  return (
    <ul className="notice-list">
      {notices.map((notice, index) => (
        <li
          key={`${index}:${notice.title}`}
          className={
            notice.severity === "error" ? "notice notice-error" : "notice notice-warning"
          }
        >
          {notice.items.length === 0 ? (
            <>
              <span className="font-semibold">
                {notice.severity === "error" ? "Error: " : "Aviso: "}
              </span>
              {notice.title}
            </>
          ) : (
            <>
              <p className="notice-lead">{notice.title}</p>
              <ul className="notice-checks">
                {notice.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
