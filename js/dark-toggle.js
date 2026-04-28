"use strict"

// 隊長、ログ埋め尽くし作戦を開始します！🫡
function missionLog(type, message) {
    console.log(`[${type}] ${message}`);
}

class DarkToggle {
    constructor() {
        missionLog("INIT", "DarkToggle クラスの初期化を開始します！");
        this.toggles = new Set();
        this.resets = new Set();
        this.autoLocked = false;
        missionLog("STATUS", `初期 autoLocked: ${this.autoLocked}`);

        var mediaStyles = document.querySelectorAll("link[rel='stylesheet'][media]");
        missionLog("SCAN", `スタイルシートをスキャン中... 合計: ${mediaStyles.length}件`);
        this.styles = new Set();
        for (var i = 0; i < mediaStyles.length; i++) {
            if (mediaStyles[i].media.startsWith("(prefers-color-scheme:")) {
                missionLog("FOUND", `ダークモード関連のスタイルを発見: ${mediaStyles[i].href}`);
                this.styles.add(mediaStyles[i]);
            }
        }

        this.colorscheme = document.querySelector("meta[name=color-scheme]");
        missionLog("INFO", `meta[name=color-scheme] の状態: ${this.colorscheme ? "存在します" : "見つかりません"}`);

        this.media = matchMedia("(prefers-color-scheme: dark)");
        missionLog("OS_THEME", `OSの現在の設定: ${this.media.matches ? "DARK" : "LIGHT"}`);

        this.media.addEventListener("change", () => {
            missionLog("EVENT", "OSのテーマ変更を検知しました！");
            this.changeTheme(this.media.matches, true);
        });

        var storage = localStorage.vgmPlayerTheme;
        missionLog("STORAGE", `localStorage の値: ${storage}`);
        
        if (storage === "dark" || storage === "light") {
            missionLog("ACTION", "保存された設定を適用します（autoLocked = true）");
            this.autoLocked = true;
            this.changeTheme(storage === "dark");
        } else {
            missionLog("ACTION", "保存設定がないためOS設定に従います");
            this.changeTheme(this.media.matches);
        }
    }

    addToggle(toggle) {
        missionLog("ADD", "トグルボタンを登録しました");
        this.toggles.add(toggle);
        toggle.textContent = this.dark ? "Light theme" : "Dark theme";
        this.linkClick(toggle, this.toggleTheme.bind(this));
    }

    addReset(reset) {
        missionLog("ADD", "リセットボタンを登録しました");
        this.resets.add(reset);
        reset.style.display = this.autoLocked ? "inline" : "";
        this.linkClick(reset, this.resetTheme.bind(this));
    }

    linkClick(link, callback) {
        link.addEventListener("click", (e) => {
            missionLog("CLICK", `クリックイベント発生: ${link.id || link.tagName}`);
            callback();
        });
        link.addEventListener("keypress", event => {
            if (event.key === "Enter") {
                missionLog("KEYPRESS", "Enterキー入力を検知しました");
                callback();
            }
        });
    }

    changeTheme(dark, auto) {
        missionLog("THEME_CHANGE", `テーマ変更実行 -> Dark: ${dark}, Auto: ${auto}`);
        if (auto && this.autoLocked) {
            missionLog("SKIP", "ユーザー設定が優先されているため、OS設定の変更を無視します");
            return;
        }
        this.dark = dark;
        missionLog("STATUS", `現在のテーマ状態 (this.dark): ${this.dark}`);

        if (this.colorscheme) {
            const contentValue = this.autoLocked ? (dark ? "dark" : "light") : "light dark";
            this.colorscheme.content = contentValue;
            missionLog("DOM", `meta content を更新: ${contentValue}`);
        }

        this.styles.forEach(style => {
            const mediaValue = this.autoLocked ? (dark ? "all" : "not all") : "(prefers-color-scheme: dark)";
            style.media = mediaValue;
            style.disabled = !dark;
            missionLog("STYLE", `Style media 更新: ${mediaValue}, disabled: ${style.disabled}`);
        });

        this.toggles.forEach(toggle => {
            toggle.textContent = this.dark ? "Light theme" : "Dark theme";
        });
        missionLog("UI", `トグルテキストを ${this.dark ? "Light" : "Dark"} に更新しました`);

        this.resets.forEach(reset => {
            reset.style.display = this.autoLocked ? "inline" : "";
        });
        missionLog("UI", `リセットボタンの表示状態: ${this.autoLocked ? "表示" : "非表示"}`);
    }

    toggleTheme() {
        missionLog("ACTION", "テーマの手動切り替えを開始します");
        this.autoLocked = true;
        this.changeTheme(!this.dark);
        localStorage.vgmPlayerTheme = this.dark ? "dark" : "light";
        missionLog("STORAGE", `localStorage に保存: ${localStorage.vgmPlayerTheme}`);
    }

    resetTheme() {
        missionLog("ACTION", "テーマをリセット（OS設定に追従）します");
        this.autoLocked = false;
        this.changeTheme(this.media.matches);
        localStorage.removeItem("vgmPlayerTheme");
        missionLog("STORAGE", "localStorage の設定を削除しました");
    }
}

function addToggles() {
    missionLog("BOOT", "要素の紐付け（addToggles）を開始します");
    const darkToggleEl = document.getElementById("darktoggle");
    const darkResetEl = document.getElementById("darkreset");

    if (darkToggleEl) {
        darkToggle.addToggle(darkToggleEl);
    } else {
        missionLog("ERROR", "id='darktoggle' が見つかりません");
    }

    if (darkResetEl) {
        darkToggle.addReset(darkResetEl);
    } else {
        missionLog("ERROR", "id='darkreset' が見つかりません");
    }
}

missionLog("BOOT", "スクリプトの実行を開始します");
var darkToggle = new DarkToggle();

if (document.readyState === "loading") {
    missionLog("SYSTEM", "DOMがロード中なので DOMContentLoaded を待機します");
    document.addEventListener("DOMContentLoaded", () => {
        missionLog("EVENT", "DOMContentLoaded が発火しました");
        addToggles();
    });
} else {
    missionLog("SYSTEM", "DOMが準備できているため即座に実行します");
    addToggles();
}

missionLog("BOOT", "初期設定完了！探索準備よし！✨");
/*
"use strict"

class DarkToggle{
	constructor(){
		this.toggles = new Set()
		this.resets = new Set()
		this.autoLocked = false
		
		var mediaStyles = document.querySelectorAll("link[rel='stylesheet'][media]")
		this.styles = new Set()
		for(var i = 0; i < mediaStyles.length; i++){
			if(mediaStyles[i].media.startsWith("(prefers-color-scheme:")){
				this.styles.add(mediaStyles[i])
			}
		}
		
		this.colorscheme = document.querySelector("meta[name=color-scheme]")
		
		this.media = matchMedia("(prefers-color-scheme: dark)")
		this.media.addEventListener("change", () => {
			this.changeTheme(this.media.matches, true)
		})
		
		var storage = localStorage.vgmPlayerTheme
		if(storage === "dark" || storage === "light"){
			this.autoLocked = true
			this.changeTheme(storage === "dark")
		}else{
			this.changeTheme(this.media.matches)
		}
	}
	addToggle(toggle){
		this.toggles.add(toggle)
		toggle.textContent = this.dark ? "Light theme" : "Dark theme"
		this.linkClick(toggle, this.toggleTheme.bind(this))
	}
	addReset(reset){
		this.resets.add(reset)
		reset.style.display = this.autoLocked ? "inline" : ""
		this.linkClick(reset, this.resetTheme.bind(this))
	}
	linkClick(link, callback){
		link.addEventListener("click", callback)
		link.addEventListener("keypress", event => {
			if(event.key === "Enter"){
				callback()
			}
		})
	}
	changeTheme(dark, auto){
		if(auto && this.autoLocked){
			return
		}
		this.dark = dark
		this.colorscheme.content = this.autoLocked ? (dark ? "dark" : "light") : "light dark"
		this.styles.forEach(style => {
			style.media = this.autoLocked ? (dark ? "all" : "not all") : "(prefers-color-scheme: dark)"
			style.disabled = !dark
		})
		this.toggles.forEach(toggle => {
			toggle.textContent = this.dark ? "Light theme" : "Dark theme"
		})
		this.resets.forEach(reset => {
			reset.style.display = this.autoLocked ? "inline" : ""
		})
	}
	toggleTheme(){
		this.autoLocked = true
		this.changeTheme(!this.dark)
		localStorage.vgmPlayerTheme = this.dark ? "dark" : "light"
	}
	resetTheme(){
		this.autoLocked = false
		this.changeTheme(this.media.matches)
		localStorage.removeItem("vgmPlayerTheme")
	}
}
function addToggles(){
	darkToggle.addToggle(document.getElementById("darktoggle"))
	darkToggle.addReset(document.getElementById("darkreset"))
}
var darkToggle = new DarkToggle()
if(document.readyState === "loading"){
	document.addEventListener("DOMContentLoaded", addToggles)
}else{
	addToggles()
}
*/
