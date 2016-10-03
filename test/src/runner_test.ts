import helper = require('../test_helper');

import * as sinon from 'sinon';

import * as runner from '../../src/runner';

describe('Runner', () => {
  var sandbox = sinon.sandbox.create();
  var instance: runner.Runner;

  beforeEach(() => {
    instance = helper.createRunner();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#parse', () => {
    it('should return a ParsedResult', () => {
      var result = instance.parse();
      assert(result.types.length > 0);
      assert(result.modules.length > 0);
    });
  });

  describe('#run', () => {
    beforeEach(() => {
      sandbox.stub(instance.config.plugin, 'generate');
    });

    it('should call Plugin#generate', (done) => {
      instance.run().then(() => {
        assert((<Sinon.SinonStub>instance.config.plugin.generate).calledOnce);
        done();
      });
    });
  });
});
