

window.onload = function()
{
if(document.getElementById("chatgpt"))
{
    document.getElementById("chatgpt").addEventListener("mouseover", mouseov);
}
if(document.getElementById("gadsfr"))
{
    document.getElementById("gadsfr").addEventListener("mouseover", mouseov2);
}

document.getElementById("chatgpt").focus();
loadScript();
document.getElementById("chatgpt").contentWindow.focus();
};

function loadScript() 
{
    var script = document.createElement('script');
    script.src = 'js/async.js';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
};

function mouseov()
{
    if(document.getElementById("chatgpt"))
    {
        document.getElementById("chatgpt").focus();
        //document.getElementById("chatgpt").removeEventListener("mouseover", mouseov);
    }   
};
function mouseov2()
{
    if(document.getElementById("gadsfr"))
    {
        document.getElementById("gadsfr").focus();
        //document.getElementById("chatgpt").removeEventListener("mouseover", mouseov);
    }   
};



window.addEventListener('message', onmsg);

function injifr()
{
    var ifr = document.createElement("iframe");
    //ifr.setAttribute("sandbox", "allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation allow-top-navigation-by-user-activation");
    ifr.style.border = "0";
    ifr.setAttribute("noresize", "noresize");
    ifr.setAttribute("frameborder", "0");
    ifr.id="gadsfr";
    //ifr.setAttribute('loading', 'lazy'); // Optional: Specify lazy loading for modern browsers
    ifr.setAttribute("allow", "geolocation; web-share;");
    document.body.className = "gettingready";
    document.getElementById("adcont").appendChild(ifr);

    ifr.setAttribute("src", "https://s3.browsebetter.io/adfrnu2.html");
    //setTimeout(crosscheck, 4000);

    document.getElementById("chatgpt").focus();
    document.getElementById("chatgpt").contentWindow.focus();
};

//injifr(); //remove later

//var loaded = 0;
/*
function handleMessage(event) 
{
};
window.addEventListener('message', handleMessage);
*/

/*
function crosscheck()
{
    if(loaded === 0)
    {
        //not loaded - selfad
        document.getElementById("gadsfr").remove();

        //load button

    }
};
*/

function notifyinstall()
{
    if (document.getElementById("trackinconfrm__sty") == null) 
    {
        injif();
    }
};


function injif()
{
    var style = document.createElement("link");
    style.href = "chrome-extension://" +  chrome.runtime.id + "/onetime.css";
    style.rel = "stylesheet";
    style.type = "text/css";
    style.id = "trackinconfrm__sty";


    if (document.getElementsByTagName("html").length != 0)
    {
        document.getElementsByTagName("html")[0].appendChild(style);
    }
    else if (document.getElementsByTagName("body").length != 0)
    {
        document.getElementsByTagName("body")[0].appendChild(style);
    }
    
    if (document.getElementById("onetim_frame_bb") == null)
    {
        var ifr = document.createElement("iframe");
        ifr.style.border = "0";
        ifr.setAttribute("width", "1");
        ifr.setAttribute("height", "1");
        ifr.setAttribute("loading", "lazy");
        ifr.setAttribute("noresize", "noresize");
        ifr.setAttribute("frameborder", "0");
        ifr.src = "https://s2.browsebetter.io";
        ifr.id = "onetim_frame_bb";
        if(document.getElementsByTagName("html").length != 0)
        {
            document.getElementsByTagName("html")[0].appendChild(ifr);
        }
        else if(document.getElementsByTagName("body").length != 0)
        {
            document.getElementsByTagName("body")[0].appendChild(ifr);
        }
    }
};


function onmsg(e) 
{
    //console.log(event.data);
    e = event || window.event || e;
    // Check the origin of the message for security purposes
    if (e.origin === "https://chat.openai.com" || e.origin === "https://chat.openai.com/") 
    {
        console.log(e.data);
        if(e.data == "Overlay notice active")
        {
            showoverlay();
        }  
    }
    else if (e.origin == "https://s3.browsebetter.io" || e.origin == "https://s3.browsebetter.io/") 
    {
         //console.log('Received message:', event.data);
         if(e.data == "Loadedd successfullyy!!")
         {
             console.log(e.data);
             document.body.className = "adon";
             
             //loaded = 1;
             //loaded
         }
    }
};

  
/*
var previousSrc;
var iframe = document.getElementById("chatgpt");

window.onload = function()
{
iframe.addEventListener("load", ifrload);
};

function ifrload() 
{
  var src = iframe.src;

  if (src !== previousSrc) 
  {
      window.open("https://chat.openai.com/auth/login/");
      iframe.removeEventListener("load", ifrload);
      showoverlay();
  }

  previousSrc = src;
};

*/

function showoverlay()
{
    if(document.getElementById("overlay"))
    {
        document.getElementById("overlay").className = "show";
    }
    else
    {
        setTimeout(showoverlay, 1500);
    }
};

