import '../test_helper';

import * as Handlebars from 'handlebars';
import * as assert from 'power-assert';
import * as Sinon from 'sinon';

import * as helpers from '../../src/helpers';
import * as localHandlebars from '../../src/local_handlebars';

describe('localHandlebars', () => {
  const sandbox = Sinon.sandbox.create();

  afterEach(() => {
    sandbox.restore();
  });

  describe('.HandlebarsHelpers', () => {
    describe('.and', () => {
      context('with truthy values', () => {
        it('should call options#fn', () => {
          const options = { fn: sandbox.stub().returns('fn'), inverse: sandbox.stub().returns('inverse') };
          const response = localHandlebars.HandlebarsHelpers.and(true, ['foo'], 'bar', options);
          assert(response === 'fn');
        });
      });

      context('with falsy values', () => {
        it('should call options#inverse', () => {
          const options = { fn: sandbox.stub().returns('fn'), inverse: sandbox.stub().returns('inverse') };
          const response = localHandlebars.HandlebarsHelpers.and(true, [], 'bar', options);
          assert(response === 'inverse');
        });
      });
    });

    describe('.or', () => {
      context('with truthy values', () => {
        it('should call options#fn', () => {
          const options = { fn: sandbox.stub().returns('fn'), inverse: sandbox.stub().returns('inverse') };
          const response = localHandlebars.HandlebarsHelpers.or(false, [], 0, options);
          assert(response === 'fn');
        });
      });

      context('with falsy values', () => {
        it('should call options#inverse', () => {
          const options = { fn: sandbox.stub().returns('fn'), inverse: sandbox.stub().returns('inverse') };
          const response = localHandlebars.HandlebarsHelpers.or(false, [], '', options);
          assert(response === 'inverse');
        });
      });
    });

    describe('.underscore', () => {
      it('should call Helpers.underscore', () => {
        const spy = sandbox.spy(helpers, 'underscore');
        localHandlebars.HandlebarsHelpers.underscore('App.FooBar.Qux');
        assert(spy.calledWith('App.FooBar.Qux'));
      });
    });

    describe('.upperCamel', () => {
      it('should call Helpers.upperCamelCase', () => {
        const spy = sandbox.spy(helpers, 'upperCamelCase');
        localHandlebars.HandlebarsHelpers.upperCamel('app.foo_bar.qux');
        assert(spy.calledWith('app.foo_bar.qux'));
      });
    });

    describe('.upperCamelCase', () => {
      it('should call Helpers.upperCamelCase', () => {
        const spy = sandbox.spy(helpers, 'upperCamelCase');
        localHandlebars.HandlebarsHelpers.upperCamelCase('app.foo_bar.qux');
        assert(spy.calledWith('app.foo_bar.qux'));
      });
    });

    describe('.lowerCamel', () => {
      it('should call Helpers.lowerCamelCase', () => {
        const spy = sandbox.spy(helpers, 'lowerCamelCase');
        localHandlebars.HandlebarsHelpers.lowerCamel('app.foo_bar.qux');
        assert(spy.calledWith('app.foo_bar.qux'));
      });
    });

    describe('.lowerCamelCase', () => {
      it('should call Helpers.lowerCamelCase', () => {
        const spy = sandbox.spy(helpers, 'lowerCamelCase');
        localHandlebars.HandlebarsHelpers.lowerCamelCase('app.foo_bar.qux');
        assert(spy.calledWith('app.foo_bar.qux'));
      });
    });

    describe('.pluralize', () => {
      it('should call Helpers.pluralize', () => {
        const spy = sandbox.spy(helpers, 'pluralize');
        localHandlebars.HandlebarsHelpers.pluralize('person');
        assert(spy.calledWith('person'));
      });
    });

    describe('.singularize', () => {
      it('should call Helpers.singularize', () => {
        const spy = sandbox.spy(helpers, 'singularize');
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
          assert(localHandlebars.HandlebarsHelpers.defaultValue('', 'defaultValue') === 'defaultValue');
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
      const handlebarStub = (<Sinon.SinonStub>Handlebars.registerHelper);

      assert.deepEqual(handlebarStub.args.every(a => a[1] instanceof Function), true);
      assert.deepEqual(handlebarStub.args.map(a => a[0]), Object.keys(localHandlebars.HandlebarsHelpers));
    });
  });
});
