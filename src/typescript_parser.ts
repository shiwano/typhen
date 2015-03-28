/// <reference path="../typings/bundle.d.ts" />

import ts = require('typescript');
import _ = require('lodash');
import inflection = require('inflection');

import Logger = require('./logger');
import Symbol = require('./symbol');
import Runner = require('./runner');

class TypeScriptParser {
  private program: ts.Program;
  private typeChecker: ts.TypeChecker;

  private moduleCache: { [name: string]: Symbol.Module } = {};
  private typeCache: { [id: number]: Symbol.Type } = {};
  private symbols: Symbol.Symbol[] = [];

  private arrayTypeName: string = 'Array';

  private typeReferenceStack: Symbol.TypeReference[] = [];
  private get currentTypeReference(): Symbol.TypeReference { return _.last(this.typeReferenceStack); }

  constructor(fileNames: string[], private runner: Runner.Runner) {
    Logger.debug('Loading the TypeScript files');
    this.program = ts.createProgram(fileNames, this.runner.compilerOptions, this.runner.compilerHost);
    this.typeChecker = this.program.getTypeChecker(true);

    Logger.debug('Compiling the TypeScript files');
    var errors = this.program.getDiagnostics();
    if (errors.length === 0) {
      var semanticErrors = this.typeChecker.getDiagnostics();
      var emitOutput = this.typeChecker.emitFiles();
      var emitErrors = emitOutput.diagnostics;
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
      .filter(s => {
        var resolvedPath = this.runner.config.env.resolvePath(s.filename);
        return resolvedPath !== this.runner.config.env.defaultLibFileName &&
          _.contains(resolvedPath, this.runner.config.typingDirectory);
      });
  }

  public get types(): Symbol.Type[] {
    return _.chain(<Symbol.Type[]>_.values(this.typeCache))
      .filter(t => t.isGenerationTarget)
      .sortBy(t => t.fullName)
      .value();
  }

  public get modules(): Symbol.Module[] {
    return _.chain(<Symbol.Module[]>_.values(this.moduleCache))
      .filter(t => t.isGenerationTarget)
      .sortBy(t => t.fullName)
      .value();
  }

  public parse(): void {
    Logger.debug('Parsing the TypeScript symbols');
    this.sourceFiles.forEach(s => {
      this.parseSourceFile(s);
    });
  }

  public validate(): void {
    Logger.debug('Validating the typhen symbols');
    this.symbols.forEach(symbol => {
      var result = symbol.validate();

      if (typeof result === 'string') {
        throw new Error(result + ': ' + symbol.declarationInfos.map(d => d.toString()).join(', '));
      }
    });
  }

  private checkFlags(flagsA: number, flagsB: number): boolean {
    return (flagsA & flagsB) > 0;
  }

  private throwErrorWithSymbol(message: string, symbol: ts.Symbol): void {
    var infos = this.getDeclarationInfos(symbol);
    var symbolInfo = infos.length > 0 ? ': ' + infos.map(d => d.toString()).join(',') : '';
    throw new Error(message + symbolInfo);
  }

  private parseType(type: ts.Type): Symbol.Type {
    if (!_.isObject(type)) { return null; }

    if (this.typeCache[type.id] === undefined) {
      if (type.flags & ts.TypeFlags.StringLiteral) {
        this.parsePrimitiveType(<ts.StringLiteralType>type);
      } else if (type.flags & ts.TypeFlags.Intrinsic) {
        this.parsePrimitiveType(<ts.IntrinsicType>type);
      } else if (type.flags & ts.TypeFlags.Tuple) {
        this.parseTuple(<ts.TupleType>type);
      } else if (type.flags & ts.TypeFlags.Union) {
        this.parseUnionType(<ts.UnionType>type);
      } else if (type.flags & ts.TypeFlags.Anonymous && type.symbol === undefined) {
        // Reach the scope if TypeParameter#constraint is not specified
        return null;
      } else if (type.symbol.flags & ts.SymbolFlags.Function) {
        this.parseFunction(<ts.ResolvedType>type);
      } else if (type.symbol.flags & ts.SymbolFlags.Enum) {
        this.parseEnum(type);
      } else if (type.symbol.flags & ts.SymbolFlags.TypeParameter) {
        this.parseTypeParameter(<ts.TypeParameter>type);
      } else if (type.symbol.flags & ts.SymbolFlags.Class) {
        this.parseGenericType<Symbol.Class>(<ts.GenericType>type, Symbol.Class);
      } else if (type.symbol.flags & ts.SymbolFlags.Interface) {
        if (this.isTyphenPrimitiveType(type)) {
          this.parsePrimitiveType(<ts.GenericType>type);
        } else if (this.isArrayType(<ts.GenericType>type)) {
          this.parseArray(<ts.GenericType>type);
        } else {
          this.parseGenericType<Symbol.Interface>(<ts.GenericType>type, Symbol.Interface);
        }
      } else if (type.symbol.flags & ts.SymbolFlags.TypeLiteral) {
        if (_.isEmpty(type.getCallSignatures())) {
          this.parseObjectType(<ts.ResolvedType>type);
        } else {
          this.parseFunction(<ts.ResolvedType>type);
        }
      } else {
        this.throwErrorWithSymbol('Unsupported type', type.symbol);
      }
    }
    var typhenType = this.typeCache[type.id];

    if (typhenType.isTypeParameter && _.isObject(this.currentTypeReference)) {
      return this.currentTypeReference.getTypeByTypeParameter(<Symbol.TypeParameter>typhenType) || typhenType;
    } else {
      return typhenType;
    }
  }

  private createTyphenSymbol<T extends Symbol.Symbol>(symbol: ts.Symbol,
      typhenSymbolClass: typeof Symbol.Symbol, assumedNameSuffix?: string): T {
    var name = _.isObject(symbol) ? symbol.name.replace(/^__.*$/, '') : '';
    var assumedName = _.isEmpty(name) && assumedNameSuffix !== undefined ?
      this.getAssumedName(symbol, assumedNameSuffix) : '';
    var typhenSymbol = <T>new typhenSymbolClass(this.runner, name,
        this.getDocComment(symbol), this.getDeclarationInfos(symbol),
        this.getParentModule(symbol), assumedName);
    Logger.debug('Creating', (<any>typhenSymbolClass).name + ':',
        'module=' + typhenSymbol.ancestorModules.map(s => s.name).join('.') + ',', 'name=' + typhenSymbol.rawName + ',',
        'declarations=' + typhenSymbol.declarationInfos.map(d => d.toString()).join(','));
    this.symbols.push(typhenSymbol);
    return typhenSymbol;
  }

  private createTyphenType<T extends Symbol.Type>(type: ts.Type,
      typhenTypeClass: typeof Symbol.Type, assumedNameSuffix?: string): T {
    if (this.typeCache[type.id] !== undefined) {
      this.throwErrorWithSymbol('Already created the type', type.symbol);
    }
    var typhenType = this.createTyphenSymbol<T>(type.symbol, typhenTypeClass, assumedNameSuffix);
    this.typeCache[type.id] = typhenType;
    return typhenType;
  }

  private getOrCreateTyphenModule(symbol: ts.Symbol): Symbol.Module {
    var name = _.isObject(symbol) ? symbol.name : '';
    if (this.moduleCache[name] !== undefined) { return this.moduleCache[name]; }

    var typhenSymbol = this.createTyphenSymbol<Symbol.Module>(symbol, Symbol.Module);
    this.moduleCache[name] = typhenSymbol;
    return typhenSymbol;
  }

  private getDeclarationInfos(symbol: ts.Symbol): Symbol.DeclarationInfo[] {
    if (!_.isObject(symbol) || symbol.declarations === undefined) { return []; }

    return symbol.declarations.map(d => {
      var sourceFile = d.getSourceFile();
      var resolvedPath = this.runner.config.env.resolvePath(sourceFile.filename);
      var relativePath = this.runner.config.env.relativePath(resolvedPath);
      var lineAndCharacterNumber = sourceFile.getLineAndCharacterFromPosition(d.getStart());
      return new Symbol.DeclarationInfo(relativePath, resolvedPath, d.getFullText(), lineAndCharacterNumber);
    });
  }

  private getParentModule(symbol: ts.Symbol): Symbol.Module {
    if (!_.isObject(symbol)) { return null; }

    var parentDecl = symbol.declarations[0].parent;
    while (parentDecl !== undefined) {
      if (parentDecl.symbol && this.checkFlags(parentDecl.symbol.flags, ts.SymbolFlags.Module)) {
        return this.getOrCreateTyphenModule(parentDecl.symbol);
      }
      parentDecl = parentDecl.parent;
    }
    return null;
  }

  private getDocComment(symbol: ts.Symbol): string[] {
    return _.tap([], (results) => {
      if (!_.isObject(symbol)) { return; }
      var docComment = symbol.getDocumentationComment();
      if (docComment === undefined) { return; }

      _.chain(docComment)
        .map(c => c.kind === 'text' ? c.text : null)
        .compact()
        .forEach(text => results.push(text))
        .value();
    });
  }

  private getAssumedName(symbol: ts.Symbol, typeName: string): string {
    var parentNames = _.tap([], (results) => {
      if (!_.isObject(symbol)) { return; }

      var parentDecl = symbol.declarations[0].parent;
      while (parentDecl !== undefined) {
        if (parentDecl.symbol && (
            this.checkFlags(parentDecl.symbol.flags, ts.SymbolFlags.Class) ||
            this.checkFlags(parentDecl.symbol.flags, ts.SymbolFlags.Interface) ||
            this.checkFlags(parentDecl.symbol.flags, ts.SymbolFlags.Property) ||
            this.checkFlags(parentDecl.symbol.flags, ts.SymbolFlags.Function) ||
            this.checkFlags(parentDecl.symbol.flags, ts.SymbolFlags.Method) ||
            this.checkFlags(parentDecl.symbol.flags, ts.SymbolFlags.Variable)
            )) {
          results.push(inflection.camelize(parentDecl.symbol.name));
        }
        parentDecl = parentDecl.parent;
      }
    }).reverse();
    return parentNames.join('') + typeName;
  }

  private isTyphenPrimitiveType(type: ts.Type): boolean {
    return _.isObject(type.symbol) && _.include(this.runner.plugin.customPrimitiveTypes, type.symbol.name);
  }

  private isArrayType(type: ts.Type): boolean {
    return _.isObject(type.symbol) &&
           type.symbol.name === this.arrayTypeName &&
           this.getParentModule(type.symbol) === null;
  }

  private getSymbolsInScope(node: ts.Node, symbolFlags: ts.SymbolFlags): ts.Symbol[] {
    return this.typeChecker.getSymbolsInScope(node, symbolFlags)
      .filter(s => {
        return s.declarations.every(d => {
          var resolvedPath = this.runner.config.env.resolvePath(d.getSourceFile().filename);
          return resolvedPath !== this.runner.config.env.defaultLibFileName &&
            _.contains(resolvedPath, this.runner.config.typingDirectory);
        });
      });
  }

  private parseSourceFile(sourceFile: ts.SourceFile): void {
    var typhenSymbol = this.getOrCreateTyphenModule(sourceFile.symbol);

    var modules = this.getSymbolsInScope(sourceFile, ts.SymbolFlags.Module)
      .map(s => this.parseModule(s));
    var importedModuleTable: Symbol.ObjectTable<Symbol.Module> = {};
    var importedTypeTable: Symbol.ObjectTable<Symbol.Type> = {};
    this.getSymbolsInScope(sourceFile, ts.SymbolFlags.Import)
      .forEach(s => {
        var aliasedSymbol = this.typeChecker.getAliasedSymbol(s);
        if (this.checkFlags(aliasedSymbol.flags, ts.SymbolFlags.Module)) {
          importedModuleTable[s.name] = this.parseModule(aliasedSymbol);
        } else {
          var aliasedType = this.typeChecker.getTypeAtLocation(aliasedSymbol.declarations[0]);
          importedTypeTable[s.name] = this.parseType(aliasedType);
        }
      });
    var types = this.getSymbolsInScope(sourceFile, ts.SymbolFlags.Type)
      .concat(this.getSymbolsInScope(sourceFile, ts.SymbolFlags.Function))
      .map(s => this.typeChecker.getTypeAtLocation(s.declarations[0]))
      .map(s => this.parseType(s));
    var variables = this.getSymbolsInScope(sourceFile, ts.SymbolFlags.Variable)
      .map(s => this.parseVariable(s));
    var typeAliases = this.getSymbolsInScope(sourceFile, ts.SymbolFlags.TypeAlias)
      .map(s => this.parseTypeAlias(s));

    typhenSymbol.initialize(importedModuleTable, importedTypeTable, modules, types, variables, typeAliases);
  }

  private parseModule(symbol: ts.Symbol): Symbol.Module {
    var typhenSymbol = this.getOrCreateTyphenModule(symbol);

    var exportedSymbols = <ts.Symbol[]>_.values(symbol.exports);
    var modules = exportedSymbols
      .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.Module))
      .map(s => this.parseModule(s));
    var importedModuleTable: Symbol.ObjectTable<Symbol.Module> = {};
    var importedTypeTable: Symbol.ObjectTable<Symbol.Type> = {};
    exportedSymbols
      .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.Import))
      .forEach(s => {
        var aliasedSymbol = this.typeChecker.getAliasedSymbol(s);
        if (this.checkFlags(aliasedSymbol.flags, ts.SymbolFlags.Module)) {
          importedModuleTable[s.name] = this.parseModule(aliasedSymbol);
        } else {
          var aliasedType = this.typeChecker.getTypeAtLocation(aliasedSymbol.declarations[0]);
          importedTypeTable[s.name] = this.parseType(aliasedType);
        }
      });
    var types = exportedSymbols
      .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.Type) || this.checkFlags(s.flags, ts.SymbolFlags.Function))
      .map(s => this.typeChecker.getTypeAtLocation(s.declarations[0]))
      .map(t => this.parseType(t));
    var variables = exportedSymbols
      .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.Variable))
      .map(s => this.parseVariable(s));
    var typeAliases = exportedSymbols
      .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.TypeAlias))
      .map(s => this.parseTypeAlias(s));

    return typhenSymbol.initialize(importedModuleTable, importedTypeTable, modules, types, variables, typeAliases);
  }

  private parseEnum(type: ts.Type): Symbol.Enum {
    var typhenType = this.createTyphenType<Symbol.Enum>(type, Symbol.Enum);
    var symbol = type.symbol;

    var isConst = this.checkFlags(symbol.valueDeclaration.flags, ts.NodeFlags.Const);
    var memberValue = -1;
    var members = _(symbol.exports)
      .map((memberSymbol: ts.Symbol, name: string) => {
        var value = this.typeChecker.getEnumMemberValue(<ts.EnumMember>memberSymbol.valueDeclaration);
        memberValue = typeof value === 'number' ? value : memberValue + 1;
        return this.createTyphenSymbol<Symbol.EnumMember>(memberSymbol, Symbol.EnumMember)
          .initialize(memberValue);
      }).value();

    return typhenType.initialize(members, isConst);
  }

  private parseGenericType<T extends Symbol.Interface>(type: ts.GenericType, typhenTypeClass: typeof Symbol.Interface): T {
    var genericType = type.target === undefined ? type : type.target;
    var typhenType = this.createTyphenType<T>(type, typhenTypeClass);

    var typeParameters = genericType.typeParameters === undefined ? [] :
      genericType.typeParameters.map(t => <Symbol.TypeParameter>this.parseType(t));
    var typeArguments = type.typeArguments === undefined ? [] :
      type.typeArguments.map(t => this.parseType(t));
    var typeReference = new Symbol.TypeReference(typeParameters, typeArguments);
    this.typeReferenceStack.push(typeReference);

    var properties = genericType.getProperties()
        .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.Property) && s.valueDeclaration !== undefined &&
            !this.checkFlags(s.valueDeclaration.flags, ts.NodeFlags.Private))
        .map(s => this.parseProperty(s, _.contains(genericType.declaredProperties, s)));
    var methods = genericType.getProperties()
        .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.Method) && s.valueDeclaration !== undefined &&
            !this.checkFlags(s.valueDeclaration.flags, ts.NodeFlags.Private))
        .map(s => this.parseMethod(s, _.contains(genericType.declaredProperties, s)));
    var stringIndexType = this.parseType(genericType.getStringIndexType());
    var numberIndexType = this.parseType(genericType.getNumberIndexType());

    var constructorSignatures = genericType.getConstructSignatures()
      .filter(s => _.isObject(s.declaration)) // the constructor signature that has no declaration will be created by using typeof keyword.
      .map(s => this.parseSignature(s, 'Constructor'));
    var callSignatures = genericType.getCallSignatures().map(s => this.parseSignature(s));

    var baseTypes = genericType.baseTypes === undefined ? [] :
      genericType.baseTypes.map(t => <Symbol.Interface>this.parseType(t));

    var staticProperties: Symbol.Property[] = [];
    var staticMethods: Symbol.Method[] = [];

    if (genericType.symbol.flags & ts.SymbolFlags.Class) {
      (<ts.Symbol[]>_.values(genericType.symbol.members))
        .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.Constructor))
        .forEach(s => {
          s.declarations.forEach(d => {
            var signatureSymbol = this.typeChecker.getSignatureFromDeclaration(<ts.SignatureDeclaration>d);
            var constructorSignature = this.parseSignature(signatureSymbol, 'Constructor');
            constructorSignatures.push(constructorSignature);
        });
      });
      var staticPropertySymbols = (<ts.Symbol[]>_.values(genericType.symbol.exports))
        .filter(s => !this.checkFlags(s.flags, ts.SymbolFlags.Prototype));
      staticProperties = staticPropertySymbols
        .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.Property) && s.valueDeclaration !== undefined &&
            !this.checkFlags(s.valueDeclaration.flags, ts.NodeFlags.Private))
        .map(s => this.parseProperty(s));
      staticMethods = staticPropertySymbols
        .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.Method) && s.valueDeclaration !== undefined &&
            !this.checkFlags(s.valueDeclaration.flags, ts.NodeFlags.Private))
        .map(s => this.parseMethod(s));
    }

    this.typeReferenceStack.pop();
    return <T>typhenType.initialize(properties, methods, stringIndexType, numberIndexType,
        constructorSignatures, callSignatures, baseTypes, typeReference, staticProperties, staticMethods);
  }

  private parseObjectType(type: ts.ResolvedType): Symbol.ObjectType {
    var typhenType = this.createTyphenType<Symbol.ObjectType>(type, Symbol.ObjectType, 'Object');

    var properties = type.getProperties()
        .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.Property) && s.valueDeclaration !== undefined)
        .map(s => this.parseProperty(s));
    var methods = type.getProperties()
        .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.Method) && s.valueDeclaration !== undefined)
        .map(s => this.parseMethod(s));
    var stringIndexType = this.parseType(type.getStringIndexType());
    var numberIndexType = this.parseType(type.getNumberIndexType());

    return typhenType.initialize(properties, methods, stringIndexType, numberIndexType);
  }

  private parseArray(type: ts.GenericType): Symbol.Array {
    var typhenType = this.createTyphenType<Symbol.Array>(type, Symbol.Array);
    var typeArguments = type.typeArguments === undefined ? [] :
      type.typeArguments.map(t => this.parseType(t));
    var arrayType = typeArguments.length > 0 ? typeArguments[0] : null;
    return typhenType.initialize(arrayType);
  }

  private parseFunction(type: ts.ResolvedType): Symbol.Function {
    var typhenType = this.createTyphenType<Symbol.Function>(type, Symbol.Function, 'Function');
    var callSignatures = type.getCallSignatures().map(s => this.parseSignature(s));
    return typhenType.initialize(callSignatures);
  }

  private parsePrimitiveType(type: ts.GenericType): Symbol.PrimitiveType; // For TyphenPrimitiveType
  private parsePrimitiveType(type: ts.IntrinsicType): Symbol.PrimitiveType;
  private parsePrimitiveType(type: ts.StringLiteralType): Symbol.PrimitiveType;
  private parsePrimitiveType(type: any): Symbol.PrimitiveType {
    var name: string;

    if (typeof type.intrinsicName === 'string') {
      name = type.intrinsicName;
    } else if (_.isObject(type.symbol)) {
      name = type.symbol.name;
    } else {
      name = 'string';
    }
    var typhenType = this.createTyphenType<Symbol.PrimitiveType>(type, Symbol.PrimitiveType);
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

  private parseUnionType(type: ts.UnionType): Symbol.UnionType {
    var typhenType = this.createTyphenType<Symbol.UnionType>(type, Symbol.UnionType);
    var types = type.types.map(t => this.parseType(t));
    return typhenType.initialize(types);
  }

  private parseProperty(symbol: ts.Symbol, isOwn: boolean = true): Symbol.Property {
    var type = this.typeChecker.getTypeAtLocation(symbol.valueDeclaration);
    var propertyType = this.parseType(type);
    var isOptional = (<ts.PropertyDeclaration>symbol.valueDeclaration).questionToken != null;
    var isProtected = this.checkFlags(symbol.valueDeclaration.flags, ts.NodeFlags.Protected);

    var typhenSymbol = this.createTyphenSymbol<Symbol.Property>(symbol, Symbol.Property);
    return typhenSymbol.initialize(propertyType, isOptional, isOwn, isProtected);
  }

  private parseMethod(symbol: ts.Symbol, isOwn: boolean = true): Symbol.Method {
    var type = this.typeChecker.getTypeAtLocation(symbol.valueDeclaration);
    var callSignatures = type.getCallSignatures().map(s => this.parseSignature(s));
    var isOptional = (<ts.MethodDeclaration>symbol.valueDeclaration).questionToken != null;
    var isProtected = this.checkFlags(symbol.valueDeclaration.flags, ts.NodeFlags.Protected);

    var typhenSymbol = this.createTyphenSymbol<Symbol.Method>(symbol, Symbol.Method);
    return typhenSymbol.initialize(callSignatures, isOptional, isOwn, isProtected);
  }

  private parseSignature(signature: ts.Signature, suffixName: string = 'Signature'): Symbol.Signature {
    var symbol = signature.declaration.symbol;

    var typeParameters = signature.typeParameters === undefined ? [] :
      signature.typeParameters.map(t => <Symbol.TypeParameter>this.parseType(t));
    var parameters = signature.getParameters().map(s => this.parseParameter(s));
    var returnType = this.parseType(signature.getReturnType());

    var typhenSymbol = this.createTyphenSymbol<Symbol.Signature>(symbol, Symbol.Signature, suffixName);
    return typhenSymbol.initialize(typeParameters, parameters, returnType);
  }

  private parseParameter(symbol: ts.Symbol): Symbol.Parameter {
    var type = this.typeChecker.getTypeAtLocation(symbol.valueDeclaration);
    var parameterType = this.parseType(type);
    var isOptional = (<ts.ParameterDeclaration>symbol.valueDeclaration).questionToken != null;

    var typhenSymbol = this.createTyphenSymbol<Symbol.Parameter>(symbol, Symbol.Parameter);
    return typhenSymbol.initialize(parameterType, isOptional);
  }

  private parseVariable(symbol: ts.Symbol): Symbol.Variable {
    var isOptional = false;
    var type = this.typeChecker.getTypeAtLocation(symbol.valueDeclaration);
    var variableType: Symbol.Type = null;
    var variableModule: Symbol.Module = null;

    if (_.isObject(type.symbol) && this.checkFlags(type.symbol.flags, ts.SymbolFlags.Module)) {
      variableModule = this.parseModule(type.symbol);
    } else {
      variableType = this.parseType(type);
    }

    var typhenSymbol = this.createTyphenSymbol<Symbol.Variable>(symbol, Symbol.Variable);
    return typhenSymbol.initialize(variableType, variableModule, isOptional);
  }

  private parseTypeAlias(symbol: ts.Symbol): Symbol.TypeAlias {
    var type = this.typeChecker.getDeclaredTypeOfSymbol(symbol);
    var aliasedType = this.parseType(type);
    var typhenSymbol = this.createTyphenSymbol<Symbol.TypeAlias>(symbol, Symbol.TypeAlias);
    return typhenSymbol.initialize(aliasedType);
  }
}

export = TypeScriptParser;
