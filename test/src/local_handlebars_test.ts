require('../test_helper');

import Handlebars = require('handlebars');
import LocalHandlebars = require('../../src/local_handlebars');

describe('LocalHandlebars', () => {
  var sandbox = sinon.sandbox.create();

  afterEach(() => {
    sandbox.restore();
  });

  describe('.handlebars', () => {
    it('should export local handlebars', () => {
      assert(LocalHandlebars.handlebars.registerHelper);
      assert.notEqual(LocalHandlebars.handlebars, Handlebars);
    });
  });

  describe('.registerHelpers', () => {
    beforeEach(() => {
      sandbox.stub(Handlebars, 'registerHelper');
      LocalHandlebars.registerHelpers(Handlebars);
    });

    it('should register all helpers to Handlebars', () => {
      var stub = (<SinonStub>Handlebars.registerHelper);

      assert.deepEqual(stub.args.every(a => a[1] instanceof Function), true);
      assert.deepEqual(stub.args.map(a => a[0]), [
        'underscore',
        'upperCamelCase',
        'lowerCamelCase'
      ]);
    });
  });
});
