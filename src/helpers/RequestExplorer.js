import fs from 'fs';
import path from 'path';
import process from "process";
import puppeteer from "puppeteer";

import {addCookiesToPage, doLogin} from "./PuppeteerLogin.js";
import {ENDCOLOR, GREEN, isDefined, ORANGE, RED} from '../common/utils.js';
import {validateConfig} from "../common/validateConfig.js";
// import { ExerciseTargetPage } from "./ExerciseTargetPage";
import {ExerciseTarget} from "./ExerciseTarget.js";
import {FoundRequest} from "./FoundRequest.js";

const MAX_NUM_ROUNDS = 1;   // 한 페이지당 몇번 크롤링을 시도할 것인지

export class RequestExplorer {
    appData;
    base_directory;
    loopcnt = 0;
    cookies = [];
    bearer = "";
    isLoading = false;  // 페이지가 로딩중인지 확인 (페이지에 gremlins 스크립트를 추가중이면 true)
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
    lognPage = null;
    page = null
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
                console.log('TODO: Check this out');    // TODO: 개발용으로 추가한 부분
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
        console.log(`[+] Round Results for round ${this.appData.currentURLRound} of ${MAX_NUM_ROUNDS}: Total Inputs :  ${roundResults.totalInputs} Total Requests: ${roundResults.equaltoRequests} of ${roundResults.totalRequests} processed so far`);

    }

    async resetURLBack(page){
        let cururl = await page.url();
        // console.log("[+] cururl = ", typeof(cururl), cururl, cururl.startsWith("chrome-error"),"\n");
        if (cururl.startsWith("chrome-error")){
            await page.goBack();
            let backedurl = await page.url();
            console.log(`[+] Performed goBack to ${backedurl} after chrome-error`);
        }
    }

    /**
     * HTML에서 tag 인자로 받은 태그로부터 특정 속성 값을 추출한다.
     * @param {*} page 현재 웹 페이지를 나타내는 puppeteer의 핸들
     * @param {*} tag 추출하려는 HTML 태그의 종류
     * @param {*} attribute 추출하려는 속성(attribute)의 이름
     * @param {*} completed
     * @returns {Array} 추출한 속성 값들의 배열
     */
    async searchForURLSelector(page, tag, attribute, completed={}){
        let elements = [];
        console.log("[+] searchForURLSelector starting.");
        try {
            const links = await page.$$(tag);
            for (let i=0; i < links.length; i++) {
                if (links[i]){
                    if (i === 0){
                        let hc = await links[i].getProperty("hashCode");
                        console.log(`[+] check element hash = ${hc} ${typeof(links[i])}`);
                    }
                    await this.resetURLBack(page);
                    let valueHandle = null;
                    try{
                        valueHandle = await links[i].getProperty(attribute);
                    } catch(ex){
                        console.log(`[+] \x1b[38;5;197m link #${i}/${links.length} error encountered while trying to getProperty`, typeof(page), page.url(), tag, attribute, links[i], "\n",ex, "\x1b[0m");
                        try {
                            console.log("[+] Trying again", links[i]);

                            valueHandle = await links[i].getProperty(attribute);
                        } catch (eex){
                            continue;
                        }
                    }
                    let val = await valueHandle.jsonValue();
                    if (isDefined(val)){
                        elements.push(val);
                    }

                    // console.log(`[+] link #${i}/${links.length} completed`);
                }
            }

        } catch (e){
            console.error("[-] error encountered while trying to search for tag", typeof(page), page.url(), tag, attribute, "\n\t", e);
        }
        return elements;
    }

    /**
     * HTML에서 지정된 속성 값을 가져온다.
     * @param {*} node HTML 요소를 나타내는 puppeteer의 핸들
     * @param {*} attribute 가져올 속성의 이름
     * @param {*} defaultval 해당 속성이 존재하지 않을 경우 기본적으로 반환할 값
     * @returns
     */
    async getAttribute(node, attribute, defaultval=""){
        let valueHandle = await node.getProperty(attribute);
        let val = await valueHandle.jsonValue();
        if (isDefined(val)){
            return val;
        }
        return defaultval;
    }

    /**
     * 태그의 이름과 값 속성을 수집하고 특정 형식(formdata)으로 변환한다.
     * @param {*} tags
     * @returns {string}    formdata
     */
    async searchTags(tags) {
        let formdata = "";
        for (let j = 0; j < tags.length; j++) {
            let tagname = encodeURIComponent(await this.getAttribute(tags[j], "name"));
            let tagval = encodeURIComponent(await this.getAttribute(tags[j], "value"));
            formdata += `${tagname}=${tagval}&`;
            this.appData.addQueryParam(tagname, tagval);
        }
        return formdata;
    }

    addFormbasedRequest(foundRequest, requestsAdded){
        if (foundRequest.isSaveable() ){ // && this.appData.containsMaxNbrSameKeys(tempurl) === false

            if (this.appData.containsEquivURL(foundRequest, true) ) {
                // do nothing yet
                //console.log("[WC] Could have been added, ",foundRequest.postData());
            } else {
                let url = new URL(foundRequest.getUrlstr());

                if (foundRequest.getUrlstr().startsWith(`${this.appData.site_url.origin}`) || this.appData.ips.includes(url.hostname)){
                    foundRequest.from = "PageForms";
                    foundRequest.cleanURLParamRepeats()
                    foundRequest.cleanPostDataRepeats()
                    let wasAdded = this.appData.addRequest(foundRequest);
                    if (wasAdded){
                        requestsAdded++;
                        if (foundRequest.postData()){
                            console.log(`[${GREEN}WC${ENDCOLOR}] ${GREEN} ADDED ${ENDCOLOR}${foundRequest.toString()} postData=${foundRequest.postData()} ${ENDCOLOR}`);
                        } else {
                            console.log(`[${GREEN}WC${ENDCOLOR}]] ${GREEN} ADDED ${ENDCOLOR}${foundRequest.toString()} \n ${ENDCOLOR}`);
                        }
                    }
                } else {
                    console.log(`\x1b[38;5;3m[WC] IGNORED b/c not correct ${foundRequest.toString()} does not start with ${this.appData.site_url.origin} ips = ${this.appData.ips} hostname=${url.hostname} -- ${ENDCOLOR}`);
                }
            }
        }
        return requestsAdded;
    }

    /**
     * HTML에서 input, button, select, textarea 태그를 찾아서 입력 데이터를 추출한다.
     * @param {*} node
     * @returns {number} requestsAdded
     */
    async searchForInputs(node){
        let requestsAdded = 0;
        let requestInfo = {}; //{action:"", method:"", elems:{"attributename":"value"}
        let nodeaction = await this.getAttribute(node, "action");
        let method = await this.getAttribute(node, "method");


        const buttontags = await node.$$('button');
        let formdata = await this.searchTags(buttontags);

        const inputtags = await node.$$('input');
        formdata += await this.searchTags(inputtags);

        const selectags = await node.$$('select');
        formdata += await this.searchTags(selectags);

        const textareatags = await node.$$('textarea');
        formdata += await this.searchTags(textareatags);
        if (formdata.length === 0){
            return requestsAdded;
        }

        let formInfo = FoundRequest.requestParamFactory(nodeaction, method, "",{},"PageForms",this.appData.site_url.href);
        formInfo.addParams(formdata);
        let allParams = formInfo.getAllParams();

        let basedata = "";
        for (const [pkey, pvalue] of Object.entries(allParams)) {
            if (pkey in formInfo.multipleParamKeys) {
                continue;
            }
            let arrVal = Array.from(pvalue);
            if (arrVal.length > 0){
                basedata += `${pkey}=${arrVal[0]}&`
            } else {
                basedata += `${pkey}=&`
            }
        }
        let postdata = [basedata]
        for (let mpk of formInfo.multipleParamKeys) {
            let new_pd = []
            for (let ele of Array.from(allParams[mpk])){
                for (let pd of postdata){
                    new_pd.push(pd + `${mpk}=${ele}&`);
                }
            }
            postdata = new_pd;
        }

        for (let pd of postdata){
            let formBasedRequest = FoundRequest.requestParamFactory(nodeaction, method, pd,{},"PageForms",this.appData.site_url.href);
            //console.log("[WC] Considering the addition of ",typeof(formBasedRequest.urlstr()), formBasedRequest.urlstr(), formBasedRequest.postData());
            requestsAdded = this.addFormbasedRequest(formBasedRequest, requestsAdded);
        }

        return requestsAdded;
    }

    /**
     * a, iframe 태그에서 유효한 URL을 추출한다.
     * @param {*} page
     * @param {*} parenturl
     * @returns {number}
     */
    async addURLsFromPage(page, parenturl){
        let requestsAdded = 0;
        try {
            // these are always GETs
            const anchorlinks = await this.searchForURLSelector(page, 'a', 'href');
            if (anchorlinks){
                //console.log("[+] adding valid URLS from anchors ")
                requestsAdded += this.appData.addValidURLS(anchorlinks, parenturl, "OnPageAnchor");
            }
            const iframelinks = await this.searchForURLSelector(page, 'iframe', 'src');
            if (iframelinks){
                //console.log("[+] adding valid URLS from iframe links")
                requestsAdded += this.appData.addValidURLS(iframelinks, parenturl, "OnPageIFrame");
            }
        } catch (ex){
            console.log(`[+] Error in addURLSFromPage(): ${ex}`)
        }
        return requestsAdded;
    }

    /**
     * form 태그에서 데이터를 수집한다.
     * @param page
     * @returns {Promise<number>}
     */
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
                    console.log("[+] second form ACTION=", faction, fmethod, " FROM url ", await page.url());
                    requestsAdded += await this.searchForInputs(forms[i]);
                }
            }

        } catch (ex){
            console.log(`[+] addFormData(p) Error ${ex}`);
            console.log(ex.stack);
        }
        return requestsAdded;
    }

    /**
     * 주어진 요청과 requestsFound를 비교하여 일치하는 URL, POST 데이터, 매개 변수 또는 일치하는 특정 조건을 찾는 함수
     * @param soughtRequest {FoundRequest}  주어진 요청
     * @param forceMatch {boolean}
     * @returns {boolean}
     */
    containsEquivURL(soughtRequest, forceMatch=false){

        let soughtURL = new URL(soughtRequest.getUrlstr());
        let queryString = soughtURL.search.substring(1);
        let postData = soughtRequest.getPostData();
        let soughtParamsArr = soughtRequest.getAllParams();
        // let trimmedSoughtParams = [];
        // for (let sp of )
        //soughtParamsArr = [...new Set(soughtParamsArr)];
        let nbrParams = Object.keys(soughtParamsArr).length;
        // if nbrParams*matchPercent is more than nbrParams-1, it's requires a 100% parameter match
        let fullMatchEquiv = nbrParams * this.appData.getFuzzyMatchEquivPercent();
        let soughtPathname = soughtRequest.getPathname();
        let keyMatch = 0;

        for (let savedReq of Object.values(this.appData.requestsFound)){
            let prevURL = savedReq.getURL();
            let prevPathname = savedReq.getPathname();

            // 현재 요청(soughtRequest)과 저장된 요청 간의 URL, POST 데이터 및 해시 비교를 수행하여 완벽하게 일치하는 경우 true를 반환한다.
            if (prevURL.href === soughtURL.href && savedReq.postData === soughtRequest.getPostData() && savedReq.hash === soughtURL.hash){
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
                        return this.appData.fuzzyValueMatch(pd_match[1], test_pd_match[1]);
                    }
                }

                let testParamsArr = savedReq.getAllParams();

                if (this.appData.equivParameters(soughtParamsArr, testParamsArr , fullMatchEquiv)){
                    return true;
                } else if ((nbrParams-1) < fullMatchEquiv){
                    // for situations where the reduced number of parameters forces 100%, also do a keyMatch
                    if (this.appData.keyMatch(soughtParamsArr, testParamsArr) &&  this.appData.getFuzzyMatchEquivPercent() < .99){
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
        return (nbrParams <= 3 && keyMatch >= this.appData.getMaxKeyMatches());
    }

    /**
     *
     * @param links
     * @param parenturl
     * @param origin
     * @returns {number}
     */
    addValidURLS(links, parenturl, origin){
        let requestsAdded = 0;
        for (let link of links){
            let validURLStr = this.appData.getValidURL(link, parenturl);

            if (validURLStr.length > 0){
                let foundRequest = FoundRequest.requestParamFactory(validURLStr, "GET", "",{},origin,this.site_url.href);

                if (!this.containsEquivURL(foundRequest)){
                    foundRequest.from = origin;
                    let addResult = this.appData.addRequest(foundRequest);
                    if (addResult){
                        requestsAdded++;
                        console.log(`[${GREEN}WC${ENDCOLOR}] ${GREEN} ADDED ${ENDCOLOR}${foundRequest.toString()} `);
                    }
                }
            }
        }
        return requestsAdded;
    }

    /**
     * 웹 페이지와 하위 프레임에서 데이터 수집 및 URL 추출을 수행한다.
     * @param {*} page
     * @param {*} parenturl
     * @returns
     */
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
                    // headless: false,
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

            this.loginPage = await this.browser.newPage();


            try {
                await this.loginPage.setRequestInterception(true);

                /**
                 * puppeteer를 이용하여 로그인을 수행하는 부분
                 */
                if (this.loginData["perform_login"] === "Y") {
                    if (validateConfig(this.loginData)) {
                        try {
                            const loginCookies = await doLogin(this.url, this.appData, this.loginPage, this.requestsAdded, this.loginData, this.base_directory);
                            await addCookiesToPage(loginCookies, this.loginPage, this.appData.getSiteUrl(), this.cookieData, this.cookies)
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
                    if (tempurl.pathname.search(/\.css$/) > -1 || tempurl.pathname.search(/\.js$/) > -1) {
                        req.continue()
                        return;
                    }
                    if (self.url.href === req.url()) {
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
                        }
                        console.log("\x1b[38;5;5mprocessRequest caught to add method and data and continueing \x1b[0m", req.url());
                        req.continue(pdata);

                    } else {
                        tempurl.searchParams.forEach(function (value, key, parent) {
                            self.appData.addQueryParam(key, value);
                        });
                        if (req.url().startsWith(self.appData.site_url.origin)){
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
                            }

                            let result = self.appData.addRequest(req.url(), req.method(), req.postData(), "interceptedRequest");
                            if (result){
                                console.log(`\x1b[38;5;2mINTERCEPTED REQUEST and ${GREEN} ${GREEN} ADDED ${ENDCOLOR}${ENDCOLOR} #${self.appData.collectedURL} ${req.url()} RF size = ${self.appData.getRequestCount()}\x1b[0m`);
                            } else {
                                console.log(`INTERCEPTED and ABORTED repeat URL ${req.url()}`);
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
                        // What to do, from here
                        //console.log("PROCESSED ", req.url(), req.isNavigationRequest());
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
                //     if (message.text().indexOf("[+]") > -1) {
                //         if (message.text().indexOf("lamehorde is done") > -1){
                //             console.log(`[\x1b[38;5;136mWC${ENDCOLOR}] Lamehorde completion detected`);
                //             self.lamehord_done = true;
                //         } else {
                //             console.log(message.text());
                //         }
                //     } else if (message.text().search("[WC-URL]") > - 1){
                //         let urlstr = message.text().slice("[WC-URL]".length);
                //         console.log(`[+] puppeteer layer recieved url from browser with urlstr='${urlstr}'`);
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

                this.page = await this.browser.newPage();
                await this.page.setRequestInterception(true);

                this.page.on('request', interceptedRequest);
                this.browser.on('targetchanged', interceptedTarget)
                // this.page.on('console', consoleLog);
                this.page.on('pageerror', pageError);

                await this.page.setCacheEnabled(false);

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
