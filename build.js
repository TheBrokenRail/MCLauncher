const builder = require('electron-builder');

builder.build({
  win: [],
  linux: [],
  config: {
    appId: 'org.thebrokenrail.mclauncher',
    productName: 'MCLauncher',
    win: {
      target: [
        {
          target: 'nsis',
          arch: [
            'x64',
            'ia32'
          ]
        },
        {
          target: 'portable',
          arch: [
            'x64',
            'ia32'
          ]
        },
        {
          target: 'zip',
          arch: [
            'x64',
            'ia32'
          ]
        }
      ]
    },
    linux: {
      target: [
        {
          target: 'deb',
          arch: [
            'x64',
            'ia32',
            'armv7l',
            'arm64'
          ]
        },
        {
          target: 'zip',
          arch: [
            'x64',
            'ia32',
            'armv7l',
            'arm64'
          ]
        }
      ],
      maintainer: 'TheBrokenRail'
    }
  }
});
