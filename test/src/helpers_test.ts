import '../test_helper';

import * as helpers from '../../src/helpers';

describe('helpers', () => {
  describe('.underscore', () => {
    it('should return a underscored string', () => {
      assert(helpers.underscore('App1.FooBar.Qux') === 'app1.foo_bar.qux');
    });
  });

  describe('.upperCamelCase', () => {
    it('should return a upperCamelCaseed string', () => {
      assert(helpers.upperCamelCase('app1.foo_bar.qux') === 'App1.FooBar.Qux');
    });
  });

  describe('.lowerCamelCase', () => {
    it('should return a lowerCamelCaseed string', () => {
      assert(helpers.lowerCamelCase('app1.foo_bar.qux') === 'app1.fooBar.qux');
    });
  });

  describe('.pluralize', () => {
    it('should return a pluralized string', () => {
      assert(helpers.pluralize('person') === 'people');
    });
  });

  describe('.singularize', () => {
    it('should return a singularized string', () => {
      assert(helpers.singularize('people') === 'person');
    });
  });
});
