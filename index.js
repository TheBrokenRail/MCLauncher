const { app, BrowserWindow } = require('electron');
const path = require('path');
const url = require('url');

let win = null;
function createWindow () {
  win = new BrowserWindow({width: 800, height: 600, show: false});
  win.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }));
  win.setMenu(null);
  win.once('ready-to-show', () => {
    win.show();
  });
}

app.on('ready', createWindow);
