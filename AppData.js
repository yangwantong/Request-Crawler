import fs from 'fs';
import path from 'path';
import process from 'process';
import fuzzySet from 'fuzzyset';
//const {JSHandle} = require('puppeteer/lib');
import { FoundRequest } from './FoundRequest.js';
import { networkInterfaces } from 'os';

const GREEN = "\x1b[38;5;2m";
const YELLOW = "\x1b[38;5;3m";
const BLUE = "\x1b[38;5;4m";
const ENDCOLOR = "\x1b[0m";

const MAX_NUM_ROUNDS = 3;

export class AppData {

    constructor(base_appdir, base_site, headless) {
        this.requestsFound = {};
        this.site_url = new URL(base_site);
        this.headless = headless;
        this.inputSet = new Set();
        this.currentURLRound = 1;
        this.collectedURL = 0;
        this.base_appdir = base_appdir;
        this.usingFuzzingDir = false;
        this.maxKeyMatches = 2;
        this.fuzzyMatchEquivPercent = .70;
        this.ignoreValues = new Set();
        this.urlUniqueIfValueUnique = new Set();
        this.minFuzzyScore = .80;
        this.ips = ["127.0.0.1", "localhost", this.site_url.host]
        this.gremlinValues = new Set(["Witcher", "127.0.0.1", "W'tcher", "W%27tcher", "2"]);
        const nets = networkInterfaces();
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                this.ips.push(net.address)
            }
        }

        this.site_ip = this.site_url.host
        //this.site_ip = base_site.

        if (!this.loadReqsFromJSON()) { //request_data.json 파일이 없으면
            /**
             * Adding extra guessed urls here.
             */
            // TODO: 임시 코드 비활성화
            if (this.site_url.href.endsWith("/")) {
                // this.addRequest(FoundRequest.requestParamFactory(`${this.site_url.href.slice(0, -1)}/admin`, "GET", "", {}, "initial", this.site_url.href))
            }
            this.addRequest(FoundRequest.requestParamFactory(`${this.site_url.href}`, "GET", "", {}, "initial", this.site_url.href))
        }
    }
    addGremlinValue(newval) {
        this.gremlinValues.add(newval);
    }
    updateReqsFromExternal() {
        let extra_reqs_json_fn = path.join(this.base_appdir, "afl_request_data.json");
        if (fs.existsSync(extra_reqs_json_fn)) {
            let jstrdata = fs.readFileSync(extra_reqs_json_fn);
            let temprf = JSON.parse(jstrdata);
            this.currentURLRound = 0;
            for (let key of Object.keys(temprf)) {
                let req = temprf[key];
                if (key in this.requestsFound) {
                    // skip
                } else {
                    this.requestsFound[key] = Object.assign(new FoundRequest(), req);
                    this.requestsFound[key]["attempts"] = 0
                    console.log("NEW REQ FND from scanner", this.requestsFound[key].toString());
                }

            }
        }
    }

   /**
    * request_data.json 파일 로드 
    * @returns {boolean}    파일이 존재하면 true, 존재하지 않으면 false 반환
    */
    loadReqsFromJSON() {
        let json_fn = path.join(this.base_appdir, "request_data.json");

        if (fs.existsSync(json_fn)) {
            console.log(`${BLUE}[INFO] Founded request_data.json${ENDCOLOR}`);
            let jstrdata = fs.readFileSync(json_fn);
            let jdata = JSON.parse(jstrdata);
            this.inputSet = new Set(jdata["inputSet"]);
            let temprf = jdata["requestsFound"];
            for (let key of Object.keys(temprf)) {
                let req = temprf[key];
                this.currentURLRound = Math.min(this.currentURLRound, req["attempts"]);
                this.requestsFound[key] = Object.assign(new FoundRequest(), req);
                console.log(this.requestsFound[key].toString());
                //this.requestsFound[key]["attempts"] = req["attempts"];
            }

            return true
            //console.log(requestsFound);
        }
        console.log(`${BLUE}[INFO] Not Founded request_data.json${ENDCOLOR}`);
        return false;
    }

    setIgnoreValues(exclusions) {
        if (isDefined(exclusions)) {
            this.ignoreValues = new Set(exclusions);
        } else {
            this.ignoreValues = new Set();
        }
    }

    setUrlUniqueIfValueUnique(inclusions) {
        if (isDefined(inclusions)) {
            this.urlUniqueIfValueUnique = new Set(inclusions);
        } else {
            this.urlUniqueIfValueUnique = new Set();
        }
    }

    resetRequestsAttempts(key) {
        console.log(`Trying to reset for ${key}`);
        this.requestsFound[key]["attempts"] = this.currentURLRound - 1;
        console.log(`RESET attempts to ${this.requestsFound[key]["attempts"]} for ${key}`)
    }

    getRequestInfo() {
        let outstr = "";
        for (let value of Object.values(this.requestsFound)) {
            outstr += `\x1b[38;5;28m${value.url()}, \x1b[38;5;11m${value.attempts}\x1b[0m\n`
        }
        return outstr;
    }

    usingFuzzingDir() {
        this.usingFuzzingDir = true;
    }

    fuzzyValueMatch(soughtValue, testValues) {
        let fuzset = fuzzySet([...testValues]);
        let results = fuzset.get(soughtValue, false, this.minFuzzyScore);
        if (results === false) {
            return false;
        } else {
            //console.log("Fuzzy Match = ", results[0][0]);
            return true;
        }
    }

    /**
     * Looks for an equivalnt match where fullMatchEquiv of the params or more match one another in the query strings.
     * @param soughtParams
     * @param testParams
     * @param fullMatchEquiv the percent of key/values in the query string that are equivalent to an exact match
     * @returns {boolean}
     */
    equivParameters(soughtParams, testParams, fullMatchEquiv) {
        // if target has no query params
        if (testParams.length === 0) {
            return false;
        }
        let paramValueMatchCnt = 0;
        let gremlinValues = this.gremlinValues;
        // excluded
        //0.3533549273542278&_=1617038119579
        //0.8389814703576484&_=1617038119586
        //0.5336236531483045
        let timeVarRegex = /[0-9.]+[0-9]{6,50}/; // e.g., 0.3533549273542278
        // All keys must be the same for a match
        for (let [skey, svalues] of Object.entries(soughtParams)) {
            // add as a match when a variable matches the format for timestamp nanoseconds
            // this might be too lax, should maybe find match for both
            if (timeVarRegex.exec(skey)) {
                paramValueMatchCnt++;
                continue;
            }
            if (skey in testParams) {
                if (this.ignoreValues.has(skey)) {
                    paramValueMatchCnt++;
                } else {
                    //console.log(`svalues=`,svalues, `testParams[skey]=`,testParams[skey], skey, )
                    for (const svalue of svalues.values()) {
                        if (testParams[skey].has(svalue)) {
                            paramValueMatchCnt++;
                            break;
                        } else if (gremlinValues.has(svalue) || svalue.match(/1999.12.12/) || svalue.match(/12.12.1999/)) {
                            paramValueMatchCnt++;
                            break;
                        } else {
                            if (this.urlUniqueIfValueUnique.has(skey)) {
                                return false;
                            }
                            if (svalue.length > 5 && this.fuzzyValueMatch(svalue, testParams[skey])) {
                                paramValueMatchCnt++;
                                break;
                            }
                        }
                    }
                }
                // } else {
                //     return false;
            }
        }
        //console.log(`Equiv found ${paramValueMatchCnt} of ${fullMatchEquiv} ${(paramValueMatchCnt >= fullMatchEquiv)}`);
        return (paramValueMatchCnt >= fullMatchEquiv);

    }


    keyMatch(soughtParams, testParams) {

        if (Object.keys(soughtParams).length !== Object.keys(testParams).length) {
            return false;
        }

        for (let param of Object.keys(soughtParams)) {
            // want to disable keyMatch equivalence when the key value is required
            if (this.urlUniqueIfValueUnique.has(param)) {
                return false;
            }
            if (!(param in testParams)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Search the requestData to determine whether a sufficient match exists between urls.
     * An equivalent querystring matches for 100% of the keys and 75% of the values.
     * @param soughtRequest {FoundRequest} - the Request object that contains the query string in question
     * @param forceMatch {boolean} - whether a fuzzy match at the class's rate is used
     * @returns {boolean}
     */
    containsEquivURL(soughtRequest, forceMatch = false) {

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

        for (let savedReq of Object.values(this.requestsFound)) {
            let prevURL = savedReq.getURL();
            let prevPathname = savedReq.getPathname();

            if (prevURL.href === soughtURL.href && savedReq.postData === soughtRequest.postData() && savedReq.hash === soughtURL.hash) {
                return true;
            }
            if (forceMatch) {
                return false;
            }
            if (prevPathname === soughtPathname && (!soughtURL.hash || savedReq.hash === soughtURL.hash)) {

                if (postData.startsWith("<?xml")) {
                    let testPostData = savedReq.postData();
                    let re = new RegExp(/<soap:Body>(.*)<\/soap:Body>/);
                    if (re.test(postData) && re.test(testPostData)) {
                        let pd_match = re.exec(postData)
                        let test_pd_match = re.exec(testPostData);

                        let matchVal = this.fuzzyValueMatch(pd_match[1], test_pd_match[1])
                        return matchVal;
                    }
                }

                let testParamsArr = savedReq.getAllParams();

                if (this.equivParameters(soughtParamsArr, testParamsArr, fullMatchEquiv)) {
                    return true;
                } else if ((nbrParams - 1) < fullMatchEquiv) {
                    // for situations where the reduced number of parameters forces 100%, also do a keyMatch
                    if (this.keyMatch(soughtParamsArr, testParamsArr) && this.fuzzyMatchEquivPercent < .99) {
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

    getValidURL(urlstr, parenturl) {
        let lowerus = urlstr.toLowerCase();
        if (lowerus.startsWith("javascript")) {
            return "";
        }
        //console.log("\x1b[38;5;3mTESTING", urlstr, "\x1b[0m", ` for parent ${parenturl.origin}`);

        //if (lowerus.search(/.php($|\?)/) > -1 || lowerus.search(/.html($|\?)/) > -1 || lowerus.search("#") > -1 ) {

        if (lowerus.startsWith(parenturl.origin)) {
            //console.log("\x1b[38;5;3mValidated ", urlstr, "\x1b[0m");
            return urlstr;
        } else if (lowerus.startsWith("http")) {
            //console.log("\x1b[38;5;3mFAILED TO validate ", urlstr, "\x1b[0m");
            return "";
        }

        if (lowerus.startsWith("/")) { // absolute path
            console.log("\x1b[38;5;3mValidated from /", parenturl.origin + urlstr, "\x1b[0m");
            return parenturl.origin + urlstr;
        } else { // relative path
            let lastPathOut = ""
            try {
                //console.log("\x1b[38;5;3mLast choice trying to add origin and pathname to lowerus ", parenturl.origin + path.dirname(parenturl.pathname) + urlstr, "\x1b[0m");
                lastPathOut = parenturl.origin + path.dirname(parenturl.pathname) + urlstr;
            } catch (Exception) {
                //console.log("\x1b[38;5;3mInvalid path WITH Last choice trying to add origin and pathname to lowerus parenturl=", parenturl, "urlstr=", urlstr, "\x1b[0m");
                return ""
            }
            return parenturl.origin + path.dirname(parenturl.pathname) + urlstr;
        }

    }

    addValidURLS(links, parenturl, origin) {
        let requestsAdded = 0;
        for (let link of links) {
            let validURLStr = this.getValidURL(link, parenturl);

            if (validURLStr.length > 0) {
                let foundRequest = FoundRequest.requestParamFactory(validURLStr, "GET", "", {}, origin, this.site_url.href);

                if (!this.containsEquivURL(foundRequest)) {
                    foundRequest.from = origin;
                    let addResult = this.addRequest(foundRequest);
                    if (addResult) {
                        requestsAdded++;
                        // TODO: 임시 주석처리
                        // console.log(`[${GREEN}WC${ENDCOLOR}] ${GREEN} ADDED ${ENDCOLOR}${foundRequest.toString()} `);
                    }
                }
            }
        }
        return requestsAdded;
    }

    interestingURL(url) {
        if (url.pathname.endsWith(".php") || url.pathname.search(/php\?/) > -1) {
            return true;
        } else if (url.pathname.endsWith(".css")) {
            return false
        }
        return false;

    }

    /**
     *
     * @param foundRequest {FoundRequest}
     * @returns {number}
     */
    addInterestingRequest(foundRequest) {
        let requestsAdded = 0;
        let tempURL = foundRequest.url().split("?")[0];
        // TODO : [fix] 파라미터 제거함 (css에 대한 파라미터 제거)
        if (tempURL.endsWith('.css') || tempURL.endsWith('.jpg') || tempURL.endsWith('.gif') || tempURL.endsWith('.png') || tempURL.endsWith(".js") || tempURL.endsWith(".ico")) {
            return requestsAdded;
        }
        if (this.containsEquivURL(foundRequest)) { //|| this.containsMaxNbrSameKeys(tempURL)
            //do nothing for now
            //console.log("[WC] Could have been added, ",req.url(), req.method(), req.postData());
        } else {

            let wasAdded = this.addRequest(foundRequest);
            if (wasAdded) {
                let postlen = "";
                if (isDefined(foundRequest.postData())) {
                    postlen = foundRequest.postData().length
                }
                requestsAdded++;
                // TODO : 임시 주석처리
                // console.log(`[${GREEN}WC${ENDCOLOR}] ${GREEN} ADDED ${ENDCOLOR}-- ${foundRequest.toString()} ${ENDCOLOR}`);
            }
        }
        return requestsAdded;
    }
    nextRequestId() {
        return Object.keys(this.requestsFound).length + 1
    }

    //addRequest(urlstr, method, postData, headers, from="interceptedRequest", cookieData="") {
    /**
     * Adds the supplied request to the list of requests
     * @param fRequest:FoundRequest
     * @returns {boolean}
     */
    addRequest(fRequest) {

        // let requestInfo = {
        //     id: this.nextRequestId(), url:urlstr, method: method, postData: postData,
        //     attempts:0, from:from, cookieData:cookieData,
        //     usedFuzzingDir: this.usingFuzzingDir,
        //     content_type: content_type,
        //     processed:0
        // };
        //console.log(requestInfo);

        // MODIFY HERE!!!! - MINHYUK
        try {
            let reqkey = fRequest.getRequestKey();

            if (reqkey in this.requestsFound) {
                return false;
            } else {
                fRequest.setId(this.nextRequestId());   // id 설정
                this.collectedURL += 1;
                this.requestsFound[fRequest.getRequestKey()] = fRequest;
                // color GREEN
                console.log(`${YELLOW}[+] addRequest : ${ENDCOLOR}` + reqkey);
                return true;
            }
        } catch (error) {
            console.error(error);
            return false;
        }
    }

    addQueryParam(key, value) {
        var keycnt = 0;

        this.inputSet.forEach(function (setkey) {
            if (setkey.startsWith(key + "=")) {
                keycnt++;
            }
        });
        if (keycnt < 4) {
            if (value.search(/[Q2][Q2]+/) > -1) {
                value = value.substring(0, 1);
            }
            if (this.inputSet.has(`${key}=`) && value.length > 0) {
                this.inputSet.delete(`${key}=`);
            }
            if (value.length === 0 && keycnt === 0 || value.length > 0) {
                this.inputSet.add(`${key}=${value}`);
            }
        }

    }
    numInputsFound() {
        return this.inputSet.size;
    }
    hasRequests() {
        return Object.keys(this.requestsFound).length === 0
    }
    numRequestsFound() {
        return Object.keys(this.requestsFound).length
    }
    ignoreRequest(urlstr) {
        try {
            let url = new URL(urlstr);
            if (url.pathname.endsWith('logout.php')) {
                return true;
            }

        } catch (ex) {
            console.log(`ERROR converting ${urlstr} to URL `);
            console.log(ex);
        }
        return false;
    }
    shuffle(array) {
        let currentIndex = array.length, randomIndex;

        // While there remain elements to shuffle...
        while (currentIndex !== 0) {

            // Pick a remaining element...
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;

            // And swap it with the current element.
            [array[currentIndex], array[randomIndex]] = [
                array[randomIndex], array[currentIndex]];
        }

        return array;
    }

    // return True if the pathname of one to investigate matches current, gives more diversity when a bunch of a single type exist.
    checkToSkip(new_urlstr) {
        try {
            if (!this.currentRequest) {
                return false;
            }
            let cur_urlstr = this.currentRequest._urlstr;
            let new_url = new URL(new_urlstr);
            let cur_url = new URL(cur_urlstr);
            if (new_url.pathname === cur_url.pathname) {
                return true;
            }

        } catch (ex) {
            console.log(`ERROR converting ${new_urlstr} or ${cur_urlstr} to URL in checkToSkip`);
            console.log(ex);
        }
        return false
    }
    getNextRequest() {
        let skips = 0;
        // console.log(inputSet);
        while (this.currentURLRound <= MAX_NUM_ROUNDS) {
            let randomKeys = Object.keys(this.requestsFound);
            //this.shuffle(randomKeys);
            console.log(`${BLUE}[INFO] getNextRequest (Shown reandomKeys)${ENDCOLOR}`)
            console.log(randomKeys);
            let cnt = 0;
            for (const key of randomKeys) {
                let req = this.requestsFound[key];
                cnt++;
                if (this.ignoreRequest(req._urlstr)) {  // urlstr이 logout.php로 끝나면 skip
                    console.log(`IGNORING >>>>> ${key} `);
                    this.requestsFound[key]["attempts"] = MAX_NUM_ROUNDS

                } else {
                    if (req["attempts"] < this.currentURLRound) {
                        if ((cnt + 5) < randomKeys.length && skips < 5 && this.checkToSkip(req["_urlstr"])) {
                            console.log(`SKIPPING ${req} for now `);
                            continue;
                        }
                        req["attempts"] += 1;
                        this.save();
                        console.log(`${GREEN}[+] Save : ${ENDCOLOR}` + key);
                        req["key"] = key;
                        this.currentRequest = req;
                        return req;
                    }
                }

            }

            this.currentURLRound++;

            console.log("CURRENT ROUND VALUE HAS INCREASED TO ", this.currentURLRound);
        }
        return null;
    }

    // request_data.json에 저장
    save() {
        //await exerciseTarget(page, new URL(key));
        let randomKeys = Object.keys(this.requestsFound);
        for (const key of randomKeys) {
            let req = this.requestsFound[key];
            if (req["_method"] === "POST") {
                req["response_status"] = 200;
            }
        }

        let jdata = JSON.stringify({ requestsFound: this.requestsFound, inputSet: Array.from(this.inputSet) });
        fs.writeFileSync(path.join(this.base_appdir, "request_data.json"), jdata);
    }
}

process.on('uncaughtException', function (err) {
    console.log('Caught exception: ' + err);
    console.log(err.stack);
});

function isDefined(val) {
    return !(typeof val === 'undefined' || val === null);
}
