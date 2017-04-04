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
  defaultLibFileName: string;

  private libFilePattern: RegExp = new RegExp('^lib\.[a-z0-9.]+\.d\.ts$');
  libFileNames: string[];

  constructor(
      currentDirectory: string,
      public newLine: string,
      scriptTarget: ts.ScriptTarget,
      lib?: string[],
      defaultLibFileName?: string) {
    this.currentDirectory = path.resolve(currentDirectory);
    this.libFileNames = this.getLibFileNames(scriptTarget, defaultLibFileName, lib);
    this.defaultLibFileName = this.resolveTSLibPath('@@__typhen.lib.d.ts');
  }

  readFile(fileName: string): string {
    if (fileName === this.defaultLibFileName) {
      return this.getDefaultLibFileData();
    }
    if (this.libFilePattern.test(fileName)) {
      const resolvedTSLibPath = this.resolveTSLibPath(fileName);
      if (this.exists(resolvedTSLibPath)) {
        return fs.readFileSync(resolvedTSLibPath, 'utf-8');
      }
    }
    const resolvedPath = this.resolvePath(fileName);
    Logger.debug('Reading: ' + resolvedPath);
    return fs.readFileSync(resolvedPath, 'utf-8');
  }

  writeFile(fileName: string, data: string): void {
    const filePath = this.resolvePath(fileName);
    Logger.debug('Writing: ' + filePath);
    mkdirp.sync(path.dirname(filePath));
    fs.writeFileSync(filePath, data);
  }

  resolvePath(...pathSegments: string[]): string {
    const args = _.flatten([this.currentDirectory, pathSegments], true);
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
    const filePath = this.resolvePath(fileName);
    return pathExists.sync(filePath);
  }

  getDirectories(basePath: string): string[] {
    return fs.readdirSync(basePath).map(d => path.join(basePath, d))
      .filter(d => fs.statSync(d).isDirectory());
  }

  getDefaultLibFileData(): string {
    Logger.debug('Reading dafaultLibFile data');
    return this.libFileNames.map(fileName => {
      return fs.readFileSync(fileName, 'utf-8');
    }).join('\n');
  }

  glob(pattern: string, cwd: string = this.currentDirectory): string[] {
    return glob.sync(pattern, <any>{
      cwd: cwd,
      nodir: true
    });
  }

  eval(code: string): any {
    const sandbox: any = {};
    const resultKey = 'RESULT_' + Math.floor(Math.random() * 1000000);
    sandbox[resultKey] = {};
    vm.runInNewContext(resultKey + '=' + code, sandbox);
    return sandbox[resultKey];
  }

  private getLibFileNames(scriptTarget: ts.ScriptTarget, defaultLibFileName?: string, lib?: string[]): string[] {
    if (typeof defaultLibFileName === 'string' && defaultLibFileName.length > 0) {
      if (this.exists(this.defaultLibFileName)) {
        return [this.resolvePath(defaultLibFileName)];
      } else {
        return [this.resolveTSLibPath(defaultLibFileName)];
      }
    }
    if (_.isArray(lib)) {
      return lib.map(libName => {
        return this.resolveTSLibPath('lib.' + libName + '.d.ts');
      });
    }
    switch (scriptTarget) {
      case ts.ScriptTarget.ES2015:
        return [this.resolveTSLibPath('lib.es2015.d.ts'), this.resolveTSLibPath('lib.dom.d.ts')];
      case ts.ScriptTarget.ES2016:
        return [this.resolveTSLibPath('lib.es2016.d.ts'), this.resolveTSLibPath('lib.dom.d.ts')];
      case ts.ScriptTarget.ES2017:
        return [this.resolveTSLibPath('lib.es2017.d.ts'), this.resolveTSLibPath('lib.dom.d.ts')];
      default:
        return [this.resolveTSLibPath('lib.d.ts')];
    }
  }

  private resolveTSLibPath(fileName: string): string {
    return path.join(path.dirname(require.resolve('typescript')), fileName);
  }
}
