import * as abaplint from "@abaplint/core";
import * as StatementTranspilers from "./statements";
import * as ExpressionTranspilers from "./expressions";
import * as StructureTranspilers from "./structures";
import {IStatementTranspiler} from "./statements/_statement_transpiler";
import {IExpressionTranspiler} from "./expressions/_expression_transpiler";
import {IStructureTranspiler} from "./structures/_structure_transpiler";
import {TranspileTypes} from "./transpile_types";
import {ISpaghettiScopeNode} from "@abaplint/core";
import {Chunk} from "./chunk";

export class Traversal {
  private readonly spaghetti: abaplint.ISpaghettiScope;
  private readonly file: abaplint.ABAPFile;
  private readonly obj: abaplint.ABAPObject;
  private readonly reg: abaplint.IRegistry;
  public readonly runtimeTypeError: boolean;

  public constructor(spaghetti: abaplint.ISpaghettiScope, file: abaplint.ABAPFile,
                     obj: abaplint.ABAPObject, reg: abaplint.IRegistry, runtimeTypeError = false) {
    this.spaghetti = spaghetti;
    this.file = file;
    this.obj = obj;
    this.reg = reg;
    this.runtimeTypeError = runtimeTypeError;
  }

  public getCurrentObject(): abaplint.ABAPObject {
    return this.obj;
  }

  public traverse(node: abaplint.INode | undefined): Chunk {
    if (node instanceof abaplint.Nodes.StructureNode) {
      return this.traverseStructure(node);
    } else if (node instanceof abaplint.Nodes.StatementNode) {
      return this.traverseStatement(node);
    } else if (node instanceof abaplint.Nodes.ExpressionNode) {
      return this.traverseExpression(node);
    } else if (node === undefined) {
      throw new Error("Traverse, node undefined");
    } else {
      throw new Error("Traverse, unexpected node type");
    }
  }

  public getFilename(): string {
    return this.file.getFilename();
  }

  public getFile(): abaplint.ABAPFile {
    return this.file;
  }

  public getSpaghetti(): abaplint.ISpaghettiScope {
    return this.spaghetti;
  }

  /** finds a statement in the _current_ file given a position */
  public findStatementInFile(pos: abaplint.Position): abaplint.Nodes.StatementNode | undefined {
    for (const s of this.file.getStatements()) {
      if (pos.isBetween(s.getStart(), s.getEnd())) {
        return s;
      }
    }
    return undefined;
  }

  private scopeCache: {
    cov: {start: abaplint.Position, end: abaplint.Position},
    filename: string,
    node: abaplint.ISpaghettiScopeNode
  } | undefined = undefined;

  public findCurrentScopeByToken(token: abaplint.Token) {
    const filename = this.file.getFilename();

    if (this.scopeCache
      && this.scopeCache.filename === filename
      && token.getEnd().isBetween(this.scopeCache.cov.start, this.scopeCache.cov.end)) {
      return this.scopeCache.node;
    }

    const node = this.spaghetti.lookupPosition(token.getStart(), filename);

// note: cache only works for leafs, as parent nodes cover multiple leaves
    if (node && node.getChildren().length === 0) {
      this.scopeCache = {
        cov: node.calcCoverage(),
        filename: filename,
        node: node,
      };
    } else {
      this.scopeCache = undefined;
    }

    return node;
  }

  public getInterfaceDefinition(token: abaplint.Token): abaplint.IInterfaceDefinition | undefined {
    let scope = this.findCurrentScopeByToken(token);

    while (scope !== undefined) {
      if (scope.getIdentifier().stype === abaplint.ScopeType.Interface) {
        return scope.findInterfaceDefinition(scope?.getIdentifier().sname);
      }
      scope = scope.getParent();
    }

    return undefined;
  }

  public getClassDefinition(token: abaplint.Token): abaplint.IClassDefinition | undefined {
    let scope = this.findCurrentScopeByToken(token);

    while (scope !== undefined) {
      if (scope.getIdentifier().stype === abaplint.ScopeType.ClassImplementation
          || scope.getIdentifier().stype === abaplint.ScopeType.ClassDefinition) {

        return scope.findClassDefinition(scope?.getIdentifier().sname);
      }
      scope = scope.getParent();
    }

    return undefined;
  }

  private isClassAttribute(token: abaplint.Token): boolean {
    const scope = this.findCurrentScopeByToken(token);
    if (scope === undefined) {
      throw new Error("isClassAttribute, unable to lookup position");
    }

    const name = token.getStr();
    if (name.toLowerCase() === "me") {
      return true;
    }
    const found = scope.findScopeForVariable(name);
    if (found && (found.stype === abaplint.ScopeType.MethodInstance
        || found.stype === abaplint.ScopeType.ClassImplementation)) {
      return true;
    }
    return false;
  }

  public prefixAndName(t: abaplint.Token, filename?: string): string {
    let name = t.getStr().toLowerCase();

    if (filename && this.getCurrentObject().getABAPFileByName(filename) === undefined) {
      // the prefix is from a different object
      const file = this.reg.getFileByName(filename);
      if (file) {
        const found = this.reg.findObjectForFile(file);
        if (found) {
          if (found instanceof abaplint.Objects.Interface) {
            return this.lookupClassOrInterface(found.getName(), t) + "." + found.getName().toLowerCase() + "$" + name;
          } else {
            return this.lookupClassOrInterface(found.getName(), t) + "." + name;
          }
        }
      }
    }

    const className = this.isStaticClassAttribute(t);
    if (className) {
      name = className + "." + name;
    } else if (name === "super") {
      return name;
    } else if (this.isClassAttribute(t)) {
      name = "this." + name;
    } else if (this.isBuiltinVariable(t)) {
      name = "abap.builtin." + name;
    }
    return name;
  }

  private isStaticClassAttribute(token: abaplint.Token): string | undefined {
    const scope = this.findCurrentScopeByToken(token);
    if (scope === undefined) {
      throw new Error(`isStaticClassAttribute, unable to lookup position, ${token.getStr()},${token.getRow()},${token.getCol()},` +
        this.file.getFilename());
    }

    const name = token.getStr();
    const found = scope.findScopeForVariable(name);
    const id = scope.findVariable(name);
    if (found && id
        && id.getMeta().includes(abaplint.IdentifierMeta.Static)
        && found.stype === abaplint.ScopeType.ClassImplementation) {
//      console.dir(found.sname);
      return found.sname.toLowerCase();
    }
    return undefined;
  }

  public isBuiltinMethod(token: abaplint.Token): boolean {
    const scope = this.findCurrentScopeByToken(token);
    if (scope === undefined) {
      return false;
    }

    for (const r of scope.getData().references) {
      if (r.referenceType === abaplint.ReferenceType.BuiltinMethodReference
          && r.position.getStart().equals(token.getStart())) {
        return true;
      }
    }
    return false;
  }

  public findMethodReference(token: abaplint.Token, scope: ISpaghettiScopeNode | undefined):
  undefined | {def: abaplint.Types.MethodDefinition, name: string} {

    if (scope === undefined) {
      return undefined;
    }

    for (const r of scope.getData().references) {
      if (r.referenceType === abaplint.ReferenceType.MethodReference
          && r.position.getStart().equals(token.getStart())
          && r.resolved instanceof abaplint.Types.MethodDefinition) {
        let name = r.resolved.getName();
        if (r.extra?.ooName && r.extra?.ooType === "INTF") {
          name = r.extra.ooName + "$" + name;
        }

        return {def: r.resolved, name};
      } else if (r.referenceType === abaplint.ReferenceType.BuiltinMethodReference
          && r.position.getStart().equals(token.getStart())) {
        const def = r.resolved as abaplint.Types.MethodDefinition;
        const name = def.getName();

        return {def, name};
      }
    }

    return undefined;
  }

  private isBuiltinVariable(token: abaplint.Token): boolean {
    const scope = this.findCurrentScopeByToken(token);
    if (scope === undefined) {
      throw new Error("isBuiltin, unable to lookup position");
    }

    const name = token.getStr();
    const found = scope.findScopeForVariable(name);
    if (found && found.stype === abaplint.ScopeType.BuiltIn) {
      return true;
    }
    return false;
  }

  // returns the interface name if interfaced
  public isInterfaceAttribute(token: abaplint.Token): string | undefined {
    const ref = this.findReadOrWriteReference(token);
    if (ref === undefined) {
      return undefined;
    }

    // local classes
    const scope = this.findCurrentScopeByToken(ref.getToken());
    if (scope?.getIdentifier().stype === abaplint.ScopeType.Interface) {
      return scope?.getIdentifier().sname;
    }

    // global classes
    const file = this.reg.getFileByName(ref.getFilename());
    if (file) {
      const obj = this.reg.findObjectForFile(file);
      if (obj?.getType() === "INTF") {
        return obj.getName().toLowerCase();
      }
    }

    return undefined;
  }

  private findReadOrWriteReference(token: abaplint.Token) {
    const scope = this.findCurrentScopeByToken(token);
    if (scope === undefined) {
      return undefined;
    }

    for (const r of scope.getData().references) {
      if ((r.referenceType === abaplint.ReferenceType.DataReadReference
          || r.referenceType === abaplint.ReferenceType.DataWriteReference)
          && r.position.getStart().equals(token.getStart())) {
        return r.resolved;
      }
    }
    return undefined;
  }

  public buildConstructorContents(scope: abaplint.ISpaghettiScopeNode | undefined,
                                  def: abaplint.IClassDefinition, inputName: string): string {

    /*
    const vars = scope?.getData().vars;
    if (vars === undefined || Object.keys(vars).length === 0) {
      return "";
    }
    */
    let ret = "";

    if (def.getSuperClass() !== undefined) {
      // todo, more here, there might be parameters to pass
      // for now just pass the same input
      ret += `await super.constructor_(${inputName});\n`;
    }

    ret += "this.me = new abap.types.ABAPObject();\n";
    ret += "this.me.set(this);\n";
    for (const a of def.getAttributes().getAll()) {
      if (a.getMeta().includes(abaplint.IdentifierMeta.Static) === true) {
        continue;
      }
      const name = a.getName().toLowerCase();
      ret += "this." + name + " = " + new TranspileTypes().toType(a.getType()) + ";\n";
    }

    // attributes from directly implemented interfaces(not interfaces implemented in super classes)
    for (const i of def.getImplementing()) {
      ret += this.dataFromInterfaces(i.name, scope);
    }

    // handle aliases after initialization of carrier variables
    for (const a of def.getAliases().getAll()) {
      ret += "this." + a.getName() + " = this." + a.getComponent().replace("~", "$") + ";\n";
    }
    // constants can be accessed both statically and via reference
    for (const c of def.getAttributes().getConstants()) {
      ret += "this." + c.getName() + " = " + def.getName() + "." + c.getName() + ";\n";
    }

    return ret;
  }

  public findInterfaceDefinition(name: string, scope: abaplint.ISpaghettiScopeNode | undefined) {
    let intf = scope?.findInterfaceDefinition(name);
    if (intf === undefined) {
      const iglobal = this.reg.getObject("INTF", name) as abaplint.Objects.Interface | undefined;
      intf = iglobal?.getDefinition();
    }
    return intf;
  }

  public findClassDefinition(name: string, scope: abaplint.ISpaghettiScopeNode | undefined) {
    let clas = scope?.findClassDefinition(name);
    if (clas === undefined) {
      const iglobal = this.reg.getObject("CLAS", name) as abaplint.Objects.Class | undefined;
      clas = iglobal?.getDefinition();
    }
    return clas;
  }

  private dataFromInterfaces(name: string, scope: abaplint.ISpaghettiScopeNode | undefined): string {
    let ret = "";

    const intf = this.findInterfaceDefinition(name, scope);

    for (const a of intf?.getAttributes().getAll() || []) {
      if (a.getMeta().includes(abaplint.IdentifierMeta.Static) === true) {
        continue;
      }
      const n = name.toLowerCase() + "$" + a.getName().toLowerCase();
      ret += "this." + n + " = " + new TranspileTypes().toType(a.getType()) + ";\n";
    }

    for (const i of intf?.getImplementing() || []) {
      ret += this.dataFromInterfaces(i.name, scope);
    }

    return ret;
  }

  public determineType(node: abaplint.Nodes.ExpressionNode | abaplint.Nodes.StatementNode,
                       scope: abaplint.ISpaghettiScopeNode | undefined): abaplint.AbstractType | undefined {
    if (scope === undefined) {
      return undefined;
    }

    const found = node.findDirectExpression(abaplint.Expressions.Target);
    if (found === undefined) {
      return undefined;
    }

    let context: abaplint.AbstractType | undefined = undefined;
    for (const c of found.getChildren()) {
      if (context === undefined) {
        context = scope.findVariable(c.getFirstToken().getStr())?.getType();
      } else if (c.get() instanceof abaplint.Expressions.ComponentName
          && context instanceof abaplint.BasicTypes.StructureType) {
        context = context.getComponentByName(c.getFirstToken().getStr());
      }
    }

    return context;
  }

////////////////////////////

  public registerClassOrInterface(def: abaplint.IClassDefinition | abaplint.IInterfaceDefinition | undefined): string {
    if (def === undefined) {
      return "";
    }
    const name = def.getName();
    if (def.isGlobal() === false) {
      const prefix = this.buildPrefix(def);
      return `abap.Classes['${prefix}-${name.toUpperCase()}'] = ${name.toLowerCase()};`;
    } else {
      return `abap.Classes['${name.toUpperCase()}'] = ${name.toLowerCase()};`;
    }
  }

  public lookupClassOrInterface(name: string | undefined, token: abaplint.Token | undefined, directGlobal = false): string {
    if (name === undefined || token === undefined) {
      return "abap.Classes['undefined']";
    }

    if (directGlobal === true) {
      return "abap.Classes[" + name + "]";
    }

    const scope = this.findCurrentScopeByToken(token);

    // todo, add explicit type,
    let def: any | undefined = scope?.findClassDefinition(name);
    if (def === undefined) {
      def = scope?.findInterfaceDefinition(name);
    }

    if (def) {
      if (def.isGlobal() === false) {
        const prefix = this.buildPrefix(def);
        return `abap.Classes['${prefix}-${def?.getName()?.toUpperCase()}']`;
      } else {
        return `abap.Classes['${def?.getName()?.toUpperCase()}']`;
      }
    } else {
// assume global
      return "abap.Classes['" + name.toUpperCase() + "']";
    }
  }

  private buildPrefix(def: abaplint.IClassDefinition | abaplint.IInterfaceDefinition ): string {
    const file = this.reg.getFileByName(def.getFilename());
    if (file === undefined) {
      return "NOT_FOUND";
    }
    const obj = this.reg.findObjectForFile(file);
    return obj?.getType() + "-" + obj?.getName();
  }

////////////////////////////

  protected traverseStructure(node: abaplint.Nodes.StructureNode): Chunk {
    const list: any = StructureTranspilers;
    const ret = new Chunk();

    for (const c of node.getChildren()) {
      if (c instanceof abaplint.Nodes.StructureNode) {
        const search = c.get().constructor.name + "Transpiler";
        if (list[search]) {
          const transpiler = new list[search]() as IStructureTranspiler;
          ret.appendChunk(transpiler.transpile(c, this));
          continue;
        }
        ret.appendChunk(this.traverseStructure(c));
      } else if (c instanceof abaplint.Nodes.StatementNode) {
        ret.appendChunk(this.traverseStatement(c));
      } else {
        throw new Error("traverseStructure, unexpected child node type");
      }
    }
    return ret;
  }

  protected traverseStatement(node: abaplint.Nodes.StatementNode): Chunk {
    const list: any = StatementTranspilers;
    const search = node.get().constructor.name + "Transpiler";
    if (list[search]) {
      const transpiler = new list[search]() as IStatementTranspiler;
      const chunk = transpiler.transpile(node, this);
      chunk.appendString("\n");
      return chunk;
    }
    throw new Error(`Statement ${node.get().constructor.name} not supported, ${node.concatTokens()}`);
  }

  protected traverseExpression(node: abaplint.Nodes.ExpressionNode): Chunk {
    const list: any = ExpressionTranspilers;
    const search = node.get().constructor.name + "Transpiler";
    if (list[search]) {
      const transpiler = new list[search]() as IExpressionTranspiler;
      return transpiler.transpile(node, this);
    }
    throw new Error(`Expression ${node.get().constructor.name} not supported, ${node.concatTokens()}`);
  }

}