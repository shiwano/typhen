import * as path from 'path';
import Vinyl = require('vinyl');

import * as plugin from './plugin';
import * as config from './config';
import * as symbol from './symbol';
import * as typhenLogger from './logger';
import * as typhenHelpers from './helpers';
import Runner from './runner';

namespace Typhen {
  export import SymbolKind = symbol.SymbolKind;
  export const logger = typhenLogger;
  export const helpers = typhenHelpers;

  export function run(configArgs: config.ConfigObject): Promise<Vinyl[]> {
    let runningConfig = new config.Config(configArgs);
    return new Runner(runningConfig).run();
  }

  export function runByTyphenfile(fileName: string): Promise<Vinyl[]> {
    return require(fileName)(Typhen);
  }

  export function createPlugin(pluginArgs: plugin.PluginObject): plugin.Plugin {
    return new plugin.Plugin(pluginArgs);
  }

  export function loadPlugin(pluginName: string, options: any = {}): plugin.Plugin {
    try {
      return <plugin.Plugin>require(pluginName)(Typhen, options);
    } catch (e) {
      let resolvedPath = path.resolve(pluginName);
      return <plugin.Plugin>require(resolvedPath)(Typhen, options);
    }
  }
}

export = Typhen;
