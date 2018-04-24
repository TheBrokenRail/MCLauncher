const mclauncher = require('./index');
const args = require('args');

args.option('version', 'Minecraft Version', 'latest-release')
  .option('username', 'Minecraft Username', 'Steve')
  .option('uuid', 'Minecraft UUID', '0')
  .option('authToken', 'Minecraft Authentication Token', '0')
  .option('profile', 'Minecraft Game Directory Name', 'latest-release')
  .option('demo', 'Enable Demo Mode', false);
const flags = args.parse(process.argv, {version: false});
mclauncher(flags);