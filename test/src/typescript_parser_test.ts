import helper = require('../test_helper');

import tss = require('typescript-services-api');

import TypeScriptParser = require('../../src/typescript_parser');
import Symbol = require('../../src/symbol');

describe('TypeScriptParser', () => {
  var instance: TypeScriptParser;

  var definitionPath = 'test/fixtures/typings/definitions.d.ts';
  var colorPath = 'test/fixtures/typings/color/color.d.ts';

  var runner = helper.createRunner();

  beforeEach(() => {
    instance = new TypeScriptParser([definitionPath], runner);
  });

  describe('#sourceFiles', () => {
    beforeEach(() => {
      instance.parse();
    });

    it('should return loaded instances of ts.SourceFile', () => {
      var expected = [colorPath, definitionPath];
      assert.deepEqual(instance.sourceFiles.map(d => d.filename), expected);
    });
  });

  describe('#types', () => {
    beforeEach(() => {
      instance.parse();
    });

    it('should return the parsed types', () => {
      assert.deepEqual(
          instance.types.map(t => t.fullName),
          [
            // Array
            'Line[]',
            // Tuple
            'NumberAndNumberTuple',
            // Function
            'Rpc.Get.getRange',
            'Rpc.Post.setOptions',
            'Type.ColoredSquareSetColorCallbackFunction',
            'Type.LineSetColorCallbackFunction',
            'emitLog',
            // ObjectType
            'Rpc.Get.GetRangeObject',
            'Rpc.Post.SetOptionsOptionsObject',
            // Enum
            'Type.Color',
            // Interface
            'Type.ColoredSquare',
            'Type.Point',
            'Type.Range',
            'Type.RangeWithNumber',
            'Type.Square',
            'Type.SquareDictionary',
            'Type.Transformer',
            // Class
            'Type.Line',
            'Type.LineDrawer',
            // TypeParameter
            'Type.T',
            'Type.T',
            // PrimitiveType
            'boolean',
            'integer',
            'number',
            'string',
            'void',
            'any'
          ].sort()
      );
    });
  });

  describe('#modules', () => {
    beforeEach(() => {
      instance.parse();
    });

    it('should return the parsed modules', () => {
      assert.deepEqual(
        instance.modules.map(t => t.fullName),
        ['Global', 'Rpc.Get', 'Rpc.Post', 'Rpc', 'Type'].sort()
      );
    });
  });

  describe('#parse', () => {
    it('should parse the TypeScript types', () => {
      assert(instance.types.length === 0);
      instance.parse();
      assert(instance.types.length > 0);
    });
  });

  describe('#validate', () => {
    beforeEach(() => {
      instance.parse();
    });

    afterEach(() => {
      runner.config.disallow = {};
    });

    context('in general', () => {
      it('should not throw an error', () => {
        assert.doesNotThrow(() => instance.validate());
      });
    });

    context('when dissalow#any is true', () => {
      beforeEach(() => {
        runner.config.disallow.any = true;
      });
      it('should throw an error', () => {
        assert.throws(() => instance.validate(), /any type/);
      });
    });

    context('when dissalow#tuple is true', () => {
      beforeEach(() => {
        runner.config.disallow.tuple = true;
      });
      it('should throw an error', () => {
        assert.throws(() => instance.validate(), /tuple type/);
      });
    });

    context('when dissalow#generics is true', () => {
      beforeEach(() => {
        runner.config.disallow.generics = true;
      });
      it('should throw an error', () => {
        assert.throws(() => instance.validate(), /generics/);
      });
    });

    context('when dissalow#overload is true', () => {
      beforeEach(() => {
        runner.config.disallow.overload = true;
      });
      it('should throw an error', () => {
        assert.throws(() => instance.validate(), /overload/);
      });
    });
  });
});
