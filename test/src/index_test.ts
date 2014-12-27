require('../test_helper');

import Typhen = require('../../src/index');
import Plugin = require('../../src/plugin');

describe('Typhen', () => {
  describe('#createPlugin', () => {
    it('should create the instance of Plugin', () => {
      var response = Typhen.createPlugin({
        pluginDirectory: 'templates',
        generate: function(types, generator) {}
      });
      assert(response instanceof Plugin.Plugin);
    });
  });

  describe('#loadPlugin', () => {
    it('should load the specified instance of Plugin', () => {
      var response = Typhen.loadPlugin('./test/fixtures/plugin/typhen-test');
      var expected = process.cwd() + '/test/fixtures/plugin/lib.d.ts';
      assert(response instanceof Plugin.Plugin);
      assert.strictEqual(response.defaultLibFileName, expected);
    });
  });
});
