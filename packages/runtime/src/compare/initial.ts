import {ABAPObject, DataReference, Date, Numc, Structure, Table, Time} from "../types";
import {ICharacter} from "../types/_character";
import {INumeric} from "../types/_numeric";

export function initial(val: ICharacter | INumeric | string | number | Structure | DataReference | Table | ABAPObject) {
  if (val instanceof Table) {
    return val.array().length === 0;
  } else if (val instanceof DataReference) {
    return val.getPointer() === undefined;
  } else if (val instanceof Date) {
    return val.get() === "00000000";
  } else if (val instanceof Numc) {
    return val.get().match(/^0+$/) !== null;
  } else if (val instanceof Time) {
    return val.get() === "000000";
  }

  if (typeof val === "string") {
    return val === "";
  } else if (typeof val === "number") {
    return val === 0;
  }
  const value = val.get();
  if (typeof value === "string") {
    return value === "";
  } else if (typeof value === "number") {
    return value === 0;
  } else if (val instanceof ABAPObject) {
    return value === undefined;
  } else if (typeof value === "object") {
    for (const f of Object.keys(value)) {
      if (initial(value[f]) === false) {
        return false;
      }
    }
    return true;
  } else {
    throw new Error("runtime, initial, missing implementation");
  }
}