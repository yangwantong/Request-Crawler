export const RED = "\x1b[38;5;1m"
export const ORANGE = "\x1b[38;5;202m"
export const GREEN = "\x1b[38;5;2m"
export const BLUE = "\x1b[38;5;4m"
export const YELLOW = "\x1b[38;5;3m"
export const PURPLE = "\x1b[38;5;5m"
export const CYAN = "\x1b[38;5;6m"
export const ENDCOLOR = "\x1b[0m"

export const isDefined = (val) => {
    return !(typeof val === 'undefined' || val === null)
}