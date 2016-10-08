import * as _ from 'lodash';
import * as ts from 'typescript';

import * as plugin from './plugin';
import { Environment } from './environments/environment';
import NodeJsEnvironment from './environments/node_js';
import CompilerHost from './compiler_host';

export interface TSConfigTyphenObject {
  plugin: string;
  pluginOptions: { [key: string]: any };
  outDir: string;
  files?: string | string[];
  typingDirectory?: string;
  defaultLibFileName?: string;
}

export interface ConfigObject {
  plugin: plugin.Plugin;
  src: string | string[];
  dest: string;
  cwd?: string;
  typingDirectory?: string;
  defaultLibFileName?: string;
  env?: Environment;
  noWrite?: boolean;
  compilerOptions?: ts.CompilerOptions;
}

export class Config implements ConfigObject {
  plugin: plugin.Plugin;
  src: string[];
  dest: string;
  cwd: string;
  typingDirectory: string;
  defaultLibFileName: string;
  env: Environment;
  noWrite: boolean;
  compilerOptions: ts.CompilerOptions;
  compilerHost: CompilerHost;

  constructor(args: ConfigObject) {
    this.compilerOptions = <ts.CompilerOptions>_.defaults({}, args.compilerOptions, {
      module: ts.ModuleKind.CommonJS,
      noImplicitAny: true,
      target: ts.ScriptTarget.ES5
    });

    this.cwd = args.cwd || process.cwd();
    this.env = args.env || new NodeJsEnvironment(this.cwd, args.plugin.newLine,
        this.compilerOptions.target, args.defaultLibFileName);
    this.defaultLibFileName = this.env.defaultLibFileName;

    this.src = typeof args.src === 'string' ? [<string>args.src] : <string[]>args.src;
    this.src = this.src.map(s => this.env.resolvePath(s));
    this.dest = this.env.resolvePath(args.dest);
    this.cwd = this.env.resolvePath(this.cwd);

    this.typingDirectory = args.typingDirectory || this.getTypingDirectory(this.src);
    this.typingDirectory = this.env.resolvePath(this.typingDirectory);

    this.plugin = args.plugin;
    this.noWrite = args.noWrite || false;
    this.compilerHost = new CompilerHost(this.env);
  }

  getTypingDirectory(src: string[]): string {
    let dirnames = src.map(s => {
      let resolvedPath = this.env.resolvePath(s);
      return this.env.dirname(resolvedPath).replace('\\', '/');
    });
    if (!dirnames.every(d => _.includes(d, this.cwd))) { return this.cwd; }

    let minDirCount = _.min(dirnames.map(d => d.split('/').length));
    let minDirnames = dirnames.filter(d => d.split('/').length === minDirCount);
    return minDirnames.every(d => d === minDirnames[0]) ? minDirnames[0] : this.cwd;
  }
}
