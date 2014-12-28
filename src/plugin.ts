/// <reference path="../typings/tsd.d.ts" />

import _ = require('lodash');

import Symbol = require('./symbol');
import Runner = require('./runner');
import IEnvironment = require('./environments/i_environment');
import NodeJsEnvironment = require('./environments/node_js');
import Generator = require('./generator');

export interface IDisallowOptions {
  enum?: boolean;
  function?: boolean;
  interface?: boolean;
  class?: boolean;
  objectType?: boolean;
  typeParameter?: boolean;
  method?: boolean;
  property?: boolean;
}

// For details, see: http://handlebarsjs.com/execution.html
export interface IHandlebarsOptions {
  data?: any;
  helpers?: { [helperName: string]: (...args: any[]) => any };
  partials: { [partialName: string]: any }
}

export interface IPlugin {
  pluginDirectory: string;
  env?: IEnvironment;
  defaultLibFileName?: string;
  disallow?: IDisallowOptions;
  aliases?: Runner.IAliasesOptions;
  newLine?: string;
  namespaceSeparator?: string;
  handlebarsOptions?: IHandlebarsOptions;
  generate(types: Symbol.Type[], generator: Generator): void;
}

export class Plugin implements IPlugin {
  public pluginDirectory: string;
  public env: IEnvironment;
  public defaultLibFileName: string;
  public disallow: IDisallowOptions = {};
  public aliases: Runner.IAliasesOptions = {};
  public newLine: string = '\n';
  public namespaceSeparator: string = '.';
  public handlebarsOptions: IHandlebarsOptions = null;

  constructor(args: IPlugin) {
    _.assign(this, args);

    if (this.env === undefined) {
      this.env = new NodeJsEnvironment(this.pluginDirectory, this.newLine);
    }

    if (this.defaultLibFileName !== undefined) {
      this.defaultLibFileName = this.env.resolvePath(this.defaultLibFileName);
    }
  }

  public generate(types: Symbol.Type[], generator: Generator): void {
    throw new Error('The plugin does not implement the generate function');
  }
}
