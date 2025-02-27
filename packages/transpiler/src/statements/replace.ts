import * as abaplint from "@abaplint/core";
import {IStatementTranspiler} from "./_statement_transpiler";
import {SourceTranspiler} from "../expressions";
import {Traversal} from "../traversal";
import {Chunk} from "../chunk";

export class ReplaceTranspiler implements IStatementTranspiler {

  public transpile(node: abaplint.Nodes.StatementNode, traversal: Traversal): Chunk {

    const sources: string[] = [];
    for (const s of node.findDirectExpressions(abaplint.Expressions.Source)) {
      sources.push(new SourceTranspiler().transpile(s, traversal).getCode());
    }

    const target = traversal.traverse(node.findDirectExpression(abaplint.Expressions.Target)).getCode();

    const concat = node.concatTokens().toUpperCase();
    const all = concat.startsWith("REPLACE ALL");

    if (concat.includes("SECTION LENGTH")) {
// TODO,
      const last = sources.pop()!;
      sources.pop();
      sources.push(last);
    }

    return new Chunk()
      .append("abap.statements.replace(", node, traversal)
      .appendString(target + ", " + all + ", " + sources.join(", "))
      .append(");", node.getLastToken(), traversal);
  }

}