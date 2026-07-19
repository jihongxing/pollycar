const pages = [...document.querySelectorAll("[data-page]")];
const targets = [...document.querySelectorAll("[data-page-target]")];

function show(name) {
  for (const page of pages) page.classList.toggle("active", page.dataset.page === name);
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-page-target]");
  if (target) show(target.dataset.pageTarget);
});

document.querySelector("#theme-toggle").addEventListener("click", () => {
  document.body.classList.toggle("dark");
});

show("entry");
