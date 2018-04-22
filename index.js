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
let version = '1.6.4';
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
if (!fs.existsSync('data')) {
  fs.mkdirSync('data');
}
if (!fs.existsSync('data/lib')) {
  fs.mkdirSync('data/lib');
}
function checkRules(rules) {
  let allow = false;
  let disallowed = false;
  for (let x = 0; x < rules.length; x++) {
    let valid = true;
    if (rules[x].os) {
      let osStr = '';
      if (os.type() == 'Windows_NT') {
        osStr = 'windows';
      } else if (os.type() == 'Linux') {
        osStr = 'linux';
      }
      if (os.type() == 'Darwin') {
        osStr = 'osx';
      }
      if (osStr === rules[x].os.name) {
        valid = true;
      }
    }
    if (rules[x].action === 'allow' && valid && !disallowed) {
      allow = true;
    } else if (rules[x].action === 'disallow' && valid) {
      allow = false;
      disallowed = true;
    }
  }
  return allow;
}
for (let i = 0; i < versionJson.libraries.length; i++) {
  let allow = true;
  if (versionJson.libraries[i].rules) {
    allow = checkRules(versionJson.libraries[i].rules);
  }
  if (allow) {
    console.log('Downloading Library ' + versionJson.libraries[i].name);
    if (versionJson.libraries[i].downloads.artifact) {
      if (!fs.existsSync('data/lib/' + versionJson.libraries[i].downloads.artifact.path)) {
        let asset = request('GET', versionJson.libraries[i].downloads.artifact.url);
        mkdirp.sync('data/lib/' + versionJson.libraries[i].downloads.artifact.path.split('/').splice(0, versionJson.libraries[i].downloads.artifact.path.split('/').length - 1).join('/'));
        fs.writeFileSync('data/lib/' + versionJson.libraries[i].downloads.artifact.path, asset.getBody());
      }
      classpath = classpath + path.resolve(__dirname, 'data/lib/' + versionJson.libraries[i].downloads.artifact.path) + ';';
    }
    if (versionJson.libraries[i].downloads.classifiers && versionJson.libraries[i].downloads.classifiers['natives-windows']) {
      let natives = request('GET', versionJson.libraries[i].downloads.classifiers['natives-windows'].url);
      fs.writeFileSync('temp.jar', natives.getBody());
      let zip = new AdmZip('temp.jar');
      zip.extractAllTo('minecraft/natives', true);
      fs.unlinkSync('temp.jar');
    }
    if (versionJson.libraries[i].downloads.classifiers && versionJson.libraries[i].downloads.classifiers['natives-linux']) {
      let natives = request('GET', versionJson.libraries[i].downloads.classifiers['natives-linux'].url);
      fs.writeFileSync('temp.jar', natives.getBody());
      let zip = new AdmZip('temp.jar');
      zip.extractAllTo('minecraft/natives', true);
      fs.unlinkSync('temp.jar');
    }
    if (versionJson.libraries[i].downloads.classifiers && versionJson.libraries[i].downloads.classifiers['natives-osx']) {
      let natives = request('GET', versionJson.libraries[i].downloads.classifiers['natives-osx'].url);
      fs.writeFileSync('temp.jar', natives.getBody());
      let zip = new AdmZip('temp.jar');
      zip.extractAllTo('minecraft/natives', true);
      fs.unlinkSync('temp.jar');
    }
  }
}
if (fs.existsSync('minecraft/natives/META-INF')) {
  rimraf.sync('minecraft/natives/META-INF');
}
classpath = classpath + path.resolve(__dirname, 'minecraft/client.jar') + ';';
let args = '';
let jvmArgs = [];
if (versionJson.arguments && versionJson.arguments.jvm) {
  jvmArgs = versionJson.arguments.jvm;
} else {
  jvmArgs = ['-Djava.library.path=${natives_directory}',
    '-Dminecraft.launcher.brand=${launcher_name}',
    '-Dminecraft.launcher.version=${launcher_version}',
    '-cp',
    '${classpath}'];
}
for (let i = 0; i < jvmArgs.length; i++) {
  if (typeof(jvmArgs[i]) === 'string') {
    args = args + ' ' + jvmArgs[i];
  } else if (jvmArgs[i].rules) {
    let allow = checkRules(jvmArgs[i].rules);
    if (allow) {
      let newArg = jvmArgs[i].value;
      if (Array.isArray(newArg)) {
        for (let y = 0; y < newArg.length; y++) {
          if (newArg[y].split(' ').length > 1) {
            newArg[y] = '"' + newArg[y] + '"';
          }
        }
        newArg = newArg.join(' ');
      }
      args = args + ' ' + newArg;
    }
  }
}
args = args + '-Xmx1G -Dminecraft.client.jar=' + path.resolve(__dirname, 'minecraft/client.jar') + ' ' + versionJson.mainClass;
let gameArgs = [];
if (versionJson.arguments && versionJson.arguments.game) {
  gameArgs = versionJson.arguments.game;
} else {
  gameArgs = [versionJson.minecraftArguments];
}
for (let i = 0; i < gameArgs.length; i++) {
  if (typeof(gameArgs[i]) === 'string') {
    args = args + ' ' + gameArgs[i];
  } else if (gameArgs[i].rules) {
    let allow = checkRules(gameArgs[i].rules);
    if (allow) {
      let newArg = gameArgs[i].value;
      if (Array.isArray(newArg)) {
        for (let y = 0; y < newArg.length; y++) {
          if (newArg[y].split(' ').length > 1) {
            newArg[y] = '"' + newArg[y] + '"';
          }
        }
        newArg = newArg.join(' ');
      }
      args = args + ' ' + newArg;
    }
  }
}
let indexRes = request('GET', versionJson.assetIndex.url);
if (!fs.existsSync('data/assets')) {
  fs.mkdirSync('data/assets');
}
if (!fs.existsSync('data/assets/objects')) {
  fs.mkdirSync('data/assets/objects');
}
if (!fs.existsSync('data/assets/indexes')) {
  fs.mkdirSync('data/assets/indexes');
}
if (!fs.existsSync('data/assets/virtual')) {
  fs.mkdirSync('data/assets/virtual');
}
if (!fs.existsSync('data/assets/virtual/' + versionJson.assetIndex.id)) {
  fs.mkdirSync('data/assets/virtual/' + versionJson.assetIndex.id);
}
if (!fs.existsSync('data/assets/indexes/' + versionJson.assetIndex.id + '.json')) {
  fs.writeFileSync('data/assets/indexes/' + versionJson.assetIndex.id + '.json', indexRes.getBody());
}
let index = JSON.parse(indexRes.getBody());
for (let x in index.objects) {
  if (!fs.existsSync('data/assets/objects/' + index.objects[x].hash.slice(0, 2))) {
    fs.mkdirSync('data/assets/objects/' + index.objects[x].hash.slice(0, 2));
  }
  console.log('Downloading Asset ' + x);
  let asset = null;
  if (!fs.existsSync('data/assets/objects/' + index.objects[x].hash.slice(0, 2) + '/' + index.objects[x].hash)) {
    asset = request('GET', 'http://resources.download.minecraft.net/' + index.objects[x].hash.slice(0, 2) + '/' + index.objects[x].hash);
    fs.writeFileSync('data/assets/objects/' + index.objects[x].hash.slice(0, 2) + '/' + index.objects[x].hash, asset.getBody());
  }
  if (!fs.existsSync('data/assets/virtual/' + versionJson.assetIndex.id + '/' + x)) {
    if (!asset) {
      asset = request('GET', 'http://resources.download.minecraft.net/' + index.objects[x].hash.slice(0, 2) + '/' + index.objects[x].hash);
    }
    mkdirp.sync('data/assets/virtual/' + versionJson.assetIndex.id + '/' + x.split('/').splice(0, x.split('/').length - 1).join('/'));
    fs.writeFileSync('data/assets/virtual/' + versionJson.assetIndex.id + '/' + x, asset.getBody());
  }
}
if (!fs.existsSync('data/game')) {
  fs.mkdirSync('data/game');
}
let username = 'Test';
let gameDir = __dirname + '/data/game';
let assets = __dirname + '/data/assets';
let virtualAssets = __dirname + '/data/assets/virtual/' + versionJson.assetIndex.id + '/';
let assetsIndex = versionJson.assetIndex.id;
let uuid = '0';
let authToken = '0';
let userType = 'mojang';
let versionType = versionJson.type;
let natives = __dirname + '/minecraft/natives';
let launcherName = 'MCLauncher';
let launcherVersion = '10';
args = args.replace(new RegExp(escape('${auth_player_name}'), 'g'), username);
args = args.replace(new RegExp(escape('${version_name}'), 'g'), version);
args = args.replace(new RegExp(escape('${game_directory}'), 'g'), gameDir);
args = args.replace(new RegExp(escape('${assets_root}'), 'g'), assets);
args = args.replace(new RegExp(escape('${game_assets}'), 'g'), virtualAssets);
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