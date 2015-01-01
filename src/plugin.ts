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
  env?: IEnvironment;
  aliases?: Runner.IAliasesOptions;
  newLine?: string;
  namespaceSeparator?: string;
  handlebarsOptions?: IHandlebarsOptions;
  generate(types: Symbol.Type[], generator: Generator): void;
}

export class Plugin implements IPlugin {
  public pluginDirectory: string;
  public env: IEnvironment;
  public aliases: Runner.IAliasesOptions = {};
  public newLine: string = '\n';
  public namespaceSeparator: string = '.';
  public handlebarsOptions: IHandlebarsOptions = null;

  constructor(args: IPlugin) {
    _.assign(this, args);

    if (this.env === undefined) {
      this.env = new NodeJsEnvironment(this.pluginDirectory, this.newLine);
    }
  }

  public generate(types: Symbol.Type[], generator: Generator): void {
    throw new Error('The plugin does not implement the generate function');
  }
}
