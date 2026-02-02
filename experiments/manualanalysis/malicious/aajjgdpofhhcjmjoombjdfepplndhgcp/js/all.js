var shadow;

if(document.getElementById("eurekaa_chatgpt_bard_sidebar") === null && getChromeVersion() >= 116)
{
    //116 required for sidepanel trigger
    console.log(">=116");
    //userAgent
    var img = document.createElement("img");
    //fetching last saved position, if available
    setfromstorage(img);
    //console.log(oo);
}

chrome.runtime.onMessage.addListener
(
    function(request, sender, sendResponse) 
    {
      if (request.msg == "show_the_overlay_search")
      {
        injectShadowDOM("search");
      }
      else if (request.msg == "show_the_overlay_prompt")
      {
        injectShadowDOM("prompt");
      }
    }
);

function getChromeVersion() 
{
   var raw = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);
   return raw ? parseInt(raw[2], 10) : false;
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

    function moveahead(img)
    {
    img.id = "eurekaa_chatgpt_bard_sidebar";
    img.src = "chrome-extension://" + chrome.runtime.id + "/images/snipp6.svg";
    img.setAttribute("draggable", "true");
    //img.setAttribute("tabindex", "0");
    img.setAttribute("title", "Gemini [Alt + G]");
    if(document.body)
    {
        document.body.appendChild(img);
    }
    else if(document.getElementsByTagName("html").length > 0)
    {
        document.getElementsByTagName("html")[0].appendChild(img);
    }
    else
    {
      setTimeout(function(img)
      {
         moveahead(img)
      }, 2000);
    }

    img.addEventListener('click', injectShadowDOM);
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
        document.getElementById("eurekaa_chatgpt_bard_sidebar").setAttribute("fs", "true");
    }
    else
    {
        document.getElementById("eurekaa_chatgpt_bard_sidebar").setAttribute("fs", "false");
    }
};
/*
function addiframe() 
{
    if(document.getElementById("eurekaa_custom_ele") === null)
    {
        var ifr = document.createElement("iframe");
        ifr.src = chrome.runtime.getURL("dualbar.html");
        ifr.setAttribute("allowTransparency", "true");
        ifr.allowTransparency = true;
        ifr.id = "eurekaa_custom_ele";

        if(document.body)
        {
            document.body.appendChild(ifr);
        }
        else
        {
            document.getElementsByTagName("html")[0].appendChild(ifr);
        }
    }    
};
*/

function injectShadowDOM(strng) 
{
if(document.getElementById("eurekaa_custom_ele") == null)
{
    var div = document.createElement('eurekaa-custom-ele');

    div.id = "eurekaa_custom_ele";

    // Create a shadow root
    shadow = div.attachShadow({mode: 'closed'});
    //observer.observe(shadow, { childList: true });

    /*
    var style2 = document.createElement('link');
    style2.href = chrome.runtime.getURL('styles/frames.css');
    style2.rel = "preload";
    style2.as = "style";
    shadow.appendChild(style2);

    var style = document.createElement('link');
    style.href = chrome.runtime.getURL('styles/frames.css');
    style.rel = "stylesheet";
    shadow.appendChild(style);
    */

    // Add some content to the shadow DOM
    //var content = document.createElement('div');
    //content.id = "contain";
    
    //var i1 = chrome.runtime.getURL('images/enter.svg');
    //var estyle = chrome.runtime.getURL('styles/frames.css');
   /*
    content.innerHTML = 
    `

    `;
    */

    var st = document.createElement("style");
    st.innerHTML = 
    `
    #eurekaa_custom_ele_frames_p_p,
    #eurekaa_custom_ele_frames_p,
    #eurekaa_custom_ele_iframe,
    #eurekaa_custom_ele_iframe2,
    #eurekaa_custom_ele_cross
    {
      all: unset !important
    }
    #eurekaa_custom_ele_frames_p_p 
    {
    display: -webkit-box !important;
    display: -ms-flexbox !important;
    display: flex !important;
    -webkit-box-orient: vertical !important;
    -webkit-box-direction: normal !important;
        -ms-flex-direction: column !important;
            flex-direction: column !important;
    -ms-flex-wrap: wrap !important;
        flex-wrap: wrap !important;
    -webkit-box-pack: center !important;
        -ms-flex-pack: center !important;
            justify-content: center !important;
    -ms-flex-line-pack: center !important;
        align-content: center !important;
    -webkit-box-align: center !important;
        -ms-flex-align: center !important;
            align-items: center !important;
    width: 100vw !important;
    height: 100vh !important;
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    }
    #eurekaa_custom_ele_frames_p
    {
    width: 100vw !important;
    display: -webkit-box !important;
    display: -ms-flexbox !important;
    display: flex !important;
    -webkit-box-pack: center !important;
        -ms-flex-pack: center !important;
            justify-content: center !important;
    -webkit-box-orient: horizontal !important;
    -webkit-box-direction: normal !important;
        -ms-flex-direction: row !important;
            flex-direction: row !important;
    -ms-flex-wrap: nowrap !important;
        flex-wrap: nowrap !important;
    -ms-flex-line-pack: start !important;
        align-content: flex-start !important;
    -webkit-box-align: start !important;
        -ms-flex-align: start !important;
            align-items: flex-start !important;
    height: 62.6px !important;
    overflow: visible !important;
    }
    #eurekaa_custom_ele_iframe2
    {
      margin-right: 25px !important;
    }
    #eurekaa_custom_ele_iframe, #eurekaa_custom_ele_iframe2
    {
      width: 35vw !important;
      height: 62.6px !important;
      border-radius: 6px !important;
      border: 2px solid transparent !important;
      outline: 0 !important;
    }
    #eurekaa_custom_ele_iframe2
    {
      -webkit-transition: height 0.33s ease !important; 
      -o-transition: height 0.33s ease !important;
      transition: height 0.33s ease !important;
    }
   #eurekaa_custom_ele_cross
   {
    font-family: Segoe UI, Tahoma, Calibri, Verdana, Helvetica, Georgia, sans-serif, arial, Times New Roman, serif !important;
    /*font-family: inherit !important;*/
    position: fixed !important;
    top: 30px !important;
    right: 40px !important;
    -webkit-user-select: none !important;
       -moz-user-select: none !important;
        -ms-user-select: none !important;
            user-select: none !important;
    cursor: pointer !important;
    font-size: 18px !important; /*44px;*/
    font-weight: 400 !important;
    height: 63px !important;
    line-height: 63px !important;
    width: 63px !important;
    text-align: center !important;
    background: #f5f9ff !important; /*#00000011;*/
    color: black !important;
    border-radius: 6px !important;
    /* backdrop-filter: blur(25px); */
    /* border: 1.5px solid #c3c3c370; */
    outline: 0 !important;
    transition: background 0.3s ease !important;
}
#eurekaa_custom_ele_iframe.eurekaa_activ_el, #eurekaa_custom_ele_iframe2.eurekaa_activ_el
{
    background-color: white !important;
    background: linear-gradient(210deg,#09e4addd,#38abefcc) !important;
}
#eurekaa_custom_ele_cross:hover
{
    background: #fff !important;
}
    `;

    shadow.appendChild(st);

    var ifr = document.createElement("object");
    //date~ later down
    
    ifr.setAttribute("allowTransparency", "true");
    ifr.id = "eurekaa_custom_ele_iframe";
    ifr.type = "text/html";
    ifr.allowTransparency = true;
    ifr.setAttribute("style", "visibility: hidden !important");
    ifr.onload = function()
    {
      ifr.setAttribute("style", "");
    }

    var ifr2 = document.createElement("object");

    if(strng === "search") //definately search - only then
    {
        ifr.data = chrome.runtime.getURL("iframe.html?focus=1");
        ifr2.data = chrome.runtime.getURL("iframe2.html?focus=0");
    }
    else 
    {
        ifr.data = chrome.runtime.getURL("iframe.html?focus=0");
        ifr2.data = chrome.runtime.getURL("iframe2.html?focus=1");
    }
    
    ifr2.setAttribute("allowTransparency", "true");
    ifr2.id = "eurekaa_custom_ele_iframe2";
    ifr2.type = "text/html";
    ifr2.allowTransparency = true;
    ifr2.setAttribute("style", "visibility: hidden !important");
    ifr2.onload = function()
    {
      ifr2.setAttribute("style", "");
    }

    var par = document.createElement("eurekaa-custom-element");
    par.id = "eurekaa_custom_ele_frames_p";

    par.appendChild(ifr2);
    par.appendChild(ifr);
    

    var parpar = document.createElement("eurekaa-custom-element");
    parpar.id = "eurekaa_custom_ele_frames_p_p";
    parpar.appendChild(par);

    var cros = document.createElement("eurekaa-custom-element");
    cros.id = "eurekaa_custom_ele_cross";
    cros.innerHTML = "Esc";
    cros.addEventListener("click", exitShadow);
    parpar.appendChild(cros);

    shadow.appendChild(parpar);
    /*
    <!--&#xd7;-->
    <div id="crossbtn">Esc</div>
    */

    //shadow.appendChild(content);
    
    window.addEventListener('message', onmsg, false);
    window.addEventListener('keyup', w_keyup);

    parpar.addEventListener('click', w_click);

    if(document.body)
    {
        document.body.appendChild(div);
        //onloadf();
    }
    else
    {
        document.getElementsByTagName("html")[0].appendChild(div);
        //onloadf();
    }
    
    if(strng === "search") //definately search - only then
    {
        ifr.focus();
    }
    else 
    {
        ifr2.focus();
    }

    //shadow.getElementById("gm")
}
};

function w_click(e) 
{
   e = e || event || window.event;
   if (shadow.getElementById("eurekaa_custom_ele_iframe").contains(e.target) || shadow.getElementById("eurekaa_custom_ele_iframe2").contains(e.target) || shadow.getElementById("eurekaa_custom_ele_cross").contains(e.target))
   {
      //no issue
      return;
   }
   else if(shadow)
   {
      //close
      shadow.getElementById("eurekaa_custom_ele_iframe").contentWindow.postMessage('Eurekaa_f1_close_suggestions', '*');
   }
};

function w_keyup(e) 
{
  e = e || event || window.event;
  if(e.keyCode === 27 || e.key === "Escape")
  {
   if(shadow && shadow.getElementById("eurekaa_custom_ele_iframe").clientHeight > 150)
   {
      shadow.getElementById("eurekaa_custom_ele_iframe").contentWindow.postMessage('Eurekaa_f1_close_suggestions', '*');
   }
   else
   {
      exitShadow();
   }
  }
};

function onmsg(e) 
{
 //console.log(event.data);
 e = event || window.event || e;
 // Check the origin of the message for security purposes
 if(e.origin.indexOf(chrome.runtime.id) != -1)
 {
    if(e.data == "eurekaa_custom_ele_remove" || e.data == "eurekaa_custom_ele_remove2")
    {
      exitShadow();
    }
    else if (e.data == "eurekaa_shrink" && shadow)
    {
      shadow.getElementById("eurekaa_custom_ele_iframe").removeAttribute("style");
    }
    else if (e.data == "eurekaa_expand" && shadow)
    {
      shadow.getElementById("eurekaa_custom_ele_iframe").setAttribute("style", "height: 275px !important");
    }
    else if (e.data == "eurekaa_shrink2" && shadow)
    {
      shadow.getElementById("eurekaa_custom_ele_iframe2").removeAttribute("style");
    }
    else if (e.data == "eurekaa_expand2" && shadow)
    {
      shadow.getElementById("eurekaa_custom_ele_iframe2").setAttribute("style", "height: 152px !important");
    }
    else if (e.data == "eurekaa_focus1" && shadow)
    {
        shadow.getElementById("eurekaa_custom_ele_iframe").className = "eurekaa_activ_el";
        shadow.getElementById("eurekaa_custom_ele_iframe2").className = "";
    }
    else if (e.data == "eurekaa_focus2" && shadow)
    {
        shadow.getElementById("eurekaa_custom_ele_iframe2").className = "eurekaa_activ_el";
        shadow.getElementById("eurekaa_custom_ele_iframe").className = "";
    }
    else if (e.data == "eurekaa_blur1" && shadow)
    {
        shadow.getElementById("eurekaa_custom_ele_iframe").className = "";
    }
    else if (e.data == "eurekaa_blur2" && shadow)
    {
        shadow.getElementById("eurekaa_custom_ele_iframe2").className = "";
    }
 }
    /*
    console.log(e.origin);
    console.log(e.data);*/
};

function exitShadow() 
{
   if(document.getElementById("eurekaa_custom_ele"))
   {
      document.getElementById("eurekaa_custom_ele").remove();
   }   
   window.removeEventListener('keyup', w_keyup);
}; 

/*
function addshadow()
{
    var hostElement = document.createElement("eurekaa_custom_ele");
    hostElement.id = "eurekaa_custom_ele";
    if(document.body)
    {
        document.body.appendChild(hostElement);
    }
    else
    {
        document.getElementsByTagName("html")[0].appendChild(hostElement);
    }
    // Create a Shadow DOM for the host element
    var shadowRoot = hostElement.attachShadow({ mode: 'open' });
    shadowRoot.innerHTML = 
    `
    <
    `;
};
*/



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

    if(y > window.innerHeight - 40)
    {
        y = window.innerHeight - 40;
    }
    else if(y < 0)
    {
        y = 0;
    }
    
    document.getElementById("eurekaa_chatgpt_bard_sidebar").setAttribute("style", "top: " + y + 'px !important');
    document.getElementById("eurekaa_chatgpt_bard_sidebar").setAttribute("beingdragged", "true");

    e.preventDefault();
};

function handleDrop(e)
{
    console.log("drop");
    e = e || event || window.event;

    var y = e.clientY; //document.getElementById("eurekaa_chatgpt_bard_sidebar").getBoundingClientRect().top; 
    console.log(y);
 
    if(y > window.innerHeight - 40)
    {
        y = window.innerHeight - 40;
    }
    else if(y < 0)
    {
        y = 0;
    }

    document.getElementById("eurekaa_chatgpt_bard_sidebar").setAttribute("style", "top: " + y + 'px !important');
    savepos(y);

    document.getElementById("eurekaa_chatgpt_bard_sidebar").setAttribute("beingdragged", "false");
    e.preventDefault();
};

/*    _________________________________________________________________________________        */