import * as _ from 'lodash';
import * as Promise from 'bluebird';

import * as symbol from './symbol';
import NodeJsEnvironment from './environments/node_js';
import Generator from './generator';

export interface DisallowOptions {
  any?: boolean;
  tuple?: boolean;
  unionType?: boolean;
  intersectionType?: boolean;
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
  rename?(symbol: symbol.Symbol, name: string): string;
  generate(generator: Generator, types: symbol.Type[], modules: symbol.Module[]): void | Promise<void>;
}

export class Plugin implements PluginObject {
  pluginDirectory: string;
  newLine: string = '\n';
  namespaceSeparator: string = '.';
  customPrimitiveTypes: string[] = [];
  disallow: DisallowOptions = {};
  handlebarsOptions: HandlebarsOptions = {};

  static Empty(): Plugin {
    return new Plugin({pluginDirectory: '', generate: () => {}});
  }

  constructor(args: PluginObject) {
    _.assign(this, args);
  }

  rename(symbol: symbol.Symbol, name: string): string {
    return name;
  }

  generate(generator: Generator, types: symbol.Type[], modules: symbol.Module[]): void | Promise<void> {
    throw new Error('The plugin does not implement the generate function');
  }
}
