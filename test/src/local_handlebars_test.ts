import '../test_helper';

import * as Handlebars from 'handlebars';

import * as helpers from '../../src/helpers';
import * as localHandlebars from '../../src/local_handlebars';

describe('localHandlebars', () => {
  var sandbox = sinon.sandbox.create();

  afterEach(() => {
    sandbox.restore();
  });

  describe('.HandlebarsHelpers', () => {
    describe('.and', () => {
      context('with truthy values', () => {
        it('should call options#fn', () => {
          var options = { fn: sandbox.stub().returns('fn'), inverse: sandbox.stub().returns('inverse') };
          var response = localHandlebars.HandlebarsHelpers.and(true, ['foo'], 'bar', options);
          assert(response === 'fn');
        });
      });

      context('with falsy values', () => {
        it('should call options#inverse', () => {
          var options = { fn: sandbox.stub().returns('fn'), inverse: sandbox.stub().returns('inverse') };
          var response = localHandlebars.HandlebarsHelpers.and(true, [], 'bar', options);
          assert(response === 'inverse');
        });
      });
    });

    describe('.or', () => {
      context('with truthy values', () => {
        it('should call options#fn', () => {
          var options = { fn: sandbox.stub().returns('fn'), inverse: sandbox.stub().returns('inverse') };
          var response = localHandlebars.HandlebarsHelpers.or(false, [], 0, options);
          assert(response === 'fn');
        });
      });

      context('with falsy values', () => {
        it('should call options#inverse', () => {
          var options = { fn: sandbox.stub().returns('fn'), inverse: sandbox.stub().returns('inverse') };
          var response = localHandlebars.HandlebarsHelpers.or(false, [], '', options);
          assert(response === 'inverse');
        });
      });
    });

    describe('.underscore', () => {
      it('should call Helpers.underscore', () => {
        var spy = sandbox.spy(helpers, 'underscore');
        localHandlebars.HandlebarsHelpers.underscore('App.FooBar.Qux');
        assert(spy.calledWith('App.FooBar.Qux'));
      });
    });

    describe('.upperCamelCase', () => {
      it('should call Helpers.upperCamelCase', () => {
        var spy = sandbox.spy(helpers, 'upperCamelCase');
        localHandlebars.HandlebarsHelpers.upperCamelCase('app.foo_bar.qux');
        assert(spy.calledWith('app.foo_bar.qux'));
      });
    });

    describe('.lowerCamelCase', () => {
      it('should call Helpers.lowerCamelCase', () => {
        var spy = sandbox.spy(helpers, 'lowerCamelCase');
        localHandlebars.HandlebarsHelpers.lowerCamelCase('app.foo_bar.qux');
        assert(spy.calledWith('app.foo_bar.qux'));
      });
    });

    describe('.pluralize', () => {
      it('should call Helpers.pluralize', () => {
        var spy = sandbox.spy(helpers, 'pluralize');
        localHandlebars.HandlebarsHelpers.pluralize('person');
        assert(spy.calledWith('person'));
      });
    });

    describe('.singularize', () => {
      it('should call Helpers.singularize', () => {
        var spy = sandbox.spy(helpers, 'singularize');
        localHandlebars.HandlebarsHelpers.singularize('people');
        assert(spy.calledWith('people'));
      });
    });

    describe('.defaultValue', () => {
      context('with existing value', () => {
        it('should return value', () => {
          assert(localHandlebars.HandlebarsHelpers.defaultValue('value', 'defaultValue') === 'value');
        });
      });

      context('with no existing value', () => {
        it('should return default value', () => {
          assert(localHandlebars.HandlebarsHelpers.defaultValue(null, 'defaultValue') === 'defaultValue');
          assert(localHandlebars.HandlebarsHelpers.defaultValue(undefined, 'defaultValue') === 'defaultValue');
        });
      });
    });
  });

  describe('.handlebars', () => {
    it('should export local handlebars', () => {
      assert(localHandlebars.handlebars.registerHelper);
      assert(localHandlebars.handlebars !== Handlebars);
    });
  });

  describe('.registerHelpers', () => {
    beforeEach(() => {
      sandbox.stub(Handlebars, 'registerHelper');
      localHandlebars.registerHelpers(Handlebars);
    });

    it('should register all helpers to Handlebars', () => {
      var handlebarStub = (<Sinon.SinonStub>Handlebars.registerHelper);

      assert.deepEqual(handlebarStub.args.every(a => a[1] instanceof Function), true);
      assert.deepEqual(handlebarStub.args.map(a => a[0]), Object.keys(localHandlebars.HandlebarsHelpers));
    });
  });
});
