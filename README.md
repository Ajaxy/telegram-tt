# ulu — productivity-first telegram client

ulu is aimed at improving the communication workflow for developers, designers, founders and PMs.

ulu brings productivity boosts:
- no stories
- inbox
- redesigned folders
- hotkeys
- CMD+K menu
- CMD+E mark chat as done
- auto-archiver
- snooze - notify about message later
- workspaces (soon)
- ... (a lot of features in development, will be announced soon)

## [ulu Developers Area] How to...
### Get updates from [upstream](https://github.com/Ajaxy/telegram-tt/network)
```sh
git remote add upstream git@github.com:Ajaxy/telegram-tt.git
git fetch upstream
git checkout master
git merge upstream/master
git commit -m "Upstream"
git push
```

### Deploy: increment version, rebuild binaries, release
```sh
npm run deploy
```

- Updates https://ulu.so
- Updates [releases](https://github.com/ulu-telegram/app/releases)
- Updates the latest binaries:
  - Mac ARM: https://github.com/ulu-telegram/app/releases/latest/download/ulu-arm64.dmg
  - Mac x64: https://github.com/ulu-telegram/app/releases/latest/download/ulu-x64.dmg
  - Linux: https://github.com/ulu-telegram/app/releases/latest/download/ulu-x86_64.AppImage
  - Windows: https://github.com/ulu-telegram/app/releases/latest/download/ulu-x64.exe

### Manual deploy: no version increment, no binaries rebuild, no release
```sh
git checkout deploy
git reset --hard master
git push --force
```

- Updates https://ulu.so

## ulu is the foͦrͬᴋⷦ of the official Telegram Web A
Great respect to the creators of the original project!

**The original readme begins below...**

---

## Telegram Web A

This project won the first prize 🥇 at [Telegram Lightweight Client Contest](https://contest.com/javascript-web-3) and now is an official Telegram client available to anyone at [web.telegram.org/a](https://web.telegram.org/a).

According to the original contest rules, it has nearly zero dependencies and is fully based on its own [Teact](https://github.com/Ajaxy/teact) framework (which re-implements React paradigm). It also uses a custom version of [GramJS](https://github.com/gram-js/gramjs) as an MTProto implementation.

The project incorporates lots of technologically advanced features, modern Web APIs and techniques: WebSockets, Web Workers and WebAssembly, multi-level caching and PWA, voice recording and media streaming, cryptography and raw binary data operations, optimistic and progressive interfaces, complicated CSS/Canvas/SVG animations, reactive data streams, and so much more.

Feel free to explore, provide feedback and contribute.

## Local setup

```sh
mv .env.example .env

npm i
```

Obtain API ID and API hash on [my.telegram.org](https://my.telegram.org) and populate the `.env` file.

## Dev mode

```sh
npm run dev
```

### Invoking API from console

Start your dev server and locate GramJS worker in console context.

All constructors and functions available in global `GramJs` variable.

Run `npm run gramjs:tl full` to get access to all available Telegram requests.

Example usage:
``` javascript
await invoke(new GramJs.help.GetAppConfig())
```

## Electron

Electron allows building a native application that can be installed on Windows, macOS, and Linux.

#### NPM scripts

- `npm run dev:electron`

Run Electron in development mode, concurrently starts 3 processes with watch for changes: main (main Electron process), renderer (FE code) and Webpack for Electron (compiles main Electron process from TypeScript).

- `npm run electron:webpack`

The main process code for Electron, which includes preload functionality, is written in TypeScript and is compiled using the `webpack-electron.config.js` configuration to generate JavaScript code.

- `npm run electron:build`

Prepare renderer (FE code) build, compile Electron main process code, install and build native dependencies, is used before packaging or publishing.

- `npm run electron:staging`

Create packages for macOS, Windows and Linux in `dist-electron` folders with `APP_ENV` as `staging` (allows to open DevTools, includes sourcemaps and does not minify built JavaScript code), can be used for manual distribution and testing packaged application.

- `npm run electron:production`

Create packages for macOS, Windows and Linux in `dist-electron` folders with `APP_ENV` as `production` (disabled DevTools, minified built JavaScript code), can be used for manual distribution and testing packaged application.

- `npm run deploy:electron`

Create packages for macOS, Windows and Linux in `dist-electron` folder and publish release to GitHub, which allows supporting autoupdates. See [GitHub release workflow](#github-release) for more info.

#### Code signing on MacOS

To sign the code of your application, follow these steps:

- Install certificates from `/certs` folder to `login` folder of your Keychain.
- Download and install `Developer ID - G2` certificate from the [Apple PKI](https://www.apple.com/certificateauthority/) page.
- Under the Keychain application, go to the private key associated with your developer certificate. Then do `key > Get Info > Access Control`. Down there, make sure your application (Xcode) is in the list `Always allow access by these applications` and make sure `Confirm before allowing access` is turned on.
- A valid and appropriate identity from your keychain will be automatically used when you publish your application.

More info in the [official documentation](https://www.electronjs.org/docs/latest/tutorial/code-signing).

#### Notarize on MacOS

Application notarization is done automatically in [electron-builder](https://github.com/electron-userland/electron-builder/) module, which requires `APPLE_ID` and `APPLE_APP_SPECIFIC_PASSWORD` environment variables to be passed.

How to obtain app-specific password:

- Sign in to [appleid.apple.com](appleid.apple.com).
- In the "Sign-In and Security" section, select "App-Specific Passwords".
- Select "Generate an app-specific password" or select the Add button, then follow the steps on your screen.

#### GitHub release

##### GitHub access token

In order to publish new release, you need to add GitHub access token to `.env`. Generate a GitHub access token by going to https://github.com/settings/tokens/new. The access token should have the repo scope/permission. Once you have the token, assign it to an environment variable:

```
# .env
GH_TOKEN="{YOUR_TOKEN_HERE}"
```

##### Publish settings

Publish configuration in `src/electron/config.yml` config file allows to set GitHub repository owner/name.

##### Release workflow

- Run `npm run electron:publish`, which will create new draft release and upload build artefacts to newly reated release. Version of created release will be the same as in `package.json`.
- Once you are done, publish the release. GitHub will tag the latest commit.

### Dependencies
* [GramJS](https://github.com/gram-js/gramjs) ([MIT License](https://github.com/gram-js/gramjs/blob/master/LICENSE))
* [pako](https://github.com/nodeca/pako) ([MIT License](https://github.com/nodeca/pako/blob/master/LICENSE))
* [cryptography](https://github.com/spalt08/cryptography) ([Apache License 2.0](https://github.com/spalt08/cryptography/blob/master/LICENSE))
* [emoji-data](https://github.com/iamcal/emoji-data) ([MIT License](https://github.com/iamcal/emoji-data/blob/master/LICENSE))
* [twemoji-parser](https://github.com/twitter/twemoji-parser) ([MIT License](https://github.com/twitter/twemoji-parser/blob/master/LICENSE.md))
* [rlottie](https://github.com/Samsung/rlottie) ([MIT License](https://github.com/Samsung/rlottie/blob/master/COPYING))
* [opus-recorder](https://github.com/chris-rudmin/opus-recorder) ([Various Licenses](https://github.com/chris-rudmin/opus-recorder/blob/master/LICENSE.md))
* [qr-code-styling](https://github.com/kozakdenys/qr-code-styling) ([MIT License](https://github.com/kozakdenys/qr-code-styling/blob/master/LICENSE))
* [croppie](https://github.com/Foliotek/Croppie) ([MIT License](https://github.com/Foliotek/Croppie/blob/master/LICENSE))
* [mp4box](https://github.com/gpac/mp4box.js) ([BSD-3-Clause license](https://github.com/gpac/mp4box.js/blob/master/LICENSE))
* [music-metadata-browser](https://github.com/Borewit/music-metadata-browser) ([MIT License](https://github.com/Borewit/music-metadata-browser/blob/master/LICENSE.txt))
* [lowlight](https://github.com/wooorm/lowlight) ([MIT License](https://github.com/wooorm/lowlight/blob/main/license))
* [idb-keyval](https://github.com/jakearchibald/idb-keyval) ([Apache License 2.0](https://github.com/jakearchibald/idb-keyval/blob/main/LICENCE))
* [fasttextweb](https://github.com/karmdesai/fastTextWeb)
* webp-wasm
* fastblur

## Bug reports and Suggestions
If you find an issue with this app, let Telegram know using the [Suggestions Platform](https://bugs.telegram.org/c/4002).
