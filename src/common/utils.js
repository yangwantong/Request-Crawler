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

export const sleepg = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Attempts to parse the text, if there's a syntax error then returns false
 * @param response
 * @param responseText
 * @returns {boolean}
 */
export const isInteractivePage = (response, responseText) => {

    try {
        JSON.parse(responseText);
        return false;
    } catch (SyntaxException){
        //check out other types
    }

    if (response.headers().hasOwnProperty("content-type")){

        let contentType = response.headers()['content-type'];

        if (contentType === "application/javascript" || contentType === "text/css" || contentType.startsWith("image/") || contentType === "application/json"){
            console.log("Content type ${contentType} is considered non-interactive (e.g., JavaScript, CSS, json, or image/* )")
            return false;
        }
    }

    //console.log(responseText.slice(0,500))
    if (responseText.search(/<body[ >]/) > -1 || responseText.search(/<form[ >]/) > -1 || responseText.search(/<frameset[ >]/) > -1 ){
        return true;
    } else {
        console.log(responseText.slice(0,5000))
        console.log(`[+]NO HTML tag FOUND anywhere, skipping ${response.url()}`)
        return false;
    }

}