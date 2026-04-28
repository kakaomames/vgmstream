"use strict"

console.log("MISSION START: System Initializing...");

var browse = document.getElementById("browse")
var browsedir = document.getElementById("browsedir")
var selectbtn = document.getElementById("selectbtn")
var selectdirbtn = document.getElementById("selectdirbtn")
var wasmwarning = document.getElementById("wasmwarning")
var directorybox = document.getElementById("directorybox")
var dirselect = document.getElementById("dirselect")
var audiobox = document.getElementById("audiobox")
var filenamebox = document.getElementById("filenamebox")
var audio = document.getElementById("audio")
var download = document.getElementById("download")
var logbox = document.getElementById("logbox")
var logdropdown = document.getElementById("logdropdown")
var log = document.getElementById("log")
var fadeoverlay = document.getElementById("fadeoverlay")

console.log("DOM Elements loaded:", { browse, browsedir, selectbtn, selectdirbtn, wasmwarning, directorybox, dirselect, audiobox, filenamebox, audio, download, logbox, logdropdown, log, fadeoverlay });

var jsDir = "js/"
var dlfilename
var noConverting
var dirPromise
var locked = false
var hashLock = false
var dragTarget = null

function corsBridge(input){
	console.log("ACTION: corsBridge called with input:", input);
	var url = new URL("https://api.allorigins.win/raw")
	url.searchParams.append("url", input)
	console.log("CORS Bridge URL generated:", url.toString());
	return fetch(url.toString())
}

var canPickDir = typeof showDirectoryPicker === "function" || "webkitdirectory" in HTMLInputElement.prototype
console.log("CHECK: canPickDir initial status:", canPickDir);

if(canPickDir){
	if(navigator.userAgentData && navigator.userAgentData.platform){
		canPickDir = !navigator.userAgentData.mobile
		console.log("CHECK: userAgentData.mobile check. Result:", canPickDir);
	}else{
		canPickDir = !["Android", "iPhone", "iPad"].find(input =>
			navigator.userAgent.indexOf(input) !== -1
		)
		console.log("CHECK: userAgent string check. Result:", canPickDir);
	}
}

if(canPickDir){
	console.log("ACTION: Enabling selectdirbtn display.");
	selectdirbtn.style.display = "block"
}

var wasmSupported = (() => {
	console.log("CHECK: Testing WebAssembly support...");
	try{
		if(typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function"){
			var module = new WebAssembly.Module(Uint8Array.of(0, 0x61, 0x73, 0x6d, 0x1, 0, 0, 0))
			if(module instanceof WebAssembly.Module){
				const supported = new WebAssembly.Instance(module) instanceof WebAssembly.Instance;
				console.log("RESULT: WebAssembly supported:", supported);
				return supported
			}
		}
	}catch(e){
		console.warn("WASM Test Error:", e);
	}
	console.log("RESULT: WebAssembly NOT supported.");
	return false
})()

if(!wasmSupported){
	console.log("WARNING: WASM not supported. Setting noConverting to true.");
	wasmwarning.style.display = "block"
	noConverting = true
}

class WorkerWrapper{
	constructor(url){
		console.log("CONSTRUCTOR: WorkerWrapper creating with URL:", url);
		this.symbol = 0
		this.allEvents = new Map()
		this.worker = new Worker(url)
		this.worker.addEventListener("message", event => {
			console.log("WORKER MESSAGE RECEIVED:", event.data);
			this.messageEvent(event.data)
		})
		this.worker.addEventListener("error", event => {
			console.error("WORKER ERROR:", event);
			this.messageEvent({
				subject: "load",
				error: "Error loading {}".format(url)
			})
		})
		this.on("load").then(() => {
			console.log("STATUS: Worker loaded successfully.");
			this.loaded = true
		}, error => {
			console.error("STATUS: Worker load FAILED:", error);
			alert(error)
		})
	}
	send(subject, ...content){
		console.log("ACTION: Sending to Worker - Subject:", subject, "Content:", content);
		return this.load().then(() => {
			return new Promise((resolve, reject) => {
				var symbol = ++this.symbol
				console.log("ACTION: Promise created with symbol:", symbol);
				this.on(symbol).then(resolve, reject)
				return this.worker.postMessage({
					symbol: symbol,
					subject: subject,
					content: content
				})
			})
		})
	}
	messageEvent(data){
		console.log("ACTION: Processing messageEvent - Subject/Symbol:", data.symbol || data.subject);
		var addedType = this.allEvents.get(data.symbol || data.subject)
		if(addedType){
			console.log("STATUS: Found listeners for this event.");
			addedType.forEach(callback => {
				if(data.error){
					console.log("RESULT: Message contains error.");
					var error = new Error(data.error.message || data.error)
					for(var i in data.error){
						error[i] = data.error[i]
					}
					callback.reject(error)
				}else{
					console.log("RESULT: Message success. Sending content to resolver.");
					callback.resolve(data.content)
				}
			})
			this.allEvents.delete(data.subject)
		} else {
			console.log("STATUS: No listeners found for this message.");
		}
	}
	load(){
		console.log("CHECK: Checking worker load status...");
		if(this.loaded){
			return Promise.resolve(this.worker)
		}else if(this.loadError){
			return Promise.reject()
		}else{
			return this.on("load")
		}
	}
	on(type){
		console.log("ACTION: Registering listener for type:", type);
		return new Promise((resolve, reject) => {
			var addedType = this.allEvents.get(type)
			if(!addedType){
				addedType = new Set()
				this.allEvents.set(type, addedType)
			}
			addedType.add({
				resolve: resolve,
				reject: reject
			})
		})
	}
}

if(wasmSupported){
	console.log("ACTION: Initializing CLI Worker...");
	var cliWorker = new WorkerWrapper(jsDir + "cli-worker.js")
	var hashParams = new URL("a:?" + location.hash.slice(1)).searchParams
	console.log("STATUS: Hash Parameters found:", hashParams.toString());

	if(hashParams.has("share-target")){
		console.log("FLOW: share-target detected.");
		checkShareTarget()
	}else if(hashParams.has("play") || hashParams.has("sub")){
		console.log("FLOW: play/sub hash detected.");
		checkHash(hashParams)
	}else{
		console.log("FLOW: Standard file handling check.");
		checkFileHandling()
	}
}

function vgmstream(...args){
	console.log("EXEC: vgmstream called with args:", args);
	return cliWorker.send("vgmstream", ...args)
}

function writeFile(name, data){
	console.log("EXEC: writeFile called - Name:", name);
	return cliWorker.send("writeFile", name, data)
}

function readFile(name){
	console.log("EXEC: readFile called - Name:", name);
	return cliWorker.send("readFile", name)
}

function deleteFile(name){
	console.log("EXEC: deleteFile called - Name:", name);
	return cliWorker.send("deleteFile", name)
}

function convertFile(file){
	console.log("EXEC: convertFile called for file:", file.name);
	return convertDir([file], file.name)
}

async function convertDir(files, inputFilename){
	console.log("EXEC: convertDir started - Files:", files, "Target:", inputFilename);
	fade(1, true)
	try{
		var response = await cliWorker.send("convertDir", files, inputFilename)
		console.log("RESULT: convertDir response received:", response);
	}finally{
		console.log("ACTION: Removing fade overlay.");
		fade(0)
	}
	return response
}

function workerError(error){
	console.error("ERROR: workerError encountered:", error);
	if(error.type === "wasm"){
		error.message = "The WebAssembly application crashed while decoding this file"
	}else if(error.stderr){
		error.message = "Could not convert file: {}".format(error.stderr.trim())
	}
	alert(error.message)
	return error
}

function insertAudio(response){
	console.log("ACTION: insertAudio called with response:", response);
	if(!response){
		var msg = "Empty response"
		console.error(msg)
		alert(msg)
		throw new Error(msg)
	}else if(response.url){
		if(audio.src){
			console.log("ACTION: Revoking old object URL:", audio.src);
			URL.revokeObjectURL(audio.src)
		}
		audio.src = response.url
		dlfilename = response.outputFilename
		filenamebox.innerText = response.inputFilename
		console.log("STATUS: Audio source set. Filename:", dlfilename);
		
		var errors = []
		var stderr = response.stderr.trim()
		if(stderr){
			console.log("LOG: stderr detected:", stderr);
			errors.push(stderr)
		}
		var streamInfo = response.stdout.trim().split("\n").map(input => {
			try{
				return JSON.parse(input)
			}catch(e){
				console.log("LOG: Non-JSON stdout line found:", input);
				errors.push(input)
				return null
			}
		}).filter(Boolean)[0]
		
		console.log("STATUS: streamInfo parsed:", streamInfo);

		if(streamInfo && streamInfo.loopingInfo){
			console.log("STATUS: Looping info found. Setting loop points.");
			audio.loop = true
			audio.loopStart = streamInfo.loopingInfo.start / streamInfo.sampleRate
			audio.loopEnd = streamInfo.loopingInfo.end / streamInfo.sampleRate
		}else{
			console.log("STATUS: No looping info. Loop disabled.");
			audio.loop = false
		}
		outputTable(streamInfo, errors)
		audiobox.style.display = "block"
	}else{
		var msg = "Worker did not respond with an audio file"
		console.error(msg);
		alert(msg)
		throw new Error(msg)
	}
}

function outputTable(streamInfo, errors){
	console.log("ACTION: outputTable rendering...");
	var index = 0
	log.innerText = ""
	if(errors.length){
		console.log("ACTION: Displaying errors in log.");
		var div = document.createElement("div")
		div.innerText = errors.join("\n")
		log.appendChild(div)
	}
	if(!streamInfo){
		console.log("RESULT: No streamInfo to display in table.");
		return
	}
	
	var table = document.createElement("table")
	var insertRow = function(name, info){
		var tr = document.createElement("tr")
		var th = document.createElement("th")
		th.innerText = "{}:".format(name)
		tr.appendChild(th)
		var td = document.createElement("td")
		td.innerText = info
		tr.appendChild(td)
		table.appendChild(tr)
	}
	
	for(var i in streamInfo){
		if(streamInfo[i] !== null && i !== "version"){
			var name = unCamelCase(i)
			var info = streamInfo[i]
			var hz = streamInfo.sampleRate
			console.log("LOG: Rendering row -", name, ":", info);
			switch(i){
				case "sampleRate":
					insertRow(name, formatSize(info, {
						hz: true
					}))
					break
				case "loopingInfo":
					insertRow(
						"Loop start",
						"{} ({})".format(formatTime(info.start / hz), samples(info.start))
					)
					insertRow(
						"Loop end",
						"{} ({})".format(formatTime(info.end / hz), samples(info.end))
					)
					break
				case "interleaveInfo":
					if(info.firstBlock){
						var bytes = Math.abs(info.firstBlock) === 1 ? "byte" : "bytes"
						insertRow(
							"Interleave first block",
							"0x{} {}".format(info.firstBlock.toString(16), bytes)
						)
					}
					var bytes = Math.abs(info.lastBlock) === 1 ? "byte" : "bytes"
					insertRow(
						"Interleave last block",
						"0x{} {}".format(info.lastBlock.toString(16), bytes)
					)
					break
				case "numberOfSamples":
					insertRow(
						"Stream duration",
						"{} ({})".format(formatTime(info / hz), samples(info))
					)
					break
				case "bitrate":
					insertRow(name, formatSize(info, {
						perSecond: true,
						decimal: true
					}))
					break
				case "streamInfo":
					if(info.total !== 1){
						insertRow(
							"Stream index",
							"{} / {}".format(info.index, info.total)
						)
					}
					if(info.name){
						insertRow("Stream name", info.name)
					}
					break
				default:
					if(typeof info === "object"){
						info = JSON.stringify(info)
					}
					insertRow(name, info)
					break
			}
		}
	}
	log.appendChild(table)
}

function unCamelCase(input){
	var output = ""
	for(var i = 0; i < input.length; i++){
		var char = input.charAt(i)
		if(i === 0){
			output += char.toUpperCase()
		}else{
			var lower = char.toLowerCase()
			if(char !== lower){
				output += " " + lower
			}else{
				output += char
			}
		}
	}
	return output
}

function formatTime(seconds){
	var minus = seconds < 0 ? "-" : ""
	seconds = Math.abs(seconds)
	var ms = Math.floor(seconds % 1 * 1000).toString().padStart(3, "0")
	var s = Math.floor(seconds % 60).toString().padStart(2, "0")
	var m = Math.floor(seconds / 60 % 60).toString()
	var h = Math.floor(seconds / 60 / 60)
	if(h){
		return "{}{}:{}:{}.{}".format(minus, h, m.padStart(2, "0"), s, ms)
	}
	return "{}{}:{}.{}".format(minus, m, s, ms)
}

function formatSize(bytes, options){
	if(options.decimal){
		var units = ["B", "kB", "MB", "GB"]
		var power = 1000
	}else if(options.hz){
		var units = ["Hz", "kHz"]
		var power = 1000
	}else{
		var units = ["B", "KiB", "MiB", "GiB"]
		var power = 0x400
	}
	for(var i = 0; i < units.length - 1; i++){
		if(Math.abs(bytes) < power){
			break
		}
		bytes /= power
	}
	if(options.hz){
		if(bytes % 1 === 0){
			bytes = "{}.0".format(bytes)
		}
	}else{
		bytes = Math.floor(bytes)
	}
	return "{} {}{}".format(bytes, units[i], options.perSecond ? "/s" : "")
}

function samples(input){
	if(Math.abs(input) === 1){
		return "{} sample".format(input)
	}else{
		return "{} samples".format(input)
	}
}

function fade(opacity, modal){
	console.log("ACTION: Changing fade overlay - Opacity:", opacity, "Modal:", modal);
	fadeoverlay.style.opacity = opacity
	if(modal){
		locked = true
		fadeoverlay.classList.add("modal")
	}else{
		locked = false
		fadeoverlay.classList.remove("modal")
	}
}

async function walkEntry(entry, path="", output=[]){
	console.log("WALK: entry:", entry.name, "path:", path);
	await new Promise(async resolve => {
		if(entry.isFile){
			entry.file(file => {
				console.log("WALK: File found:", file.name);
				output.push(new File([file], path + file.name))
				return resolve()
			}, resolve)
		}else if(entry.isDirectory){
			console.log("WALK: Directory found:", entry.name);
			var dirReader = entry.createReader()
			dirReader.readEntries(async entries => {
				var dirPromises = []
				for(var i = 0; i < entries.length; i++){
					dirPromises.push(walkEntry(entries[i], path + entry.name + "/", output))
				}
				await Promise.all(dirPromises)
				return resolve()
			}, resolve)
		}else{
			return resolve()
		}
	})
	return output
}

async function walkFilesystem(file, top, path="", output=[]){
	console.log("WALK FS: kind:", file.kind, "name:", file.name, "top:", top);
	await filePermission(file)
	if(file.kind === "directory"){
		for await(let subfile of file.values()){
			await walkFilesystem(subfile, false, top ? "" : path + file.name + "/", output)
		}
	}else{
		console.log("WALK FS: Pushing file:", file.name);
		output.push(new File([await file.getFile()], path + file.name))
	}
	return output
}

async function filePermission(file){
	console.log("CHECK: Requesting permission for:", file.name);
	if(await file.queryPermission() !== "granted"){
		if(await file.requestPermission() !== "granted"){
			console.error("PERMISSION DENIED for:", file.name);
			throw new Error("File permission denied")
		}
	}
	console.log("PERMISSION GRANTED for:", file.name);
}

async function displayFiles(files){
	console.log("ACTION: displayFiles called with", files.length, "files.");
	var inputFilename = await selectFile(files)
	console.log("STATUS: User selected filename:", inputFilename);
	if(inputFilename){
		try{
			var audio = await convertDir(files, inputFilename)
		}catch(e){
			throw workerError(e)
		}
		insertAudio(audio)
	}
}

async function selectFile(files){
	console.log("ACTION: selectFile dialog preparing for", files.length, "files.");
	if(files.length === 0){
		return
	}else if(files.length === 1){
		console.log("STATUS: Single file, auto-selecting:", files[0].name);
		return files[0].name
	}
	
	var audioStyle = audiobox.style.display
	audiobox.style.display = ""
	directorybox.style.display = "block"
	dirselect.innerText = ""
	
	var dir = []
	for(var i = 0; i < files.length; i++){
		dir.push(files[i])
	}
	dir = naturalSort(dir.map(file => file.name))
	dir.forEach(name => {
		var option = document.createElement("option")
		option.value = name
		option.innerText = name
		dirselect.appendChild(option)
	})
	dirselect.size = Math.max(2, Math.min(20, dir.length))
	dirselect.focus()
	
	console.log("STATUS: Waiting for user selection in directorybox...");
	var fileSelected
	var file = await new Promise(resolve => {
		dirPromise = resolve
		fileSelected = event => {
			console.log("EVENT: Selection event triggered:", event.type);
			if(event.type === "submit"){
				event.preventDefault()
			}
			if(dirselect.value){
				console.log("STATUS: Selection confirmed:", dirselect.value);
				resolve(dirselect.value)
			}
		}
		dirselect.form.addEventListener("submit", fileSelected)
		dirselect.addEventListener("dblclick", fileSelected)
	})
	
	dirPromise = null
	dirselect.form.removeEventListener("submit", fileSelected)
	dirselect.removeEventListener("dblclick", fileSelected)
	directorybox.style.display = ""
	audiobox.style.display = audioStyle
	
	return file
}

function naturalSort(input){
	console.log("ACTION: naturalSort sorting list...");
	var collator = new Intl.Collator(undefined, {
		numeric: true,
		sensitivity: "base"
	})
	return input.sort(collator.compare)
}

function cleanup(){
	console.log("ACTION: cleanup() - Pausing audio and resolving promises.");
	audio.pause()
	if(dirPromise){
		dirPromise()
	}
}

async function validateUrl(input){
	console.log("ACTION: validateUrl for:", input);
	try{
		var url = new URL(input)
	}catch(e){
		console.warn("URL Parsing failed:", e);
	}
	if(!url || url.protocol !== "http:" && url.protocol !== "https:"){
		console.error("Invalid URL:", input);
		throw new Error("Not a valid URL\n{}".format(input))
	}
}

function checkFileHandling(){
	console.log("CHECK: Checking for launchQueue support...");
	return new Promise(resolve => {
		if("launchQueue" in window && "files" in LaunchParams.prototype){
			console.log("STATUS: launchQueue supported.");
			launchQueue.setConsumer(async launchParams => {
				if(launchParams.files.length){
					console.log("ACTION: launchQueue consumer triggered with", launchParams.files.length, "files.");
					resolve(true)
					fade(1, true)
					var promises = [cliWorker.load()]
					var files = []
					for(let i = 0; i < launchParams.files.length; i++){
						promises.push((async () => {
							var file = launchParams.files[i]
							await filePermission(file)
							console.log("STATUS: Got file handle for launch:", file.name);
							files.push(new File([await file.getFile()], file.name))
						})().catch(e => {
							console.warn("Launch handling error:", e)
						}))
					}
					try{
						await Promise.all(promises)
					}catch(e){
						alert(e)
						return
					}finally{
						fade(0)
					}
					cleanup()
					if(!noConverting && files.length){
						if(files.length === 1){
							try{
								var audio = await convertDir(files, files[0].name)
							}catch(e){
								throw workerError(e)
							}
							insertAudio(audio)
						}else{
							displayFiles(files)
						}
					}
				}else{
					console.log("STATUS: launchQueue empty.");
					resolve(false)
				}
			})
		}else{
			console.log("STATUS: launchQueue NOT supported.");
			resolve(false)
		}
	})
}

async function checkShareTarget(){
	console.log("ACTION: checkShareTarget called.");
	try{
		var shareCache = await caches.open("share-target")
		var response = await shareCache.match("shared-file")
		if(response){
			console.log("STATUS: Shared file found in cache.");
			const blob = await response.blob()
			const file = new File([blob], response.headers.get("name"))
			try{
				var audio = await convertDir([file], file.name)
			}catch(e){
				throw workerError(e)
			}
			insertAudio(audio)
			await shareCache.delete("shared-file")
			console.log("STATUS: Shared file processed and cache cleaned.");
		}
		hashLock = true
		history.replaceState("", "", location.pathname)
		hashLock = false
	}catch(e){
		console.error("Share target error:", e);
	}
}

async function checkHash(hashParams){
	console.log("ACTION: checkHash processing hash params...");
	fade(1, true)
	var promises = [cliWorker.load()]
	var files = []
	var base = ""
	var renameLast = () => {}
	var selectedFiles = []
	hashParams.forEach((value, name) => {
		console.log("HASH PARAM:", name, "=", value);
		var url = base + value
		switch(name){
			case "base":
				base = value
				break
			case "play":
			case "sub":
				var path = value
				if(!base){
					var path = url
					var index = path.lastIndexOf("/")
					if(index !== -1){
						path = path.slice(index + 1)
					}
				}
				renameLast = newPath => {
					path = newPath
				}
				promises.push(
					validateUrl(url)
					.then(() => {
						console.log("ACTION: Fetching from hash URL:", url);
						return fetch(url)
						.catch(error => {
							console.log("STATUS: Fetch failed, trying CORS bridge.");
							return corsBridge(url)
						})
						.catch(error => {
							throw new Error("Failed to download (connection or CORS error)\n{}".format(url))
						})
					})
					.then(response => {
						if(!response.ok){
							throw new Error("Failed to download (HTTP {})\n{}".format(response.status, url))
						}
						return response.arrayBuffer()
					})
					.then(buffer => {
						console.log("STATUS: Buffer received for:", path);
						files.push(new File([buffer], path))
						if(name === "play"){
							selectedFiles.push(path)
						}
					})
				)
				break
			case "dir":
				console.log("ACTION: Applying 'dir' override name:", value);
				renameLast(value)
				break
		}
	})
	try{
		await Promise.all(promises)
	}catch(e){
		alert(e)
		return
	}finally{
		fade(0)
	}
	cleanup()
	if(!noConverting){
		if(selectedFiles.length === 1){
			try{
				var audio = await convertDir(files, selectedFiles[0])
			}catch(e){
				throw workerError(e)
			}
			insertAudio(audio)
		}else{
			displayFiles(files)
		}
	}
}

String.prototype.format = function(){
	var i = 0
	return this.replaceAll("{}", input =>
		typeof arguments[i] !== "undefined" ? arguments[i++] : input
	)
}

document.addEventListener("dragenter", event => {
	event.preventDefault()
	dragTarget = event.target
	console.log("DRAG: enter target:", dragTarget);
})
document.addEventListener("dragover", event => {
	event.preventDefault()
	event.dataTransfer.dropEffect = "copy"
	if(!locked){
		fade(0.5)
	}
})
document.addEventListener("dragleave", event => {
	if(dragTarget === event.target){
		event.preventDefault()
		console.log("DRAG: leave target:", event.target);
		if(!locked){
			fade(0)
		}
	}
})
document.addEventListener("drop", async event => {
	event.preventDefault()
	console.log("DRAG: drop detected.");
	if(locked){
		console.log("STATUS: System locked, drop ignored.");
		return
	}
	cleanup()
	fade(0)
	var items = event.dataTransfer.items
	if(!noConverting){
		var fileSystem = location.protocol === "https:" && DataTransferItem.prototype.getAsFileSystemHandle
		var files = []
		var dropPromises = []
		console.log("ACTION: Processing dropped items. count:", items.length);
		for(var i = 0; i < items.length; i++){
			let promise
			if(fileSystem){
				console.log("STATUS: Using FileSystemHandle for item", i);
				promise = items[i].getAsFileSystemHandle().then(file => walkFilesystem(file))
			}else{
				console.log("STATUS: Using webkitGetAsEntry for item", i);
				var entry = items[i].webkitGetAsEntry()
				if(entry){
					promise = walkEntry(entry)
				}
			}
			if(promise){
				dropPromises.push(promise.then(filelist => {
					files = files.concat(filelist)
				}))
			}
		}
		await Promise.all(dropPromises)
		console.log("STATUS: All dropped items parsed. Total files:", files.length);
		displayFiles(files)
	}
})
browse.addEventListener("change", async event => {
	console.log("EVENT: browse changed.");
	cleanup()
	var files = browse.files
	if(!noConverting && !locked){
		displayFiles(files)
	}
})
browsedir.addEventListener("change", async event => {
	console.log("EVENT: browsedir changed.");
	cleanup()
	if(!noConverting && !locked){
		var files = []
		for(var i = 0; i < browsedir.files.length; i++){
			var file = browsedir.files[i]
			var path = file.webkitRelativePath
			var index = path.indexOf("/")
			if(index !== -1){
				path = path.slice(index + 1)
			}
			files.push(new File([file], path))
		}
		displayFiles(files)
	}
})
selectbtn.addEventListener("click", event => {
	console.log("EVENT: selectbtn clicked.");
	if(!locked){
		browse.click()
	}
})
selectdirbtn.addEventListener("click", async event => {
	console.log("EVENT: selectdirbtn clicked.");
	if(locked){
		return
	}
	if(typeof showDirectoryPicker === "function"){
		try{
			console.log("ACTION: Opening directory picker...");
			var file = await showDirectoryPicker()
		}catch(e){
			console.log("STATUS: Directory picker canceled or failed.");
			return
		}
		cleanup()
		if(!noConverting){
			var files = await walkFilesystem(file, true)
			displayFiles(files)
		}
	}else{
		console.log("STATUS: Directory picker not supported, falling back to hidden input.");
		browsedir.click()
	}
})
download.addEventListener("click", event => {
	console.log("EVENT: download clicked.");
	if(locked){
		return
	}
	var link = document.createElement("a")
	link.href = audio.src
	if("download" in HTMLAnchorElement.prototype){
		link.download = dlfilename
	}else{
		link.target = "_blank"
	}
	console.log("ACTION: Triggering download for:", dlfilename);
	link.innerText = "."
	link.style.opacity = "0"
	document.body.appendChild(link)
	setTimeout(() => {
		link.click()
		document.body.removeChild(link)
		console.log("STATUS: Download link clicked and removed.");
	})
})
logdropdown.addEventListener("mousedown", event => {
	event.preventDefault()
})
logdropdown.addEventListener("click", event => {
	console.log("EVENT: logdropdown clicked.");
	logbox.classList.toggle("open")
})
logdropdown.addEventListener("keydown", event => {
	if(event.key === "Enter" && !locked){
		console.log("EVENT: logdropdown enter key pressed.");
		logbox.classList.toggle("open")
	}
})
addEventListener("hashchange", event => {
	console.log("EVENT: hashchange detected. hashLock status:", hashLock);
	if(!hashLock){
		location.reload()
	}
})

if("serviceWorker" in navigator){
	console.log("ACTION: Registering Service Worker...");
	navigator.serviceWorker.register("service-worker.js")
}
addEventListener("beforeinstallprompt", event => {
	console.log("EVENT: beforeinstallprompt triggered.");
})

console.log("MISSION STATUS: Initialization script complete.");

/*
"use strict"

var browse = document.getElementById("browse")
var browsedir = document.getElementById("browsedir")
var selectbtn = document.getElementById("selectbtn")
var selectdirbtn = document.getElementById("selectdirbtn")
var wasmwarning = document.getElementById("wasmwarning")
var directorybox = document.getElementById("directorybox")
var dirselect = document.getElementById("dirselect")
var audiobox = document.getElementById("audiobox")
var filenamebox = document.getElementById("filenamebox")
var audio = document.getElementById("audio")
var download = document.getElementById("download")
var logbox = document.getElementById("logbox")
var logdropdown = document.getElementById("logdropdown")
var log = document.getElementById("log")
var fadeoverlay = document.getElementById("fadeoverlay")

var jsDir = "js/"
var dlfilename
var noConverting
var dirPromise
var locked = false
var hashLock = false
var dragTarget = null

function corsBridge(input){
	var url = new URL("https://api.allorigins.win/raw")
	url.searchParams.append("url", input)
	return fetch(url.toString())
}

var canPickDir = typeof showDirectoryPicker === "function" || "webkitdirectory" in HTMLInputElement.prototype
if(canPickDir){
	if(navigator.userAgentData && navigator.userAgentData.platform){
		canPickDir = !navigator.userAgentData.mobile
	}else{
		canPickDir = !["Android", "iPhone", "iPad"].find(input =>
			navigator.userAgent.indexOf(input) !== -1
		)
	}
}
if(canPickDir){
	selectdirbtn.style.display = "block"
}

var wasmSupported = (() => {
	try{
		if(typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function"){
			var module = new WebAssembly.Module(Uint8Array.of(0, 0x61, 0x73, 0x6d, 0x1, 0, 0, 0))
			if(module instanceof WebAssembly.Module){
				return new WebAssembly.Instance(module) instanceof WebAssembly.Instance
			}
		}
	}catch(e){}
	return false
})()

if(!wasmSupported){
	wasmwarning.style.display = "block"
	noConverting = true
}

class WorkerWrapper{
	constructor(url){
		this.symbol = 0
		this.allEvents = new Map()
		this.worker = new Worker(url)
		this.worker.addEventListener("message", event => this.messageEvent(event.data))
		this.worker.addEventListener("error", event => this.messageEvent({
			subject: "load",
			error: "Error loading {}".format(url)
		}))
		this.on("load").then(() => {
			this.loaded = true
		}, error => {
			alert(error)
		})
	}
	send(subject, ...content){
		return this.load().then(() => {
			return new Promise((resolve, reject) => {
				var symbol = ++this.symbol
				this.on(symbol).then(resolve, reject)
				return this.worker.postMessage({
					symbol: symbol,
					subject: subject,
					content: content
				})
			})
		})
	}
	messageEvent(data){
		var addedType = this.allEvents.get(data.symbol || data.subject)
		if(addedType){
			addedType.forEach(callback => {
				if(data.error){
					var error = new Error(data.error.message || data.error)
					for(var i in data.error){
						error[i] = data.error[i]
					}
					callback.reject(error)
				}else{
					callback.resolve(data.content)
				}
			})
			this.allEvents.delete(data.subject)
		}
	}
	load(){
		if(this.loaded){
			return Promise.resolve(this.worker)
		}else if(this.loadError){
			return Promise.reject()
		}else{
			return this.on("load")
		}
	}
	on(type){
		return new Promise((resolve, reject) => {
			var addedType = this.allEvents.get(type)
			if(!addedType){
				addedType = new Set()
				this.allEvents.set(type, addedType)
			}
			addedType.add({
				resolve: resolve,
				reject: reject
			})
		})
	}
}
if(wasmSupported){
	var cliWorker = new WorkerWrapper(jsDir + "cli-worker.js")
	var hashParams = new URL("a:?" + location.hash.slice(1)).searchParams
	if(hashParams.has("share-target")){
		checkShareTarget()
	}else if(hashParams.has("play") || hashParams.has("sub")){
		checkHash(hashParams)
	}else{
		checkFileHandling()
	}
}

function vgmstream(...args){
	return cliWorker.send("vgmstream", ...args)
}

function writeFile(name, data){
	return cliWorker.send("writeFile", name, data)
}

function readFile(name){
	return cliWorker.send("readFile", name)
}

function deleteFile(name){
	return cliWorker.send("deleteFile", name)
}

function convertFile(file){
	return convertDir([file], file.name)
}

async function convertDir(files, inputFilename){
	fade(1, true)
	try{
		var response = await cliWorker.send("convertDir", files, inputFilename)
	}finally{
		fade(0)
	}
	return response
}

function workerError(error){
	if(error.type === "wasm"){
		error.message = "The WebAssembly application crashed while decoding this file"
	}else if(error.stderr){
		error.message = "Could not convert file: {}".format(error.stderr.trim())
	}
	alert(error.message)
	return error
}

function insertAudio(response){
	if(!response){
		var msg = "Empty response"
		alert(msg)
		throw new Error(msg)
	}else if(response.url){
		if(audio.src){
			URL.revokeObjectURL(audio.src)
		}
		audio.src = response.url
		dlfilename = response.outputFilename
		filenamebox.innerText = response.inputFilename
		
		var errors = []
		var stderr = response.stderr.trim()
		if(stderr){
			errors.push(stderr)
		}
		var streamInfo = response.stdout.trim().split("\n").map(input => {
			try{
				return JSON.parse(input)
			}catch(e){
				errors.push(input)
				return null
			}
		}).filter(Boolean)[0]
		
		if(streamInfo && streamInfo.loopingInfo){
			audio.loop = true
			audio.loopStart = streamInfo.loopingInfo.start / streamInfo.sampleRate
			audio.loopEnd = streamInfo.loopingInfo.end / streamInfo.sampleRate
		}else{
			audio.loop = false
		}
		outputTable(streamInfo, errors)
		audiobox.style.display = "block"
	}else{
		var msg = "Worker did not respond with an audio file"
		alert(msg)
		throw new Error(msg)
	}
}

function outputTable(streamInfo, errors){
	var index = 0
	log.innerText = ""
	if(errors.length){
		var div = document.createElement("div")
		div.innerText = errors.join("\n")
		log.appendChild(div)
	}
	if(!streamInfo){
		return
	}
	
	var table = document.createElement("table")
	var insertRow = function(name, info){
		var tr = document.createElement("tr")
		var th = document.createElement("th")
		th.innerText = "{}:".format(name)
		tr.appendChild(th)
		var td = document.createElement("td")
		td.innerText = info
		tr.appendChild(td)
		table.appendChild(tr)
	}
	
	for(var i in streamInfo){
		if(streamInfo[i] !== null && i !== "version"){
			var name = unCamelCase(i)
			var info = streamInfo[i]
			var hz = streamInfo.sampleRate
			switch(i){
				case "sampleRate":
					insertRow(name, formatSize(info, {
						hz: true
					}))
					break
				case "loopingInfo":
					insertRow(
						"Loop start",
						"{} ({})".format(formatTime(info.start / hz), samples(info.start))
					)
					insertRow(
						"Loop end",
						"{} ({})".format(formatTime(info.end / hz), samples(info.end))
					)
					break
				case "interleaveInfo":
					if(info.firstBlock){
						var bytes = Math.abs(info.firstBlock) === 1 ? "byte" : "bytes"
						insertRow(
							"Interleave first block",
							"0x{} {}".format(info.firstBlock.toString(16), bytes)
						)
					}
					var bytes = Math.abs(info.lastBlock) === 1 ? "byte" : "bytes"
					insertRow(
						"Interleave last block",
						"0x{} {}".format(info.lastBlock.toString(16), bytes)
					)
					break
				case "numberOfSamples":
					insertRow(
						"Stream duration",
						"{} ({})".format(formatTime(info / hz), samples(info))
					)
					break
				case "bitrate":
					insertRow(name, formatSize(info, {
						perSecond: true,
						decimal: true
					}))
					break
				case "streamInfo":
					if(info.total !== 1){
						insertRow(
							"Stream index",
							"{} / {}".format(info.index, info.total)
						)
					}
					if(info.name){
						insertRow("Stream name", info.name)
					}
					break
				default:
					if(typeof info === "object"){
						info = JSON.stringify(info)
					}
					insertRow(name, info)
					break
			}
		}
	}
	log.appendChild(table)
}

function unCamelCase(input){
	var output = ""
	for(var i = 0; i < input.length; i++){
		var char = input.charAt(i)
		if(i === 0){
			output += char.toUpperCase()
		}else{
			var lower = char.toLowerCase()
			if(char !== lower){
				output += " " + lower
			}else{
				output += char
			}
		}
	}
	return output
}

function formatTime(seconds){
	var minus = seconds < 0 ? "-" : ""
	seconds = Math.abs(seconds)
	var ms = Math.floor(seconds % 1 * 1000).toString().padStart(3, "0")
	var s = Math.floor(seconds % 60).toString().padStart(2, "0")
	var m = Math.floor(seconds / 60 % 60).toString()
	var h = Math.floor(seconds / 60 / 60)
	if(h){
		return "{}{}:{}:{}.{}".format(minus, h, m.padStart(2, "0"), s, ms)
	}
	return "{}{}:{}.{}".format(minus, m, s, ms)
}

function formatSize(bytes, options){
	if(options.decimal){
		var units = ["B", "kB", "MB", "GB"]
		var power = 1000
	}else if(options.hz){
		var units = ["Hz", "kHz"]
		var power = 1000
	}else{
		var units = ["B", "KiB", "MiB", "GiB"]
		var power = 0x400
	}
	for(var i = 0; i < units.length - 1; i++){
		if(Math.abs(bytes) < power){
			break
		}
		bytes /= power
	}
	if(options.hz){
		if(bytes % 1 === 0){
			bytes = "{}.0".format(bytes)
		}
	}else{
		bytes = Math.floor(bytes)
	}
	return "{} {}{}".format(bytes, units[i], options.perSecond ? "/s" : "")
}

function samples(input){
	if(Math.abs(input) === 1){
		return "{} sample".format(input)
	}else{
		return "{} samples".format(input)
	}
}

function fade(opacity, modal){
	fadeoverlay.style.opacity = opacity
	if(modal){
		locked = true
		fadeoverlay.classList.add("modal")
	}else{
		locked = false
		fadeoverlay.classList.remove("modal")
	}
}

async function walkEntry(entry, path="", output=[]){
	await new Promise(async resolve => {
		if(entry.isFile){
			entry.file(file => {
				output.push(new File([file], path + file.name))
				return resolve()
			}, resolve)
		}else if(entry.isDirectory){
			var dirReader = entry.createReader()
			dirReader.readEntries(async entries => {
				var dirPromises = []
				for(var i = 0; i < entries.length; i++){
					dirPromises.push(walkEntry(entries[i], path + entry.name + "/", output))
				}
				await Promise.all(dirPromises)
				return resolve()
			}, resolve)
		}else{
			return resolve()
		}
	})
	return output
}

async function walkFilesystem(file, top, path="", output=[]){
	await filePermission(file)
	if(file.kind === "directory"){
		for await(let subfile of file.values()){
			await walkFilesystem(subfile, false, top ? "" : path + file.name + "/", output)
		}
	}else{
		output.push(new File([await file.getFile()], path + file.name))
	}
	return output
}

async function filePermission(file){
	if(await file.queryPermission() !== "granted"){
		if(await file.requestPermission() !== "granted"){
			throw new Error("File permission denied")
		}
	}
}

async function displayFiles(files){
	var inputFilename = await selectFile(files)
	if(inputFilename){
		try{
			var audio = await convertDir(files, inputFilename)
		}catch(e){
			throw workerError(e)
		}
		insertAudio(audio)
	}
}

async function selectFile(files){
	if(files.length === 0){
		return
	}else if(files.length === 1){
		return files[0].name
	}
	
	var audioStyle = audiobox.style.display
	audiobox.style.display = ""
	directorybox.style.display = "block"
	dirselect.innerText = ""
	
	var dir = []
	for(var i = 0; i < files.length; i++){
		dir.push(files[i])
	}
	dir = naturalSort(dir.map(file => file.name))
	dir.forEach(name => {
		var option = document.createElement("option")
		option.value = name
		option.innerText = name
		dirselect.appendChild(option)
	})
	dirselect.size = Math.max(2, Math.min(20, dir.length))
	dirselect.focus()
	
	var fileSelected
	var file = await new Promise(resolve => {
		dirPromise = resolve
		fileSelected = event => {
			if(event.type === "submit"){
				event.preventDefault()
			}
			if(dirselect.value){
				resolve(dirselect.value)
			}
		}
		dirselect.form.addEventListener("submit", fileSelected)
		dirselect.addEventListener("dblclick", fileSelected)
	})
	
	dirPromise = null
	dirselect.form.removeEventListener("submit", fileSelected)
	dirselect.removeEventListener("dblclick", fileSelected)
	directorybox.style.display = ""
	audiobox.style.display = audioStyle
	
	if(file){
		return file
	}
}

function naturalSort(input){
	var collator = new Intl.Collator(undefined, {
		numeric: true,
		sensitivity: "base"
	})
	return input.sort(collator.compare)
}

function cleanup(){
	audio.pause()
	if(dirPromise){
		dirPromise()
	}
}

async function validateUrl(input){
	try{
		var url = new URL(input)
	}catch(e){}
	if(!url || url.protocol !== "http:" && url.protocol !== "https:"){
		throw new Error("Not a valid URL\n{}".format(input))
	}
}

function checkFileHandling(){
	return new Promise(resolve => {
		if("launchQueue" in window && "files" in LaunchParams.prototype){
			launchQueue.setConsumer(async launchParams => {
				if(launchParams.files.length){
					resolve(true)
					fade(1, true)
					var promises = [cliWorker.load()]
					var files = []
					for(let i = 0; i < launchParams.files.length; i++){
						promises.push((async () => {
							var file = launchParams.files[i]
							await filePermission(file)
							files.push(new File([await file.getFile()], file.name))
						})().catch(e => {
							console.warn(e)
						}))
					}
					try{
						await Promise.all(promises)
					}catch(e){
						alert(e)
						return
					}finally{
						fade(0)
					}
					cleanup()
					if(!noConverting && files.length){
						if(files.length === 1){
							try{
								var audio = await convertDir(files, files[0].name)
							}catch(e){
								throw workerError(e)
							}
							insertAudio(audio)
						}else{
							displayFiles(files)
						}
					}
				}else{
					resolve(false)
				}
			})
		}else{
			resolve(false)
		}
	})
}

async function checkShareTarget(){
	try{
		var shareCache = await caches.open("share-target")
		var response = await shareCache.match("shared-file")
		if(response){
			const blob = await response.blob()
			const file = new File([blob], response.headers.get("name"))
			try{
				var audio = await convertDir([file], file.name)
			}catch(e){
				throw workerError(e)
			}
			insertAudio(audio)
			await shareCache.delete("shared-file")
		}
		hashLock = true
		history.replaceState("", "", location.pathname)
		hashLock = false
	}catch(e){}
}

async function checkHash(hashParams){
	fade(1, true)
	var promises = [cliWorker.load()]
	var files = []
	var base = ""
	var renameLast = () => {}
	var selectedFiles = []
	hashParams.forEach((value, name) => {
		var url = base + value
		switch(name){
			case "base":
				base = value
				break
			case "play":
			case "sub":
				var path = value
				if(!base){
					var path = url
					var index = path.lastIndexOf("/")
					if(index !== -1){
						path = path.slice(index + 1)
					}
				}
				renameLast = newPath => {
					path = newPath
				}
				promises.push(
					validateUrl(url)
					.then(() => 
						fetch(url)
						.catch(error => corsBridge(url))
						.catch(error => {
							throw new Error("Failed to download (connection or CORS error)\n{}".format(url))
						})
					)
					.then(response => {
						if(!response.ok){
							throw new Error("Failed to download (HTTP {})\n{}".format(response.status, url))
						}
						return response.arrayBuffer()
					})
					.then(buffer => {
						files.push(new File([buffer], path))
						if(name === "play"){
							selectedFiles.push(path)
						}
					})
				)
				break
			case "dir":
				renameLast(value)
				break
		}
	})
	try{
		await Promise.all(promises)
	}catch(e){
		alert(e)
		return
	}finally{
		fade(0)
	}
	cleanup()
	if(!noConverting){
		if(selectedFiles.length === 1){
			try{
				var audio = await convertDir(files, selectedFiles[0])
			}catch(e){
				throw workerError(e)
			}
			insertAudio(audio)
		}else{
			displayFiles(files)
		}
	}
}

String.prototype.format = function(){
	var i = 0
	return this.replaceAll("{}", input =>
		typeof arguments[i] !== "undefined" ? arguments[i++] : input
	)
}

document.addEventListener("dragenter", event => {
	event.preventDefault()
	dragTarget = event.target
})
document.addEventListener("dragover", event => {
	event.preventDefault()
	event.dataTransfer.dropEffect = "copy"
	if(!locked){
		fade(0.5)
	}
})
document.addEventListener("dragleave", event => {
	if(dragTarget === event.target){
		event.preventDefault()
		if(!locked){
			fade(0)
		}
	}
})
document.addEventListener("drop", async event => {
	event.preventDefault()
	if(locked){
		return
	}
	cleanup()
	fade(0)
	var items = event.dataTransfer.items
	if(!noConverting){
		var fileSystem = location.protocol === "https:" && DataTransferItem.prototype.getAsFileSystemHandle
		var files = []
		var dropPromises = []
		for(var i = 0; i < items.length; i++){
			let promise
			if(fileSystem){
				promise = items[i].getAsFileSystemHandle().then(file => walkFilesystem(file))
			}else{
				var entry = items[i].webkitGetAsEntry()
				if(entry){
					promise = walkEntry(entry)
				}
			}
			if(promise){
				dropPromises.push(promise.then(filelist => {
					files = files.concat(filelist)
				}))
			}
		}
		await Promise.all(dropPromises)
		displayFiles(files)
	}
})
browse.addEventListener("change", async event => {
	cleanup()
	var files = browse.files
	if(!noConverting && !locked){
		displayFiles(files)
	}
})
browsedir.addEventListener("change", async event => {
	cleanup()
	if(!noConverting && !locked){
		var files = []
		for(var i = 0; i < browsedir.files.length; i++){
			var file = browsedir.files[i]
			var path = file.webkitRelativePath
			var index = path.indexOf("/")
			if(index !== -1){
				path = path.slice(index + 1)
			}
			files.push(new File([file], path))
		}
		displayFiles(files)
	}
})
selectbtn.addEventListener("click", event => {
	if(!locked){
		browse.click()
	}
})
selectdirbtn.addEventListener("click", async event => {
	if(locked){
		return
	}
	if(typeof showDirectoryPicker === "function"){
		try{
			var file = await showDirectoryPicker()
		}catch(e){
			return
		}
		cleanup()
		if(!noConverting){
			var files = await walkFilesystem(file, true)
			displayFiles(files)
		}
	}else{
		browsedir.click()
	}
})
download.addEventListener("click", event => {
	if(locked){
		return
	}
	var link = document.createElement("a")
	link.href = audio.src
	if("download" in HTMLAnchorElement.prototype){
		link.download = dlfilename
	}else{
		link.target = "_blank"
	}
	link.innerText = "."
	link.style.opacity = "0"
	document.body.appendChild(link)
	setTimeout(() => {
		link.click()
		document.body.removeChild(link)
	})
})
logdropdown.addEventListener("mousedown", event => {
	event.preventDefault()
})
logdropdown.addEventListener("click", event => {
	logbox.classList.toggle("open")
})
logdropdown.addEventListener("keydown", event => {
	if(event.key === "Enter" && !locked){
		logbox.classList.toggle("open")
	}
})
addEventListener("hashchange", event => {
	if(!hashLock){
		location.reload()
	}
})

if("serviceWorker" in navigator){
	navigator.serviceWorker.register("service-worker.js")
}
addEventListener("beforeinstallprompt", event => {})
*/
