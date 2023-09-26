import fs from 'fs';
import path from 'path';

import { FoundRequest } from './FoundRequest.js';
import { do_login } from './RequestExplorerFunction/do_login.js';
import { addCodeExercisersToPage } from './RequestExplorerFunction/addCodeExercisersToPage.js';
import { start } from './RequestExplorerFunction/start.js';
import { exerciseTarget } from './RequestExplorerFunction/exerciseTarget.js'

const RED = "\x1b[38;5;1m";
const GREEN = "\x1b[38;5;2m";
const BLUE = "\x1b[38;5;4m";
const ORANGE = "\x1b[38;5;202m";
const ENDCOLOR = "\x1b[0m";

const MAX_NUM_ROUNDS = 3;

export class RequestExplorer {

    constructor(appData, workernum, base_appdir, currentRequest) {
        this.appData = appData;
        this.base_appdir = base_appdir;
        this.loopcnt = 0;
        this.cookies = [];
        this.bearer = "";
        this.isLoading = false;
        this.reinitPage = false;
        this.loadedURLs = [];
        this.passwordValue = "";
        this.usernameValue = "";
        if (appData.numRequestsFound() > 0) {
            this.currentRequestKey = currentRequest.getRequestKey();
            this.url = currentRequest.getURL();
            this.method = currentRequest.method();
            this.postData = currentRequest.postData()
            this.cookieData = currentRequest.cookieData();


            if (this.appData.requestsFound.hasOwnProperty(this.currentRequestKey))
                this.appData.requestsFound[this.currentRequestKey]["processed"]++;
            else {
                // this.appData.requestsFound[this.currentRequestKey] = currentRequest;
                // this.appData.requestsFound[this.currentRequestKey]["processed"] = 1;
                console.log(`\x1b[31mWE SHOULD ME ADDING currentRequest to requestsFound ${this.currentRequestKey}\x1b[0m`);
            }
        } else {
            this.currentRequestKey = "GET";
            this.url = "";
            this.method = "GET";
            this.postData = "";
            this.cookieData = "";
        }
        this.requestsAdded = 0;
        this.timeoutLoops = 5;
        this.timeoutValue = 3;
        this.actionLoopTimeout = 45;
        this.workernum = workernum;
        this.gremCounter = {};
        this.shownMessages = {};
        this.maxLevel = 10;
        this.browser;
        this.page;
        this.gremlins_error = false;
        this.lamehord_done = false
        this.getConfigData();
        this.gremlins_url = "";
        this.do_login = do_login.bind(this);
        this.addCodeExercisersToPage = addCodeExercisersToPage.bind(this);
        this.start = start.bind(this);
        this.exerciseTarget = exerciseTarget.bind(this);
    }

    /**
     * witcher_config.json 파일에서 로그인 정보를 가져온다.
     * 
     */
    getConfigData() {
        let json_fn = path.join(this.base_appdir, "witcher_config.json");
        if (fs.existsSync(json_fn)) {
            console.log(`${ORANGE}[getConfigData] witcher_config.json에서 로그인 정보를 발견했습니다.${ENDCOLOR}`)
            let jstrdata = fs.readFileSync(json_fn);
            this.loginData = JSON.parse(jstrdata)["request_crawler"];
            this.appData.setIgnoreValues(this.loginData["ignoreValues"]);
            this.appData.setUrlUniqueIfValueUnique(this.loginData["urlUniqueIfValueUnique"]);
        }
    }

    async page_frame_selection(selector) {
        let results = []
        const elementHandles = await page.$$(selector);
        for (let ele of elementHandles) {
            results.push(ele);
        }
        for (const frame of page.mainFrame().childFrames()) {
            const frElementHandles = await frame.$$(selector);
            for (let ele of frElementHandles) {
                results.push(ele);
            }
        }
        return results;
    }

    /**
     * URL이 "chrome-error"로 시작하는 경우 페이지를 뒤로 이동시킨다.
     * @param {*} page 
     */
    async resetURLBack(page) {
        let cururl = await page.url();
        // TODO: 임시 주석처리
        // console.log("[WC] cururl = ", typeof (cururl), cururl, cururl.startsWith("chrome-error"), "\n");
        if (cururl.startsWith("chrome-error")) {
            await page.goBack();
            let backedurl = await page.url();
            console.log(`[resetURLBack] Performed goBack to ${backedurl} after chrome - error`);
        }
    }

    /**
     * HTML에서 <a>, <iframe> 태그로부터 특정 속성 값을 추출한다.
     * @param {*} page 현재 웹 페이지를 나타내는 puppeteer의 핸들
     * @param {*} tag 추출하려는 HTML 태그의 종류
     * @param {*} attribute 추출하려는 속성(attribute)의 이름
     * @param {*} completed 
     * @returns {Array} 추출한 속성 값들의 배열
     */
    async searchForURLSelector(page, tag, attribute, completed = {}) {
        let elements = [];
        try {
            const links = await page.$$(tag);
            for (var i = 0; i < links.length; i++) {
                if (links[i]) {
                    if (i === 0) {
                        let hc = await links[i].getProperty("hashCode");
                        console.log(`[searchForURLSelector] check element hash = ${hc} ${typeof (links[i])}`);  // TODO: 오류 해결 필요 => undefined, object로 출력됨
                    }
                    await this.resetURLBack(page);
                    let valueHandle = null;
                    try {
                        valueHandle = await links[i].getProperty(attribute);
                    } catch (ex) {
                        // console.log(`[searchForURLSelector]\x1b[38; 5; 197m link #${i} /${links.length} error encountered while trying to getProperty`, typeof (page), page.url(), tag, attribute, links[i], "\n", ex, "\x1b[0m");
                        console.log("[searchForURLSelector] error encountered while trying to getProperty", typeof (page), page.url(), tag, attribute, links[i], "\n");
                        try {
                            console.log("[searchForURLSelector] Trying again", links[i]);
                            valueHandle = await links[i].getProperty(attribute);
                        } catch (eex) {
                            continue;
                        }
                    }
                    let val = await valueHandle.jsonValue();
                    if (isDefined(val)) {
                        elements.push(val);
                    }
                    // TODO : 임시 주석처리
                    // console.log(`[WC] link #${i}/${links.length} completed`);
                }
            }

        } catch (e) {
            console.log("[searchForURLSelector] error encountered while trying to search for tag", typeof (page), page.url(), tag, attribute, "\n\t", e);
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
    async getAttribute(node, attribute, defaultval = "") {
        let valueHandle = await node.getProperty(attribute);
        let val = await valueHandle.jsonValue();
        if (isDefined(val)) {
            //logdata(attribute + val);
            //elements.push(val);
            return val;
        }
        return defaultval;
    }

    addFormbasedRequest(foundRequest, requestsAdded) {
        console.log("[*] called addFormbasedRequest")
        if (foundRequest.isSaveable()) { // && this.appData.containsMaxNbrSameKeys(tempurl) === false

            if (this.appData.containsEquivURL(foundRequest, true)) {
                // do nothing yet
                //console.log("[WC] Could have been added, ",foundRequest.postData());
            } else {
                let url = new URL(foundRequest.urlstr());

                if (foundRequest.urlstr().startsWith(`${this.appData.site_url.origin}`) || this.appData.ips.includes(url.hostname)) {
                    foundRequest.from = "PageForms";
                    foundRequest.cleanURLParamRepeats()
                    foundRequest.cleanPostDataRepeats()
                    let wasAdded = this.appData.addRequest(foundRequest);
                    if (wasAdded) {
                        requestsAdded++;
                        if (foundRequest.postData()) {
                            // TODO: 임시 주석처리
                            // console.log(`[${GREEN}WC${ENDCOLOR}] ${GREEN} ADDED ${ENDCOLOR}${foundRequest.toString()} postData=${foundRequest.postData()} ${ENDCOLOR}`);
                        } else {
                            // TODO: 임시 주석처리
                            // console.log(`[${GREEN}WC${ENDCOLOR}]] ${GREEN} ADDED ${ENDCOLOR}${foundRequest.toString()} \n ${ENDCOLOR}`);
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
    async searchForInputs(node) {
        console.log("[*] called searchForInputs")
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
        if (formdata.length === 0) {
            return requestsAdded;
        }

        let formInfo = FoundRequest.requestParamFactory(nodeaction, method, "", {}, "PageForms", this.appData.site_url.href);
        formInfo.addParams(formdata);
        let allParams = formInfo.getAllParams();

        let basedata = "";
        for (const [pkey, pvalue] of Object.entries(allParams)) {
            if (pkey in formInfo.multipleParamKeys) {
                continue;
            }
            let arrVal = Array.from(pvalue);
            if (arrVal.length > 0) {
                basedata += `${pkey}=${arrVal[0]}&`
            } else {
                basedata += `${pkey}=&`
            }
        }
        let postdata = [basedata]
        for (let mpk of formInfo.multipleParamKeys) {
            let new_pd = []
            for (let ele of Array.from(allParams[mpk])) {
                for (let pd of postdata) {
                    new_pd.push(pd + `${mpk}=${ele}&`);
                }
            }
            postdata = new_pd;
        }

        for (let pd of postdata) {
            let formBasedRequest = FoundRequest.requestParamFactory(nodeaction, method, pd, {}, "PageForms", this.appData.site_url.href);
            //console.log("[WC] Considering the addition of ",typeof(formBasedRequest.urlstr()), formBasedRequest.urlstr(), formBasedRequest.postData());
            requestsAdded = this.addFormbasedRequest(formBasedRequest, requestsAdded);
        }

        return requestsAdded;
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

    /**
     * a, iframe 태그에서 유효한 URL을 추출한다.
     * @param {*} page 
     * @param {*} parenturl 
     * @returns {number}
     */
    async addURLsFromPage(page, parenturl) {
        let requestsAdded = 0;
        try {
            // these are always GETs
            const anchorlinks = await this.searchForURLSelector(page, 'a', 'href');
            if (anchorlinks) {
                // console.log("[addURLsFromPage] 앵커(a, href)로부터 유효한 URL을 추가합니다.")
                requestsAdded += this.appData.addValidURLS(anchorlinks, parenturl, "OnPageAnchor");
            }
            const iframelinks = await this.searchForURLSelector(page, 'iframe', 'src');
            if (iframelinks) {
                // console.log("[addURLsFromPage] iframe으로부터 유효한 URL을 추가합니다.")
                requestsAdded += this.appData.addValidURLS(iframelinks, parenturl, "OnPageIFrame");
            }
        } catch (ex) {
            console.log(`[addURLsFromPage] Error in addURLSFromPage(): ${ex}`)
        }
        return requestsAdded;
    }

    /**
     * form element에서 input, button, select, textarea 태그를 찾아서 입력 데이터를 추출한다.
     * @param {} page 
     * @returns {number}
     */
    async addFormData(page) {
        let requestsAdded = 0;
        try {
            const forms = await page.$$('form').catch(reason => {
                console.log(`[addFormData] received error in page. ${reason} `);
            });
            if (isDefined(forms)) {
                for (let i = 0; i < forms.length; i++) {
                    let faction = await this.getAttribute(forms[i], "action", "");
                    let fmethod = await this.getAttribute(forms[i], "method", "GET");
                    console.log("[addFormData] second form ACTION=", faction, fmethod, " FROM url ", await page.url());
                    requestsAdded += await this.searchForInputs(forms[i]);
                }
            }

        } catch (ex) {
            console.log(`[addFormData] addFormData(p) Error ${ex}`);
            console.log(ex.stack);
        }
        return requestsAdded;
    }

    /**
     * 웹 페이지와 하위 프레임에서 데이터 수집 및 URL 추출을 수행한다.
     * @param {*} page 
     * @param {*} parenturl 
     * @returns 
     */
    async addDataFromBrowser(page, parenturl) {
        //        console.log("Starting formdatafrompage");
        let requestsAdded = 0;
        let childFrames = this.page.mainFrame().childFrames();

        if (typeof childFrames !== 'undefined' && childFrames.length > 0) {
            for (const frame of childFrames) {
                //console.log("[WC] Attempting to ADD form data from FRAMES. "); //, await frame.$$('form'))
                if (frame.isDetached()) {
                    console.log("\x1b[31mDETACHED FRAME \x1b[0m", frame.url());
                    await this.page.reload();
                }
                requestsAdded += await this.addFormData(frame);
                requestsAdded += await this.addURLsFromPage(frame, parenturl);
            }
        }
        requestsAdded += await this.addFormData(page);
        requestsAdded += await this.addURLsFromPage(page, parenturl);

        //const bodynode = await page.$('html');
        //requestsAdded += await this.searchForInputs(bodynode);
        return requestsAdded;
    }

    async initpage(page, url, doingReload = false) {

        await page.keyboard.down('Escape');
        // const test_url = await urlExist(`http://${this.site_ip}/gremlins.min.js`);
        // console.log(`test_url = ${test_url}`, `http://${this.site_ip}/gremlins.min.js`);
        // if (test_url){
        //     this.gremlins_url = `http://${this.site_ip}/gremlins.min.js`;
        // } else if (await urlExist(`https://unpkg.com/gremlins.js@2.2.0/dist/gremlins.min.js`)){
        //     this.gremlins_url = 'https://unpkg.com/gremlins.js@2.2.0/dist/gremlins.min.js';
        // } else if (await urlExist(`https://trickel.com/gremlins.min.js`)){
        //     this.gremlins_url = "https://trickel.com/gremlins.min.js"
        // }
        //
        // if (isDefined(this.gremlins_url)){
        //     console.log(`loading gremscript from remote location ${this.gremlins_url}`);
        //     await page.addScriptTag({url: this.gremlins_url });
        // }
        console.log(`[initpage] gremlins.min.js 스크립트를 로드합니다.`);
        await page.addScriptTag({ path: "gremlins.min.js" });

        this.isLoading = false;

        console.log(`[initpage] ${url.href} 페이지의 스크린샷 저장됨.`);
        await page.screenshot({ path: this.base_appdir + '/screenshot/screenshot-pre.png', type: "png" });

        await page.keyboard.down('Escape');

        //console.log("Waited for goto and response and div");
        this.requestsAdded += this.addDataFromBrowser(page, url);

        //console.log(this.appData.requestsFound[this.currentRequestKey]["processed"]% 2 === 0);

        // JSHandle.prototype.getEventListeners = function () {
        //     return this._client.send('DOMDebugger.getEventListeners', { objectId: this._remoteObject.objectId });
        // };

        //await this.submitForms(page);

        console.log('[initpage] elements에 hasClicker 속성을 추가합니다.')
        const elementHandles = await page.$$('div,li,span,a,input,p,button');
        for (let ele of elementHandles) {
            if (!doingReload) {
                await ele.evaluate(node => node["hasClicker"] = "true");
            }
        }
        for (const frame of page.mainFrame().childFrames()) {
            const frElementHandles = await frame.$$('div,li,span,a,input,p,button');
            for (let ele of frElementHandles) {
                if (!doingReload) {
                    await ele.evaluate(node => node["hasClicker"] = "true");
                }
            }
        }
        console.log(`[initpage] About to add code exercisers to page, u=${this.usernameValue} pw=${this.passwordValue}`);

        this.appData.addGremlinValue(this.usernameValue);
        this.appData.addGremlinValue(this.passwordValue);

        await this.addCodeExercisersToPage(doingReload, this.usernameValue, this.passwordValue);
        //await this.startCodeExercisers();
        return true;
    }

    /**
     * 주어진 HTTP 응답(response)을 검사하고 필요한 정보를 업데이트
     * @param {*} response 확인할 HTTP response 객체
     * @param {*} cururl 현재 URL
     * @returns {boolean} 응답이 유효하면 true, 그렇지 않으면 false 반환
     */
    async checkResponse(response, cururl) {
        if (!isDefined(response)) {
            return false;
        }

        console.log("[checkResponse] status = ", response.status(), response.statusText(), response.url());

        // 현재 response의 status가 200이 아닌 경우, status 업데이트
        if (this.appData.requestsFound[this.currentRequestKey].hasOwnProperty("response_status")) {
            if (this.appData.requestsFound[this.currentRequestKey]["response_status"] !== 200) {
                this.appData.requestsFound[this.currentRequestKey]["response_status"] = response.status();
            }
        } else {
            this.appData.requestsFound[this.currentRequestKey]["response_status"] = response.status();
        }

        if (response.headers().hasOwnProperty("content-type")) {
            this.appData.requestsFound[this.currentRequestKey]["response_content-type"] = response.headers()["content-type"];
        } else {
            if (!this.appData.requestsFound[this.currentRequestKey].hasOwnProperty("response_content-type")) {
                this.appData.requestsFound[this.currentRequestKey]["response_content-type"] = response.headers()["content-type"];
            }
        }

        if (response.status() >= 400) {
            console.log(`${RED}[checkResponse] ${cururl} 에서 오류가 발생했습니다. (HTTP Status Code : ${response.status()})${ENDCOLOR}`);
            return false;
        }
        //console.log(response);

        //console.log("response Headers = ", await response.headers());

        // TODO: 의미 없는 코드 비활성화
        // if (response.status() !== 200) {
        //     //console.log("[WC] ERROR status = ", response.status(), response.statusText(), response.url())
        // }
        let responseText = await response.text();

        if (!isInteractivePage(response, responseText)) {
            console.log(`${RED}[checkResponse] ${cururl} 은 interactive page가 아닙니다.${ENDCOLOR}}`);
            return false;
        }

        if (responseText.length < 20) {
            console.log(`${RED}[checkResponse] ${cururl} 의 페이지 내용이 너무 짧습니다. (페이지 크기 : ${responseText.length})${ENDCOLOR}`);
            return false;
        }
        if (responseText.toUpperCase().search(/<TITLE> INDEX OF /) > -1) {
            console.log("[checkResponse] Index 페이지는 Fuzzing을 위해 비활성화 처리합니다. ")
            this.appData.requestsFound[this.currentRequestKey]["response_status"] = 999;
            this.appData.requestsFound[this.currentRequestKey]["response_content-type"] = "application/dirlist";
        }
        return true;
    }

    /**
     * do_login.js에서 로그인 후 받아온 쿠키를 브라우저에 추가
     */
    async addCookiesToPage(loginCookies, cookiestr, page) {
        var cookiesarr = cookiestr.split(";");
        var cookies_in = [];
        for (let cooky of loginCookies) {
            cookies_in.push(cooky); //["name"] + "=" + cooktest[cooky]["value"] + ";";
        }

        cookiesarr.forEach(function (cv) {
            if (cv.length > 2 && cv.search("=") > -1) {
                var cvarr = cv.split("=");
                var cv_name = `${cvarr[0].trim()}`;
                var cv_value = `${cvarr[1].trim()}`;
                cookies_in.push({ "name": cv_name, "value": cv_value, url: `${this.appData.site_url.origin}` });

            }
        });
        //console.log("COOKIES", cookies_in);
        for (let cooky of cookies_in) {
            console.log("[addCookiesToPage] Cookie 정보 : " + cooky["name"] + "=" + cooky["value"] + "");
            if (cooky["name"] === "token") {
                page.setExtraHTTPHeaders({ Authorization: `Bearer ${cooky["value"]}` });
                this.bearer = `Bearer ${cooky["value"]}`;
            }
            this.cookies.push({ "name": cooky["name"], "value": cooky["value"] });
            //console.log("COOKIES = ",this.cookies);
        }

        await page.setCookie(...cookies_in);
    }

    /**
     * gremCounter에 grandTotal 속성이 있는지 확인
     * @returns {boolean} 속성이 존재하면 true, 그렇지 않으면 false 반환
     */
    hasGremlinResults() {
        return ("grandTotal" in this.gremCounter);
    }

    gremTracker(ltext) {

        try {
            this.gremCounter["grandTotal"] = ("grandTotal" in this.gremCounter) ? this.gremCounter["grandTotal"] + 1 : 0;
            const { groups: { primaryKey, secKey } } = /gremlin (?<primaryKey>[a-z]*)[ ]*(?<secKey>[a-z]*)/.exec(ltext);
            this.gremCounter[primaryKey] = (primaryKey in this.gremCounter) ? this.gremCounter[primaryKey] : { total: 0 };
            this.gremCounter[primaryKey]["total"] += 1;
            let combinedKey = `${primaryKey} ${secKey}`;
            this.gremCounter[primaryKey][secKey] = (secKey in this.gremCounter[primaryKey]) ? this.gremCounter[primaryKey][secKey] + 1 : 1;

        } catch (err) {
            // skip if no match
        }

    }

    getRoundResults() {
        let total = 0, above = 0, below = 0, equalto = 0;
        for (const [key, val] of Object.entries(this.appData.requestsFound)) {
            total++;
            equalto += val["attempts"] === this.appData.currentURLRound ? 1 : 0;
            above += val["attempts"] === this.appData.currentURLRound ? 0 : 1;
        }
        return { totalInputs: this.appData.numInputsFound(), totalRequests: total, equaltoRequests: equalto, aboveRequests: above }
    }

    reportResults() {
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
        console.log(`[reportResults] Round Results for round ${this.appData.currentURLRound} of ${MAX_NUM_ROUNDS}: Total Inputs :  ${roundResults.totalInputs} Total Requests: ${roundResults.equaltoRequests} of ${roundResults.totalRequests} processed so far`);

    }

    /**
     * 페이지 타임아웃을 설정하고, 브라우저가 일정 시간 동안 반응이 없으면 브라우저를 종료
     */
    setPageTimer() {
        var self = this;
        if (this.pagetimeout) {
            console.log("[setPageTimer] 현재 페이지의 time out를 초기화합니다.");
            clearTimeout(this.pagetimeout);
        }
        this.pagetimeout = setTimeout(function () {
            try {
                this.browser_up = false;
                self.browser.close();
                console.log(`${GREEN}[setPageTimer] 타임아웃으로 인해 브라우저를 종료합니다.${ENDCOLOR}`);
            } catch (err) {
                console.log(`${RED}[setPageTimer] 브라우저 종료 중 오류가 발생했습니다.${ENDCOLOR}`)
                console.log(err);
            }
        }, this.actionLoopTimeout * 1000 + 6000);
    }
}

/**
 * HTTP response와 responseText를 분석해서 해당 페이지가 인터렉티브 페이지인지 확인
 * @param response
 * @param responseText
 * @returns {boolean} 인터렉티브 페이지이면 true, 그렇지 않으면 false 반환
 */
function isInteractivePage(response, responseText) {

    try {
        JSON.parse(responseText);
        return false;
    } catch (SyntaxException) {
        //check out other types
    }

    if (response.headers().hasOwnProperty("content-type")) {
        let contentType = response.headers()['content-type'];

        if (contentType === "application/javascript" || contentType === "text/css" || contentType.startsWith("image/") || contentType === "application/json") {
            console.log(`[isInteractivePage] Content type ${contentType} is considered non-interactive (e.g., JavaScript, CSS, json, or image/* )`)
            return false;
        }
    }

    //console.log(responseText.slice(0,500))
    if (responseText.search(/<body[ >]/) > -1 || responseText.search(/<form[ >]/) > -1 || responseText.search(/<frameset[ >]/) > -1) {
        return true;
    } else {
        // console.log(responseText.slice(0, 5000))
        console.log(`[isInteractivePage] ${response.url()} 에서 HTML tag를 찾을 수 없습니다.`)
        return false;
    }

}

/**
 * 값이 정의되어 있는지 확인
 * @param {*} val 
 * @returns {boolean} undefined 또는 null이면 false, 그렇지 않으면 true 반환
 */
function isDefined(val) {
    return !(typeof val === 'undefined' || val === null);
}

function sleepg(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}