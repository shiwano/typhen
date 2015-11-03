import ts = require('typescript');
import Environment = require('./environments/environment');
import Logger = require('./logger');

class CompilerHost implements ts.CompilerHost {
  private cachedSources: {[index: string]: ts.SourceFile} = {};
  private version: number = 0;

  constructor(private env: Environment) {}

  getSourceFile(fileName: string, languageVersion: ts.ScriptTarget,
      onError?: (message: string) => void): ts.SourceFile {
    if (this.cachedSources[fileName] === undefined) {
      var text: string;

      try {
        text = this.env.readFile(fileName);
      } catch (e) {
        return undefined;
      }
      this.cachedSources[fileName] = ts.createSourceFile(fileName, text, this.version, false);
    }
    return this.cachedSources[fileName];
  }

  getDefaultLibFileName(): string {
    return this.env.defaultLibFileName;
  }

  fileExists(fileName: string): boolean {
    return this.env.exists(fileName);
  }

  readFile(fileName: string): string {
    return this.env.readFile(fileName);
  }

  writeFile(fileName: string, data: string, writeByteOrderMark: boolean,
      onError?: (message: string) => void): void {
    Logger.debug('Skip to write: ' + fileName);
  }

  getCurrentDirectory(): string {
    return this.env.currentDirectory;
  }

  useCaseSensitiveFileNames(): boolean {
    return this.env.useCaseSensitiveFileNames;
  }

  getCanonicalFileName(fileName: string): string {
    return this.useCaseSensitiveFileNames() ? fileName : fileName.toLowerCase();
  }

  getNewLine(): string {
    return this.env.newLine;
  }
}

export = CompilerHost;
