import helper = require('../test_helper');

import ts = require('ff-typescript');

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
        var languageVersion = ts.ScriptTarget.ES5;
        var expected = '# test';
        assert(instance.getSourceFile('/test.d.ts', languageVersion).text === expected);
      });
    });

    context('with a file name which does not exists', () => {
      it('should return undefined', () => {
        var languageVersion = ts.ScriptTarget.ES5;
        assert(instance.getSourceFile('', languageVersion) === undefined);
      });
    });
  });

  describe('#getDefaultLibFileName', () => {
    it('should return the defaultLibFileName', () => {
      assert(instance.getDefaultLibFileName() === 'lib.typhen.d.ts');
    });
  });

  describe('#writeFile', () => {
    beforeEach(() => {
      sandbox.stub(env, 'writeFile');
    });

    it('should not write a file', () => {
      instance.writeFile('invalid.ts', '', false);
      assert((<SinonStub>env.writeFile).notCalled);
    });
  });

  describe('#getCurrentDirectory', () => {
    it('should return the currentDirectory', () => {
      assert(instance.getCurrentDirectory() === env.currentDirectory);
    });
  });

  describe('#getCanonicalFileName', () => {
    context('when useCaseSensitiveFileNames is true', () => {
      beforeEach(() => {
        sandbox.stub(instance, 'useCaseSensitiveFileNames').returns(true);
      });

      it('should return the given file name', () => {
        var fileName = 'CanonicleFileName';
        assert(instance.getCanonicalFileName(fileName) === fileName);
      });
    });

    context('when useCaseSensitiveFileNames is false', () => {
      it('should return the lower cased file name', () => {
        var fileName = 'CanonicleFileName';
        var expected = 'canoniclefilename';
        assert(instance.getCanonicalFileName(fileName) === expected);
      });
    });
  });

  describe('#useCaseSensitiveFileNames', () => {
    it('should return env#useCaseSensitiveFileNames', () => {
      assert(instance.useCaseSensitiveFileNames() === false);
    });
  });

  describe('#newLine', () => {
    it('should return env#getNewLine', () => {
      assert(instance.getNewLine() === '\n');
    });
  });
});
