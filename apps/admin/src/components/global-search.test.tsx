import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GlobalSearch } from "./global-search";

const items = [
  {
    id: "workbench",
    label: "工作台",
    route: "/admin/workbench",
    availability: "available",
    children: [],
  },
  {
    id: "driver_vehicle",
    label: "车主与车辆",
    route: "/admin/fleet",
    availability: "available",
    children: [],
  },
] as const;

describe("GlobalSearch", () => {
  it("支持斜杠打开、输入筛选、Escape 清空并恢复触发按钮焦点", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch items={items} onNavigate={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: /全局搜索/ });

    await user.keyboard("/");
    const input = screen.getByRole("textbox", { name: "全局搜索" });
    expect(input).toHaveFocus();
    await user.type(input, "车辆");
    expect(screen.getByRole("button", { name: "车主与车辆" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("textbox", { name: "全局搜索" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("点击结果后导航并恢复触发按钮焦点", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<GlobalSearch items={items} onNavigate={onNavigate} />);
    await user.click(screen.getByRole("button", { name: /全局搜索/ }));
    await user.click(screen.getByRole("button", { name: "工作台" }));

    expect(onNavigate).toHaveBeenCalledWith("workbench");
    expect(screen.getByRole("button", { name: /全局搜索/ })).toHaveFocus();
  });
});
