import '../../test_helper';

import * as fs from 'fs';
import * as path from 'path';
import * as pathExists from 'path-exists';
import * as glob from 'glob';
import * as ts from 'typescript';
import * as assert from 'power-assert';
import * as Sinon from 'sinon';
import * as _ from 'lodash';

import NodeJsEnvironment from '../../../src/environments/node_js';

describe('NodeJsEnvironment', () => {
  const sandbox = Sinon.sandbox.create();
  let instance: NodeJsEnvironment;
  const currentDirectory = process.cwd() + '/test/fixtures/typings';
  const newLine = '\n';

  beforeEach(() => {
    instance = new NodeJsEnvironment(currentDirectory, newLine, ts.ScriptTarget.ES5);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should have currentDirectory', () => {
    assert(instance.currentDirectory === currentDirectory);
  });

  it('should have newLine', () => {
    assert(instance.newLine === newLine);
  });

  it('should have defaultLibFileName', () => {
    const typeScriptDir = path.dirname(require.resolve('typescript'));
    assert(_.startsWith(instance.defaultLibFileName, typeScriptDir));
  });

  describe('#writeFile', () => {
    beforeEach(() => {
      sandbox.stub(fs, 'writeFileSync');
    });

    it('should call fs#writeFileSync', () => {
      instance.writeFile('invalid.js', '');
      assert((<Sinon.SinonStub>fs.writeFileSync).calledOnce);
    });
  });

  describe('#readFile', () => {
    beforeEach(() => {
      sandbox.stub(fs, 'readFileSync').returns('a');
    });

    it('should return the file text', () => {
      assert(instance.readFile('invalid.js') === 'a');
    });
    it('should call fs#readFileSync', () => {
      instance.readFile('invalid.js');
      assert((<Sinon.SinonStub>fs.readFileSync).calledOnce);
    });
  });

  describe('#resolvePath', () => {
    it('should return the resolved path', () => {
      const expected = currentDirectory + '/test/resolve.ts';
      assert(instance.resolvePath('test', 'resolve.ts') === expected);
    });
  });

  describe('#relativePath', () => {
    it('should return the relative path', () => {
      assert(instance.relativePath(currentDirectory + '/test/resolve.ts') === 'test/resolve.ts');
      assert(instance.relativePath('/test', '/test/resolve.ts') === 'resolve.ts');
    });
  });

  describe('#dirname', () => {
    it('should return the directory name', () => {
      assert(instance.dirname('/test/index.ts') === '/test');
    });
  });

  describe('#exists', () => {
    beforeEach(() => {
      sandbox.stub(pathExists, 'sync').returns(true);
    });

    it('should call pathExists#sync', () => {
      instance.exists('invalid.js');
      assert((<Sinon.SinonStub>pathExists.sync).calledOnce);
    });
  });

  describe('#getDirectories', () => {
    beforeEach(() => {
      sandbox.stub(fs, 'readdirSync').returns(['baz']);
      sandbox.stub(fs, 'statSync').returns({
        isDirectory: () => true
      });
    });

    it('should return sub directory paths', () => {
      assert.deepEqual(instance.getDirectories('foo/bar'), ['foo/bar/baz']);
    });
  });

  describe('#getDefaultLibFileData', () => {
    it('should return the joined defaultLibFile data', () => {
      const actual = instance.getDefaultLibFileData();
      const expected = fs.readFileSync(process.cwd() + '/node_modules/typescript/lib/lib.d.ts', 'utf-8');
      assert(actual === expected);
    });
  });

  describe('#glob', () => {
    beforeEach(() => {
      sandbox.stub(glob, 'sync').returns(['test/test.ts']);
    });

    it('should call glob', () => {
      assert.deepEqual(instance.glob('test/**/*.ts', 'test'), ['test/test.ts']);
      assert((<Sinon.SinonStub>glob.sync).calledWith('test/**/*.ts', {
        cwd: 'test',
        nodir: true
      }));
    });

    context('with no cwd', () => {
      it('should set currentDirectory as cwd', () => {
        instance.glob('test/**/*.ts');
        assert((<Sinon.SinonStub>glob.sync).calledWith('test/**/*.ts', {
          cwd: instance.currentDirectory,
          nodir: true
        }));
      });
    });
  });

  describe('#eval', () => {
    it('should eval the code safely', () => {
      assert(instance.eval('function() { return "foobar"; }')() === 'foobar');
    });
  });
});
