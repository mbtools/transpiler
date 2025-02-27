import * as abaplint from "@abaplint/core";
import {IStatementTranspiler} from "./_statement_transpiler";
import {Traversal} from "../traversal";
import {Chunk} from "../chunk";

export class InsertDatabaseTranspiler implements IStatementTranspiler {

  public transpile(node: abaplint.Nodes.StatementNode, traversal: Traversal): Chunk {
    const table = traversal.traverse(node.findFirstExpression(abaplint.Expressions.DatabaseTable));

    const options: string[] = [];

    const values = node.findExpressionAfterToken("VALUES");
    if (values) {
      const tvalues = traversal.traverse(values);
      options.push(`"values": ` + tvalues.getCode());
    }

    return new Chunk(`abap.statements.insertDatabase(${table.getCode()}, {${options.join(", ")}});`);
  }

}