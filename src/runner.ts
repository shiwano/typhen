/// <reference path="../typings/tsd.d.ts" />

import _ = require('lodash');
import tss = require('typescript-services-api');
import chalk = require('chalk');
import Promise = require('bluebird');
import Vinyl = require('vinyl');

import Plugin = require('./plugin');
import Config = require('./config');
import Logger = require('./logger');
import CompilerHost = require('./compiler_host');
import Generator = require('./generator');
import TypeScriptParser = require('./typescript_parser');

export interface IAliasesOptions {
  [index: string]: string;
}

export class Runner {
  public config: Config.Config;
  public plugin: Plugin.Plugin;
  public compilerHost: CompilerHost;
  public compilerOptions: tss.ts.CompilerOptions;

  constructor(config: Config.Config) {
    this.config = config;
    this.plugin = config.plugin;

    this.compilerHost = new CompilerHost(this.config.env);
    this.compilerOptions = {
      declaration: true,
      diagnostics: true,
      emitBOM: false,
      module: tss.ts.ModuleKind.CommonJS,
      noImplicitAny: true,
      target: tss.ts.ScriptTarget.ES5,
      noLib: false,
      noLibCheck: false
    };
  }

  public run(): Promise<Vinyl[]> {
    return new Promise<Vinyl[]>((resolve: (r: Vinyl[]) => void, reject: (e: Error) => void) => {
      Logger.log(Logger.underline('Parsing TypeScript files'));
      var parser = new TypeScriptParser([this.config.src], this);
      parser.parse();
      parser.sourceFiles.forEach(sourceFile => {
        var fileName = sourceFile.filename.replace(this.config.env.currentDirectory + '/', '');
        Logger.info('Parsed', Logger.cyan(fileName));
      });

      Logger.log(Logger.underline('Generating files'));
      var generator = new Generator(this.config.env, this.config.dest,
          this.plugin.pluginDirectory, this.plugin.handlebarsOptions);
      var generateResult = this.plugin.generate(generator, parser.types);

      var afterGenerate = () => {
        generator.files.forEach(file => {
          if (!this.config.noWrite) {
            this.config.env.writeFile(file.path, file.contents);
          }
          Logger.info('Generated', Logger.cyan(file.relative));
        });
        parser.types.forEach(type => type.destroy(true));
        Logger.log('\n' + Logger.green('✓'), 'Finished successfully!');
        resolve(generator.files);
      };

      if (_.isObject(generateResult) && _.isFunction(generateResult.then)) {
        (<Promise<void>>generateResult).then(afterGenerate).catch(reject);
      } else {
        afterGenerate();
      }
    });
  }
}
