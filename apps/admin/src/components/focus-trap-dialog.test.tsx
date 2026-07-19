import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FocusTrapDialog } from "./focus-trap-dialog";

function renderDialog(busy = false) {
  const onClose = vi.fn();
  render(
    <>
      <button type="button">背景操作</button>
      <FocusTrapDialog titleId="dialog-title" busy={busy} onClose={onClose}>
        <h2 id="dialog-title">确认操作</h2>
        <button type="button">返回检查</button>
        <button type="button">确认通过</button>
      </FocusTrapDialog>
    </>,
  );
  return onClose;
}

describe("FocusTrapDialog", () => {
  it("限制焦点在 Dialog 内并让背景 inert", async () => {
    const user = userEvent.setup();
    renderDialog();
    const dialog = screen.getByRole("dialog");
    const background = screen.getByRole("button", { name: "背景操作" });
    expect(background).toHaveAttribute("inert");
    expect(screen.getByRole("button", { name: "返回检查" })).toHaveFocus();

    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "确认通过" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "返回检查" })).toHaveFocus();
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("确认中不响应 Escape，关闭后恢复原焦点", async () => {
    const user = userEvent.setup();
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.textContent = "打开";
    document.body.append(trigger);
    trigger.focus();
    const onClose = renderDialog(true);

    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    trigger.remove();
  });
});
