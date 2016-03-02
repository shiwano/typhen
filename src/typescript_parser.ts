import * as ts from 'typescript';
import * as _ from 'lodash';
import * as inflection from 'inflection';
import HashMap = require('hashmap');

import * as logger from './logger';
import * as config from './config';
import * as Symbol from './symbol';

export default class TypeScriptParser {
  private program: ts.Program;
  private typeChecker: ts.TypeChecker;

  private moduleCache: HashMap<string, Symbol.Module> = new HashMap<string, Symbol.Module>();
  private typeCache: HashMap<ts.Type, Symbol.Type> = new HashMap<ts.Type, Symbol.Type>();
  private symbols: Symbol.Symbol[] = [];

  private arrayTypeName: string = 'Array';

  private typeReferenceStack: Symbol.TypeReference[] = [];
  private get currentTypeReference(): Symbol.TypeReference { return _.last(this.typeReferenceStack); }

  constructor(private fileNames: string[], private config: config.Config) { }

  get sourceFiles(): ts.SourceFile[] {
    return this.program.getSourceFiles()
      .filter(s => {
        let resolvedPath = this.config.env.resolvePath(s.fileName);
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
    logger.debug('Loading the TypeScript files');
    this.program = ts.createProgram(this.fileNames, this.config.compilerOptions, this.config.compilerHost);
    this.typeChecker = this.program.getTypeChecker();

    logger.debug('Compiling the TypeScript files');
    let errors = ts.getPreEmitDiagnostics(this.program);

    errors.forEach(d => {
      let info = _.isObject(d.file) ? [d.file.fileName, '(', d.start, ',', d.length, '):'].join('') : '';
      logger.error(logger.red(info), d.messageText);
      throw new Error('Detect diagnostic messages of the TypeScript compiler');
    });

    logger.debug('Parsing the TypeScript symbols');
    this.sourceFiles.forEach(s => {
      this.parseSourceFile(s);
    });

    this.types.filter(t => t.isAnonymousType && t.parentModule != null).forEach(t => {
      t.parentModule.anonymousTypes.push(t);
    });
  }

  validate(): void {
    logger.debug('Validating the typhen symbols');
    this.symbols.forEach(symbol => {
      let result = symbol.validate();

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
    let infos = this.getDeclarationInfos(symbol);
    let symbolInfo = infos.length > 0 ? ': ' + infos.map(d => d.toString()).join(',') : '';
    throw new Error(message + symbolInfo);
  }

  private parseType(type: ts.Type): Symbol.Type {
    if (!_.isObject(type)) { return null; }

    if (this.typeCache.get(type) === undefined) {
      if (type.flags & ts.TypeFlags.TypeParameter) {
        this.parseTypeParameter(<ts.TypeParameter>type);
      } else if (type.flags & ts.TypeFlags.String) {
        this.parsePrimitiveType(type);
      } else if (type.flags & ts.TypeFlags.StringLiteral) {
        this.parseStringLiteralType(<ts.StringLiteralType>type);
      } else if (type.flags & ts.TypeFlags.Number) {
        this.parsePrimitiveType(type);
      } else if (type.flags & ts.TypeFlags.Boolean) {
        this.parsePrimitiveType(type);
      } else if (type.flags & ts.TypeFlags.ESSymbol) {
        this.parsePrimitiveType(type);
      } else if (type.flags & ts.TypeFlags.Void) {
        this.parsePrimitiveType(type);
      } else if (type.flags & ts.TypeFlags.Any) {
        let anyType = this.types.filter(t => t.isPrimitiveType && t.name === 'any')[0];
        if (anyType) {
          return anyType;
        }
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
    let typhenType = this.typeCache.get(type);

    if (typhenType.isTypeParameter && _.isObject(this.currentTypeReference)) {
      return this.currentTypeReference.getTypeByTypeParameter(<Symbol.TypeParameter>typhenType) || typhenType;
    } else {
      return typhenType;
    }
  }

  private createTyphenSymbol<T extends Symbol.Symbol>(symbol: ts.Symbol,
      typhenSymbolClass: typeof Symbol.Symbol, assumedNameSuffix?: string): T;
  private createTyphenSymbol<T extends Symbol.Symbol>(signature: ts.Signature,
      typhenSymbolClass: typeof Symbol.Symbol, assumedNameSuffix?: string): T;
  private createTyphenSymbol<T extends Symbol.Symbol>(symbolOrSignature: any,
      typhenSymbolClass: typeof Symbol.Symbol, assumedNameSuffix?: string): T {
    let name = _.isObject(symbolOrSignature) && typeof symbolOrSignature.name === 'string' ?
      (<ts.Symbol>symbolOrSignature).name.replace(/^__@/, '@@').replace(/^__.*$/, '') : '';
    let assumedName = _.isEmpty(name) && assumedNameSuffix !== undefined ?
      this.getAssumedName(symbolOrSignature, assumedNameSuffix) : '';

    let typhenSymbol = <T>new typhenSymbolClass(this.config, name,
      this.getDocComment(symbolOrSignature), this.getDeclarationInfos(symbolOrSignature),
      this.getDecorators(symbolOrSignature), this.getParentModule(symbolOrSignature), assumedName);
    logger.debug('Creating', (<any>typhenSymbolClass).name + ':',
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
    let typhenType = this.createTyphenSymbol<T>(type.symbol, typhenTypeClass, assumedNameSuffix);
    this.typeCache.set(type, typhenType);
    return typhenType;
  }

  private getOrCreateTyphenModule(symbol: ts.Symbol): Symbol.Module {
    let name = _.isObject(symbol) ? symbol.name : '';
    if (this.moduleCache.get(name) !== undefined) { return this.moduleCache.get(name); }

    let typhenSymbol = this.createTyphenSymbol<Symbol.Module>(symbol, Symbol.Module);
    this.moduleCache.set(name, typhenSymbol);
    return typhenSymbol;
  }

  private getDeclarationInfos(symbol: ts.Symbol): Symbol.DeclarationInfo[] {
    if (!_.isObject(symbol) || symbol.declarations === undefined) { return []; }

    return symbol.declarations.map(d => {
      let sourceFile = d.getSourceFile();
      let resolvedPath = this.config.env.resolvePath(sourceFile.fileName);
      let relativePath = this.config.env.relativePath(resolvedPath);
      let lineAndCharacterNumber = sourceFile.getLineAndCharacterOfPosition(d.getStart());
      lineAndCharacterNumber.line += 1;
      return new Symbol.DeclarationInfo(relativePath, resolvedPath, d.getFullText(), lineAndCharacterNumber);
    });
  }

  private getDecorators(symbol: ts.Symbol): Symbol.Decorator[];
  private getDecorators(signature: ts.Signature): Symbol.Decorator[];
  private getDecorators(symbolOrSignature: any): Symbol.Decorator[] {
    if (!_.isObject(symbolOrSignature)) {
      return [];
    }
    let declaration = _.isObject(symbolOrSignature.declarations) ?
      (<ts.Symbol>symbolOrSignature).valueDeclaration :
      (<ts.Signature>symbolOrSignature).declaration;

    return _.isObject(declaration) && _.isObject(declaration.decorators) ?
      declaration.decorators.map(d => this.parseDecorator(d)) : [];
  }

  private getParentModule(symbol: ts.Symbol): Symbol.Module;
  private getParentModule(signature: ts.Signature): Symbol.Module;
  private getParentModule(symbolOrSignature: any): Symbol.Module {
    if (!_.isObject(symbolOrSignature)) { return null; }

    let parentDecl = _.isObject(symbolOrSignature.declarations) ?
      (<ts.Symbol>symbolOrSignature).declarations[0].parent :
      (<ts.Signature>symbolOrSignature).declaration;

    while (parentDecl !== undefined) {
      let parentSymbol = this.getSymbolAtLocation(parentDecl);

      if (parentSymbol && this.checkFlags(parentSymbol.flags, ts.SymbolFlags.Module)) {
        return this.getOrCreateTyphenModule(parentSymbol);
      }
      parentDecl = parentDecl.parent;
    }
    return null;
  }

  private getDocComment(symbol: ts.Symbol): string[];
  private getDocComment(signature: ts.Signature): string[];
  private getDocComment(symbolOrSignature: ts.Symbol | ts.Signature): string[] {
    return _.tap([], (results) => {
      if (!_.isObject(symbolOrSignature)) { return; }
      let docComment = symbolOrSignature.getDocumentationComment();
      if (docComment === undefined) { return; }

      _.chain(docComment)
        .map(c => c.kind === 'text' ? c.text : null)
        .compact()
        .forEach(text => results.push(text))
        .value();
    });
  }

  private getAssumedName(symbol: ts.Symbol, typeName: string): string;
  private getAssumedName(signature: ts.Signature, typeName: string): string;
  private getAssumedName(symbolOrSignature: any, typeName: string): string {
    if (!_.isObject(symbolOrSignature)) {
      return typeName;
    }

    let parentNames: string[] = [];
    let parentDecl = _.isObject(symbolOrSignature.declarations) ?
      (<ts.Symbol>symbolOrSignature).declarations[0].parent :
      (<ts.Signature>symbolOrSignature).declaration;

    while (parentDecl !== undefined) {
      let parentSymbol = this.getSymbolAtLocation(parentDecl);

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
          let resolvedPath = this.config.env.resolvePath(d.getSourceFile().fileName);
          return resolvedPath !== this.config.env.defaultLibFileName &&
            _.contains(resolvedPath, this.config.typingDirectory);
        });
      });
  }

  private parseDecorator(decorator: ts.Decorator): Symbol.Decorator {
    let type = decorator.expression.getChildCount() === 0 ?
      this.typeChecker.getTypeAtLocation(decorator.expression) :
      this.typeChecker.getTypeAtLocation(decorator.expression.getChildren()
        .filter(c => c.kind === ts.SyntaxKind.Identifier).slice(-1)[0]);
    let decoratorFunction = this.parseType(type) as Symbol.Function;
    let syntaxList = decorator.expression.getChildren()
      .filter(c => c.kind === ts.SyntaxKind.SyntaxList).slice(-1)[0];
    let argumentTable = syntaxList === undefined ?
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
    let sourceSymbol = this.getSymbolAtLocation(sourceFile);
    let typhenSymbol = this.getOrCreateTyphenModule(sourceSymbol);

    let modules = this.getSymbolsInScope(sourceFile, ts.SymbolFlags.Module)
      .map(s => this.parseModule(s));
    let importedModuleTable: Symbol.ObjectTable<Symbol.Module> = {};
    let importedTypeTable: Symbol.ObjectTable<Symbol.Type> = {};
    this.getSymbolsInScope(sourceFile, ts.SymbolFlags.Alias)
      .forEach(s => {
        let aliasedSymbol = this.typeChecker.getAliasedSymbol(s);
        if (this.checkFlags(aliasedSymbol.flags, ts.SymbolFlags.Module)) {
          importedModuleTable[s.name] = this.parseModule(aliasedSymbol);
        } else {
          let aliasedType = this.typeChecker.getTypeAtLocation(aliasedSymbol.declarations[0]);
          importedTypeTable[s.name] = this.parseType(aliasedType);
        }
      });
    let types = this.getSymbolsInScope(sourceFile, ts.SymbolFlags.Type)
      .concat(this.getSymbolsInScope(sourceFile, ts.SymbolFlags.Function))
      .map(s => this.typeChecker.getTypeAtLocation(s.declarations[0]))
      .map(s => this.parseType(s));
    let variables = this.getSymbolsInScope(sourceFile, ts.SymbolFlags.Variable)
      .map(s => this.parseVariable(s));
    let typeAliases = this.getSymbolsInScope(sourceFile, ts.SymbolFlags.TypeAlias)
      .map(s => this.parseTypeAlias(s));

    typhenSymbol.initialize(false, importedModuleTable, importedTypeTable,
        modules, types, variables, typeAliases);
  }

  private parseModule(symbol: ts.Symbol): Symbol.Module {
    let typhenSymbol = this.getOrCreateTyphenModule(symbol);

    let isNamespaceModule = this.checkFlags(symbol.flags, ts.SymbolFlags.NamespaceModule);
    let exportedSymbols = <ts.Symbol[]>_.values(symbol.exports);
    let modules = exportedSymbols
      .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.Module))
      .map(s => this.parseModule(s));
    let importedModuleTable: Symbol.ObjectTable<Symbol.Module> = {};
    let importedTypeTable: Symbol.ObjectTable<Symbol.Type> = {};
    exportedSymbols
      .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.Alias))
      .forEach(s => {
        let aliasedSymbol = this.typeChecker.getAliasedSymbol(s);
        if (this.checkFlags(aliasedSymbol.flags, ts.SymbolFlags.Module)) {
          importedModuleTable[s.name] = this.parseModule(aliasedSymbol);
        } else {
          let aliasedType = this.typeChecker.getTypeAtLocation(aliasedSymbol.declarations[0]);
          importedTypeTable[s.name] = this.parseType(aliasedType);
        }
      });
    let types = exportedSymbols
      .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.Type) || this.checkFlags(s.flags, ts.SymbolFlags.Function))
      .map(s => this.typeChecker.getTypeAtLocation(s.declarations[0]))
      .map(t => this.parseType(t));
    let variables = exportedSymbols
      .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.Variable))
      .map(s => this.parseVariable(s));
    let typeAliases = exportedSymbols
      .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.TypeAlias))
      .map(s => this.parseTypeAlias(s));

    return typhenSymbol.initialize(isNamespaceModule, importedModuleTable, importedTypeTable,
        modules, types, variables, typeAliases);
  }

  private parseEnum(type: ts.Type): Symbol.Enum {
    let typhenType = this.createTyphenType<Symbol.Enum>(type, Symbol.Enum);
    let symbol = type.symbol;

    let isConst = this.checkFlags(symbol.valueDeclaration.flags, ts.NodeFlags.Const);
    let memberValue = -1;
    let members = _(symbol.exports)
      .map((memberSymbol: ts.Symbol, name: string) => {
        let value = this.typeChecker.getConstantValue(<ts.EnumMember>memberSymbol.valueDeclaration);
        memberValue = typeof value === 'number' ? value : memberValue + 1;
        return this.createTyphenSymbol<Symbol.EnumMember>(memberSymbol, Symbol.EnumMember)
          .initialize(memberValue);
      }).value();

    return typhenType.initialize(members, isConst);
  }

  private parseGenericType<T extends Symbol.Interface>(type: ts.GenericType, typhenTypeClass: typeof Symbol.Interface): T {
    let genericType = type.target === undefined ? type : type.target;
    let ownMemberNames = _.values(genericType.symbol.members).map(s => s.name);
    let typhenType = this.createTyphenType<T>(type, typhenTypeClass);

    let typeParameters = genericType.typeParameters === undefined ? [] :
      genericType.typeParameters.map(t => <Symbol.TypeParameter>this.parseType(t));
    let typeArguments = type.typeArguments === undefined ? [] :
      type.typeArguments.map(t => this.parseType(t));
    let typeReference = new Symbol.TypeReference(typeParameters, typeArguments);
    this.typeReferenceStack.push(typeReference);

    let properties = genericType.getProperties()
        .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.Property) && s.valueDeclaration !== undefined &&
            !this.checkFlags(s.valueDeclaration.flags, ts.NodeFlags.Private))
        .map(s => this.parseProperty(s, _.contains(ownMemberNames, s.name)));
    let rawMethods = genericType.getProperties()
        .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.Method) && s.valueDeclaration !== undefined &&
            !this.checkFlags(s.valueDeclaration.flags, ts.NodeFlags.Private))
        .map(s => this.parseMethod(s, _.contains(ownMemberNames, s.name)));
    let methods = rawMethods.filter(m => m.name.indexOf('@@') !== 0);
    let builtInSymbolMethods = rawMethods.filter(m => m.name.indexOf('@@') === 0);
    let stringIndexType = this.parseType(genericType.getStringIndexType());
    let numberIndexType = this.parseType(genericType.getNumberIndexType());

    let constructorSignatures = genericType.getConstructSignatures()
      .filter(s => _.isObject(s.declaration)) // the constructor signature that has no declaration will be created by using typeof keyword.
      .map(s => this.parseSignature(s, 'Constructor'));
    let callSignatures = genericType.getCallSignatures().map(s => this.parseSignature(s));

    let baseTypes = this.typeChecker.getBaseTypes(genericType)
      .map(t => <Symbol.Interface>this.parseType(t));

    let staticProperties: Symbol.Property[] = [];
    let staticMethods: Symbol.Method[] = [];
    let isAbstract = false;

    if (genericType.symbol.flags & ts.SymbolFlags.Class) {
      isAbstract = this.checkFlags(genericType.symbol.valueDeclaration.flags, ts.NodeFlags.Abstract);

      (<ts.Symbol[]>_.values(genericType.symbol.members))
        .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.Constructor))
        .forEach(s => {
          s.declarations.forEach(d => {
            let signatureSymbol = this.typeChecker.getSignatureFromDeclaration(<ts.SignatureDeclaration>d);
            let constructorSignature = this.parseSignature(signatureSymbol, 'Constructor');
            constructorSignatures.push(constructorSignature);
        });
      });
      let staticPropertySymbols = (<ts.Symbol[]>_.values(genericType.symbol.exports))
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
    return <T>typhenType.initialize(properties, methods, builtInSymbolMethods,
        stringIndexType, numberIndexType, constructorSignatures, callSignatures,
        baseTypes, typeReference, staticProperties, staticMethods, isAbstract);
  }

  private parseObjectType(type: ts.ObjectType): Symbol.ObjectType {
    let typhenType = this.createTyphenType<Symbol.ObjectType>(type, Symbol.ObjectType, 'Object');

    let properties = type.getProperties()
        .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.Property) && s.valueDeclaration !== undefined)
        .map(s => this.parseProperty(s));
    let rawMethods = type.getProperties()
        .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.Method) && s.valueDeclaration !== undefined)
        .map(s => this.parseMethod(s));
    let methods = rawMethods.filter(m => m.name.indexOf('@@') !== 0);
    let builtInSymbolMethods = rawMethods.filter(m => m.name.indexOf('@@') === 0);
    let stringIndexType = this.parseType(type.getStringIndexType());
    let numberIndexType = this.parseType(type.getNumberIndexType());

    return typhenType.initialize(properties, methods, builtInSymbolMethods,
        stringIndexType, numberIndexType);
  }

  private parseArray(type: ts.GenericType): Symbol.Array {
    let typhenType = this.createTyphenType<Symbol.Array>(type, Symbol.Array);
    let typeArguments = type.typeArguments === undefined ? [] :
      type.typeArguments.map(t => this.parseType(t));
    let arrayType = typeArguments.length > 0 ? typeArguments[0] : null;
    return typhenType.initialize(arrayType);
  }

  private parseFunction(type: ts.ObjectType): Symbol.Function {
    let typhenType = this.createTyphenType<Symbol.Function>(type, Symbol.Function, 'Function');
    let callSignatures = type.getCallSignatures().map(s => this.parseSignature(s));
    return typhenType.initialize(callSignatures);
  }

  private parsePrimitiveType(type: ts.GenericType): Symbol.PrimitiveType; // For TyphenPrimitiveType
  private parsePrimitiveType(type: ts.Type): Symbol.PrimitiveType;
  private parsePrimitiveType(type: any): Symbol.PrimitiveType {
    let name: string;

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
    } else if (this.checkFlags(type.flags, ts.TypeFlags.Any)) {
      name = 'any';
    } else if (_.isObject(type.symbol)) {
      name = type.symbol.name;
    } else {
      throw new Error('Unknown primitive type: ' + type.flags);
    }
    let typhenType = this.createTyphenType<Symbol.PrimitiveType>(type, Symbol.PrimitiveType);
    return typhenType.initialize(name);
  }

  private parseTypeParameter(type: ts.TypeParameter): Symbol.TypeParameter {
    let typhenType = this.createTyphenType<Symbol.TypeParameter>(type, Symbol.TypeParameter);
    return typhenType.initialize(this.parseType(type.constraint));
  }

  private parseTuple(type: ts.TupleType): Symbol.Tuple {
    let typhenType = this.createTyphenType<Symbol.Tuple>(type, Symbol.Tuple);
    let elementTypes = type.elementTypes.map(t => this.parseType(t));
    return typhenType.initialize(elementTypes);
  }

  private parseUnionType(type: ts.UnionType): Symbol.UnionType {
    let typhenType = this.createTyphenType<Symbol.UnionType>(type, Symbol.UnionType);
    let types = type.types.map(t => this.parseType(t));
    return typhenType.initialize(types);
  }

  private parseIntersectionType(type: ts.IntersectionType): Symbol.IntersectionType {
    let typhenType = this.createTyphenType<Symbol.IntersectionType>(type, Symbol.IntersectionType);
    let types = type.types.map(t => this.parseType(t));
    return typhenType.initialize(types);
  }

  private parseStringLiteralType(type: ts.StringLiteralType): Symbol.StringLiteralType {
    let typhenType = this.createTyphenType<Symbol.StringLiteralType>(type, Symbol.StringLiteralType);
    return typhenType.initialize(type.text);
  }

  private parseProperty(symbol: ts.Symbol, isOwn: boolean = true): Symbol.Property {
    let type = this.typeChecker.getTypeAtLocation(symbol.valueDeclaration);
    let propertyType = this.parseType(type);
    let isOptional = (<ts.PropertyDeclaration>symbol.valueDeclaration).questionToken != null;
    let isProtected = this.checkFlags(symbol.valueDeclaration.flags, ts.NodeFlags.Protected);

    let typhenSymbol = this.createTyphenSymbol<Symbol.Property>(symbol, Symbol.Property);
    return typhenSymbol.initialize(propertyType, isOptional, isOwn, isProtected);
  }

  private parseMethod(symbol: ts.Symbol, isOwn: boolean = true): Symbol.Method {
    let type = this.typeChecker.getTypeAtLocation(symbol.valueDeclaration);
    let callSignatures = type.getCallSignatures().map(s => this.parseSignature(s));
    let isOptional = (<ts.MethodDeclaration>symbol.valueDeclaration).questionToken != null;
    let isProtected = this.checkFlags(symbol.valueDeclaration.flags, ts.NodeFlags.Protected);
    let isAbstract = this.checkFlags(symbol.valueDeclaration.flags, ts.NodeFlags.Abstract);

    let typhenSymbol = this.createTyphenSymbol<Symbol.Method>(symbol, Symbol.Method);
    return typhenSymbol.initialize(callSignatures, isOptional, isOwn, isProtected, isAbstract);
  }

  private parseSignature(signature: ts.Signature, suffixName: string = 'Signature'): Symbol.Signature {
    let typeParameters = signature.typeParameters === undefined ? [] :
      signature.typeParameters.map(t => <Symbol.TypeParameter>this.parseType(t));
    let parameters = signature.getParameters().map(s => this.parseParameter(s));
    let returnType = this.parseType(signature.getReturnType());

    let typePredicate: Symbol.TypePredicate = null;
    let typePredicateNodes = signature.declaration.getChildren().filter(n => n.kind === ts.SyntaxKind.TypePredicate);
    if (typePredicateNodes.length > 0) {
      typePredicate = this.parseTypePredicate(<ts.TypePredicateNode>typePredicateNodes[0], parameters);
    }

    let typhenSymbol = this.createTyphenSymbol<Symbol.Signature>(signature, Symbol.Signature, suffixName);
    return typhenSymbol.initialize(typeParameters, parameters, returnType, typePredicate);
  }

  private parseTypePredicate(node: ts.TypePredicateNode, parameters: Symbol.Parameter[]): Symbol.TypePredicate {
    let type = this.parseType(this.typeChecker.getTypeAtLocation(node.type));
    let thisType = this.parseType(this.typeChecker.getTypeAtLocation(node.parameterName));
    let parameterNameText = node.parameterName.getText();
    let parameter = parameters.filter(p => p.name === parameterNameText)[0] || null;
    return new Symbol.TypePredicate(type, thisType, parameter);
  }

  private parseParameter(symbol: ts.Symbol): Symbol.Parameter {
    let type = this.typeChecker.getTypeAtLocation(symbol.valueDeclaration);
    let parameterType = this.parseType(type);

    let valueDecl = (<ts.ParameterDeclaration>symbol.valueDeclaration);
    let isOptional = valueDecl.questionToken != null;
    let isVariadic = valueDecl.dotDotDotToken != null;

    let typhenSymbol = this.createTyphenSymbol<Symbol.Parameter>(symbol, Symbol.Parameter);
    return typhenSymbol.initialize(parameterType, isOptional, isVariadic);
  }

  private parseVariable(symbol: ts.Symbol): Symbol.Variable {
    let type = this.typeChecker.getTypeAtLocation(symbol.valueDeclaration);
    let variableType: Symbol.Type = null;
    let variableModule: Symbol.Module = null;
    let isLet = symbol.valueDeclaration.parent.getChildren().filter(n => n.kind === ts.SyntaxKind.LetKeyword).length > 0;
    let isConst = symbol.valueDeclaration.parent.getChildren().filter(n => n.kind === ts.SyntaxKind.ConstKeyword).length > 0;

    if (_.isObject(type.symbol) && this.checkFlags(type.symbol.flags, ts.SymbolFlags.Module)) {
      variableModule = this.parseModule(type.symbol);
    } else {
      variableType = this.parseType(type);
    }

    let typhenSymbol = this.createTyphenSymbol<Symbol.Variable>(symbol, Symbol.Variable);
    return typhenSymbol.initialize(variableType, variableModule, isLet, isConst);
  }

  private parseTypeAlias(symbol: ts.Symbol): Symbol.TypeAlias {
    let type = this.typeChecker.getDeclaredTypeOfSymbol(symbol);
    let aliasedType = this.parseType(type);
    let typhenSymbol = this.createTyphenSymbol<Symbol.TypeAlias>(symbol, Symbol.TypeAlias);
    return typhenSymbol.initialize(aliasedType);
  }
}
