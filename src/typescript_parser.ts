/// <reference path="../typings/tsd.d.ts" />

import tss = require('typescript-services-api');
import ts = tss.ts;
import _ = require('lodash');
import inflection = require('inflection');

import Symbol = require('./symbol');
import Runner = require('./runner');

class TypeScriptParser {
  private program: tss.ts.Program;
  private typeChecker: ts.TypeChecker;
  private cachedTypes: { [index: number]: Symbol.Type } = {};
  private typhenPrimitiveTypeName: string = 'TyphenPrimitiveType';

  private static topLevelKinds: ts.SyntaxKind[] = [
    ts.SyntaxKind.FunctionDeclaration,
    ts.SyntaxKind.EnumDeclaration,
    ts.SyntaxKind.InterfaceDeclaration,
    ts.SyntaxKind.ClassDeclaration
  ];

  constructor(fileNames: string[], private runner: Runner.Runner) {
    this.program = ts.createProgram(fileNames, runner.compilerOptions, runner.compilerHost);
    this.typeChecker = this.program.getTypeChecker(true);
  }

  public get sourceFiles(): ts.SourceFile[] {
    var libFileName = this.program.getCompilerHost().getDefaultLibFilename();
    return this.program.getSourceFiles().filter(s => s.filename !== libFileName);
  }

  public get types(): Symbol.Type[] {
    return _.values(this.cachedTypes);
  }

  public parse(): Symbol.Type[] {
    var invalidSourceFileNames = this.sourceFiles.filter(s => s.filename.match(/.*\.d\.ts$/) === null);

    if (invalidSourceFileNames.length > 0) {
      throw new Error('Unsupported *.ts file: ' + invalidSourceFileNames.join(', '));
    }

    this.program.getDiagnostics().forEach(d => {
      if (d.category === ts.DiagnosticCategory.Error) {
        throw new Error([d.file.filename, ' (', d.start, ',', d.length, '): ', d.messageText].join(''));
      } else if (d.category === ts.DiagnosticCategory.Warning) {
        console.warn([d.file.filename, ' (', d.start, ',', d.length, '): ', d.messageText].join(''));
      }
    });
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

  private parseType(type: ts.Type): Symbol.Type {
    if (!_.isObject(type)) { return null; }

    if (this.cachedTypes[type.id] == null) {
      if (this.isTyphenPrimitiveType(type)) {
        return null;
      } else if (type.flags & ts.TypeFlags.StringLiteral) {
        this.cachedTypes[type.id] = this.parsePrimitive(<ts.StringLiteralType>type);
      } else if (type.flags & ts.TypeFlags.Intrinsic) {
        this.cachedTypes[type.id] = this.parsePrimitive(<ts.IntrinsicType>type);
      } else if (type.flags & ts.TypeFlags.Tuple) {
        this.cachedTypes[type.id] = this.parseTuple(<ts.TupleType>type);
      } else if (type.flags & ts.TypeFlags.Anonymous && type.symbol === undefined) {
        // Reach the scope if TypeParameter#constraint is not specified
        return null;
      } else if (type.symbol.flags & ts.SymbolFlags.Function) {
        this.cachedTypes[type.id] = this.parseFunction(<ts.ResolvedObjectType>type);
      } else if (type.symbol.flags & ts.SymbolFlags.Enum) {
        this.cachedTypes[type.id] = this.parseEnum(type);
      } else if (type.symbol.flags & ts.SymbolFlags.TypeParameter) {
        this.cachedTypes[type.id] = this.parseTypeParameter(<ts.TypeParameter>type);
      } else if (type.symbol.flags & ts.SymbolFlags.Class) {
        if (this.isExtendedTyphenPrimitiveType(<ts.GenericType>type)) {
          throw new Error('Can not define a class which is extended from the TyphenPrimitiveType: ' + type.symbol.name);
        } else {
          this.cachedTypes[type.id] = this.parseInterface(<ts.GenericType>type);
        }
      } else if (type.symbol.flags & ts.SymbolFlags.Interface) {
        if (this.isExtendedTyphenPrimitiveType(<ts.GenericType>type)) {
          this.cachedTypes[type.id] = this.parsePrimitive(<ts.GenericType>type);
        } else {
          this.cachedTypes[type.id] = this.parseInterface(<ts.GenericType>type);
        }
      } else if (type.symbol.flags & ts.SymbolFlags.TypeLiteral) {
        this.cachedTypes[type.id] = _.isEmpty(type.getCallSignatures()) ?
          this.parseObjectType(<ts.ResolvedObjectType>type) :
          this.parseFunction(<ts.ResolvedObjectType>type);
      } else {
        throw new Error('Unsupported type: ' + type.symbol.name +
              ' (TypeFlags:' + type.flags + ', SymbolFlags:' + type.symbol.flags + ')');
      }
    }
    return this.cachedTypes[type.id];
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
          results.push(parentDecl.symbol.name);
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
        throw new Error('Found the type with namespace which is extended from the TyphenPrimitiveType');
      }
    }
    return false;
  }

  private parseEnum(type: ts.Type): Symbol.Enum {
    var symbol = type.symbol;

    var moduleNames = this.getModuleNames(symbol);
    var memberValue = -1;
    var members = _(symbol.exports)
      .map((memberSymbol: ts.Symbol, name: string) => {
        var value = this.typeChecker.getEnumMemberValue(memberSymbol.valueDeclaration);
        memberValue = _.isNumber(value) ? value : memberValue + 1;
        return new Symbol.EnumMember(this.runner, memberSymbol.name,
            this.getDocComment(memberSymbol), memberValue);
      }).value();

    return new Symbol.Enum(this.runner, symbol.name, this.getDocComment(symbol),
        moduleNames, members);
  }

  private parseGenericType(type: ts.GenericType, genericTypeClass: typeof Symbol.Interface): Symbol.Interface {
    var symbol = type.symbol;
    var genericType = type.target === undefined ? type : type.target;

    var name = symbol === undefined || type.flags & ts.TypeFlags.Anonymous ? '' : symbol.name;
    var moduleNames = this.getModuleNames(symbol);

    var properties = genericType.getProperties()
        .filter(s => s.flags === ts.SymbolFlags.Property)
        .map(s => this.parseProperty(s, _.contains(genericType.declaredProperties, s)));
    var methods = genericType.getProperties()
        .filter(s => s.flags === ts.SymbolFlags.Method)
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

    return new genericTypeClass(this.runner, name, this.getDocComment(symbol), moduleNames,
        properties, methods, stringIndexType, numberIndexType,
        constructorSignatures, callSignatures,
        baseTypes, typeParameters, typeArguments);
  }

  private parseInterface(type: ts.GenericType): Symbol.Interface {
    return <Symbol.Interface>this.parseGenericType(type, Symbol.Interface);
  }

  private parseClass(type: ts.GenericType): Symbol.Class {
    return <Symbol.Class>this.parseGenericType(type, Symbol.Class);
  }

  private parseObjectType(type: ts.ResolvedObjectType): Symbol.ObjectType {
    var name = type.symbol.name.replace(/^__.*$/, '');
    var moduleNames = this.getModuleNames(type.symbol);
    var assumedName = _.isEmpty(name) ?
      this.getAssumedName(type.symbol, 'Object') : '';
    var properties = type.getProperties()
        .filter(s => s.flags === ts.SymbolFlags.Property)
        .map(s => this.parseProperty(s));
    var methods = type.getProperties()
        .filter(s => s.flags === ts.SymbolFlags.Method)
        .map(s => this.parseMethod(s));
    var stringIndexType = this.parseType(type.getStringIndexType());
    var numberIndexType = this.parseType(type.getNumberIndexType());
    return new Symbol.ObjectType(this.runner, name, this.getDocComment(type.symbol),
        moduleNames, assumedName, properties, methods, stringIndexType, numberIndexType);
  }

  private parseFunction(type: ts.ResolvedObjectType): Symbol.Function {
    var name = type.symbol.name.replace(/^__.*$/, '');
    var moduleNames = this.getModuleNames(type.symbol);
    var assumedName = _.isEmpty(name) ?
      this.getAssumedName(type.symbol, 'Function') : '';
    var callSignatures = type.getCallSignatures().map(s => this.parseSignature(s));
    return new Symbol.Function(this.runner, name, this.getDocComment(type.symbol),
        moduleNames, assumedName, callSignatures);
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
    return new Symbol.Primitive(this.runner, name, this.getDocComment(type.symbol));
  }

  private parseTypeParameter(typeParameter: ts.TypeParameter): Symbol.TypeParameter {
    var constraint = this.parseType(typeParameter.constraint);
    var moduleNames = this.getModuleNames(typeParameter.symbol);
    return new Symbol.TypeParameter(this.runner, typeParameter.symbol.name,
        this.getDocComment(typeParameter.symbol), moduleNames, constraint);
  }

  private parseTuple(type: ts.TupleType): Symbol.Tuple {
    var elementTypes = type.elementTypes.map(t => this.parseType(t));
    var baseArrayType = this.parseType(type.baseArrayType);
    return new Symbol.Tuple(this.runner, elementTypes, baseArrayType);
  }

  private parseProperty(symbol: ts.Symbol, isOwn: boolean = true): Symbol.Property {
    var type = this.typeChecker.getTypeOfNode(symbol.declarations[0]);
    var propertyType = this.parseType(type);
    var isOptional = symbol.valueDeclaration.flags === ts.NodeFlags.QuestionMark;
    return new Symbol.Property(this.runner, symbol.name, this.getDocComment(symbol),
        propertyType, isOptional, isOwn);
  }

  private parseMethod(symbol: ts.Symbol, isOwn: boolean = true): Symbol.Method {
    var type = this.typeChecker.getTypeOfNode(symbol.declarations[0]);
    var callSignatures = type.getCallSignatures().map(s => this.parseSignature(s));
    var isOptional = symbol.valueDeclaration.flags === ts.NodeFlags.QuestionMark;
    return new Symbol.Method(this.runner, symbol.name, this.getDocComment(symbol),
        callSignatures, isOptional, isOwn);
  }

  private parseSignature(signature: ts.Signature): Symbol.Signature {
    var symbol = signature.declaration.symbol;

    var name = symbol.name.replace(/^__.*$/, '');
    var assumedName = _.isEmpty(name) ?
      this.getAssumedName(symbol, 'Signature') : '';
    var typeParameters = signature.typeParameters === undefined ? [] :
      signature.typeParameters.map(t => <Symbol.TypeParameter>this.parseType(t));
    var parameters = signature.getParameters().map(s => this.parseParameter(s));
    var returnType = this.parseType(signature.getReturnType());

    return new Symbol.Signature(this.runner, name, this.getDocComment(symbol),
        assumedName, typeParameters, parameters, returnType);
  }

  private parseParameter(symbol: ts.Symbol): Symbol.Parameter {
    var type = this.typeChecker.getTypeOfNode(symbol.declarations[0]);
    var parameterType = this.parseType(type);
    var isOptional = symbol.valueDeclaration.flags === ts.NodeFlags.QuestionMark;
    return new Symbol.Parameter(this.runner, symbol.name, this.getDocComment(symbol),
        parameterType, isOptional);
  }
}

export = TypeScriptParser;
