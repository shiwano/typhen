require('../test_helper');

import fs = require('fs');
import childProcess = require('child_process');
import glob = require('glob');
import rimraf = require('rimraf');

import Typhen = require('../../src/index');

function addTestSuite(expectedFileNames: string[]) {
  expectedFileNames.forEach((expectedFileName) => {
    it('should generate ' + expectedFileName.replace('./test/fixtures/generated/', ''), (done) => {
      var actualFileName = expectedFileName.replace('./test/fixtures', './.tmp');

      fs.readFile(expectedFileName, {encoding: 'utf-8'}, (error, expected) => {
        fs.readFile(actualFileName, {encoding: 'utf-8'}, (error, actual) => {
          assert.strictEqual(actual, expected);
          done();
        });
      });
    });
  });

  it('should generate specific files only', () => {
    var actualFileNames = glob.sync('./.tmp/generated/**/*.md')
       .map(f => f.replace('./.tmp', './test/fixtures'));
    assert.deepEqual(actualFileNames, expectedFileNames);
  });
}

describe('Integration Test', () => {
  describe('typhen-test plugin', () => {
    var expectedFileNames = glob.sync('./test/fixtures/generated/**/*.md');

    context('via JavaScript code', () => {
      before((done) => {
        rimraf('./.tmp/generated', () => {
          var plugin = Typhen.loadPlugin('./test/fixtures/plugin/typhen-test', {
            author: 'shiwano'
          });
          Typhen.run({
            plugin: plugin,
            src: 'test/fixtures/typings/definitions.d.ts',
            dest: '.tmp/generated'
          });
          done();
        });
      });

      addTestSuite(expectedFileNames);
    });

    context('via bin', () => {
      before((done) => {
        rimraf('./.tmp/generated', () => {
          var command = childProcess.spawn('bin/typhen', [
            '--plugin', 'test/fixtures/plugin/typhen-test',
            '--plugin-options', '{"author": "shiwano"}',
            '--dest', '.tmp/generated',
            '--__main', '.tmp/src/index',
            'test/fixtures/typings/definitions.d.ts'
          ], {
            cwd: process.cwd()
          });
          command.stderr.on('data', (d: Buffer) => console.log(d.toString()));
          command.on('close', () => done());
        });
      });

      addTestSuite(expectedFileNames);
    });

    context('via typhenfile.js', () => {
      before((done) => {
        rimraf('./.tmp/generated', () => {
          var command = childProcess.spawn('bin/typhen', [
            '--__main', '.tmp/src/index',
            'test/fixtures/typhenfile.js'
          ], {
            cwd: process.cwd()
          });
          command.stderr.on('data', (d: Buffer) => console.log(d.toString()));
          command.on('close', () => done());
        });
      });

      addTestSuite(expectedFileNames);
    });
  });
});
