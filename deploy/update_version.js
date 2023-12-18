const path = require('path');
const fs = require('fs');

const ROOT_PATH = `${path.dirname(__filename)}/..`;
const PATCH_VERSION_PATH = `${ROOT_PATH}/.patch-version`;
const PACKAGE_JSON_PATH = `${ROOT_PATH}/package.json`;
const PACKAGE_LOCK_JSON_PATH = `${ROOT_PATH}/package-lock.json`;
const VERSION_TXT_PATH = `${ROOT_PATH}/public/version.txt`;

const ULU_VERSION_PATH = `${ROOT_PATH}/.ulu-version`;

// This patch value is used to override the one from package.json
const currentPatch = fs.existsSync(PATCH_VERSION_PATH) ? Number(fs.readFileSync(PATCH_VERSION_PATH, 'utf-8')) : /* -1 */ 0; // ulu-custom-versioning
const packageJsonContent = fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8');
const packageLockJsonContent = fs.readFileSync(PACKAGE_LOCK_JSON_PATH, 'utf-8');
const currentVersion = JSON.parse(packageJsonContent).version;
const [major, minor] = currentVersion.split('.');

// const newPatch = currentPatch + 1;
// const newVersion = [major, minor, newPatch].join('.');
// ulu-custom-versioning
const newPatch = currentPatch;
const uluVersion = fs.existsSync(ULU_VERSION_PATH) ? Number(fs.readFileSync(ULU_VERSION_PATH, 'utf-8')) : 0;
const newUluVersion = uluVersion + 1;
const newVersion = [major, minor, newPatch].join('.') + '-' + newUluVersion;

const newPackageJsonContent = packageJsonContent.replace(`"version": "${currentVersion}"`, `"version": "${newVersion}"`);
const newPackageLockJsonContent = packageLockJsonContent.replaceAll(`"version": "${currentVersion}"`, `"version": "${newVersion}"`);

console.log(`[update_version] ${currentVersion} -> ${newVersion}\n`);

fs.writeFileSync(PATCH_VERSION_PATH, String(newPatch), 'utf-8');
fs.writeFileSync(PACKAGE_JSON_PATH, newPackageJsonContent, 'utf-8');
fs.writeFileSync(PACKAGE_LOCK_JSON_PATH, newPackageLockJsonContent, 'utf-8');
fs.writeFileSync(VERSION_TXT_PATH, newVersion, 'utf-8');

fs.writeFileSync(ULU_VERSION_PATH, String(newUluVersion), 'utf-8');
