import '../test_helper';

import * as typhen from '../../src/index';
import * as plugin from '../../src/plugin';
import * as symbol from '../../src/symbol';
import * as logger from '../../src/logger';
import * as helpers from '../../src/helpers';

describe('typhen', () => {
  describe('.SymbolKind', () => {
    it('should export SymbolKind', () => {
      assert(typhen.SymbolKind === symbol.SymbolKind);
    });
  });

  describe('.logger', () => {
    it('should export logger', () => {
      assert(typhen.logger === logger);
    });
  });

  describe('.helpers', () => {
    it('should export helpers', () => {
      assert(typhen.helpers === helpers);
    });
  });

  describe('.createPlugin', () => {
    it('should create the instance of Plugin', () => {
      var response = typhen.createPlugin({
        pluginDirectory: 'templates',
        generate: function(types, generator) {}
      });
      assert(response instanceof plugin.Plugin);
    });
  });

  describe('.loadPlugin', () => {
    it('should load the specified instance of Plugin', () => {
      var response = typhen.loadPlugin('./test/fixtures/plugin/typhen-test');
      var expected = process.cwd() + '/test/fixtures/plugin';
      assert(response instanceof plugin.Plugin);
      assert(response.pluginDirectory === expected);
    });
  });
});
