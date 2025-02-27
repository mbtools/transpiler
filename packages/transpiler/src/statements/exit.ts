import * as abaplint from "@abaplint/core";
import {Chunk} from "../chunk";
import {Traversal} from "../traversal";
import {IStatementTranspiler} from "./_statement_transpiler";

export class ExitTranspiler implements IStatementTranspiler {

  public transpile(node: abaplint.Nodes.StatementNode, traversal: Traversal): Chunk {
    return new Chunk().append("break;", node, traversal);
  }

}