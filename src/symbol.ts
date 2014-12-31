/// <reference path="../typings/tsd.d.ts" />

import _ = require('lodash');
import inflection = require('inflection');

import Runner = require('./runner');

export enum SymbolKinds {
  Invalid,
  Primitive,
  Enum,
  EnumMember,
  Interface,
  Class,
  ObjectType,
  Function,
  TypeParameter,
  Tuple,
  Property,
  Method,
  Signature,
  Parameter
}

export class Symbol {
  private static tagPattern: RegExp = /^\s*@([^\s@]+)\s+([^\s@]+)\s*$/m;
  public kind: SymbolKinds = SymbolKinds.Invalid;

  constructor(
      public runner: Runner.Runner,
      public rawName: string,
      public docComment: string[],
      public assumedName?: string) {
    if (this.isDisallowed) {
      throw new Error('The plugin disallows the type: ' + this.rawName);
    }
  }

  public get name(): string {
    var name = this.assumedName === undefined || _.isEmpty(this.assumedName) ?
      this.rawName : this.assumedName;
    _.forEach(this.runner.plugin.aliases, (v, k) => name = name.replace(new RegExp(k), v));
    _.forEach(this.runner.config.aliases, (v, k) => name = name.replace(new RegExp(k), v));
    return name;
  }

  public get comment(): string {
    return this.docComment
      .filter(c => !Symbol.tagPattern.test(c))
      .join(this.runner.plugin.newLine);
  }

  public get tags(): { name: string; value: string; }[] {
    return _.chain(this.docComment).map(comment => {
      var matches = comment.match(Symbol.tagPattern);
      return matches == null ? null : { name: matches[1], value: matches[2] };
    }).compact().value();
  }

  public get isDisallowed(): boolean { return false; }
  public get isAnonymousType(): boolean { return this.isType && this.rawName.length <= 0; }
  public get isType(): boolean { return false; }
  public get isGenericType(): boolean { return false; }

  public get isPrimitive(): boolean { return this.kind === SymbolKinds.Primitive; }
  public get isEnum(): boolean { return this.kind === SymbolKinds.Enum; }
  public get isEnumMember(): boolean { return this.kind === SymbolKinds.EnumMember; }
  public get isInterface(): boolean { return this.kind === SymbolKinds.Interface; }
  public get isClass(): boolean { return this.kind === SymbolKinds.Class; }
  public get isObjectType(): boolean { return this.kind === SymbolKinds.ObjectType; }
  public get isFunction(): boolean { return this.kind === SymbolKinds.Function; }
  public get isTypeParameter(): boolean { return this.kind === SymbolKinds.TypeParameter; }
  public get isTuple(): boolean { return this.kind === SymbolKinds.Tuple; }
  public get isProperty(): boolean { return this.kind === SymbolKinds.Property; }
  public get isMethod(): boolean { return this.kind === SymbolKinds.Method; }
  public get isSignature(): boolean { return this.kind === SymbolKinds.Signature; }
  public get isParameter(): boolean { return this.kind === SymbolKinds.Parameter; }

  public toString(): string {
    return this.name;
  }
}

export class Type extends Symbol {
  public get isType(): boolean { return true; }

  public get fullName(): string {
    if (this.moduleNames.length === 0) { return this.name; }
    return [this.namespace, this.name].join(this.runner.plugin.namespaceSeparator);
  }

  public get namespace(): string {
    return this.moduleNames.join(this.runner.plugin.namespaceSeparator);
  }

  constructor(
      runner: Runner.Runner,
      rawName: string,
      docComment: string[],
      public moduleNames: string[],
      assumedName?: string) {
    super(runner, rawName, docComment, assumedName);
  }
}

export class Primitive extends Type {
  public kind: SymbolKinds = SymbolKinds.Primitive;
  private static invalidNames: string[] = [
    'unknown',
    'any',
    'undefined',
    'null'
  ];

  constructor(
      runner: Runner.Runner,
      rawName: string,
      docComment: string[]) {
    super(runner, rawName, docComment, []);

    if (_.contains(Primitive.invalidNames, this.rawName)) {
      throw new Error('Invalid primitive type given: ' + this.rawName);
    }
  }
}

export class Enum extends Type {
  public kind: SymbolKinds = SymbolKinds.Enum;
  public get isDisallowed(): boolean { return this.runner.plugin.disallow.enum; }

  constructor(
      runner: Runner.Runner,
      rawName: string,
      docComment: string[],
      moduleNames: string[],
      public members: EnumMember[]) {
    super(runner, rawName, docComment, moduleNames);
  }
}

export class EnumMember extends Symbol {
  public kind: SymbolKinds = SymbolKinds.EnumMember;

  constructor(
      runner: Runner.Runner,
      rawName: string,
      docComment: string[],
      public value: number) {
    super(runner, rawName, docComment);
  }
}

export class Function extends Type {
  public kind: SymbolKinds = SymbolKinds.Function;
  public get isDisallowed(): boolean { return this.runner.plugin.disallow.function; }

  constructor(
      runner: Runner.Runner,
      rawName: string,
      docComment: string[],
      moduleNames: string[],
      assumedName: string,
      public callSignatures: Signature[]) {
    super(runner, rawName, docComment, moduleNames, assumedName);
  }
}

export class ObjectType extends Type {
  public kind: SymbolKinds = SymbolKinds.ObjectType;
  public get isDisallowed(): boolean { return this.runner.plugin.disallow.objectType; }

  public get ownProperties(): Property[] {
    return this.properties.filter(p => p.isOwn);
  }

  public get ownMethods(): Method[] {
    return this.methods.filter(m => m.isOwn);
  }

  constructor(
      runner: Runner.Runner,
      rawName: string,
      docComment: string[],
      moduleNames: string[],
      assumedName: string,
      public properties: Property[],
      public methods: Method[],
      public stringIndexType: Type,
      public numberIndexType: Type) {
    super(runner, rawName, docComment, moduleNames, assumedName);
  }
}

export class Interface extends ObjectType {
  public kind: SymbolKinds = SymbolKinds.Interface;
  public get isDisallowed(): boolean { return this.runner.plugin.disallow.interface; }
  public get isGenericType(): boolean { return this.typeParameters.length > 0; }

  public get typeArguments(): Type[] {
    return this.rawTypeArguments.filter(t => !t.isTypeParameter);
  }

  public get assumedName(): string {
    if (this.typeArguments.length === 0) { return ''; }

    return this.rawName + this.typeArguments.map((type, index) => {
      var prefix = index === 0 ? 'With' : 'And';
      return prefix + inflection.classify(type.name);
    }).join('');
  }

  constructor(
      runner: Runner.Runner,
      rawName: string,
      docComment: string[],
      moduleNames: string[],
      properties: Property[],
      methods: Method[],
      stringIndexType: Type,
      numberIndexType: Type,
      public constructorSignatures: Signature[],
      public callSignatures: Signature[],
      public baseTypes: Interface[],
      public typeParameters: TypeParameter[],
      public rawTypeArguments: Type[]) {
    super(runner, rawName, docComment, moduleNames, '',
        properties, methods, stringIndexType, numberIndexType);
  }
}

export class Class extends Interface {
  public kind: SymbolKinds = SymbolKinds.Class;
  public get isDisallowed(): boolean { return this.runner.plugin.disallow.class; }
}

export class TypeParameter extends Type {
  public kind: SymbolKinds = SymbolKinds.TypeParameter;
  public get isDisallowed(): boolean { return this.runner.plugin.disallow.typeParameter; }

  constructor(
      runner: Runner.Runner,
      rawName: string,
      docComment: string[],
      moduleNames: string[],
      public constraint: Type) {
    super(runner, rawName, docComment, moduleNames);
  }
}

export class Tuple extends Type {
  public kind: SymbolKinds = SymbolKinds.Tuple;
  public get isDisallowed(): boolean { return this.runner.plugin.disallow.tuple; }

  public get assumedName(): string {
    return this.elementTypes.map(t => inflection.classify(t.name)).join('And') + 'Tuple';
  }

  constructor(
      runner: Runner.Runner,
      public elementTypes: Type[],
      public baseArrayType: Type) {
    super(runner, '', [], []);
  }
}

export class Property extends Symbol {
  public kind: SymbolKinds = SymbolKinds.Property;
  public get isDisallowed(): boolean { return this.runner.plugin.disallow.property; }

  constructor(
      runner: Runner.Runner,
      rawName: string,
      docComment: string[],
      public type: Type,
      public isOptional: boolean,
      public isOwn: boolean) {
    super(runner, rawName, docComment);
  }
}

export class Method extends Symbol {
  public kind: SymbolKinds = SymbolKinds.Method;
  public get isDisallowed(): boolean { return this.runner.plugin.disallow.method; }

  constructor(
      runner: Runner.Runner,
      rawName: string,
      docComment: string[],
      public callSignatures: Signature[],
      public isOptional: boolean,
      public isOwn: boolean) {
    super(runner, rawName, docComment);
  }
}

export class Signature extends Symbol {
  public kind: SymbolKinds = SymbolKinds.Method;

  constructor(
      runner: Runner.Runner,
      rawName: string,
      docComment: string[],
      assumedName: string,
      public typeParameters: TypeParameter[],
      public parameters: Parameter[],
      public returnType: Type) {
    super(runner, rawName, docComment, assumedName);
  }
}

export class Parameter extends Symbol {
  public kind: SymbolKinds = SymbolKinds.Parameter;

  constructor(
      runner: Runner.Runner,
      rawName: string,
      docComment: string[],
      public type: Type,
      public isOptional: boolean) {
    super(runner, rawName, docComment);
  }
}
