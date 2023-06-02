const path = require('path');
const fs = require('fs');

const ROOT_PATH = `${path.dirname(__filename)}/..`;
const PATCH_VERSION_PATH = `${ROOT_PATH}/.patch-version`;
const PACKAGE_JSON_PATH = `${ROOT_PATH}/package.json`;
const VERSION_TXT_PATH = `${ROOT_PATH}/public/version.txt`;

// This patch value is used to override the one from package.json
const currentPatch = fs.existsSync(PATCH_VERSION_PATH) ? Number(fs.readFileSync(PATCH_VERSION_PATH, 'utf-8')) : -1;
const packageJsonContent = fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8');
const currentVersion = JSON.parse(packageJsonContent).version;
const [major, minor] = currentVersion.split('.');

const newPatch = currentPatch + 1;
const newVersion = [major, minor, newPatch].join('.');
const newPackageJsonContent = packageJsonContent.replace(`"version": "${currentVersion}"`, `"version": "${newVersion}"`);

fs.writeFileSync(PATCH_VERSION_PATH, String(newPatch), 'utf-8');
fs.writeFileSync(PACKAGE_JSON_PATH, newPackageJsonContent, 'utf-8');
fs.writeFileSync(VERSION_TXT_PATH, newVersion, 'utf-8');
