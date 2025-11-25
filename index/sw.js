// sw.js - Service Worker 缓存脚本

// 定义缓存名称，如果更新了代码想强制刷新缓存，可以修改这个版本号
const CACHE_NAME = 'hand-gesture-cache-v1';

// 需要缓存的核心资源列表
// 注意：MediaPipe 的模型文件 (.tflite) 是动态加载的，无法直接写在这里。
// 我们将使用运行时缓存策略来捕获它们。
const URLS_TO_CACHE = [
    './', // 缓存入口 HTML (假设文件名是 index.html，如果不是请修改)
    // 如果你有单独的 CSS 或 JS 文件，也要加在这里
    // 'style.css',
    // 'script.js'
];

// 安装事件：预缓存核心文件
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching app shell');
                return cache.addAll(URLS_TO_CACHE);
            })
    );
});

// 激活事件：清理旧缓存
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// 核心：拦截网络请求
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    // 策略：针对 MediaPipe 的 CDN 资源使用“缓存优先”策略
    // 如果是 jsdelivr (MediaPipe JS) 或 mediapipe (模型文件) 的请求
    if (requestUrl.hostname.includes('jsdelivr.net') || requestUrl.hostname.includes('mediapipe')) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                // 先去缓存里找
                return cache.match(event.request).then((cachedResponse) => {
                    // 找到了就直接返回缓存，飞快！
                    if (cachedResponse) {
                        // console.log('[Service Worker] Serving from cache:', event.request.url);
                        return cachedResponse;
                    }

                    // 没找到，就去网络下载
                    return fetch(event.request).then((networkResponse) => {
                        // 下载成功后，克隆一份存入缓存，下次就有了
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
        );
        return; // 结束处理
    }

    // 对于其他请求（比如 HTML 本身），使用常规的“缓存优先，网络回退”策略
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                return response || fetch(event.request);
            })
    );
});