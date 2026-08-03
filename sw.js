// WorkBuddy Service Worker · 离线缓存
const CACHE = 'workbuddy-v13-dailyfix-20260804';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-1024.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 动态内容(daily/*.json)网络优先,每次从服务器拉取最新;失败才回退缓存
function networkFirst(request) {
  return fetch(request).then(resp => {
    if (resp && resp.status === 200) {
      const clone = resp.clone();
      caches.open(CACHE).then(c => c.put(request, clone));
    }
    return resp;
  }).catch(() => caches.match(request));
}

// 静态资源缓存优先;动态 daily 数据网络优先
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // 每天更新的常识数据:必须走网络,拿到最新内容
  if (url.pathname.includes('/daily') && url.pathname.endsWith('.json')) {
    e.respondWith(networkFirst(e.request).then(r => r || caches.match('./index.html')));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
      if (resp && resp.status === 200 && resp.type === 'basic') {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return resp;
    }).catch(() => caches.match('./index.html')))
  );
});

// 处理推送通知事件
self.addEventListener('push', (e) => {
  const data = e.data ? e.data.json() : { title: 'WorkBuddy', body: '你有新的提醒' };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: data.tag || 'workbuddy',
      vibrate: [200, 100, 200],
      data: { url: data.url || './' }
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data.url || './'));
});