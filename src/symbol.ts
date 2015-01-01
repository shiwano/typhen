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
      public moduleNames?: string[],
      public assumedName?: string) {
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
}

export class Primitive extends Type {
  public kind: SymbolKinds = SymbolKinds.Primitive;
  private static invalidNames: string[] = ['unknown', 'undefined', 'null'];

  public initialize(rawName: string): Primitive {
    this.rawName = rawName;

    if (_.contains(Primitive.invalidNames, this.rawName)) {
      throw new Error('Invalid primitive type given: ' + this.rawName);
    }
    return this;
  }
}

export class Enum extends Type {
  public kind: SymbolKinds = SymbolKinds.Enum;

  public members: EnumMember[] = [];

  public initialize(members: EnumMember[]): Enum {
    this.members = members;
    return this;
  }
}

export class EnumMember extends Symbol {
  public kind: SymbolKinds = SymbolKinds.EnumMember;

  public value: number;

  public initialize(value: number): EnumMember {
    this.value = value;
    return this;
  }
}

export class Function extends Type {
  public kind: SymbolKinds = SymbolKinds.Function;

  public callSignatures: Signature[] = [];

  public initialize(callSignatures: Signature[]): Function {
    this.callSignatures = callSignatures;
    return this;
  }
}

export class ObjectType extends Type {
  public kind: SymbolKinds = SymbolKinds.ObjectType;

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

export class Interface extends ObjectType {
  public kind: SymbolKinds = SymbolKinds.Interface;

  public constructorSignatures: Signature[] = [];
  public callSignatures: Signature[] = [];
  public baseTypes: Interface[] = [];
  public typeParameters: TypeParameter[] = [];
  public rawTypeArguments: Type[] = [];

  public get isGenericType(): boolean { return this.typeParameters.length > 0; }
  public get typeArguments(): Type[] { return this.rawTypeArguments.filter(t => !t.isTypeParameter); }

  public get assumedName(): string {
    if (this.typeArguments.length === 0) { return ''; }

    return this.rawName + this.typeArguments.map((type, index) => {
      var prefix = index === 0 ? 'With' : 'And';
      return prefix + inflection.classify(type.name);
    }).join('');
  }

  public initialize(properties: Property[], methods: Method[], stringIndexType: Type, numberIndexType: Type,
      constructorSignatures: Signature[], callSignatures: Signature[], baseTypes: Interface[],
      typeParameters: TypeParameter[], rawTypeArguments: Type[]): Interface {
    super.initialize(properties, methods, stringIndexType, numberIndexType);

    this.constructorSignatures = constructorSignatures;
    this.callSignatures = callSignatures;
    this.baseTypes = baseTypes;
    this.typeParameters = typeParameters;
    this.rawTypeArguments = rawTypeArguments;
    return this;
  }
}

export class Class extends Interface {
  public kind: SymbolKinds = SymbolKinds.Class;
}

export class TypeParameter extends Type {
  public kind: SymbolKinds = SymbolKinds.TypeParameter;

  public constraint: Type = null;

  public initialize(constraint: Type): TypeParameter {
    this.constraint = constraint;
    return this;
  }
}

export class Tuple extends Type {
  public kind: SymbolKinds = SymbolKinds.Tuple;

  public elementTypes: Type[] = [];
  public baseArrayType: Type = null;

  public get assumedName(): string {
    return this.elementTypes.map(t => inflection.classify(t.name)).join('And') + 'Tuple';
  }

  public initialize(elementTypes: Type[], baseArrayType: Type): Tuple {
    this.elementTypes = elementTypes;
    this.baseArrayType = baseArrayType;
    return this;
  }
}

export class Property extends Symbol {
  public kind: SymbolKinds = SymbolKinds.Property;

  public type: Type = null;
  public isOptional: boolean = false;
  public isOwn: boolean = false;

  public initialize(type: Type, isOptional: boolean, isOwn: boolean): Property {
    this.type = type;
    this.isOptional = isOptional;
    this.isOwn = isOwn;
    return this;
  }
}

export class Method extends Symbol {
  public kind: SymbolKinds = SymbolKinds.Method;

  public callSignatures: Signature[] = [];
  public isOptional: boolean = false;
  public isOwn: boolean = false;

  public initialize(callSignatures: Signature[], isOptional: boolean, isOwn: boolean): Method {
    this.callSignatures = callSignatures;
    this.isOptional = isOptional;
    this.isOwn = isOwn;
    return this;
  }
}

export class Signature extends Symbol {
  public kind: SymbolKinds = SymbolKinds.Method;

  public typeParameters: TypeParameter[] = [];
  public parameters: Parameter[] = [];
  public returnType: Type = null;

  public initialize(typeParameters: TypeParameter[], parameters: Parameter[], returnType: Type): Signature {
    this.typeParameters = typeParameters;
    this.parameters = parameters;
    this.returnType = returnType;
    return this;
  }
}

export class Parameter extends Symbol {
  public kind: SymbolKinds = SymbolKinds.Parameter;

  public type: Type = null;
  public isOptional: boolean = false;

  public initialize(type: Type, isOptional: boolean): Parameter {
    this.type = type;
    this.isOptional = isOptional;
    return this;
  }
}
