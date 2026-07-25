import type { ReactNode } from "react";

export function AdminMasterDetailWorkspace({
  label,
  master,
  detail,
  emptyTitle,
  emptyDescription,
}: Readonly<{
  label: string;
  master: ReactNode;
  detail?: ReactNode;
  emptyTitle: string;
  emptyDescription: string;
}>) {
  return (
    <section className="admin-master-detail-workspace" aria-label={label}>
      <section className="admin-master-detail-master" aria-label={`${label}列表`}>
        {master}
      </section>
      <section className="admin-master-detail-detail" aria-label={`${label}详情`}>
        {detail ?? (
          <div className="admin-master-detail-empty">
            <span aria-hidden="true">↗</span>
            <h2>{emptyTitle}</h2>
            <p>{emptyDescription}</p>
          </div>
        )}
      </section>
    </section>
  );
}
