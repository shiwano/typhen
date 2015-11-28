import fs = require('fs');
import path = require('path');
import vm = require('vm');
import pathExists = require('path-exists');
import mkdirp = require('mkdirp');
import _ = require('lodash');
import glob = require('glob');

import Logger = require('../logger');
import Environment = require('./environment');

class NodeJsEnvironment implements Environment {
  currentDirectory: string;
  useCaseSensitiveFileNames: boolean = false;
  defaultLibFileName: string = path.join(path.dirname(require.resolve('typescript')), 'lib.d.ts');

  constructor(currentDirectory: string, public newLine: string, defaultLibFileName?: string) {
    this.currentDirectory = path.resolve(currentDirectory);

    if (typeof defaultLibFileName === 'string' && defaultLibFileName.length > 0) {
      this.defaultLibFileName = this.resolvePath(defaultLibFileName);

      if (!this.exists(this.defaultLibFileName)) {
        this.defaultLibFileName = path.join(path.dirname(require.resolve('typescript')), defaultLibFileName);
      }
    }
  }

  readFile(fileName: string): string {
    let resolvedPath = this.resolvePath(fileName);

    if (resolvedPath === this.defaultLibFileName) {
      return this.getDefaultLibFileData();
    } else {
      Logger.debug('Reading: ' + resolvedPath);
      return fs.readFileSync(resolvedPath, 'utf-8');
    }
  }

  writeFile(fileName: string, data: string): void {
    let filePath = this.resolvePath(fileName);
    Logger.debug('Writing: ' + filePath);
    mkdirp.sync(path.dirname(filePath));
    fs.writeFileSync(filePath, data);
  }

  resolvePath(...pathSegments: string[]): string {
    let args = _.flatten([this.currentDirectory, pathSegments], true);
    return path.resolve.apply(null, args);
  }

  relativePath(from: string, to?: string): string {
    if (to === undefined) {
      to = from;
      from = this.currentDirectory;
    }
    return path.relative(from, to);
  }

  dirname(fileName: string): string {
    return path.dirname(fileName);
  }

  exists(fileName: string): boolean {
    let filePath = this.resolvePath(fileName);
    return pathExists.sync(filePath);
  }

  getDefaultLibFileData(): string {
    Logger.debug('Reading dafaultLibFile data');
    return fs.readFileSync(this.defaultLibFileName, 'utf-8');
  }

  glob(pattern: string, cwd: string = this.currentDirectory): string[] {
    return glob.sync(pattern, <any>{
      cwd: cwd,
      nodir: true
    });
  }

  eval(code: string): any {
    let sandbox: any = {};
    let resultKey = 'RESULT_' + Math.floor(Math.random() * 1000000);
    sandbox[resultKey] = {};
    vm.runInNewContext(resultKey + '=' + code, sandbox);
    return sandbox[resultKey];
  }
}

export = NodeJsEnvironment;
