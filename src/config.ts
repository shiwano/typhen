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

  private enumStringTable: { [key: string]: number } = {
    // ScriptTarget
    'es3': <number>ts.ScriptTarget.ES3,
    'es5': <number>ts.ScriptTarget.ES5,
    'es6': <number>ts.ScriptTarget.ES6,
    'latest': <number>ts.ScriptTarget.Latest,
    // ModuleKind
    'none': <number>ts.ModuleKind.None,
    'commonjs': <number>ts.ModuleKind.CommonJS,
    'amd': <number>ts.ModuleKind.AMD,
    'umd': <number>ts.ModuleKind.UMD,
    'system': <number>ts.ModuleKind.System,
    // NewLineKind
    'carriagereturnlinefeed': <number>ts.NewLineKind.CarriageReturnLineFeed,
    'linefeed': <number>ts.NewLineKind.LineFeed,
    // ModuleResolutionKind
    'classic': <number>ts.ModuleResolutionKind.Classic,
    'nodejs': <number>ts.ModuleResolutionKind.NodeJs
  };

  constructor(args: ConfigObject) {
    this.compilerOptions = <ts.CompilerOptions>_.defaults({}, args.compilerOptions, {
      module: ts.ModuleKind.CommonJS,
      noImplicitAny: true,
      target: ts.ScriptTarget.ES5
    });

    this.compilerOptions.target = this.getCompilerOptionsEnum<ts.ScriptTarget>(this.compilerOptions.target);
    this.compilerOptions.module = this.getCompilerOptionsEnum<ts.ModuleKind>(this.compilerOptions.module);
    this.compilerOptions.newLine = this.getCompilerOptionsEnum<ts.NewLineKind>(this.compilerOptions.newLine);
    this.compilerOptions.moduleResolution = this.getCompilerOptionsEnum<ts.ModuleResolutionKind>(this.compilerOptions.moduleResolution);

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

  getCompilerOptionsEnum<T>(enumValue: any): T {
    if (enumValue === undefined || enumValue === null) {
      return undefined;
    } else if (typeof enumValue === 'string') {
      return <any>this.enumStringTable[enumValue.toLowerCase()] as T;
    } else if (typeof enumValue === 'number') {
      return <any>enumValue as T;
    } else {
      throw new Error('Invalid compiler option enum value: ' + enumValue);
    }
  }
}
