import path from 'path';
import process from 'process';

import { FoundRequest } from './FoundRequest.js';

export async function exerciseTarget(page) {
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
                console.log("[exerciseTarget] GOING TO requested page =", request_page);
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
                console.log(`[exerciseTarget] Browser is not available, exiting timeout loop`);
                break;
            }
            console.log(`[exerciseTarget] Starting timeout Loop #${cnt + 1} `);
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
                console.log(`[exerciseTarget] W#${this.workernum} ${shortname} Count ${cnt} Round ${this.appData.currentURLRound} loopcnt ${processedCnt}, added ${this.requestsAdded} reqs : Inputs: ${roundResults.totalInputs}, (${roundResults.equaltoRequests}/${roundResults.totalRequests}) reqs left to process ${gremCounterStr}`);
            }

            let pinfo = this.browser.process();
            if (isDefined(pinfo) && pinfo.killed) {
                console.log("[exerciseTarget] Breaking out from test loop b/c BROWSER IS DEAD....")
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
                        console.log("[exerciseTarget] attempting to reinet client scripts");
                        await this.initpage(page, url, true);
                    }
                    if (gremlinsHaveStarted) {
                        gremlinsTime += 3;
                    }
                    if (currequestsAdded !== this.requestsAdded) {
                        this.setPageTimer();
                        gremlinsTime = 0;
                        console.log("[exerciseTarget] resetting timers b/c new request found")
                    }
                }
            } catch (ex) {
                console.log("[exerciseTarget] Error occurred while checking gremlins, restarting \nError Info: ", ex);
                errorLoopcnt++;
                if (errorLoopcnt < 10) {
                    continue;
                } else {
                    console.log("[exerciseTarget] \x1b[38;5;1mToo many errors encountered, breaking out of test loop.\x1b[0m");
                    break;
                }
            }
            console.log(`[exerciseTarget] DONE with waiting for gremlins:: gremlinsHaveStarted = ${gremlinsHaveStarted} gremlinsHaveFinished = ${gremlinsHaveFinished} browser_up=${this.browser_up}  gremlinsTime=${gremlinsTime}`);
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
                    console.log("[exerciseTarget] Grand Total the same too many times, exiting.");
                    break
                }
            }
        }
    } catch (e) {
        console.log(`[exerciseTarget] Error: Browser cannot connect to ${url.href}`);
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