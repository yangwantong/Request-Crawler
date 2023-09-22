import path from 'path';
import process from 'process';
import { FoundRequest } from '../FoundRequest.js';

const ORANGE = "\x1b[38;5;202m";
const ENDCOLOR = "\x1b[0m";

export async function do_login(page) {
    console.log("[*] do_login called");
    //curl -i -s -k -X $'POST' --data-binary $'ipamusername=admin&ipampassword=password&phpipamredirect=%2F' $'http://10.90.90.90:9797/app/login/login_check.php'
    var loginData = this.loginData;
    console.log(`${ORANGE}[Login] Performing login ${loginData["form_url"]}${ENDCOLOR}`)
    var gotourl = new URL(loginData["form_url"]);
    var data = loginData["post_data"];
    var method = loginData["method"];

    if (this.url === "") {
        let foundRequest = FoundRequest.requestParamFactory(loginData["form_url"], method, data, {}, "LoginPage", this.appData.site_url.href);
        foundRequest.from = "LoginPage";
        let addResult = this.appData.addRequest(foundRequest);
        if (addResult) {
            console.log(`[${GREEN}WC${ENDCOLOR}] ${GREEN} ${GREEN} ADDED ${ENDCOLOR}${ENDCOLOR}${foundRequest.toString()}  ${ENDCOLOR}`);
        }
    }

    var self = this;
    function interceptLoginRequest(req) {   // 로그인 네트워크 요청 가로채기 위한 이벤트 핸들러
        // let pdata = {
        //     'method': method,
        //     'postData': data,
        //     headers: {
        //         ...interceptedReq.headers(),
        //         "Content-Type": "application/x-www-form-urlencoded"
        //     }
        // };
        if (req.url().startsWith(`${self.appData.site_url.href}`)) {    // 사이트 내부의 요청만 가로채기
            let basename = path.basename(req.url());
            if (basename.indexOf("?") > -1) {   //  URL에 파라미터가 있으면 파라미터 제거
                basename = basename.slice(0, basename.indexOf("?"));
            }

            let foundRequest = FoundRequest.requestObjectFactory(req);
            foundRequest.from = "LoginInterceptedRequest";
            self.requestsAdded += self.appData.addInterestingRequest(foundRequest);
        }
        req.continue();
    }

    // 로그인 네트워크 요청 가로채기
    page.on('request', interceptLoginRequest);

    console.log(`${ORANGE}[Login] REQUESTING URL${ENDCOLOR}`, gotourl.href);

    const response = await page.goto(gotourl, { waitUntil: "networkidle2" });
    this.page.on('dialog', async dialog => {    // 로그인 dialog 무시
        console.log(`[WC] Dismissing LOGIN Message: ${dialog.message()}`);
        await dialog.dismiss();
    });

    console.log(`${ORANGE}######## [Login] ACCOUNT INFORMATION ########${ENDCOLOR}`);
    console.log(`${ORANGE}# USERNAME: ${loginData["usernameValue"]}${ENDCOLOR}`);
    console.log(`${ORANGE}# PASSWORD: ${loginData["passwordValue"]}${ENDCOLOR}`);
    console.log(`${ORANGE}#############################################${ENDCOLOR}`);


    self.usernameValue = loginData["usernameValue"];
    self.passwordValue = loginData["passwordValue"];

    try {
        if (loginData["usernameSelector"] || loginData["passwordSelector"]) {

            await page.keyboard.press("Escape");
            await page.keyboard.press("Escape");

            if (loginData["loginStartSelector"]) {
                let p = await page.$(loginData["loginStartSelector"])
                await p.click();
                await (sleepg(100));
            }
            if (loginData["usernameSelector"]) {
                await page.focus(loginData["usernameSelector"]);
                await page.keyboard.type(loginData["usernameValue"], { delay: 100 });
            }
            await page.focus(loginData["passwordSelector"]);
            await page.keyboard.type(loginData["passwordValue"], { delay: 100 });
            const element = await page.$(loginData["passwordSelector"]);
            //const text = await (await element.getProperty('value')).jsonValue();

            // 로그인을 하기 전 스크린샷 저장
            await page.screenshot({ path: this.base_appdir + '/screenshot/screenshot-pre-login.png', type: "png" });

            let submitType = loginData["submitType"].toLowerCase();
            let navwait = page.waitForNavigation({ waitUntil: "load" });
            if (submitType === "submit") {
                const inputElement = await page.$('input[type=submit]');
                await inputElement.click();
            } else if (submitType === "enter") {
                //console.log("\nPRESSING ENTERE\n");
                await Promise.all([page.keyboard.type("\n"), page.waitForNavigation({ timeout: 10000, waitUntil: 'networkidle2' })])

            } else if (submitType === "click") {
                //await page.keyboard.type("");
                console.log("submitting form");
                const formElement = await page.$(loginData["form_selector"]);
                const inputElement = await formElement.$(loginData["form_submit_selector"]);
                inputElement.disabled = false
                console.log("input element = ", inputElement),
                    await Promise.all([page.evaluate("$('#loginButton').disabled = false;$('#loginButton').click()"),
                    await inputElement.click(),
                    page.waitForNavigation({ timeout: 5000, waitUntil: 'networkidle2' })]);

            }
        } else {
            console.log(`No login b/c usernameSelector config value is empty`);
        }
    } catch (err) {
        console.log(await page.content());
        console.log("CRITICAL ERROR: login failed");
        console.log(err);
        console.log(err.stack);
        process.exit(39);
    }


    const bodyResponse = await page.content();

    const responseStatusCode = response._status;
    if (responseStatusCode >= 400) {
        console.log(response);
        console.log("\nERROR ERROR ERROR ERROR  LOGIN FAILED TO COMPLETE ERROR ERROR ERROR ");
        process.exit(39);
    }

    //console.log(bodyResponse);
    //console.log("POSI IS ", loginData["positiveLoginMessage"]);
    if (bodyResponse.indexOf(loginData["positiveLoginMessage"]) === -1) {
        console.log(bodyResponse);
        console.log("\nERROR ERROR ERROR ERROR  LOGIN FAILED TO COMPLETE, didn't find expected message ERROR ERROR ERROR ");
        process.exit(38);
    }
    page.removeListener('request', interceptLoginRequest);
    let cookies = await page.cookies();
    //console.log("Cookies returned are ", cookies);
    let loginPageLanding = await page.url();
    //console.log("\x1b[36mLanding page of login ", loginPageLanding , "");
    let foundRequest = FoundRequest.requestParamFactory(loginPageLanding, "GET", "", {}, "targetChanged", self.appData.site_url.href);
    self.requestsAdded += self.appData.addInterestingRequest(foundRequest);

    console.log(`${ORANGE}[Login] Login Successful${ENDCOLOR}`);    // 로그인 성공

    return cookies
}