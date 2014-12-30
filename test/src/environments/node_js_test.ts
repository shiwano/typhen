require('../../test_helper');

import fs = require('fs');

import NodeJsEnvironment = require('../../../src/environments/node_js');

describe('NodeJsEnvironment', () => {
  var sandbox = sinon.sandbox.create();
  var instance: NodeJsEnvironment;
  var currentDirectory = process.cwd() + '/test/fixtures/typings';
  var newLine = '\n';

  beforeEach(() => {
    instance = new NodeJsEnvironment(currentDirectory, newLine);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should have currentDirectory', () => {
    assert.strictEqual(instance.currentDirectory, currentDirectory);
  });

  it('should have newLine', () => {
    assert.strictEqual(instance.newLine, newLine);
  });

  it('should have defaultLibFileName', () => {
    assert.strictEqual(instance.defaultLibFileName, process.cwd() + '/.tmp/lib.typhen.d.ts');
  });

  describe('#writeFile', () => {
    beforeEach(() => {
      sandbox.stub(fs, 'writeFileSync');
    });

    it('should call fs#writeFileSync', () => {
      instance.writeFile('invalid.js', '');
      assert.strictEqual((<SinonStub>fs.writeFileSync).calledOnce, true);
    });
  });

  describe('#readFile', () => {
    beforeEach(() => {
      sandbox.stub(fs, 'readFileSync').returns('a');
    });

    it('should return the file text', () => {
      assert.strictEqual(instance.readFile('invalid.js'), 'a');
    });
    it('should call fs#readFileSync', () => {
      instance.readFile('invalid.js');
      assert.strictEqual((<SinonStub>fs.readFileSync).calledOnce, true);
    });
  });

  describe('#resolvePath', () => {
    it('should return the resolved path', () => {
      var expected = currentDirectory + '/test/resolve.ts';
      assert.strictEqual(instance.resolvePath('test', 'resolve.ts'), expected);
    });
  });

  describe('#exists', () => {
    beforeEach(() => {
      sandbox.stub(fs, 'existsSync').returns(true);
    });

    it('should call fs#existsSync', () => {
      instance.exists('invalid.js');
      assert.strictEqual((<SinonStub>fs.existsSync).calledOnce, true);
    });
  });
});
