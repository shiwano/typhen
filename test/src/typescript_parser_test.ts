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
          instance.types.map(t => t.fullName).sort(),
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
            'void'
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
        instance.modules.map(t => t.name).sort(),
        ['', 'Get', 'Post', 'Rpc', 'Type'].sort()
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
});
