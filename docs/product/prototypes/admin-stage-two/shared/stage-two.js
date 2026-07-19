document.querySelectorAll("[data-demo-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = document.querySelector("[data-demo-notice]");
    if (!target) return;
    target.hidden = false;
    target.textContent = button.getAttribute("data-demo-message") ?? "设计参考：该动作必须由阶段二 Server 命令和独立复核完成。";
  });
});

document.querySelectorAll("[data-toggle-blockers]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = document.querySelector("[data-blockers]");
    if (!target) return;
    target.hidden = !target.hidden;
    button.setAttribute("aria-expanded", String(!target.hidden));
  });
});
