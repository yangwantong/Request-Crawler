export const RED = "\x1b[38;5;1m";
export const GREEN = "\x1b[38;5;2m";
export const BLUE = "\x1b[38;5;4m";
export const YELLOW = "\x1b[38;5;3m";
export const ENDCOLOR = "\x1b[0m";

export const isDefined = (val) => {
    return !(typeof val === 'undefined' || val === null);
}