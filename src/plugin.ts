/// <reference path="../typings/tsd.d.ts" />

import _ = require('lodash');

import Symbol = require('./symbol');
import Runner = require('./runner');
import IEnvironment = require('./environments/i_environment');
import NodeJsEnvironment = require('./environments/node_js');
import Generator = require('./generator');

// For details, see: http://handlebarsjs.com/execution.html
export interface IHandlebarsOptions {
  data?: any;
  helpers?: { [helperName: string]: (...args: any[]) => any };
  partials: { [partialName: string]: any }
}

export interface IPlugin {
  pluginDirectory: string;
  newLine?: string;
  namespaceSeparator?: string;
  handlebarsOptions?: IHandlebarsOptions;
  rename?(symbol: Symbol.Symbol, name: string): string;
  generate(generator: Generator, types: Symbol.Type[]): any; // void or Promise<void>
}

export class Plugin implements IPlugin {
  public pluginDirectory: string;
  public newLine: string = '\n';
  public namespaceSeparator: string = '.';
  public handlebarsOptions: IHandlebarsOptions = null;

  constructor(args: IPlugin) {
    _.assign(this, args);
  }

  public rename(symbol: Symbol.Symbol, name: string): string {
    return name;
  }

  public generate(generator: Generator, types: Symbol.Type[]): any {
    throw new Error('The plugin does not implement the generate function');
  }
}
