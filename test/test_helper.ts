/// <reference path="../node_modules/@types/mocha/index.d.ts" />

require('source-map-support').install();

import * as _ from 'lodash';
import * as path from 'path';

import * as symbol from '../src/symbol';
import * as plugin from '../src/plugin';
import * as config from '../src/config';
import * as logger from '../src/logger';
import * as runner from '../src/runner';
import { Environment } from '../src/environments/environment';
import Generator from '../src/generator';

logger.setLevel(logger.LogLevel.Error);

export class TestEnvironment implements Environment {
  currentDirectory: string = process.cwd() + '/test/fixtures/typings';
  newLine: string = '\n';
  useCaseSensitiveFileNames: boolean = false;
  defaultLibFileName: string = 'lib.typhen.d.ts';

  constructor(
      private fileData: { [fileName: string]: string } = {}) {
  }

  writeFile(fileName: string, data: string): void {}
  glob(pattern: string, cwd?: string): string[] { return []; }
  eval(core: string): any { return null; }

  readFile(fileName: string): string {
    if (!this.fileData[fileName]) { throw new Error('Invalid file name: ' + fileName); }
    return this.fileData[fileName];
  }

  resolvePath(...pathSegments: string[]): string {
    pathSegments = ['/'].concat(pathSegments);
    return path.resolve.apply(this, pathSegments);
  }

  relativePath(from: string, to?: string): string {
    if (to === undefined) {
      from = '/';
      to = from;
    }
    return path.relative(from, to);
  }

  dirname(fileName: string): string {
    return path.dirname(fileName);
  }

  exists(fileName: string): boolean {
    return !_.every(Object.keys(this.fileData), n => !_.includes(fileName, n));
  }

  getDirectories(basePath: string): string[] {
    return [];
  }
}

export function createEnum(config?: config.Config, assumedName: string = ''): symbol.Enum {
  if (config === undefined) { config = createConfig(); }
  const appModule = new symbol.Module(config, 'App', [''], [], [], null, '').initialize(false, {}, {}, [], [], [], []);
  const typeModule = new symbol.Module(config, 'Type', [''], [], [], appModule, '').initialize(false, {}, {}, [], [], [], []);

  const type = new symbol.Enum(config, 'FooType', ['awesome', '@default FooType.Bar', '@number 10',
      '@type Invalid', '@type Enum', '@true', '@false false'], [], [], typeModule, assumedName);
  type.initialize([
    new symbol.EnumMember(config, 'Bar', [''], [], [], typeModule, '').initialize(0),
    new symbol.EnumMember(config, 'Baz', [''], [], [], typeModule, '').initialize(1)
  ], false);
  return type;
}

export function createPlugin(): plugin.Plugin {
  return new plugin.Plugin({
    pluginDirectory: process.cwd() + '/test/fixtures/plugin',
    customPrimitiveTypes: ['integer'],
    generate: function(types, generator) {}
  });
}

export function createConfig(src: string | string[] = 'test/fixtures/typings/integration/index.d.ts',
    compilerOptions: any = {},
    include: string[] = [], exclude: string[] = []): config.Config {
  return new config.Config({
    plugin: createPlugin(),
    src: src,
    dest: '.tmp/generated',
    include: include,
    exclude: exclude,
    compilerOptions: <any>_.defaults(compilerOptions, {
      module: 'commonjs',
      target: 'ES5',
      experimentalDecorators: true
    })
  });
}

export function createGenerator(): Generator  {
  const env = new TestEnvironment({
    '/README.md': 'This is README.',
    '/plugin/README.md': 'This is README.',
    '/plugin/enum.hbs': '{{name}}\n{{#each members}}{{name}}: {{value}}\n{{/each}}'
  });
  return new Generator(env, '/generated', '/plugin', {});
}

export function createRunner(): runner.Runner {
  return new runner.Runner(createConfig());
}
