'use strict';
const VERSION='qingji-2.0.1-20261125-a';
const CORE=['./','./index.html','./mobile.css','./icon.svg','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./receipt-parser.js','./js/core.js','./js/store.js','./js/cloud.js','./js/imports.js','./js/finance-app.js','./vendor/xlsx.full.min.js'];
const BASE=new URL('./',self.location.href).href;
const URLS=new Set(CORE.map(p=>new URL(p,BASE).href));
self.addEventListener('install',event=>event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(CORE))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('qingji-')&&name!==VERSION)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(BASE))return;
 // Never cache authentication, APIs, user backups, or receipt files.
 // Keep HTML and scripts from the same release until the user accepts the update.
 if(request.mode==='navigate'){event.respondWith((async()=>{const cached=await(await caches.open(VERSION)).match(new URL('./index.html',BASE).href);return cached||fetch(request);})());return;}
 if(URLS.has(url.href))event.respondWith(caches.open(VERSION).then(async cache=>(await cache.match(request))||fetch(request)));
});
