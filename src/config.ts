/// <reference path="../typings/tsd.d.ts" />

import _ = require('lodash');

import Plugin = require('./plugin');
import Runner = require('./runner');
import IEnvironment = require('./environments/i_environment');
import NodeJsEnvironment = require('./environments/node_js');

export interface IConfig {
  plugin: Plugin.Plugin;
  src: string;
  dest: string;
  env?: IEnvironment;
  cwd?: string;
  noWrite?: boolean;
}

export class Config {
  public plugin: Plugin.Plugin;
  public src: string;
  public dest: string;
  public env: IEnvironment;
  public cwd: string = process.cwd();
  public noWrite: boolean = false;

  constructor(args: IConfig) {
    _.assign(this, args);

    if (this.env === undefined) {
      this.env = new NodeJsEnvironment(this.cwd, this.plugin.newLine);
    }
  }
}
