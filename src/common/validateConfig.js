import {ENDCOLOR, RED} from "./utils.js";

export function validateConfig(loginData){
    const { login_url, usernameSelector, passwordSelector, submitType, positiveLoginMessage } = loginData;
    const validSubmitTypes = ['click', 'enter', 'submit']

    if (!login_url) {
        console.error(`${RED}[-] ERROR: login_url is empty.${ENDCOLOR}`);
        console.error(`${RED}[-] Please check witcher_config.json.${ENDCOLOR}`);
        return false
    }

    if (!usernameSelector || !passwordSelector) {
        console.error(`${RED}[-] ERROR: usernameSelector or passwordSelector is empty.${ENDCOLOR}`);
        console.error(`${RED}[-] Please check witcher_config.json.${ENDCOLOR}`);
        return false
    }

    if (!submitType) {
        console.error(`${RED}[-] ERROR: submitType is empty.${ENDCOLOR}`);
        console.error(`${RED}[-] Please check witcher_config.json.${ENDCOLOR}`);
        return false
    }

    if (!validSubmitTypes.includes(submitType.toLowerCase())) {
        console.error(`${RED}[-] ERROR: submitType is invalid.${ENDCOLOR}`);
        console.error(`${RED}[-] Please check witcher_config.json.${ENDCOLOR}`);
        return false
    }

    if (!positiveLoginMessage) {
        console.error(`${RED}[-] ERROR: positiveLoginMessage is empty.${ENDCOLOR}`);
        console.error(`${RED}[-] Please check witcher_config.json.${ENDCOLOR}`);
        return false
    }

    return true
}