const request = require('request-promise-native');
const fs = require('fs');
const rimraf = require('rimraf');
const mkdirp = require('mkdirp');
const escape = require('escape-regexp');
const AdmZip = require('adm-zip');
const path = require('path');
const os = require('os');
const uid = require('uid');
const {
  exec
} = require('child_process');

module.exports = async (options, callback) => {
  let instanceId = uid();
  let versionsJson = JSON.parse(await request('https://launchermeta.mojang.com/mc/game/version_manifest.json'));
  let versionRaw = options.version;
  let classpath = '';
  let custom = false;
  const getVersionJson = async version => {
    let versionJson = null;
    if (version.startsWith('custom?')) {
      if (fs.existsSync('data/versions/' + version.split('custom?').slice(1).join('custom?') + '.json')) {
        versionJson = JSON.parse(fs.readFileSync('data/versions/' + version.split('custom?').slice(1).join('custom?') + '.json', 'utf8'));
        custom = true;
      } else {
        version = 'latest-release';
      }
    }
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
    if (!versionJson) {
      versionJson = JSON.parse(await request(url));
    }
    if (versionJson.hasOwnProperty('inheritsFrom')) {
      versionJson.libraries = versionJson.libraries.concat(await getVersionJson(versionJson.inheritsFrom));
    }
    return versionJson;
  };
  let versionJson = await getVersionJson(versionRaw);
  fs.writeFileSync('data/' + instanceId + '.jar', await request(versionJson.downloads.client.url, {encoding: null}));
  if (!fs.existsSync('data/natives')) {
    fs.mkdirSync('data/natives');
  }
  if (fs.existsSync('data/natives/' + instanceId)) {
    rimraf.sync('data/natives/' + instanceId);
  }
  fs.mkdirSync('data/natives/' + instanceId);
  if (!fs.existsSync('data')) {
    fs.mkdirSync('data');
  }
  if (!fs.existsSync('data/lib')) {
    fs.mkdirSync('data/lib');
  }
  let setDemo = false;
  function checkRules(rules) {
    let allow = false;
    let disallowed = false;
    for (let x = 0; x < rules.length; x++) {
      let valid = true;
      if (rules[x].os) {
        let osStr = '';
        if (os.type() === 'Windows_NT') {
          osStr = 'windows';
        } else if (os.type() === 'Linux') {
          osStr = 'linux';
        }
        if (os.type() === 'Darwin') {
          osStr = 'osx';
        }
        if (osStr === rules[x].os.name) {
          valid = true;
        } else {
          valid = false;
        }
      }
      if (rules[x].features) {
        for (let y in rules[x].features) {
          if (y === 'is_demo_user') {
            valid = options.demo;
            setDemo = true;
          } else if (y === 'has_custom_resolution') {
            valid = false;
          } else {
            valid = false;
          }
        }
      }
      if (rules[x].action === 'allow' && valid && !disallowed) {
        allow = true;
      } else if (rules[x].action === 'disallow' && valid) {
        allow = false;
        disallowed = true;
      } else if (rules[x].action === 'allow' && !valid && !disallowed) {
        allow = false;
        disallowed = true;
      } else if (rules[x].action === 'disallow' && !valid && !disallowed) {
        allow = true;
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
      options.log('Downloading Library ' + versionJson.libraries[i].name + ': ');
      if (versionJson.libraries[i].downloads && versionJson.libraries[i].downloads.artifact) {
        if (!fs.existsSync('data/lib/' + versionJson.libraries[i].downloads.artifact.path)) {
          mkdirp.sync('data/lib/' + versionJson.libraries[i].downloads.artifact.path.split('/').splice(0, versionJson.libraries[i].downloads.artifact.path.split('/').length - 1).join('/'));
          fs.writeFileSync('data/lib/' + versionJson.libraries[i].downloads.artifact.path, await request(versionJson.libraries[i].downloads.artifact.url, {encoding: null}));
          options.log('Done\n');
        } else {
          options.log('Skipped\n');
        }
        classpath = classpath + path.resolve(__dirname, 'data/lib/' + versionJson.libraries[i].downloads.artifact.path) + ';';
      } else {
        let pathRaw = versionJson.libraries[i].name.split(':');
        let url = 'https://libraries.minecraft.net/';
        if (versionJson.libraries[i].url) {
          url = versionJson.libraries[i].url;
        }
        let path = pathRaw[0].replace(new RegExp('.', 'g'), '/') + '/' + pathRaw[1] + '/' + pathRaw[2] + '/' + pathRaw[1] + '-' + pathRaw[2] + '.jar';
        if (!fs.existsSync('data/lib/' + path)) {
          mkdirp.sync('data/lib/' + path.split('/').splice(0, path.split('/').length - 1).join('/'));
          fs.writeFileSync('data/lib/' + path, await request(url + path, {encoding: null}));
          options.log('Done\n');
        } else {
          options.log('Skipped\n');
        }
        classpath = classpath + path.resolve(__dirname, 'data/lib/' + path) + ';';
      }
      if (versionJson.libraries[i].downloads && versionJson.libraries[i].downloads.classifiers && versionJson.libraries[i].downloads.classifiers['natives-windows']) {
        options.log('Downloading Library ' + versionJson.libraries[i].name + ' Natives For Windows: ');
        let asset = await request(versionJson.libraries[i].downloads.classifiers['natives-windows'].url, {encoding: null});
        fs.writeFileSync('temp.jar', asset);
        let zip = new AdmZip('temp.jar');
        zip.extractAllTo('data/natives/' + instanceId, true);
        fs.unlinkSync('temp.jar');
        options.log('Done\n');
      }
      if (versionJson.libraries[i].downloads && versionJson.libraries[i].downloads.classifiers && versionJson.libraries[i].downloads.classifiers['natives-linux']) {
        options.log('Downloading Library ' + versionJson.libraries[i].name + ' Natives For Linux: ');
        let asset = await request(versionJson.libraries[i].downloads.classifiers['natives-linux'].url, {encoding: null});
        fs.writeFileSync('temp.jar', asset);
        let zip = new AdmZip('temp.jar');
        zip.extractAllTo('data/natives/' + instanceId, true);
        fs.unlinkSync('temp.jar');
        options.log('Done\n');
      }
      if (versionJson.libraries[i].downloads && versionJson.libraries[i].downloads.classifiers && versionJson.libraries[i].downloads.classifiers['natives-osx']) {
        options.log('Downloading Library ' + versionJson.libraries[i].name + ' Natives For Mac: ');
        let asset = await request(versionJson.libraries[i].downloads.classifiers['natives-osx'].url, {encoding: null});
        fs.writeFileSync('temp.jar', asset);
        let zip = new AdmZip('temp.jar');
        zip.extractAllTo('data/natives/' + instanceId, true);
        fs.unlinkSync('temp.jar');
        options.log('Done\n');
      }
      if (versionJson.libraries[i].downloads && versionJson.libraries[i].downloads.classifiers && versionJson.libraries[i].downloads.classifiers['natives-macos']) {
        options.log('Downloading Library ' + versionJson.libraries[i].name + ' Natives For Mac: ');
        let asset = await request(versionJson.libraries[i].downloads.classifiers['natives-macos'].url, {encoding: null});
        fs.writeFileSync('temp.jar', asset);
        let zip = new AdmZip('temp.jar');
        zip.extractAllTo('data/natives/' + instanceId, true);
        fs.unlinkSync('temp.jar');
        options.log('Done\n');
      }
    }
  }
  if (fs.existsSync('minecraft/natives/META-INF')) {
    rimraf.sync('minecraft/natives/META-INF');
  }
  classpath = classpath + path.resolve(__dirname, 'data/' + instanceId + '.jar') + ';';
  if (custom && fs.existsSync('data/versions/' + version.split('custom?').slice(1).join('custom?') + '-classpath') && fs.readdirSync('data/versions/' + version.split('custom?').slice(1).join('custom?') + '-classpath').length > 0) {
    let files = fs.readdirSync('data/versions/' + version.split('custom?').slice(1).join('custom?') + '-classpath');
    for (let i = 0; i < files.length; i++) {
      classpath = classpath + path.resolve(__dirname, 'data/versions/' + version.split('custom?').slice(1).join('custom?') + '-classpath/' + files[i]) + ';';
    }
  }
  let args = '';
  let jvmArgs = [];
  if (versionJson.arguments && versionJson.arguments.jvm) {
    jvmArgs = versionJson.arguments.jvm;
  } else {
    jvmArgs = ['-Djava.library.path=${natives_directory}',
      '-Dminecraft.launcher.brand=${launcher_name}',
      '-Dminecraft.launcher.version=${launcher_version}',
      (os.type() === 'Windows_NT' ? '-XX:HeapDumpPath=MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump' : null),
      '-cp',
      '${classpath}'];
  }
  for (let i = 0; i < jvmArgs.length; i++) {
    if (typeof(jvmArgs[i]) === 'string') {
      args = args + ' ' + jvmArgs[i];
    } else if (jvmArgs[i] !== null && jvmArgs[i].rules) {
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
  args = args + ' -Xmx' + options.ram + 'G -Dminecraft.client.jar=' + path.resolve(__dirname, 'data/' + instanceId + '.jar') + ' ' + versionJson.mainClass;
  let gameArgs = [];
  if (versionJson.arguments && versionJson.arguments.game) {
    gameArgs = versionJson.arguments.game;
  } else {
    gameArgs = [versionJson.minecraftArguments, (options.demo && !setDemo ? '--demo' : null)];
  }
  for (let i = 0; i < gameArgs.length; i++) {
    if (typeof(gameArgs[i]) === 'string') {
      args = args + ' ' + gameArgs[i];
    } else if (gameArgs[i] !== null && gameArgs[i].rules) {
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
    fs.writeFileSync('data/assets/indexes/' + versionJson.assetIndex.id + '.json', await request(versionJson.assetIndex.url));
  }
  let index = JSON.parse(await request(versionJson.assetIndex.url));
  for (let x in index.objects) {
    if (!fs.existsSync('data/assets/objects/' + index.objects[x].hash.slice(0, 2))) {
      fs.mkdirSync('data/assets/objects/' + index.objects[x].hash.slice(0, 2));
    }
    options.log('Downloading Asset ' + x + ': ');
    if ((versionJson.assetIndex.id !== 'legacy' && fs.existsSync('data/assets/objects/' + index.objects[x].hash.slice(0, 2) + '/' + index.objects[x].hash)) || (versionJson.assetIndex.id === 'legacy' && fs.existsSync('data/assets/virtual/' + x))) {
      options.log('Skipped\n');
    }
    if (versionJson.assetIndex.id !== 'legacy' && !fs.existsSync('data/assets/objects/' + index.objects[x].hash.slice(0, 2) + '/' + index.objects[x].hash)) {
      let asset = await request('http://resources.download.minecraft.net/' + index.objects[x].hash.slice(0, 2) + '/' + index.objects[x].hash, {encoding: null});
      fs.writeFileSync('data/assets/objects/' + index.objects[x].hash.slice(0, 2) + '/' + index.objects[x].hash, asset);
      options.log('Done\n');
    } else if (versionJson.assetIndex.id === 'legacy' && !fs.existsSync('data/assets/virtual/' + x)) {
      let asset = await request('http://resources.download.minecraft.net/' + index.objects[x].hash.slice(0, 2) + '/' + index.objects[x].hash, {encoding: null});
      mkdirp.sync('data/assets/virtual/' + x.split('/').splice(0, x.split('/').length - 1).join('/'));
      fs.writeFileSync('data/assets/virtual/' + x, asset);
      options.log('Done\n');
    }
  }
  if (!fs.existsSync('data/profiles')) {
    fs.mkdirSync('data/profiles');
  }
  if (!fs.existsSync('data/profiles/' + options.profile)) {
    fs.mkdirSync('data/profiles/' + options.profile);
  }
  let username = options.username;
  let gameDir = __dirname + '/data/profiles/' + options.profile;
  let assets = __dirname + '/data/assets';
  let virtualAssets = __dirname + '/data/assets/virtual';
  let assetsIndex = versionJson.assetIndex.id;
  let uuid = options.uuid;
  let authToken = options.authToken;
  let userType = 'mojang';
  let versionType = versionJson.type;
  let natives = __dirname + '/data/natives/' + instanceId;
  let launcherName = 'MCLauncher';
  let launcherVersion = '10';
  args = args.replace(new RegExp(escape('${auth_player_name}'), 'g'), username);
  args = args.replace(new RegExp(escape('${version_name}'), 'g'), version);
  args = args.replace(new RegExp(escape('${game_directory}'), 'g'), '"' + gameDir + '"');
  args = args.replace(new RegExp(escape('${assets_root}'), 'g'), assets);
  args = args.replace(new RegExp(escape('${game_assets}'), 'g'), virtualAssets);
  args = args.replace(new RegExp(escape('${assets_index_name}'), 'g'), assetsIndex);
  args = args.replace(new RegExp(escape('${auth_uuid}'), 'g'), uuid);
  args = args.replace(new RegExp(escape('${auth_access_token}'), 'g'), authToken);
  args = args.replace(new RegExp(escape('${auth_session}'), 'g'), authToken);
  args = args.replace(new RegExp(escape('${user_type}'), 'g'), userType);
  args = args.replace(new RegExp(escape('${version_type}'), 'g'), versionType);
  args = args.replace(new RegExp(escape('${natives_directory}'), 'g'), natives);
  args = args.replace(new RegExp(escape('${launcher_name}'), 'g'), launcherName);
  args = args.replace(new RegExp(escape('${launcher_version}'), 'g'), launcherVersion);
  args = args.replace(new RegExp(escape('${classpath}'), 'g'), classpath);
  args = args.replace(new RegExp(escape('${user_properties}'), 'g'), '{}');
  options.log('ARGS: javaw' + args + '\n');
  let minecraft = exec('javaw' +  args, {stdio: 'pipe'});
  minecraft.stdout.on('data', chunk => options.log(chunk.toString()));
  minecraft.stderr.on('data', chunk => options.log(chunk.toString()));
  minecraft.on('close', () => {
    rimraf.sync('data/natives/' + instanceId);
    fs.unlinkSync('data/' + instanceId + '.jar');
  });
  callback(minecraft);
};
