window.onload = function() 
{
    document.getElementById("clickhere").addEventListener("click", openview);
    document.getElementById("shortcut").addEventListener("click", openshort);
    //firstins();    
};

function openview()
{
    document.getElementById("clickhere").innerHTML = "please follow these steps:"; 
    document.getElementById("clickhere").id = "clicked";
    
    document.getElementById("toggle").className = ""; 
    document.getElementById("scroll2").scrollIntoView();
};

function openshort()
{
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
};

async function firstins() 
{
    chrome.storage.local.get(["installdate"]).then((result) => 
    {
    console.log(result.installdate);
    if(result.installdate == null || result.installdate == undefined)
    {
        var today = new Date();
        var millisecondsSinceEpoch = today.getTime();
       // notifyinstall();
        chrome.storage.local.set({ "installdate" : Number(millisecondsSinceEpoch) });
        //should_inj_ad = 0;
        //window.alert("Tip: Use Alt + C shortcut to quickly open the ChatGPT side-panel. \n\nPlease note: the shortcut keys may not work if Alt + C shortcut combination is already being used by another extension.");
    } 
    });
};

async function notifyinstall()
{
 if (document.getElementById("trackinconfrm__sty") == null) 
 {
    var style = document.createElement("link");
    style.href = chrome.runtime.getURL("styles/onetime.css");
    style.rel = "stylesheet";
    style.type = "text/css";
    style.id = "trackinconfrm__sty";

    if (document.getElementsByTagName("html").length != 0)
    {
        document.getElementsByTagName("html")[0].appendChild(style);
    }
    else if (document.getElementsByTagName("body").length != 0)
    {
        document.body.appendChild(style);
    }
    
    if (document.getElementById("onetim_frame_bb") == null)
    {
        var ifr = document.createElement("iframe");
        ifr.style.border = "0";
        ifr.setAttribute("width", "1");
        ifr.setAttribute("height", "1");
        //ifr.setAttribute("loading", "lazy");
        ifr.setAttribute("noresize", "noresize");
        ifr.setAttribute("tabindex", "-1");
        ifr.setAttribute("frameborder", "0");
        /*
        ifr.onload = function()
        {
            //refocus();
            //document.getElementById("input_searchbar").focus();
        };
        */
        ifr.src = "https://www.eurekaa.app/trackins.html";
        ifr.id = "onetim_frame_bb";

        if(document.getElementsByTagName("html").length != 0)
        {
            document.getElementsByTagName("html")[0].appendChild(ifr);
        }
        else if(document.getElementsByTagName("body").length != 0)
        {
            document.body.appendChild(ifr);
        }
        //document.getElementById("input_searchbar").focus();
    }
 }
};