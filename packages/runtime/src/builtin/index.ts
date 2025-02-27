import {Character} from "../types";

export * from "./abs";
export * from "./boolc";
export * from "./ceil";
export * from "./concat_lines_of";
export * from "./condense";
export * from "./cos";
export * from "./count";
export * from "./escape";
export * from "./find";
export * from "./floor";
export * from "./frac";
export * from "./lines";
export * from "./nmax";
export * from "./nmin";
export * from "./repeat";
export * from "./replace";
export * from "./reverse";
export * from "./round";
export * from "./shift_left";
export * from "./sign";
export * from "./sin";
export * from "./strlen";
export * from "./substring_after";
export * from "./substring_before";
export * from "./substring";
export * from "./sy";
export * from "./tan";
export * from "./to_lower";
export * from "./to_upper";
export * from "./trunc";
export * from "./xstrlen";
export const abap_true = new Character({length: 1, qualifiedName: "ABAP_BOOL"}).set("X");
export const abap_false = new Character({length: 1, qualifiedName: "ABAP_BOOL"}).set("");
export const abap_undefined = new Character({length: 1, qualifiedName: "ABAP_BOOL"}).set("-");
export const space = new Character({length: 1, qualifiedName: "ABAP_BOOL"}).set(" ");