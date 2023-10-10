import { FoundRequest } from './FoundRequest.js';
import { GREEN, RED, ENDCOLOR } from './common/utils.js';

export class AppData {
    constructor(base_appdir, base_site, headless) {
        this.base_appdir = base_appdir;
        this.site_url = new URL(base_site);
        this.headless = headless;
        this.collectedURL = 0;

        if (!this.loadReqsFromJSON()) {
            this.addRequest(new FoundRequest(this.site_url.href, resourceType = "initial", this.site_url.href));
        }
    }

    /**
     * request_data.json 파일 로드 
     * @returns {boolean}    파일이 존재하면 true, 존재하지 않으면 false 반환
     */
    loadReqsFromJSON() {
        let json_fn = path.join(this.base_appdir, "output/request_data.json");

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
            }
            return true
        }
        console.log(`${BLUE}[INFO] Not founded request_data.json.${ENDCOLOR}`)
        return false;
    }

    /**
     * 현재 수집된 URL의 개수를 반환하는 함수
     * @returns {string} : 현재 수집된 URL의 개수를 반환
     */
    nextRequestId() {
        return Object.keys(this.requestsFound).length + 1
    }

    /**
     * URL을 Request list에 추가하는 함수
     * @param {*} fRequest : FoundRequest 클래스
     * @returns {boolean} : requestsFound에 추가되면 true, 추가되지 않으면 false 반환
     */
    addRequest(fRequest) {
        try {
            let reqkey = fRequest.getRequestKey();

            if (reqkey in this.requestsFound) {
                return false;
            } else {
                fRequest.setId(this.nextRequestId())
                this.collectedURL++
                this.requestsFound[reqkey] = fRequest

                console.log(`${GREEN}[CRALWER] URL Collected: ${ENDCOLOR}` + reqkey);
                return true;
            }
        } catch (err) {
            console.log(`${RED}[ERROR] An error occurred while collecting URL : ${ENDCOLOR}` + err);
            return false;
        }
    }
}