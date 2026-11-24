import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// Ganti dengan versi APK kamu saat ini setiap kali mau build APK baru
export const CURRENT_APP_VERSION = '1.0.1';

// Endpoint GitHub Releases API milikmu
const GITHUB_RELEASES_API_URL =
  'https://api.github.com/repos/zd-devp-w/wgen/releases/latest';

export async function initAndroidNotifications() {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const req = await LocalNotifications.requestPermissions();
      return req.display === 'granted';
    }
    return true;
  } catch (err) {
    console.warn('Gagal meminta izin notifikasi:', err);
    return false;
  }
}

export async function sendAndroidLocalNotif({ id, title, body, route = 'debtmanager' }) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const granted = await initAndroidNotifications();
    if (!granted) return;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.abs(id) % 2147483647 || Math.floor(Math.random() * 100000),
          title,
          body,
          schedule: { at: new Date(Date.now() + 300) },
          extra: { route }
        }
      ]
    });
  } catch (err) {
    console.warn('Gagal menampilkan notifikasi Android:', err);
  }
}

// === CEK WAJIB UPDATE LANGSUNG DARI GITHUB RELEASES ===
function isVersionOlder(current, latest) {
  // Hapus huruf 'v' di depan jika tag GitHub memakai format v1.0.6
  const cleanCurrent = String(current).replace(/^v/i, '').trim();
  const cleanLatest = String(latest).replace(/^v/i, '').trim();

  const c = cleanCurrent.split('.').map(Number);
  const l = cleanLatest.split('.').map(Number);

  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    const numC = c[i] || 0;
    const numL = l[i] || 0;
    if (numC < numL) return true;
    if (numC > numL) return false;
  }
  return false;
}

export async function checkForcedAppUpdate() {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const res = await fetch(`${GITHUB_RELEASES_API_URL}?t=${Date.now()}`, {
      headers: {
        Accept: 'application/vnd.github+json'
      },
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const data = await res.json();

    // GitHub Releases menyimpan nomor versi di field `tag_name` (misal "v1.0.6")
    const latestTag = data?.tag_name;
    if (latestTag && isVersionOlder(CURRENT_APP_VERSION, latestTag)) {
      // Cari otomatis file .apk di dalam assets release; jika tidak ada, buka halaman release-nya
      const apkAsset = Array.isArray(data.assets)
        ? data.assets.find((asset) => String(asset.name || '').toLowerCase().endsWith('.apk'))
        : null;

      return {
        latestVersion: String(latestTag).replace(/^v/i, ''),
        downloadUrl:
          apkAsset?.browser_download_url ||
          data.html_url ||
          'https://github.com/zd-devp-w/wgen/releases/latest',
        releaseNotes:
          data.body?.trim() || 'Pembaruan sistem dan perbaikan bug terbaru telah tersedia.',
        forceUpdate: true
      };
    }
    return null;
  } catch (err) {
    console.warn('Gagal memeriksa versi GitHub Releases:', err);
    return null;
  }
}