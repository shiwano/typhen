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

  private emptyType: Symbol.EmptyType;
  private moduleCache: HashMap<string, Symbol.Module> = new HashMap<string, Symbol.Module>();
  private typeCache: HashMap<ts.Type, Symbol.Type> = new HashMap<ts.Type, Symbol.Type>();
  private symbols: Symbol.Symbol[] = [];

  private arrayTypeName: string = 'Array';

  private typeReferenceStack: Symbol.TypeReference[] = [];
  private get currentTypeReference(): Symbol.TypeReference { return _.last(this.typeReferenceStack); }

  constructor(private fileNames: string[], private config: config.Config) {
    this.emptyType = new Symbol.EmptyType(config, '', [], [], [], null, '');
  }

  get sourceFiles(): ts.SourceFile[] {
    return this.program.getSourceFiles()
      .filter(s => {
        let resolvedPath = this.config.env.resolvePath(s.fileName);
        return resolvedPath !== this.config.env.defaultLibFileName &&
          _.includes(resolvedPath, this.config.typingDirectory);
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
    this.types.forEach(t => {
      if (t.isAnonymousType && t.parentModule != null) {
        t.parentModule.anonymousTypes.push(t);
      }
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

  private tryGetSymbolAtLocation(node: ts.Node): ts.Symbol | undefined {
    return (node as any).symbol;
  }

  private getSymbolAtLocation(node: ts.Node): ts.Symbol {
    let symbol = this.tryGetSymbolAtLocation(node);
    if (symbol === undefined) { throw new Error('Failed to get a symbol'); }
    return symbol;
  }

  private checkFlags(flagsA: number, flagsB: number): boolean {
    return (flagsA & flagsB) > 0;
  }

  private checkModifiers(modifiers: ts.ModifiersArray | undefined, kind: ts.SyntaxKind): boolean {
    if (!modifiers) { return false; }
    return _.values<ts.Modifier>(modifiers).some(x => x.kind === kind);
  }

  private makeErrorWithTypeInfo(message: string, type: ts.Type): Error {
    let typeInfo = ': TypeFlags: ' + type.flags;
    if (type.symbol) {
      return this.makeErrorWithSymbolInfo(message + typeInfo, type.symbol);
    } else {
      return new Error(message + typeInfo);
    }
  }

  private makeErrorWithSymbolInfo(message: string, symbol: ts.Symbol): Error {
    let infos = this.getDeclarationInfos(symbol);
    let symbolInfo = infos.length > 0 ? ': ' + infos.map(d => d.toString()).join(',') : '';
    return new Error(message + symbolInfo);
  }

  private parseType(type: ts.Type): Symbol.Type {
    if (!_.isObject(type)) { return this.emptyType; }

    if (this.typeCache.get(type) === undefined) {
      if (type.flags & ts.TypeFlags.TypeParameter) {
        this.parseTypeParameter(<ts.TypeParameter>type);
      } else if (type.flags & ts.TypeFlags.String) {
        this.parsePrimitiveType(type);
      } else if (type.flags & ts.TypeFlags.StringLiteral) {
        this.parseStringLiteralType(<ts.LiteralType>type);
      } else if (type.flags & ts.TypeFlags.BooleanLiteral) {
        this.parseBooleanLiteralType(<ts.LiteralType>type);
      } else if (type.flags & ts.TypeFlags.NumberLiteral) {
        this.parseNumberLiteralType(<ts.LiteralType>type);
      } else if (type.flags & ts.TypeFlags.EnumLiteral) {
        this.parseEnumLiteralType(<ts.EnumLiteralType>type);
      } else if (type.flags & ts.TypeFlags.Number) {
        this.parsePrimitiveType(type);
      } else if (type.flags & ts.TypeFlags.Boolean) {
        this.parsePrimitiveType(type);
      } else if (type.flags & ts.TypeFlags.ESSymbol) {
        this.parsePrimitiveType(type);
      } else if (type.flags & ts.TypeFlags.Void) {
        this.parsePrimitiveType(type);
      } else if (type.flags & ts.TypeFlags.Null) {
        this.parsePrimitiveType(type);
      } else if (type.flags & ts.TypeFlags.Never) {
        this.parsePrimitiveType(type);
      } else if (type.flags & ts.TypeFlags.Any) {
        let anyType = this.typeCache.values().filter(t => t.isPrimitiveType && t.name === 'any')[0];
        if (anyType) {
          return anyType;
        }
        this.parsePrimitiveType(type);
      } else if (type.flags & ts.TypeFlags.Enum) {
        this.parseEnum(<ts.EnumType>type);
      } else if (type.flags & ts.TypeFlags.Union) {
        this.parseUnionType(<ts.UnionType>type);
      } else if (type.flags & ts.TypeFlags.Intersection) {
        this.parseIntersectionType(<ts.IntersectionType>type);
      } else if (type.flags & ts.TypeFlags.Object &&
                (<ts.ObjectType>type).objectFlags & ts.ObjectFlags.Reference &&
                (<ts.TypeReference>type).target.objectFlags & ts.ObjectFlags.Tuple)  {
        this.parseTuple(<ts.TypeReference>type);
      } else if (type.flags & ts.TypeFlags.IndexedAccess) {
        return this.emptyType;
      } else if (type.flags & ts.TypeFlags.Object &&
                (<ts.ObjectType>type).objectFlags & ts.ObjectFlags.Anonymous &&
                type.symbol === undefined) {
        // Reach the scope if TypeParameter#constraint is not specified
        return this.emptyType;
      } else if (type.symbol === undefined) {
        throw this.makeErrorWithTypeInfo('Unsupported type', type);
      } else if (type.symbol.flags & ts.SymbolFlags.Function) {
        this.parseFunction(<ts.ObjectType>type);
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
        throw this.makeErrorWithTypeInfo('Unsupported type', type);
      }
    }
    let typhenType = this.typeCache.get(type);

    if (typhenType.isTypeParameter && _.isObject(this.currentTypeReference)) {
      return this.currentTypeReference.getTypeByTypeParameter(<Symbol.TypeParameter>typhenType) || typhenType;
    } else {
      return typhenType;
    }
  }

  private createTyphenSymbol<T extends Symbol.Symbol>(symbol: ts.Symbol | undefined,
      typhenSymbolClass: typeof Symbol.Symbol, assumedNameSuffix?: string): T {
    let typhenSymbol: T;
    if (symbol === undefined) {
      typhenSymbol = <T>new typhenSymbolClass(this.config, '', [], [], [], null, '');
    } else {
      let name = _.isObject(symbol) && typeof symbol.name === 'string' ?
        symbol.name.replace(/^__@/, '@@').replace(/^__.*$/, '') : '';
      let assumedName = _.isEmpty(name) && assumedNameSuffix ?
        this.getAssumedName(symbol, assumedNameSuffix) : '';
      typhenSymbol = <T>new typhenSymbolClass(this.config, name,
        this.getDocComment(symbol), this.getDeclarationInfos(symbol),
        this.getDecorators(symbol), this.getParentModule(symbol), assumedName);
    }
    logger.debug('Creating', (<any>typhenSymbolClass).name + ':',
      'module=' + typhenSymbol.ancestorModules.map(s => s.name).join('.') + ',', 'name=' + typhenSymbol.rawName + ',',
      'declarations=' + typhenSymbol.declarationInfos.map(d => d.toString()).join(','));
    this.symbols.push(typhenSymbol);
    return typhenSymbol;
  }

  private createTyphenType<T extends Symbol.Type>(type: ts.Type,
      typhenTypeClass: typeof Symbol.Type, assumedNameSuffix?: string): T {
    if (this.typeCache.get(type)) {
      throw this.makeErrorWithTypeInfo('Already created the type', type);
    }
    let typhenType = this.createTyphenSymbol<T>(type.symbol, typhenTypeClass, assumedNameSuffix);
    this.typeCache.set(type, typhenType);
    return typhenType;
  }

  private getOrCreateTyphenModule(symbol: ts.Symbol | undefined): Symbol.Module {
    let name = symbol ? symbol.name : '';
    if (this.moduleCache.get(name)) { return this.moduleCache.get(name); }

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

  private getDecorators(symbol: ts.Symbol): Symbol.Decorator[] {
    if (symbol.valueDeclaration === undefined || symbol.valueDeclaration.decorators === undefined) {
      return [];
    }
    return symbol.valueDeclaration.decorators.map(d => this.parseDecorator(d));
  }

  private getParentModule(symbol: ts.Symbol): Symbol.Module | null {
    let parentDecl = symbol.declarations ?  symbol.declarations[0].parent : undefined;
    while (parentDecl) {
      let parentSymbol = this.tryGetSymbolAtLocation(parentDecl);

      if (parentSymbol && this.checkFlags(parentSymbol.flags, ts.SymbolFlags.Module)) {
        return this.getOrCreateTyphenModule(parentSymbol);
      }
      parentDecl = parentDecl.parent;
    }
    return null;
  }

  private getDocComment(symbolOrSignature: ts.Symbol): string[] {
    return _.tap([], (results: string[]) => {
      if (!_.isObject(symbolOrSignature)) { return; }

      (symbolOrSignature.declarations || []).forEach(decl => {
        let jsDocs: ts.JSDoc[] = (decl as any).jsDoc || []; // FIXME: TypeScript does not export JSDoc getting API at present.
        jsDocs.forEach(jsDoc => {
          if (typeof jsDoc.comment === 'string') {
            results.push(jsDoc.comment);
          }
          if (jsDoc.tags) {
            jsDoc.tags.forEach(tag => {
              results.push('@' + tag.tagName.text + ' ' + tag.comment);
            });
          }
        });
      });
    });
  }

  private getAssumedName(symbol: ts.Symbol, typeName: string): string {
    if (!_.isObject(symbol)) {
      return typeName;
    }

    let parentNames: string[] = [];
    let parentDecl = symbol.declarations ? symbol.declarations[0].parent : undefined;

    while (parentDecl) {
      let parentSymbol = this.tryGetSymbolAtLocation(parentDecl);

      if (parentSymbol) {
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
    if (!type.symbol) { return false; }
    return _.isObject(type.symbol) && _.includes(this.config.plugin.customPrimitiveTypes, type.symbol.name);
  }

  private isArrayType(type: ts.Type): boolean {
    if (!type.symbol) { return false; }
    return type.symbol.name === this.arrayTypeName &&
           this.getParentModule(type.symbol) === null;
  }

  private getSymbolsInScope(node: ts.Node, symbolFlags: ts.SymbolFlags): ts.Symbol[] {
    return this.typeChecker.getSymbolsInScope(node, symbolFlags)
      .filter(symbol => {
        return (symbol.declarations || []).every(d => {
          let resolvedPath = this.config.env.resolvePath(d.getSourceFile().fileName);
          return resolvedPath !== this.config.env.defaultLibFileName &&
            _.includes(resolvedPath, this.config.typingDirectory);
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
    let sourceSymbol = this.tryGetSymbolAtLocation(sourceFile);
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
        } else if (aliasedSymbol.declarations) {
          let aliasedType = this.typeChecker.getTypeAtLocation(aliasedSymbol.declarations[0]);
          importedTypeTable[s.name] = this.parseType(aliasedType);
        }
      });
    let types = this.getSymbolsInScope(sourceFile, ts.SymbolFlags.Type)
      .concat(this.getSymbolsInScope(sourceFile, ts.SymbolFlags.Function))
      .filter(s => s.declarations && s.declarations.length > 0)
      .map(s => this.typeChecker.getTypeAtLocation((s.declarations as ts.Node[])[0]))
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
    let exportedSymbols = this.typeChecker.getExportsOfModule(symbol);
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
        } else if (aliasedSymbol.declarations) {
          let aliasedType = this.typeChecker.getTypeAtLocation(aliasedSymbol.declarations[0]);
          importedTypeTable[s.name] = this.parseType(aliasedType);
        }
      });
    let types = exportedSymbols
      .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.Type) || this.checkFlags(s.flags, ts.SymbolFlags.Function))
      .filter(s => s.declarations && s.declarations.length > 0)
      .map(s => this.typeChecker.getTypeAtLocation((s.declarations as ts.Node[])[0]))
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

  private parseEnum(type: ts.EnumType): Symbol.Enum {
    if (!type.symbol || !type.symbol.valueDeclaration) {
      throw this.makeErrorWithTypeInfo('Failed to parse enum type', type);
    }
    let typhenType = this.createTyphenType<Symbol.Enum>(type, Symbol.Enum);
    let isConst = this.checkFlags(type.symbol.valueDeclaration.flags, ts.NodeFlags.Const);
    let members = _((<ts.EnumDeclaration>type.symbol.valueDeclaration).members)
      .map((memberNode: ts.EnumMember) => {
        let memberSymbol = this.getSymbolAtLocation(memberNode);
        let value = this.typeChecker.getConstantValue(memberNode);
        return this.createTyphenSymbol<Symbol.EnumMember>(memberSymbol, Symbol.EnumMember)
          .initialize(value);
      }).value();

    return typhenType.initialize(members, isConst);
  }

  private parseIndexInfos(type: ts.InterfaceTypeWithDeclaredMembers):
      { stringIndex: Symbol.IndexInfo | null, numberIndex: Symbol.IndexInfo | null } {
    if (!type.symbol || !type.symbol.members) {
      throw this.makeErrorWithTypeInfo('Failed to parse index info', type);
    }
    let indexSymbol = type.symbol.members.get('__index') || null;
    let stringIndex: Symbol.IndexInfo | null = null;
    let numberIndex: Symbol.IndexInfo | null = null;

    if (type.getStringIndexType() != null) {
      let stringIndexType = this.parseType(type.getStringIndexType());
      let isReadonly = false;
      if (type.declaredStringIndexInfo != null) {
        isReadonly = type.declaredStringIndexInfo.isReadonly;
      } else if (indexSymbol != null && indexSymbol.declarations) {
        isReadonly = this.checkModifiers(indexSymbol.declarations[0].modifiers, ts.SyntaxKind.ReadonlyKeyword);
      }
      stringIndex = new Symbol.IndexInfo(stringIndexType, isReadonly);
    }
    if (type.getNumberIndexType() != null) {
      let numberIndexType = this.parseType(type.getNumberIndexType());
      let isReadonly = false;
      if (type.declaredNumberIndexInfo != null) {
        isReadonly = type.declaredNumberIndexInfo.isReadonly;
      } else if (indexSymbol != null && indexSymbol.declarations) {
        isReadonly = this.checkModifiers(indexSymbol.declarations[0].modifiers, ts.SyntaxKind.ReadonlyKeyword);
      }
      numberIndex = new Symbol.IndexInfo(numberIndexType, isReadonly);
    }
    return { stringIndex: stringIndex, numberIndex: numberIndex };
  }

  private parseGenericType<T extends Symbol.Interface>(type: ts.GenericType, typhenTypeClass: typeof Symbol.Interface): T {
    let genericType = type.target === undefined ? type : type.target;
    if (!genericType.symbol || !genericType.symbol.members) {
      throw this.makeErrorWithTypeInfo('Failed to parse generic type', type);
    }

    let ownMemberNames = _.toArray<ts.Symbol>(genericType.symbol.members.values()).map(s => s.name);
    let typhenType = this.createTyphenType<T>(type, typhenTypeClass);

    let typeParameters = genericType.typeParameters === undefined ? [] :
      genericType.typeParameters.map(t => <Symbol.TypeParameter>this.parseType(t));
    let typeArguments = type.typeArguments === undefined ? [] :
      type.typeArguments.map(t => this.parseType(t));
    let typeReference = new Symbol.TypeReference(typeParameters, typeArguments);
    this.typeReferenceStack.push(typeReference);

    let properties = genericType.getProperties()
        .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.Property) && s.valueDeclaration !== undefined &&
            !this.checkModifiers(s.valueDeclaration.modifiers, ts.SyntaxKind.PrivateKeyword))
        .map(s => this.parseProperty(s, _.includes(ownMemberNames, s.name)));
    let rawMethods = genericType.getProperties()
        .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.Method) && s.valueDeclaration !== undefined &&
            !this.checkModifiers(s.valueDeclaration.modifiers, ts.SyntaxKind.PrivateKeyword))
        .map(s => this.parseMethod(s, _.includes(ownMemberNames, s.name)));
    let methods = rawMethods.filter(m => m.name.indexOf('@@') !== 0);
    let builtInSymbolMethods = rawMethods.filter(m => m.name.indexOf('@@') === 0);

    let indexInfos = this.parseIndexInfos(<any>genericType as ts.InterfaceTypeWithDeclaredMembers);
    let stringIndex = indexInfos.stringIndex;
    let numberIndex = indexInfos.numberIndex;

    let constructorSignatures = genericType.getConstructSignatures()
      .filter(s => _.isObject(s.declaration)) // constructor signature that has no declaration will be created by using typeof keyword.
      .map(s => this.parseSignature(s, 'Constructor'));
    let callSignatures = genericType.getCallSignatures().map(s => this.parseSignature(s));

    let baseTypes = this.typeChecker.getBaseTypes(genericType)
      .map(t => <Symbol.Interface>this.parseType(t));

    let staticProperties: Symbol.Property[] = [];
    let staticMethods: Symbol.Method[] = [];
    let isAbstract = false;

    if (genericType.symbol.flags & ts.SymbolFlags.Class) {
      let genericTypeDecl = <ts.ClassLikeDeclaration>genericType.symbol.valueDeclaration;
      isAbstract = this.checkModifiers(genericTypeDecl.modifiers, ts.SyntaxKind.AbstractKeyword);

      _.toArray<ts.Symbol>(genericType.symbol.members.values())
        .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.Constructor))
        .forEach(s => {
          (s.declarations || []).forEach(d => {
            let signatureSymbol = this.typeChecker.getSignatureFromDeclaration(<ts.SignatureDeclaration>d);
            let constructorSignature = this.parseSignature(signatureSymbol, 'Constructor');
            constructorSignatures.push(constructorSignature);
        });
      });
      let staticMemberSymbols = _.values<ts.ClassElement>(genericTypeDecl.members)
        .filter(d => this.checkModifiers(d.modifiers, ts.SyntaxKind.StaticKeyword))
        .map<ts.Symbol>(d => this.getSymbolAtLocation(d))
        .filter(s => s && !this.checkFlags(s.flags, ts.SymbolFlags.Prototype));
      staticProperties = staticMemberSymbols
        .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.Property) && s.valueDeclaration !== undefined &&
            !this.checkModifiers(s.valueDeclaration.modifiers, ts.SyntaxKind.PrivateKeyword))
        .map(s => this.parseProperty(s));
      staticMethods = staticMemberSymbols
        .filter(s => this.checkFlags(s.flags, ts.SymbolFlags.Method) && s.valueDeclaration !== undefined &&
            !this.checkModifiers(s.valueDeclaration.modifiers, ts.SyntaxKind.PrivateKeyword))
        .map(s => this.parseMethod(s));
    }

    this.typeReferenceStack.pop();
    return <T>typhenType.initialize(properties, methods, builtInSymbolMethods,
        stringIndex, numberIndex, constructorSignatures, callSignatures,
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

    let indexInfos = this.parseIndexInfos(<any>type as ts.InterfaceTypeWithDeclaredMembers);
    let stringIndex = indexInfos.stringIndex;
    let numberIndex = indexInfos.numberIndex;

    return typhenType.initialize(properties, methods, builtInSymbolMethods, stringIndex, numberIndex);
  }

  private parseArray(type: ts.GenericType): Symbol.Array {
    if (!type.typeArguments) {
      throw this.makeErrorWithTypeInfo('Failed to parse array type', type);
    }
    let typhenType = this.createTyphenType<Symbol.Array>(type, Symbol.Array);
    let typeArguments = type.typeArguments.map(t => this.parseType(t));
    let arrayType = typeArguments[0];
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
    } else if (this.checkFlags(type.flags, ts.TypeFlags.Null)) {
      name = 'null';
    } else if (this.checkFlags(type.flags, ts.TypeFlags.Never)) {
      name = 'never';
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

  private parseTuple(type: ts.TypeReference): Symbol.Tuple {
    let typhenType = this.createTyphenType<Symbol.Tuple>(type, Symbol.Tuple);
    let elementTypes = type.typeArguments.map(t => this.parseType(t));
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

  private parseStringLiteralType(type: ts.LiteralType): Symbol.StringLiteralType {
    let typhenType = this.createTyphenType<Symbol.StringLiteralType>(type, Symbol.StringLiteralType);
    return typhenType.initialize(type.text);
  }

  private parseBooleanLiteralType(type: ts.LiteralType): Symbol.BooleanLiteralType {
    let typhenType = this.createTyphenType<Symbol.BooleanLiteralType>(type, Symbol.BooleanLiteralType);
    let intrinsicName = (type as any).intrinsicName;
    return typhenType.initialize(intrinsicName === 'true');
  }

  private parseNumberLiteralType(type: ts.LiteralType): Symbol.NumberLiteralType {
    let typhenType = this.createTyphenType<Symbol.NumberLiteralType>(type, Symbol.NumberLiteralType);
    return typhenType.initialize(Number(type.text));
  }

  private parseEnumLiteralType(type: ts.EnumLiteralType): Symbol.EnumLiteralType {
    if (!type.symbol) {
      throw this.makeErrorWithTypeInfo('Failed to parse enum literal type', type);
    }
    let typhenType = this.createTyphenType<Symbol.EnumLiteralType>(type, Symbol.EnumLiteralType);
    let enumType = this.parseType(type.baseType) as Symbol.Enum;
    let enumMemberName = type.symbol.name || '';
    let enumMember = enumType.members.filter(m => m.rawName === enumMemberName)[0];
    return typhenType.initialize(enumType, enumMember);
  }

  private parseProperty(symbol: ts.Symbol, isOwn: boolean = true): Symbol.Property {
    if (!symbol.valueDeclaration) {
      throw this.makeErrorWithSymbolInfo('Failed to parse property', symbol);
    }
    let type = this.typeChecker.getTypeAtLocation(symbol.valueDeclaration);
    let propertyType = this.parseType(type);
    let isOptional = (<ts.PropertyDeclaration>symbol.valueDeclaration).questionToken != null;
    let isProtected = this.checkModifiers(symbol.valueDeclaration.modifiers, ts.SyntaxKind.ProtectedKeyword);
    let isReadOnly = this.checkModifiers(symbol.valueDeclaration.modifiers, ts.SyntaxKind.ReadonlyKeyword);
    let isAbstract = this.checkModifiers(symbol.valueDeclaration.modifiers, ts.SyntaxKind.AbstractKeyword);

    let typhenSymbol = this.createTyphenSymbol<Symbol.Property>(symbol, Symbol.Property);
    return typhenSymbol.initialize(propertyType, isOptional, isOwn, isProtected, isReadOnly, isAbstract);
  }

  private parseMethod(symbol: ts.Symbol, isOwn: boolean = true): Symbol.Method {
    if (!symbol.valueDeclaration) {
      throw this.makeErrorWithSymbolInfo('Failed to parse method', symbol);
    }
    let type = this.typeChecker.getTypeAtLocation(symbol.valueDeclaration);
    let callSignatures = type.getCallSignatures().map(s => this.parseSignature(s));
    let isOptional = (<ts.MethodDeclaration>symbol.valueDeclaration).questionToken != null;
    let isAbstract = this.checkModifiers(symbol.valueDeclaration.modifiers, ts.SyntaxKind.AbstractKeyword);

    let typhenSymbol = this.createTyphenSymbol<Symbol.Method>(symbol, Symbol.Method);
    return typhenSymbol.initialize(callSignatures, isOptional, isOwn, isAbstract);
  }

  private parseSignature(signature: ts.Signature, suffixName: string = 'Signature'): Symbol.Signature {
    let typeParameters = signature.typeParameters === undefined ? [] :
      signature.typeParameters.map(t => <Symbol.TypeParameter>this.parseType(t));
    let parameters = signature.getParameters().map(s => this.parseParameter(s));
    let returnType = this.parseType(signature.getReturnType());
    let isProtected = this.checkModifiers(signature.declaration.modifiers, ts.SyntaxKind.ProtectedKeyword);

    let typePredicate: Symbol.TypePredicate | null = null;
    let typePredicateNodes = signature.declaration.getChildren().filter(n => n.kind === ts.SyntaxKind.TypePredicate);
    if (typePredicateNodes.length > 0) {
      typePredicate = this.parseTypePredicate(<ts.TypePredicateNode>typePredicateNodes[0], parameters);
    }

    let symbol = this.getSymbolAtLocation(signature.declaration);
    let typhenSymbol = this.createTyphenSymbol<Symbol.Signature>(symbol, Symbol.Signature, suffixName);
    return typhenSymbol.initialize(typeParameters, parameters, returnType, typePredicate, isProtected);
  }

  private parseTypePredicate(node: ts.TypePredicateNode, parameters: Symbol.Parameter[]): Symbol.TypePredicate {
    let type = this.parseType(this.typeChecker.getTypeAtLocation(node.type));
    let thisType = this.parseType(this.typeChecker.getTypeAtLocation(node.parameterName));
    let parameterNameText = node.parameterName.getText();
    let parameter = parameters.filter(p => p.name === parameterNameText)[0] || null;
    return new Symbol.TypePredicate(type, thisType, parameter);
  }

  private parseParameter(symbol: ts.Symbol): Symbol.Parameter {
    if (!symbol.valueDeclaration) {
      throw this.makeErrorWithSymbolInfo('Failed to parse parameter', symbol);
    }
    let type = this.typeChecker.getTypeAtLocation(symbol.valueDeclaration);
    let parameterType = this.parseType(type);

    let valueDecl = (<ts.ParameterDeclaration>symbol.valueDeclaration);
    let isOptional = valueDecl.questionToken != null;
    let isVariadic = valueDecl.dotDotDotToken != null;

    let typhenSymbol = this.createTyphenSymbol<Symbol.Parameter>(symbol, Symbol.Parameter);
    return typhenSymbol.initialize(parameterType, isOptional, isVariadic);
  }

  private parseVariable(symbol: ts.Symbol): Symbol.Variable {
    if (!symbol.valueDeclaration || !symbol.valueDeclaration.parent) {
      throw this.makeErrorWithSymbolInfo('Failed to parse variable', symbol);
    }
    let type = this.typeChecker.getTypeAtLocation(symbol.valueDeclaration);
    let variableType: Symbol.Type | null = null;
    let variableModule: Symbol.Module | null = null;
    let isLet = symbol.valueDeclaration.parent.getChildren().filter(n => n.kind === ts.SyntaxKind.LetKeyword).length > 0;
    let isConst = symbol.valueDeclaration.parent.getChildren().filter(n => n.kind === ts.SyntaxKind.ConstKeyword).length > 0;

    if (type.symbol && this.checkFlags(type.symbol.flags, ts.SymbolFlags.Module)) {
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
