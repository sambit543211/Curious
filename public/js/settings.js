import { $ } from './dom.js';

let worker;
let publicKey;

const decodeKey = value => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')), char => char.charCodeAt(0));
};

async function loadAlerts() {
  if (publicKey !== undefined) return;
  try {
    const response = await fetch('/api/push', {cache:'no-cache'});
    publicKey = response.ok ? (await response.json()).publicKey ?? null : null;
  } catch { publicKey = null; }
  // Alerts only appear when the server is set up for them.
  $('alerts').hidden = !publicKey;
}

async function enableAlerts() {
  const status = $('push-status');
  if (!worker || !('PushManager' in window) || !('Notification' in window)) {
    status.textContent = 'Open the app from your Home Screen to turn on alerts.';
    return;
  }
  $('enable-push').disabled = true;
  try {
    if (await Notification.requestPermission() !== 'granted') throw new Error('Allow notifications for this app in your device settings.');
    const subscription = await worker.pushManager.getSubscription() ??
      await worker.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:decodeKey(publicKey)});
    const response = await fetch('/api/push', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(subscription)});
    if (!response.ok) throw new Error('Couldn’t save your alert settings. Try again.');
    status.textContent = 'Alerts are on for this device.';
  } catch (error) { status.textContent = error.message; }
  finally { $('enable-push').disabled = false; }
}

export function initSettings() {
  $('open-settings').addEventListener('click', () => {
    $('settings').showModal();
    loadAlerts();
  });
  $('settings-close').addEventListener('click', () => $('settings').close());
  $('enable-push').addEventListener('click', enableAlerts);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then(registration => { worker = registration; })
    .catch(() => {});
}
