import _ = require('lodash');

import Symbol = require('./symbol');
import Runner = require('./runner');
import NodeJsEnvironment = require('./environments/node_js');
import Generator = require('./generator');

export interface DisallowOptions {
  any?: boolean;
  tuple?: boolean;
  unionType?: boolean;
  overload?: boolean;
  generics?: boolean;
  anonymousFunction?: boolean;
  anonymousObject?: boolean;
}

// For details, see: http://handlebarsjs.com/execution.html
export interface HandlebarsOptions {
  data?: any;
  helpers?: { [helperName: string]: (...args: any[]) => any };
  partials?: { [partialName: string]: any };
}

export interface PluginObject {
  pluginDirectory: string;
  newLine?: string;
  namespaceSeparator?: string;
  customPrimitiveTypes?: string[];
  disallow?: DisallowOptions;
  handlebarsOptions?: HandlebarsOptions;
  rename?(symbol: Symbol.Symbol, name: string): string;
  generate(generator: Generator, types: Symbol.Type[], modules: Symbol.Module[]): void | Promise<void>;
}

export class Plugin implements PluginObject {
  pluginDirectory: string;
  newLine: string = '\n';
  namespaceSeparator: string = '.';
  customPrimitiveTypes: string[] = [];
  disallow: DisallowOptions = {};
  handlebarsOptions: HandlebarsOptions = {};

  constructor(args: PluginObject) {
    _.assign(this, args);
  }

  rename(symbol: Symbol.Symbol, name: string): string {
    return name;
  }

  generate(generator: Generator, types: Symbol.Type[], modules: Symbol.Module[]): void | Promise<void> {
    throw new Error('The plugin does not implement the generate function');
  }
}
