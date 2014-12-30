require('../test_helper');

import Handlebars = require('handlebars');
import Swag = require('swag');

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
      sandbox.stub(Swag, 'registerHelpers');
      LocalHandlebars.registerHelpers(Handlebars);
    });

    it('should register all helpers to Handlebars', () => {
      var handlebarStub = (<SinonStub>Handlebars.registerHelper);
      var swagStub = (<SinonStub>Swag.registerHelpers);

      assert(swagStub.calledWith(Handlebars));
      assert.deepEqual(handlebarStub.args.every(a => a[1] instanceof Function), true);
      assert.deepEqual(handlebarStub.args.map(a => a[0]), [
        'underscore',
        'upperCamelCase',
        'lowerCamelCase'
      ]);
    });
  });
});
