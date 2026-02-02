const $ = (id) => document.getElementById(id)
const $$ = (sel) => document.querySelectorAll(sel)

const bardTab = $("bardTab")
const gptTab = $("gptTab")
const bard_section_div = $("bard_section_div")
const gpt_section_div = $("gpt_section_div")
const chatTextDiv = $("chatTextDiv")
const inputBox = $("inputBox")
const bardResult = $("bard-result")
const gptResult = $("gpt-result")
const bard_login = $("bard_login_box")
const gpt_login = $("gpt_login_box")
const bardLoader = $("bardLoader")
const gptLoader = $("gptLoader")
const mode = $("mode")
const search = $("enterImg")
const popupContainer = $("popupContainer")
const titleLogo = $("titleLogo")
const loginText = $$("#loginTextDiv1")
const headerSection = $("headerSection")
const titleRating = $("titleRating")

const ratingStorage = chrome.storage.local.get(["rated"])

let gptquery = ""
let bardquery = ""
let bard_conv_id = { Cval: "", Rval: "", RCval: "" }
let gptResponseCopy = false
let bardMultipleMsg = false

const IMG = {
    darkmoon: "../static/images/darkmoon.svg",
    lightmoon: "../static/images/lightmoon.svg",
    logoWhite: "../static/images/bardGptLogowhite.svg",
    logo: "../static/images/bardGptLogo.svg",
    copyIcon: "../static/images/copyIcon.svg",
    copyIconDark: "../static/images/copyIconDark.svg"
}

window.onload = function () {
    inputBox.focus()
    let bard_access_token = chrome.storage.local.get(["bard_api_key"])
    let access = chrome.storage.sync.get("accessToken")

    bard_access_token.then((e) => {
        if (!e.bard_api_key) {
            bard_login.style.display = "flex"
            bardResult.style.display = "none"
        }
    })

    access.then((e) => {
        if (!e.accessToken) {
            gpt_login.style.display = "flex"
            gptResult.style.display = "none"
            chrome.runtime.sendMessage({ message: 'session-check' })
        }
    })

    bard_section_div.style.display = "flex"
    bardLoader.style.display = "none"

    chrome.storage.local.get(["mode"], (result) => {
        if (result.mode === "on") {
            darkmode()
        } else {
            lightmode()
        }
    })

    ratingStorage.then((e) => {
        if (e.rated) {
            titleRating.style.display = "none"
        }
    })
}

titleRating.addEventListener(("click"), () => {
    chrome.storage.local.set({ rated: true })
})

mode.addEventListener("click", () => {
    if (modeLogo.src.match("lightmoon")) {
        darkmode()
        chrome.storage.local.set({ mode: "on" })
        chrome.tabs.query({}, function (tabs) {
            tabs.forEach(function (tab) {
                chrome.tabs.sendMessage(tab.id, { message: 'dark' });
            });
        });
    } else {
        lightmode()
        chrome.storage.local.set({ mode: "off" })
        chrome.tabs.query({}, function (tabs) {
            tabs.forEach(function (tab) {
                chrome.tabs.sendMessage(tab.id, { message: 'light' });
            });
        });
    }
})

const POPUP_THEME = {
    dark: {
        bg: "#0d1117", sectionBg: "#161B22", headerBg: "#2A2A2A", inputBg: "#0D0D0D",
        inputBorder: "1px solid #242424", textColor: "#fff", sectionTextColor: "#ffffff",
        tabBg: "#0D0D0D", copyPanelBg: "#1E2336", copyDivColor: "#E7E8EB",
        logo: IMG.logoWhite, moon: IMG.darkmoon, copyBtnIcon: IMG.copyIcon, title: "Disable dark mode"
    },
    light: {
        bg: "#fff", sectionBg: "#F4F5FA", headerBg: "#EFEFEF", inputBg: "#FFFFFF",
        inputBorder: "1px solid #E8E8E8", textColor: "#000", sectionTextColor: "#4d5156",
        tabBg: "#fff", copyPanelBg: "#DADDEA", copyDivColor: "#6170AB",
        logo: IMG.logo, moon: IMG.lightmoon, copyBtnIcon: IMG.copyIconDark, title: "Enable dark mode"
    }
}

const applyPopupTheme = (isDark) => {
    const theme = isDark ? POPUP_THEME.dark : POPUP_THEME.light

    popupContainer.style.background = theme.bg
    modeLogo.src = theme.moon
    mode.setAttribute("title", theme.title)
    titleLogo.src = theme.logo
    bard_section_div.style.color = theme.sectionTextColor
    gpt_section_div.style.color = theme.sectionTextColor
    copyLogo.src = IMG.copyIconDark
    inputBox.style.background = theme.inputBg
    inputBox.style.border = theme.inputBorder
    headerSection.style.background = theme.headerBg

    const styleResponseDivs = (className, resCopySelector) => {
        Array.from(document.getElementsByClassName(className)).forEach(div => {
            div.style.background = theme.sectionBg
        })
        $$(resCopySelector).forEach(e => e.src = theme.copyBtnIcon)
    }
    styleResponseDivs("bardResponseDiv", "#bardResCopy")
    styleResponseDivs("gptResponseDiv", "#gptResCopy")

    loginText.forEach(e => e.style.color = theme.textColor)

    const activeTab = bard_section_div.style.display === "flex" ? bardTab : gptTab
    const inactiveTab = activeTab === bardTab ? gptTab : bardTab
    activeTab.style.background = theme.tabBg
    inactiveTab.style.background = "transparent"
    bardTab.style.color = theme.textColor
    gptTab.style.color = theme.textColor

    $$("#panel code").forEach(el => {
        el.style.background = theme.sectionBg
        el.style.color = theme.textColor
    })
    $$("#copyDiv").forEach(el => el.style.color = theme.copyDivColor)
    $$("#copyBtn").forEach(el => el.src = theme.copyBtnIcon)
    $$("#copyPanel").forEach(el => el.style.background = theme.copyPanelBg)
}

const darkmode = () => applyPopupTheme(true)
const lightmode = () => applyPopupTheme(false)

bardTab.addEventListener("click", () => {
    bardTab.style.background = "#fffff"
    bardTab.style.borderLeft = "3.5px solid #b5adad"
    bardTab.style.boxShadow = "0px 2px 2px rgba(0, 0, 0, 0.14)"
    bardTab.style.opacity = "1"
    bardTab.style.borderLeft = " 3.5px solid"

    gptTab.style.background = "transparent"
    gptTab.style.opacity = "0.5"
    gptTab.style.boxShadow = "none"
    gptTab.style.borderLeft = "none"

    bard_section_div.style.display = "flex"
    gpt_section_div.style.display = "none"

    chrome.storage.local.get(["mode"], (result) => {
        if (result.mode === "on") {
            bardTab.style.background = "#0D0D0D"
            gptTab.style.background = "transparent"
            bardTab.style.color = "#fff"
            gptTab.style.color = "#fff"
        } else {
            bardTab.style.background = "#fff"
            gptTab.style.background = "transparent"
            bardTab.style.color = "#000"
            gptTab.style.color = "#000"
        }
    })

    if (bardquery.trim() !== "") {
        if (bardResult.innerText === "" || bard_login.style.display === "flex") {
            bard_btn_listener(bardquery)
        }
    }
})

gptTab.addEventListener("click", () => {
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

    if (gptquery.trim() !== "") {
        if (gptResult.innerText === "" || gpt_login.style.display === "flex") {
            gpt_btn_listener(gptquery)
        }
    }
})

chatTextDiv.addEventListener("click", () => {
    rateChatDiv.style.display = "none"
    followUpDiv.style.display = "flex"
    document.getElementById("copy").style.display = "none"
    footer_section_div.style.border = "none"

    ratingStorage.then((e) => {
        if (!e.rated) {
            titleRating.style.display = "flex"
        }
    })
})

inputBox.addEventListener("change", () => {
    if (bard_section_div.style.display === "flex") {
        bardquery = inputBox.value
    } else if (gpt_section_div.style.display === "flex") {
        gptquery = inputBox.value
    }
})

inputBox.addEventListener("input", function () {
    if (bard_section_div.style.display === "flex") {
        bardquery = inputBox.value
    } else if (gpt_section_div.style.display === "flex") {
        gptquery = inputBox.value
    }
});

search.addEventListener("click", () => {
    if (bardquery.trim() !== "" || gptquery.trim() !== "") {
        inputBox.value = ""
        if (bard_section_div.style.display === "flex") {
            bard_btn_listener(bardquery)
        } else if (gpt_section_div.style.display === "flex") {
            gpt_btn_listener(gptquery)
        }
    }
})

inputBox.addEventListener("keydown", function (event) {
    if (event.keyCode === 13) {
        if (bardquery.trim() !== "" || gptquery.trim() !== "") {
            inputBox.value = ""
            if (bard_section_div.style.display === "flex") {
                bard_btn_listener(bardquery)
            } else if (gpt_section_div.style.display === "flex") {
                gpt_btn_listener(gptquery)
            }
        }
    }
})

let bard_btn_listener = (quer) => {
    bardLoader.style.display = "flex"
    bard_login.style.display = "none"
    bardClientMsg(bardquery)
    bardResult.appendChild(bardLoader);
    bardMultipleMsg = true
    chrome.runtime.sendMessage({ message: "popup-bard-searched", query: bardquery, bard_conv_id })
}

let gpt_btn_listener = () => {
    gptLoader.style.display = "flex"
    gpt_login.style.display = "none"
    gptClientMsg(gptquery)
    gptResult.appendChild(gptLoader);

    let gptResponseDiv = document.createElement("div")
    gptResponseDiv.setAttribute("class", "gptResponseDiv")
    gptResult.appendChild(gptResponseDiv)
    gptResponseCopy = true
    gptResponseDiv.style.display = "none"

    chrome.runtime.sendMessage({ message: "popup-gpt-searched", query: gptquery })
}

const copyBtnListener = () => {
    let allCodeTag = popupContainer.querySelectorAll("code")
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
            copyBtn.src = "../static/images/copyIconDark.svg"
            copyDiv.appendChild(copyBtn)

            copyDiv.addEventListener("click", () => {
                copyDiv.innerText = "Copied"
                navigator.clipboard.writeText(e.innerText);
                setTimeout(() => {
                    copyDiv.innerText = "Copy code"
                    copyDiv.appendChild(copyBtn)
                }, 2000)
            })
        }
    })
}

let bardClientMsg = (quer) => {
    let bardClientDiv = document.createElement("div")
    bardClientDiv.setAttribute("class", "bardClientDiv")
    bardResult.appendChild(bardClientDiv)
    bardClientDiv.innerText = quer
}

let gptClientMsg = (quer) => {
    let gptClientDiv = document.createElement("div")
    gptClientDiv.setAttribute("class", "gptClientDiv")
    gptResult.appendChild(gptClientDiv)
    gptClientDiv.innerText = quer
}

const bardCopySection = (bardResponseDiv) => {
    chrome.storage.local.get(["mode"], (result) => {
        if (result.mode === "on") {
            let codeTags = document.querySelectorAll("#panel code");
            let copyDivs = document.querySelectorAll("#copyDiv")
            let copyBtns = document.querySelectorAll("#copyBtn")
            let copyPanel = document.querySelectorAll("#copyPanel")

            bardResponseDiv.style.background = "#161B22"

            codeTags.forEach((codeTag) => {
                codeTag.style.background = "#161B22";
                codeTag.style.color = "#fff";
            });
            copyDivs.forEach((copyDiv) => {
                copyDiv.style.color = "#E7E8EB"
            });
            copyBtns.forEach((copyBtn) => {
                copyBtn.src = "../static/images/copyIcon.svg"
            })
            copyPanel.forEach((cPanel) => {
                cPanel.style.background = "#1E2336"
            })
        } else {
            bardResponseDiv.style.background = "#F4F5FA"
            codeTags.forEach((codeTag) => {
                codeTag.style.background = "#F4F5FA";
                codeTag.style.color = "#000";
            });
            copyDivs.forEach((copyDiv) => {
                copyDiv.style.color = "#6170AB"
            });
            copyBtns.forEach((copyBtn) => {
                copyBtn.src = "../static/images/copyIconDark.svg"
            })
            copyPanel.forEach((cPanel) => {
                cPanel.style.background = "#DADDEA"
            })
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
            gptResponseDiv.style.background = "#161B22"

            codeTags.forEach((codeTag) => {
                codeTag.style.background = "#161B22";
                codeTag.style.color = "#fff";
            });

            copyDivs.forEach((copyDiv) => {
                copyDiv.style.color = "#E7E8EB"
            });
            copyBtns.forEach((copyBtn) => {
                copyBtn.src = "../static/images/copyIcon.svg"
            })
            copyPanel.forEach((cPanel) => {
                cPanel.style.background = "#1E2336"
            })
        } else {
            gptResponseDiv.style.background = "#F4F5FA"
            codeTags.forEach((codeTag) => {
                codeTag.style.background = "#F4F5FA";
                codeTag.style.color = "#000";
            });
            copyDivs.forEach((copyDiv) => {
                copyDiv.style.color = "#6170AB"
            });
            copyBtns.forEach((copyBtn) => {
                copyBtn.src = "../static/images/copyIconDark.svg"
            })
            copyPanel.forEach((cPanel) => {
                cPanel.style.background = "#DADDEA"
            })
        }
    })
}

let bardResponseMsg = (quer) => {
    let bardResponseDiv = document.createElement("div")
    bardResponseDiv.setAttribute("class", "bardResponseDiv")
    bardResult.appendChild(bardResponseDiv)
    bardResponseDiv.innerHTML = quer
    hljs.highlightAll()
    copyBtnListener()
    bardCopySection(bardResponseDiv)
    bardResult.scrollTop = bardResponseDiv.offsetTop;

    let copyBardRes = document.createElement("div")
    copyBardRes.setAttribute("id", "copyBardRes")
    copyBardRes.setAttribute("title", "Copy response")
    bardResult.appendChild(copyBardRes)
    let bardResCopy = document.createElement("img")
    bardResCopy.setAttribute("id", "bardResCopy")

    chrome.storage.local.get(["mode"], (result) => {
        if (result.mode === "on") {
            bardResCopy.src = "../static/images/copyIcon.svg"
        } else {
            bardResCopy.src = "../static/images/copyIconDark.svg"
        }
    })

    copyBardRes.appendChild(bardResCopy)

    bardResCopy.addEventListener("click", () => {
        navigator.clipboard.writeText(bardResponseDiv.innerText);
    })
}

let gptResponseMsg = (quer) => {
    let gptResponseDivLen = document.getElementsByClassName("gptResponseDiv").length
    let gptResponseDiv = document.getElementsByClassName("gptResponseDiv")[gptResponseDivLen - 1]

    gptResponseDiv.innerHTML = quer
    gptResponseDiv.style.display = "block"
    hljs.highlightAll()
    copyBtnListener()
    gptCopySection(gptResponseDiv)
    gptResult.scrollTop = gptResponseDiv.offsetTop;

    if (gptResponseCopy && quer != "") {
        let copyGptRes = document.createElement("div")
        copyGptRes.setAttribute("id", "copyGptRes")
        copyGptRes.setAttribute("title", "Copy response")

        gptResult.appendChild(copyGptRes)
        let gptResCopy = document.createElement("img")
        gptResCopy.setAttribute("id", "gptResCopy")
        gptResCopy.src = "../static/images/copyIconDark.svg"
        chrome.storage.local.get(["mode"], (result) => {
            if (result.mode === "on") {
                gptResCopy.src = "../static/images/copyIcon.svg"
            } else {
                gptResCopy.src = "../static/images/copyIconDark.svg"
            }
        })
        copyGptRes.appendChild(gptResCopy)

        gptResCopy.addEventListener("click", () => {
            navigator.clipboard.writeText(gptResponseDiv.innerText);
        })
        gptResponseCopy = false
    }
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    let { message } = request
    if (message === "bardAnswer") {
        bardLoader.style.display = "none"

        let { bardAnswer } = request
        if (bardMultipleMsg) {
            let final_bard_answer = JSON.parse(bardAnswer)
            if (final_bard_answer === null) {
                bard_login.style.display = "flex"
            } else {
                try {
                    bardResult.style.display = "flex"
                    const markdown = window.markdownit()
                    const html = markdown.render(final_bard_answer[4][0][1][0])

                    bard_conv_id.Cval = final_bard_answer[1][0] || ""
                    bard_conv_id.Rval = final_bard_answer[1][1] || ""
                    bard_conv_id.RCval = final_bard_answer[4][0][0] || ""

                    bardResponseMsg(html)
                } catch (error) {
                    bard_login.style.display = "flex"
                }
            }
            bardMultipleMsg = false
        }
    } else if (message === "bardNotAvailable") {
        bardResult.style.display = "none"
        bardLoader.style.display = "none"
        bard_login.style.display = "flex"
    } else if (message === "answer") {
        gptResult.style.display = "flex"
        gptLoader.style.display = "none"
        gpt_login.style.display = "none"

        let { answer } = request
        const markdown = window.markdownit()
        const html = markdown.render(answer)
        gptResponseMsg(html)
    } else if (message === "gptErrAnswer") {
        gptResult.style.display = "none"
        gptLoader.style.display = "none"
        gpt_login.style.display = "flex"
        gptResult.innerHTML = "something went wrong"
    }
})
