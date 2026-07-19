document.querySelectorAll("[data-mask-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = document.querySelector(button.dataset.maskToggle);
    if (!target) return;
    target.dataset.open = target.dataset.open === "true" ? "false" : "true";
    target.textContent = target.dataset.open === "true"
      ? "合成证据原文：仅用于当前案件演练，30 分钟后自动重新遮蔽。"
      : "严格敏感字段已遮蔽；访问需要工单、目的、字段范围和限时授权。";
  });
});
