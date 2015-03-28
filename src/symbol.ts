/// <reference path="../typings/bundle.d.ts" />

import _ = require('lodash');
import inflection = require('inflection');

import Runner = require('./runner');

export enum SymbolKind {
  Invalid,
  Module,
  PrimitiveType,
  Enum,
  EnumMember,
  ObjectType,
  Interface,
  Class,
  Array,
  Function,
  TypeParameter,
  Tuple,
  UnionType,
  Property,
  Method,
  Signature,
  Parameter,
  Variable,
  TypeAlias
}

export interface ObjectTable<T> {
  [name: string]: T;
}

export class Tag {
  constructor(
      public name: string,
      public value: string = '') {
  }

  public get number(): number {
    var n = Number(this.value);
    return typeof n === 'number' ? n : 0;
  }

  public get boolean(): boolean {
    return this.value !== 'false';
  }
}

export class DeclarationInfo {
  constructor(
      public fileName: string,
      public path: string,
      public fullText: string,
      public lineAndCharacterNumber: {
        line: number;
        character: number;
      }) {
  }

  public toString(): string {
    return this.fileName +
      '(' + this.lineAndCharacterNumber.line + ',' +
      this.lineAndCharacterNumber.character + ')';
  }
}

export class Symbol {
  private static tagPattern: RegExp = /^\s*@([^\s@]+)\s*([^\s@]*)\s*$/m;
  public kind: SymbolKind = SymbolKind.Invalid;
  private isDestroyed: boolean = false;

  constructor(
      protected runner: Runner.Runner,
      public rawName: string,
      public docComment: string[],
      public declarationInfos: DeclarationInfo[],
      public parentModule: Module,
      public assumedName: string) {
  }

  public get name(): string {
    var name = _.isEmpty(this.assumedName) ? this.rawName : this.assumedName;
    return this.runner.config.plugin.rename(this, name);
  }

  public get fullName(): string {
    if (this.parentModule === null) { return this.name; }
    return [this.namespace, this.name].join(this.runner.config.plugin.namespaceSeparator);
  }

  public get namespace(): string {
    return this.ancestorModules.map(s => s.name).join(this.runner.config.plugin.namespaceSeparator);
  }

  public get ancestorModules(): Module[] {
    return _.tap([], (results) => {
      var parentModule = this.parentModule;
      while (_.isObject(parentModule)) {
        results.push(parentModule);
        parentModule = parentModule.parentModule;
      }
    }).reverse();
  }

  public get comment(): string {
    return this.docComment
      .filter(c => !Symbol.tagPattern.test(c))
      .join(this.runner.config.plugin.newLine);
  }

  public get tagTable(): ObjectTable<Tag> {
    return <ObjectTable<Tag>>_.reduce(this.docComment, (result, comment) => {
      var matches = comment.match(Symbol.tagPattern);
      if (matches != null) { result[matches[1]] = new Tag(matches[1], matches[2]); }
      return result;
    }, <ObjectTable<Tag>>{});
  }

  public get tags(): Tag[] {
    return _.values(this.tagTable);
  }

  public get isAnonymousType(): boolean { return this.isType && this.rawName.length <= 0; }
  public get isType(): boolean { return false; }
  public get isGenericType(): boolean { return false; }
  public get isGlobalModule(): boolean { return false; }

  public get isModule(): boolean { return this.kind === SymbolKind.Module; }
  public get isPrimitiveType(): boolean { return this.kind === SymbolKind.PrimitiveType; }
  public get isEnum(): boolean { return this.kind === SymbolKind.Enum; }
  public get isEnumMember(): boolean { return this.kind === SymbolKind.EnumMember; }
  public get isObjectType(): boolean { return this.kind === SymbolKind.ObjectType; }
  public get isInterface(): boolean { return this.kind === SymbolKind.Interface; }
  public get isClass(): boolean { return this.kind === SymbolKind.Class; }
  public get isArray(): boolean { return this.kind === SymbolKind.Array; }
  public get isFunction(): boolean { return this.kind === SymbolKind.Function; }
  public get isTypeParameter(): boolean { return this.kind === SymbolKind.TypeParameter; }
  public get isTuple(): boolean { return this.kind === SymbolKind.Tuple; }
  public get isUnionType(): boolean { return this.kind === SymbolKind.UnionType; }
  public get isProperty(): boolean { return this.kind === SymbolKind.Property; }
  public get isMethod(): boolean { return this.kind === SymbolKind.Method; }
  public get isSignature(): boolean { return this.kind === SymbolKind.Signature; }
  public get isParameter(): boolean { return this.kind === SymbolKind.Parameter; }
  public get isVariable(): boolean { return this.kind === SymbolKind.Variable; }
  public get isTypeAlias(): boolean { return this.kind === SymbolKind.TypeAlias; }

  public get isGenerationTarget(): boolean {
    return this.declarationInfos.every(d => {
      var resolvedPath = this.runner.config.env.resolvePath(d.path);
      return resolvedPath !== this.runner.config.env.defaultLibFileName &&
        _.contains(resolvedPath, this.runner.config.typingDirectory);
    });
  }

  public toString(): string {
    return this.name;
  }

  public validate(): void {
  }

  public destroy(ok: boolean = false): void {
    if (!ok || this.isDestroyed) { return; }
    Object.keys(this).forEach((key) => {
      delete (<any>this)[key];
    });
    this.isDestroyed = true;
  }
}

export class Type extends Symbol {
  public get isType(): boolean { return true; }
}

export class Module extends Symbol {
  public kind: SymbolKind = SymbolKind.Module;

  public importedModuleTable: ObjectTable<Module> = {};
  public importedTypeTable: ObjectTable<Type> = {};
  public modules: Module[] = [];
  public types: Type[] = [];
  public variables: Variable[] = [];
  public typeAliases: TypeAlias[] = [];

  public get enums(): Enum[] { return <Enum[]>this.types.filter(t => t.isEnum); }
  public get functions(): Function[] { return <Function[]>this.types.filter(t => t.isFunction); }
  public get interfaces(): Interface[] { return <Interface[]>this.types.filter(t => t.isInterface); }
  public get classes(): Class[] { return <Class[]>this.types.filter(t => t.isClass); }

  public get isGlobalModule(): boolean { return this.rawName === '' && this.parentModule === null; }

  public get name(): string {
    var name = this.isGlobalModule ? 'Global' : this.rawName;

    if (/^['"']/.test(name)) {
      name = name.replace(/['"]/g, '').replace('\\', '/');
      name = this.runner.config.env.resolvePath(name);
      name = this.runner.config.env.relativePath(this.runner.config.typingDirectory, name);
    }
    return this.runner.config.plugin.rename(this, name);
  }

  public get importedModules(): { name: string; module: Module }[] {
    return _.map(this.importedModuleTable, (v, k) => { return { name: k, module: v }; });
  }

  public get importedTypes(): { name: string; type: Type }[] {
    return _.map(this.importedTypeTable, (v, k) => { return { name: k, type: v }; });
  }

  public initialize(importedModuleTable: ObjectTable<Module>, importedTypeTable: ObjectTable<Type>,
      modules: Module[], types: Type[], variables: Variable[], typeAliases: TypeAlias[]): Module {
    this.importedModuleTable = importedModuleTable;
    this.importedTypeTable = importedTypeTable;
    this.modules = modules;
    this.types = types;
    this.variables = variables;
    this.typeAliases = typeAliases;
    return this;
  }
}

export class PrimitiveType extends Type {
  public kind: SymbolKind = SymbolKind.PrimitiveType;
  public get isGenerationTarget(): boolean { return true; }

  public initialize(rawName: string): PrimitiveType {
    this.rawName = rawName;
    return this;
  }

  public validate(): void | string {
    if (this.runner.config.plugin.disallow.any && this.rawName === 'any') {
      return 'Disallow the any type';
    }
  }
}

export class Enum extends Type {
  public kind: SymbolKind = SymbolKind.Enum;

  public members: EnumMember[] = [];
  public isConst: boolean = false;

  public initialize(members: EnumMember[], isConst: boolean): Enum {
    this.members = members;
    this.isConst = isConst;
    return this;
  }
}

export class EnumMember extends Symbol {
  public kind: SymbolKind = SymbolKind.EnumMember;

  public value: number;

  public initialize(value: number): EnumMember {
    this.value = value;
    return this;
  }
}

export class Function extends Type {
  public kind: SymbolKind = SymbolKind.Function;

  public callSignatures: Signature[] = [];

  public initialize(callSignatures: Signature[]): Function {
    this.callSignatures = callSignatures;
    return this;
  }

  public validate(): void | string {
    if (this.runner.config.plugin.disallow.overload && this.callSignatures.length > 1) {
      return 'Disallow the function overloading';
    }
  }
}

export class ObjectType extends Type {
  public kind: SymbolKind = SymbolKind.ObjectType;

  public properties: Property[] = [];
  public methods: Method[] = [];
  public stringIndexType: Type = null;
  public numberIndexType: Type = null;

  public get ownProperties(): Property[] { return this.properties.filter(p => p.isOwn); }
  public get ownMethods(): Method[] { return this.methods.filter(m => m.isOwn); }

  public initialize(properties: Property[], methods: Method[], stringIndexType: Type, numberIndexType: Type,
      ...forOverride: any[]): ObjectType {
    this.properties = properties;
    this.methods = methods;
    this.stringIndexType = stringIndexType;
    this.numberIndexType = numberIndexType;
    return this;
  }
}

export class TypeReference {
  public get typeArguments(): Type[] { return this.rawTypeArguments.filter(t => !t.isTypeParameter); }

  constructor(
      public typeParameters: TypeParameter[],
      private rawTypeArguments: Type[]) {
  }

  public getTypeByTypeParameter(typeParameter: TypeParameter): Type {
    var index = this.typeParameters.indexOf(typeParameter);
    if (index < 0) { return null; }
    var type = this.typeArguments[index];
    return _.isObject(type) && type.isTypeParameter ? null : type;
  }
}

export class Interface extends ObjectType {
  public kind: SymbolKind = SymbolKind.Interface;

  public constructorSignatures: Signature[] = [];
  public callSignatures: Signature[] = [];
  public baseTypes: Interface[] = [];
  public typeReference: TypeReference;
  public staticProperties: Property[] = [];
  public staticMethods: Method[] = [];

  public get isGenericType(): boolean { return this.typeParameters.length > 0; }
  public get typeParameters(): Type[] { return this.typeReference.typeParameters; }
  public get typeArguments(): Type[] { return this.typeReference.typeArguments; }

  public get assumedName(): string {
    if (this.typeArguments.length === 0) { return ''; }

    return this.rawName + this.typeArguments.map((type, index) => {
      var prefix = index === 0 ? 'Of' : 'And';
      return prefix + inflection.classify(type.name);
    }).join('');
  }

  public initialize(properties: Property[], methods: Method[], stringIndexType: Type, numberIndexType: Type,
      constructorSignatures: Signature[], callSignatures: Signature[], baseTypes: Interface[],
      typeReference: TypeReference, staticProperties: Property[], staticMethods: Method[]): Interface {
    super.initialize(properties, methods, stringIndexType, numberIndexType);

    this.constructorSignatures = constructorSignatures;
    this.callSignatures = callSignatures;
    this.baseTypes = baseTypes;
    this.typeReference = typeReference;
    this.staticProperties = staticProperties;
    this.staticMethods = staticMethods;
    return this;
  }

  public validate(): void | string {
    if (this.runner.config.plugin.disallow.generics && this.isGenericType) {
      return 'Disallow the generics';
    } else if (this.runner.config.plugin.disallow.overload && (this.callSignatures.length > 1 || this.constructorSignatures.length > 1)) {
      return 'Disallow the function overloading';
    }
  }
}

export class Class extends Interface {
  public kind: SymbolKind = SymbolKind.Class;
}

export class Array extends Type {
  public kind: SymbolKind = SymbolKind.Array;
  public type: Type = null;

  public get isGenerationTarget(): boolean { return true; }

  public get assumedName(): string {
    if (this.type === null) { return this.rawName; }
    return this.type.name + '[]';
  }

  public initialize(type: Type): Array {
    this.type = type;
    return this;
  }
}

export class TypeParameter extends Type {
  public kind: SymbolKind = SymbolKind.TypeParameter;

  public constraint: Type = null;

  public initialize(constraint: Type): TypeParameter {
    this.constraint = constraint;
    return this;
  }
}

export class Tuple extends Type {
  public kind: SymbolKind = SymbolKind.Tuple;

  public types: Type[] = [];
  public baseArrayType: Type = null;

  public get assumedName(): string {
    return this.types.map(t => inflection.classify(t.name)).join('And') + 'Tuple';
  }

  public initialize(types: Type[], baseArrayType: Type): Tuple {
    this.types = types;
    this.baseArrayType = baseArrayType;
    return this;
  }

  public validate(): void | string {
    if (this.runner.config.plugin.disallow.tuple) {
      return 'Disallow the tuple type';
    }
  }
}

export class UnionType extends Type {
  public kind: SymbolKind = SymbolKind.UnionType;

  public types: Type[] = [];

  public get assumedName(): string {
    return this.types.map(t => inflection.classify(t.name)).join('And') + 'UnionType';
  }

  public initialize(types: Type[]): UnionType {
    this.types = types;
    return this;
  }

  public validate(): void | string {
    if (this.runner.config.plugin.disallow.unionType) {
      return 'Disallow the union type';
    }
  }
}

export class Property extends Symbol {
  public kind: SymbolKind = SymbolKind.Property;

  public type: Type = null;
  public isOptional: boolean = false;
  public isOwn: boolean = false;
  public isProtected: boolean = false;

  public initialize(type: Type, isOptional: boolean, isOwn: boolean, isProtected: boolean): Property {
    this.type = type;
    this.isOptional = isOptional;
    this.isOwn = isOwn;
    this.isProtected = isProtected;
    return this;
  }
}

export class Method extends Symbol {
  public kind: SymbolKind = SymbolKind.Method;

  public callSignatures: Signature[] = [];
  public isOptional: boolean = false;
  public isOwn: boolean = false;
  public isProtected: boolean = false;

  public initialize(callSignatures: Signature[], isOptional: boolean, isOwn: boolean, isProtected: boolean): Method {
    this.callSignatures = callSignatures;
    this.isOptional = isOptional;
    this.isOwn = isOwn;
    this.isProtected = isProtected;
    return this;
  }

  public validate(): void | string {
    if (this.runner.config.plugin.disallow.overload && this.callSignatures.length > 1) {
      return 'Disallow the function overloading';
    }
  }
}

export class Signature extends Symbol {
  public kind: SymbolKind = SymbolKind.Method;

  public typeParameters: TypeParameter[] = [];
  public parameters: Parameter[] = [];
  public returnType: Type = null;

  public initialize(typeParameters: TypeParameter[], parameters: Parameter[], returnType: Type): Signature {
    this.typeParameters = typeParameters;
    this.parameters = parameters;
    this.returnType = returnType;
    return this;
  }

  public validate(): void | string {
    if (this.runner.config.plugin.disallow.generics && this.typeParameters.length > 0) {
      return 'Disallow the generics';
    }
  }
}

export class Parameter extends Symbol {
  public kind: SymbolKind = SymbolKind.Parameter;

  public type: Type = null;
  public isOptional: boolean = false;

  public initialize(type: Type, isOptional: boolean): Parameter {
    this.type = type;
    this.isOptional = isOptional;
    return this;
  }
}

export class Variable extends Symbol {
  public kind: SymbolKind = SymbolKind.Variable;

  public type: Type = null;
  public module: Module = null;
  public isOptional: boolean = false;

  public initialize(type: Type, module: Module, isOptional: boolean): Variable {
    this.type = type;
    this.module = module;
    this.isOptional = isOptional;
    return this;
  }
}

export class TypeAlias extends Symbol {
  public kind: SymbolKind = SymbolKind.TypeAlias;

  public type: Type = null;

  public initialize(type: Type): TypeAlias {
    this.type = type;
    return this;
  }
}
