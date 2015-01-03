import helper = require('../test_helper');

import tss = require('typescript-services-api');

import CompilerHost = require('../../src/compiler_host');

describe('CompilerHost', () => {
  var sandbox = sinon.sandbox.create();
  var instance: CompilerHost;
  var env = new helper.TestEnvironment({
    '/test.d.ts': '# test'
  });

  beforeEach(() => {
    instance = new CompilerHost(env);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#getSourceFile', () => {
    context('with a valid file name', () => {
      it('should return the instance of SourceFile which has the specified file data', () => {
        var languageVersion = tss.ts.ScriptTarget.ES5;
        var expected = '# test';
        assert.strictEqual(instance.getSourceFile('/test.d.ts', languageVersion).text, expected);
      });
    });

    context('with a file name which does not exists', () => {
      it('should return undefined', () => {
        var languageVersion = tss.ts.ScriptTarget.ES5;
        assert.strictEqual(instance.getSourceFile('', languageVersion), undefined);
      });
    });
  });

  describe('#getDefaultLibFilename', () => {
    it('should return the defaultLibFileName', () => {
      assert.strictEqual(instance.getDefaultLibFilename(), 'lib.typhen.d.ts');
    });
  });

  describe('#writeFile', () => {
    it('should raise a error', () => {
      assert.throws(() => {
        instance.writeFile('invalid.ts', '', false);
      });
    });
  });

  describe('#getCurrentDirectory', () => {
    it('should return the currentDirectory', () => {
      assert.strictEqual(instance.getCurrentDirectory(), env.currentDirectory);
    });
  });

  describe('#getCanonicalFileName', () => {
    context('when useCaseSensitiveFileNames is true', () => {
      beforeEach(() => {
        sandbox.stub(instance, 'useCaseSensitiveFileNames').returns(true);
      });

      it('should return the given file name', () => {
        var fileName = 'CanonicleFileName';
        assert.strictEqual(instance.getCanonicalFileName(fileName), fileName);
      });
    });

    context('when useCaseSensitiveFileNames is false', () => {
      it('should return the lower cased file name', () => {
        var fileName = 'CanonicleFileName';
        var expected = 'canoniclefilename';
        assert.strictEqual(instance.getCanonicalFileName(fileName), expected);
      });
    });
  });

  describe('#useCaseSensitiveFileNames', () => {
    it('should return env#useCaseSensitiveFileNames', () => {
      assert.strictEqual(instance.useCaseSensitiveFileNames(), false);
    });
  });

  describe('#newLine', () => {
    it('should return env#getNewLine', () => {
      assert.strictEqual(instance.getNewLine(), '\n');
    });
  });
});
