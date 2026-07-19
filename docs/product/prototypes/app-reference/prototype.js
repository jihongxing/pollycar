const screens = Array.from(document.querySelectorAll("[data-screen]"));
const navButtons = Array.from(document.querySelectorAll("[data-screen-target]"));

function showScreen(name) {
  const target = screens.find((screen) => screen.dataset.screen === name);
  if (!target) return;

  for (const screen of screens) {
    screen.classList.toggle("is-active", screen === target);
  }

  for (const button of navButtons) {
    button.classList.toggle("is-active", button.dataset.screenTarget === name);
  }
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-go], [data-screen-target]");
  if (!target) return;

  showScreen(target.dataset.go ?? target.dataset.screenTarget);
});

showScreen("sandbox-start");
