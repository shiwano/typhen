/// <reference path="../typings/tsd.d.ts" />

import path = require('path');
import Handlebars = require('handlebars');

import Plugin = require('./plugin');
import Config = require('./config');
import Runner = require('./runner');
import Symbol = require('./symbol');

import Swag = require('swag');
import HandlebarsHelpers = require('./handlebars_helpers');

Swag.registerHelpers(Handlebars);
HandlebarsHelpers.registerHelpers(Handlebars);

module Typhen {
  export import SymbolFlags = Symbol.SymbolFlags;

  export function run(configArgs: Config.IConfig): void {
    var config = new Config.Config(configArgs);
    new Runner.Runner(config).run();
  }

  export function runByTyphenfile(fileName: string): void {
    require(fileName)(Typhen, Handlebars);
  }

  export function createPlugin(pluginArgs: Plugin.IPlugin): Plugin.Plugin {
    return new Plugin.Plugin(pluginArgs);
  }

  export function loadPlugin(pluginName: string): Plugin.Plugin {
    try {
      return <Plugin.Plugin>require(pluginName)(Typhen, Handlebars);
    } catch (e) {
      var resolvedPath = path.resolve(pluginName);
      return <Plugin.Plugin>require(resolvedPath)(Typhen, Handlebars);
    }
  }
}

export = Typhen;
