/// <reference path='../typings/bundle.d.ts' />

import tss = require('typescript-services-api');
import Environment = require('./environments/environment');
import Logger = require('./logger');

class CompilerHost implements tss.ts.CompilerHost {
  private cachedSources: {[index: string]: tss.ts.SourceFile} = {};
  private version: number = 0;

  constructor(private env: Environment) {
  }

  public getSourceFile(fileName: string, languageVersion: tss.ts.ScriptTarget,
      onError?: (message: string) => void): tss.ts.SourceFile {
    if (this.cachedSources[fileName] === undefined) {
      var text: string;

      try {
        text = this.env.readFile(fileName);
      } catch (e) {
        return undefined;
      }
      this.cachedSources[fileName] = tss.ts.createSourceFile(fileName, text,
          languageVersion, this.version.toString(), false);
    }
    return this.cachedSources[fileName];
  }

  public getDefaultLibFilename(): string {
    return this.env.defaultLibFileName;
  }

  public writeFile(fileName: string, data: string, writeByteOrderMark: boolean,
      onError?: (message: string) => void): void {
    Logger.debug('Skip to write: ' + fileName);
  }

  public getCurrentDirectory(): string {
    return this.env.currentDirectory;
  }

  // NOTE: This is a workaround that when the TypeScript compiler emits files,
  // the context of "this" will change from the CompilerHost instance.
  public useCaseSensitiveFileNames = (): boolean => {
    return this.env.useCaseSensitiveFileNames;
  };

  // NOTE: This is a workaround that when the TypeScript compiler emits files,
  // the context of "this" will change from the CompilerHost instance.
  public getCanonicalFileName = (fileName: string): string => {
    return this.useCaseSensitiveFileNames() ? fileName : fileName.toLowerCase();
  };

  public getNewLine(): string {
    return this.env.newLine;
  }
}

export = CompilerHost;
