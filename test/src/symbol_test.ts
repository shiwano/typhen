import helper = require('../test_helper');

import * as assert from 'power-assert';

import * as config from '../../src/config';
import * as symbol from '../../src/symbol';

describe('symbol', () => {
  it('should export symbols for compiling', () => {
    assert(symbol.Enum);
    assert(symbol.Interface);
  });

  describe('.Enum', () => {
    let instance: symbol.Enum;

    beforeEach(() => {
      const config = helper.createConfig();
      instance = helper.createEnum(config);
    });

    describe('#constructor', () => {
      it('should have isEnum', () => assert(instance.isEnum === true));
      it('should have name', () => assert(instance.name === 'FooType'));
      it('should have fullName', () => assert(instance.fullName === 'App.Type.FooType'));
      it('should have namespace', () => assert(instance.namespace === 'App.Type'));
      it('should have comment', () => assert(instance.comment === 'awesome'));
      it('should have members', () => {
        assert.deepEqual(instance.members.map(m => m.name), ['Bar', 'Baz']);
        instance.members.forEach(m => {
          assert(m instanceof symbol.EnumMember);
        });
      });
      it('should have tags', () => {
        assert(instance.tags.length === 5);
        assert(instance.tagTable['default'].value === 'FooType.Bar');
        assert(instance.tagTable['type'].value === 'Enum');
        assert(instance.tagTable['number'].number === 10);
        assert(instance.tagTable['true'].boolean);
        assert(!instance.tagTable['false'].boolean);
      });

      context('when it has assumedName', () => {
        beforeEach(() => {
          const config = helper.createConfig();
          instance = helper.createEnum(config, 'SuperFooEnum');
        });

        it('should return assumedName as name', () => {
          assert(instance.name === 'SuperFooEnum');
        });
      });
    });

    describe('#destroy', () => {
      it('should delete own properties', () => {
        instance.destroy(true);
        assert(instance.rawName === undefined);
        assert(instance.members === undefined);
      });
    });
  });
});
