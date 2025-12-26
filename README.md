## vgmstream-web
 [vgmstream](https://vgmstream.org/) がもたらすウェブブラウザへ。vgmstream-webは、さまざまなエキゾチックなオーディオフォーマットでシームレスにループする音楽再生をサポートするビデオゲームオーディオプレーヤーです。WebAssemblyを搭載し、デスクトップ、モバイルデバイス、ビデオゲームコンソールなど、Webブラウザを備えたあらゆるプラットフォームをサポートしています。

https://katiefrogs.github.io/vgmstream-web/

## URL引数
Vgmstream-web への引数は、数字記号 (`#`) の後に、アンパサンド (`&`) で区切られた `name=value` 文字列を追加することで渡すことができます。

### 支持された議論
- `play`: ストリームをロードして再生するURL。
- `sub`: 再生に必要な追加ファイル。
- `base`: 次のURLの接頭辞が付くベース文字列。
- `dir`: 前のファイルの名前を変更します。

議論は繰り返すことができます。値はURLでエンコードできます。

### URLの例
`https://katiefrogs.github.io/vgmstream-web/#base=https://example.com/&play=file.txtp&sub=file.wem&dir=wem/file.wem`

これにより、ファイル `https://example.com/file.txtp` と `https://example.com/file.wem` が読み込まれ、2 番目のファイルの名前を `wem/file.wem` に変更され、最初のファイルが再生されます。

## Vgmstream-cli.js/.wasmのコンパイル
これらの手順はUbuntu 21.04でテストされていますが、他のLinuxディストリビューションでも機能するはずです。
```sh
# パッケージをインストールする
sudo apt install git cmake make

# Emscripts SDKを入手する
git clone https://github.com/emscripten-core/emsdk
cd emsdk

# Emscripten SDKをインストールする
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh
cd ..

# Vgmstreamを入手する
git clone https://github.com/vgmstream/vgmstream
cd vgmstream

# Vgmstreamをコンパイルする
mkdir -p embuild
cd embuild
emcmake cmake .. -DCMAKE_BUILD_TYPE=Release
make
```
最後の `make` コマンドの代わりに `make -j 5` を使用すると、より速くコンパイルできます (`5` を CPU のコア数に 1 を加えたものに置き換えてください)。しかし、複数のジョブでは、問題が発生した場合に出力が役に立たなくなることに注意してください。

出力ファイル `vgmstream-cli.wasm` と `vgmstream-cli.js` は `vgmstream/embuild/cli` ディレクトリにあります。

`source ./emsdk_env.sh` 行は、ターミナルが閉じられたときにリセットされる PATH に Emscripten ツールを一時的に追加します。Emsdkを頻繁に使用する場合は、次の行を`~/.bashrc`に追加してください。
```sh
source "/path/to/emsdk/emsdk_env.sh" > /dev/null 2>&1; export PATH;
```

[Vgmstreamのビルドガイド](https://github.com/vgmstream/vgmstream/blob/master/doc/BUILD.md).も参照しろ！
