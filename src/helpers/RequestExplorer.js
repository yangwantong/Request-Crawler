import fs from 'fs';
import path from 'path';
import process from "process";
import puppeteer from "puppeteer";

import { doLogin, addCookiesToPage } from "./PuppeteerLogin.js";
import {GREEN, ENDCOLOR, RED, ORANGE} from '../common/utils.js';
import { validateConfig } from "../common/validateConfig.js";
import { ExerciseTargetPage } from "./ExerciseTargetPage.js";
import { ExerciseTarget } from "./ExerciseTarget.js";
import {FoundRequest} from "./FoundRequest.js";

const MAX_NUM_ROUNDS = 1;   // 한 페이지당 몇번 크롤링을 시도할 것인지

export class RequestExplorer {
    appData;
    base_directory;
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

    constructor(appData, base_directory, currentRequest) {
        this.appData = appData;
        this.base_directory = base_directory;

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
        const json_fn = path.join(this.base_directory, "config/witcher_config.json");
        if (fs.existsSync(json_fn)) {
            const jstrdata = fs.readFileSync(json_fn);
            this.loginData = JSON.parse(jstrdata)["request_crawler"];
            this.usernameValue = this.loginData["usernameValue"];
            this.passwordValue = this.loginData["passwordValue"];
        }
    }

    increaseRequestAdded() {
        this.requestsAdded++;
    }

    setRequestAdded(value) {
        this.requestsAdded = value;
    }

    getRoundResults(){
        let total = 0, above = 0, below = 0, equalto = 0;
        for (const [key, val] of Object.entries(this.appData.requestsFound)) {
            total++;
            equalto += val["attempts"] === this.appData.currentURLRound ? 1 : 0;
            above += val["attempts"] === this.appData.currentURLRound ? 0 : 1;
        }
        return {totalInputs:this.appData.getInputSetSize(), totalRequests: total, equaltoRequests: equalto, aboveRequests:above}
    }

    hasGremlinResults(){
        return ("grandTotal" in this.gremCounter);
    }

    reportResults(){
        if (Object.entries(this.shownMessages).length > 0) {
            console.log("ERRORS:");
            for (const [key, val] of Object.entries(this.shownMessages)) {
                let strindex = key.indexOf("\n");
                strindex = strindex === -1 ? key.length : strindex;
                console.log(`\tERROR msg '${key.substring(0, strindex)}' seen ${val} times`);
            }
        }
        if (this.hasGremlinResults()) {
            console.log(this.gremCounter);
        }

        let roundResults = this.getRoundResults();
        console.log(`[WC] Round Results for round ${this.appData.currentURLRound} of ${MAX_NUM_ROUNDS}: Total Inputs :  ${roundResults.totalInputs} Total Requests: ${roundResults.equaltoRequests} of ${roundResults.totalRequests} processed so far`);

    }

    async searchForURLSelector(page, tag, attribute, completed={}){
        let elements = [];
        console.log("[WC] searchForURLSelector starting.");
        try {
            const links = await page.$$(tag);
            for (var i=0; i < links.length; i++) {
                if (links[i]){
                    if (i === 0){
                        let hc = await links[i].getProperty("hashCode");
                        console.log(`[WC] check element hash = ${hc} ${typeof(links[i])}`);
                    }
                    await this.resetURLBack(page);
                    let valueHandle = null;
                    try{
                        valueHandle = await links[i].getProperty(attribute);
                    } catch(ex){
                        console.log(`[WC] \x1b[38;5;197m link #${i}/${links.length} error encountered while trying to getProperty`, typeof(page), page.url(), tag, attribute, links[i], "\n",ex, "\x1b[0m");
                        try {
                            console.log("[WC] Trying again", links[i]);

                            valueHandle = await links[i].getProperty(attribute);
                        } catch (eex){
                            continue;
                        }
                    }
                    let val = await valueHandle.jsonValue();
                    if (isDefined(val)){
                        elements.push(val);
                    }

                    console.log(`[WC] link #${i}/${links.length} completed`);
                }
            }

        } catch (e){
            console.log("[WC] error encountered while trying to search for tag", typeof(page), page.url(), tag, attribute, "\n\t", e);
        }
        return elements;
    }

    async addURLsFromPage(page, parenturl){
        let requestsAdded = 0;
        try {
            // these are always GETs
            const anchorlinks = await this.searchForURLSelector(page, 'a', 'href');
            if (anchorlinks){
                //console.log("[WC] adding valid URLS from anchors ")
                requestsAdded += this.appData.addValidURLS(anchorlinks, parenturl, "OnPageAnchor");
            }
            const iframelinks = await this.searchForURLSelector(page, 'iframe', 'src');
            if (iframelinks){
                //console.log("[WC] adding valid URLS from iframe links")
                requestsAdded += this.appData.addValidURLS(iframelinks, parenturl, "OnPageIFrame");
            }
        } catch (ex){
            console.log(`[WC] Error in addURLSFromPage(): ${ex}`)
        }
        return requestsAdded;
    }

    async addFormData(page) {
        let requestsAdded = 0;
        try{
            const forms = await page.$$('form').catch(reason => {
                console.log(`received error in page. ${reason} `);
            });
            if (isDefined(forms)){
                for (let i = 0; i < forms.length; i++) {
                    let faction = await this.getAttribute(forms[i], "action", "");
                    let fmethod = await this.getAttribute(forms[i], "method", "GET");
                    console.log("[WC] second form ACTION=", faction, fmethod, " FROM url ", await page.url());
                    requestsAdded += await this.searchForInputs(forms[i]);
                }
            }

        } catch (ex){
            console.log(`[WC] addFormData(p) Error ${ex}`);
            console.log(ex.stack);
        }
        return requestsAdded;
    }

    containsEquivURL(soughtRequest, forceMatch=false){

        let soughtURL = new URL(soughtRequest.url());
        let queryString = soughtURL.search.substring(1);
        let postData = soughtRequest.postData();
        let soughtParamsArr = soughtRequest.getAllParams();
        // let trimmedSoughtParams = [];
        // for (let sp of )
        //soughtParamsArr = [...new Set(soughtParamsArr)];
        let nbrParams = Object.keys(soughtParamsArr).length;
        // if nbrParams*matchPercent is more than nbrParams-1, it's requires a 100% parameter match
        let fullMatchEquiv = nbrParams * this.fuzzyMatchEquivPercent;

        let soughtPathname = soughtRequest.getPathname();

        let keyMatch = 0;

        for (let savedReq of Object.values(this.requestsFound)){
            let prevURL = savedReq.getURL();
            let prevPathname = savedReq.getPathname();

            if (prevURL.href === soughtURL.href && savedReq.postData === soughtRequest.postData() && savedReq.hash === soughtURL.hash){
                return true;
            }
            if (forceMatch){
                return false;
            }
            if (prevPathname === soughtPathname && (!soughtURL.hash || savedReq.hash === soughtURL.hash)){

                if (postData.startsWith("<?xml")){
                    let testPostData = savedReq.postData();
                    let re = new RegExp(/<soap:Body>(.*)<\/soap:Body>/);
                    if (re.test(postData) && re.test(testPostData)){
                        let pd_match = re.exec(postData)
                        let test_pd_match = re.exec(testPostData);

                        let matchVal = this.fuzzyValueMatch(pd_match[1], test_pd_match[1])
                        return matchVal;
                    }
                }

                let testParamsArr = savedReq.getAllParams();

                if (this.equivParameters(soughtParamsArr, testParamsArr , fullMatchEquiv)){
                    return true;
                } else if ((nbrParams-1) < fullMatchEquiv){
                    // for situations where the reduced number of parameters forces 100%, also do a keyMatch
                    if (this.keyMatch(soughtParamsArr, testParamsArr) &&  this.fuzzyMatchEquivPercent < .99){
                        keyMatch++;
                    }
                }
            } else {
                // if (savedReq.hash !== soughtURL.hash){
                //     console.log(`Pathnames => ${prevPathname} == ${soughtPathname} hashes=> ${savedReq.hash}\n${soughtURL.hash}`)
                // } else {
                //     console.log(`Pathnames => ${prevPathname} == ${soughtPathname}`)
                // }
            }
        }
        /*since the */
        return (nbrParams <= 3 && keyMatch >= this.maxKeyMatches);
    }

    addValidURLS(links, parenturl, origin){
        let requestsAdded = 0;
        for (let link of links){
            let validURLStr = this.getValidURL(link, parenturl);

            if (validURLStr.length > 0){
                let foundRequest = FoundRequest.requestParamFactory(validURLStr, "GET", "",{},origin,this.site_url.href);

                if (!this.containsEquivURL(foundRequest)){
                    foundRequest.from = origin;
                    let addResult = this.addRequest(foundRequest);
                    if (addResult){
                        requestsAdded++;
                        console.log(`[${GREEN}WC${ENDCOLOR}] ${GREEN} ADDED ${ENDCOLOR}${foundRequest.toString()} `);
                    }
                }
            }
        }
        return requestsAdded;
    }

    async addDataFromBrowser(page, parenturl){
        let requestsAdded = 0;
        let childFrames = this.page.mainFrame().childFrames();

        if (typeof childFrames !== 'undefined' && childFrames.length > 0){
            for (const frame of childFrames ){
                if (frame.isDetached()){
                    console.log("\x1b[31mDETACHED FRAME \x1b[0m", frame.url());
                    await this.page.reload();
                }
                requestsAdded += await this.addFormData(frame);
                requestsAdded += await this.addURLsFromPage(frame, parenturl);
            }
        }
        requestsAdded += await this.addFormData(page);
        requestsAdded += await this.addURLsFromPage(page, parenturl);
        return requestsAdded;
    }

    async start() {
        let self = this;
        process.on('SIGINT', () => {
            console.log(`${GREEN}[!] SIGINT signal received! Crawler Stopped.${ENDCOLOR}`)
            process.exit(0);
        })
        // console.log(`${GREEN}[+] Browser launching with URL : ${ENDCOLOR} ${this.url.href}`)

        try {
            /**
             * puppeteer를 이용하여 브라우저를 실행하는 부분
             */
            try {
                this.browser = await puppeteer.launch({
                    headless: this.appData.getHeadless(),
                    args: [
                        '--disable-features=site-per-process', '--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'
                    ],
                    "defaultViewport": null,
                });
                this.browser_up = true;
            } catch (err) {
                console.error(`${RED}[-] puppeteer launch failed.${ENDCOLOR}`)
                console.error(err)
                this.browser_up = false;
                process.exit(1)
            }

            let gremlinsErrorTest = setInterval(() => {
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

                /**
                 * puppeteer를 이용하여 로그인을 수행하는 부분
                 */
                if (this.loginData["perform_login"] === "Y") {
                    if (validateConfig(this.loginData)) {
                        try {
                            const loginCookies = await doLogin(this.url, this.appData, this.page, this.requestsAdded, this.loginData, this.base_directory);
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

                const interceptedRequest = (req) => {
                    let tempurl = new URL(req.url());

                    // css, jpg, gif, png, js, ico, woff2 파일은 SKIP
                    if (tempurl.pathname.toLowerCase().match(/\.(css|jpg|gif|png|js|ico|woff2)$/)) {
                        req.continue()
                        return;
                    }

                    console.log(tempurl)

                    if (self.url.href === req.url()) {
                        console.log("[!] SAME URL is requested.")   // TODO: 개발용으로 추가한 부분
                        let pdata = {
                            'method': self.method,
                            'postData': self.postData,
                            headers: {
                                ...req.headers(),
                                "Content-Type": "application/x-www-form-urlencoded"
                            }
                        };

                        let foundRequest = FoundRequest.requestObjectFactory(req, self.appData.site_url.href);
                        foundRequest.from="InterceptedRequestSelf";

                        for (let [pkey, pvalue] of Object.entries(foundRequest.getAllParams())){
                            if (typeof pvalue === "object"){
                                pvalue = pvalue.values().next().value;
                            }
                            self.appData.addQueryParam(pkey, pvalue);
                        }

                        if (self.appData.addInterestingRequest(foundRequest) > 0){
                            self.requestsAdded++;
                        }

                        if (!self.isLoading){
                            req.respond({status:204});
                            return;
                            //self.reinitPage = true;
                        }
                        console.log("\x1b[38;5;5mprocessRequest caught to add method and data and continueing \x1b[0m", req.url());
                        req.continue(pdata);

                    } else {
                        self.appData.addInterestingRequest(req);

                        tempurl.searchParams.forEach(function (value, key, parent) {
                            self.appData.addQueryParam(key, value);
                        });
                        if (req.url().startsWith(self.appData.site_url.origin)){
                            // console.log("[WC] Intercepted in processRequest ", req.url(), req.method());
                            let basename = path.basename(tempurl.pathname);
                            if (req.url().indexOf("rest") > -1 && (req.method() === "POST" || req.method() === "PUT")){
                                //console.log(basename, req.method(), req.headers(), req.resourceType());
                            }

                            let foundRequest = FoundRequest.requestObjectFactory(req, self.appData.site_url.href);
                            foundRequest.from="InterceptedRequest";

                            for (let [pkey, pvalue] of Object.entries(foundRequest.getAllParams())){
                                if (typeof pvalue === "object"){
                                    pvalue = pvalue.values().next().value;
                                }
                                self.appData.addQueryParam(pkey, pvalue);
                            }

                            if (self.appData.addInterestingRequest(foundRequest) > 0){
                                self.requestsAdded++;
                                //console.log("[WC] ${GREEN} ${GREEN} ADDED ${ENDCOLOR}${ENDCOLOR}intercepted request req.url() = ", req.url());
                            }
                            // skip if it has a period for nodejs apps

                            let result = self.appData.addRequest(req.url(), req.method(), req.postData(), "interceptedRequest");
                            if (result){
                                console.log(`\x1b[38;5;2mINTERCEPTED REQUEST and ${GREEN} ${GREEN} ADDED ${ENDCOLOR}${ENDCOLOR} #${self.appData.collectedURL} ${req.url()} RF size = ${self.appData.numRequestsFound()}\x1b[0m`);
                            } else {
                                // console.log(`INTERCEPTED and ABORTED repeat URL ${req.url()}`);
                            }
                        } else {

                            if (req.url().indexOf("gremlins") > -1){
                                //console.log("[WC] CONTINUING with getting some gremlins in here.");
                                req.continue();
                            } else {
                                try{
                                    let url = new URL(req.url());
                                    if (req.url().startsWith("image/") || url.pathname.endsWith(".gif") || url.pathname.endsWith(".jpeg") || url.pathname.endsWith(".jpg") || url.pathname.endsWith(".woff") || url.pathname.endsWith(".ttf")){

                                    } else {
                                        //console.log(`[WC] Ignoring request for ${req.url().substr(0,200)}`)
                                    }
                                } catch (e){
                                    //console.log(`[WC] Ignoring request for malformed url = ${req.url().substr(0,200)}`)
                                }
                                if (self.isLoading){
                                    req.continue();
                                } else {
                                    req.respond(req.redirectChain().length
                                        ? { body: '' } // prevent 301/302 redirect
                                        : { status: 204 } // prevent navigation by js
                                    );
                                }
                            }
                            return;
                        }
                        if (false && req.frame() === self.page.mainFrame()){
                            console.log(`[WC] Aborting request b/c frame == mainframe for ${req.url().substr(0,200)}`)
                            //req.abort('aborted');
                            req.respond(req.redirectChain().length
                                ? { body: '' } // prevent 301/302 redirect
                                : { status: 204 } // prevent navigation by js
                            )
                        } else {
                            if (req.isNavigationRequest() && req.frame() === self.page.mainFrame() ) {
                                if (typeof self.last_nav_request !== "undefined" && self.last_nav_request === req.url()){
                                    console.log("[WC] Aborting request b/c this is the same as last nav request, ignoring");

                                    self.last_nav_request = req.url();
                                    req.respond(req.redirectChain().length
                                        ? { body: '' } // prevent 301/302 redirect
                                        : { status: 204 } // prevent navigation by js
                                    )
                                    return;
                                }
                                self.last_nav_request = req.url();
                                if (req.url().indexOf("gremlins") > -1){
                                    req.continue();
                                    return;
                                }
                                if (self.isLoading){
                                    req.continue();
                                } else {
                                    req.respond(req.redirectChain().length
                                        ? { body: '' } // prevent 301/302 redirect
                                        : { status: 204 } // prevent navigation by js
                                    )
                                }

                            } else {
                                if (req.frame() === self.page.mainFrame()){
                                    if (self.isLoading){

                                        self.loadedURLs.push(tempurl.origin + tempurl.pathname);
                                        req.continue();
                                    } else {
                                        req.continue();
                                    }
                                } else {
                                    req.continue()
                                }

                            }
                        }

                    }
                }

                const interceptedTarget = async (target) => {
                    try {
                        const newPage = await target.page();
                        let newurl = newPage.target().url();

                        if (target.url() !== self.url.href && target.url().startsWith(`${self.appData.site_url.origin}`)) {
                            let foundRequest = FoundRequest.requestParamFactory(target.url(),"GET", "",{},"targetChanged", self.appData.site_url.href);
                            foundRequest.from = "targetChanged";
                            self.requestsAdded += self.appData.addInterestingRequest(foundRequest);
                        } else {  // target is foreign or same url
                            let tempurl = new URL(newurl);
                            tempurl.searchParams.forEach(function (value, key, parent) {
                            });
                        }
                    } catch (e) {
                        console.log(`TARGET CHANGED Error: target changed encountered an error`);
                        console.log(e.stack);
                    }
                }

                // const consoleLog = (message) => {
                //     if (message.text().indexOf("[WC]") > -1) {
                //         if (message.text().indexOf("lamehorde is done") > -1){
                //             console.log(`[\x1b[38;5;136mWC${ENDCOLOR}] Lamehorde completion detected`);
                //             self.lamehord_done = true;
                //         } else {
                //             console.log(message.text());
                //         }
                //     } else if (message.text().search("[WC-URL]") > - 1){
                //         let urlstr = message.text().slice("[WC-URL]".length);
                //         console.log(`[WC] puppeteer layer recieved url from browser with urlstr='${urlstr}'`);
                //         self.appData.addValidURLS([urlstr], `${self.appData.site_url.href}`,"ConsleRecvd");
                //
                //     } else if (message.text().search("CW DOCUMENT") === -1 && message.text() !== "JSHandle@node") {
                //         if (message.text().indexOf("gremlin") > -1){
                //             self.gremTracker(message.text());
                //         } else if (message.text().indexOf("mogwai") > -1){
                //             self.gremTracker(message.text());
                //         } else {
                //             if (message.text().startsWith("jQuery") || message.text().startsWith("disabled") || message.text().startsWith("__ko__")) {
                //                 // do nothing
                //             } else {
                //                 console.log(message.text())
                //             }
                //         }
                //     }
                // }

                const pageError = (error) => {
                    let msg = error.message;
                    if (msg.length> 50){
                        msg = msg.substring(0, 50);
                    }
                    if (msg in self.shownMessages) {
                        if (self.shownMessages[msg] % 1000 === 0) {
                            console.log(msg, ` seen for the ${self.shownMessages[msg]} time`);
                        }
                        self.shownMessages[msg] += 1;
                    } else if (error.message.indexOf("TypeError: Cannot read property 'species' of undefined") > -1) {
                        console.log("\x1b[38;5;136mGREMLINS JS Error:\n\t", error.message, "\x1b[0m");
                        self.gremlins_error = true;
                    } else {
                        self.shownMessages[msg] = 1;
                        console.log("\x1b[38;5;136mBrowser JS Error:\n\t", error.message, "\x1b[0m");
                    }

                }

                this.page.on('request', interceptedRequest);
                this.browser.on('targetchanged', interceptedTarget)
                // this.page.on('console', consoleLog);
                this.page.on('pageerror', pageError);

                await this.page.setCacheEnabled(false);

                // await ExerciseTargetPage(this)
                await ExerciseTarget(this)
                this.reportResults()
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
