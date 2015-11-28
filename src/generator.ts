import _ = require('lodash');
import inflection = require('inflection');
import Vinyl = require('vinyl');

import Environment = require('./environments/environment');
import Symbol = require('./symbol');
import Plugin = require('./plugin');
import Logger = require('./logger');
import LocalHandlebars = require('./local_handlebars');
import Helpers = require('./helpers');

interface HandlebarsTemplate {
  (context: any, options?: any): string;
}

class Generator {
  private fileDataCache: { [index: string]: string } = {};
  private templateCache: { [index: string]: HandlebarsTemplate } = {};
  files: Vinyl[] = [];

  constructor(
      public env: Environment,
      public outputDirectory: string,
      public pluginDirectory: string,
      private handlebarsOptions: Plugin.HandlebarsOptions) {
    this.outputDirectory = this.env.resolvePath(this.outputDirectory);
  }

  generateFiles(cwd: string, pattern: string, dest: string): void {
    let resolvedCwd = this.env.resolvePath(this.pluginDirectory, cwd);
    let resolvedDest = this.env.resolvePath(this.outputDirectory, dest);

    this.env.glob(pattern, resolvedCwd).forEach(path => {
      this.generate(
        this.env.resolvePath(resolvedCwd, path),
        this.env.resolvePath(resolvedDest, path)
      );
    });
  }

  generateUnlessExist(src: string, dest: string, context: any = null): Vinyl {
    return this.generate(src, dest, context, false);
  }

  generate(src: string, dest: string, overwrite?: boolean): Vinyl;
  generate(src: string, dest: string, context: Symbol.Symbol, overwrite?: boolean): Vinyl;
  generate(src: string, dest: string, context: any, overwrite?: boolean): Vinyl {
    if (typeof context === 'boolean') {
      overwrite = context;
      context = null;
    }

    if (context instanceof Symbol.Symbol) {
      dest = this.replaceStars(dest, <Symbol.Symbol>context);
    }
    let resolvedDest = this.env.resolvePath(this.outputDirectory, dest);
    let data: string;

    if (context !== null && /^.+\.hbs$/.test(src)) {
      Logger.debug('Rendering: ' + src + ', ' + context);
      data = this.getTemplate(src)(context, this.handlebarsOptions);
    } else {
      data = this.getFileFromPluginDirectory(src);
    }

    if (overwrite !== false || (!this.env.exists(resolvedDest) && this.files.every(f => f.path !== resolvedDest))) {
      let file = this.createFile({
        cwd: this.env.currentDirectory,
        base: this.outputDirectory,
        path: resolvedDest,
        contents: data
      });
      this.files.push(file);
      return file;
    }
    return null;
  }

  createFile(options: { cwd?: string; base?: string; path?: string; contents?: any; }): Vinyl {
    if (typeof options.contents === 'string') {
      options.contents = new Buffer(options.contents);
    }
    return new Vinyl(options);
  }

  replaceStars(str: string, symbol: Symbol.Symbol, separator: string = '/'): string {
    let matches = str.match(/(underscore|upperCamelCase|lowerCamelCase)?:?(.*\*.*)/);
    if (matches == null) { return str; }

    let inflect = (name: string, inflectionType: string): string => {
      if (_.contains(name, '/')) { return name; }

      switch (inflectionType) {
        case 'underscore':     return Helpers.underscore(name);
        case 'upperCamelCase': return Helpers.upperCamelCase(name);
        case 'lowerCamelCase': return Helpers.lowerCamelCase(name);
        default:               return name;
      }
    };
    return matches[2]
      .replace('**', symbol.ancestorModules.map(s => inflect(s.name, matches[1])).join(separator))
      .replace('*', inflect(symbol.name, matches[1]))
      .replace(/^\//, ''); // Avoid making an absolute path
  }

  private getFileFromPluginDirectory(fileName: string): string {
    let filePath = this.env.resolvePath(this.pluginDirectory, fileName);

    if (!this.fileDataCache[filePath]) {
      this.fileDataCache[filePath] = this.env.readFile(filePath);
    }
    return this.fileDataCache[filePath];
  }

  private getTemplate(templateName: string): HandlebarsTemplate {
    let filePath = this.env.resolvePath(this.pluginDirectory, templateName);

    if (!this.templateCache[filePath]) {
      let templateSource = this.getFileFromPluginDirectory(filePath);
      Logger.debug('Compiling the Template: ' + templateName);
      this.templateCache[filePath] = LocalHandlebars.handlebars.compile(templateSource);
    }
    return this.templateCache[filePath];
  }
}

export = Generator;
