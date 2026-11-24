// src/lib/dialog.js
let dialogHandler = null;

export function registerDialogHandler(fn) {
  dialogHandler = fn;
}

export function showAlert(message) {
  if (!dialogHandler) {
    window.alert(message);
    return Promise.resolve();
  }
  return dialogHandler({ type: 'alert', message: String(message) });
}

export function showConfirm(message) {
  if (!dialogHandler) {
    return Promise.resolve(window.confirm(message));
  }
  return dialogHandler({ type: 'confirm', message: String(message) });
}