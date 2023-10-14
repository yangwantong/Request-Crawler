import fs from 'fs';
import path from 'path';
import { FoundRequest } from './FoundRequest.js';
import { RED, GREEN, BLUE, CYAN, ENDCOLOR, YELLOW } from '../common/utils.js';
import { networkInterfaces } from 'os';

const MAX_NUM_ROUNDS = 1;   // 한 페이지당 몇번 크롤링을 시도할 것인지

export class AppData {
    requestsFound = {};
    site_url;
    headless;
    inputSet = new Set();
    currentURLRound = 1;
    collectedURL = 0;
    ips = [];
    site_ip;
    usingFuzzingDir = false;
    maxKeyMatches = 2;
    fuzzyMatchEquivPercent = 0.70;
    ignoreValues = new Set();
    urlUniqueIfValueUnique = new Set();
    minFuzzyScore = 0.80;
    gremlinValues = new Set(["Witcher", "127.0.0.1", "W'tcher", "W%27tcher", "2"]);

    constructor(base_directory, base_site, headless) {
        this.site_url = new URL(base_site);
        this.headless = headless;
        this.base_directory = base_directory;
        const nets = networkInterfaces();
        this.ips = ["127.0.0.1", "localhost", this.site_url.host];
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                this.ips.push(net.address);
            }
        }
        this.site_ip = this.site_url.host;

        this.loadReqsFromJSON();

        if (!this.requestsFound || Object.keys(this.requestsFound).length === 0) {
            this.addRequest(new FoundRequest(this.site_url.href, "GET", "", {}, "initial", this.site_url.href));
        }
    }

    getCurrentURLRound() {
        return this.currentURLRound;
    }

    getCurrentRequestURL() {
        return this.currentRequest._urlstr;
    }

    getHeadless() {
        return this.headless;
    }

    getSiteUrl() {
        return this.site_url;
    }

    getNextRequestId() {
        return Object.keys(this.requestsFound).length + 1
    }
    getRequestCount(){
        return Object.keys(this.requestsFound).length
    }

    getCollectedURLCount() {
        return this.collectedURL;
    }

    getInputSetSize() {
        return this.inputSet.size;
    }

    addGremlinValue(val){
        this.gremlinValues.add(val);
    }

    loadReqsFromJSON() {
        let json_fn = path.join(this.base_directory, "output/request_data.json");

        if (fs.existsSync(json_fn)) {
            console.log(`${BLUE}[!] Founded request_data.json${ENDCOLOR}`);
            let jstrdata = fs.readFileSync(json_fn);
            let jdata = JSON.parse(jstrdata);
            this.inputSet = new Set(jdata["inputSet"]);
            this.requestsFound = jdata["requestsFound"];
            if (this.requestsFound) {
                let keys = Object.keys(this.requestsFound);
                for (let key of keys) {
                    this.currentURLRound = Math.min(this.currentURLRound, this.requestsFound[key]["attempts"]);
                }
            }
            return true;
        }
        console.log(`${BLUE}[!] Not founded request_data.json${ENDCOLOR}`);
        return false;
    }
    ignoreRequest(urlstr) {
        try {
            let url = new URL(urlstr);
            if (url.pathname.endsWith('logout.php')) {
                return true;
            }
        } catch (ex) {
            console.error(`${RED}[-] An error occurred while ignoring request : ${ENDCOLOR}` + ex)
            return false;
        }
    }

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
            console.error('checkToSkip ERROR');
        }
        return false
    }

    getNextRequest() {
        let skips = 0;
        while (this.currentURLRound <= MAX_NUM_ROUNDS) {
            let requestFoundKeys = Object.keys(this.requestsFound);

            for (const key of requestFoundKeys) {
                let req = this.requestsFound[key];

                if (this.ignoreRequest(req._urlstr)) {
                    this.requestsFound[key]["attempts"] = MAX_NUM_ROUNDS;
                } else {
                    if (req["attempts"] < this.currentURLRound) {
                        if (skips < 5 && (requestFoundKeys.length - 5) > requestFoundKeys.indexOf(key) && this.checkToSkip(req["_urlstr"])) {
                            continue;
                        }
                        req["attempts"] += 1;
                        this.save();
                        console.log(`${YELLOW}[+] request data에 저장됨 : ${ENDCOLOR}` + key);
                        req["key"] = key;
                        this.currentRequest = req;
                        return req;
                    }
                }
            }
            this.currentURLRound++;
        }
        return null;
    }

    save() {
        let randomKeys = Object.keys(this.requestsFound);
        for (const key of randomKeys) {
            let req = this.requestsFound[key];
            if (req["_method"] === "POST") {
                req["response_status"] = 200;
            }
        }

        let jdata = JSON.stringify({ requestsFound: this.requestsFound, inputSet: Array.from(this.inputSet) });
        fs.writeFileSync(path.join(this.base_directory, "output/request_data.json"), jdata);
    }

    getRequestInfo() {
        let outstr = "";
        for (let value of Object.values(this.requestsFound)) {
            if (value._method === "POST") {
                outstr += `${CYAN}[${value._method}] ${value._urlstr}${ENDCOLOR}, Attempts : ${CYAN}${value.attempts}${ENDCOLOR}, PostData : ${CYAN}${value._postData}${ENDCOLOR}\n`;
                continue;
            }
            outstr += `${CYAN}[${value._method}] ${value._urlstr}${ENDCOLOR}, Attempts : ${CYAN}${value.attempts}${ENDCOLOR}\n`;
        }
        return outstr;
    }

    addRequest(fRequest) {
        try {
            let reqkey
            try {
                reqkey = fRequest.getRequestKey();
            } catch {
                console.error(`${RED}[-] reqkey ERROR. SKIPPING : ${ENDCOLOR}` + reqkey);
                return false
            }

            let allowURL = [
                "http://witcher.kro.kr/wp-admin/admin-ajax.php",
                "http://witcher.kro.kr/wp-admin/admin.php?page=zephyr_project_manager",
                "http://witcher.kro.kr/wp-admin/admin.php?page=zephyr_project_manager_projects",
                "http://witcher.kro.kr/wp-admin/admin.php?page=zephyr_project_manager_tasks",
                "http://witcher.kro.kr/wp-admin/admin.php?page=zephyr_project_manager_files",
                "http://witcher.kro.kr/wp-admin/admin.php?page=zephyr_project_manager_categories",
            ]

            // fRequest.getUrlstr()가 allowURL에 포함되어 있지 않으면 return false
            if (!allowURL.includes(fRequest.getUrlstr())) {
                console.log(`${RED}[-] NOT ALLOWED URL. SKIPPING : ${ENDCOLOR}` + fRequest.getUrlstr())
                return false;
            }

            if (reqkey in this.requestsFound) {
                return false;
            } else {
                fRequest.setId(this.getNextRequestId());
                this.collectedURL++;
                this.requestsFound[reqkey] = fRequest;

                console.log(`${GREEN}[+] URL Collected: ${ENDCOLOR}` + reqkey);
                return true;
            }
        } catch (err) {
            console.error(`${RED}[-] An error occurred while collecting URL : ${ENDCOLOR}` + err);
            return false;
        }
    }

    addInterestingRequest(foundRequest){
        let requestsAdded = 0 ;
        let tempURL = null
        try {
            tempURL = new URL(foundRequest._urlstr);
        } catch(err) {
            console.log("ERROR : tempURL is INVALID")
            return requestsAdded;
        }

        if (tempURL.pathname.match(/\.(css|jpg|gif|png|js|ico|woff2)$/)) {
            // console.log(`[*] Skipping ` + tempURL);    // TODO: 개발용으로 추가한 부분
            return requestsAdded;
        }

        let wasAdded = this.addRequest(foundRequest);
        if (wasAdded){
            requestsAdded++;
        }
        return requestsAdded;
    }

    addQueryParam(key, value) {
        let keycnt = 0;

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

    resetRequestsAttempts(key){
        console.log(`Trying to reset for ${key}`);
        this.requestsFound[key]["attempts"] = this.currentURLRound - 1;
        console.log(`RESET attempts to ${this.requestsFound[key]["attempts"]} for ${key}`)
    }
}
