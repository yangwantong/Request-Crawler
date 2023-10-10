import process from 'process'

import { GREEN, BLUE, YELLOW, ENDCOLOR } from './common/utils.js';

const explorationWorker = (appData) => {

}

const startExploration = (appData) => {
    explorationWorker(appData);

    console.log(`${BLUE}[INFO] Current URL Round: ${ENDCOLOR}` + appData.currentURLRound);
    console.log(appData.getRequestInfo());
}

if (process.argv.length > 2) {
    let BASE_SITE = process.argv[2];    // 사이트 명
    let BASE_APPDIR = process.cwd();  // witcher_config.json이 있는 디렉토리
    let headless = true;
    let appData = null;

    console.log(`${GREEN}[+] Target Site: ${ENDCOLOR}` + BASE_SITE);
    console.log(`${GREEN}[+] Headless: ${ENDCOLOR}` + headless);

    if (process.argv[4] === '--no-headless') {
        headless = false;
    }

    appData = new appData(BASE_SITE, BASE_APPDIR, headless);
    startExploration(appData);

} else {
    console.log('Usage: node main.js <target_site> [--no-headless]');
    process.exit(1);
}