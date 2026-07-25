import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  AdminEntryHeader,
  AdminEntryShell,
  AdminPageState,
} from "./admin-supporting-experience";

describe("Admin v2 辅助页面共享体验", () => {
  it("入口壳提供唯一主区域和产品化标题结构", () => {
    render(
      <AdminEntryShell label="后台登录">
        <section className="entry-card">
          <AdminEntryHeader
            eyebrow="安全登录"
            title="进入运营后台"
            description="使用已获准的工作账户继续。"
            showBrandMark
          />
        </section>
      </AdminEntryShell>,
    );

    expect(screen.getByRole("main", { name: "后台登录" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "进入运营后台" }))
      .toBeInTheDocument();
    expect(screen.getByText("使用已获准的工作账户继续。"))
      .toBeInTheDocument();
  });

  it("加载态使用忙碌语义并礼貌播报", () => {
    render(
      <AdminPageState
        tone="loading"
        title="正在加载成员"
        description="正在获取当前工作范围内的成员。"
      />,
    );

    const state = screen.getByRole("status");
    expect(state).toHaveAttribute("aria-busy", "true");
    expect(state).toHaveAttribute("aria-live", "polite");
  });

  it("错误态聚焦标题并支持主次恢复行动", async () => {
    const user = userEvent.setup();
    const onReturn = vi.fn();
    const onRetry = vi.fn();

    render(
      <AdminPageState
        tone="error"
        title="无法加载成员详情"
        description="记录不存在，或当前工作身份无法查看。"
        primaryAction={{ label: "返回成员列表", onAction: onReturn }}
        secondaryAction={{ label: "重新尝试", onAction: onRetry }}
        focusOnMount
      />,
    );

    const title = screen.getByRole("heading", {
      name: "无法加载成员详情",
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await waitFor(() => expect(title).toHaveFocus());

    await user.click(screen.getByRole("button", { name: "重新尝试" }));
    await user.click(screen.getByRole("button", { name: "返回成员列表" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onReturn).toHaveBeenCalledTimes(1);
  });
});
