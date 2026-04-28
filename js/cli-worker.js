"use strict"

var wasmDir = "https://vgmstream.org/web/"

// 隊長！メッセージ受信を確認しました！
async function messageEvent(data){
	console.log("--- missionLog: messageEvent START ---");
	console.log("DATA SUBJECT:", data.subject);
	console.log("DATA SYMBOL:", data.symbol);
	
	var input = data.content
	console.log("INPUT CONTENT:", input);
	
	var output
	var error
	try{
		switch(data.subject){
			case "convertDir":
				console.log("ACTION: Running convertDir...");
				output = await convertDir(...input)
				break
			case "convertFile":
				console.log("ACTION: Running convertFile...");
				output = await convertFile(...input)
				break
			case "vgmstream":
				console.log("ACTION: Running raw vgmstream...");
				output = vgmstream(...input)
				break
			case "writeFile":
				console.log("ACTION: Running writeFile...");
				output = writeFile(...input)
				break
			case "readFile":
				console.log("ACTION: Running readFile...");
				output = readFile(...input)
				break
			case "deleteFile":
				console.log("ACTION: Running deleteFile...");
				output = deleteFile(...input)
				break
			default:
				error = new Error("Unknown message subject")
				console.log("ERROR: Unknown subject ->", data.subject);
				break
		}
	}catch(e){
		console.log("--- EXCEPTION CAUGHT IN messageEvent ---");
		error = cleanError(e)
		console.log("CLEANED ERROR:", error);
	}

	console.log("MISSION OUTPUT:", output);
	console.log("--- missionLog: messageEvent END ---");

	return postMessage({
		symbol: data.symbol,
		subject: data.subject,
		error: error,
		content: output
	})
}

function setupDir(dir, callback){
	console.log("--- missionLog: setupDir START ---");
	var wfs = "/workerfs"
	console.log("MOUNTING WORKERFS TO:", wfs);
	
	FS.mkdir(wfs)
	FS.mount(WORKERFS, {
		files: dir
	}, wfs)
	FS.chdir(wfs)
	console.log("CURRENT DIR CHANGED TO:", FS.cwd());

	try{
		console.log("EXECUTING CALLBACK...");
		var output = callback()
		console.log("CALLBACK OUTPUT:", output);
	}finally{
		console.log("CLEANING UP FS...");
		FS.chdir("/")
		FS.unmount(wfs)
		FS.rmdir(wfs)
		console.log("FS CLEANED. RETURNED TO ROOT.");
	}
	return output
}

async function convertDir(dir, inputFilename, arrayBuffer){
	console.log("--- missionLog: convertDir START ---");
	console.log("INPUT FILE:", inputFilename);
	
	var outputFilename = "/" + Math.random() + "output.wav"
	console.log("GENERATED OUTPUT NAME:", outputFilename);
	
	var output = setupDir(dir, () => {
		console.log("INVOKING vgmstream IN setupDir...");
		return vgmstream("-I", "-o", outputFilename, "-i", inputFilename)
	})
	
	console.log("vgmstream RESULT:", output);
	return getOutput(output, inputFilename, outputFilename, arrayBuffer)
}

async function convertFile(data, inputFilename, arrayBuffer){
	console.log("--- missionLog: convertFile START ---");
	console.log("INPUT FILE:", inputFilename, "DATA SIZE:", data ? data.length : "null");
	
	var outputFilename = "/" + Math.random() + "output.wav"
	console.log("GENERATED OUTPUT NAME:", outputFilename);
	
	console.log("WRITING INPUT FILE TO FS...");
	writeFile(inputFilename, data)
	
	console.log("INVOKING vgmstream...");
	var output = vgmstream("-I", "-o", outputFilename, "-i", inputFilename)
	
	console.log("DELETING TEMP INPUT FILE...");
	deleteFile(inputFilename)
	
	return getOutput(output, inputFilename, outputFilename, arrayBuffer)
}

function getOutput(output, inputFilename, outputFilename, arrayBuffer){
	console.log("--- missionLog: getOutput START ---");
	if(output.error){
		console.log("OUTPUT ERROR DETECTED!", output.error);
		deleteFile(outputFilename)
		var error = output.error
		error.stdout = output.stdout
		error.stderr = output.stderr
		throw error
	}
	
	console.log("READING GENERATED WAV:", outputFilename);
	var wavdata = readFile(outputFilename)
	
	if(!wavdata){
		console.log("ERROR: wavdata is NULL (Unsupported file)");
		var error = new Error("vgmstream: Unsupported file")
		error.stdout = output.stdout
		error.stderr = output.stderr
		throw error
	}
	
	console.log("WAV DATA READ SUCCESS. SIZE:", wavdata.length);
	deleteFile(outputFilename)
	
	output.inputFilename = inputFilename
	output.outputFilename = inputFilename + ".wav"
	
	if(arrayBuffer){
		console.log("MODE: ArrayBuffer");
		output.arrayBuffer = wavdata.buffer
	}else{
		console.log("MODE: Blob URL");
		output.url = URL.createObjectURL(new Blob([wavdata], {
			type: "audio/x-wav"
		}))
		console.log("OBJECT URL:", output.url);
	}
	
	console.log("--- missionLog: getOutput END ---");
	return output
}

function writeFile(name, data){
	console.log(`FS_WRITE: [${name}] size: ${data.length}`);
	var stream = FS.open(name, "w+")
	FS.write(stream, data, 0, data.length, 0)
	FS.close(stream)
}

function readFile(name){
	console.log(`FS_READ: [${name}]`);
	try{
		var file = FS.open(name, "r")
		var data = new Uint8Array(file.node.usedBytes)
		FS.read(file, data, 0, file.node.usedBytes, 0)
		FS.close(file)
		console.log(`FS_READ SUCCESS: [${name}] ${data.length} bytes`);
		return data
	}catch(e){
		console.log(`FS_READ FAILED: [${name}]`, e.message);
		return null
	}
}

function deleteFile(name){
	console.log(`FS_DELETE: [${name}]`);
	try{
		FS.unlink(name)
		console.log(`FS_DELETE SUCCESS: [${name}]`);
	}catch(e){
		console.log(`FS_DELETE FAILED: [${name}]`, e.message);
	}
}

function vgmstream(...args){
	console.log("--- vgmstream CALL ---");
	console.log("ARGS:", args);
	stdoutBuffer = ""
	stderrBuffer = ""
	var error
	try{
		callMain(args)
		console.log("callMain FINISHED SUCCESSFULLY");
	}catch(e){
		console.log("callMain CAUGHT ERROR:", e.message);
		e.type = "wasm"
		throw e
	}
	var output = {
		stdout: stdoutBuffer,
		stderr: stderrBuffer
	}
	console.log("STDOUT LEN:", stdoutBuffer.length);
	console.log("STDERR LEN:", stderrBuffer.length);
	
	stdoutBuffer = ""
	stderrBuffer = ""
	if(error){
		output.error = error
	}
	return output
}

function errorLoading(file){
	console.log("CRITICAL ERROR: Failed to load ->", file);
	postMessage({
		subject: "load",
		error: "Error loading " + file
	})
}

async function loadCli(){
	console.log("--- missionLog: loadCli START ---");
	var wasmBlobUrl
	wasmUri = name => wasmDir + name
	
	console.log("CHECKING WASM VERSION...");
	try{
		await fetch(wasmDir + "version")
	}catch(e){
		console.log("Version check failed (ignoring)");
	}
	
	var cliJs
	try{
		console.log("FETCHING vgmstream-cli.js...");
		cliJs = await (await fetch(wasmDir + "vgmstream-cli.js")).text()
		console.log("JS FETCHED. LENGTH:", cliJs.length);
	}catch(e){
		console.log("JS FETCH FAILED:", e.message);
	}
	
	if(!cliJs){
		return errorLoading("vgmstream-cli.js")
	}
	
	try{
		console.log("EVALUATING cliJs...");
		eval.bind()(cliJs)
		console.log("EVAL SUCCESS");
	}catch(e){
		console.error("EVAL ERROR:", e);
		return errorLoading("vgmstream-cli.js")
	}
	
	try{
		console.log("WAITING FOR WASM RUNTIME...");
		await new Promise((resolve, reject) => {
			Module["onRuntimeInitialized"] = () => {
				console.log("WASM ON_RUNTIME_INITIALIZED");
				resolve()
			}
			Module["onAbort"] = (err) => {
				console.log("WASM ON_ABORT:", err);
				reject(err)
			}
		})
		console.log("WASM RUNTIME INITIALIZED!");
	}catch(e){
		console.error("WASM INIT ERROR:", e);
		return errorLoading("vgmstream-cli.wasm")
	}
	
	if(wasmBlobUrl){
		URL.revokeObjectURL(wasmBlobUrl)
	}
	
	console.log("--- loadCli COMPLETED SUCCESSFULLY ---");
	return postMessage({
		subject: "load"
	})
}

function cleanError(error){
	console.log("CLEANING ERROR OBJECT...");
	var output = {
		name: error.name,
		message: error.message,
		stack: error.stack
	}
	for(var i in error){
		output[i] = error[i]
	}
	return output
}

var wasmUri
var stdoutBuffer = ""
var stderrBuffer = ""
var Module = {
	preRun: () => {
		console.log("Module.preRun: Initializing FS...");
		FS.init(undefined, code => {
			if(code !== null){
				stdoutBuffer += String.fromCharCode(code)
			}
		}, code => {
			if(code !== null){
				stderrBuffer += String.fromCharCode(code)
			}
		})
	},
	noInitialRun: true,
	locateFile: name => {
		let uri = wasmUri(name);
		console.log(`LOCATING FILE: ${name} -> ${uri}`);
		return uri;
	}
}

console.log("SETTING UP MESSAGE LISTENER...");
addEventListener("message", event => messageEvent(event.data))

console.log("STARTING INITIAL LOAD...");
loadCli()
/*
"use strict"

var wasmDir = "https://vgmstream.org/web/"

async function messageEvent(data){
	var input = data.content
	console.log(input);
	var output
	var error
	try{
		switch(data.subject){
			case "convertDir":
				output = await convertDir(...input)
				break
			case "convertFile":
				output = await convertFile(...input)
				break
			case "vgmstream":
				output = vgmstream(...input)
				break
			case "writeFile":
				output = writeFile(...input)
				break
			case "readFile":
				output = readFile(...input)
				break
			case "deleteFile":
				output = deleteFile(...input)
				break
			default:
				error = new Error("Unknown message subject")
				console.log(error);
				break
		}
	}catch(e){
		error = cleanError(e)
		console.log(error);
	}
	return postMessage({
		symbol: data.symbol,
		subject: data.subject,
		error: error,
		content: output
	})
}

function setupDir(dir, callback){
	var wfs = "/workerfs"
	FS.mkdir(wfs)
	FS.mount(WORKERFS, {
		files: dir
	}, wfs)
	FS.chdir(wfs)
	try{
		var output = callback()
	}finally{
		FS.chdir("/")
		FS.unmount(wfs)
		FS.rmdir(wfs)
	}
	return output
}

async function convertDir(dir, inputFilename, arrayBuffer){
	var outputFilename = "/" + Math.random() + "output.wav"
	
	var output = setupDir(dir, () => vgmstream("-I", "-o", outputFilename, "-i", inputFilename))
	
	return getOutput(output, inputFilename, outputFilename, arrayBuffer)
}

async function convertFile(data, inputFilename, arrayBuffer){
	var outputFilename = "/" + Math.random() + "output.wav"
	
	writeFile(inputFilename, data)
	var output = vgmstream("-I", "-o", outputFilename, "-i", inputFilename)
	deleteFile(inputFilename)
	
	return getOutput(output, inputFilename, outputFilename, arrayBuffer)
}

function getOutput(output, inputFilename, outputFilename, arrayBuffer){
	if(output.error){
		deleteFile(outputFilename)
		var error = output.error
		error.stdout = output.stdout
		error.stderr = output.stderr
		throw error
	}
	var wavdata = readFile(outputFilename)
	if(!wavdata){
		var error = new Error("vgmstream: Unsupported file")
		error.stdout = output.stdout
		error.stderr = output.stderr
		throw error
	}
	deleteFile(outputFilename)
	output.inputFilename = inputFilename
	output.outputFilename = inputFilename + ".wav"
	if(arrayBuffer){
		output.arrayBuffer = wavdata.buffer
	}else{
		output.url = URL.createObjectURL(new Blob([wavdata], {
			type: "audio/x-wav"
		}))
	}
	return output
}

function writeFile(name, data){
	var stream = FS.open(name, "w+")
	FS.write(stream, data, 0, data.length, 0)
	FS.close(stream)
}

function readFile(name){
	try{
		var file = FS.open(name, "r")
	}catch(e){
		return null
	}
	var data = new Uint8Array(file.node.usedBytes)
	FS.read(file, data, 0, file.node.usedBytes, 0)
	FS.close(file)
	return data
}

function deleteFile(name){
	try{
		FS.unlink(name)
	}catch(e){}
}

function vgmstream(...args){
	stdoutBuffer = ""
	stderrBuffer = ""
	var error
	try{
		callMain(args)
	}catch(e){
		e.type = "wasm"
		throw e
	}
	var output = {
		stdout: stdoutBuffer,
		stderr: stderrBuffer
	}
	stdoutBuffer = ""
	stderrBuffer = ""
	if(error){
		output.error = error
	}
	return output
}

function errorLoading(file){
	postMessage({
		subject: "load",
		error: "Error loading " + file
	})
}

async function loadCli(){
	var wasmBlobUrl
	wasmUri = name => wasmDir + name
	try{
		await fetch(wasmDir + "version")
	}catch(e){}
	var cliJs
	try{
		cliJs = await (await fetch(wasmDir + "vgmstream-cli.js")).text()
	}catch(e){}
	if(!cliJs){
		return errorLoading("vgmstream-cli.js")
	}
	try{
		eval.bind()(cliJs)
	}catch(e){
		console.error(e)
		return errorLoading("vgmstream-cli.js")
	}
	try{
		await new Promise((resolve, reject) => {
			Module["onRuntimeInitialized"] = resolve
			Module["onAbort"] = reject
		})
	}catch(e){
		console.error(e)
		return errorLoading("vgmstream-cli.wasm")
	}
	if(wasmBlobUrl){
		URL.revokeObjectURL(wasmBlobUrl)
	}
	return postMessage({
		subject: "load"
	})
}

function cleanError(error){
	var output = {
		name: error.name,
		message: error.message,
		stack: error.stack
	}
	for(var i in error){
		output[i] = error[i]
	}
	return output
}

var wasmUri
var stdoutBuffer = ""
var stderrBuffer = ""
var Module = {
	preRun: () => {
		FS.init(undefined, code => {
			if(code !== null){
				stdoutBuffer += String.fromCharCode(code)
			}
		}, code => {
			if(code !== null){
				stderrBuffer += String.fromCharCode(code)
			}
		})
	},
	noInitialRun: true,
	locateFile: name => wasmUri(name)
}
addEventListener("message", event => messageEvent(event.data))
loadCli()
*/

