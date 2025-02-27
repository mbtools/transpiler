import * as abaplint from "@abaplint/core";
import {Validation, config} from "./validation";
import {UnitTest} from "./unit_test";
import {Keywords} from "./keywords";
import {DatabaseSetup} from "./database_setup";
import {HandleTable} from "./handle_table";
import {HandleABAP} from "./handle_abap";
import {IFile, IOutput, IProgress, ITranspilerOptions, IOutputFile} from "./types";
import {HandleDataElement} from "./handle_data_element";
import {HandleTableType} from "./handle_table_type";

export {config, ITranspilerOptions, IFile, IProgress, IOutputFile};

export class Transpiler {
  private readonly options: ITranspilerOptions | undefined;

  public constructor(options?: ITranspilerOptions) {
    this.options = options;
    if (this.options === undefined) {
      this.options = {};
    }
    if (this.options.unknownTypes === undefined) {
      this.options.unknownTypes = "compileError";
    }
  }

  // workaround for web/webpack
  public async runRaw(files: IFile[]): Promise<IOutput> {
    const memory = files.map(f => new abaplint.MemoryFile(f.filename, f.contents));
    const reg: abaplint.IRegistry = new abaplint.Registry().addFiles(memory).parse();
    return new Transpiler().run(reg);
  }

  public async run(reg: abaplint.IRegistry, progress?: IProgress): Promise<IOutput> {

    reg.parse();
    new Keywords().handle(reg);
    this.validate(reg);

    const dbSetup = new DatabaseSetup(reg).run();

    const output: IOutput = {
      objects: [],
      unitTestScript: new UnitTest().unitTestScript(reg, this.options?.skip, this.options?.only),
      unitTestScriptOpen: new UnitTest().unitTestScriptOpen(reg, this.options?.skip, this.options?.only),
      initializationScript: new UnitTest().initializationScript(reg, dbSetup, this.options?.extraSetup),
      databaseSetup: dbSetup,
      reg: reg,
    };

    progress?.set(reg.getObjectCount(false), "Building, Syntax Logic");
    for (const obj of reg.getObjects()) {
      await progress?.tick("Building, Syntax Logic, " + obj.getName());
      if (obj instanceof abaplint.ABAPObject) {
// todo, this is already done inside reg.parse()?
        new abaplint.SyntaxLogic(reg, obj).run();
      }
    }

    progress?.set(reg.getObjectCount(false), "Building");
    for (const obj of reg.getObjects()) {
      await progress?.tick("Building, " + obj.getName());
      if (obj instanceof abaplint.ABAPObject && !(obj instanceof abaplint.Objects.TypePool)) {
        output.objects.push(...new HandleABAP(this.options).runObject(obj, reg));
      } else if (obj instanceof abaplint.Objects.Table) {
        output.objects.push(...new HandleTable().runObject(obj, reg));
      } else if (obj instanceof abaplint.Objects.DataElement) {
        output.objects.push(...new HandleDataElement().runObject(obj, reg));
      } else if (obj instanceof abaplint.Objects.TableType) {
        output.objects.push(...new HandleTableType().runObject(obj, reg));
      }
    }

    return output;
  }

// ///////////////////////////////

  protected validate(reg: abaplint.IRegistry): void {
    const issues = new Validation(this.options).run(reg);
    if (issues.length > 0) {
      const messages = issues.map(i => i.getKey() + ", " +
        i.getMessage() + ", " +
        i.getFilename() + ":" +
        i.getStart().getRow());
      throw new Error(messages.join("\n"));
    }
  }

}