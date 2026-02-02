
let gptquery = ""
let bardquery = ""
let bardFirstAns = ""
let gptFirstAns = ""
const targetLocation = window.location.hostname
const selectors = ['.GyAeWb', '#b_context', '#right', '[data-area="sidebar"]', '#content_right', '.content__right', '.kix-appview-editor-container']
let bard_conv_id = { Cval: "", Rval: "", RCval: "" }
let hideChatMode = true
let gptResponseCopy = false
let bardMultipleMsg = false

const getImageUrl = (name) => chrome.runtime.getURL(`static/images/${name}`)

const IMAGES = {
    bardGptLogo: getImageUrl("bardGptLogo.svg"),
    bardGptLogoWhite: getImageUrl("bardGptLogowhite.svg"),
    lightmoon: getImageUrl("lightmoon.svg"),
    darkmoon: getImageUrl("darkmoon.svg"),
    copyIcon: getImageUrl("copyIcon.svg"),
    copyIconDark: getImageUrl("copyIconDark.svg"),
    gptLogo: getImageUrl("gptLogo.svg"),
    bardLogo: getImageUrl("bardLogo.svg"),
    chatIcon: getImageUrl("chatIcon.svg"),
    ratingStar: getImageUrl("ratingStar.svg"),
    enterIcon: getImageUrl("enterIcon.svg"),
    infoIcon: getImageUrl("info.png"),
    logoIcon: getImageUrl("icon 64.png"),
    closeIcon: getImageUrl("closeIcon.png"),
    bardSideIcon: getImageUrl("bardSideIcon.svg"),
    sideExpandIcon: getImageUrl("sideExpandIcon.svg"),
    sidebarIconDark: getImageUrl("sidebarIconDark.svg"),
    sidebarIconLight: getImageUrl("sidebarIconLight.svg"),
    startBtnIcon: getImageUrl("startBtn.svg"),
    stopBtnIcon: getImageUrl("stopBtn.svg")
}

const bardGptLogo = IMAGES.bardGptLogo
const bardGptLogoWhite = IMAGES.bardGptLogoWhite
const lightmoon = IMAGES.lightmoon
const darkmoon = IMAGES.darkmoon
const copyIcon = IMAGES.copyIcon
const copyIconDark = IMAGES.copyIconDark
const gptLogo = IMAGES.gptLogo
const bardLogo = IMAGES.bardLogo
const chatIcon = IMAGES.chatIcon
const ratingStar = IMAGES.ratingStar
const enterIcon = IMAGES.enterIcon
const infoIcon = IMAGES.infoIcon
const bardSideIcon = IMAGES.bardSideIcon
const sideExpandIcon = IMAGES.sideExpandIcon
const startBtnIcon = IMAGES.startBtnIcon
const stopBtnIcon = IMAGES.stopBtnIcon

const SEARCH_ENGINES = ['www.google.', 'www.bing.', 'search.yahoo.', 'duckduckgo.', 'www.baidu.', 'yandex.']
const isSearchEngine = () => SEARCH_ENGINES.some(engine => targetLocation.includes(engine))
const isGoogleDocs = () => targetLocation.includes('docs.google.')

const createElement = (tag, attrs = {}, parent = null) => {
    const el = document.createElement(tag)
    Object.entries(attrs).forEach(([key, value]) => {
        if (key === 'text') el.innerText = value
        else if (key === 'html') el.innerHTML = value
        else el.setAttribute(key, value)
    })
    if (parent) parent.appendChild(el)
    return el
}

const $ = (id) => document.getElementById(id)

const bard_key_func = () => {
    const bard_interval = setInterval(() => {
        let bard_key = document.querySelector('[data-id="_gd"]')
        if (bard_key) {
            let bard_key_innerText = bard_key.innerText
            let bard_key_slice_start = bard_key_innerText.indexOf("WIZ_global_data")
            let bard_key_slice_end = bard_key_innerText.indexOf(bard_key_innerText.length - 1)
            let bard_key_sliced = bard_key_innerText.slice(bard_key_slice_start + 18, bard_key_slice_end)

            let bard_key_parser = JSON.parse(bard_key_sliced)
            let bard_keyVal = bard_key_parser.SNlM0e
            let bardPath = window.location.pathname

            chrome.storage.local.set({ bard_api_key: bard_keyVal, bard_path: bardPath });

            clearInterval(bard_interval)
        }
    }, 1000);
}

if (window.location.href === "https://gemini.google.com/app") {
    bard_key_func()
}

if (isSearchEngine() || isGoogleDocs()) {
    chrome.storage.local.get(["toggleState"], (result) => {
        result.toggleState ? waitUntilVideoElementLoads() : sideIconCreationFn()
    })
}

async function waitUntilVideoElementLoads() {
    return await new Promise((resolve) => {
        const interval = setInterval(() => {
            let element = document.querySelector(selectors.map((e) => {
                return e;
            }))

            let finalState = true;

            if (!element) finalState = false;

            if (finalState) {

                if (targetLocation.includes("www.google.")) {
                    googleIntegration(element)
                } else if (targetLocation.includes("www.bing.")) {
                    bingIntegration(element)
                }
                else if (targetLocation.includes("search.yahoo.")) {
                    yahooIntegration(element)
                } else if (targetLocation.includes("duckduckgo.")) {
                    duckduckIntegration(element)
                } else if (targetLocation.includes("www.baidu.")) {
                    baiduIntegration(element)
                } else if (targetLocation.includes("yandex.")) {
                    yandexIntegration(element)
                } else if (targetLocation.includes("docs.google.")) {
                    docsintegration(element)
                }

                chrome.storage.local.get(["mode"], (result) => {
                    if (result.mode === "on") {
                        darkmode()
                    } else {
                        lightmode()
                    }
                })

                clearInterval(interval);
            }
        }, 1000);
    });
}

const sideIconCreationFn = () => {
    let bodyTag = document.querySelector("body")
    let sideIcon = document.createElement("div")
    sideIcon.setAttribute("id", "sideIcon")
    sideIcon.setAttribute("title", "Turn on AI assistant")
    bodyTag.appendChild(sideIcon)

    let imgTag = `<img src=${bardSideIcon} id="imgTag" alt="bard sideIcon" /> `
    sideIcon.innerHTML = imgTag

    sideIcon.addEventListener('mouseover', function () {
        let img = document.getElementById("imgTag")
        img.src = sideExpandIcon
    });

    sideIcon.addEventListener('mouseout', function () {
        let img = document.getElementById("imgTag")
        img.src = bardSideIcon
    });

    sideIcon.addEventListener('click', function () {
        let sideIcon = document.getElementById("sideIcon")
        sideIcon.style.display = "none"
        chrome.storage.local.set({ toggleState: true })
        waitUntilVideoElementLoads()
    })
}

const googleIntegration = (element) => {
    let searchContent = document.querySelectorAll(`[aria-label="Search"]`)[0].value
    gptquery = searchContent
    bardquery = searchContent

    let parentPanelDiv = document.createElement("div")
    parentPanelDiv.setAttribute("id", "parentPanelDiv")

    let google_inner_div = document.querySelector(".TQc1id.rhstc4")
    let google_map_page = document.querySelector(".TQc1id.k5T88b")
    let placePage = document.querySelector(".TQc1id.N4Xssf")
    let google_page_page1 = document.querySelector(".TQc1id.rhstc5.N4Xssf")

    if (google_inner_div) {
        google_inner_div.prepend(parentPanelDiv)
    } else if (google_page_page1) {
        google_page_page1.prepend(parentPanelDiv)
    } else if (placePage) {
        placePage.prepend(parentPanelDiv)
    }
    else if (google_map_page) {
        google_map_page.prepend(parentPanelDiv)
    }
    else {
        parentPanelDiv.style.marginLeft = "17px";
        element.appendChild(parentPanelDiv)
    }
    titleSecCreationFn(parentPanelDiv)
}

const createSearchIntegration = (searchSelector) => (element) => {
    const searchContent = document.querySelector(searchSelector)?.value || ""
    gptquery = searchContent
    bardquery = searchContent

    const parentPanelDiv = createElement("div", { id: "parentPanelDiv" })
    element.prepend(parentPanelDiv)
    titleSecCreationFn(parentPanelDiv)
}

const bingIntegration = createSearchIntegration("#sb_form_q")
const yahooIntegration = createSearchIntegration(".sbq")
const duckduckIntegration = createSearchIntegration("#search_form_input")
const baiduIntegration = createSearchIntegration("#kw")
const yandexIntegration = createSearchIntegration(".input__control")

const docsintegration = (element) => {
    gptquery = "Hi"
    bardquery = "Hi"

    let classfetch = document.querySelector(".kix-appview-editor-container")
    let canvafetch = document.querySelector(".kix-appview-editor")
    let parentPanelDiv = document.createElement("div")
    let sideIcon = document.getElementById("sideIcon")

    parentPanelDiv.setAttribute("id", "parentPanelDiv")
    parentPanelDiv.style.margin = "10px"

    element.append(parentPanelDiv)

    chrome.storage.local.get(["docVisibility"], (result) => {
        if (result.docVisibility) {
            classfetch.style.display = "flex"
            canvafetch.style.width = "70%"
            parentPanelDiv.style.display = "block"
            sideIcon.style.display = "none"
        } else if (!result.docVisibility) {
            classfetch.style.display = "block"
            canvafetch.style.width = "100%"
            parentPanelDiv.style.display = "none"
            sideIcon.style.display = "flex"
        }
    })

    titleSecCreationFn(parentPanelDiv)
}

const titleSecCreationFn = (parentPanelDiv) => {
    let titleSection = document.createElement("div")
    titleSection.setAttribute("id", "titleSectionx")
    parentPanelDiv.appendChild(titleSection)

    let titleLogo = document.createElement("img")
    titleLogo.setAttribute("id", "titleLogo")
    titleLogo.setAttribute("alt", "bard")
    titleLogo.src = bardGptLogo
    titleSection.appendChild(titleLogo)

    let titleOptionDiv = document.createElement("div")
    titleOptionDiv.setAttribute("id", "titleOptionDiv")
    titleSection.appendChild(titleOptionDiv)

    let titleRating = document.createElement("a")
    titleRating.setAttribute("id", "titleRating")
    titleRating.href = "https://chrome.google.com/webstore/detail/bard-for-google/hnadleianomnjcoeplifgbkiejchjmah/reviews"
    titleRating.setAttribute("target", "blank")
    titleOptionDiv.appendChild(titleRating)

    let ratingStorage = chrome.storage.local.get(["rated"])
    ratingStorage.then((e) => {
        if (e.rated) {
            titleRating.style.display = "none"
        }
    })

    let ratingIcon = document.createElement("img")
    ratingIcon.setAttribute("alt", "rating icon")
    ratingIcon.setAttribute("id", "ratingIcon")
    ratingIcon.src = ratingStar
    titleRating.appendChild(ratingIcon)

    let rateText = document.createElement("div")
    rateText.setAttribute("id", "rateText")
    rateText.innerText = "Rate us"
    titleRating.appendChild(rateText)

    titleRating.addEventListener("click", () => {
        ratingRemoval()
    })

    let mode = document.createElement("div")
    mode.setAttribute("id", "mode")
    titleOptionDiv.appendChild(mode)

    let modeLogo = document.createElement("img")
    modeLogo.setAttribute("id", "modeLogo")
    modeLogo.setAttribute("alt", "dark mode icon")
    modeLogo.src = lightmoon

    mode.appendChild(modeLogo)

    mode.addEventListener("click", () => {
        if (modeLogo.src === lightmoon) {
            darkmode()
            chrome.storage.local.set({ mode: "on" })
        } else {
            lightmode()
            chrome.storage.local.set({ mode: "off" })
        }
    })

    let startButton = document.createElement("img")
    startButton.setAttribute("id", "startButton")
    startButton.setAttribute("title", "Turn off AI assistant")
    startButton.style.cursor = "pointer"
    titleOptionDiv.appendChild(startButton)
    let res
    chrome.storage.local.get(["toggleState"], (result) => {
        res = result.toggleState
        startButton.src = result.toggleState ? startBtnIcon : stopBtnIcon
    })

    startButton.addEventListener("click", () => {
        res = !res
        startButton.src = res ? startBtnIcon : stopBtnIcon
        chrome.storage.local.set({ toggleState: res })
        if (!res) {
            document.getElementById("parentPanelDiv").remove()
        }
    })

    const panel = document.createElement("div");
    panel.setAttribute("id", "panel");
    parentPanelDiv.appendChild(panel)

    header(panel)
    bard_section(panel)
    gpt_section(panel)
    footer_section(panel)
}

const loaderCreation = (val) => {
    let loaderDiv = document.createElement("div")
    loaderDiv.setAttribute("id", "loader")
    val.appendChild(loaderDiv)

    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('div');
        dot.className = 'dot';
        loaderDiv.appendChild(dot);
    }
}

const loaderRemoval = () => {
    loaderDiv = document.getElementById("loader")
    if (loaderDiv) {
        loaderDiv.remove()
    }
}

const header = (panel) => {
    let headerSection = document.createElement("div")
    headerSection.setAttribute("id", "headerSection")
    panel.appendChild(headerSection)

    let bardTab = document.createElement("div")
    bardTab.setAttribute("id", "bardTab")
    headerSection.appendChild(bardTab)

    let bardTabLogo = document.createElement("img")
    bardTabLogo.setAttribute("id", "bardTabLogo")
    bardTabLogo.setAttribute("alt", "bard for google ")
    bardTabLogo.src = bardLogo
    bardTab.appendChild(bardTabLogo)

    let bardTabText = document.createElement("span")
    bardTabText.setAttribute("id", "bardTabText")
    bardTab.appendChild(bardTabText)
    bardTabText.innerText = "Bard AI"

    let gptTab = document.createElement("div")
    gptTab.setAttribute("id", "gptTab")
    headerSection.appendChild(gptTab)

    let gptTabLogo = document.createElement("img")
    gptTabLogo.setAttribute("id", "gptTabLogo")
    gptTabLogo.setAttribute("alt", "gpt for google ")
    gptTabLogo.src = gptLogo
    gptTab.appendChild(gptTabLogo)

    let gptTabText = document.createElement("span")
    gptTabText.setAttribute("id", "gptTabText")
    gptTab.appendChild(gptTabText)
    gptTabText.innerText = "ChatGPT"

    bardTab.addEventListener("click", bard_btn_listener)
    gptTab.addEventListener("click", gpt_btn_listener)
}

const bard_btn_listener = () => {
    let bardTab = document.getElementById("bardTab")
    let gptTab = document.getElementById("gptTab")
    let bard_section_div = document.getElementById("bard_section_div")
    let gpt_section_div = document.getElementById("gpt_section_div")

    bardTab.style.borderLeft = "3.5px solid #b5adad"
    bardTab.style.boxShadow = "0px 2px 2px rgba(0, 0, 0, 0.14)"
    bardTab.style.opacity = "1"
    bardTab.style.borderLeft = " 3.5px solid"

    gptTab.style.opacity = "0.5"
    gptTab.style.boxShadow = "none"
    gptTab.style.borderLeft = "none"

    bard_section_div.style.display = "flex"
    gpt_section_div.style.display = "none"

    chrome.storage.local.get(["mode"], (result) => {
        if (result.mode === "on") {
            darkmode()
        } else {
            lightmode()
        }
    })
}

const gpt_btn_listener = () => {
    let bardTab = document.getElementById("bardTab")
    let gptTab = document.getElementById("gptTab")
    let bard_section_div = document.getElementById("bard_section_div")
    let gpt_section_div = document.getElementById("gpt_section_div")

    gptTab.style.background = "#fffff"
    gptTab.style.borderLeft = "3.5px solid #b5adad"
    gptTab.style.boxShadow = "0px 2px 2px rgba(0, 0, 0, 0.14)"
    gptTab.style.opacity = "1"
    gptTab.style.background = "#ffffff"
    gptTab.style.borderLeft = " 3.5px solid"

    bardTab.style.background = "transparent"
    bardTab.style.opacity = "0.5"
    bardTab.style.boxShadow = "none"
    bardTab.style.borderLeft = "none"

    bard_section_div.style.display = "none"
    gpt_section_div.style.display = "flex"

    chrome.storage.local.get(["mode"], (result) => {
        if (result.mode === "on") {
            gptTab.style.background = "#0D0D0D"
            bardTab.style.background = "transparent"
            gptTab.style.color = "#fff"
            bardTab.style.color = "#fff"
        } else {
            gptTab.style.background = "#fff"
            bardTab.style.background = "transparent"
            bardTab.style.color = "#000"
            gptTab.style.color = "#000"
        }
    })

    if (document.getElementById("gpt_section_div").innerText === "") {
        gptCall()
    }
}

const bard_section = (panel) => {
    let bard_section_div = document.createElement("div")
    bard_section_div.setAttribute("id", "bard_section_div")
    panel.appendChild(bard_section_div)
    bard_section_div.style.display = "flex"
    let bardResult = document.createElement("div")
    bardResult.setAttribute("id", "bardResult")
    bard_section_div.appendChild(bardResult)

    let bard_access_token = chrome.storage.local.get(["bard_api_key"])
    bard_access_token.then((e) => {
        if (e.bard_api_key) {
            bardClientMsg(bardquery)
            loaderCreation(bardResult)
            if (document.getElementById("bard_login_box")) {
                document.getElementById("bard_login_box").remove()
            }
            bardResult.style.display = "flex"
            bardMultipleMsg = true
            chrome.runtime.sendMessage({ message: 'search-occured-bard', query: bardquery, bard_conv_id })
        } else {
            bard_section_login(bard_section_div)
        }
    })
}

const gpt_section = (panel) => {
    let gpt_section_div = document.createElement("div")
    gpt_section_div.setAttribute("id", "gpt_section_div")
    panel.appendChild(gpt_section_div)
    let gptResult = document.createElement("div")
    gptResult.setAttribute("id", "gptResult")
    gpt_section_div.appendChild(gptResult)
}

const bardCall = () => {
    let bardResult = document.getElementById("bardResult")
    bardClientMsg(bardquery)
    loaderCreation(bardResult)
    if (document.getElementById("bard_login_box")) {
        document.getElementById("bard_login_box").remove()
    }
    bardResult.style.display = "flex"
    bardMultipleMsg = true
    chrome.runtime.sendMessage({ message: 'search-occured-bard', query: bardquery, bard_conv_id })
}

const gptCall = () => {
    let gptResult = document.getElementById("gptResult")
    gptClientMsg(gptquery)
    loaderCreation(gptResult)
    if (document.getElementById("gpt_login_box")) {
        document.getElementById("gpt_login_box").remove()
    }
    gptResponseCopy = true
    chrome.runtime.sendMessage({ message: 'search-occured-gpt', query: gptquery })
    let gptResponseDiv = document.createElement("div")
    gptResponseDiv.setAttribute("class", "gptResponseDiv")
    gptResult.appendChild(gptResponseDiv)
    gptResponseDiv.style.display = "none"
}

const bard_section_login = (bard_section_div) => {
    if (!document.getElementById("bard_login_box")) {
        let bard_login_box = document.createElement("div")
        bard_login_box.setAttribute("id", "bard_login_box")
        bard_section_div.appendChild(bard_login_box)
        document.getElementById("bardResult").style.display = "none"

        let infoSrc = infoIcon
        let info = new Image()
        info.setAttribute("id", "infoDiv")
        info.setAttribute("alt", "information icon")
        info.src = infoSrc
        bard_login_box.appendChild(info)

        let loginTextDiv1 = document.createElement("div")
        loginTextDiv1.setAttribute("id", "loginTextDiv1")
        bard_login_box.appendChild(loginTextDiv1)

        let span1 = document.createElement("span")
        span1.innerText = chrome.i18n.getMessage("appLogintext1") + " "
        loginTextDiv1.appendChild(span1)

        let chatGptLink = document.createElement("a")
        chatGptLink.setAttribute("id", "chatGptLink")
        loginTextDiv1.appendChild(chatGptLink)
        chatGptLink.innerText = "gemini.google.com"
        chatGptLink.href = "https://gemini.google.com/app"
        chatGptLink.target = "_blank"

        let span2 = document.createElement("span")
        span2.innerText = " " + chrome.i18n.getMessage("appLogintext")
        loginTextDiv1.appendChild(span2)
    }
}

const gpt_section_login = (gpt_section_div) => {
    if (!document.getElementById("gpt_login_box")) {
        let gpt_login_box = document.createElement("div")
        gpt_login_box.setAttribute("id", "gpt_login_box")
        gpt_section_div.appendChild(gpt_login_box)
        document.getElementById("gptResult").style.display = "none"

        let infoSrc = infoIcon
        let info = new Image()
        info.setAttribute("alt", "information")
        info.setAttribute("id", "infoDiv")
        info.src = infoSrc
        gpt_login_box.appendChild(info)

        let warnInfoText = document.createElement("p")
        warnInfoText.setAttribute("id", "warnInfoText")
        gpt_login_box.appendChild(warnInfoText)
        warnInfoText.innerText = chrome.i18n.getMessage("appCloudsecurity")

        let loginTextDiv1 = document.createElement("div")
        loginTextDiv1.setAttribute("id", "loginTextDiv1 loginTextDiv2")
        gpt_login_box.appendChild(loginTextDiv1)

        let span1 = document.createElement("span")
        span1.innerText = chrome.i18n.getMessage("appLogintext1") + " "
        loginTextDiv1.appendChild(span1)

        let chatGptLink = document.createElement("a")
        chatGptLink.setAttribute("id", "chatGptLink")
        loginTextDiv1.appendChild(chatGptLink)
        chatGptLink.innerText = "chat.openai.com"
        chatGptLink.href = "https://chat.openai.com/chat"
        chatGptLink.target = "_blank"

        let span2 = document.createElement("span")
        span2.innerText = " " + chrome.i18n.getMessage("appLogintext")
        loginTextDiv1.appendChild(span2)
    }
}

const footer_section = (panel) => {
    let footer_section_div = document.createElement("div")
    footer_section_div.setAttribute("id", "footer_section_div")
    panel.appendChild(footer_section_div)

    let rateChatDiv = document.createElement("div")
    rateChatDiv.setAttribute("id", "rateChatDiv")
    footer_section_div.appendChild(rateChatDiv)

    let chatTextDiv = document.createElement("div")
    chatTextDiv.setAttribute("id", "chatTextDiv")
    rateChatDiv.appendChild(chatTextDiv)

    let chatImg = document.createElement("img")
    chatImg.setAttribute("alt", "google ")
    chatImg.setAttribute("id", "chatImg")
    chatImg.src = chatIcon
    chatTextDiv.appendChild(chatImg)

    let chatText = document.createElement("div")
    chatText.setAttribute("id", "chatText")
    chatText.innerText = "Let's Chat"
    chatTextDiv.appendChild(chatText)

    let rateDiv = document.createElement("a")
    rateDiv.setAttribute("id", "rateDiv")
    rateDiv.href = "https://chrome.google.com/webstore/detail/bard-for-google/hnadleianomnjcoeplifgbkiejchjmah/reviews"
    rateDiv.setAttribute("target", "blank")
    rateChatDiv.appendChild(rateDiv)

    let ratingStorage = chrome.storage.local.get(["rated"])
    ratingStorage.then((e) => {
        if (e.rated) {
            rateDiv.style.display = "none"
        }
    })

    let ratingIcon = document.createElement("img")
    ratingIcon.setAttribute("alt", "rating icon ")
    ratingIcon.setAttribute("id", "ratingIcon")
    ratingIcon.src = ratingStar
    rateDiv.appendChild(ratingIcon)

    let rateText = document.createElement("div")
    rateText.setAttribute("id", "rateText")
    rateText.innerText = "Rate us"
    rateDiv.appendChild(rateText)

    rateDiv.addEventListener("click", () => {
        ratingRemoval()
    })

    let followUpDiv = document.createElement("div")
    followUpDiv.setAttribute("id", "followUpDiv")
    footer_section_div.appendChild(followUpDiv)

    let inputBox = document.createElement("input")
    inputBox.setAttribute("id", "inputBox")
    inputBox.setAttribute("type", "text")
    inputBox.setAttribute("placeholder", "Ask me anything..")
    followUpDiv.appendChild(inputBox)

    let enterImg = document.createElement("img")
    enterImg.setAttribute("alt", "ai")
    enterImg.setAttribute("id", "enterImg")
    enterImg.src = enterIcon
    followUpDiv.appendChild(enterImg)

    chatTextDiv.addEventListener("click", () => {
        rateChatDiv.style.display = "none"
        followUpDiv.style.display = "flex"
        footer_section_div.style.border = "none"

        let bardResponseDiv = document.getElementsByClassName("bardResponseDiv")[0]
        let gptResponseDiv = document.getElementsByClassName("gptResponseDiv")[0]

        chrome.storage.local.get(["mode"], (result) => {
            if (result.mode === "on") {
                darkmode()
            } else {
                lightmode()
            }
        })

        if (bardResponseDiv) {
            bardResponseDiv.style.padding = "10px"
        }
        if (gptResponseDiv) {
            gptResponseDiv.style.padding = "10px"
        }

        let ratingStorage = chrome.storage.local.get(["rated"])
        ratingStorage.then((e) => {
            if (!e.rated) {
                document.getElementById("titleRating").style.display = "flex"
            }
        })

        ChatMode()
        hideChatMode = false
    })

    let bardClientDiv = document.querySelectorAll(".bardClientDiv")
    let gptClientDiv = document.querySelectorAll(".gptClientDiv")

    inputBox.addEventListener("keydown", function (event) {
        if (event.keyCode === 13 && inputBox.value != "") {
            Array.from(bardClientDiv).forEach(function (element) {
                element.style.display = "flex";
            });
            Array.from(gptClientDiv).forEach(function (element) {
                element.style.display = "flex";
            });
            followUpFn()
        }
    });

    enterImg.addEventListener("click", () => {
        if (inputBox.value != "") {
            Array.from(bardClientDiv).forEach(function (element) {
                element.style.display = "flex";
            });
            Array.from(gptClientDiv).forEach(function (element) {
                element.style.display = "flex";
            });
            followUpFn()
        }
    })
}

const ChatMode = () => {
    let bardClientDiv = document.querySelectorAll(".bardClientDiv")
    let gptClientDiv = document.querySelectorAll(".gptClientDiv")
    let gptResponseDiv = document.querySelectorAll(".gptResponseDiv")
    let bardResponseDiv = document.querySelectorAll(".bardResponseDiv")

    Array.from(bardClientDiv).forEach(function (element) {
        element.style.display = "flex";
    });

    Array.from(gptClientDiv).forEach(function (element) {
        element.style.display = "flex";
    });
}

const followUpFn = () => {
    if (document.getElementById("gpt_section_div").style.display === "flex") {
        gptquery = inputBox.value
        let gptResult = document.getElementById("gptResult")

        if (document.getElementById("gpt_login_box")) {
            document.getElementById("gpt_login_box").remove()
        }
        gptResult.style.display = "flex"
        gptCall()
    } else if (document.getElementById("bard_section_div").style.display === "flex") {
        bardquery = inputBox.value
        let bardResult = document.getElementById("bardResult")
        bardClientMsg(bardquery)
        loaderCreation(bardResult)
        if (document.getElementById("bard_login_box")) {
            document.getElementById("bard_login_box").remove()
        }
        bardResult.style.display = "flex"
        bardMultipleMsg = true
        chrome.runtime.sendMessage({ message: 'search-occured-bard', query: bardquery, bard_conv_id })
    }
    inputBox.value = ""
}

const copyBtnListener = () => {
    let panel = document.querySelector("#panel")
    let allCodeTag = panel.querySelectorAll("code")
    allCodeTag.forEach((e) => {
        let parentNode = e.parentNode;
        if (!parentNode.querySelector("#copyPanel")) {
            let copyPanel = document.createElement("div")
            copyPanel.setAttribute("id", "copyPanel")
            parentNode.insertBefore(copyPanel, e);

            let copyDiv = document.createElement("div")
            copyDiv.setAttribute("id", "copyDiv")
            copyDiv.innerText = "Copy code"
            copyPanel.appendChild(copyDiv)

            let copyBtn = document.createElement("img")
            copyBtn.setAttribute("id", "copyBtn")
            copyBtn.setAttribute("alt", "copy icon")
            copyBtn.src = copyIconDark
            copyDiv.appendChild(copyBtn)

            copyDiv.addEventListener("click", () => {
                copyDiv.innerText = "Copied"
                navigator.clipboard.writeText(e.innerText);
                setTimeout(() => {
                    copyDiv.innerText = "Copy code"
                    copyDiv.appendChild(copyBtn)
                }, 2000)
            })

            chrome.storage.local.get(["mode"], (result) => {
                if (result.mode === "on") {
                    copyPanel.style.background = "#1E2336"
                } else {
                    copyPanel.style.background = "#DADDEA"
                }
            })
        }
    })
}

let bardClientMsg = (quer) => {
    let bardResult = document.getElementById("bardResult")
    let bardClientDiv = document.createElement("div")
    bardClientDiv.setAttribute("class", "bardClientDiv")
    bardResult.appendChild(bardClientDiv)
    bardClientDiv.innerText = quer
}

let gptClientMsg = (quer) => {
    let gptResult = document.getElementById("gptResult")
    let gptClientDiv = document.createElement("div")
    gptClientDiv.setAttribute("class", "gptClientDiv")
    gptResult.appendChild(gptClientDiv)
    gptClientDiv.innerText = quer
}

const ratingRemoval = () => {
    chrome.storage.local.set({ rated: true })
}

const bardCopySection = (bardResponseDiv) => {
    chrome.storage.local.get(["mode"], (result) => {
        if (result.mode === "on") {
            if (!hideChatMode) {
                bardResponseDiv.style.padding = "10px"
            }
            darkmode()
        } else {
            if (!hideChatMode) {
                bardResponseDiv.style.padding = "10px"
            }
            lightmode()
        }
    })
}

let gptCopySection = (gptResponseDiv) => {
    chrome.storage.local.get(["mode"], (result) => {
        let codeTags = document.querySelectorAll("#panel code");
        let copyDivs = document.querySelectorAll("#copyDiv")
        let copyBtns = document.querySelectorAll("#copyBtn")
        let copyPanel = document.querySelectorAll("#copyPanel")

        if (result.mode === "on") {
            if (!hideChatMode) {
                gptResponseDiv.style.padding = "10px"
            }
            darkmode()
        } else {
            if (!hideChatMode) {
                gptResponseDiv.style.padding = "10px"
            }
            lightmode()
        }
    })
}

let bardResponseMsg = (quer) => {
    let bardResult = document.getElementById("bardResult")
    let bardResponseDiv = document.createElement("div")

    bardResponseDiv.setAttribute("class", "bardResponseDiv")
    bardResult.appendChild(bardResponseDiv)
    bardFirstAns = quer
    bardResponseDiv.innerHTML = quer
    if (isSearchEngine()) hljs.highlightAll()
    copyBtnListener()
    bardCopySection(bardResponseDiv)
    document.getElementById("footer_section_div").style.display = "flex"
    bardResult.scrollTop = bardResponseDiv.offsetTop;

    let copyBardRes = document.createElement("div")
    copyBardRes.setAttribute("id", "copyBardRes")
    copyBardRes.setAttribute("title", "Copy response")
    bardResult.appendChild(copyBardRes)
    let bardResCopy = document.createElement("img")
    bardResCopy.setAttribute("id", "bardResCopy")
    bardResCopy.src = copyIconDark
    copyBardRes.appendChild(bardResCopy)

    chrome.storage.local.get(["mode"], (result) => {
        if (result.mode === "on") {
            bardResCopy.src = copyIcon
        } else {
            bardResCopy.src = copyIconDark
        }
    })

    bardResCopy.addEventListener("click", () => {
        navigator.clipboard.writeText(bardResponseDiv.innerText);
    })
}

let gptResponseMsg = (quer) => {
    let gptResponseDivLen = document.getElementsByClassName("gptResponseDiv").length
    let gptResponseDiv = document.getElementsByClassName("gptResponseDiv")[gptResponseDivLen - 1]
    let gptResult = document.getElementById("gptResult")

    gptFirstAns = quer
    gptResponseDiv.innerHTML = quer
    gptResponseDiv.style.display = "flex"
    gptResponseDiv.style.flexDirection = "column"
    if (isSearchEngine()) hljs.highlightAll()
    copyBtnListener()
    document.getElementById("footer_section_div").style.display = "flex"
    gptResult.scrollTop = gptResponseDiv.offsetTop;

    if (gptResponseCopy && quer != "") {
        let copyGptRes = document.createElement("div")
        copyGptRes.setAttribute("id", "copyGptRes")
        copyGptRes.setAttribute("title", "Copy response")
        gptResult.appendChild(copyGptRes)
        let gptResCopy = document.createElement("img")
        gptResCopy.setAttribute("id", "gptResCopy")
        copyGptRes.appendChild(gptResCopy)

        gptResCopy.addEventListener("click", () => {
            navigator.clipboard.writeText(gptResponseDiv.innerText);
        })
        gptResponseCopy = false
    }

    chrome.storage.local.get(["mode"], (result) => {
        if (result.mode === "on") {
            if (!hideChatMode) {
                gptResponseDiv.style.padding = "10px"
            }
            darkmode()
        } else {
            if (!hideChatMode) {
                gptResponseDiv.style.padding = "10px"
            }
            lightmode()
        }
    })
}

chrome.runtime.onMessage.addListener(function (response, sender, sendResponse) {
    loaderRemoval()
    if (!hideChatMode) {
        ChatMode()
    }

    if (response.message === 'answer') {
        let gpt_section_div = document.getElementById("gpt_section_div")
        gpt_section_div.style.justifyContent = "flex-start"
        gpt_section_div.style.alignItems = "flex-start"
        gpt_section_div.style.flexDirection = "column"

        let { answer } = response

        const markdown = window.markdownit()
        if (typeof (answer) === "string") {
            const html = markdown.render(answer)
            gptResponseMsg(html)
        }
    } else if (response.message === "gptErrAnswer") {
        let gpt_section_div = document.getElementById("gpt_section_div")
        gpt_section_div.style.justifyContent = "flex-start"
        gpt_section_div.style.alignItems = "flex-start"

        if (!document.getElementById("gptErrMsg")) {
            let gptErrMsg = document.createElement("div")
            gptErrMsg.setAttribute("id", "gptErrMsg")
            gptErrMsg.innerHTML = "Something went wrong please reload page or visit  "

            let chatGptLink = document.createElement("a")
            chatGptLink.setAttribute("id", "chatGptLink")
            chatGptLink.innerText = "chat.openai.com"
            chatGptLink.href = "https://chat.openai.com/chat"
            chatGptLink.target = "_blank"

            setTimeout(() => {
                gpt_btn_listener()
                gptErrMsg.remove()
                chatGptLink.remove()
            }, 5000);
        }
    }
    else if (response.message === "bardAnswer") {
        let bard_section_div = document.getElementById("bard_section_div");
        if (bardMultipleMsg) {
            bard_section_div.style.justifyContent = "flex-start";
            bard_section_div.style.alignItems = "flex-start";
            bard_section_div.style.flexDirection = "column";

            let { bardAnswer } = response;
            let final_bard_answer;

            try {
                final_bard_answer = JSON.parse(bardAnswer);
            } catch (e) {
                bard_section_login(bard_section_div);
                document.getElementById("bard_login_box").style.display = "flex";
                return;
            }

            if (final_bard_answer === null) {
                bard_section_login(bard_section_div);
                document.getElementById("bard_login_box").style.display = "flex";
            } else {
                try {
                    const markdown = window.markdownit();

                    let responseImg = final_bard_answer[4][0][12][1] || [];

                    const html = markdown.render(final_bard_answer[4][0][1][0] || "").replace(/\[Image of (.*?)\]/g, (e) => {
                        let imgUrl = "";
                        let hrefUrl = "";

                        responseImg.forEach((arr) => {
                            if (arr[7][0].includes(e)) {
                                imgUrl = arr[0][0][0];
                                hrefUrl = arr[1][0][0];
                            }
                        });

                        if (imgUrl && hrefUrl) {
                            return `<br> <a href="${hrefUrl}" target="_blank"><img alt="${e}" src="${imgUrl}" /> </a> <br>`;
                        } else {
                            return '';
                        }
                    });

                    bard_conv_id.Cval = final_bard_answer[1][0] || "";
                    bard_conv_id.Rval = final_bard_answer[1][1] || "";
                    bard_conv_id.RCval = final_bard_answer[4][0][0] || "";

                    bardResponseMsg(html);
                } catch (error) {
                    bard_section_login(bard_section_div);
                }
            }
            bardMultipleMsg = false;
        }
    }
    else if (response.message === "bardNotAvailable") {
        let bard_section_div = document.getElementById("bard_section_div")
        bard_section_login(bard_section_div)
    }
    else if (response.message === "light") {
        lightmode()
    } else if (response.message === "dark") {
        darkmode()
    }
})

const THEME = {
    dark: {
        bg: "#0d1117", sectionBg: "#161B22", headerBg: "#2A2A2A", inputBg: "#0D0D0D",
        inputBorder: "1px solid #242424", textColor: "#fff", sectionTextColor: "#ffffff",
        tabBg: "#0D0D0D", copyPanelBg: "#1E2336", copyDivColor: "#E7E8EB",
        logo: bardGptLogoWhite, moon: darkmoon, copyBtnIcon: copyIcon, title: "Disable dark mode"
    },
    light: {
        bg: "#ffffff", sectionBg: "#F4F5FA", headerBg: "#EFEFEF", inputBg: "#FFFFFF",
        inputBorder: "1px solid #E8E8E8", textColor: "#000", sectionTextColor: "#4d5156",
        tabBg: "#fff", copyPanelBg: "#DADDEA", copyDivColor: "#6170AB",
        logo: bardGptLogo, moon: lightmoon, copyBtnIcon: copyIconDark, title: "Enable dark mode"
    }
}

const applyTheme = (isDark) => {
    const theme = isDark ? THEME.dark : THEME.light
    const parentPanelDiv = $("parentPanelDiv")
    const bard_section_div = $("bard_section_div")
    const gpt_section_div = $("gpt_section_div")
    const headerSection = $("headerSection")
    const bardTab = $("bardTab")
    const gptTab = $("gptTab")
    const inputBox = $("inputBox")
    const loginTextDiv1 = $("loginTextDiv1")
    const loginTextDiv2 = $("loginTextDiv2")

    modeLogo.src = theme.moon
    modeLogo.setAttribute("title", theme.title)
    parentPanelDiv.style.background = theme.bg
    titleLogo.src = theme.logo
    bard_section_div.style.color = theme.sectionTextColor
    gpt_section_div.style.color = theme.sectionTextColor
    inputBox.style.background = theme.inputBg
    inputBox.style.border = theme.inputBorder
    headerSection.style.background = theme.headerBg

    if (loginTextDiv1) loginTextDiv1.style.color = theme.textColor
    if (loginTextDiv2) loginTextDiv2.style.color = theme.textColor

    const applyResponseStyles = (className, resCopySelector) => {
        const divs = document.getElementsByClassName(className)
        const resCopy = document.querySelectorAll(resCopySelector)
        if (hideChatMode && divs.length === 1) {
            divs[0].style.background = "none"
            if (resCopy[0]) resCopy[0].src = theme.copyBtnIcon
        } else {
            Array.from(divs).forEach(div => {
                div.style.background = theme.sectionBg
                div.style.color = theme.textColor
            })
            resCopy.forEach(e => e.src = theme.copyBtnIcon)
        }
    }
    applyResponseStyles("bardResponseDiv", "#bardResCopy")
    applyResponseStyles("gptResponseDiv", "#gptResCopy")

    const activeTab = bard_section_div.style.display === "flex" ? bardTab : gptTab
    const inactiveTab = activeTab === bardTab ? gptTab : bardTab
    activeTab.style.background = theme.tabBg
    inactiveTab.style.background = "transparent"
    bardTab.style.color = theme.textColor
    gptTab.style.color = theme.textColor

    document.querySelectorAll("#panel code").forEach(el => {
        el.style.background = theme.sectionBg
        el.style.color = theme.textColor
    })
    document.querySelectorAll("#copyDiv").forEach(el => el.style.color = theme.copyDivColor)
    document.querySelectorAll("#copyBtn").forEach(el => el.src = theme.copyBtnIcon)
    document.querySelectorAll("#copyPanel").forEach(el => el.style.background = theme.copyPanelBg)
}

const darkmode = () => applyTheme(true)

const lightmode = () => applyTheme(false)

window.addEventListener('focus', () => {
    if (document.getElementById("bard_section_div")) {
        let bard_access_token = chrome.storage.local.get(["bard_api_key"])
        bard_access_token.then((e) => {
            if (e.bard_api_key) {
                if (document.getElementById("bard_login_box")) {
                    document.getElementById("bard_login_box").style.display = "none"
                    bardCall()
                }
            }
        })
    }

    if (window.location.href.includes("https://gemini.google.com/app")) {
        bard_key_func()
    }
});

if (window.location.href.includes("https://gemini.google.com/app")) {
    bard_key_func()
}
