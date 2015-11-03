import fs = require('fs');
import path = require('path');
import pathExists = require('path-exists');
import mkdirp = require('mkdirp');
import _ = require('lodash');
import glob = require('glob');

import Logger = require('../logger');
import Environment = require('./environment');

class NodeJsEnvironment implements Environment {
  public currentDirectory: string;
  public useCaseSensitiveFileNames: boolean = false;
  public defaultLibFileName: string = path.join(path.dirname(require.resolve('typescript')), 'lib.d.ts');

  constructor(currentDirectory: string, public newLine: string, defaultLibFileName?: string) {
    this.currentDirectory = path.resolve(currentDirectory);

    if (typeof defaultLibFileName === 'string' && defaultLibFileName.length > 0) {
      this.defaultLibFileName = this.resolvePath(defaultLibFileName);

      if (!this.exists(this.defaultLibFileName)) {
        this.defaultLibFileName = path.join(path.dirname(require.resolve('typescript')), defaultLibFileName);
      }
    }
  }

  public readFile(fileName: string): string {
    var resolvedPath = this.resolvePath(fileName);

    if (resolvedPath === this.defaultLibFileName) {
      return this.getDefaultLibFileData();
    } else {
      Logger.debug('Reading: ' + resolvedPath);
      return fs.readFileSync(resolvedPath, 'utf-8');
    }
  }

  public writeFile(fileName: string, data: string): void {
    var filePath = this.resolvePath(fileName);
    Logger.debug('Writing: ' + filePath);
    mkdirp.sync(path.dirname(filePath));
    fs.writeFileSync(filePath, data);
  }

  public resolvePath(...pathSegments: string[]): string {
    var args = _.flatten([this.currentDirectory, pathSegments], true);
    return path.resolve.apply(null, args);
  }

  public relativePath(from: string, to?: string): string {
    if (to === undefined) {
      to = from;
      from = this.currentDirectory;
    }
    return path.relative(from, to);
  }

  public dirname(fileName: string): string {
    return path.dirname(fileName);
  }

  public exists(fileName: string): boolean {
    var filePath = this.resolvePath(fileName);
    return pathExists.sync(filePath);
  }

  public getDefaultLibFileData(): string {
    Logger.debug('Reading dafaultLibFile data');
    return fs.readFileSync(this.defaultLibFileName, 'utf-8');
  }

  public glob(pattern: string, cwd: string = this.currentDirectory): string[] {
    return glob.sync(pattern, <any>{
      cwd: cwd,
      nodir: true
    });
  }
}

export = NodeJsEnvironment;
