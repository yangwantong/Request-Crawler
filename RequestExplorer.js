import fs from 'fs';
import path from 'path';
import process from 'process';

import { FoundRequest } from './FoundRequest.js';
import { do_login } from './RequestExplorerFunction/do_login.js';
import { addCodeExercisersToPage } from './RequestExplorerFunction/addCodeExercisersToPage.js';
import { start } from './RequestExplorerFunction/start.js';

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
    }

    /**
     * witcher_config.json 파일에서 로그인 정보를 가져온다.
     * 
     */
    getConfigData() {
        let json_fn = path.join(this.base_appdir, "witcher_config.json");
        if (fs.existsSync(json_fn)) {
            console.log(`${ORANGE}[Login] Login Data Founded in witcher_config.json${ENDCOLOR}`)
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

    async resetURLBack(page) {
        let cururl = await page.url();
        // TODO: 임시 주석처리
        // console.log("[WC] cururl = ", typeof (cururl), cururl, cururl.startsWith("chrome-error"), "\n");
        if (cururl.startsWith("chrome-error")) {
            await page.goBack();
            let backedurl = await page.url();
            console.log(`[WC] Performed goBack to ${backedurl} after chrome - error`);
        }
    }

    async searchForURLSelector(page, tag, attribute, completed = {}) {
        let elements = [];
        console.log("[WC] searchForURLSelector starting.");
        try {
            const links = await page.$$(tag);
            for (var i = 0; i < links.length; i++) {
                if (links[i]) {
                    if (i === 0) {
                        let hc = await links[i].getProperty("hashCode");
                        console.log(`[WC] check element hash = ${hc} ${typeof (links[i])}`);
                    }
                    await this.resetURLBack(page);
                    let valueHandle = null;
                    try {
                        valueHandle = await links[i].getProperty(attribute);
                    } catch (ex) {
                        console.log(`[WC]\x1b[38; 5; 197m link #${i} /${links.length} error encountered while trying to getProperty`, typeof (page), page.url(), tag, attribute, links[i], "\n", ex, "\x1b[0m");
                        try {
                            console.log("[WC] Trying again", links[i]);

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
            console.log("[WC] error encountered while trying to search for tag", typeof (page), page.url(), tag, attribute, "\n\t", e);
        }
        return elements;
    }

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

    async searchForInputs(node) {
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

    async addURLsFromPage(page, parenturl) {
        let requestsAdded = 0;
        try {
            // these are always GETs
            const anchorlinks = await this.searchForURLSelector(page, 'a', 'href');
            if (anchorlinks) {
                //console.log("[WC] adding valid URLS from anchors ")
                requestsAdded += this.appData.addValidURLS(anchorlinks, parenturl, "OnPageAnchor");
            }
            const iframelinks = await this.searchForURLSelector(page, 'iframe', 'src');
            if (iframelinks) {
                //console.log("[WC] adding valid URLS from iframe links")
                requestsAdded += this.appData.addValidURLS(iframelinks, parenturl, "OnPageIFrame");
            }
        } catch (ex) {
            console.log(`[WC] Error in addURLSFromPage(): ${ex}`)
        }
        return requestsAdded;
    }

    async addFormData(page) {
        let requestsAdded = 0;
        try {
            const forms = await page.$$('form').catch(reason => {
                console.log(`received error in page. ${reason} `);
            });
            if (isDefined(forms)) {
                for (let i = 0; i < forms.length; i++) {
                    let faction = await this.getAttribute(forms[i], "action", "");
                    let fmethod = await this.getAttribute(forms[i], "method", "GET");
                    console.log("[WC] second form ACTION=", faction, fmethod, " FROM url ", await page.url());
                    requestsAdded += await this.searchForInputs(forms[i]);
                }
            }

        } catch (ex) {
            console.log(`[WC] addFormData(p) Error ${ex}`);
            console.log(ex.stack);
        }
        return requestsAdded;
    }

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

    async exerciseTarget(page) {
        console.log("[*] exerciseTarget called")
        this.requestsAdded = 0;
        let errorThrown = false;
        let clearURL = false;

        this.setPageTimer();

        if (this.url === "") {

            var urlstr = `/login.php`
            if (this.loginData !== undefined && 'form_url' in this.loginData) {
                clearURL = true;
                urlstr = await page.url();
                console.log("page.url = ", urlstr);
            } else {
                console.log("pre chosen url string = ", urlstr);
            }

            let foundRequest = FoundRequest.requestParamFactory(urlstr, "GET", "", {}, "LoginPage", this.appData.site_url.href)

            this.url = foundRequest.getURL();

            this.currentRequestKey = foundRequest.getRequestKey();
            this.method = foundRequest.method();

            if (this.appData.containsEquivURL(foundRequest)) {
                // do nothing
            } else {
                foundRequest.from = "startup";
                let addresult = this.appData.addRequest(foundRequest);
                if (addresult) {
                    this.appData.requestsFound[this.currentRequestKey]["processed"] = 1;
                } else {
                    console.log(this.appData.requestsFound);
                    console.log(this.currentRequestKey);
                    process.exit(3);
                }
            }
            //console.log("CREATING NEW PAGE for new pagedness");
            //this.page = await this.browser.newPage();
        }

        let url = this.url;
        let shortname = "";
        //console.log("\x1b[38;5;5mexerciseTarget, URL = ", url.href, "\x1b[0m");
        if (url.href.indexOf("/") > -1) {
            shortname = path.basename(url.pathname);
        }
        let options = { timeout: 20000, waituntil: "networkidle2" };
        //let options = {timeout: 10000, waituntil: "domcontentloaded"};
        let madeConnection = false;
        page.on('dialog', async dialog => {
            console.log(`[WC] Dismissing Message: ${dialog.message()}`);
            await dialog.dismiss();
        });
        // making 3 attempts to load page
        for (let i = 0; i < 3; i++) {
            try {
                let response = "";
                this.isLoading = true;

                if (clearURL) {
                    response = await page.reload(options);
                    let turl = await page.url();
                    console.log("Reloading page ", turl);
                } else {
                    let request_page = url.origin + url.pathname
                    console.log("GOING TO requested page =", request_page);
                    //response =
                    //let p1 = page.waitForResponse(url.origin + url.pathname);
                    //let p1 = page.waitForResponse(request => {console.log(`INSIDE request_page= ${request_page} ==> ${request.url()}`);return request.url().startsWith(url.origin);}, {timeout:10000});

                    response = await page.goto(url.href, options);

                    //response = await p1
                    //console.log("DONE WAITING FOR RESPONSE!!!!! ", url)
                    //console.log(test);
                    //response = await page.waitForResponse(() => true, {timeout:10000});
                    // //response = await page.waitForResponse(request => {console.log(`INSIDE requst.url() = ${request.url()}`);return request.url() === url.href;}, {timeout:10000})
                }
                // TODO:  a bug seems to exist when a hash is used in the url, the response will be returned as null from goto
                // This is attempt 1 to resolve, by skipping response actions when resoponse is null
                // This problem appears to be tied to setIncerpetRequest(true)
                // https://github.com/puppeteer/puppeteer/issues/5492

                //response = await page.goto(url.href, options);
                //attempting to clear an autoloaded alert box

                page.on('dialog', async dialog => {
                    console.log(`[WC] Dismissing Message: ${dialog.message()}`);
                    await dialog.dismiss();
                });

                let response_good = await this.checkResponse(response, page.url());

                if (response_good) {
                    madeConnection = await this.initpage(page, url);
                }

                break; // connection successful
            } catch (e) {

                console.log(`Error: Browser cannot connect to '${url.href}' RETRYING`);
                console.log(e.stack);
            }
        }
        if (!madeConnection) {
            console.log(`Error: LAST ATTEMPT, giving up, browser cannot connect to '${url.href}'`);
            return;
        }

        let lastGT = 0, lastGTCnt = 0, gremCounterStr = "";
        try {
            //console.log("Performing timeout and element search");
            let errorLoopcnt = 0;
            for (var cnt = 0; cnt < this.timeoutLoops; cnt++) {
                this.setPageTimer();
                if (!this.browser_up) {
                    console.log(`[WC] Browser is not available, exiting timeout loop`);
                    break;
                }
                console.log(`[WC] Starting timeout Loop #${cnt + 1} `);
                let roundResults = this.getRoundResults();
                if (page.url().indexOf("/") > -1) {
                    shortname = path.basename(page.url());
                }
                let processedCnt = 0;
                if (this.currentRequestKey in this.appData.requestsFound) {
                    processedCnt = this.appData.requestsFound[this.currentRequestKey]["processed"];
                }
                if (typeof this.requestsAdded === "string") {
                    this.requestsAdded = parseInt(this.requestsAdded);
                }
                let startingReqAdded = this.requestsAdded;
                this.requestsAdded += await this.addDataFromBrowser(page, url);
                if (cnt % 10 === 0) {
                    console.log(`[WC] W#${this.workernum} ${shortname} Count ${cnt} Round ${this.appData.currentURLRound} loopcnt ${processedCnt}, added ${this.requestsAdded} reqs : Inputs: ${roundResults.totalInputs}, (${roundResults.equaltoRequests}/${roundResults.totalRequests}) reqs left to process ${gremCounterStr}`);
                }
                let pinfo = this.browser.process();
                if (isDefined(pinfo) && pinfo.killed) {
                    console.log("Breaking out from test loop b/c BROWSER IS DEAD....")
                    break;
                }
                // if new requests added on last passs, then keep going
                if (startingReqAdded < this.requestsAdded) {
                    cnt = (cnt > 3) ? cnt - 3 : 0;
                }

                const now_url = await page.url();
                const this_url = this.url.href
                if (this.reinitPage) {
                    madeConnection = await this.initpage(page, url, true);
                    this.reinitPage = false;
                }
                if (now_url !== this_url) {
                    //console.log(`[WC] Attempting to reload target page b/c browser changed urls ${this_url !== now_url} '${this.url}' != '${now_url}'`)
                    this.isLoading = true;
                    let response = "";
                    try {
                        response = await page.goto(this.url, options);
                    } catch (e2) {
                        console.log(`trying ${this.url} again`)
                        response = await page.goto(this.url, options);
                    }

                    let response_good = await this.checkResponse(response, page.url());

                    if (response_good) {
                        madeConnection = await this.initpage(page, url, true);
                    }
                    this.isLoading = false;
                }
                await page.waitForTimeout(this.timeoutValue * 1000);
                let gremlinsHaveFinished = false;
                let gremlinsHaveStarted = false;
                let gremlinsTime = 0;
                try {
                    gremlinsHaveFinished = await page.evaluate(() => { return window.gremlinsHaveFinished; });
                    gremlinsHaveStarted = await page.evaluate(() => { return window.gremlinsHaveStarted; });
                    // TODO: 임시 주석처리
                    // console.log(`FIRST: gremlinsHaveStarted = ${gremlinsHaveStarted} gremlinsHaveFinished = ${gremlinsHaveFinished} browser_up=${this.browser_up} gremlinsTime=${gremlinsTime}`);
                    // the idea, is that we will keep going as long as gremlinsTime gets reset before 30 seconds is up
                    while (!gremlinsHaveFinished && this.browser_up && gremlinsTime < 30) {
                        let currequestsAdded = this.requestsAdded;
                        // TODO: 임시 주석처리
                        // console.log(`LOOP: gremlinsHaveStarted = ${gremlinsHaveStarted} gremlinsHaveFinished = ${gremlinsHaveFinished} browser_up=${this.browser_up}  gremlinsTime=${gremlinsTime}`);
                        await (sleepg(3000));
                        gremlinsHaveFinished = await page.evaluate(() => { return window.gremlinsHaveFinished; });
                        gremlinsHaveStarted = await page.evaluate(() => { return window.gremlinsHaveStarted; });
                        if (typeof (gremlinsHaveFinished) === "undefined" || gremlinsHaveFinished === null) {
                            console.log("[WC] attempting to reinet client scripts");
                            await this.initpage(page, url, true);
                        }
                        if (gremlinsHaveStarted) {
                            gremlinsTime += 3;
                        }
                        if (currequestsAdded !== this.requestsAdded) {
                            this.setPageTimer();
                            gremlinsTime = 0;
                            console.log("[WC] resetting timers b/c new request found")
                        }
                    }
                } catch (ex) {
                    console.log("Error occurred while checking gremlins, restarting \nError Info: ", ex);
                    errorLoopcnt++;
                    if (errorLoopcnt < 10) {
                        continue;
                    } else {
                        console.log("\x1b[38;5;1mToo many errors encountered, breaking out of test loop.\x1b[0m");
                        break;
                    }
                }
                console.log(`DONE with waiting for gremlins:: gremlinsHaveStarted = ${gremlinsHaveStarted} gremlinsHaveFinished = ${gremlinsHaveFinished} browser_up=${this.browser_up}  gremlinsTime=${gremlinsTime}`);
                // eval for iframes, a, forms
                if (this.workernum === 0 && cnt % 3 === 1) {
                    //page.screenshot({path: `/p/webcam/screenshot-${this.workernum}-${cnt}.png`, type:"png"}).catch(function(error){console.log("no save")});
                }
                //page.screenshot({path: `/p/tmp/screenshot-${this.workernum}-${cnt}.png`, type:"png"}).catch(function(error){console.log("no save")});
                //console.log("After content scan =>",cnt );

                if (this.hasGremlinResults()) {
                    if (lastGT === this.gremCounter["grandTotal"]) {
                        lastGTCnt++;
                    } else {
                        lastGTCnt = 0;
                    }
                    gremCounterStr = `Grems total = ${this.gremCounter["grandTotal"]}`;
                    lastGT = this.gremCounter["grandTotal"];
                    if (lastGTCnt > 3) {
                        console.log("Grand Total the same too many times, exiting.");
                        break
                    }
                }
            }
        } catch (e) {
            console.log(`Error: Browser cannot connect to ${url.href}`);
            console.log(e.stack);
            errorThrown = true;

        }
        // Will reset :
        //   If added more than 10 requests (whether error or not), this catches the situation when
        //     we added so many requests it caused a timeout.
        //   OR IF only a few urls were added but no error was thrown
        if (this.requestsAdded > 10 || (errorThrown === false && this.requestsAdded > 0)) {
            this.appData.resetRequestsAttempts(this.currentRequestKey);
        }

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
        console.log(`loading gremscript from local `);
        await page.addScriptTag({ path: "gremlins.min.js" });

        this.isLoading = false;

        await page.screenshot({ path: this.base_appdir + '/screenshot/screenshot-pre.png', type: "png" });

        await page.keyboard.down('Escape');

        //console.log("Waited for goto and response and div");
        this.requestsAdded += this.addDataFromBrowser(page, url);

        //console.log(this.appData.requestsFound[this.currentRequestKey]["processed"]% 2 === 0);

        // JSHandle.prototype.getEventListeners = function () {
        //     return this._client.send('DOMDebugger.getEventListeners', { objectId: this._remoteObject.objectId });
        // };

        //await this.submitForms(page);

        console.log('[WC] adding hasClicker to elements')
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
        console.log(`About to add code exercisers to page, u=${this.usernameValue} pw=${this.passwordValue}`);

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

        console.log("[WC] status = ", response.status(), response.statusText(), response.url());

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
            console.log("[\x1b[38;5;5mWC\x1b[0m] Cookie: " + cooky["name"] + "=" + cooky["value"] + "");
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
        console.log(`[WC] Round Results for round ${this.appData.currentURLRound} of ${MAX_NUM_ROUNDS}: Total Inputs :  ${roundResults.totalInputs} Total Requests: ${roundResults.equaltoRequests} of ${roundResults.totalRequests} processed so far`);

    }
    setPageTimer() {
        var self = this;
        if (this.pagetimeout) {
            console.log("[setPageTimer] Page timer를 초기화힙니다.");
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
        }, this.actionLoopTimeout * 1000 + 60000); //TODO: 6000을 임시로 60,000으로 수정함
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

function isDefined(val) {
    return !(typeof val === 'undefined' || val === null);
}

function sleepg(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}