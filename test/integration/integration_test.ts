import '../test_helper';

import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';
import * as _ from 'lodash';
import * as glob from 'glob';
import * as rimraf from 'rimraf';
import Vinyl = require('vinyl');

import * as typhen from '../../src/index';
import * as logger from '../../src/logger';

function addTestSuite(expectedFileNames: string[]) {
  expectedFileNames.forEach((expectedFileName) => {
    it('should generate ' + expectedFileName.replace('./test/fixtures/generated/', ''), (done) => {
      var actualFileName = expectedFileName.replace('./test/fixtures', './.tmp');

      fs.readFile(expectedFileName, {encoding: 'utf-8'}, (error, expected) => {
        fs.readFile(actualFileName, {encoding: 'utf-8'}, (error, actual) => {
          // for tsconfig.json context that has the different current working directory.
          actual = actual.replace(/test\/fixtures\/?/g, '');
          expected = expected.replace(/test\/fixtures\/?/g, '');

          assert(actual === expected);
          done();
        });
      });
    });
  });

  it('should generate specific files only', () => {
    var actualFileNames = glob.sync('./.tmp/generated/**/*.md')
       .map(f => f.replace('./.tmp', './test/fixtures'));
    actualFileNames.sort();
    assert.deepEqual(actualFileNames, expectedFileNames);
  });
}

describe('Integration Test', () => {
  let logLevelCache: logger.LogLevel;

  before(() => {
    logLevelCache = logger.level;
    logger.setLevel(logger.LogLevel.Silent);
  });

  after(() => {
    logger.setLevel(logLevelCache);
  });

  describe('typhen-test plugin', () => {
    var expectedFileNames = glob.sync('./test/fixtures/generated/**/*.md');
    expectedFileNames.sort();

    context('via JavaScript code', () => {
      var generatedFiles: Vinyl[];

      before((done) => {
        rimraf('./.tmp/generated', () => {
          typhen.run({
            plugin: typhen.loadPlugin('./test/fixtures/plugin/typhen-test', {
              author: 'shiwano'
            }),
            src: 'test/fixtures/typings/integration/index.d.ts',
            dest: '.tmp/generated',
            compilerOptions: {
              experimentalDecorators: true
            }
          }).done((files) => {
            generatedFiles = files;
            done();
          }, (e) => {
            throw e;
          });
        });
      });

      addTestSuite(expectedFileNames);

      it('should return generated vinyl files on then callback', () => {
        var actualFileNames = generatedFiles.map(f => './test/fixtures/generated/' + f.relative);
        actualFileNames.sort();
        assert.deepEqual(actualFileNames, expectedFileNames);
      });
    });

    context('via bin', () => {
      before((done) => {
        rimraf('./.tmp/generated', () => {
          var command = childProcess.spawn('bin/typhen', [
            '--plugin', 'test/fixtures/plugin/typhen-test',
            '--plugin-options', '{"author": "shiwano"}',
            '--compiler-options', '{"experimentalDecorators": true}',
            '--dest', '.tmp/generated',
            '--__main', '.tmp/src/index',
            'test/fixtures/typings/integration/index.d.ts'
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

    context('via tsconfig.json', () => {
      before((done) => {
        rimraf('./.tmp/generated', () => {
          var command = childProcess.spawn('bin/typhen', [
            '--__main', '.tmp/src/index',
            'test/fixtures/tsconfig.json'
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
