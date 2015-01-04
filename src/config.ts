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
  cwd?: string;
  typingDirectory?: string;
  defaultLibFileName?: string;
  env?: IEnvironment;
  noWrite?: boolean;
}

export class Config {
  public plugin: Plugin.Plugin;
  public src: string;
  public dest: string;
  public cwd: string = process.cwd();
  public typingDirectory: string;
  public defaultLibFileName: string;
  public env: IEnvironment;
  public noWrite: boolean = false;

  constructor(args: IConfig) {
    _.assign(this, args);

    if (this.env === undefined) {
      this.env = new NodeJsEnvironment(this.cwd, this.plugin.newLine, this.defaultLibFileName);
    }
    this.defaultLibFileName = this.env.defaultLibFileName;

    if (!_.isString(this.typingDirectory)) {
      this.typingDirectory = this.env.dirname(this.env.resolvePath(this.src));
    }

    this.src = this.env.resolvePath(this.src);
    this.dest = this.env.resolvePath(this.dest);
    this.cwd = this.env.resolvePath(this.cwd);
    this.typingDirectory = this.env.resolvePath(this.typingDirectory);
  }
}
