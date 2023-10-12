import process from 'process'
import fs from 'fs'
import path from 'path'

import { GREEN, BLUE, ENDCOLOR } from './common/utils.js'
import { AppData } from './helpers/AppData.js'
import { RequestExplorer } from "./helpers/RequestExplorer.js"

const BASE_APPDIR = process.cwd();
const startExploration = async (appData) => {
    let nextRequest = appData.getNextRequest()

    console.log(`\n\n${BLUE}[+] Current URL Round: ${ENDCOLOR}` + appData.getCurrentURLRound())
    console.log('======================Request Information======================')
    console.log(appData.getRequestInfo())
    console.log('===============================================================')

    while(nextRequest) {
        let re = new RequestExplorer(appData, BASE_APPDIR, nextRequest)
        await re.start()

        console.log(`${BLUE}[+] Completed Crawling URL :  ${ENDCOLOR}` + appData.getCurrentRequestURL() + '\n\n')
        nextRequest = appData.getNextRequest()
    }
}

if (process.argv.length > 2) {
    let BASE_SITE = process.argv[2]
    let headless = 'new'

    console.log(`${GREEN}[+] Target Site: ${ENDCOLOR}` + BASE_SITE)
    console.log(`${GREEN}[+] Headless: ${ENDCOLOR}` + headless)

    if (process.argv[4] === '--no-headless') {
        // TODO: headless와 관련된 설정은 아직 구현되지 않음
        // headless = false
    }

    if (!fs.existsSync(path.join(BASE_APPDIR, "output"))) {
        fs.mkdirSync(path.join(BASE_APPDIR, "output"))
    }

    if (!fs.existsSync(path.join(BASE_APPDIR, "output", "screenshots"))) {
        fs.mkdirSync(path.join(BASE_APPDIR, "output", "screenshots"))
    }

    startExploration(new AppData(BASE_APPDIR, BASE_SITE, headless))

} else {
    console.log('Usage: node main.js <target_site> [--no-headless]')
    process.exit(1)
}