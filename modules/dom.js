const TOAST_DURATION_MS = 2200;

let toastTimeout;

export function byId(id) {
  return document.getElementById(id);
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

export function showToast(message) {
  const toast = byId('toast');
  toast.textContent = message;
  toast.classList.add('show');

  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => {
    toast.classList.remove('show');
  }, TOAST_DURATION_MS);
}

export function scrollBehavior() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'auto'
    : 'smooth';
}
