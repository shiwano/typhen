import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import * as pathExists from 'path-exists';
import * as mkdirp from 'mkdirp';
import * as _ from 'lodash';
import * as glob from 'glob';
import * as ts from 'typescript';

import * as Logger from '../logger';
import { Environment } from './environment';

export default class NodeJsEnvironment implements Environment {
  currentDirectory: string;
  useCaseSensitiveFileNames: boolean = false;
  defaultLibFileName: string = path.join(path.dirname(require.resolve('typescript')), 'lib.d.ts');

  constructor(
      currentDirectory: string,
      public newLine: string,
      scriptTarget: ts.ScriptTarget,
      defaultLibFileName?: string) {
    this.currentDirectory = path.resolve(currentDirectory);
    this.defaultLibFileName = this.getDefaultLibFileName(defaultLibFileName, scriptTarget);
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

  getDirectories(basePath: string): string[] {
    return fs.readdirSync(basePath).map(d => path.join(basePath, d))
      .filter(d => fs.statSync(d).isDirectory());
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

  private getDefaultLibFileName(defaultLibFileName: string, scriptTarget: ts.ScriptTarget): string {
    if (typeof defaultLibFileName === 'string' && defaultLibFileName.length > 0) {
      if (this.exists(this.defaultLibFileName)) {
        return this.resolvePath(defaultLibFileName);
      } else {
        return path.join(path.dirname(require.resolve('typescript')), defaultLibFileName);
      }
    } else if (scriptTarget === ts.ScriptTarget.ES2015) {
      return path.join(path.dirname(require.resolve('typescript')), 'lib.es2015.d.ts');
    } else {
      return path.join(path.dirname(require.resolve('typescript')), 'lib.d.ts');
    }
  }
}
