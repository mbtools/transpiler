import {ICharacter} from "../types/_character";
import {INumeric} from "../types/_numeric";

export interface IShiftOptions {
  deletingLeading?: string | ICharacter,
  places?: INumeric,
  to?: ICharacter | string,
  direction?: "LEFT" | "RIGHT",
  circular?: boolean,
  mode?: "BYTE" | "CHARACTER",
}

export function shift(target: ICharacter, options?: IShiftOptions) {
  if (options?.direction === "RIGHT") {
    throw "SHIFT, RIGHT todo";
  }
  if (options?.mode === "BYTE") {
    shift_byte_mode(target, options);
  } else {
    shift_character_mode(target, options);
  }
}

function shift_character_mode(target: ICharacter, options?: IShiftOptions) {
  let value = target.get();

  if (options?.deletingLeading) {
    let leading = options.deletingLeading;
    if (typeof leading !== "string") {
      leading = leading.get();
    }
    const split = leading.split("");
    while (split.some(s => value.substr(0, 1) === s)) {
      value = value.substr(1);
    }
  } else if (options?.places) {
    const p = options.places.get();
    if (options.circular) {
      value = value.substr(p) + value.substr(0, p);
    } else {
      value = value.substr(p);
    }
  } else if (options?.to) {
    let to = "";
    if (typeof options.to === "string") {
      to = options.to;
    } else {
      to = options.to.get();
    }

    const index = value.search(to);
    if (index > 0) {
      value = value.substr(index);
    }
  } else {
    if (options?.circular) {
      value = value.substr(1) + value.substr(0, 1);
    } else {
      value = value.substr(1);
    }
  }

  target.set(value);
}


function shift_byte_mode(target: ICharacter, options?: IShiftOptions) {
  let value = target.get();

  if (options?.deletingLeading) {
    let leading = options.deletingLeading;
    if (typeof leading !== "string") {
      leading = leading.get();
    }
    const split = leading.split("");
    while (split.some(s => value.substr(0, 2) === s)) {
      value = value.substr(2);
    }
  } else if (options?.places) {
    const p = options.places.get() * 2;
    if (options.circular) {
      value = value.substr(p) + value.substr(0, p);
    } else {
      value = value.substr(p);
    }
  } else if (options?.to) {
    let to = "";
    if (typeof options.to === "string") {
      to = options.to;
    } else {
      to = options.to.get();
    }

    const index = value.search(to);
    if (index > 0) {
      value = value.substr(index);
    }
  }

  target.set(value);

}