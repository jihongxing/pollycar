const pretextElements = [...document.querySelectorAll("[data-pretext]")];
const prepared = new Map();

async function prepareText() {
  await document.fonts.ready;
  try {
    const { prepare } = await import("https://esm.sh/@chenglou/pretext");
    for (const element of pretextElements) {
      prepared.set(element, prepare(element.textContent ?? "", getComputedStyle(element).font));
    }
    window.__pretextLayout = async function relayout() {
      const { layout } = await import("https://esm.sh/@chenglou/pretext");
      for (const [element, handle] of prepared) {
        const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
        if (!Number.isFinite(lineHeight) || element.clientWidth === 0) continue;
        const result = layout(handle, element.clientWidth, lineHeight);
        element.style.minHeight = `${result.height}px`;
      }
    };
    await window.__pretextLayout();
  } catch {
    document.documentElement.dataset.pretextFallback = "true";
  }
}

prepareText();

const resizeObserver = new ResizeObserver(() => {
  window.__pretextLayout?.();
});
resizeObserver.observe(document.body);

for (const element of pretextElements) {
  element.contentEditable = "true";
  element.spellcheck = false;
  new MutationObserver(async () => {
    try {
      const { prepare } = await import("https://esm.sh/@chenglou/pretext");
      prepared.set(element, prepare(element.textContent ?? "", getComputedStyle(element).font));
      await window.__pretextLayout?.();
    } catch {
      document.documentElement.dataset.pretextFallback = "true";
    }
  }).observe(element, { characterData: true, childList: true, subtree: true });
}

const toast = document.querySelector("[data-audit-toast]");
let toastTimer;

function showAudit(message) {
  if (!toast) return;
  const text = toast.querySelector("[data-audit-message]");
  if (text) text.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 4200);
}

document.querySelectorAll("[data-audit-action]").forEach((button) => {
  button.addEventListener("click", () => {
    showAudit(button.dataset.auditAction);
  });
});

const contextDialog = document.querySelector("[data-context-dialog]");
document.querySelectorAll("[data-open-context]").forEach((button) => {
  button.addEventListener("click", () => contextDialog?.showModal());
});
document.querySelectorAll("[data-close-context]").forEach((button) => {
  button.addEventListener("click", () => contextDialog?.close());
});

const applyContext = document.querySelector("[data-apply-context]");
applyContext?.addEventListener("click", () => {
  const city = document.querySelector("[data-context-city]")?.value;
  const operator = document.querySelector("[data-context-operator]")?.value;
  document.querySelector("[data-active-city]").textContent = city;
  document.querySelector("[data-active-operator]").textContent = operator;
  contextDialog?.close();
  showAudit(`组织观察范围已切换为${city}／${operator}；功能角色和数据等级未改变。审计事件已追加。`);
});

const search = document.querySelector("[data-directory-search]");
search?.addEventListener("input", () => {
  const query = search.value.trim().toLowerCase();
  document.querySelectorAll("[data-directory-row]").forEach((row) => {
    row.hidden = !row.textContent.toLowerCase().includes(query);
  });
});
