/// <reference path="../typings/bundle.d.ts" />

import _ = require('lodash');

import Symbol = require('./symbol');
import Runner = require('./runner');
import NodeJsEnvironment = require('./environments/node_js');
import Generator = require('./generator');

export interface DisallowOptions {
  any?: boolean;
  tuple?: boolean;
  overload?: boolean;
  generics?: boolean;
}

// For details, see: http://handlebarsjs.com/execution.html
export interface HandlebarsOptions {
  data?: any;
  helpers?: { [helperName: string]: (...args: any[]) => any };
  partials: { [partialName: string]: any }
}

export interface PluginObject {
  pluginDirectory: string;
  newLine?: string;
  namespaceSeparator?: string;
  disallow?: DisallowOptions;
  handlebarsOptions?: HandlebarsOptions;
  rename?(symbol: Symbol.Symbol, name: string): string;
  generate(generator: Generator, types: Symbol.Type[], modules: Symbol.Module[]): any; // void or Promise<void>
}

export class Plugin implements PluginObject {
  public pluginDirectory: string;
  public newLine: string = '\n';
  public namespaceSeparator: string = '.';
  public disallow: DisallowOptions = {};
  public handlebarsOptions: HandlebarsOptions = null;

  constructor(args: PluginObject) {
    _.assign(this, args);
  }

  public rename(symbol: Symbol.Symbol, name: string): string {
    return name;
  }

  public generate(generator: Generator, types: Symbol.Type[], modules: Symbol.Module[]): any {
    throw new Error('The plugin does not implement the generate function');
  }
}
