const mclauncher = require('./launcher');
const args = require('args');
const request = require('sync-request');

args.option('version', 'Minecraft Version', 'latest-release')
  .option('email', 'Minecraft Email')
  .option('password', 'Minecraft Password')
  .option('profile', 'Minecraft Game Directory Name', 'default')
  .option('demo', 'Enable Demo Mode', false);
const flags = args.parse(process.argv, {version: false});
let res = request('POST', 'https://authserver.mojang.com/authenticate', {
  json: {
    agent: {
      name: 'Minecraft',
      version: 1
    },
    username: flags['email'],
    password: flags['password']
  }
});
let data = JSON.parse(res.getBody('utf8'));
let minecraft = mclauncher({
  version: flags['version'],
  username: data.selectedProfile.name,
  uuid: data.selectedProfile.id,
  authToken: data.accessToken,
  profile: flags['profile'],
  demo: flags['demo'],
  log: data => process.stdout.write(data)
});