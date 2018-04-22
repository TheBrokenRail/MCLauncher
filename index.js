const request = require('sync-request');
const fs = require('fs');
const rimraf = require('rimraf');
const mkdirp = require('mkdirp');
const escape = require('escape-regexp');
const AdmZip = require('adm-zip');
const path = require('path');
const os = require('os');
const {
  exec
} = require('child_process');

if (fs.existsSync('minecraft')) {
  rimraf.sync('minecraft');
}
fs.mkdirSync('minecraft');
let versionsRes = request('GET', 'https://launchermeta.mojang.com/mc/game/version_manifest.json');
let versionsJson = JSON.parse(versionsRes.getBody());
let version = 'latest-snapshot';
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
let classpath = '';
fs.mkdirSync('minecraft/natives');
for (let i = 0; i < versionJson.libraries.length; i++) {
  let allow = true;
  if (versionJson.libraries[i].rules) {
    allow = false;
    for (let x = 0; x < versionJson.libraries[i].rules.length; x++) {
      let valid = false;
      if (versionJson.libraries[i].rules[x].os) {
        let os = '';
        if (os.type() == 'Windows_NT') {
          os = 'windows';
        } else if (os.type() == 'Linux') {
          os = 'linux';
        }
        if (os.type() == 'Darwin') {
          os = 'osx';
        }
        if (os === versionJson.libraries[i].rules[x].os.name) {
          valid = true;
        }
      }
      if (versionJson.libraries[i].rules[x].action === 'allow') {
        allow = true;
      } else if (versionJson.libraries[i].rules[x].action === 'disallow') {
        allow = false;
      }
    }
  }
  if (allow) {
    if (versionJson.libraries[i].downloads.artifact) {
      let asset = request('GET', versionJson.libraries[i].downloads.artifact.url);
      mkdirp.sync('minecraft/' + versionJson.libraries[i].downloads.artifact.path.split('/').splice(0, versionJson.libraries[i].downloads.artifact.path.split('/').length - 1).join('/'));
      fs.writeFileSync('minecraft/' + versionJson.libraries[i].downloads.artifact.path, asset.getBody());
      classpath = classpath + path.resolve(__dirname, 'minecraft/' + versionJson.libraries[i].downloads.artifact.path) + ';';
    }
    if (versionJson.libraries[i].downloads.classifiers && versionJson.libraries[i].downloads.classifiers['natives-windows']) {
      let natives = request('GET', versionJson.libraries[i].downloads.classifiers['natives-windows'].url);
      fs.writeFileSync('temp.jar', natives.getBody());
      let zip = new AdmZip('temp.jar');
      zip.extractAllTo('minecraft/natives', true);
      fs.unlinkSync('temp.jar');
    }
  }
}
classpath = classpath + path.resolve(__dirname, 'minecraft/client.jar') + ';';
let args = '';
for (let i = 0; i < versionJson.arguments.jvm.length; i++) {
  if (typeof(versionJson.arguments.jvm[i]) === 'string') {
    args = args + ' ' + versionJson.arguments.jvm[i];
  } else if (versionJson.arguments.jvm[i].rules) {
    let allow = false;
    for (let x = 0; x < versionJson.arguments.jvm[i].rules.length; x++) {
      let valid = false;
      if (versionJson.arguments.jvm[i].rules[x].os) {
        let os = '';
        if (os.type() == 'Windows_NT') {
          os = 'windows';
        } else if (os.type() == 'Linux') {
          os = 'linux';
        } if (os.type() == 'Darwin') {
          os = 'osx';
        }
        if (os === versionJson.arguments.jvm[i].rules[x].os.name) {
          valid = true;
        }
      }
      if (versionJson.arguments.jvm[i].rules[x].action === 'allow') {
        allow = true;
      } else if (versionJson.arguments.jvm[i].rules[x].action === 'disallow') {
        allow = false;
      }
    }
  }
}
args = args + '-Xmx1G -Dminecraft.client.jar=' + path.resolve(__dirname, 'minecraft/client.jar') + ' ' + versionJson.mainClass;
for (let i = 0; i < versionJson.arguments.game.length; i++) {
  if (typeof(versionJson.arguments.game[i]) === 'string') {
    args = args + ' ' + versionJson.arguments.game[i];
  }
}
let indexRes = request('GET', versionJson.assetIndex.url);
fs.mkdirSync('minecraft/assets');
fs.mkdirSync('minecraft/assets/objects');
fs.mkdirSync('minecraft/assets/indexes');
fs.writeFileSync('minecraft/assets/indexes/' + versionJson.assetIndex.id + '.json', indexRes.getBody());
let index = JSON.parse(indexRes.getBody());
for (let x in index.objects) {
  if (!fs.existsSync('minecraft/assets/objects/' + index.objects[x].hash.slice(0, 2))) {
    fs.mkdirSync('minecraft/assets/objects/' + index.objects[x].hash.slice(0, 2));
  }
  let asset = request('GET', 'http://resources.download.minecraft.net/' + index.objects[x].hash.slice(0, 2) + '/' + index.objects[x].hash);
  fs.writeFileSync('minecraft/assets/objects/' + index.objects[x].hash.slice(0, 2) + '/' + index.objects[x].hash, asset.getBody());
}
fs.mkdirSync('minecraft/game');
let username = 'Test';
let gameDir = __dirname + '/minecraft/game';
let assets = __dirname + '/minecraft/assets';
let assetsIndex = versionJson.assetIndex.id;
let uuid = '0';
let authToken = '0';
let userType = 'mojang';
let versionType = 'snapshot';
let natives = __dirname + '/minecraft/natives';
let launcherName = 'MCLauncher';
let launcherVersion = '10';
args = args.replace(new RegExp(escape('${auth_player_name}'), 'g'), username);
args = args.replace(new RegExp(escape('${version_name}'), 'g'), version);
args = args.replace(new RegExp(escape('${game_directory}'), 'g'), gameDir);
args = args.replace(new RegExp(escape('${assets_root}'), 'g'), assets);
args = args.replace(new RegExp(escape('${assets_index_name}'), 'g'), assetsIndex);
args = args.replace(new RegExp(escape('${auth_uuid}'), 'g'), uuid);
args = args.replace(new RegExp(escape('${auth_access_token}'), 'g'), authToken);
args = args.replace(new RegExp(escape('${user_type}'), 'g'), userType);
args = args.replace(new RegExp(escape('${version_type}'), 'g'), versionType);
args = args.replace(new RegExp(escape('${natives_directory}'), 'g'), natives);
args = args.replace(new RegExp(escape('${launcher_name}'), 'g'), launcherName);
args = args.replace(new RegExp(escape('${launcher_version}'), 'g'), launcherVersion);
args = args.replace(new RegExp(escape('${classpath}'), 'g'), classpath);
console.log('ARGS: javaw' + args);
exec('javaw' + args, {}, function (e, stdout, stderr) {
  console.log('STDOUT\n' + stdout);
  console.log('STDERR\n' + stderr);
});