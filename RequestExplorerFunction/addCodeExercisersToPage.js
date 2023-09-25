export async function addCodeExercisersToPage(gremlinsHaveStarted, usernameValue = "", passwordValue = "") {
    // ##############################################################################
    //                         START Injected Exercise Code
    // ##############################################################################

    console.log("[addCodeExercisersToPage] STARTING");
    await this.page.evaluate((gremlinsHaveStarted, usernameValue, passwordValue) => {
        window.gremlinsHaveFinished = false
        window.gremlinsHaveStarted = gremlinsHaveStarted;
        /***************************************************************************************************************************************************************************************
         ***************************************************************************************************************************************************************************************
         ***************************************************************************************************************************************************************************************
         *
         *
         * TODO:REMOVE ME!!!!
         *
         *
         ***************************************************************************************************************************************************************************************
         ***************************************************************************************************************************************************************************************/
        gremlinsHaveStarted = true;

        var formEntries = {}
        // taken from https://superuser.com/questions/455863/how-can-i-disable-javascript-popups-alerts-in-chrome
        // ==UserScript==
        // @name        Wordswithfriends, Block javascript alerts
        // @match       http://wordswithfriends.net/*
        // @run-at      document-start
        // ==/UserScript==


        function overrideSelectNativeJS_Functions() {
            console.log("[WC] ---------------- OVERRIDING window.alert ------------------------------");
            window.alert = function alert(message) {
                console.log(message);
            }
        }

        function addJS_Node(text, s_URL, funcToRun) {
            var D = document;
            var scriptNode = D.createElement('script');
            scriptNode.type = "text/javascript";
            if (text) scriptNode.textContent = text;
            if (s_URL) scriptNode.src = s_URL;
            if (funcToRun) scriptNode.textContent = '(' + funcToRun.toString() + ')()';

            var targ = D.getElementsByTagName('head')[0] || D.body || D.documentElement;
            console.log(`[WC] Alert OVERRIDE attaching script to ${targ}`);
            targ.appendChild(scriptNode);
        }

        addJS_Node(null, null, overrideSelectNativeJS_Functions);
        if (usernameValue === "") {
            usernameValue = "Witcher";
        }
        if (passwordValue === "") {
            passwordValue = "Witcher";
        }
        console.log(`[WC] usernameValue = ${usernameValue} passwordValue = ${passwordValue}`);
        const CLICK_ELE_SELECTOR = "div,li,span,input,p,button";
        //const CLICK_ELE_SELECTOR = "button";
        var usedText = new Set();
        const STARTPAGE = window.location.href;
        const MAX_LEVEL = 10;

        let today = new Date();
        let dd = String(today.getDate()).padStart(2, '0');
        let mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
        let yyyy = today.getFullYear();

        var currentDateYearFirst = `${yyyy}-${mm}-${dd}`;
        var currentDateMonthFirst = `${mm}-${dd}-${yyyy}`;

        function shuffle(array) {
            var currentIndex = array.length, temporaryValue, randomIndex;

            // While there remain elements to shuffle...
            while (0 !== currentIndex) {

                // Pick a remaining element...
                randomIndex = Math.floor(Math.random() * currentIndex);
                currentIndex -= 1;

                // And swap it with the current element.
                temporaryValue = array[currentIndex];
                array[currentIndex] = array[randomIndex];
                array[randomIndex] = temporaryValue;
            }

            return array;
        }
        function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
        function getChangedDOM(domBefore, domAfter) {
            let changedDOM = {};
            let index = 0
            for (let dbIndex of Object.keys(domBefore)) {
                let db = domBefore[dbIndex];
                let found = false;
                for (let da of domAfter) {
                    if (db === da) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    changedDOM[index] = db;
                    index++;
                }

            }
            // if domAfter larger, then add entries if not in domBefore
            for (let daIndex = Object.keys(domBefore).length; daIndex < Object.keys(domAfter).length; daIndex++) {
                let da = domAfter[daIndex];
                let found = false;
                for (let db of domBefore) {
                    if (db === da) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    changedDOM[index] = da;
                    index++;
                }
            }
            return changedDOM;
        }
        function indent(cnt) {
            let out = ""
            for (let x = 0; x < cnt; x++) {
                out += "  ";
            }
            return out;
        }
        async function clickSpam(elements, level = 0, parentClicks = []) {
            if (level >= MAX_LEVEL) {
                console.log(`[WC] ${indent(level)} L${level} too high, skipping`);
                return;
            }
            //let randomArr = shuffle(Array.from(Object.values(elements)));
            let randomArr = Array.from(Object.values(elements));
            //console.log(`[WC] ${indent(level)} L${level} Starting cliky for ${randomArr.length} elements`);
            //t randomArr = Array.from(Object.values(elements));

            let mouseEvents = ["click", "mousedown", "mouseup"];
            let eleIndex = 0;
            let startingURL = location.href;
            let startingDOM = document.querySelectorAll(CLICK_ELE_SELECTOR);
            var frames = window.frames; // or // var frames = window.parent.frames;
            let frameurls = []
            if (frames) {
                for (let i = 0; i < frames.length; i++) {
                    startingDOM = [...startingDOM, ...frames[i].document.querySelectorAll(CLICK_ELE_SELECTOR)];
                    frameurls.push(frames[i].location)
                }

                //console.log(`[WC] ${indent(level)} L${level} FOUND StartingDOM ${startingDOM.length} elements to use with curDOM not sure why not using ${elements.length}`);
            }
            //console.log(`[WC] ${indent(level)} L${level} Starting DOM selected=${startingDOM.length} Nodes toExplore=${randomArr.length} `);
            //console.log(`[WC] ${indent(level)} L${level} number of elements initially `, startingDOM.length);
            // startingDOM.filter(function (e) {
            //     return e.hasOwnProperty("hasClicker");
            // });
            function check_for_url_change_in_frames(frameurls) {
                let framediff = false;

                if (frames) {
                    for (let i = 0; i < frames.length; i++) {
                        if (frames[i].location !== frameurls[i]) {
                            framediff = true;
                            break;
                        }
                    }
                }
                return framediff;

            }
            function report_frame_changes(frameurls) {

                if (frames) {
                    for (let i = 0; i < frames.length; i++) {
                        if (frames[i].location !== frameurls[i]) {
                            console.log(`[WC] FOUND a change to frame ${i}`, frames[i].location.href);
                            console.log(`[WC-URL] ${frames[i].location}`); // report changed location to puppeteer
                        }
                    }
                }

            }

            for (let eleIndex = 0; eleIndex < randomArr.length; eleIndex++) {
                let ele = randomArr[eleIndex];
                let textout = ele.textContent.replaceAll("\n", ",").replaceAll("  ", "")

                //console.log(`[WC] ${indent(level)} L${level} attempt to click on e#${eleIndex} of ${randomArr.length} : ${textout.length} ${textout.substring(0,50)}`);
                try {
                    if (ele.href != null) {
                        console.log(`${indent(level)} L${level} FOUND URL of ${ele.href}`)
                        if (ele.href.indexOf("support.dlink.com") !== -1) {
                            console.log(`[WC] IGNORING url of FOUND URL of ${ele.href}`)
                            continue;
                        }
                    }
                    let searchText = "";
                    if (ele.outerHTML != null) {
                        searchText += ele.outerHTML;
                    }
                    if (ele.innerHTML != null) {
                        searchText += ele.innerHTML;
                    }
                    if (ele.textContent != null) {
                        searchText += ele.textContent;
                    }
                    //console.log(`ele id=${ele.id} name=${ele.name}`)
                    if (usedText.has(ele.innerHTML)) {
                        //console.log("[WC] SKIPPING B/C IT'found in usedText, ");
                        continue;
                        //return;  // not sure why it was a return that's causing it to exit the entire thing
                    }
                    let pos = searchText.indexOf("Logout");
                    if (pos > -1) {
                        console.log("[WC] SKIPPING B/C IT's a logout, ", ele.textContent);
                        continue;
                    }

                    try {
                        ele.disabled = false;
                    } catch (ex) {
                        //pass
                        console.log("[WC] ERROR WITH THE ELEMENTS CLICKING : ", ex.stack);
                    }

                    try {

                        function triggerMouseEvent(node, eventType) {
                            //console.log("usedText=", usedText, "node=", node);
                            // if
                            // if (node.textContent.indexOf("Order History") === -1 && node.textContent.indexOf("account_circle") === -1 && node.textContent.indexOf("check_circle_outline") === -1 ){
                            //     return;
                            // }
                            if (level > 1) {
                                console.log(`[WC] ${indent(level)} L${level} ${indent(level)} L${level} triggering on ${node.textContent}`)
                            }
                            //console.log("usedText=", usedText, "node=", node);
                            // if (usedText.has(node.textContent) ){
                            //     return;
                            // }

                            usedText.add(node.innerHTML);
                            let clickEvent = document.createEvent('MouseEvents');
                            clickEvent.initEvent(eventType, true, true);
                            node.dispatchEvent(clickEvent);
                            if (typeof node.click === 'function') {
                                try {
                                    node.click()
                                    // if (node.textContent){
                                    //     console.log(`[WC] ${indent(level)} L${level} Fired clicky poo -- ${node.nodeType} ${node.textContent.substring(0,20)} ${eventType}`);
                                    // } else {
                                    //     console.log(`[WC] ${indent(level)} L${level} Fired clicky poo `);
                                    // }
                                } catch (ex) {
                                    console.log(`[WC] ${indent(level)} L${level} click method threw an error ${ex}`);
                                }
                            }
                            //console.log(`[WC] ${indent(level)} L${level} DONE-TRIGGERED triggering on`, clickEvent, node, node.id, node.name, node.click);
                        }

                        for (let ev of mouseEvents) {
                            //console.log("mouse event = ", ev);
                            let mainurl = window.location.href;
                            let hiddenChildren = [];
                            for (clickablechild of startingDOM) {
                                if (clickablechild.offsetParent === null) {
                                    hiddenChildren.push(clickablechild)
                                }
                            }

                            //console.log(`[WC] ${indent(level)} L${level} HIDDEN CHILDREN at start = ${hiddenChildren.length}`)

                            triggerMouseEvent(ele, ev);

                            await sleep(50);

                            let mainurl_changed = mainurl !== window.location.href
                            if (mainurl_changed || check_for_url_change_in_frames(frameurls)) {
                                // bubble up URL for change
                                if (mainurl_changed) {
                                    console.log(`[WC] ${indent(level)} L${level} FOUND a change to main frame `, mainurl, window.location.href);
                                    console.log(`[WC-URL]${window.location.href}`);
                                } else {
                                    report_frame_changes(frameurls)
                                }
                                // reload main frame
                                await window.location.replace(main);
                                // retrigger parents after reload to show the children
                                for (let pc of parentClicks) {
                                    //console.log (`[WC] ${indent(level)} retriggering ${pc.textContent}`);
                                    triggerMouseEvent(pc, "click");
                                }
                            }

                            let curDOM = document.querySelectorAll(CLICK_ELE_SELECTOR);
                            if (frames) {
                                for (let i = 0; i < frames.length; i++) {
                                    curDOM = [...curDOM, ...frames[i].document.querySelectorAll(CLICK_ELE_SELECTOR)];
                                }
                                //console.log(`[WC] ${indent(level)} L${level} FOUND ${curDOM.length}  curkeys=${Object.keys(curDOM).length} startkey=${Object.keys(startingDOM).length} `);
                            }
                            let newlyVisibleLinks = []
                            for (child of hiddenChildren) {
                                if (child.offsetParent !== null) {
                                    try {
                                        let newvislinks = ""
                                        for (let subc of child.querySelectorAll(CLICK_ELE_SELECTOR)) {
                                            if (subc.offsetParent === null) {
                                                newvislinks += subc.textContent + ", ";
                                            }
                                        }
                                        if (nawvislink.length === 0) {
                                            newvislinks = child.textContent.replace("\n", ",").replace(" ", "");
                                        }
                                        console.log(`[WC] ${indent(level)} L${level} after clicking on ${ele.textContent} adding newly visible link ${newvislinks} `);

                                    } catch (eex) {
                                        console.log("[WC] Error with finding newly visible link ", eex.stack);
                                    }
                                    newlyVisibleLinks.push(child);
                                }
                            }
                            if (newlyVisibleLinks.length > 0) {
                                console.log(`[WC] ${indent(level)} L${level} click on ${ele.textContent} showed ${newlyVisibleLinks.length} new links, recursing the new links`);
                                parentClicks.push(ele);
                                await clickSpam(newlyVisibleLinks, level + 1, parentClicks)
                            }

                            // have we added any clickable items that we need to now clicky?
                            if (Object.keys(curDOM).length !== Object.keys(startingDOM).length && Object.keys(curDOM).length > 0) {
                                console.log(`[WC] maybe some difference here`)
                                var changedDOM = getChangedDOM(startingDOM, curDOM);
                                console.log(`[WC] ${indent(level)} ${level} starting len = ${Object.keys(elements).length} cur len = ${Object.keys(curDOM).length} changed len=${Object.keys(changedDOM).length}`);
                                /*for (let cd of Object.keys(changedDOM)){
                                    console.log(`[WC] ${indent(level+1)} changedDOM #${cd} ${changedDOM[cd].textContent}`);
                                }*/
                                parentClicks.push(ele);
                                console.log(`[WC] ${indent(level)} L${level} recursing into the next level of ${ele.textContent}`);
                                await clickSpam(changedDOM, level + 1, parentClicks);
                                // this resets DOM??
                                location.href = startingURL;
                                //startingDOM = document.querySelectorAll("div,li,span,a,input,p,button");

                                // can break by assuming that DOM change means event was heard.
                                break;
                            } else {
                                //console.log(`[WC] ${indent(level)} ${level} ${Object.keys(startingDOM).length} ${Object.keys(curDOM).length}`)
                            }

                        }
                        await sleep(50);


                    } catch (e2) {
                        console.trace("[WC] NO CLICK, ERROR ", e2.message);
                        if (e2.stack) {
                            console.log("[WC] ", e2.stack);
                        } else {
                            console.log("[WC] Stack is unavailable to print");
                        }

                    }

                    // if (typeof ele.click === 'function') {
                    //
                    //     console.log("\tLOG gremlin click all_clicker ", cnt );
                    //     console.log("\tLOG gremlin click all_clicker ", cnt );
                    //     //ele.click();
                    //     //await sleep(100);
                    // } else {
                    //     console.log("\tNO CLICK ");
                    // }

                } catch (e) {
                    console.trace("[WC] ERROR WITH THE ELEMENTS CLICKING ", e.message);
                    if (e.stack) {
                        console.log("[WC] ", e.stack);
                    } else {
                        console.log("[WC] Stack is unavailable to print");
                    }
                }

            } //end for loop eleIndex
        }


        async function checkHordeLoad() {
            if (typeof window.gremlins === 'undefined') {
                console.log("cannot find gremlins, attempting to load on the fly");
                (function (d, script) {
                    script = d.createElement('script');
                    script.type = 'text/javascript';
                    script.async = true;
                    script.onload = function () {
                        // remote script has loaded
                    };
                    script.src = 'https://trickel.com/gremlins.min.js';
                    //script.src = 'https://unpkg.com/gremlins.js';
                    d.getElementsByTagName('head')[0].appendChild(script);
                }(document));
            }
        }
        async function repeativeHorde() {

            let all_submitable = [...document.getElementsByTagName("form"),
            ...document.querySelectorAll('[type="submit"]')];

            //let randomArr = shuffle(all_submitable);
            let randomArr = all_submitable;

            for (let i = 0; i < all_submitable.length; i++) {
                let submitable_item = randomArr[i];
                if (typeof submitable_item.submit === 'function') {
                    submitable_item.submit();
                } else if (typeof submitable_item.requestSubmit === 'function') {
                    try {
                        submitable_item.requestSubmit();
                    } catch (e) {
                        console.trace(`[WC] Error while trying to request submit`);
                        console.log(e.stack)
                    }
                }
                if (typeof submitable_item.click === 'function') {
                    submitable_item.click()
                }
            }
        }
        async function submitForms(doc) {
            let pforms = document.getElementsByTagName("form");
            for (let i = 0; i < pforms.length; i++) {
                let frm = pforms[i];
                if (typeof frm.submit === 'function') {
                    console.log("Submitting a form");
                    frm.submit();
                } else if (typeof frm.submit === 'undefined') {
                    console.log("[WC] lameHorde: The method submit of ", frm, "is undefined");
                } else {
                    //console.log("[WC] lameHorde: It's neither undefined nor a function. It's a " + typeof frm.submit, frm);
                }
            }
        }

        async function lameHorde() {

            console.log("[WC] Searching and clicking.");
            window.alert = function (message) {/*console.log(`Intercepted alert with '${message}' `)*/ };

            let all_elements = document.querySelectorAll(CLICK_ELE_SELECTOR);
            var frames = window.frames; // or // var frames = window.parent.frames;
            if (frames) {
                console.log(`[WC] FOUND ${all_elements.length} elements to attempt to click in main `);
                for (let i = 0; i < frames.length; i++) {
                    all_elements = [...all_elements, ...frames[i].document.querySelectorAll(CLICK_ELE_SELECTOR)];
                }
            }
            for (let ele of document.querySelectorAll("iframe")) {
                all_elements = [...all_elements, ...ele.contentWindow.document.querySelectorAll(CLICK_ELE_SELECTOR)];
            }

            console.log(`[WC] FOUND after FRAMES ${all_elements.length} elements to attempt to click in main `);

            function hashChangeEncountered() {
                alert('got hashchange');
            }
            window.addEventListener("hashchange", hashChangeEncountered);
            var filter = Array.prototype.filter;
            var clickableElements = filter.call(all_elements, function (node) {
                if (node.hasOwnProperty("href") && node.href.startsWith("http")) {
                    return false;
                }
                return node.hasOwnProperty('hasClicker');
            });
            console.log("[WC] clicky  DOM elements count = ", clickableElements.length);

            //await clickSpam(clickableElements);
            await clickSpam(all_elements);

            await submitForms(document);
            if (frames) {
                for (let i = 0; i < frames.length; i++) {
                    console.log(`[WC] Submit forms ${frames[i].location.href}`)
                    submitForms(frames[i].document);
                }
            }

            //
            console.log(`[WC] lamehorde is done.`);
            clearTimeout(checkHordeLoad)
            clearTimeout(coolHorde);
            checkHordeLoad();
            setTimeout(coolHorde, 1000);

        }
        function randr(a) {
            return function () {
                var t = a += 0x6D2B79F5;
                t = Math.imul(t ^ t >>> 15, t | 1);
                t ^= t + Math.imul(t ^ t >>> 7, t | 61);
                return ((t ^ t >>> 14) >>> 0) / 4294967296;
            }
        }

        async function triggerHorde() {
            try {
                let select_elems = document.querySelectorAll("select");
                for (let i = 0; i < select_elems.length; i++) {
                    var event = new Event('change');
                    select_elems[i].dispatchEvent(event);
                    await sleep(100);
                    select_elems[i].selectedIndex = 1
                }
            } catch (ex) {
                console.trace(`ERROR with selecting either change or selected Index in triggerHorde() ${ex}`)
                console.log(ex.stack)
            }
        }
        var randomizer = new gremlins.Chance();
        const triggerSimulatedOnChange = (element, newValue, prototype) => {
            const lastValue = element.value;
            element.value = newValue;

            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value').set;
            nativeInputValueSetter.call(element, newValue);
            const event = new Event('input', { bubbles: true });

            // React 15
            event.simulated = true;
            // React >= 16
            let tracker = element._valueTracker;
            if (tracker) {
                tracker.setValue(lastValue);
            }
            element.dispatchEvent(event);
        };
        const fillTextAreaElement = (element) => {
            let rnd = Math.random();
            let value = "2";
            if (rnd > 0.7) {
                value = "Witcher";
            } else if (rnd > 0.3) {
                value = "127.0.0.1";
            }
            triggerSimulatedOnChange(element, value, window.HTMLTextAreaElement.prototype);

            return value;
        };

        const fillNumberElement = (element) => {
            const number = randomizer.character({ pool: '0123456789' });
            const newValue = element.value + number;
            triggerSimulatedOnChange(element, newValue, window.HTMLInputElement.prototype);

            return number;
        };

        const fillSelect = (element) => {
            const options = element.querySelectorAll('option');
            if (options.length === 0) return;
            const randomOption = randomizer.pick(options);
            options.forEach((option) => {
                option.selected = option.value === randomOption.value;
            });

            //console.log(`[WC] element = ${element}`);
            var event = new Event('change');
            element.dispatchEvent(event);
            // let jelem = $(element);
            // jelem.trigger("change");

            return randomOption.value;
        };

        const fillRadio = (element) => {
            // using mouse events to trigger listeners
            const evt = document.createEvent('MouseEvents');
            evt.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
            element.dispatchEvent(evt);

            return element.value;
        };

        const fillCheckbox = (element) => {
            // using mouse events to trigger listeners
            const evt = document.createEvent('MouseEvents');
            evt.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
            element.dispatchEvent(evt);

            return element.value;
        };

        const fillEmail = (element) => {
            const email = "test@test.com";
            triggerSimulatedOnChange(element, email, window.HTMLInputElement.prototype);

            return email;
        };
        const fillTextElement = (element) => {
            if (!element) {
                console.log(`[WC] Element is null?????`)
                return 0;
            }
            let oldDateYearFirst = "1998-10-11";
            let oldDateMonthFirst = "11-12-1997";

            let rnd = Math.random()
            let current_value = element.value;
            let desc = element.id;
            if (!desc) {
                desc = element.name;
            }
            // let's leave it the default value for a little while.
            if (current_value && current_value > "" && desc > "") {
                if (desc in formEntries) {
                    if (formEntries[desc]["inc"] < 5) {
                        formEntries[desc]["inc"] += 1;
                        return current_value;
                    }
                } else {
                    formEntries[desc] = { origingal_value: current_value, inc: 1 };

                    return current_value;
                }
            }

            let value = "2";

            if (rnd > .2 && element.placeholder && (element.placeholder.match(/[Yy]{4}.[Mm]{2}.[Dd]{2}/) || element.placeholder.match(/[Mm]{2}.[Dd]{2}.[Yy]{4}/))) {
                let yearfirst = element.placeholder.match(/[Yy]{4}(.)[Mm]{2}.[Dd]{2}/);
                let sep = "-";
                if (yearfirst)
                    sep = yearfirst[1]
                else {
                    let monthfirst = element.placeholder.match(/[Mm]{2}(.)[Dd]{2}.[Yy]{4}/)
                    if (monthfirst) {
                        sep = monthfirst[1];
                    } else {
                        console.log("[WC] this should never occur, couldn't find the separator, defaulting to -")
                    }
                }

                if (element.placeholder.match(/[Yy]{4}.[Mm]{2}.[Dd]{2}/)) {
                    value = rnd > .8 ? currentDateYearFirst.replace("-", sep) : oldDateYearFirst.replace("-", sep);
                } else if (element.placeholder.match(/[Mm]{2}.[Dd]{2}.[Yy]{4}/)) {
                    value = rnd > .8 ? currentDateMonthFirst.replace("-", sep) : oldDateMonthFirst.replace("-", sep);
                }
            } else if (rnd > .5 && element.name && (element.name.search(/dob/i) !== -1 || element.name.search(/birth/i) !== -1)) {
                value = rnd > .75 ? oldDateMonthFirst : oldDateYearFirst;
            } else if (rnd > .5 && element.name && (element.name.search(/date/i) !== -1)) {
                value = rnd > .75 ? currentDateMonthFirst : currentDateYearFirst;
            } else if (rnd > .5 && element.name && (element.name.search(/time/i) !== -1)) {
                value = element.name.search(/start/i) !== -1 ? "8:01" : "11:11";
            } else if (rnd > 0.4) {
                value = "127.0.0.1";
            } else if (rnd > .3) {
                value = usernameValue.substring(0, 1) + "'" + usernameValue.substring(2);
            } else if (rnd > 0.2) {
                value = value = rnd > .35 ? currentDateYearFirst : oldDateYearFirst;
            } else if (rnd > 0.1) {
                value = rnd > .45 ? currentDateYearFirst : oldDateYearFirst;
            } else if (rnd > 0.0) {
                //value = value;
                value = current_value;
            }
            element.value = value;
            if (Math.random() > 0.80) {
                repeativeHorde();
            }
            return value;
        };
        const fillPassword = (element) => {
            let rnd = Math.random()
            if (rnd < 0.8) {
                element.value = passwordValue;
            } else {
                element.value = passwordValue.replace("t", "'");
            }
            return element.value;
        };
        const clickSub = (element) => {
            element.click();
            return element.value
        }
        var wFormElementMapTypes = {
            textarea: fillTextAreaElement,
            'input[type="text"]': fillTextElement,
            'input[type="password"]': fillPassword,
            'input[type="number"]': fillNumberElement,
            select: fillSelect,
            'input[type="radio"]': fillRadio,
            'input[type="checkbox"]': fillCheckbox,
            'input[type="email"]': fillEmail,
            'input[type="submit"]': clickSub,
            'button': clickSub,
            'input:not([type])': fillTextElement,
        }
        async function coolHorde() {
            // setTimeout(()=>{
            //     window.gremlinsHaveFinished=true
            //     clearInterval(repeativeHorde);
            //     clearInterval(triggerHorde);
            // }, 20000);

            var noChance = new gremlins.Chance();
            //noChance.prototype.bool = function(options) {return true;};
            noChance.character = function (options) {
                if (options != null) {
                    return "2";
                } else {
                    let rnd = Math.random()
                    if (rnd > 0.7) {
                        return usernameValue;
                    } else if (rnd > 0.3) {
                        return "127.0.0.1";
                    } else {
                        return "2"
                    }
                }
            };

            if (!gremlinsHaveStarted) {
                console.log("[coolHorde] UNLEASHING Horde for first time!!!");
            }
            window.gremlinsHaveStarted = true;
            let ff = window.gremlins.species.formFiller({ elementMapTypes: wFormElementMapTypes, randomizer: noChance });
            const distributionStrategy = gremlins.strategies.distribution({
                distribution: [0.80, 0.15, 0.05], // the first three gremlins have more chances to be executed than the last
                delay: 20,
            });

            for (let i = 0; i < 5; i++) {
                console.log("[coolHorde] Form Horde away!")
                await gremlins.createHorde({
                    species: [ff],
                    mogwais: [gremlins.mogwais.alert(), gremlins.mogwais.gizmo()],
                    strategies: [gremlins.strategies.allTogether({ nb: 1000 })],
                    randomizer: noChance
                }).unleash();
                await gremlins.createHorde({
                    species: [gremlins.species.clicker(), ff, gremlins.species.scroller()],
                    mogwais: [gremlins.mogwais.alert(), gremlins.mogwais.gizmo()],
                    strategies: [distributionStrategy],
                    randomizer: noChance
                }).unleash();
                try {
                    await gremlins.createHorde({
                        species: [gremlins.species.clicker(), gremlins.species.typer()],
                        mogwais: [gremlins.mogwais.alert(), gremlins.mogwais.gizmo()],
                        strategies: [gremlins.strategies.allTogether({ nb: 1000 })],
                        randomizer: noChance
                    }).unleash();
                } catch (e) {
                    console.log(`\x1b[38;5;8m${e}\x1b[0m`);
                }
            }
            window.gremlinsHaveFinished = true
            clearInterval(repeativeHorde);
            clearInterval(triggerHorde);
        }

        try {
            if (gremlinsHaveStarted) {
                console.log("[WC] Restarted Page -- going with Gremlins only")
                if (typeof window.gremlins === 'undefined') {
                    setTimeout(checkHordeLoad, 3500);
                    setTimeout(coolHorde, 4000);
                } else {
                    coolHorde();
                }
                //setTimeout(function(){setInterval(repeativeHorde, 5000)}, 20000);
                //setTimeout(function(){setInterval(triggerHorde, 1000)}, 5000);
            } else {
                console.log("[WC] Initial Page Test -- using lameHorde then coolHorde")
                setTimeout(lameHorde, 2000);
                // setTimeout(function(){setInterval(repeativeHorde, 500)}, 3000);
                // setTimeout(function(){setInterval(triggerHorde, 1000)}, 5000);
                setTimeout(checkHordeLoad, 19000);
                setTimeout(coolHorde, 20000);
            }

            function hc() {
                console.log(`[WC] Detected HASH CHANGE, replacing ${window.location.href} with ${STARTPAGE}`);
                window.location.replace(STARTPAGE);
            }

            window.onhashchange = hc
        } catch (e) {
            console.log("[WC] Error occurred in browser", e)
        }
    }, gremlinsHaveStarted, usernameValue, passwordValue);

    // ##############################################################################
    //                         END Injected Exercise Code
    // ##############################################################################
}