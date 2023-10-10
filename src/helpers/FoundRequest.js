import { isDefined } from '../common/utils.js'

export class FoundRequest {
    constructor(
        urlstr = "",
        method = "GET",
        postData = "",
        headers = {},
        resourceType = "UNK TYPE",
        site_url = "http://localhost/"
    ) {
        this._id = -1
        this._urlstr = urlstr.startsWith("http://") || urlstr.startsWith("https://") ? urlstr : site_url + urlstr;
        this._method = method.toUpperCase()
        this._postData = postData
        this._headers = headers
        this._resourceType = resourceType
        this.multipleParamKeys = new Set()
        this._url = new URL(this._urlstr)
        this.attempts = 0
        this.processed = 0
        this.from = ""
        this.cleanURLParamRepeats()
        this.cleanPostDataRepeats()
    }

    incTimesProcessed() {
        this.processed++;
    }
    setId(newid) {
        this._id = newid;
    }
    getTimesProcessed() {
        return this.processed;
    }
    getUrlstr() {
        return this._urlstr;
    }
    getURL() {
        return typeof this._url === "string" ? (this._url = new URL(this._urlstr)) : this._url;
    }
    getRequestKey = () => {
        return `${this._method} ${this.getURL().href} ${this._postData}`
    }
    isSaveable() {
        return this._urlstr.length > 3;
    }
    getResourceType() {
        return this._resourceType;
    }
    getMethod() {
        return this._method;
    }
    getPostData() {
        return this._postData;
    }
    getHeaders() {
        return this._headers;
    }
    getPathname() {
        return this.getURL().pathname;
    }
    getQueryString() {
        return this.getURL().search.substring(1);
    }
    addParams(params) {
        if (this._method === "POST") {
            this._postData = params;
            this.cleanPostDataRepeats();
        } else {
            if (this._urlstr.indexOf("?") > -1) {
                this._urlstr += `&${params}`;
            } else {
                this._urlstr += `?${params}`;
            }
            this._url = new URL(this._urlstr);
            this.cleanURLParamRepeats();
        }
    }
    cookieData() {
        let cookie = this._headers["cookie"];
        if (isDefined(cookie)) {
            return cookie;
        }
        cookie = this._headers["COOKIE"];
        if (isDefined(cookie)) {
            return cookie;
        }
        return "";
    }
    getContentType() {
        let content_type = "";
        if (typeof this._headers === "object") {
            if (isDefined(this._headers["content-type"])) {
                content_type = this._headers["content-type"]
            }
        }
        return content_type;
    }
    cleanURLParamRepeats() {
        if (!this._url.search && this._urlstr.search("#.*[?]") > -1) {
            this._urlstr = this._urlstr.replace(/([Q2])[Q2]+/g, "$1")
            this._url = new URL(this._urlstr);
        } else {
            this._url.search = this._url.search.replace(/([Q2])[Q2]+/g, "$1")
            this._urlstr = this._url.href;
        }
    }

    cleanPostDataRepeats() {
        if (this._postData === "" || this._postData.startsWith('<?xml')) {
            return;
        }
        const boundryIndex = this.getContentType().indexOf("----WebKitFormBoundary");
        if (boundryIndex > -1) {
            const WEBKIT_BOUNDRY = "----WebKitFormBoundary0123456789ABCDEF";
            const targetBoundary = this.getContentType().slice(boundryIndex);
            this._headers["content-type"] = this._headers["content-type"].replace(targetBoundary, WEBKIT_BOUNDRY);
            this._postData = this._postData.replace(targetBoundary, WEBKIT_BOUNDRY);
        }
        let postArray = [];
        if (this.getContentType().indexOf("application/json") > -1) {
            let jdata = JSON.parse(this._postData)
            for (const [key, value] of Object.entries(jdata)) {
                postArray.push(`${key}=${value}`);
            }
        } else {
            if (this._postData) {
                postArray = this._postData.split("&");
            }

        }
        let newPostData = "";
        for (let p of postArray) {
            let { key, value } = this.extractKeyValue(p);
            value = value.replace(/([Q2])[Q2]+/g, "$1")
            newPostData += `&${key}=${value}`;
        }

        newPostData = newPostData.slice(1);
        if (newPostData) {
            this._postData = newPostData;
        }

    }
    extractKeyValue(p) {
        let key = p;
        let value = "";
        if (p.indexOf("=") > -1) {
            let temparr = p.split("=");
            key = temparr[0];
            value = temparr[1];
        }
        return { key: key, value: value };
    }

    getAllParams() {
        let queryString = this.getQueryString();
        let postData = this._postData;
        let builtParams = {};
        let plist = [];
        if (!this.multipleParamKeys) {
            this.multipleParamKeys = new Set();
        } else if (!(this.multipleParamKeys instanceof Set)) {
            if (this.multipleParamKeys instanceof Array) {
                this.multipleParamKeys = new Set(this.multipleParamKeys);
            } else if (this.multipleParamKeys instanceof Object) {
                this.multipleParamKeys = new Set(Object.keys(this.multipleParamKeys));
            }
        }

        if (isDefined(queryString) && queryString.length > 0) {
            plist = queryString.split("&");
        }
        if (isDefined(postData) && postData.length > 0) {
            plist = [...plist, ...postData.split("&")];
        }
        for (let p of plist) {
            let { key, value } = this.extractKeyValue(p);
            if (p.length > 0) {
                if (key in builtParams) {
                    builtParams[key].add(value);
                    this.multipleParamKeys.add(key)
                } else {
                    builtParams[key] = new Set([value]);
                }
            }
        }
        return builtParams;
    }
}