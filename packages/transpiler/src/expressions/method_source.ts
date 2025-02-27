/* eslint-disable max-len */
import {Nodes, Expressions} from "@abaplint/core";
import {IExpressionTranspiler} from "./_expression_transpiler";
import {Traversal} from "../traversal";
import {Chunk} from "../chunk";
import {FieldChainTranspiler} from ".";

export class MethodSourceTranspiler implements IExpressionTranspiler {
  private prepend: string;

  public constructor(prepend?: string) {
    this.prepend = (prepend || "") + "await ";
  }

  public transpile(node: Nodes.ExpressionNode, traversal: Traversal): Chunk {
    const ret = new Chunk();
    const children = node.getChildren();
    let call: string = "";

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const nextChild = children[i + 1];

      if (child.get() instanceof Expressions.ClassName) {
        call += traversal.lookupClassOrInterface(child.concatTokens(), child.getFirstToken());
      } else if (child.get() instanceof Expressions.Dynamic && nextChild?.concatTokens() === "=>") {
        const second = child.getChildren()[1];
        const lookupException = traversal.lookupClassOrInterface("'CX_SY_DYN_CALL_ILLEGAL_CLASS'", child.getFirstToken(), true);
        if (second.get() instanceof Expressions.FieldChain && second instanceof Nodes.ExpressionNode) {
          const t = new FieldChainTranspiler(true).transpile(second, traversal).getCode();

          call = traversal.lookupClassOrInterface(t, child.getFirstToken(), true);
          ret.appendString(`if (${call} === undefined && ${lookupException} === undefined) { throw "CX_SY_DYN_CALL_ILLEGAL_CLASS not found"; }\n`);
          ret.appendString(`if (${call} === undefined) { throw new ${lookupException}(); }\n`);
        } else if (second.get() instanceof Expressions.Constant) {
          call = traversal.lookupClassOrInterface(second.getFirstToken().getStr(), child.getFirstToken(), true);
          ret.appendString(`if (${call} === undefined && ${lookupException} === undefined) { throw "CX_SY_DYN_CALL_ILLEGAL_CLASS not found"; }\n`);
          ret.appendString(`if (${call} === undefined) { throw new ${lookupException}(); }\n`);
        } else {
          ret.appendString("MethodSourceTranspiler-Unexpected");
        }
      } else if (child.get() instanceof Expressions.Dynamic) {
        const second = child.getChildren()[1];
        const lookupException = traversal.lookupClassOrInterface("'CX_SY_DYN_CALL_ILLEGAL_METHOD'", child.getFirstToken(), true);
        if (second.get() instanceof Expressions.FieldChain) {
          call += "[";
          call += traversal.traverse(second).getCode();
          call += ".get().toLowerCase()]";
        } else if (second.get() instanceof Expressions.Constant) {
          if (call.endsWith(".") === false) {
            call += ".";
          }
          call += second.getFirstToken().getStr().replace(/\'/g, "").toLowerCase().replace("~", "$");
        } else {
          ret.appendString("MethodSourceTranspiler-Unexpected");
        }
        ret.appendString(`if (${call} === undefined && ${lookupException} === undefined) { throw "CX_SY_DYN_CALL_ILLEGAL_METHOD not found"; }\n`);
        ret.appendString(`if (${call} === undefined) { throw new ${lookupException}(); }\n`);
      } else if (child.get() instanceof Expressions.MethodName) {
        if (i === 0) {
          this.prepend += "this.";
        }
        const methodName = child.concatTokens().toLowerCase().replace("~", "$");
        call += methodName;
      } else if (child.concatTokens() === "=>") {
        call += ".";
      } else if (child.concatTokens() === "->") {
        if (ret.getCode() !== "super") {
          call += ".get()";
        }
        if (!(nextChild.get() instanceof Expressions.Dynamic)) {
          call += ".";
        }
      } else if (child.get() instanceof Expressions.FieldChain) {
        call += traversal.traverse(child).getCode();
      } else {
        ret.appendString("MethodSourceTranspiler-" + child.get().constructor.name + "-todo");
      }
    }

    ret.appendString(this.prepend);
    ret.appendString(call);

    return ret;
  }

}