if(document.getElementById("flow_chatgpt_sidebar_t") === null && getChromeVersion() >= 116)
{
    console.log(">=116");
    //userAgent
    var img = document.createElement("img");
    //fetching last saved position, if available
    setfromstorage(img);
    //console.log(oo);
}

function getChromeVersion() 
{
    var raw = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);
    return raw ? parseInt(raw[2], 10) : false;
};

    function moveahead(img)
    {
    img.id = "flow_chatgpt_sidebar_t";
    img.src = "chrome-extension://" + chrome.runtime.id + "/images/snipp4.svg";
    img.setAttribute("draggable", "true");
    if(document.body)
    {
        document.body.appendChild(img);
    }
    else if(document.getElementsByTagName("html").length > 0)
    {
        document.getElementsByTagName("html")[0].appendChild(img);
    }



    img.addEventListener('click', openP);
    img.addEventListener("drag", handleDrag);
    img.addEventListener("dragend", handleDrop);

    handleFullscreenChange();
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('resize', handleFullscreenChange);
    };

function handleFullscreenChange()
{
    var isFullScreen = window.matchMedia('(display-mode: fullscreen)').matches;
    if(document.fullscreen || document.fullscreenElement || window.innerHeight === screen.height || isFullScreen)
    {
        document.getElementById("flow_chatgpt_sidebar_t").setAttribute("fs", "true");
    }
    else
    {
        document.getElementById("flow_chatgpt_sidebar_t").setAttribute("fs", "false");
    }
};

function openP()
{
    chrome.runtime.sendMessage({ type: 'open_side_panel' });
};

function setfromstorage(img)
{
    chrome.storage.local.get(["savedTopPosition"]).then((result) => 
    {
        if (result.savedTopPosition != undefined && result.savedTopPosition != null) 
        {
            img.setAttribute("style", "top: " + Number(result.savedTopPosition) + 'px !important');
            moveahead(img);
        }
        else
        {
            moveahead(img);
        }
    });
};
function savepos(val)
{
    chrome.storage.local.set({ "savedTopPosition" : Number(val) });
};

function handleDrag(e)
{
    console.log("start");
    e = e || event || window.event;
    // Get the vertical position of the mouse
    var y = e.clientY;
    console.log(y);
    // Move the draggable element to the vertical position of the mouse
    document.getElementById("flow_chatgpt_sidebar_t").setAttribute("style", "top: " + y + 'px !important');
    document.getElementById("flow_chatgpt_sidebar_t").setAttribute("beingdragged", "true");

    e.preventDefault();
};
function handleDrop(e)
{
    console.log("drop");
    e = e || event || window.event;

    var y = e.clientY; //document.getElementById("flow_chatgpt_sidebar_t").getBoundingClientRect().top; 
    console.log(y);
    document.getElementById("flow_chatgpt_sidebar_t").setAttribute("style", "top: " + y + 'px !important');

    document.getElementById("flow_chatgpt_sidebar_t").setAttribute("beingdragged", "false");

    savepos(y);
    e.preventDefault();
};