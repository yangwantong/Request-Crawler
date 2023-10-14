import {ENDCOLOR, GREEN, RED} from "../common/utils.js";
import { FoundRequest } from "./FoundRequest.js";
import {RequestExplorer} from "./RequestExplorer.js";

const checkURLs = async (re, hrefs) => {
    let tempPage = await re.browser.newPage();
    // let interestingURL = new Set();
    tempPage.setCacheEnabled(false)
    tempPage.setRequestInterception(true);
    tempPage.on('dialog', async dialog => {
        await dialog.dismiss();
    })
    tempPage.on('request', (req) => {
        let tempURL = new URL(req.url())
        if (!tempURL.pathname.toLowerCase().match(/\.(css|jpg|gif|png|js|ico|woff2)$/) && re.appData.site_url.origin === tempURL.origin) {
            // interestingURL.add(req.url())
            let foundRequest = new FoundRequest(req.url(), req.method(), req.postData(), req.headers(), req.resourceType(), re.appData.site_url.href)
            foundRequest.setFrom("depth1")
            for (let [pkey, pvalue] of Object.entries(foundRequest.getAllParams())) {
                if (typeof pvalue === "object") {
                    pvalue = pvalue.values().next().value;
                }
                re.appData.addQueryParam(pkey, pvalue);
            }
            if (re.appData.addInterestingRequest(foundRequest) > 0) {
                re.increaseRequestAdded()
            }
        }
        req.continue()
    })
    re.browser.on('targetchanged', async target => {
        // console.log('target CHANGED!!')
    })
    // let count = 0
    for (let i = 0; i < hrefs.length; i++) {
        let href = hrefs[i];
        try {
            // console.log(`${GREEN}[+] Founded Unique URL is Testing...${ENDCOLOR} (${i + 1}/${hrefs.length})`);
            await tempPage.goto(href, { timeout: 20000, waitUntil: "networkidle2" });
            // await tempPage.screenshot({ path: base_directory + `/output/screenshots/${count}.png` });
            // count += 1
            // console.log("=====================================\n\n")
        } catch (err) {
            console.error(`${RED}[-] An error occurred while crawling URL: ${ENDCOLOR}` + href);
        }
    }
}

export const ExerciseTargetPage = async (re) => {
    await re.page.goto(re.url, { timeout: 20000, waitUntil: "networkidle2" })

    await re.page.screenshot({ path : re.base_directory + `/output/screenshots/currentPage.png` });

    const hrefs = await re.page.$$eval('a', anchors => {
        let hrefs = anchors.map(anchor => anchor.href);
        return [...new Set(hrefs)];
    });

    // console.log("\n\n================== Parsing hrefs ==================")
    // console.log(hrefs);
    // console.log("===================================================\n\n")

    await checkURLs(re, hrefs);
}