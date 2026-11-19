// Settings tab: appearance is handled by theme.js; this file handles morning alerts.
import { $ } from './dom.js';

let worker;
let publicKey;

const decodeKey = value => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')), char => char.charCodeAt(0));
};

export async function alertsAvailable() {
  if (publicKey === undefined) {
    try {
      const response = await fetch('/api/push', {cache:'no-cache'});
      publicKey = response.ok ? (await response.json()).publicKey ?? null : null;
    } catch { publicKey = null; }
  }
  $('alerts').hidden = !publicKey;
  return Boolean(publicKey);
}

export async function enableAlerts(status = $('push-status')) {
  if (!publicKey || !worker || !('PushManager' in window) || !('Notification' in window)) {
    status.textContent = 'Add Morning Edition to your Home Screen, open it from there, then turn on alerts.';
    return false;
  }
  try {
    if (await Notification.requestPermission() !== 'granted') throw new Error('Allow notifications for Morning Edition in your iPhone Settings.');
    const subscription = await worker.pushManager.getSubscription() ??
      await worker.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:decodeKey(publicKey)});
    const response = await fetch('/api/push', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(subscription)});
    if (!response.ok) throw new Error('Couldn’t save your alert. Try again.');
    status.textContent = 'You’ll get an alert when each edition is published.';
    return true;
  } catch (error) {
    status.textContent = error.message;
    return false;
  }
}

export function initSettings() {
  $('enable-push').addEventListener('click', async () => {
    $('enable-push').disabled = true;
    await enableAlerts();
    $('enable-push').disabled = false;
  });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then(registration => { worker = registration; })
    .catch(() => {});
}
