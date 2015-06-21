/// <reference path="../typings/bundle.d.ts" />

import path = require('path');
import Vinyl = require('vinyl');

import Plugin = require('./plugin');
import Config = require('./config');
import Runner = require('./runner');
import Symbol = require('./symbol');
import Logger = require('./logger');
import Helpers = require('./helpers');

module Typhen {
  export import SymbolKind = Symbol.SymbolKind;
  export var logger = Logger;
  export var helpers = Helpers;

  export function run(configArgs: Config.ConfigObject): Promise<Vinyl[]> {
    var config = new Config.Config(configArgs);
    return new Runner.Runner(config).run();
  }

  export function runByTyphenfile(fileName: string): Promise<Vinyl[]> {
    return require(fileName)(Typhen);
  }

  export function createPlugin(pluginArgs: Plugin.PluginObject): Plugin.Plugin {
    return new Plugin.Plugin(pluginArgs);
  }

  export function loadPlugin(pluginName: string, options: any = {}): Plugin.Plugin {
    try {
      return <Plugin.Plugin>require(pluginName)(Typhen, options);
    } catch (e) {
      var resolvedPath = path.resolve(pluginName);
      return <Plugin.Plugin>require(resolvedPath)(Typhen, options);
    }
  }
}

export = Typhen;
