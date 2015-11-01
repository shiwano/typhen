import _ = require('lodash');
import ts = require('ff-typescript');
import Promise = require('bluebird');
import Vinyl = require('vinyl');

import Config = require('./config');
import Logger = require('./logger');
import Generator = require('./generator');
import TypeScriptParser = require('./typescript_parser');

export class Runner {
  constructor(public config: Config.Config) {}

  run(): Promise<Vinyl[]> {
    return new Promise<Vinyl[]>((resolve: (r: Vinyl[]) => void, reject: (e: Error) => void) => {
      Logger.log(Logger.underline('Parsing TypeScript files'));
      var parser = new TypeScriptParser(this.config.src, this.config);
      parser.parse();
      parser.validate();
      parser.sourceFiles.forEach(sourceFile => {
        var relative = this.config.env.relativePath(sourceFile.fileName);
        Logger.info('Parsed', Logger.cyan(relative));
      });

      Logger.log(Logger.underline('Generating files'));

      var generator = new Generator(this.config.env, this.config.dest,
          this.config.plugin.pluginDirectory, this.config.plugin.handlebarsOptions);
      var generateResult = this.config.plugin.generate(generator, parser.types, parser.modules);

      var afterGenerate = () => {
        generator.files.forEach(file => {
          if (!this.config.noWrite) {
            this.config.env.writeFile(file.path, file.contents.toString());
          }
          var relative = this.config.env.relativePath(file.path);
          Logger.info('Generated', Logger.cyan(relative));
        });
        parser.types.forEach(t => t.destroy(true));
        parser.modules.forEach(m => m.destroy(true));
        Logger.log('\n' + Logger.green('✓'), 'Finished successfully!');
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
