const views = [...document.querySelectorAll("[data-view]")];
const navButtons = [...document.querySelectorAll("[data-show-view]")];
const toast = document.querySelector("[data-toast]");
const toastMessage = document.querySelector("[data-toast-message]");

function showView(id) {
  views.forEach((view) => view.classList.toggle("active", view.dataset.view === id));
  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.showView === id));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

navButtons.forEach((button) => button.addEventListener("click", () => showView(button.dataset.showView)));
document.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.go)));

function notify(message) {
  toastMessage.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(window.prototypeToastTimer);
  window.prototypeToastTimer = window.setTimeout(() => toast.classList.remove("show"), 3200);
}

document.querySelectorAll("[data-notify]").forEach((button) => {
  button.addEventListener("click", () => notify(button.dataset.notify));
});

const pageLabel = document.querySelector("[data-page-label]");
const previousButton = document.querySelector("[data-page-previous]");
const nextButton = document.querySelector("[data-page-next]");
let page = 1;

function updatePage() {
  pageLabel.textContent = `第 ${page} 页 · 每页 25 条`;
  previousButton.disabled = page === 1;
  nextButton.disabled = page === 4;
}

previousButton?.addEventListener("click", () => {
  page = Math.max(1, page - 1);
  updatePage();
  notify("已使用上一页游标加载，筛选和数据范围保持不变。");
});
nextButton?.addEventListener("click", () => {
  page = Math.min(4, page + 1);
  updatePage();
  notify("已使用下一页游标加载，返回时会恢复当前位置。");
});
updatePage();

document.querySelector("[data-search]")?.addEventListener("click", () => {
  page = 1;
  updatePage();
  notify("搜索条件已提交，旧游标已清空。");
});

document.querySelectorAll("[data-remove-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    button.parentElement.remove();
    page = 1;
    updatePage();
    notify("筛选已更新，列表从首屏重新加载。");
  });
});

document.querySelectorAll("[data-shell-role]").forEach((button) => {
  button.addEventListener("click", () => {
    showView(button.dataset.shellRole);
    notify("工作身份已确认，服务端已签发对应导航。");
  });
});
