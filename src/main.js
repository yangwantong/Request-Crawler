import process from 'process'
import fs from 'fs'
import path from 'path'

import { GREEN, BLUE, ENDCOLOR } from './common/utils.js'
import { AppData } from './helpers/AppData.js'
import { RequestExplorer } from "./helpers/RequestExplorer.js"

const BASE_DIRECTORY = process.cwd();
const startExploration = async (appData) => {
    let nextRequest = appData.getNextRequest()

    // console.log(`\n\n${BLUE}[+] Current URL Round: ${ENDCOLOR}` + appData.getCurrentURLRound())

    while(nextRequest) {
        console.log('\n\n======================Founded Request List======================')
        console.log(appData.getRequestInfo())
        console.log('===============================================================')

        let re = new RequestExplorer(appData, BASE_DIRECTORY, nextRequest)
        console.log(`${BLUE}[+] Current Crawling URL : ${ENDCOLOR}` + appData.getCurrentRequestURL())
        await re.start()
        // console.log(`${BLUE}[+] Completed Crawling URL :  ${ENDCOLOR}` + appData.getCurrentRequestURL() + '\n\n')
        console.log(`${BLUE}[+] Collected Unique URL : ${ENDCOLOR}` + appData.getCollectedURLCount() + '\n\n')
        nextRequest = appData.getNextRequest()
    }
}

if (process.argv.length > 2) {
    let BASE_SITE = process.argv[2]
    let headless = 'new'

    console.log('======================Crawling Options======================')
    console.log(`${GREEN}[+] Target Site: ${ENDCOLOR}` + BASE_SITE)
    console.log(`${GREEN}[+] Headless: ${ENDCOLOR}` + headless)
    console.log('===============================================================\n\n')

    if (process.argv[3] === '--no-headless') {
        headless = false
    }

    if (!fs.existsSync(path.join(BASE_DIRECTORY, "output"))) {
        fs.mkdirSync(path.join(BASE_DIRECTORY, "output"))
    }

    if (!fs.existsSync(path.join(BASE_DIRECTORY, "output", "screenshots"))) {
        fs.mkdirSync(path.join(BASE_DIRECTORY, "output", "screenshots"))
    }

    await startExploration(new AppData(BASE_DIRECTORY, BASE_SITE, headless))

} else {
    console.log('Usage: node main.js <target_site> [--no-headless]')
    process.exit(1)
}