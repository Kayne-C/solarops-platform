import axios from "axios";

const INACTIVITY_TIMEOUT = 60 * 30 * 1000; // 30 dakika
const WARNING_TIMEOUT = 60 * 10 * 1000; // 10 dakika
let inactivityTimer = null;
let warningTimer = null;
let lastActivity = Date.now();
let consoleUpdateInterval = null;

// Bildirim ekleme fonksiyonu
const addNotification = (message, type) => {
  // TODO: Bildirim sistemi eklendiğinde buraya entegre edilecek
  console.log(`[${type}] ${message}`);
};

// Çıkış yapma fonksiyonu
const logout = () => {
  if (window.authContext) {
    window.authContext.logout();
  } else {
    // Fallback: Eğer context bulunamazsa manuel olarak logout işlemini gerçekleştir
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("token");
    window.location.href = "/login";
  }
};

const resetTimers = () => {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
  }
  if (warningTimer) {
    clearTimeout(warningTimer);
  }

  inactivityTimer = setTimeout(handleSoftLogout, INACTIVITY_TIMEOUT);
  warningTimer = setTimeout(showWarning, WARNING_TIMEOUT);
};

const showWarning = () => {
  addNotification("Oturum süreniz dolmak üzere", "warning");
};

const handleSoftLogout = () => {
  clearTimeout(inactivityTimer);
  clearTimeout(warningTimer);
  addNotification("Oturum süresi dolduğu için çıkış yapıldı", "warning");
  logout();
};

const handleHardLogout = () => {
  window.addEventListener("beforeunload", () => {
    // Tarayıcı kapatıldığında sessionStorage'ı temizle
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("token");
  });
};

const setupAxiosInterceptor = () => {
  axios.interceptors.request.use((config) => {
    resetTimers();
    return config;
  });
};

const trackPageChanges = () => {
  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;

  window.history.pushState = function () {
    originalPushState.apply(this, arguments);
    resetTimers();
  };

  window.history.replaceState = function () {
    originalReplaceState.apply(this, arguments);
    resetTimers();
  };
};

const initSessionService = () => {
  setupAxiosInterceptor();
  trackPageChanges();
  resetTimers();
  handleHardLogout();
};

export { initSessionService, handleSoftLogout };
