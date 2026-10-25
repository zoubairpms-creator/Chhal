/* Service worker de Chhal : fonctionne hors ligne avec les dernières données vues sur l'appareil.
   - /_next/static et icônes : cache d'abord (fichiers à empreinte, immuables)
   - données de l'API (GET) : réseau d'abord, repli sur la dernière réponse enregistrée
   - pages : réseau d'abord, repli sur la dernière version visitée, puis /offline.html
   - écritures (POST) et administration : jamais mises en cache */
importScripts("/sw-routes.js");

var VERSION = "v2";
var STATIC = "chhal-static-" + VERSION;
var PAGES = "chhal-pages-" + VERSION;
var DATA = "chhal-data-" + VERSION;

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches
      .open(PAGES)
      .then(function (c) { return c.add("/offline.html"); })
      .then(function () { return self.skipWaiting(); }),
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (k) { return k.indexOf("chhal-") === 0 && k.slice(-VERSION.length) !== VERSION; })
            .map(function (k) { return caches.delete(k); }),
        );
      })
      .then(function () { return self.clients.claim(); }),
  );
});

function trim(cache, max) {
  return cache.keys().then(function (keys) {
    if (keys.length > max) return cache.delete(keys[0]);
  });
}

function dayInMorocco(d) {
  var p=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Casablanca",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);
  return ["year","month","day"].map(function(k){return p.find(function(x){return x.type===k;}).value;}).join("-");
}
function store(cacheName, req, res, max) {
  if (!res || !res.ok || res.type !== "basic") return Promise.resolve(res);
  var copy=res.clone();
  if(cacheName===DATA){
    var headers={};copy.headers.forEach(function(v,k){headers[k]=v;});
    headers["x-chhal-cached-at"]=new Date().toISOString();
    headers["x-chhal-cache-day"]=dayInMorocco(new Date());
    copy=new Response(copy.body,{status:copy.status,headers:headers});
  }
  return caches.open(cacheName).then(function(c){return c.put(req,copy).then(function(){return max?trim(c,max):undefined;});}).then(function(){return res;}).catch(function(){return res;});
}
function offlineData(req,hit) {
  if(!hit)return Promise.resolve(offlineJson());
  var at=Date.parse(hit.headers.get("x-chhal-cached-at")||"");
  var day=dayInMorocco(new Date());
  if(!Number.isFinite(at)||Date.now()-at>6*3600000||at>Date.now()||hit.headers.get("x-chhal-cache-day")!==day)return Promise.resolve(offlineJson());
  return hit.clone().text().then(function(text){
    var expirations=[...text.matchAll(/"validUntil"\s*:\s*"([0-9-]+)"/g)];
    if(expirations.some(function(m){return m[1]<day;}))return offlineJson();
    var headers={};hit.headers.forEach(function(v,k){headers[k]=v;});headers["x-chhal-offline"]="1";
    return new Response(text,{status:hit.status,headers:headers});
  }).catch(function(){return offlineJson();});
}

function offlineJson() {
  return new Response(JSON.stringify({ erreur: "Hors ligne : aucune donnée enregistrée pour cette requête." }), {
    status: 503,
    headers: { "content-type": "application/json" },
  });
}

function handle(strategy, req) {
  if (strategy === "cache-first") {
    return caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) { return store(STATIC, req, res); });
    });
  }
  if (strategy === "network-first-data") {
    return fetch(req)
      .then(function (res) { return store(DATA, req, res, 200); })
      .catch(function () {
        return caches.match(req).then(function (hit) { return offlineData(req,hit); });
      });
  }
  return fetch(req)
    .then(function (res) { return store(PAGES, req, res, 60); })
    .catch(function () {
      return caches.match(req).then(function (hit) { return hit || caches.match("/offline.html"); });
    });
}

self.addEventListener("fetch", function (event) {
  var req = event.request;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  var strategy = chhalStrategy(url.pathname, req.method, req.mode);
  if (strategy === "network-only") return;
  event.respondWith(handle(strategy, req));
});
