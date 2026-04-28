var version = "v23.02.07"
var wasmVersion = "wasm2"
var shareTargetVersion = "share-target"

console.log("MISSION_START: Version=" + version + ", WasmVersion=" + wasmVersion);

var urls = [
	"./",
	"css/custom-audio.css",
	"css/player-dark.css",
	"css/player.css",
	"img/apple-touch-icon.png",
	"img/favicon.png",
	"index.html",
	"js/cli-worker.js",
	"js/custom-audio.js",
	"js/dark-toggle.js",
	"js/player.js",
	"js/soundbuffer.js"
]
console.log("RESOURCE_LIST: ", urls);

var wasmDir = "https://vgmstream.org/web/"
var wasmVer = wasmDir + "version"
var wasmUrls = [
	wasmVer,
	wasmDir + "vgmstream-cli.js",
	wasmDir + "vgmstream-cli.wasm"
]
console.log("WASM_RESOURCE_LIST: ", wasmUrls);

async function workerInstall(){
	console.log("ACTION: workerInstall 開始");
	var cache = await caches.open(version)
	console.log("CACHE_OPEN: " + version);
	var wasmCache = await caches.open(wasmVersion)
	console.log("CACHE_OPEN: " + wasmVersion);
	
	var promises = [
		cache.addAll(urls),
		wasmCache.addAll(wasmUrls)
	]
	console.log("ACTION: キャッシュ追加プロミス作成完了。実行中...");
	
	await Promise.all(promises)
	console.log("SUCCESS: 全キャッシュの保存が完了しました。");
	
	await self.skipWaiting()
	console.log("ACTION: skipWaiting 実行完了。");
}
self.addEventListener("install", event => {
	console.log("EVENT: install 受信");
	event.waitUntil(workerInstall())
})

async function workerActivate(){
	console.log("ACTION: workerActivate 開始");
	await deleteOldCaches()
	console.log("ACTION: 古いキャッシュの削除完了。");
	await self.clients.claim()
	console.log("ACTION: clients.claim 完了。");
}
async function deleteOldCaches(){
	var currentCaches = [version, wasmVersion, shareTargetVersion]
	console.log("CHECK: 現在の有効キャッシュ=" + currentCaches);
	var promises = []
	var cacheKeys = await caches.keys()
	console.log("CACHE_KEYS: 発見されたキー=" + cacheKeys);
	
	cacheKeys.forEach(cache => {
		if(currentCaches.indexOf(cache) === -1){
			console.log("ACTION: 不要なキャッシュを削除リストに追加 -> " + cache);
			promises.push(caches.delete(cache))
		} else {
			console.log("SKIP: キャッシュ保持 -> " + cache);
		}
	})
	await Promise.all(promises)
}
self.addEventListener("activate", event => {
	console.log("EVENT: activate 受信");
	event.waitUntil(workerActivate())
})

async function workerFetch(event){
	var request = event.request
	console.log("FETCH_REQUEST: " + request.url);
	
	var isWasmDir = request.url.startsWith(wasmDir)
	var isWasmVer = request.url === wasmVer
	console.log("CHECK: isWasmDir=" + isWasmDir + ", isWasmVer=" + isWasmVer);
	
	var cachedResponse = await caches.match(request)
	var recent = true
	
	if(cachedResponse && (!isWasmVer || !self.navigator.onLine)){
		console.log("CACHE_HIT: " + request.url);
		return cachedResponse
	}
	console.log("CACHE_MISS/RELOAD_REQUIRED: ネットワーク取得を開始します -> " + request.url);
	
	var opt = {}
	if(isWasmDir){
		opt.cache = "reload"
		console.log("SET_OPT: cache='reload' を設定しました (WASMディレクトリ内)");
	}
	
	var response = await fetch(request, opt)
	console.log("FETCH_SUCCESS: " + request.url);
	
	var copy = response.clone()
	var cacheName = isWasmDir ? wasmVersion : version
	var cache = await caches.open(cacheName)
	console.log("CACHE_OPEN: 保存先=" + cacheName);
	
	if(isWasmVer){
		console.log("CHECK: WASMバージョンの比較チェックを開始...");
		var priorCopy = await cache.match(request.url)
		if(priorCopy){
			var currentCopy = copy.clone()
			var priorText = await priorCopy.text()
			var currentText = await currentCopy.text()
			console.log("VERSION_COMPARE: 旧=" + priorText + " / 新=" + currentText);
			
			if(priorText !== currentText){
				console.log("ACTION: バージョン不一致！WASMキャッシュを破棄し再生成します。");
				await caches.delete(wasmVersion)
				cache = await caches.open(wasmVersion)
			} else {
				console.log("CHECK: バージョン一致。");
			}
		}
	}
	
	cache.put(request, copy)
	console.log("CACHE_PUT: " + request.url + " を " + cacheName + " に保存しました。");
	return response
}

async function shareTarget(event){
	console.log("ACTION: shareTarget 処理開始");
	var request = event.request
	var formData = await request.formData()
	var file = formData.get("file")
	console.log("FILE_RECEIVED: name=" + file.name + ", size=" + file.size);
	
	var shareCache = await caches.open(shareTargetVersion)
	var headers = new Headers()
	headers.append("name", file.name)
	
	var response = new Response(file, {
		headers: headers
	})
	
	await shareCache.put("shared-file", response)
	console.log("CACHE_PUT: shared-file を " + shareTargetVersion + " に保存完了。");
	
	var url = new URL(request.url)
	url.searchParams.delete("share-target")
	url.hash = "#share-target"
	
	var redirectUrl = url.toString()
	console.log("ACTION: リダイレクトを実行します -> " + redirectUrl);
	return Response.redirect(redirectUrl, 303)
}

self.addEventListener("fetch", event => {
	var request = event.request
	if(request.method === "POST" && request.url.endsWith("?share-target")){
		console.log("EVENT: fetch (POST share-target) 受信");
		return event.respondWith(shareTarget(event))
	}else if(request.url.startsWith(self.location.origin + "/") || request.url.startsWith(wasmDir)){
		console.log("EVENT: fetch (Internal/WASM) 受信: " + request.url);
		return event.respondWith(workerFetch(event))
	} else {
		console.log("EVENT: fetch (External/Other) 受信 - デフォルト処理: " + request.url);
	}
})
	/*
	var version = "v23.02.07"
var wasmVersion = "wasm2"
var shareTargetVersion = "share-target"

var urls = [
	"./",
	"css/custom-audio.css",
	"css/player-dark.css",
	"css/player.css",
	"img/apple-touch-icon.png",
	"img/favicon.png",
	"index.html",
	"js/cli-worker.js",
	"js/custom-audio.js",
	"js/dark-toggle.js",
	"js/player.js",
	"js/soundbuffer.js"
]

var wasmDir = "https://vgmstream.org/web/"
var wasmVer = wasmDir + "version"
var wasmUrls = [
	wasmVer,
	wasmDir + "vgmstream-cli.js",
	wasmDir + "vgmstream-cli.wasm"
]

async function workerInstall(){
	var cache = await caches.open(version)
	var wasmCache = await caches.open(wasmVersion)
	var promises = [
		cache.addAll(urls),
		wasmCache.addAll(wasmUrls)
	]
	await Promise.all(promises)
	await self.skipWaiting()
}
self.addEventListener("install", event => {
	event.waitUntil(workerInstall())
})

async function workerActivate(){
	await deleteOldCaches()
	await self.clients.claim()
}
async function deleteOldCaches(){
	var currentCaches = [version, wasmVersion, shareTargetVersion]
	var promises = []
	var cacheKeys = await caches.keys()
	cacheKeys.forEach(cache => {
		if(currentCaches.indexOf(cache) === -1){
			promises.push(caches.delete(cache))
		}
	})
	await Promise.all(promises)
}
self.addEventListener("activate", event => {
	event.waitUntil(workerActivate())
})

async function workerFetch(event){
	var request = event.request
	var isWasmDir = request.url.startsWith(wasmDir)
	var isWasmVer = request.url === wasmVer
	var cachedResponse = await caches.match(request)
	var recent = true
	if(cachedResponse && (!isWasmVer || !self.navigator.onLine)){
		return cachedResponse
	}
	var opt = {}
	if(isWasmDir){
		opt.cache = "reload"
	}
	var response = await fetch(request, opt)
	var copy = response.clone()
	var cache = await caches.open(isWasmDir ? wasmVersion : version)
	if(isWasmVer){
		var priorCopy = await cache.match(request.url)
		if(priorCopy){
			var currentCopy = copy.clone()
			if(await priorCopy.text() !== await currentCopy.text()){
				await caches.delete(wasmVersion)
				cache = await caches.open(wasmVersion)
			}
		}
	}
	cache.put(request, copy)
	return response
}
async function shareTarget(event){
	var request = event.request
	var formData = await request.formData()
	var file = formData.get("file")
	var shareCache = await caches.open(shareTargetVersion)
	var headers = new Headers()
	headers.append("name", file.name)
	var response = new Response(file, {
		headers: headers
	})
	await shareCache.put("shared-file", response)
	var url = new URL(request.url)
	url.searchParams.delete("share-target")
	url.hash = "#share-target"
	return Response.redirect(url.toString(), 303)
}
self.addEventListener("fetch", event => {
	var request = event.request
	if(request.method === "POST" && request.url.endsWith("?share-target")){
		return event.respondWith(shareTarget(event))
	}else if(request.url.startsWith(self.location.origin + "/") || request.url.startsWith(wasmDir)){
		return event.respondWith(workerFetch(event))
	}
})
*/
