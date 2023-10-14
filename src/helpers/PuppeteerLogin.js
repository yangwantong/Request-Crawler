import {FoundRequest} from "./FoundRequest.js";
import {ENDCOLOR, ORANGE, RED} from "../common/utils.js";

/**
 * 로그인 정보가 있을 때, 웹 사이트에 로그인을 수행하는 함수
 * @param url : string
 * @param appData : AppData
 * @param page : Page
 * @param requestsAdded : int
 * @param loginData : JSON
 * @param base_directory : string
 * @returns {*} : cookies
 */
export const doLogin = async (url, appData, page, requestsAdded, loginData, base_directory) => {
    let loginUrl = new URL(loginData["login_url"]);
    const interceptLoginRequest = async (req) => {
        if (req.url().startsWith(`${appData.site_url.href}`)){
            let foundRequest = new FoundRequest(req.url(), req.method(), req.postData(), req.headers(), req.resourceType(), appData.site_url.href);
            foundRequest.setFrom("LoginInterceptedRequest");
            requestsAdded += appData.addInterestingRequest(foundRequest);
        }
        req.continue();
    }

    // puppeteer intercepts the request
    page.on('request', interceptLoginRequest);

    let loginPageResponse = await page.goto(loginUrl, { waitUntil:"networkidle2" });
    if (loginPageResponse.status() >= 400) {
        console.error(`${RED}[LOGIN] Error loading login page: ${ENDCOLOR}` + loginUrl);
        console.error(`${RED}[LOGIN] Status Code: ${ENDCOLOR}` + loginPageResponse.status());
        process.exit(1);
    }

    page.on('dialog', async dialog => {
        await dialog.dismiss();
    });

    console.log(`${ORANGE}[LOGIN] Try Login...${ENDCOLOR}`)

    /**
     * Puppeteer를 이용하여 로그인을 수행하는 부분
     */
    try {
        await page.waitForSelector(loginData["usernameSelector"], {timeout: 10000})
        await page.waitForSelector(loginData["passwordSelector"], {timeout: 10000})

        await page.focus(loginData["usernameSelector"]);
        await page.keyboard.type(loginData["usernameValue"], {delay: 100});

        await page.focus(loginData["passwordSelector"]);
        await page.keyboard.type(loginData["passwordValue"], {delay: 100});

        await page.screenshot({ path : base_directory + "/output/screenshots/pre-login.png" });

        let submitType = loginData["submitType"].toLowerCase();

        if (submitType === "submit") {
            await page.evaluate(() => {
                document.querySelector("form").submit();
            });
        } else if (submitType === "enter") {
            await page.keyboard.press("Enter");
        } else if (submitType === "click") {
            await page.click(loginData["submitSelector"]);
        }
    } catch(err) {
        console.error(`${RED}[LOGIN] An error occurred while logging in: ${ENDCOLOR}` + err)
    }

    try {
        await page.waitForNavigation({ waitUntil: "networkidle2" });
        const bodyResponse = await page.content();

        if (bodyResponse.indexOf(loginData["positiveLoginMessage"]) === -1) {
            console.error(`${RED}[-] Login failed. Can't find Positive Login Message in Response.${ENDCOLOR}`)
            process.exit(1);
        }
    } catch (err) {
        console.error(`${RED}[-] An error occurred while logging in: ${ENDCOLOR}` + err)
        process.exit(1);
    }

    page.off('request', interceptLoginRequest);

    let loginPageLanding = await page.url();
    let foundRequest = new FoundRequest(loginPageLanding, "GET", "", {}, "targetChanged", appData.site_url.href);
    requestsAdded += appData.addInterestingRequest(foundRequest);

    await page.screenshot({ path : base_directory + "/output/screenshots/after-login.png" });

    console.log(`${ORANGE}[LOGIN] Login Success.${ENDCOLOR}`)

    return await page.cookies();
}

/**
 * 로그인 후 얻은 쿠키를 페이지에 추가하는 함수
 * @param loginCookies : cookies
 * @param page : Page
 * @param site_url : URL
 * @param cookieData : string
 * @param cookies : any
 */
export const addCookiesToPage = async (loginCookies, page, site_url, cookieData, cookies) => {
    let cookiesarr = cookieData.split(";");
    let cookies_in = [];
    for (let cookie of loginCookies) {
        cookies_in.push(cookie)
    }

    cookiesarr.forEach(function (cv) {
        if (cv.length > 2 && cv.search("=") > -1) {
            let cvarr = cv.split("=");
            let cv_name = `${cvarr[0].trim()}`;
            let cv_value = `${cvarr[1].trim()}`;
            cookies_in.push({"name": cv_name, "value": cv_value, url: `${site_url.origin}`});
        }
    });

    for (let cookie of cookies_in) {
        if (cookie["name"] === "token"){
            page.setExtraHTTPHeaders({Authorization:`Bearer ${cookie["value"]}`});
            this.bearer = `Bearer ${cookie["value"]}`;
        }
        cookies.push({"name": cookie["name"], "value": cookie["value"]});
    }

    await page.setCookie(...cookies_in);
}