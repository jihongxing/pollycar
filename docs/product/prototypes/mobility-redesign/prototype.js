const passengerPhone = document.querySelector('[data-device="passenger"]');
const driverPhone = document.querySelector('[data-device="driver"]');
const previewTabs = [...document.querySelectorAll("[data-preview]")];
const passengerScreens = [...document.querySelectorAll("[data-passenger-screen]")];
const driverScreens = [...document.querySelectorAll("[data-driver-screen]")];
const identityOverlay = document.querySelector("[data-identity-overlay]");
const toast = document.querySelector("[data-toast]");
let passengerCount = 1;
let toastTimer;

function showPassengerScreen(name) {
  passengerScreens.forEach((screen) => screen.classList.toggle("is-active", screen.dataset.passengerScreen === name));
}

function showDriverScreen(name) {
  driverScreens.forEach((screen) => screen.classList.toggle("is-active", screen.dataset.driverScreen === name));
}

function setPreview(mode) {
  previewTabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.preview === mode));
  passengerPhone.classList.toggle("is-hidden", mode === "driver");
  driverPhone.classList.toggle("is-hidden", mode === "passenger");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

previewTabs.forEach((tab) => tab.addEventListener("click", () => setPreview(tab.dataset.preview)));

document.addEventListener("click", (event) => {
  const countButton = event.target.closest("[data-count]");
  if (countButton) {
    passengerCount = Number(countButton.dataset.count);
    document.querySelectorAll("[data-count]").forEach((button) => button.classList.toggle("is-active", button === countButton));
    document.querySelector(".passenger-action").textContent = `确认合成行程 · ${passengerCount} 人`;
    document.querySelector("[data-passenger-summary]").textContent = `${passengerCount} 人`;
    return;
  }

  const sceneButton = event.target.closest("[data-scene]");
  if (sceneButton) {
    document.querySelectorAll("[data-scene]").forEach((button) => button.classList.toggle("is-active", button === sceneButton && !sceneButton.classList.contains("is-active")));
    return;
  }

  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  const actions = {
    "start-booking": () => showPassengerScreen("booking"),
    "passenger-home": () => showPassengerScreen("home"),
    "confirm-booking": () => showPassengerScreen("matching"),
    "open-identity": () => identityOverlay.classList.add("is-open"),
    "close-identity": () => identityOverlay.classList.remove("is-open"),
    "choose-driver": () => {
      identityOverlay.classList.remove("is-open");
      setPreview("driver");
      showToast("已切换为车主身份");
    },
    "go-online": () => showDriverScreen("offers"),
    "go-offline": () => showDriverScreen("offline"),
    "skip-offer": () => showToast("已跳过此订单，不会自动接单"),
    "accept-offer": () => showDriverScreen("accepted"),
    arrive: () => showToast("已通知乘客：车主到达上车点"),
  };
  actions[action]?.();
});

setPreview("passenger");
