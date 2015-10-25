'use strict';

var os = require('os');
var path = require('path');
var _ = require('lodash');
var Q = require('q');
var ncp = require('ncp');
var packager = require('electron-packager');
var jf = require('jsonfile');
var rimraf = require('rimraf');
var packageManager = require('nachos-package-manager');

jf.indents = 2;

module.exports = function (dir) {
  var nachosJson = require(path.join(dir, 'nachos.json'));
  var tmpDir = path.resolve(os.tmpdir(), 'nachos-build-' + Date.now());
  var out = path.resolve(dir, 'build');

  var filter = function (file) {
    return !(_.contains(file, 'node_modules') || _.contains(file, '.git'));
  };

  return Q.nfcall(rimraf, out)
    .then(function () {
      return Q.nfcall(ncp, dir, tmpDir, {filter: filter});
    })
    .then(function () {
      var opts = {
        dir: tmpDir,
        name: nachosJson.name,
        all: true,
        version: '0.33.1',
        overwrite: true,
        out: out,
        icon: path.resolve(tmpDir, 'favicon.ico'),
        'version-string': {
          CompanyName: 'Nachos',
          LegalCopyright: 'GNUGPLv2',
          FileDescription: nachosJson.name,
          OriginalFilename: nachosJson.name,
          FileVersion: nachosJson.version,
          ProductVersion: nachosJson.version,
          ProductName: nachosJson.name,
          InternalName: nachosJson.name
        }
      };

      return Q.nfcall(packager, opts);
    })
    .then(function (apps) {
      return Q.all(apps.map(function (app) {
        var splitted = path.basename(app).split('-');
        var os = splitted[1];
        var arch = splitted[2];

        nachosJson.main = './' + nachosJson.name + (app.indexOf('win32') !== -1 ? '.exe' : '');

        return Q.nfcall(jf.writeFile, path.join(app, 'nachos.json'), nachosJson)
          .then(function () {
            return Q.nfcall(jf.writeFile, path.join(app, 'resources', 'app', 'nachos.json'), nachosJson)
              .then(_.noop, function () {
                return Q.resolve();
              });
          })
          .then(function () {
            return packageManager.publish(app, os, arch);
          });
      }));
    })
    .finally(function () {
      return Q.nfcall(rimraf, tmpDir);
    });
};
