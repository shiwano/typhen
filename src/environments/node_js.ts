/// <reference path='../../typings/tsd.d.ts' />

import fs = require('fs');
import path = require('path');
import mkdirp = require('mkdirp');
import _ = require('lodash');

import IEnvironment = require('./i_environment');

class NodeJsEnvironment implements IEnvironment {
  public currentDirectory: string;
  public useCaseSensitiveFileNames: boolean = false;
  public defaultLibFileNames: string[] = [
    path.resolve(__dirname, '../../lib.typhen.d.ts'),
    path.resolve(__dirname, '../../lib.core.d.ts')
  ];

  public get defaultLibFileName(): string { return this.defaultLibFileNames[0]; }

  constructor(currentDirectory: string, public newLine: string) {
    this.currentDirectory = path.resolve(currentDirectory);
  }

  public readFile(fileName: string): string {
    return fs.readFileSync(this.resolvePath(fileName), 'utf-8');
  }

  public writeFile(fileName: string, data: string): void {
    var filePath = this.resolvePath(fileName);
    mkdirp.sync(path.dirname(filePath));
    fs.writeFileSync(filePath, data);
  }

  public resolvePath(...pathSegments: string[]): string {
    var args = _.flatten([[this.currentDirectory], pathSegments], true);
    return path.resolve.apply(null, args);
  }

  public exists(fileName: string): boolean {
    var filePath = this.resolvePath(fileName);
    return fs.existsSync(filePath);
  }
}

export = NodeJsEnvironment;
