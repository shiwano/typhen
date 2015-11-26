import ts = require('typescript');
import _ = require('lodash');
import inflection = require('inflection');
import HashMap = require('hashmap');

import Logger = require('./logger');
import Symbol = require('./symbol');
import Config = require('./config');

class TypeScriptParser {
  private program: ts.Program;
  private typeChecker: ts.TypeChecker;

  private moduleCache: HashMap<string, Symbol.Module> = new HashMap<string, Symbol.Module>();
  private typeCache: HashMap<ts.Type, Symbol.Type> = new HashMap<ts.Type, Symbol.Type>();
  private symbols: Symbol.Symbol[] = [];

  private arrayTypeName: string = 'Array';

  private typeReferenceStack: Symbol.TypeReference[] = [];
  private get currentTypeReference(): Symbol.TypeReference { return _.last(this.typeReferenceStack); }

  constructor(private fileNames: string[], private config: Config.Config) { }

  get sourceFiles(): ts.SourceFile[] {
    return this.program.getSourceFiles()
      .filter(s => {
        var resolvedPath = this.config.env.resolvePath(s.fileName);
        return resolvedPath !== this.config.env.defaultLibFileName &&
          _.contains(resolvedPath, this.config.typingDirectory);
      });
  }

  get types(): Symbol.Type[] {
    return _.chain(this.typeCache.values())
      .filter(t => t.isGenerationTarget)
      .sortBy(t => t.fullName)
      .value();
  }

  get modules(): Symbol.Module[] {
    return _.chain(this.moduleCache.values())
      .filter(t => t.isGenerationTarget)
      .sortBy(t => t.fullName)
      .value();
  }

  parse(): void {
    Logger.debug('Loading the TypeScript files');
    this.program = ts.createProgram(this.fileNames, this.config.compilerOptions, this.config.compilerHost);
    this.typeChecker = this.program.getTypeChecker();

    Logger.debug('Compiling the TypeScript files');
    var errors = ts.getPreEmitDiagnostics(this.program);

    errors.forEach(d => {
      var info = _.isObject(d.file) ? [d.file.fileName, '(', d.start, ',', d.length, '):'].join('') : '';
      Logger.error(Logger.red(info), d.messageText);
      throw new Error('Detect diagnostic messages of the TypeScript compiler');
    });

    Logger.debug('Parsing the TypeScript symbols');
    this.sourceFiles.forEach(s => {
      this.parseSourceFile(s);
    });

    this.types.filter(t => t.isAnonymousType && t.parentModule != null).forEach(t => {
      t.parentModule.anonymousTypes.push(t);
    });
  }

  validate(): void {
    Logger.debug('Validating the typhen symbols');
    this.symbols.forEach(symbol => {
      var result = symbol.validate();

      if (typeof result === 'string') {
        throw new Error(result + ': ' + symbol.declarationInfos.map(d => d.toString()).join(', '));
      }
    });
  }

  private getSymbolAtLocation(node: ts.Node): ts.Symbol {
    return (node as any).symbol;
  }

  private checkFlags(flagsA: number, flagsB: number): boolean {
    return (flagsA & flagsB) > 0;
  }

  private throwErrorWithSymbolInfo(message: string, symbol: ts.Symbol): void {
    var infos = this.getDeclarationInfos(symbol);
    var symbolInfo = infos.length > 0 ? ': ' + infos.map(d => d.toString()).join(',') : '';
    throw new Error(message + symbolInfo);
  }

  private parseType(type: ts.Type): Symbol.Type {
    if (!_.isObject(type)) { return null; }

    if (this.typeCache.get(type) === undefined) {
      if (type.flags & ts.TypeFlags.String) {
        this.parsePrimitiveType(type);
      } else if (type.flags & ts.TypeFlags.Number) {
        this.parsePrimitiveType(type);
      } else if (type.flags & ts.TypeFlags.Boolean) {
        this.parsePrimitiveType(type);
      } else if (type.flags & ts.TypeFlags.ESSymbol) {
        this.parsePrimitiveType(type);
      } else if (type.flags & ts.TypeFlags.Void) {
        this.parsePrimitiveType(type);
      } else if (type.flags & ts.TypeFlags.Any) {
        this.parsePrimitiveType(type);
      } else if (type.flags & ts.TypeFlags.Tuple) {
        this.parseTuple(<ts.TupleType>type);
      } else if (type.flags & ts.TypeFlags.Union) {
        this.parseUnionType(<ts.UnionType>type);
      } else if (type.flags & ts.TypeFlags.Intersection) {
        this.parseIntersectionType(<ts.IntersectionType>type);
      } else if (type.flags & ts.TypeFlags.Anonymous && type.symbol === undefined) {
        // Reach the scope if TypeParameter#constraint is not specified
        return null;
      } else if (type.symbol.flags & ts.SymbolFlags.Function) {
        this.parseFunction(<ts.ObjectType>type);
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
          this.parseObjectType(<ts.ObjectType>type);
        } else {
          this.parseFunction(<ts.ObjectType>type);
        }
      } else {
        this.throwErrorWithSymbolInfo('Unsupported type', type.symbol);
      }
    }
    var typhenType = this.typeCache.get(type);

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
    var typhenSymbol = <T>new typhenSymbolClass(this.config, name,
        this.getDocComment(symbol), this.getDeclarationInfos(symbol),
        this.getDecorators(symbol), this.getParentModule(symbol), assumedName);
    Logger.debug('Creating', (<any>typhenSymbolClass).name + ':',
        'module=' + typhenSymbol.ancestorModules.map(s => s.name).join('.') + ',', 'name=' + typhenSymbol.rawName + ',',
        'declarations=' + typhenSymbol.declarationInfos.map(d => d.toString()).join(','));
    this.symbols.push(typhenSymbol);
    return typhenSymbol;
  }

  private createTyphenType<T extends Symbol.Type>(type: ts.Type,
      typhenTypeClass: typeof Symbol.Type, assumedNameSuffix?: string): T {
    if (this.typeCache.get(type) !== undefined) {
      this.throwErrorWithSymbolInfo('Already created the type', type.symbol);
    }
    var typhenType = this.createTyphenSymbol<T>(type.symbol, typhenTypeClass, assumedNameSuffix);
    this.typeCache.set(type, typhenType);
    return typhenType;
  }

  private getOrCreateTyphenModule(symbol: ts.Symbol): Symbol.Module {
    var name = _.isObject(symbol) ? symbol.name : '';
    if (this.moduleCache.get(name) !== undefined) { return this.moduleCache.get(name); }

    var typhenSymbol = this.createTyphenSymbol<Symbol.Module>(symbol, Symbol.Module);
    this.moduleCache.set(name, typhenSymbol);
    return typhenSymbol;
  }

  private getDeclarationInfos(symbol: ts.Symbol): Symbol.DeclarationInfo[] {
    if (!_.isObject(symbol) || symbol.declarations === undefined) { return []; }

    return symbol.declarations.map(d => {
      var sourceFile = d.getSourceFile();
      var resolvedPath = this.config.env.resolvePath(sourceFile.fileName);
      var relativePath = this.config.env.relativePath(resolvedPath);
      var lineAndCharacterNumber = sourceFile.getLineAndCharacterOfPosition(d.getStart());
      lineAndCharacterNumber.line += 1;
      return new Symbol.DeclarationInfo(relativePath, resolvedPath, d.getFullText(), lineAndCharacterNumber);
    });
  }

  private getDecorators(symbol: ts.Symbol): Symbol.Decorator[] {
    if (!_.isObject(symbol) ||
        symbol.valueDeclaration === undefined ||
        symbol.valueDeclaration.decorators === undefined) {
      return [];
    }
    return symbol.valueDeclaration.decorators.map(d => this.parseDecorator(d));
  }

  private getParentModule(symbol: ts.Symbol): Symbol.Module {
    if (!_.isObject(symbol)) { return null; }

    var parentDecl = symbol.declarations[0].parent;
    while (parentDecl !== undefined) {
      var parentSymbol = this.getSymbolAtLocation(parentDecl);

      if (parentSymbol && this.checkFlags(parentSymbol.flags, ts.SymbolFlags.Module)) {
        return this.getOrCreateTyphenModule(parentSymbol);
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
    if (!_.isObject(symbol)) {
      return typeName;
    }

    var parentNames: string[] = [];
    var parentDecl = symbol.declarations[0].parent;

    while (parentDecl !== undefined) {
      var parentSymbol = this.getSymbolAtLocation(parentDecl);

      if (parentSymbol !== undefined) {
        if (this.checkFlags(parentSymbol.flags, ts.SymbolFlags.TypeAlias)) {
          return parentSymbol.name;
        } else if (
            this.checkFlags(parentSymbol.flags, ts.SymbolFlags.Class)     ||
            this.checkFlags(parentSymbol.flags, ts.SymbolFlags.Interface) ||
            this.checkFlags(parentSymbol.flags, ts.SymbolFlags.Property)  ||
            this.checkFlags(parentSymbol.flags, ts.SymbolFlags.Function)  ||
            this.checkFlags(parentSymbol.flags, ts.SymbolFlags.Method)    ||
            this.checkFlags(parentSymbol.flags, ts.SymbolFlags.Variable)) {
          parentNames.push(inflection.camelize(parentSymbol.name));
        }
      }
      parentDecl = parentDecl.parent;
    }
    return parentNames.reverse().join('') + typeName;
  }

  private isTyphenPrimitiveType(type: ts.Type): boolean {
    return _.isObject(type.symbol) && _.include(this.config.plugin.customPrimitiveTypes, type.symbol.name);
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
          var resolvedPath = this.config.env.resolvePath(d.getSourceFile().fileName);
          return resolvedPath !== this.config.env.defaultLibFileName &&
            _.contains(resolvedPath, this.config.typingDirectory);
        });
      });
  }

  private parseDecorator(decorator: ts.Decorator): Symbol.Decorator {
    var type = decorator.expression.getChildCount() === 0 ?
      this.typeChecker.getTypeAtLocation(decorator.expression) :
      this.typeChecker.getTypeAtLocation(decorator.expression.getChildren()
        .filter(c => c.kind == ts.SyntaxKind.Identifier).slice(-1)[0]);
    var decoratorFunction = this.parseType(type) as Symbol.Function;
    var syntaxList = decorator.expression.getChildren()
      .filter(c => c.kind == ts.SyntaxKind.SyntaxList).slice(-1)[0];
    var argumentTable = syntaxList === undefined ?
      {} :
      _.zipObject(
        decoratorFunction.callSignatures[0].parameters.map(p => p.name),
        syntaxList.getChildren()
          .filter(node => node.kind !== ts.SyntaxKind.CommaToken)
          .map(node => {
            if (node.kind === ts.SyntaxKind.FunctionExpression ||
                node.kind === ts.SyntaxKind.ArrowFunction) {
              return node.getText();
            } else {
              try {
                return this.config.env.eval(node.getText());
              } catch (e) {
                return node.getText();
              }
            }
          })
      );
    return new Symbol.Decorator(decoratorFunction, argumentTable);
  }

  private parseSourceFile(sourceFile: ts.SourceFile): void {
    var sourceSymbol = this.getSymbolAtLocation(sourceFile);
    var typhenSymbol = this.getOrCreateTyphenModule(sourceSymbol);

    var modules = this.getSymbolsInScope(sourceFile, ts.SymbolFlags.Module)
      .map(s => this.parseModule(s));
    var importedModuleTable: Symbol.ObjectTable<Symbol.Module> = {};
    var importedTypeTable: Symbol.ObjectTable<Symbol.Type> = {};
    this.getSymbolsInScope(sourceFile, ts.SymbolFlags.Alias)
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
      .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.Alias))
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
        var value = this.typeChecker.getConstantValue(<ts.EnumMember>memberSymbol.valueDeclaration);
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
        .map(s => this.parseProperty(s, _.values(genericType.symbol.members).indexOf(s) >= 0));
    var methods = genericType.getProperties()
        .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.Method) && s.valueDeclaration !== undefined &&
            !this.checkFlags(s.valueDeclaration.flags, ts.NodeFlags.Private))
        .map(s => this.parseMethod(s, _.values(genericType.symbol.members).indexOf(s) >= 0));
    var stringIndexType = this.parseType(genericType.getStringIndexType());
    var numberIndexType = this.parseType(genericType.getNumberIndexType());

    var constructorSignatures = genericType.getConstructSignatures()
      .filter(s => _.isObject(s.declaration)) // the constructor signature that has no declaration will be created by using typeof keyword.
      .map(s => this.parseSignature(s, 'Constructor'));
    var callSignatures = genericType.getCallSignatures().map(s => this.parseSignature(s));

    var baseTypes = this.typeChecker.getBaseTypes(genericType)
      .map(t => <Symbol.Interface>this.parseType(t));

    var staticProperties: Symbol.Property[] = [];
    var staticMethods: Symbol.Method[] = [];
    var isAbstract = false;

    if (genericType.symbol.flags & ts.SymbolFlags.Class) {
      isAbstract = this.checkFlags(genericType.symbol.valueDeclaration.flags, ts.NodeFlags.Abstract);

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
        constructorSignatures, callSignatures, baseTypes, typeReference,
        staticProperties, staticMethods, isAbstract);
  }

  private parseObjectType(type: ts.ObjectType): Symbol.ObjectType {
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

  private parseFunction(type: ts.ObjectType): Symbol.Function {
    var typhenType = this.createTyphenType<Symbol.Function>(type, Symbol.Function, 'Function');
    var callSignatures = type.getCallSignatures().map(s => this.parseSignature(s));
    return typhenType.initialize(callSignatures);
  }

  private parsePrimitiveType(type: ts.GenericType): Symbol.PrimitiveType; // For TyphenPrimitiveType
  private parsePrimitiveType(type: ts.Type): Symbol.PrimitiveType;
  private parsePrimitiveType(type: any): Symbol.PrimitiveType {
    var name: string;

    if (this.checkFlags(type.flags, ts.TypeFlags.String)) {
      name = 'string';
    } else if (this.checkFlags(type.flags, ts.TypeFlags.Boolean)) {
      name = 'boolean';
    } else if (this.checkFlags(type.flags, ts.TypeFlags.Number)) {
      name = 'number';
    } else if (this.checkFlags(type.flags, ts.TypeFlags.ESSymbol)) {
      name = 'symbol';
    } else if (this.checkFlags(type.flags, ts.TypeFlags.Void)) {
      name = 'void';
    } else if (_.isObject(type.symbol)) {
      name = type.symbol.name;
    } else {
      name = 'any';
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

  private parseIntersectionType(type: ts.IntersectionType): Symbol.IntersectionType {
    var typhenType = this.createTyphenType<Symbol.IntersectionType>(type, Symbol.IntersectionType);
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
    var isAbstract = this.checkFlags(symbol.valueDeclaration.flags, ts.NodeFlags.Abstract);

    var typhenSymbol = this.createTyphenSymbol<Symbol.Method>(symbol, Symbol.Method);
    return typhenSymbol.initialize(callSignatures, isOptional, isOwn, isProtected, isAbstract);
  }

  private parseSignature(signature: ts.Signature, suffixName: string = 'Signature'): Symbol.Signature {
    var symbol = this.typeChecker.getSymbolAtLocation(signature.declaration);

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

    var valueDecl = (<ts.ParameterDeclaration>symbol.valueDeclaration);
    var isOptional = valueDecl.questionToken != null;
    var isVariadic = valueDecl.dotDotDotToken != null;

    var typhenSymbol = this.createTyphenSymbol<Symbol.Parameter>(symbol, Symbol.Parameter);
    return typhenSymbol.initialize(parameterType, isOptional, isVariadic);
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
