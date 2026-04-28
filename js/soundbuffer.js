"use strict"

class SoundBuffer{
	constructor(){
		missionLog("INFO", "SoundBuffer: コンストラクタ起動");
		var AudioContext = window.AudioContext || window.webkitAudioContext
		this.context = new AudioContext({latencyHint: "playback"})
		this.audioDecoder = this.context.decodeAudioData.bind(this.context)
		this.oggDecoder = this.audioDecoder
		this.pageClickedBind = this.pageClicked.bind(this)
		
		missionLog("EVENT", "SoundBuffer: ユーザー操作によるAudioContext再開イベントを登録");
		addEventListener("click", this.pageClickedBind)
		addEventListener("touchend", this.pageClickedBind)
		addEventListener("keypress", this.pageClickedBind)
		this.gainList = []
	}
	load(file, gain){
		missionLog("ACTION", `SoundBuffer: ファイル読み込み開始 - File: ${file?.name || "unknown"}`);
		var decoder = this.audioDecoder
		return file.arrayBuffer().then(response => {
			missionLog("DATA", "SoundBuffer: ArrayBuffer変換完了、デコード中...");
			return new Promise((resolve, reject) => {
				return decoder(response, resolve, reject)
			})
		}).then(buffer => {
			missionLog("SUCCESS", `SoundBuffer: デコード完了 (Duration: ${buffer.duration}s)`);
			return new Sound(gain || {soundBuffer: this}, buffer)
		})
	}
	createGain(channel){
		missionLog("ACTION", `SoundBuffer: SoundGain生成 (Channel: ${channel || "stereo"})`);
		var gain = new SoundGain(this, channel)
		this.gainList.push(gain)
		return gain
	}
	setCrossfade(gain1, gain2, median){
		missionLog("ACTION", `SoundBuffer: クロスフェード設定 (Median: ${median})`);
		if(!Array.isArray(gain1)){
			gain1 = [gain1]
		}
		if(!Array.isArray(gain2)){
			gain2 = [gain2]
		}
		gain1.forEach(gain => {
			missionLog("VALUE", `SoundBuffer: Gain1 クロスフェード適用 -> ${1 - median}`);
			gain.setCrossfade(1 - median)
		});
		gain2.forEach(gain => {
			missionLog("VALUE", `SoundBuffer: Gain2 クロスフェード適用 -> ${median}`);
			gain.setCrossfade(median)
		});
	}
	getTime(){
		var now = this.context.currentTime;
		// ログが多すぎる可能性を考慮しつつも、必要な時に出す
		return now
	}
	convertTime(time, absolute){
		time = (time || 0)
		if(time < 0){
			missionLog("WARN", "SoundBuffer: 指定時間が負のため0に修正されました");
			time = 0
		}
		var result = time + (absolute ? 0 : this.getTime());
		missionLog("VALUE", `SoundBuffer: 時間変換 [IN: ${time}, ABS: ${absolute}] -> OUT: ${result}`);
		return result
	}
	createSource(sound){
		missionLog("ACTION", "SoundBuffer: BufferSource生成");
		var source = this.context.createBufferSource()
		source.buffer = sound.buffer
		source.connect(sound.gain.gainNode || this.context.destination)
		return source
	}
	pageClicked(){
		missionLog("EVENT", `SoundBuffer: ユーザー操作検知 (State: ${this.context.state})`);
		if(this.context.state === "suspended"){
			missionLog("ACTION", "SoundBuffer: AudioContextを再開します...");
			this.context.resume().then(() => {
				missionLog("SUCCESS", "SoundBuffer: AudioContextが正常に再開されました");
			})
		}
	}
	saveSettings(){
		missionLog("ACTION", `SoundBuffer: 現在の音量設定をデフォルトとして保存 (${this.gainList.length}個)`);
		for(var i = 0; i < this.gainList.length; i++){
			var gain = this.gainList[i]
			gain.defaultVol = gain.volume
			missionLog("VALUE", `SoundBuffer: Gain[${i}] defaultVol = ${gain.defaultVol}`);
		}
	}
	loadSettings(){
		missionLog("ACTION", "SoundBuffer: 保存された音量設定を復元します");
		for(var i = 0; i < this.gainList.length; i++){
			var gain = this.gainList[i]
			missionLog("VALUE", `SoundBuffer: Gain[${i}] を ${gain.defaultVol} に戻します`);
			gain.setVolume(gain.defaultVol)
		}
	}
	fallbackDecoder(buffer, resolve, reject){
		missionLog("WARN", "SoundBuffer: フォールバックデコーダー(Oggmented)を起動します");
		Oggmented().then(oggmented => {
			missionLog("ACTION", "SoundBuffer: OggDataデコード開始");
			oggmented.decodeOggData(buffer, resolve, reject)
		}, (err) => {
			missionLog("ERROR", "SoundBuffer: Oggmentedのロードに失敗");
			reject(err);
		})
	}
}

class SoundGain{
	constructor(soundBuffer, channel){
		missionLog("INFO", `SoundGain: コンストラクタ起動 (Channel: ${channel})`);
		this.soundBuffer = soundBuffer
		this.gainNode = soundBuffer.context.createGain()
		if(channel){
			var index = channel === "left" ? 0 : 1
			missionLog("ACTION", `SoundGain: パンニング設定 (${channel} / Index: ${index})`);
			this.merger = soundBuffer.context.createChannelMerger(2)
			this.merger.connect(soundBuffer.context.destination)
			this.gainNode.connect(this.merger, 0, index)
		}else{
			missionLog("ACTION", "SoundGain: ステレオ（通常）接続");
			this.gainNode.connect(soundBuffer.context.destination)
		}
		this.setVolume(1)
	}
	load(url){
		missionLog("ACTION", `SoundGain: URLからロード開始: ${url}`);
		return this.soundBuffer.load(url, this)
	}
	convertTime(time, absolute){
		return this.soundBuffer.convertTime(time, absolute)
	}
	setVolume(amount){
		missionLog("VALUE", `SoundGain: 音量変更 -> ${amount} (GainNode: ${amount * amount})`);
		this.gainNode.gain.value = amount * amount
		this.volume = amount
	}
	setVolumeMul(amount){
		missionLog("ACTION", `SoundGain: 乗算音量設定 (${amount} * ${this.defaultVol})`);
		this.setVolume(amount * this.defaultVol)
	}
	setCrossfade(amount){
		var val = Math.sqrt(Math.sin(Math.PI / 2 * amount));
		missionLog("VALUE", `SoundGain: クロスフェード計算値 -> ${val}`);
		this.setVolume(val)
	}
	fadeIn(duration, time, absolute){
		missionLog("ACTION", `SoundGain: フェードイン開始 (Duration: ${duration}s)`);
		this.fadeVolume(0, this.volume * this.volume, duration, time, absolute)
	}
	fadeOut(duration, time, absolute){
		missionLog("ACTION", `SoundGain: フェードアウト開始 (Duration: ${duration}s)`);
		this.fadeVolume(this.volume * this.volume, 0, duration, time, absolute)
	}
	fadeVolume(vol1, vol2, duration, time, absolute){
		time = this.convertTime(time, absolute)
		missionLog("ACTION", `SoundGain: 音量遷移予約 [${vol1} -> ${vol2}] (Start: ${time}, End: ${time + (duration || 0)})`);
		this.gainNode.gain.linearRampToValueAtTime(vol1, time)
		this.gainNode.gain.linearRampToValueAtTime(vol2, time + (duration || 0))
	}
	mute(){
		missionLog("ACTION", "SoundGain: ミュート(音量0)");
		this.gainNode.gain.value = 0
	}
	unmute(){
		missionLog("ACTION", `SoundGain: ミュート解除 (音量: ${this.volume} に復帰)`);
		this.setVolume(this.volume)
	}
}

class Sound{
	constructor(gain, buffer){
		missionLog("INFO", "Sound: インスタンス生成");
		this.gain = gain
		this.buffer = buffer
		this.soundBuffer = gain.soundBuffer
		this.duration = buffer.duration
		this.timeouts = new Set()
		this.sources = new Set()
		this.intervals = new Set()
		missionLog("VALUE", `Sound: Duration = ${this.duration}s`);
	}
	copy(gain){
		missionLog("ACTION", "Sound: 複製(Copy)を作成");
		return new Sound(gain || this.gain, this.buffer)
	}
	getTime(){
		return this.soundBuffer.getTime()
	}
	convertTime(time, absolute){
		return this.soundBuffer.convertTime(time, absolute)
	}
	setTimeouts(time){
		return new Promise(resolve => {
			var relTime = time - this.getTime()
			missionLog("DEBUG", `Sound: setTimeouts [Relative: ${relTime}s]`);
			if(relTime > 0){
				var timeout = setTimeout(() => {
					missionLog("EVENT", "Sound: タイマー実行（再生設定処理）");
					this.timeouts.delete(timeout)
					resolve()
				}, relTime * 1000)
				this.timeouts.add(timeout)
			}else{
				resolve()
			}
		})
	}
	clearTimeouts(){
		missionLog("ACTION", `Sound: 待機中のタイマーを全解除 (${this.timeouts.size}件)`);
		this.timeouts.forEach(timeout => {
			clearTimeout(timeout)
			this.timeouts.delete(timeout)
		})
	}
	playLoop(time, absolute, seek1, seek2, until){
		missionLog("ACTION", `Sound: ループ再生予約 [Seek1: ${seek1}, Seek2: ${seek2}, Until: ${until}]`);
		time = this.convertTime(time, absolute)
		seek1 = seek1 || 0
		if(typeof seek2 === "undefined"){
			seek2 = seek1
		}
		until = until || this.duration
		if(seek1 >= until || seek2 >= until){
			missionLog("ERROR", "Sound: ループのシーク位置が終了時間を超えています。中止。");
			return
		}
		this.loop = {
			started: time + until - seek1,
			seek: seek2,
			until: until
		}
		missionLog("VALUE", `Sound: Loop設定完了 (Next Trigger: ${this.loop.started})`);
		this.play(time, true, seek1, until)
		this.addLoop()
		
		var interval = setInterval(() => {
			this.addLoop()
		}, 100);
		this.intervals.add(interval)
	}
	addLoop(){
		var now = this.getTime();
		while(now > this.loop.started - 1){
			missionLog("EVENT", `Sound: ループポイント到達。次パート再生開始 (Time: ${this.loop.started})`);
			this.play(this.loop.started, true, this.loop.seek, this.loop.until)
			this.loop.started += this.loop.until - this.loop.seek
			missionLog("VALUE", `Sound: 次回ループ予定時刻更新 -> ${this.loop.started}`);
		}
	}
	play(time, absolute, seek, until, onended){
		time = this.convertTime(time, absolute)
		missionLog("ACTION", `Sound: 再生開始 [Time: ${time}, Seek: ${seek || 0}, Until: ${until || this.duration}]`);
		var source = this.soundBuffer.createSource(this)
		seek = seek || 0
		until = until || this.duration
		
		this.setTimeouts(time).then(() => {
			this.cfg = {
				started: time,
				seek: seek,
				until: until
			}
			missionLog("DEBUG", "Sound: 再生コンフィグ(cfg)を保存");
		})
		
		source.start(time, Math.max(0, seek || 0), Math.max(0, until - seek))
		source.startTime = time
		this.sources.add(source)
		
		source.onended = () => {
			missionLog("EVENT", "Sound: 再生終了(onended)");
			this.sources.delete(source)
			if(onended){
				onended()
			}
		}
	}
	stop(time, absolute){
		time = this.convertTime(time, absolute)
		missionLog("ACTION", `Sound: 停止命令 (Target Time: ${time}, Active Sources: ${this.sources.size})`);
		this.sources.forEach(source => {
			try{
				source.stop(Math.max(source.startTime, time))
				missionLog("DEBUG", "Sound: Sourceを停止させました");
			}catch(e){
				missionLog("WARN", "Sound: Source停止中にエラー（既に停止している可能性があります）");
			}
		})
		if(this.loop){
			missionLog("ACTION", "Sound: ループインターバルをクリア");
			this.intervals.forEach(interval => {
				clearInterval(interval)
				this.intervals.delete(interval)
			})
		}
		this.setTimeouts(time).then(() => {
			this.clearTimeouts()
		})
	}
	pause(time, absolute){
		if(this.cfg){
			time = this.convertTime(time, absolute)
			missionLog("ACTION", `Sound: 一時停止 (Time: ${time})`);
			this.stop(time, true)
			this.cfg.pauseSeek = time - this.cfg.started + this.cfg.seek
			missionLog("VALUE", `Sound: 再開用シーク位置を保持 -> ${this.cfg.pauseSeek}`);
		}
	}
	resume(time, absolute){
		if(this.cfg){
			missionLog("ACTION", `Sound: 再開 (Seek: ${this.cfg.pauseSeek})`);
			if(this.loop){
				this.playLoop(time, absolute, this.cfg.pauseSeek, this.loop.seek, this.loop.until)
			}else{
				this.play(time, absolute, this.cfg.pauseSeek, this.cfg.until)
			}
		}else{
			missionLog("WARN", "Sound: 再開しようとしましたが、再生履歴(cfg)がありません");
		}
	}
	clean(){
		missionLog("ACTION", "Sound: バッファのクリーンアップを実行");
		delete this.buffer
	}
}
/*
"use strict"

class SoundBuffer{
	constructor(){
		var AudioContext = window.AudioContext || window.webkitAudioContext
		this.context = new AudioContext({latencyHint: "playback"})
		this.audioDecoder = this.context.decodeAudioData.bind(this.context)
		this.oggDecoder = this.audioDecoder
		this.pageClickedBind = this.pageClicked.bind(this)
		addEventListener("click", this.pageClickedBind)
		addEventListener("touchend", this.pageClickedBind)
		addEventListener("keypress", this.pageClickedBind)
		this.gainList = []
	}
	load(file, gain){
		var decoder = this.audioDecoder
		return file.arrayBuffer().then(response => {
			return new Promise((resolve, reject) => {
				return decoder(response, resolve, reject)
			})
		}).then(buffer => {
			return new Sound(gain || {soundBuffer: this}, buffer)
		})
	}
	createGain(channel){
		var gain = new SoundGain(this, channel)
		this.gainList.push(gain)
		return gain
	}
	setCrossfade(gain1, gain2, median){
		if(!Array.isArray(gain1)){
			gain1 = [gain1]
		}
		if(!Array.isArray(gain2)){
			gain2 = [gain2]
		}
		gain1.forEach(gain => gain.setCrossfade(1 - median))
		gain2.forEach(gain => gain.setCrossfade(median))
	}
	getTime(){
		return this.context.currentTime
	}
	convertTime(time, absolute){
		time = (time || 0)
		if(time < 0){
			time = 0
		}
		return time + (absolute ? 0 : this.getTime())
	}
	createSource(sound){
		var source = this.context.createBufferSource()
		source.buffer = sound.buffer
		source.connect(sound.gain.gainNode || this.context.destination)
		return source
	}
	pageClicked(){
		if(this.context.state === "suspended"){
			this.context.resume()
		}
	}
	saveSettings(){
		for(var i = 0; i < this.gainList.length; i++){
			var gain = this.gainList[i]
			gain.defaultVol = gain.volume
		}
	}
	loadSettings(){
		for(var i = 0; i < this.gainList.length; i++){
			var gain = this.gainList[i]
			gain.setVolume(gain.defaultVol)
		}
	}
	fallbackDecoder(buffer, resolve, reject){
		Oggmented().then(oggmented => oggmented.decodeOggData(buffer, resolve, reject), reject)
	}
}
class SoundGain{
	constructor(soundBuffer, channel){
		this.soundBuffer = soundBuffer
		this.gainNode = soundBuffer.context.createGain()
		if(channel){
			var index = channel === "left" ? 0 : 1
			this.merger = soundBuffer.context.createChannelMerger(2)
			this.merger.connect(soundBuffer.context.destination)
			this.gainNode.connect(this.merger, 0, index)
		}else{
			this.gainNode.connect(soundBuffer.context.destination)
		}
		this.setVolume(1)
	}
	load(url){
		return this.soundBuffer.load(url, this)
	}
	convertTime(time, absolute){
		return this.soundBuffer.convertTime(time, absolute)
	}
	setVolume(amount){
		this.gainNode.gain.value = amount * amount
		this.volume = amount
	}
	setVolumeMul(amount){
		this.setVolume(amount * this.defaultVol)
	}
	setCrossfade(amount){
		this.setVolume(Math.sqrt(Math.sin(Math.PI / 2 * amount)))
	}
	fadeIn(duration, time, absolute){
		this.fadeVolume(0, this.volume * this.volume, duration, time, absolute)
	}
	fadeOut(duration, time, absolute){
		this.fadeVolume(this.volume * this.volume, 0, duration, time, absolute)
	}
	fadeVolume(vol1, vol2, duration, time, absolute){
		time = this.convertTime(time, absolute)
		this.gainNode.gain.linearRampToValueAtTime(vol1, time)
		this.gainNode.gain.linearRampToValueAtTime(vol2, time + (duration || 0))
	}
	mute(){
		this.gainNode.gain.value = 0
	}
	unmute(){
		this.setVolume(this.volume)
	}
}
class Sound{
	constructor(gain, buffer){
		this.gain = gain
		this.buffer = buffer
		this.soundBuffer = gain.soundBuffer
		this.duration = buffer.duration
		this.timeouts = new Set()
		this.sources = new Set()
		this.intervals = new Set()
	}
	copy(gain){
		return new Sound(gain || this.gain, this.buffer)
	}
	getTime(){
		return this.soundBuffer.getTime()
	}
	convertTime(time, absolute){
		return this.soundBuffer.convertTime(time, absolute)
	}
	setTimeouts(time){
		return new Promise(resolve => {
			var relTime = time - this.getTime()
			if(relTime > 0){
				var timeout = setTimeout(() => {
					this.timeouts.delete(timeout)
					resolve()
				}, relTime * 1000)
				this.timeouts.add(timeout)
			}else{
				resolve()
			}
		})
	}
	clearTimeouts(){
		this.timeouts.forEach(timeout => {
			clearTimeout(timeout)
			this.timeouts.delete(timeout)
		})
	}
	playLoop(time, absolute, seek1, seek2, until){
		time = this.convertTime(time, absolute)
		seek1 = seek1 || 0
		if(typeof seek2 === "undefined"){
			seek2 = seek1
		}
		until = until || this.duration
		if(seek1 >= until || seek2 >= until){
			return
		}
		this.loop = {
			started: time + until - seek1,
			seek: seek2,
			until: until
		}
		this.play(time, true, seek1, until)
		this.addLoop()
		this.intervals.add(setInterval(() => {
			this.addLoop()
		}, 100))
	}
	addLoop(){
		while(this.getTime() > this.loop.started - 1){
			this.play(this.loop.started, true, this.loop.seek, this.loop.until)
			this.loop.started += this.loop.until - this.loop.seek
		}
	}
	play(time, absolute, seek, until, onended){
		time = this.convertTime(time, absolute)
		var source = this.soundBuffer.createSource(this)
		seek = seek || 0
		until = until || this.duration
		this.setTimeouts(time).then(() => {
			this.cfg = {
				started: time,
				seek: seek,
				until: until
			}
		})
		source.start(time, Math.max(0, seek || 0), Math.max(0, until - seek))
		source.startTime = time
		this.sources.add(source)
		source.onended = () => {
			this.sources.delete(source)
			if(onended){
				onended()
			}
		}
	}
	stop(time, absolute){
		time = this.convertTime(time, absolute)
		this.sources.forEach(source => {
			try{
				source.stop(Math.max(source.startTime, time))
			}catch(e){}
		})
		if(this.loop){
			this.intervals.forEach(interval => {
				clearInterval(interval)
				this.intervals.delete(interval)
			})
		}
		this.setTimeouts(time).then(() => {
			this.clearTimeouts()
		})
	}
	pause(time, absolute){
		if(this.cfg){
			time = this.convertTime(time, absolute)
			this.stop(time, true)
			this.cfg.pauseSeek = time - this.cfg.started + this.cfg.seek
		}
	}
	resume(time, absolute){
		if(this.cfg){
			if(this.loop){
				this.playLoop(time, absolute, this.cfg.pauseSeek, this.loop.seek, this.loop.until)
			}else{
				this.play(time, absolute, this.cfg.pauseSeek, this.cfg.until)
			}
		}
	}
	clean(){
		delete this.buffer
	}
}
*/
