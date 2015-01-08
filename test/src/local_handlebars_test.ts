require('../test_helper');

import Handlebars = require('handlebars');
import Swag = require('swag');

import LocalHandlebars = require('../../src/local_handlebars');

describe('LocalHandlebars', () => {
  var sandbox = sinon.sandbox.create();

  afterEach(() => {
    sandbox.restore();
  });

  describe('.HandlebarsHelpers', () => {
    describe('.underscore', () => {
      it('should return a underscored string', () => {
        assert(LocalHandlebars.HandlebarsHelpers.underscore('App.FooBar.Qux') === 'app.foo_bar.qux');
      });
    });

    describe('.upperCamelCase', () => {
      it('should return a upperCamelCaseed string', () => {
        assert(LocalHandlebars.HandlebarsHelpers.upperCamelCase('app.foo_bar.qux') === 'App.FooBar.Qux');
      });
    });

    describe('.lowerCamelCase', () => {
      it('should return a lowerCamelCaseed string', () => {
        assert(LocalHandlebars.HandlebarsHelpers.lowerCamelCase('app.foo_bar.qux') === 'app.fooBar.qux');
      });
    });
  });

  describe('.handlebars', () => {
    it('should export local handlebars', () => {
      assert(LocalHandlebars.handlebars.registerHelper);
      assert(LocalHandlebars.handlebars !== Handlebars);
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
