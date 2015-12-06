import '../test_helper';

import * as Promise from 'bluebird';

import * as typhen from '../../src/index';
import * as plugin from '../../src/plugin';
import * as symbol from '../../src/symbol';
import * as logger from '../../src/logger';
import * as helpers from '../../src/helpers';

describe('typhen', () => {
  var sandbox = sinon.sandbox.create();

  afterEach(() => {
    sandbox.restore();
  });

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

  describe('.runByTSConfig', () => {
    beforeEach(() => {
      sandbox.stub(typhen, 'loadPlugin').returns(null);
      sandbox.stub(typhen, 'run').returns(Promise.resolve([]));
      typhen.runByTSConfig(process.cwd() + '/test/fixtures/tsconfig.json');
    });

    it('should call .loadPlugin with values in tsconfig.json', () => {
      assert((<Sinon.SinonStub>typhen.loadPlugin).calledOnce);
      assert((<Sinon.SinonStub>typhen.loadPlugin).args[0][0], 'test/fixtures/plugin/typhen-test');
    });

    it('should call .run with values in tsconfig.json', () => {
      assert((<Sinon.SinonStub>typhen.run).calledOnce);
      assert.deepEqual((<Sinon.SinonStub>typhen.run).args[0][0].src, [
        "typings/integration/index.d.ts"
      ]);
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
