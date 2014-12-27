/// <reference path="../typings/tsd.d.ts" />

import _ = require('lodash');
import inflection = require('inflection');

import Runner = require('./runner');

export enum SymbolFlags {
  Invalid,
  Primitive,
  Enum,
  EnumMember,
  Interface,
  Class,
  ObjectType,
  Function,
  TypeParameter,
  Property,
  Method,
  Signature,
  Parameter
}

export class Symbol {
  private tagPattern: RegExp = /^\s*@([^\s@]+)\s+([^\s@]+)\s*$/m;
  public flags: SymbolFlags = SymbolFlags.Invalid;

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
      .filter(c => !this.tagPattern.test(c))
      .join(this.runner.plugin.newLine);
  }

  public get tags(): { name: string; value: string; }[] {
    return _.chain(this.docComment).map(comment => {
      var matches = comment.match(this.tagPattern);
      return matches == null ? null : { name: matches[1], value: matches[2] };
    }).compact().value();
  }

  public get isDisallowed(): boolean { return false; }
  public get isAnonymousType(): boolean { return this.isType && this.rawName.length <= 0; }
  public get isType(): boolean { return false; }
  public get isGenericType(): boolean { return false; }

  public get isPrimitive(): boolean { return this.flags === SymbolFlags.Primitive; }
  public get isEnum(): boolean { return this.flags === SymbolFlags.Enum; }
  public get isEnumMember(): boolean { return this.flags === SymbolFlags.EnumMember; }
  public get isInterface(): boolean { return this.flags === SymbolFlags.Interface; }
  public get isClass(): boolean { return this.flags === SymbolFlags.Class; }
  public get isObjectType(): boolean { return this.flags === SymbolFlags.ObjectType; }
  public get isFunction(): boolean { return this.flags === SymbolFlags.Function; }
  public get isTypeParameter(): boolean { return this.flags === SymbolFlags.TypeParameter; }
  public get isProperty(): boolean { return this.flags === SymbolFlags.Property; }
  public get isMethod(): boolean { return this.flags === SymbolFlags.Method; }
  public get isSignature(): boolean { return this.flags === SymbolFlags.Signature; }
  public get isParameter(): boolean { return this.flags === SymbolFlags.Parameter; }

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
  public flags: SymbolFlags = SymbolFlags.Primitive;

  constructor(
      runner: Runner.Runner,
      rawName: string,
      docComment: string[]) {
    super(runner, rawName, docComment, []);

    if (this.rawName === 'unknown') {
      throw new Error('Found unknown type');
    }

    if (this.rawName !== 'string' &&
        this.rawName !== 'boolean' &&
        this.rawName !== 'number' &&
        this.rawName !== 'void') {
      throw new Error('Invalid primitive type given: ' + this.rawName);
    }
  }
}

export class Enum extends Type {
  public flags: SymbolFlags = SymbolFlags.Enum;
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
  public flags: SymbolFlags = SymbolFlags.EnumMember;

  constructor(
      runner: Runner.Runner,
      rawName: string,
      docComment: string[],
      public value: number) {
    super(runner, rawName, docComment);
  }
}

export class Function extends Type {
  public flags: SymbolFlags = SymbolFlags.Function;
  public get isDisallowed(): boolean { return this.runner.plugin.disallow.function; }
  public get firstCallSignature(): Signature { return this.callSignatures[0]; }

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

export class GenericType extends Type {
  public get isGenericType(): boolean { return true; }
  public get hasTypeArguments(): boolean { return this.typeArguments.length > 0; }

  public get typeArguments(): Type[] {
    return this.rawTypeArguments.filter(t => !t.isTypeParameter);
  }

  public get assumedName(): string {
    if (!this.hasTypeArguments) { return ''; }

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
      public baseTypes: Interface[],
      public typeParameters: TypeParameter[],
      public rawTypeArguments: Type[],
      public properties: Property[],
      public methods: Method[],
      public stringIndexType: Type,
      public numberIndexType: Type) {
    super(runner, rawName, docComment, moduleNames);
  }
}

export class Interface extends GenericType {
  public flags: SymbolFlags = SymbolFlags.Interface;
  public get isDisallowed(): boolean { return this.runner.plugin.disallow.interface; }
}

export class Class extends GenericType {
  public flags: SymbolFlags = SymbolFlags.Class;
  public get isDisallowed(): boolean { return this.runner.plugin.disallow.class; }
}

export class ObjectType extends Type {
  public flags: SymbolFlags = SymbolFlags.ObjectType;
  public get isDisallowed(): boolean { return this.runner.plugin.disallow.objectType; }

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

export class TypeParameter extends Type {
  public flags: SymbolFlags = SymbolFlags.TypeParameter;
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

export class Property extends Symbol {
  public flags: SymbolFlags = SymbolFlags.Property;
  public get isDisallowed(): boolean { return this.runner.plugin.disallow.property; }

  constructor(
      runner: Runner.Runner,
      rawName: string,
      docComment: string[],
      public type: Type,
      public isOptional: boolean) {
    super(runner, rawName, docComment);
  }
}

export class Method extends Symbol {
  public flags: SymbolFlags = SymbolFlags.Method;
  public get isDisallowed(): boolean { return this.runner.plugin.disallow.method; }
  public get firstCallSignature(): Signature { return this.callSignatures[0]; }

  constructor(
      runner: Runner.Runner,
      rawName: string,
      docComment: string[],
      public callSignatures: Signature[],
      public isOptional: boolean) {
    super(runner, rawName, docComment);
  }
}

export class Signature extends Symbol {
  public flags: SymbolFlags = SymbolFlags.Method;

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
  public flags: SymbolFlags = SymbolFlags.Parameter;

  constructor(
      runner: Runner.Runner,
      rawName: string,
      docComment: string[],
      public type: Type,
      public isOptional: boolean) {
    super(runner, rawName, docComment);
  }
}
