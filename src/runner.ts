import * as _ from 'lodash';
import * as ts from 'typescript';
import * as Promise from 'bluebird';
import Vinyl = require('vinyl');

import * as config from './config';
import * as logger from './logger';
import Generator from './generator';
import TypeScriptParser from './typescript_parser';

export default class Runner {
  constructor(public config: config.Config) {}

  run(): Promise<Vinyl[]> {
    return new Promise<Vinyl[]>((resolve, reject) => {
      logger.log(logger.underline('Parsing TypeScript files'));
      let parser = new TypeScriptParser(this.config.src, this.config);
      parser.parse();
      parser.validate();
      parser.sourceFiles.forEach(sourceFile => {
        let relative = this.config.env.relativePath(sourceFile.fileName);
        logger.info('Parsed', logger.cyan(relative));
      });

      logger.log(logger.underline('Generating files'));

      let generator = new Generator(this.config.env, this.config.dest,
          this.config.plugin.pluginDirectory, this.config.plugin.handlebarsOptions);
      let generateResult = this.config.plugin.generate(generator, parser.types, parser.modules);

      let afterGenerate = () => {
        generator.files.forEach(file => {
          if (!this.config.noWrite) {
            this.config.env.writeFile(file.path, file.contents.toString());
          }
          let relative = this.config.env.relativePath(file.path);
          logger.info('Generated', logger.cyan(relative));
        });
        parser.types.forEach(t => t.destroy(true));
        parser.modules.forEach(m => m.destroy(true));
        logger.log('\n' + logger.green('✓'), 'Finished successfully!');
        resolve(generator.files);
      };

      if (_.isObject(generateResult) && typeof (<any>generateResult).then === 'function') {
        (<Promise<void>>generateResult).then(afterGenerate).catch(reject);
      } else {
        afterGenerate();
      }
    });
  }
}
