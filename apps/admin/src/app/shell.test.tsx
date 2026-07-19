import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Providers } from "./providers";
import { resolveExecutiveDashboardEnabled, Shell } from "./shell";

describe("运营后台首个合成审核切片", () => {
  it("阶段五入口对阶段一至四前端门禁失败关闭", () => {
    const allEnabled = {
      multiOrganizationEnabled: true,
      operatorManagementEnabled: true,
      tripOperationsEnabled: true,
      caseManagementEnabled: true,
      financeOperationsEnabled: true,
      executiveDashboardEnabled: true,
    };
    expect(resolveExecutiveDashboardEnabled(allEnabled)).toBe(true);
    for (const dependency of [
      "multiOrganizationEnabled",
      "operatorManagementEnabled",
      "tripOperationsEnabled",
      "caseManagementEnabled",
      "financeOperationsEnabled",
    ] as const) {
      expect(
        resolveExecutiveDashboardEnabled({
          ...allEnabled,
          [dependency]: false,
        }),
      ).toBe(false);
    }
  });

  it("从沙箱入口进入队列并认领任务", async () => {
    const user = userEvent.setup();
    render(<Providers><Shell /></Providers>);
    expect(screen.getByText(/仅合成数据/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "进入合成审核队列" }));
    expect(await screen.findByRole("heading", { name: "待审核任务" })).toBeInTheDocument();
    await user.click((await screen.findAllByRole("button", { name: "认领并查看" }))[0]!);
    expect(await screen.findByRole("heading", { name: "结构化审核字段" })).toBeInTheDocument();
    expect(screen.getByText("严格受限原文与安全证据在本切片中不可访问。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "存在风险，不能批准" })).toBeDisabled();
  });

  it("要求补充前必须预览用户文案", async () => {
    const user = userEvent.setup();
    render(<Providers><Shell /></Providers>);
    await user.click(screen.getByRole("button", { name: "进入合成审核队列" }));
    await user.click((await screen.findAllByRole("button", { name: "认领并查看" }))[0]!);
    await user.click(await screen.findByRole("button", { name: "要求补充材料" }));
    expect(screen.getByRole("button", { name: "确认要求补充" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "生成文案预览" }));
    expect(await screen.findByLabelText("用户可见文案预览")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认要求补充" })).toBeEnabled();
  });

  it("支持账户级明暗主题切换", async () => {
    const user = userEvent.setup();
    render(<Providers><Shell /></Providers>);
    await user.click(screen.getByRole("button", { name: "进入合成审核队列" }));
    await user.click(screen.getByRole("button", { name: "切换为深色主题" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("身份验证工作区仅展示自动结果且没有人工决定操作", async () => {
    const user = userEvent.setup();
    render(<Providers><Shell /></Providers>);
    await user.click(screen.getByRole("button", { name: "进入合成审核队列" }));
    await user.click(screen.getByRole("button", { name: "身份验证记录" }));
    expect(await screen.findByRole("heading", { name: "成年资格验证记录" })).toBeInTheDocument();
    expect(screen.getByText(/不能批准、拒绝或修改验证结果/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /批准验证|拒绝验证|认领验证/ })).not.toBeInTheDocument();
  });

  it("安全人员可处理申诉且看不到聊天正文", async () => {
    const user = userEvent.setup();
    render(<Providers><Shell /></Providers>);
    await user.click(screen.getByRole("button", { name: "进入合成审核队列" }));
    await user.click(screen.getByRole("button", { name: "安全案件" }));
    expect(await screen.findByRole("heading", { name: "安全案件" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "查看最小摘要" }));
    expect(screen.getByText(/聊天正文与原始证据不可用/)).toBeInTheDocument();
    expect(screen.queryByText("合成消息：")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "恢复访问" }));
    expect(await screen.findByText("已恢复")).toBeInTheDocument();
  });

  it("对无风险合成任务提交批准决定", async () => {
    const user = userEvent.setup();
    render(<Providers><Shell /></Providers>);
    await user.click(screen.getByRole("button", { name: "进入合成审核队列" }));
    await user.click((await screen.findAllByRole("button", { name: "认领并查看" }))[2]!);
    await user.click(await screen.findByRole("button", { name: "批准车辆" }));
    expect(screen.getByLabelText("审核结论用户文案预览")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "确认批准" }));
    expect(await screen.findByText("审核结论已提交")).toBeInTheDocument();
  });

  it("拒绝决定必须选择结构化原因并显示用户文案", async () => {
    const user = userEvent.setup();
    render(<Providers><Shell /></Providers>);
    await user.click(screen.getByRole("button", { name: "进入合成审核队列" }));
    await user.click((await screen.findAllByRole("button", { name: "认领并查看" }))[0]!);
    await user.click(await screen.findByRole("button", { name: "拒绝申请" }));
    await user.selectOptions(screen.getByLabelText("结构化拒绝原因"), "insurance_requirement_not_met");
    expect(screen.getByText("保险条件暂不符合要求")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "确认拒绝" }));
    expect(await screen.findByText("审核结论已提交")).toBeInTheDocument();
  });
});
