/// <reference path="../typings/tsd.d.ts" />

import tss = require('typescript-services-api');
import ts = tss.ts;
import _ = require('lodash');
import inflection = require('inflection');

import Logger = require('./logger');
import Symbol = require('./symbol');
import Runner = require('./runner');

class TypeScriptParser {
  private program: tss.ts.Program;
  private typeChecker: ts.TypeChecker;
  private typeCache: { [index: number]: Symbol.Type } = {};
  private typhenPrimitiveTypeName: string = 'TyphenPrimitiveType';

  private static topLevelKinds: ts.SyntaxKind[] = [
    ts.SyntaxKind.FunctionDeclaration,
    ts.SyntaxKind.EnumDeclaration,
    ts.SyntaxKind.InterfaceDeclaration,
    ts.SyntaxKind.ClassDeclaration
  ];

  constructor(fileNames: string[], private runner: Runner.Runner) {
    this.program = ts.createProgram(fileNames, this.runner.compilerOptions, this.runner.compilerHost);
    this.typeChecker = this.program.getTypeChecker(true);

    var unsupportedSourceFileNames = this.sourceFiles
      .filter(s => s.filename.match(/.*\.d\.ts$/) === null)
      .map(s => s.filename);
    if (unsupportedSourceFileNames.length > 0) {
      throw new Error('Unsupported files given (not *.d.ts): ' + unsupportedSourceFileNames.join(', '));
    }

    var errors = this.program.getDiagnostics();
    if (errors.length === 0) {
      var semanticErrors = this.typeChecker.getDiagnostics();
      var emitOutput = this.typeChecker.emitFiles();
      var emitErrors = emitOutput.errors;
      errors = errors.concat(semanticErrors, emitErrors);
    }

    errors.forEach(d => {
      var info = _.isObject(d.file) ? [d.file.filename, '(', d.start, ',', d.length, '):'].join('') : '';
      Logger.error(Logger.red(info), d.messageText);
      throw new Error('Detect diagnostic messages of the TypeScript compiler');
    });
  }

  public get sourceFiles(): ts.SourceFile[] {
    return this.program.getSourceFiles()
      .filter(s => s.filename !== this.runner.config.env.defaultLibFileName);
  }

  public get types(): Symbol.Type[] {
    return _.values(this.typeCache);
  }

  public parse(): Symbol.Type[] {
    this.sourceFiles.forEach(s => this.parseSourceFile(s));
    return this.types;
  }

  public parseSourceFile(sourceFile: ts.SourceFile): Symbol.Type[] {
    return _.chain(this.findTypesFromSourceFile(sourceFile, TypeScriptParser.topLevelKinds))
      .map(t => this.parseType(t))
      .compact()
      .value();
  }

  public findTypesFromSourceFile(sourceFile: ts.SourceFile, searchKinds: ts.SyntaxKind[],
      node: ts.Node = null, results: ts.Type[] = []): ts.Type[] {
    if (node === null) { node = sourceFile; }
    node.getChildren(sourceFile).forEach(childNode => {
      if (searchKinds.indexOf(childNode.kind) >= 0) {
        var type = this.typeChecker.getTypeOfNode(childNode);
        results.push(type);
      }
      this.findTypesFromSourceFile(sourceFile, searchKinds, childNode, results);
    });
    return results;
  }

  private throwErrorWithSymbol(message: string, symbol: ts.Symbol): void {
    var infos = this.getDeclarationInfos(symbol);
    var symbolInfo = infos.length > 0 ? infos.map(d => d.toString()).join('\n') : '';
    throw new Error(message + '\n' + symbolInfo);
  }

  private parseType(type: ts.Type): Symbol.Type {
    if (!_.isObject(type)) { return null; }
    if (this.typeCache[type.id] !== undefined) { return this.typeCache[type.id]; }

    if (this.isTyphenPrimitiveType(type)) {
      return null;
    } else if (type.flags & ts.TypeFlags.StringLiteral) {
      return this.parsePrimitive(<ts.StringLiteralType>type);
    } else if (type.flags & ts.TypeFlags.Intrinsic) {
      return this.parsePrimitive(<ts.IntrinsicType>type);
    } else if (type.flags & ts.TypeFlags.Tuple) {
      return this.parseTuple(<ts.TupleType>type);
    } else if (type.flags & ts.TypeFlags.Anonymous && type.symbol === undefined) {
      // Reach the scope if TypeParameter#constraint is not specified
      return null;
    } else if (type.symbol.flags & ts.SymbolFlags.Function) {
      return this.parseFunction(<ts.ResolvedObjectType>type);
    } else if (type.symbol.flags & ts.SymbolFlags.Enum) {
      return this.parseEnum(type);
    } else if (type.symbol.flags & ts.SymbolFlags.TypeParameter) {
      return this.parseTypeParameter(<ts.TypeParameter>type);
    } else if (type.symbol.flags & ts.SymbolFlags.Class) {
      return this.parseGenericType<Symbol.Class>(<ts.GenericType>type, Symbol.Class);
    } else if (type.symbol.flags & ts.SymbolFlags.Interface) {
      if (this.isExtendedTyphenPrimitiveType(<ts.GenericType>type)) {
        return this.parsePrimitive(<ts.GenericType>type);
      } else {
        return this.parseGenericType<Symbol.Interface>(<ts.GenericType>type, Symbol.Interface);
      }
    } else if (type.symbol.flags & ts.SymbolFlags.TypeLiteral) {
      if (_.isEmpty(type.getCallSignatures())) {
        return this.parseObjectType(<ts.ResolvedObjectType>type);
      } else {
        return this.parseFunction(<ts.ResolvedObjectType>type);
      }
    } else {
      this.throwErrorWithSymbol('Unsupported type', type.symbol);
    }
  }

  private createTyphenSymbol<T extends Symbol.Symbol>(symbol: ts.Symbol,
      typhenSymbolClass: typeof Symbol.Symbol, assumedNameSuffix?: string): T {
    var name = _.isObject(symbol) ? symbol.name.replace(/^__.*$/, '') : '';
    var assumedName = _.isEmpty(name) && assumedNameSuffix !== undefined ?
      this.getAssumedName(symbol, assumedNameSuffix) : '';
    return <T>new typhenSymbolClass(this.runner, name,
        this.getDocComment(symbol), this.getDeclarationInfos(symbol),
        this.getModuleNames(symbol), assumedName);
  }

  private createTyphenType<T extends Symbol.Type>(type: ts.Type,
      typhenTypeClass: typeof Symbol.Type, assumedNameSuffix?: string): T {
    if (this.typeCache[type.id] !== undefined) {
      this.throwErrorWithSymbol('Already created the type', type.symbol);
    }
    var typhenType = this.createTyphenSymbol<T>(type.symbol, typhenTypeClass, assumedNameSuffix);
    this.typeCache[type.id] = typhenType;
    return <T>typhenType;
  }

  private getDeclarationInfos(symbol: ts.Symbol): Symbol.DeclarationInfo[] {
    if (!_.isObject(symbol) || symbol.declarations === undefined) { return []; }

    return symbol.declarations.map(d => {
      var sourceFile = d.getSourceFile();
      var lineAndCharacterNumber = sourceFile.getLineAndCharacterFromPosition(d.pos);
      return new Symbol.DeclarationInfo(sourceFile.filename, d.getFullText(), lineAndCharacterNumber);
    });
  }

  private getModuleNames(symbol: ts.Symbol): string[] {
    return _.tap([], (results) => {
      if (symbol === undefined) { return; }

      var parentDecl = symbol.declarations[0].parent;
      while (parentDecl !== undefined) {
        if (parentDecl.symbol && _.contains([
              ts.SymbolFlags.NamespaceModule,
              ts.SymbolFlags.ValueModule
            ], parentDecl.symbol.flags)) {
          parentDecl.symbol.name.replace(/["']/g, '').split('/').reverse().forEach(n => {
            results.push(n);
          });
        }
        parentDecl = parentDecl.parent;
      }
    }).reverse();
  }

  private getDocComment(symbol: ts.Symbol): string[] {
    return _.tap([], (results) => {
      if (symbol === undefined) { return; }
      var docComment = symbol.getDocumentationComment();
      if (docComment === undefined) { return; }

      _.chain(docComment)
        .map(c => c.kind === 'text' ? c.text : null)
        .compact()
        .forEach(text => results.push(text));
    });
  }

  private getAssumedName(symbol: ts.Symbol, typeName: string): string {
    var parentNames = _.tap([], (results) => {
      if (symbol === undefined) { return; }

      var parentDecl = symbol.declarations[0].parent;
      while (parentDecl !== undefined) {
        if (parentDecl.symbol && _.contains([
              ts.SymbolFlags.Class,
              ts.SymbolFlags.Interface,
              ts.SymbolFlags.Property,
              ts.SymbolFlags.Function,
              ts.SymbolFlags.Method,
              ts.SymbolFlags.Variable
            ], parentDecl.symbol.flags)) {
          results.push(inflection.camelize(parentDecl.symbol.name));
        }
        parentDecl = parentDecl.parent;
      }
    }).reverse();
    return parentNames.join('') + typeName;
  }

  private isTyphenPrimitiveType(type: ts.Type): boolean {
    return _.isObject(type.symbol) &&
           type.symbol.name === this.typhenPrimitiveTypeName &&
           this.getModuleNames(type.symbol).length === 0;
  }

  private isExtendedTyphenPrimitiveType(type: ts.GenericType): boolean {
    var isExtendedTyphenPrimitiveType = type.baseTypes === undefined ? false :
      _.any(type.baseTypes, (t) => this.isTyphenPrimitiveType(t));

    if (isExtendedTyphenPrimitiveType) {
      if (this.getModuleNames(type.symbol).length === 0) {
        return true;
      } else {
        this.throwErrorWithSymbol('Found the interface with module which is extended from the TyphenPrimitiveType', type.symbol);
      }
    }
    return false;
  }

  private parseEnum(type: ts.Type): Symbol.Enum {
    var typhenType = this.createTyphenType<Symbol.Enum>(type, Symbol.Enum);
    var symbol = type.symbol;

    var memberValue = -1;
    var members = _(symbol.exports)
      .map((memberSymbol: ts.Symbol, name: string) => {
        var value = this.typeChecker.getEnumMemberValue(memberSymbol.valueDeclaration);
        memberValue = _.isNumber(value) ? value : memberValue + 1;
        return this.createTyphenSymbol<Symbol.EnumMember>(memberSymbol, Symbol.EnumMember)
          .initialize(memberValue);
      }).value();

    return typhenType.initialize(members);
  }

  private parseGenericType<T extends Symbol.Interface>(type: ts.GenericType, typhenTypeClass: typeof Symbol.Interface): T {
    var genericType = type.target === undefined ? type : type.target;
    var typhenType = this.createTyphenType<T>(type, typhenTypeClass);

    var properties = genericType.getProperties()
        .filter(s => (s.flags & ts.SymbolFlags.Property) > 0 && s.declarations !== undefined)
        .map(s => this.parseProperty(s, _.contains(genericType.declaredProperties, s)));
    var methods = genericType.getProperties()
        .filter(s => (s.flags & ts.SymbolFlags.Method) > 0 && s.declarations !== undefined)
        .map(s => this.parseMethod(s, _.contains(genericType.declaredProperties, s)));
    var stringIndexType = this.parseType(genericType.getStringIndexType());
    var numberIndexType = this.parseType(genericType.getNumberIndexType());

    var constructorSignatures = genericType.getConstructSignatures().map(s => this.parseSignature(s));
    var callSignatures = genericType.getCallSignatures().map(s => this.parseSignature(s));

    var baseTypes = genericType.baseTypes === undefined ? [] :
      genericType.baseTypes.map(t => <Symbol.Interface>this.parseType(t));
    var typeParameters = genericType.typeParameters === undefined ? [] :
      genericType.typeParameters.map(t => <Symbol.TypeParameter>this.parseType(t));
    var typeArguments = type.typeArguments === undefined ? [] :
      type.typeArguments.map(t => this.parseType(t));

    var staticProperties: Symbol.Property[] = [];
    var staticMethods: Symbol.Method[] = [];

    if (genericType.symbol.flags & ts.SymbolFlags.Class) {
      var staticPropertySymbols = (<ts.Symbol[]>_.values(genericType.symbol.exports))
        .filter(s => !((s.flags & ts.SymbolFlags.Prototype) > 0));
      staticProperties = staticPropertySymbols
        .filter(s => (s.flags & ts.SymbolFlags.Property) > 0 && s.declarations !== undefined)
        .map(s => this.parseProperty(s));
      staticMethods = staticPropertySymbols
        .filter(s => (s.flags & ts.SymbolFlags.Method) > 0 && s.declarations !== undefined)
        .map(s => this.parseMethod(s));
    }
    return <T>typhenType.initialize(properties, methods, stringIndexType, numberIndexType,
        constructorSignatures, callSignatures, baseTypes, typeParameters,
        typeArguments, staticProperties, staticMethods);
  }

  private parseObjectType(type: ts.ResolvedObjectType): Symbol.ObjectType {
    var typhenType = this.createTyphenType<Symbol.ObjectType>(type, Symbol.ObjectType, 'Object');

    var properties = type.getProperties()
        .filter(s => (s.flags & ts.SymbolFlags.Property) > 0 && s.declarations !== undefined)
        .map(s => this.parseProperty(s));
    var methods = type.getProperties()
        .filter(s => (s.flags & ts.SymbolFlags.Method) > 0 && s.declarations !== undefined)
        .map(s => this.parseMethod(s));
    var stringIndexType = this.parseType(type.getStringIndexType());
    var numberIndexType = this.parseType(type.getNumberIndexType());

    return typhenType.initialize(properties, methods, stringIndexType, numberIndexType);
  }

  private parseFunction(type: ts.ResolvedObjectType): Symbol.Function {
    var typhenType = this.createTyphenType<Symbol.Function>(type, Symbol.Function, 'Function');
    var callSignatures = type.getCallSignatures().map(s => this.parseSignature(s));
    return typhenType.initialize(callSignatures);
  }

  private parsePrimitive(type: ts.GenericType): Symbol.Primitive; // For TyphenPrimitiveType
  private parsePrimitive(type: ts.IntrinsicType): Symbol.Primitive;
  private parsePrimitive(type: ts.StringLiteralType): Symbol.Primitive;
  private parsePrimitive(type: any): Symbol.Primitive {
    var name: string;

    if (_.isString(type.intrinsicName)) {
      name = type.intrinsicName;
    } else if (_.isObject(type.symbol)) {
      name = type.symbol.name;
    } else {
      name = 'string';
    }
    var typhenType = this.createTyphenType<Symbol.Primitive>(type, Symbol.Primitive);
    return typhenType.initialize(name);
  }

  private parseTypeParameter(type: ts.TypeParameter): Symbol.TypeParameter {
    var typhenType = this.createTyphenType<Symbol.TypeParameter>(type, Symbol.TypeParameter);
    return typhenType.initialize(this.parseType(type.constraint));
  }

  private parseTuple(type: ts.TupleType): Symbol.Tuple {
    var typhenType = this.createTyphenType<Symbol.Tuple>(type, Symbol.Tuple);

    var elementTypes = type.elementTypes.map(t => this.parseType(t));
    var baseArrayType = this.parseType(type.baseArrayType);

    return typhenType.initialize(elementTypes, baseArrayType);
  }

  private parseProperty(symbol: ts.Symbol, isOwn: boolean = true): Symbol.Property {
    var type = this.typeChecker.getTypeOfNode(symbol.declarations[0]);
    var propertyType = this.parseType(type);
    var isOptional = (symbol.valueDeclaration.flags & ts.NodeFlags.QuestionMark) > 0;

    var typhenSymbol = this.createTyphenSymbol<Symbol.Property>(symbol, Symbol.Property);
    return typhenSymbol.initialize(propertyType, isOptional, isOwn);
  }

  private parseMethod(symbol: ts.Symbol, isOwn: boolean = true): Symbol.Method {
    var type = this.typeChecker.getTypeOfNode(symbol.declarations[0]);
    var callSignatures = type.getCallSignatures().map(s => this.parseSignature(s));
    var isOptional = (symbol.valueDeclaration.flags & ts.NodeFlags.QuestionMark) > 0;

    var typhenSymbol = this.createTyphenSymbol<Symbol.Method>(symbol, Symbol.Method);
    return typhenSymbol.initialize(callSignatures, isOptional, isOwn);
  }

  private parseSignature(signature: ts.Signature): Symbol.Signature {
    var symbol = signature.declaration.symbol;

    var typeParameters = signature.typeParameters === undefined ? [] :
      signature.typeParameters.map(t => <Symbol.TypeParameter>this.parseType(t));
    var parameters = signature.getParameters().map(s => this.parseParameter(s));
    var returnType = this.parseType(signature.getReturnType());

    var typhenSymbol = this.createTyphenSymbol<Symbol.Signature>(symbol, Symbol.Signature, 'Signature');
    return typhenSymbol.initialize(typeParameters, parameters, returnType);
  }

  private parseParameter(symbol: ts.Symbol): Symbol.Parameter {
    var type = this.typeChecker.getTypeOfNode(symbol.declarations[0]);
    var parameterType = this.parseType(type);
    var isOptional = (symbol.valueDeclaration.flags & ts.NodeFlags.QuestionMark) > 0;

    var typhenSymbol = this.createTyphenSymbol<Symbol.Parameter>(symbol, Symbol.Parameter);
    return typhenSymbol.initialize(parameterType, isOptional);
  }
}

export = TypeScriptParser;
