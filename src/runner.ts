/// <reference path="../typings/tsd.d.ts" />

import tss = require('typescript-services-api');
import chalk = require('chalk');

import Plugin = require('./plugin');
import Config = require('./config');
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

    this.compilerHost = new CompilerHost(this.config.env, this.plugin.defaultLibFileName);
    this.compilerOptions = {
      declaration: true,
      diagnostics: true,
      emitBOM: false,
      module: tss.ts.ModuleKind.CommonJS,
      noImplicitAny: true,
      target: tss.ts.ScriptTarget.ES5,
      noLib: this.plugin.defaultLibFileName === undefined,
      noLibCheck: this.plugin.defaultLibFileName === undefined
    };
  }

  public run(): void {
    console.info(chalk.underline('Parsing TypeScript files'));
    var parser = new TypeScriptParser([this.config.src], this);
    parser.parse();
    parser.sourceFiles.forEach(sourceFile => {
      var fileName = sourceFile.filename.replace(this.config.env.currentDirectory + '/', '');
      console.info(chalk.green('>>') + ' File ' + chalk.cyan(fileName) + ' parsed.');
    });

    console.info(chalk.underline('Generating files'));
    var generator = new Generator(this.config.dest, this.config.env, this.plugin.env,
        this.plugin.handlebarsOptions, (fileName) => {
          fileName = fileName.replace(this.config.env.currentDirectory + '/', '');
          console.info(chalk.green('>>') + ' File ' + chalk.cyan(fileName) + ' generated.');
        });
    this.plugin.generate(parser.types, generator);

    console.info('\n' + chalk.green('✓') + ' Finished successfully!');
  }
}
