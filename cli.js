const mclauncher = require('./index');
const args = require('args');

args.option('version', 'Minecraft Version', 'latest-release')
  .option('demo', 'Enable Demo Mode', false);
const flags = args.parse(process.argv, {version: false});
mclauncher(flags);