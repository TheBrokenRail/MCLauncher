const request = require('sync-request');
const fs = require('fs');
const rimraf = require('rimraf');
const mkdirp = require('mkdirp');
const {
  spawn
} = require('child_process');

if (fs.existsSync('minecraft')) {
  rimraf.sync('minecraft');
}
fs.mkdirSync('mc');
let versionsRes = request('GET', 'https://launchermeta.mojang.com/mc/game/version_manifest.json');
let versionsJson = JSON.parse(versionsRes.getBody());
let version = 'latest-release';
if (version === 'latest-release') {
  version = versionsJson.latest.release;
}
if (version === 'latest-snapshot') {
  version = versionsJson.latest.snapshot;
}
let url = '';
for (i = 0; i < versionsJson.versions.length; i++) {
  if (version === versionsJson.versions[i].id) {
    url = versionsJson.versions[i].url;
  }
}
let jarRes = request('GET', url);
let versionJson = JSON.parse(jarRes.getBody());
let jar = request('GET', versionJson.downloads.client.url);
fs.writeFileSync('minecraft/client.jar', jar.getBody());
for (let i = 0; i < versionJson.libraries.length; i++) {
  let asset = request('GET', var jar = request('GET', versionJson.downloads.client.url););
  mkdirp.sync('minecraft/' + versionJson.libraries[i].path.split('/').splice(0, versionJson.libraries[i].path.split('/').length - 2).join('/'));
  fs.writeFileSync('minecraft/' + versionJson.libraries[i].path, asset.getBody());
}