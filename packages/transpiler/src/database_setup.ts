import * as abaplint from "@abaplint/core";

export class DatabaseSetup {
  private readonly reg: abaplint.IRegistry;

  public constructor(reg: abaplint.IRegistry) {
    this.reg = reg;
  }

  public run(): string {
    let ret = "";
    // CREATE TABLEs
    for (const obj of this.reg.getObjects()) {
      if (obj instanceof abaplint.Objects.Table && obj.getTableCategory() === abaplint.Objects.TableCategory.Transparent) {
        ret += this.transparentTable(obj);
      }
    }
    // INSERT data
    for (const obj of this.reg.getObjects()) {
      if (obj instanceof abaplint.Objects.MessageClass) {
        ret += this.messageClass(obj);
      }
    }
    ret += this.t000Insert();
    return ret.trim();
  }

//////////////////

  private t000Insert(): string {
    const obj = this.reg.getObject("TABL", "T000") as abaplint.Objects.Table | undefined;
    if (obj === undefined) {
      return "";
    }

    const type = obj.parseType(this.reg);
    if (type instanceof abaplint.BasicTypes.StructureType && type.getComponents().length === 3) {
      // todo, this should take the client number from the settings
      return `INSERT INTO t000 VALUES ('123', '', '');\n`;
    } else {
      return "";
    }
  }

  private messageClass(msag: abaplint.Objects.MessageClass): string {
    // ignore if T100 is unknown
    if (this.reg.getObject("TABL", "T100") === undefined) {
      return "";
    }
    let ret = "";
    for (const m of msag.getMessages()) {
      ret += `INSERT INTO t100 VALUES ('E', '${msag.getName()}', '${m.getNumber()}', '${m.getMessage()}');\n`;
    }
    return ret;
  }

  private transparentTable(tabl: abaplint.Objects.Table): string {
    const type = tabl.parseType(this.reg);
    if (!(type instanceof abaplint.BasicTypes.StructureType)) {
      return "";
    }

    const fields: string[] = [];
    for (const field of type.getComponents()) {
      fields.push(field.name.toLowerCase() + " " + this.toType(field.type));
    }

    // assumption: all transparent tables have primary keys
    const key = ", PRIMARY KEY(" + tabl.listKeys().map(e => e.toLowerCase()).join(",") + ")";

    return `CREATE TABLE ${tabl.getName().toLowerCase()} (${fields.join(", ")}${key});\n`;
  }

  private toType(type: abaplint.AbstractType): string {
    if (type instanceof abaplint.BasicTypes.CharacterType) {
      return `NCHAR(${type.getLength()})`;
    } else if (type instanceof abaplint.BasicTypes.NumericType) {
      // it will be fine, the runtime representation of numc is also text
      return `NCHAR(${type.getLength()})`;
    } else if (type instanceof abaplint.BasicTypes.StringType) {
      return `TEXT`;
    } else if (type instanceof abaplint.BasicTypes.XStringType) {
      // it will be fine, the runtime representation of xstring is also text
      return `TEXT`;
    } else if (type instanceof abaplint.BasicTypes.IntegerType) {
      return `INT`;
    } else {
      throw "database_setup, todo toType handle: " + type.constructor.name;
    }
  }

}