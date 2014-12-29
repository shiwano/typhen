/// <reference path="../typings/tsd.d.ts" />

import path = require('path');

import Plugin = require('./plugin');
import Config = require('./config');
import Runner = require('./runner');
import Symbol = require('./symbol');
import LocalHandlebars = require('./local_handlebars');

module Typhen {
  export import SymbolKinds = Symbol.SymbolKinds;
  export import Handlebars = LocalHandlebars.handlebars;

  export function run(configArgs: Config.IConfig): void {
    var config = new Config.Config(configArgs);
    new Runner.Runner(config).run();
  }

  export function runByTyphenfile(fileName: string): void {
    require(fileName)(Typhen);
  }

  export function createPlugin(pluginArgs: Plugin.IPlugin): Plugin.Plugin {
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
