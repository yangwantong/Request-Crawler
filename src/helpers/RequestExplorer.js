import fs from 'fs';
import path from 'path';
import process from "process";
import puppeteer from "puppeteer";

import { doLogin, addCookiesToPage } from "./PuppeteerLogin.js";
import {GREEN, ENDCOLOR, RED, ORANGE} from '../common/utils.js';
import { validateConfig } from "../common/validateConfig.js";

export class RequestExplorer {
    appData;
    base_appdir;
    loopcnt = 0;
    cookies = [];
    bearer = "";
    isLoading = false;
    reinitPage = false;
    loadedURLs = [];
    passwordValue = "";
    usernameValue = "";
    requestsAdded = 0;
    timeoutLoops = 5;
    timeoutValue = 3;
    actionLoopTimeout = 45;
    gremCounter = {};
    shownMessages = {};
    maxLevel = 10;
    browser = null;
    page = null;
    gremlins_error = false;
    lamehord_done = false;
    gremlins_url = "";
    currentRequestKey = "GET";
    url = "";
    method = "GET";
    postData = "";
    cookieData = "";
    browser_up = false;

    constructor(appData, base_appdir, currentRequest) {
        this.appData = appData;
        this.base_appdir = base_appdir;

        this.getConfigData();

        if (appData.getRequestCount() > 0) {
            this.currentRequestKey = currentRequest.getRequestKey();
            this.url = currentRequest.getURL();
            this.method = currentRequest.getMethod();
            this.postData = currentRequest.getPostData();
            this.cookieData = currentRequest.getCookieData();

            if (this.appData.requestsFound[this.currentRequestKey]) {
                this.appData.requestsFound[this.currentRequestKey]["processed"]++;
            } else {
                console.log('음...여긴 뭘까')
            }
        }
    }

    getConfigData() {
        const json_fn = path.join(this.base_appdir, "config/crawler_config.json");
        if (fs.existsSync(json_fn)) {
            const jstrdata = fs.readFileSync(json_fn);
            this.loginData = JSON.parse(jstrdata)["request_crawler"];
            this.usernameValue = this.loginData["usernameValue"];
            this.passwordValue = this.loginData["passwordValue"];
        }
    }

    async start() {
        let self = this;
        process.on('SIGINT', () => {
            console.log(`${GREEN}[!] SIGINT signal received! Crawler Stopped.${ENDCOLOR}`)
            process.exit(0);
        })
        console.log(`${GREEN}[+] Browser launching with URL : ${ENDCOLOR} ${this.url.href}`)

        try {
            try {
                this.browser = await puppeteer.launch({
                    headless: this.appData.getHeadless(),
                    args: [
                        '--disable-features=site-per-process', '--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'
                    ]
                });
                this.browser_up = true;
            } catch (err) {
                console.error(`${RED}[-] puppeteer launch failed.${ENDCOLOR}`)
                console.error(err)
                this.browser_up = false;
                process.exit(1)
            }

            let gremlinsErrorTest = setInterval(function(){
                if (self.gremlins_error && self.lamehord_done){
                    try {
                        console.error(`${RED}[-] Gremlins Error. Browser will closed.${ENDCOLOR}`)
                        self.browser_up = false;
                        self.browser.close();
                    } catch (err){
                        console.error(`${RED}[-] ERROR with closing browser after timeout.${ENDCOLOR}`)
                        console.error(err)
                    }
                    self.gremlins_error = false;
                }
            }, 10*1000);

            this.page = await this.browser.newPage();

            try {
                await this.page.setRequestInterception(true);

                if (this.loginData["perform_login"] === "Y") {
                    if (validateConfig(this.loginData)) {
                        try {
                            const loginCookies = await doLogin(this.url, this.appData, this.page, this.requestsAdded, this.loginData, this.base_appdir);
                            await addCookiesToPage(loginCookies, this.page, this.appData.getSiteUrl(), this.cookieData, this.cookies)
                                .then(() => {
                                    console.log(`${ORANGE}[+] Success Cookies added to page.${ENDCOLOR}`)
                                })
                                .catch(() => {
                                    console.error(`${RED}[-] ERROR: An error occurred during adding cookies to page.${ENDCOLOR}`);
                            });
                        } catch (error) {
                            console.error(`${RED}[-] ERROR: An error occurred during login.${ENDCOLOR}`);
                            console.error(error);
                            process.exit(1);
                        }
                    } else {
                        process.exit(1);
                    }
                }
            } catch (err) {
                console.error(`${RED}[-] ERROR with setting up page.${ENDCOLOR}`)
                console.error(err)
            } finally {
                clearInterval(gremlinsErrorTest);
                await this.browser.close();
            }

        } catch (err) {
            console.error(`${RED}[-] ERROR with starting browser or creating new page${ENDCOLOR}`)
            console.error(err)
        }
    }
}
