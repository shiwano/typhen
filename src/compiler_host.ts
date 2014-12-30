/// <reference path='../typings/tsd.d.ts' />

import tss = require('typescript-services-api');
import IEnvironment = require('./environments/i_environment');

class CompilerHost implements tss.ts.CompilerHost {
  private cachedSources: {[index: string]: tss.ts.SourceFile} = {};
  private version: number = 0;

  constructor(
      private env: IEnvironment,
      private defaultLibFileName: string) {
  }

  public getSourceFile(fileName: string, languageVersion: tss.ts.ScriptTarget,
      onError?: (message: string) => void): tss.ts.SourceFile {
    if (this.cachedSources[fileName] === undefined) {
      var text: string;
      text = this.env.readFile(fileName);
      this.cachedSources[fileName] = tss.ts.createSourceFile(fileName, text,
          languageVersion, this.version.toString(), false);
    }
    return this.cachedSources[fileName];
  }

  public getDefaultLibFilename(): string {
    return this.defaultLibFileName;
  }

  public writeFile(fileName: string, data: string, writeByteOrderMark: boolean,
      onError?: (message: string) => void): void {
    throw new Error('The TypeScript compiler should not write a file!');
  }

  public getCurrentDirectory(): string {
    return this.env.currentDirectory;
  }

  public getCanonicalFileName(fileName: string): string {
    return this.useCaseSensitiveFileNames() ? fileName : fileName.toLowerCase();
  }

  public useCaseSensitiveFileNames(): boolean {
    return this.env.useCaseSensitiveFileNames;
  }

  public getNewLine(): string {
    return this.env.newLine;
  }
}

export = CompilerHost;
