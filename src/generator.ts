import * as _ from 'lodash';
import * as inflection from 'inflection';
import Vinyl = require('vinyl');

import * as symbol from './symbol';
import * as plugin from './plugin';
import * as logger from './logger';
import * as localHandlebars from './local_handlebars';
import * as helpers from './helpers';
import { Environment } from './environments/environment';

interface HandlebarsTemplate {
  (context: any, options?: any): string;
}

export default class Generator {
  private fileDataCache: { [index: string]: string } = {};
  private templateCache: { [index: string]: HandlebarsTemplate } = {};
  files: Vinyl[] = [];

  constructor(
      public env: Environment,
      public outputDirectory: string,
      public pluginDirectory: string,
      private handlebarsOptions: plugin.HandlebarsOptions) {
    this.outputDirectory = this.env.resolvePath(this.outputDirectory);
  }

  generateFiles(cwd: string, pattern: string, dest: string): void {
    const resolvedCwd = this.env.resolvePath(this.pluginDirectory, cwd);
    const resolvedDest = this.env.resolvePath(this.outputDirectory, dest);

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
  generate(src: string, dest: string, context: symbol.Symbol, overwrite?: boolean): Vinyl;
  generate(src: string, dest: string, context: any, overwrite?: boolean): Vinyl | null {
    if (typeof context === 'boolean') {
      overwrite = context;
      context = null;
    }

    if (context instanceof symbol.Symbol) {
      dest = this.replaceStars(dest, <symbol.Symbol>context);
    }
    const resolvedDest = this.env.resolvePath(this.outputDirectory, dest);
    let data: string;

    if (context !== null && /^.+\.hbs$/.test(src)) {
      logger.debug('Rendering: ' + src + ', ' + context);
      try {
        data = this.getTemplate(src)(context, this.handlebarsOptions);
      } catch (e) {
        logger.error(`Failed to generate a file: src: ${src}, dest: ${dest}, ` +
          `resolvedDest: ${resolvedDest}, context: ${context ? context.name : ''}`);
        throw e;
      }
    } else {
      data = this.getFileFromPluginDirectory(src);
    }

    if (overwrite !== false || (!this.env.exists(resolvedDest) && this.files.every(f => f.path !== resolvedDest))) {
      const file = this.createFile({
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

  replaceStars(str: string, symbol: symbol.Symbol, separator: string = '/'): string {
    const matches = str.match(/(underscore|upperCamelCase|lowerCamelCase)?:?(.*\*.*)/);
    if (matches === null) { return str; }
    const inflectionType = matches[1] || '';
    const targetText = matches[2] || '';

    const inflect = (name: string, inflectionType: string): string => {
      if (_.includes(name, '/')) { return name; }

      switch (inflectionType) {
        case 'underscore':     return helpers.underscore(name);
        case 'upperCamelCase': return helpers.upperCamelCase(name);
        case 'lowerCamelCase': return helpers.lowerCamelCase(name);
        default:               return name;
      }
    };
    return targetText
      .replace('**', symbol.ancestorModules.map(s => inflect(s.name, inflectionType)).join(separator))
      .replace('*', inflect(symbol.name, inflectionType))
      .replace(/^\//, ''); // Avoid making an absolute path
  }

  private getFileFromPluginDirectory(fileName: string): string {
    const filePath = this.env.resolvePath(this.pluginDirectory, fileName);

    if (!this.fileDataCache[filePath]) {
      this.fileDataCache[filePath] = this.env.readFile(filePath);
    }
    return this.fileDataCache[filePath];
  }

  private getTemplate(templateName: string): HandlebarsTemplate {
    const filePath = this.env.resolvePath(this.pluginDirectory, templateName);

    if (!this.templateCache[filePath]) {
      const templateSource = this.getFileFromPluginDirectory(filePath);
      logger.debug('Compiling the Template: ' + templateName);
      this.templateCache[filePath] = localHandlebars.handlebars.compile(templateSource);
    }
    return this.templateCache[filePath];
  }
}
