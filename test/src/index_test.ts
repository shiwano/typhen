require('../test_helper');

import Typhen = require('../../src/index');
import Plugin = require('../../src/plugin');
import Symbol = require('../../src/symbol');
import Logger = require('../../src/logger');
import LocalHandlebars = require('../../src/local_handlebars');

describe('Typhen', () => {
  describe('.SymbolKinds', () => {
    it('should export SymbolKinds', () => {
      assert(Typhen.SymbolKinds === Symbol.SymbolKinds);
    });
  });

  describe('.logger', () => {
    it('should export logger', () => {
      assert(Typhen.logger === Logger);
    });
  });

  describe('.createPlugin', () => {
    it('should create the instance of Plugin', () => {
      var response = Typhen.createPlugin({
        pluginDirectory: 'templates',
        generate: function(types, generator) {}
      });
      assert(response instanceof Plugin.Plugin);
    });
  });

  describe('.loadPlugin', () => {
    it('should load the specified instance of Plugin', () => {
      var response = Typhen.loadPlugin('./test/fixtures/plugin/typhen-test');
      var expected = process.cwd() + '/test/fixtures/plugin';
      assert(response instanceof Plugin.Plugin);
      assert(response.pluginDirectory === expected);
    });
  });
});
