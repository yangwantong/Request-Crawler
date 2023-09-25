import path from 'path';
import process from 'process';
import puppeteer from 'puppeteer';

import { FoundRequest } from '../FoundRequest.js';

const BLUE = "\x1b[38;5;4m";
const RED = "\x1b[38;5;9m";
const ENDCOLOR = "\x1b[0m";

export async function start() {
    var self = this;
    process.on('SIGINT', function () {
        console.log(`${BLUE}[INFO] Request Crawler를 종료합니다.${ENDCOLOR}`);
        process.exit(99);
    });
    async function targetChanged(target) {

        try {
            const newPage = await target.page();
            var newurl = newPage.target().url();

            if (target.url() !== self.url.href && target.url().startsWith(`${self.appData.site_url.origin}`)) {

                //console.log(`TARGETED CHANGED from ${self.url.href} to ${target.url()} `);
                //console.log(target);
                let foundRequest = FoundRequest.requestParamFactory(target.url(), "GET", "", {}, "targetChanged", self.appData.site_url.href);
                foundRequest.from = "targetChanged";
                self.requestsAdded += self.appData.addInterestingRequest(foundRequest);

                //var tempurl = new URL(newurl);
                //console.log("target changed -----------------------> ", tempurl.pathname);
                // tempurl.searchParams.forEach(function (value, key, parent) {
                //     self.appData.addQueryParam(key, value);
                //     //console.log("PARAM NAME :::> ", key, value);
                // });
            } else {  // target is foreign or same url
                //console.log(`TARGETED CHANGED to SAME ${self.url.href}`);
                var tempurl = new URL(newurl);
                //console.log("target changed -----------------------> ", tempurl.pathname);
                tempurl.searchParams.forEach(function (value, key, parent) {
                    //self.appData.addQueryParam(key, value);
                    //console.log("PARAM NAME :::> ", key, value);
                });

                // self.page = await self.browser.newPage();
                // await self.page.goto(newurl,{waitUntil:"load"});
                // await self.addCodeExercisersToPage(self.hasGremlinResults());
            }
            //self.page = newPage;
        } catch (e) {
            console.log(`${RED}[targetChanged] Target changed encountered an error${ENDCOLOR}`);
            console.log(e.stack);
            //await browser.close();
        }

    }

    /**
     * 페이지 에러를 인터셉터 하기 위한 핸들러
     * @param {*} error 
     */
    function pageError(error) {
        let msg = error.message;
        if (msg.length > 50) {
            msg = msg.substring(0, 50);
        }
        if (msg in self.shownMessages) {
            if (self.shownMessages[msg] % 1000 === 0) {
                console.log(msg, ` seen for the ${self.shownMessages[msg]} time`);
            }
            self.shownMessages[msg] += 1;
        } else if (error.message.indexOf("TypeError: Cannot read property 'species' of undefined") > -1) {
            console.log(`${RED}GREMLINS JS Error:${ENDCOLOR}\n\t`, error.message);
            self.gremlins_error = true;
        } else {
            self.shownMessages[msg] = 1;
            console.log(`${RED}Browser JS Error:${ENDCOLOR}\n\t`, error.message);
        }

    }

    /**
     * console.log 메시지를 인터셉터 하기 위한 핸들러
     * @param {*} message 
     */
    function consoleLog(message) {
        // console.log(`${BLUE}[consoleLog] message : ${ENDCOLOR}` + message.text())

        if (message.text().indexOf("[WC]") > -1) {
            if (message.text().indexOf("lamehorde is done") > -1) {
                console.log(`[\x1b[38;5;136mWC${ENDCOLOR}] Lamehorde completion detected`);
                self.lamehord_done = true;
            } else {
                console.log(message.text());
            }
        } else if (message.text().search("[WC-URL]") > - 1) {
            let urlstr = message.text().slice("[WC-URL]".length);
            console.log(`[WC] puppeteer layer recieved url from browser with urlstr='${urlstr}'`);
            self.appData.addValidURLS([urlstr], `${self.appData.site_url.href}`, "ConsleRecvd");

        } else if (message.text().search("CW DOCUMENT") === -1 && message.text() !== "JSHandle@node") {
            if (message.text().indexOf("gremlin") > -1) {
                self.gremTracker(message.text());
            } else if (message.text().indexOf("mogwai") > -1) {
                self.gremTracker(message.text());
            } else {
                if (message.text().startsWith("jQuery") || message.text().startsWith("disabled") || message.text().startsWith("__ko__")) {
                    // do nothing
                } else {
                    console.log(message.text())
                }
            }
        }
    }

    /**
     * Two phases, in the first, we record and save any relevant request information on local requests.
     * In the second, we attempt to determine if the request should be aborted.
     * @param req
     */
    function processRequest(req) {
        // console.log("[WC] processRequest called : " + req.url());
        // interception does not fire for /#/XXXX changes

        // Save Request info if we can
        // if (req.method() !== "GET" || req.postData() || req.resourceType() === "xhr") {
        //console.log("NONGET: ", req.url(), "method=",req.method(), "restype=", req.resourceType(), "data=", req.postData());
        // }

        let tempurl = new URL(req.url());
        // CSS 또는 JavaScript 요청은 무시
        if (tempurl.pathname.search(/\.css$/) > -1 || tempurl.pathname.search(/\.js$/) > -1) {
            // console.log("CSS/JS Request Coming THROUGH!!!!! ", req.url(), "method=", req.method(), "restype=", req.resourceType(), "data=", req.postData());
            req.continue()
            return;
        }
        // TODO: 이미지 요청은 무시 (새롭게 추가한 코드)
        // if (tempurl.pathname.search(/\.png$/) > -1 || tempurl.pathname.search(/\.jpg$/) > -1 || tempurl.pathname.search(/\.gif$/) > -1) {
        //     req.continue()
        //     return;
        // }

        // TODO: 이건 왜 있는 거지? HNAP1 요청처리...?
        // if (req.url().search(/.*HNAP1/) > -1) {
        //     let re = new RegExp(/<soap:Body>(.*)<\/soap:Body>/);
        //     if (re.test(req.postData())) {
        //         let pd_match = re.exec(req.postData());
        // console.log(`${GREEN}${req.url()} ${pd_match[1]}${ENDCOLOR}`);
        // } else {
        //console.log(`${GREEN}${req.url()} NO SOAP MATCH ${req.postData()} ${ENDCOLOR}`);
        // }
        // }

        //console.log("Interceptd ", req.url());
        if (self.url.href === req.url()) {
            //not sure why reforming request data for continue here.

            var pdata = {
                'method': self.method,
                'postData': self.postData,
                headers: {
                    ...req.headers(),
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            };

            let foundRequest = FoundRequest.requestObjectFactory(req, self.appData.site_url.href);
            foundRequest.from = "InterceptedRequestSelf";

            for (let [pkey, pvalue] of Object.entries(foundRequest.getAllParams())) {
                if (typeof pvalue === "object") {
                    pvalue = pvalue.values().next().value;
                }
                self.appData.addQueryParam(pkey, pvalue);
            }

            if (self.appData.addInterestingRequest(foundRequest) > 0) {
                self.requestsAdded++;
            }

            if (!self.isLoading) {
                req.respond({ status: 204 });
                return;
                //self.reinitPage = true;
            }
            console.log("\x1b[38;5;5mprocessRequest caught to add method and data and continueing \x1b[0m", req.url());
            req.continue(pdata);

        } else {
            //self.appData.addInterestingRequest(req );

            tempurl.searchParams.forEach(function (value, key, parent) {
                self.appData.addQueryParam(key, value);
            });
            if (req.url().startsWith(self.appData.site_url.origin)) {
                // TODO: 임시 주석
                // console.log("[WC] Intercepted in processRequest ", req.url(), req.method());
                let basename = path.basename(tempurl.pathname);
                if (req.url().indexOf("rest") > -1 && (req.method() === "POST" || req.method() === "PUT")) {
                    //console.log(basename, req.method(), req.headers(), req.resourceType());
                }

                let foundRequest = FoundRequest.requestObjectFactory(req, self.appData.site_url.href);
                foundRequest.from = "InterceptedRequest";

                for (let [pkey, pvalue] of Object.entries(foundRequest.getAllParams())) {
                    if (typeof pvalue === "object") {
                        pvalue = pvalue.values().next().value;
                    }
                    self.appData.addQueryParam(pkey, pvalue);
                }

                if (self.appData.addInterestingRequest(foundRequest) > 0) {
                    self.requestsAdded++;
                    //console.log("[WC] ${GREEN} ${GREEN} ADDED ${ENDCOLOR}${ENDCOLOR}intercepted request req.url() = ", req.url());
                }
                // skip if it has a period for nodejs apps

                let result = self.appData.addRequest(foundRequest);
                if (result) {
                    // TODO: 임시 주석
                    // console.log(`\x1b[38;5;2mINTERCEPTED REQUEST and ${GREEN} ${GREEN} ADDED ${ENDCOLOR}${ENDCOLOR} #${self.appData.collectedURL} ${req.url()} RF size = ${self.appData.numRequestsFound()}\x1b[0m`);
                } else {
                    // TODO: 임시 주석
                    // console.log(`INTERCEPTED and ABORTED repeat URL ${req.url()}`);
                }
            } else {
                if (req.url().indexOf("gremlins") > -1) {
                    //console.log("[WC] CONTINUING with getting some gremlins in here.");
                    req.continue();
                } else {
                    try {
                        let url = new URL(req.url());
                        if (req.url().startsWith("image/") || url.pathname.endsWith(".gif") || url.pathname.endsWith(".jpeg") || url.pathname.endsWith(".jpg") || url.pathname.endsWith(".woff") || url.pathname.endsWith(".ttf")) {

                        } else {
                            //console.log(`[WC] Ignoring request for ${req.url().substr(0,200)}`)
                        }
                    } catch (e) {
                        //console.log(`[WC] Ignoring request for malformed url = ${req.url().substr(0,200)}`)
                    }
                    if (self.isLoading) {
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
            if (false && req.frame() === self.page.mainFrame()) {
                console.log(`[WC] Aborting request b/c frame == mainframe for ${req.url().substr(0, 200)}`)
                //req.abort('aborted');
                req.respond(req.redirectChain().length
                    ? { body: '' } // prevent 301/302 redirect
                    : { status: 204 } // prevent navigation by js
                )
            } else {
                if (req.isNavigationRequest() && req.frame() === self.page.mainFrame()) {
                    if (typeof self.last_nav_request !== "undefined" && self.last_nav_request === req.url()) {
                        // TODO: 임시 주석
                        // console.log("[WC] Aborting request b/c this is the same as last nav request, ignoring");

                        self.last_nav_request = req.url();
                        req.respond(req.redirectChain().length
                            ? { body: '' } // prevent 301/302 redirect
                            : { status: 204 } // prevent navigation by js
                        )
                        return;
                    }
                    self.last_nav_request = req.url();
                    if (req.url().indexOf("gremlins") > -1) {
                        //console.log("[WC] CONTINUING with getting some gremlins in here.");
                        req.continue();
                        return;
                    }
                    if (self.isLoading) {
                        //console.log(`[WC] \tRequest granted while still in loading phase ${req.resourceType()} ${req.url()} `);
                        req.continue();
                    } else {
                        // if(req.respond(req.redirectChain().length)) {
                        //     console.log(`[WC] \tNavigation Request in mainFrame preventing 301/302 redirect ${req.url()}`);
                        // } else{
                        //     console.log(`[WC] \tNavigation Request in mainFrame denied ${req.url()} using 204`);
                        // }

                        req.respond(req.redirectChain().length
                            ? { body: '' } // prevent 301/302 redirect
                            : { status: 204 } // prevent navigation by js
                        )
                        //req.abort();
                    }

                } else {

                    // NON-mainFrame or not a navigation reque, shouldn't change page navigation

                    // var pdata = {
                    //     headers: {
                    //         ...req.headers(),
                    //         "Content-Type": "application/x-www-form-urlencoded"
                    //     }
                    // };
                    // if (!("Authorization" in pdata.headers)){
                    //     pdata.headers["Authorization"] = self.bearer;
                    // }
                    // let cookiestr = "";
                    // for (let cookie of self.cookies){
                    //     cookiestr += `${cookie.name}=${cookie.value}; `
                    // }
                    // pdata.headers["Cookie"] = cookiestr;
                    // console.log("\nprocessRequest REFORMED continue --- > nav req = ", req.isNavigationRequest(),
                    //     "is main frame = ", req.frame() === self.page.mainFrame(),
                    //     "is loading = ", self.isLoading,
                    //     "url = ", req.url(), "\n");
                    if (req.frame() === self.page.mainFrame()) {
                        if (self.isLoading) {

                            self.loadedURLs.push(tempurl.origin + tempurl.pathname);
                            req.continue();
                        } else {
                            req.continue();
                            // if (self.loadedURLs.includes(tempurl.origin + tempurl.pathname)){
                            //     console.log(`[WC] \tAllowing reload of frame ${req.url()}`);
                            //     req.continue();
                            // } else {
                            //     req.abort();
                            // }
                        }
                    } else {
                        req.continue()
                    }

                }
            }

        }
    } // end processrequest

    console.log(`${BLUE}[processRequest] Browser launching with url=${this.url.href}${ENDCOLOR}`);

    try {
        try {
            this.browser = await puppeteer.launch({ headless: this.appData.headless, args: ["--no-sandbox", "--disable-features=site-per-process", "--window-size=1600,900"], "defaultViewport": null }); //
            //console.log("OPENED BROWSER!");
            this.browser_up = true;
        } catch (xerror) {
            //console.log("UNABLE TO OPEN X DISPLAY");
            if (xerror.message.indexOf("Unable to open X display") > -1) {
                this.browser = await puppeteer.launch({ headless: this.appData.headless, args: ["--disable-features=site-per-process"] });
                this.browser_up = true;
            } else {
                this.browser_up = false;
                // noinspection ExceptionCaughtLocallyJS
                throw (xerror);
            }
        }

        let gremlinsErrorTest = setInterval(function () {
            if (self.gremlins_error && self.lamehord_done) {
                console.log("Ohh no, they killed Gizmo!, and the lamhord completed.  Aborting!!!");
                try {
                    this.browser_up = false;
                    self.browser.close();
                } catch (err) {
                    console.log(`${RED}[gremlinsErrorTest] Problem closing browser after timeout${ENDCOLOR}`);
                }
                self.gremlins_error = false;
            }
        }, 10 * 1000);

        this.page = await this.browser.newPage();

        try {
            await this.page.evaluate(() => console.log(`url is ${location.href}`));

            await this.page.setRequestInterception(true);

            // witcher_config.json에 로그인 데이터가 존재할경우 로그인을 수행한다.
            if (this.loginData !== undefined && 'form_url' in this.loginData) {
                let loginCookies = await this.do_login(this.page);   // 로그인 수행
                await this.addCookiesToPage(loginCookies, this.cookieData, this.page).catch(function (error) {
                    console.log(`${RED}[LOGIN] COOKIE ERROR : ${ENDCOLOR}`, error)
                });
            }

            // TODO: 동작하지 않는 코드
            // let childFrames = await this.page.mainFrame().childFrames();

            // if (typeof childFrames !== 'undefined' && childFrames.length > 0) {
            //     for (const frame of childFrames) {
            //         // await frame.setRequestInterception(true);
            //         // frame.on('request', processRequest);

            //         console.log(`[WC] adding processRequest for ${frame.url()}`)
            //     }
            // }

            this.page.on('request', processRequest);    // request 인터셉트
            this.page.on('console', consoleLog);    // console.log 인터셉트
            this.page.on('pageerror', pageError);   // JavaScript 오류 인터셉트
            this.browser.on('targetchanged', targetChanged);    //  페이지이동 인터셉트 (타겟 변경)

            await this.page.setCacheEnabled(false); // 캐시 비활성화
            await this.page.setDefaultNavigationTimeout(0); //  타임아웃 비활성화

            await this.exerciseTarget(this.page);   // 타겟 연습

            this.reportResults();

        } catch (e) {
            console.log(`${RED}Error: cannot start browser${ENDCOLOR}`);
            console.log(e.stack);
        } finally {
            if (this.pagetimeout) {
                console.log("[processRequest] \x1b[38;5;10mRemoving page timer for browser \x1b[0m");
                clearTimeout(this.pagetimeout);
            }
            clearInterval(gremlinsErrorTest);
            //console.log(`current request = ${this.appData.requestsFound[this.currentRequestKey]}`)
            await this.browser.close();
        }

    } catch (browsererr) {
        console.log(`${RED}Error: with Starting browser or creating new page${ENDCOLOR}`);
        console.log(browsererr.stack);
    }

}