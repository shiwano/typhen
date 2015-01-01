/// <reference path="../typings/tsd.d.ts" />

require('source-map-support').install();

global.assert = require('power-assert');
global.sinon = require('sinon');

import _ = require('lodash');
import path = require('path');

import Symbol = require('../src/symbol');
import Plugin = require('../src/plugin');
import Runner = require('../src/runner');
import Config = require('../src/config');
import Generator = require('../src/generator');
import IEnvironment = require('../src/environments/i_environment');

console.info = () => {};

export class TestEnvironment implements IEnvironment {
  public currentDirectory: string = process.cwd() + '/test/fixtures/typings';
  public newLine: string = '\n';
  public useCaseSensitiveFileNames: boolean = false;
  public defaultLibFileName: string = 'lib.typhen.d.ts';
  public defaultLibFileNames: string[] = ['lib.typhen.d.ts'];

  constructor(
      private fileData: { [fileName: string]: string } = {}) {
  }

  public writeFile(fileName: string, data: string): void {}

  public readFile(fileName: string): string {
    if (!this.fileData[fileName]) { throw new Error('Invalid file name: ' + fileName); }
    return this.fileData[fileName];
  }

  public resolvePath(...pathSegments: string[]): string {
    return path.join.apply(this, pathSegments);
  }

  public exists(fileName: string): boolean {
    return _.any(Object.keys(this.fileData), n => _.contains(fileName, n));
  }
}

export function createEnum(runner?: Runner.Runner): Symbol.Enum {
  if (runner === undefined) { runner = createRunner(); }
  var type = new Symbol.Enum(runner, 'FooType', ['awesome', '@default FooType.Bar', '@type Enum'], [], ['App', 'Type']);

  type.initialize([
    new Symbol.EnumMember(runner, 'Bar', [''], []).initialize(0),
    new Symbol.EnumMember(runner, 'Baz', [''], []).initialize(1)
  ]);
  return type;
}

export function createPlugin(): Plugin.Plugin {
  return new Plugin.Plugin({
    pluginDirectory: process.cwd() + '/test/fixtures/plugin',
    defaultLibFileName: 'lib.d.ts',
    aliases: {},
    generate: function(types, generator) {}
  });
}

export function createConfig(): Config.Config {
  return new Config.Config({
    plugin: createPlugin(),
    src: 'test/fixtures/typings/definitions.d.ts',
    dest: '.tmp/generated'
  });
}

export function createGenerator(): Generator  {
  var env = new TestEnvironment({
    'README.md': 'This is README.'
  });
  var pluginEnv = new TestEnvironment({
    'enum.hbs': '{{name}}\n{{#each members}}{{name}}: {{value}}\n{{/each}}',
    'README.md': 'This is README.'
  });
  return new Generator('generated', env, pluginEnv, null);
}

export function createRunner(): Runner.Runner {
  return new Runner.Runner(createConfig());
}
