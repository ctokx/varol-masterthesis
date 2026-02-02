if (document.readyState === 'complete') 
{
    // The page is fully loaded
    checknow();
}
else
{
    window.addEventListener("load", checknow);
}  


function checknow()
{
if (window === window.top) 
{
    console.log('This is the topmost frame.');
    //ignore

    var ur = window.location.origin + window.location.pathname;

    if(ur === "https://chat.openai.com/" || ur === "https://chat.openai.com")
    {
        if(localStorage.getItem("tooltip_over") != "over")
        {
            addtooltip();
        }
    }
} 
else 
{
    // Listen to the popstate event
    window.addEventListener('popstate', checknow);

    console.log('This is not the topmost frame.'); //iframe detected
    console.log(window.location.href);

    var ur = window.location.origin + window.location.pathname;

    if((ur === "https://chat.openai.com/" || ur === "https://chat.openai.com") && (window.location.href.indexOf("p=111") != -1 || window.location.href.indexOf('p%3D111') != -1))
    {
        myiframe_loggedin();
    }
    else if(window.location.href.indexOf("chat.openai.com/auth/login") != -1 || window.location.href.indexOf("openai.com/auth/login") != -1 || window.location.href.indexOf("openai.com/u/login") != -1)
    {
        //maybe user logged out
        myiframe_loggedout();
    }
}
};

function myiframe_loggedin()
{
    window.focus();
    document.body.focus();
    
    if(document.getElementsByTagName("form").length > 0)
    {
        document.getElementsByTagName("form")[0].focus();
    }

    if(document.getElementById("prompt-textarea"))
    {
        document.getElementById("prompt-textarea").focus();
        document.getElementById("prompt-textarea").click();
    }  

    a_events(); //chatui - observe <a> clicks
    addcss(); //hide certain elements, chat ui only
    prompt_event(); //prompt enter fix, chat ui only
    mouseEvent(); //textarea event 
};

function myiframe_loggedout()
{
    //checkbtn(); //check for login buttons, login ui only
    a_events(); //<a> clicks in new tab nonetheless
};

function mouseEvent()
{
    if(document.getElementById("prompt-textarea"))
    {
        document.getElementById("prompt-textarea").addEventListener("mouseover", mouseov);
        document.getElementById("prompt-textarea").addEventListener("mousemove", mouseov);
    }
    if(document.getElementsByTagName("form").length > 0)
    {
        document.getElementsByTagName("form")[0].addEventListener("mouseover", mouseov);
        document.getElementsByTagName("form")[0].addEventListener("mousemove", mouseov);
    }

    window.addEventListener("mouseover", mouseov);

    setTimeout(() => {
        window.removeEventListener("mouseover", mouseov);
    }, 3200);
};
function mouseov()
{
    if(document.getElementById("prompt-textarea"))
    {
        //document.getElementById("prompt-textarea").click();
        document.getElementById("prompt-textarea").focus();
        return;
    }   
};

function a_events()
{

        window.onmousedown = function(event) 
        {
            //console.log(event.target);
            //window.location.hostname === 'chat.openai.com' &&

            if(event.target && (event.target.tagName === 'A' || event.target.tagName === 'a'))
            {
                //just a confirmation
                //pkka tag is link?
                var href = event.target.getAttribute('href'); // Get the URL from the clicked link
                //https://www.example.com/xyz/abc
                if(href != null && href != "" && href != "#" && href != undefined && href.indexOf("https://chat.openai.com") === -1 && href.indexOf("http://chat.openai.com") === -1 && (href.indexOf("https://") != -1 || href.indexOf("http://") != -1))
                {
                    //currently on chat.openai.com, confirmed
                    //clicked <a> link
                    //valid & legit href
                    //href isn't on same path [chat.openai.com]
                    //chat.openai.com not found ~ some other url
                    //either https or http found in url - legit to open in nt
                    //some other may be not supported ~ open in nt
                    event.preventDefault();
                    console.log('Link clicked:', href);
                    event.target.setAttribute("target", "_blank");
                    return;
                }
                else
                {
                    return;
                }
                //event.preventDefault(); // Prevent the default behavior of following the link  
            }
            else if(event.target.parentElement && (event.target.parentElement.tagName === 'A' || event.target.parentElement.tagName === 'a'))
            {
                //just a confirmation
                //pkka tag is link?
                var href = event.target.parentElement.getAttribute('href'); // Get the URL from the clicked link
                //https://www.example.com/xyz/abc
                if(href != null && href != "" && href != "#" && href != undefined && href.indexOf("https://chat.openai.com") === -1 && href.indexOf("http://chat.openai.com") === -1 && (href.indexOf("https://") != -1 || href.indexOf("http://") != -1))
                {
                    //currently on chat.openai.com, confirmed
                    //clicked <a> link
                    //valid & legit href
                    //href isn't on same path [chat.openai.com]
                    //chat.openai.com not found ~ some other url
                    //either https or http found in url - legit to open in nt
                    //some other may be not supported ~ open in nt
                    event.preventDefault();
                    console.log('Link clicked:', href);
                    event.target.parentElement.setAttribute("target", "_blank");
                    return;
                }
                else
                {
                    return;
                }
                //event.preventDefault(); // Prevent the default behavior of following the link  
            }
            else if
            ((event.target || event.target.parentElement) &&
             (event.target.tagName == "button" || event.target.tagName == "BUTTON" || event.target.parentElement.tagName == "button" || event.target.parentElement.tagName == "BUTTON") && 
             (event.target.textContent == 'Log in' || event.target.textContent == 'Sign up'))
            {
                event.preventDefault();
                console.log("logged");
                openinbrowser();
            }
            else if
            ((event.target || event.target.parentElement) && 
            (event.target.tagName == "button" || event.target.tagName == "BUTTON" || event.target.parentElement.tagName == "button" || event.target.parentElement.tagName == "BUTTON" || event.target.parentElement.parentElement.tagName == "BUTTON" || event.target.parentElement.parentElement.tagName == "button") && 
            (event.target.textContent == 'Upgrade to Plus' || event.target.textContent == 'Upgrade to ChatGPT Plus'))
            {
                event.preventDefault();
                console.log("logged");
                alert("For payment processing purposes, please open ChatGPT in a browser tab.");
                return false;
            }
        };      
   
};

function prompt_event()
{
    //prompt textarea? -> enter issue fix!
    if(document.getElementById("prompt-textarea"))
    {
       window.addEventListener("keydown", sendifenter);
       console.log("ac");
       //observechanges(document.getElementById("prompt-textarea"));
    }
};

/*
function observechanges(obj)
{
           // Create a new instance of MutationObserver
           var observer = new MutationObserver(function(mutationsList) 
           {
             mutationsList.forEach(function(mutation) 
             {
               if (mutation.type === 'childList' && mutation.removedNodes.length > 0) 
               {
                 // Check if the removedNodes list contains the target element
                 var removedNodes = Array.from(mutation.removedNodes);

                 if (removedNodes.includes(obj)) 
                 {
                   console.log('Element has been removed');
                   observer.disconnect();
                   // Perform any additional actions here
                   prompt_event();
                 }
               }
             });
           });
           
           // Start observing changes on the target element and its descendants
           observer.observe(document.body, { childList: true, subtree: true });
};
*/


function addcss()
{
    var sty = document.createElement("style");
    sty.innerHTML = 
    `
    nav > .border-t > a.flex > .flex
    {
      display: none !important;
    }
    nav > .border-t > a.flex
    {
        padding: 0 !important;
    }
    `;

    document.body.appendChild(sty); //chat ui -> hide upgrade, cors
};

/*
function checkbtn()
{
        //found chatgpt, my specific iframe one!
        //find button > check text
        console.log("a");
        if(document.getElementsByTagName("button")[0] != undefined && document.getElementsByTagName("button")[0] != null)
        {
            console.log("b"); //button exists
            if(document.getElementsByTagName("button")[0].textContent == 'Log in')
            {
                //login found!
                console.log("c");
                document.getElementsByTagName("button")[0].addEventListener("click", openinbrowser);
                //open it in tab
                if(document.getElementsByTagName("button")[1] != undefined && document.getElementsByTagName("button")[1] != null)
                {
                    console.log("d");
                    document.getElementsByTagName("button")[1].addEventListener("click", openinbrowser);
                    //2nd event!
                }
            }
        }
};
*/

function sendifenter(e)
{
    e = e || window.event;
    console.log(e);
    if(e.key === "Enter" && !e.shiftKey && !e.altKey && !e.ctrlKey && e.key != "Tab" && e.target.id === "prompt-textarea")
    {
        //key we're lookin for!
        if(document.getElementById("prompt-textarea") && document.getElementById("prompt-textarea").parentElement.getElementsByTagName("button"))
        {
            //button to click exists
            try 
            {
                document.getElementById("prompt-textarea").parentElement.getElementsByTagName("button")[0].click();
                //try clicking
            } 
            catch(error) 
            {
                console.log(error);
                //normal operations
                return;
            }
            
            //didn't return - no errors
            //prevent default enter action of n/l -> sending i/p
            e.preventDefault();
            return false;
        }
    }
};

function openinbrowser(e)
{
    e = e || window.event;
    window.open("https://chat.openai.com/auth/login/", "_blank");
    messageparent();

    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();
    return false;
};

function messageparent()
{
// Send a message from the iframe to the parent frame
window.parent.postMessage('Overlay notice active', '*');
};

function addtooltip()
{
    var tt = document.createElement("div");
    tt.innerHTML = 
    `
    <style>
    #ttcgptsb
    {
        position: fixed;
        top: 20px;
        right: 35px;    
        z-index: 2147483647;
    }
    .tooltip {
        position: relative;
        display: inline-block;
      }
      
      .tooltip .tooltiptext {
        visibility: hidden;
        width: 285px;
        background-color: #2d2f38;
        color: #f1f1f1;
        text-align: center;
        border-radius: 6px;
        padding: 10px;
        font-size: 14px;
        padding-left: 12px;
        padding-right: 12px;
        /* line-height: normal; */
        position: absolute;
        z-index: 1;
        top: 130%;
        right: 0;
        opacity: 0;
        -webkit-transition: all 0.3s;
        -o-transition: all 0.3s;
        transition: all 0.3s;
        -webkit-transition-delay: 400ms;
             -o-transition-delay: 400ms;
                transition-delay: 400ms;
      }
      
      .tooltip:hover .tooltiptext,
      .tooltiptext:hover
      {
        visibility: visible;
        opacity: 1;
        -webkit-transition-delay: 0ms;
             -o-transition-delay: 0ms;
                transition-delay: 0ms;
      }          
      .i
      {
        font-style: italic;
        font-size: 18px;
        height: 30px;
        display: block;
        text-align: center;
        color: #fff;
        line-height: 30px;
        width: 30px;
        background: #494a54;
        border-radius: 50%;
        font-family: serif, emoji, ui-monospace, ui-rounded, system-ui, -webkit-body;
        -webkit-user-select: none;
           -moz-user-select: none;
            -ms-user-select: none;
                user-select: none;
      }
      #d_s_i_a, #n_w_h_p
      {
        cursor: pointer;
        font-size: 13px;
        height: 26px;
        display: inline-block;
        color: #fff;
        line-height: 26px;
        width: auto;
        padding-left: 12px;
        padding-right: 12px;
        background: #3d3e4c;
        margin-top: 10px;
        border-radius: 3px;
        -webkit-user-select: none;
           -moz-user-select: none;
            -ms-user-select: none;
                user-select: none;
        -webkit-transition: background 0.35s ease;
        -o-transition: background 0.35s ease;
        transition: background 0.35s ease;
      }
      #d_s_i_a:hover, 
      #n_w_h_p:hover      
      {
         background: #494a54;
      }
      #n_w_h_p
      {
          margin-right: 10px;
      }
      .tooltiptext::before {
        display: block;
        content: "";
        position: absolute;
        top: -4px;
        background: inherit;
        right: 10px;
        height: 10px;
        width: 10px;
        -webkit-transform: rotate(45deg);
            -ms-transform: rotate(45deg);
                transform: rotate(45deg);
    }
    </style>

    <div class="tooltip">
    <span class="i">i</span>
    <span class="tooltiptext">Use [ Alt + C ] shortcut to seamlessly access the ChatGPT side panel.
    <br>
    <span id="n_w_h_p">Not working?</span><span id="d_s_i_a">Don't show again</span>
    </span>
    </div>  
    `;
    tt.id = "ttcgptsb";
    document.body.appendChild(tt);

    document.getElementById("n_w_h_p").addEventListener("click", openNWHP);
    document.getElementById("d_s_i_a").addEventListener("click", openDSIA);
};

function openNWHP()
{
    var today = new Date();
    var milliseconds = today.getTime();

    //change storage
    chrome.storage.local.set({ "openNWHP": milliseconds });
};
function openDSIA()
{
    localStorage.setItem("tooltip_over", "over");
    //save

    //remove
    document.getElementById("ttcgptsb").remove();
};