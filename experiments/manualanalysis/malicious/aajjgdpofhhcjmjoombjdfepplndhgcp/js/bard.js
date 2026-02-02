console.log("b1");
//var once = 0;
var gate;
var T = 100;

fun1();
function fun1()
{
  if (window != window.top) //an iframe
  {
   //asap
   window.addEventListener('message', receiveMessage, false);
   window.parent.postMessage('Eurekaaframecalling_from_bard', '*'); //only one time, to syncup
  }
};

// Function to handle messages received from the iframe
function receiveMessage(event) 
{
            // Check the origin of the message to ensure security
            // For security reasons, you might want to validate the origin of the sender.
            // For simplicity, we are allowing any origin in this example.
            // In a real-world scenario, replace '*' with the actual origin you expect.
        console.log(event.origin);
        if(event.origin.indexOf(chrome.runtime.id) != -1)
        {
            if (event.data === "next_input") 
            {
                console.log("next_input");
                var ur = window.location.origin //+ window.location.pathname;
                if(ur === "https://bard.google.com/" || ur === "https://bard.google.com")
                {
                    T = 50;
                    looper();
                }
                return;
            }
            else if (event.data === "bard_pl_continue") 
            {
                console.log("bard_pl_continue");
                if (document.readyState === 'complete') 
                {
                    // The page is fully loaded
                    checknow(); //looper will start on input
                }
                else
                {
                    window.addEventListener("load", checknow); //looper will start on input
                }  
            }
            else if (event.data === "bard_pl_continue_automatically") 
            {
                console.log("bard_pl_continue_automatically");
                if (document.readyState === 'complete') 
                {
                    // The page is fully loaded
                    checknow("do it"); //looper will autostart
                }
                else
                {
                    window.addEventListener("load", function(){
                        checknow("do it"); //looper will autostart
                    });
                }  
            }
            // event.data contains the message sent from the iframe
            //console.log('Received message from iframe:', event.data);
        }
};



function checknow(next)
{    
    gate = "open";
    if(window.location.href.indexOf("singlmod=1") == -1)
    {
        //== -1 means not found -> singlmod not found, dual mode it is
        window.parent.focus();
        window.top.focus();
        window.parent.postMessage('frame loaded sccssflly', '*');
    }
    else
    {
        //not -1, means found -> singlemod it is, focus here
        window.focus(); 
        if(document.querySelector('[data-placeholder="Enter a prompt here"]'))
        {
          document.querySelector('[data-placeholder="Enter a prompt here"]').focus();
        }
        else if(document.querySelector('[aria-label="Input for prompt text"]'))
        {
          document.querySelector('[aria-label="Input for prompt text"]').focus();
        }
    }

    console.log("a2");

    window.addEventListener('popstate', fun1);

    var ur = window.location.origin // + window.location.pathname;
    if(ur === "https://bard.google.com/" || ur === "https://bard.google.com") /*&& (window.location.href.indexOf("p=333") != -1 || window.location.href.indexOf('p%3D333') != -1))*/
    {
        console.log("a3");
        
        //setTimeout(now, 1000);
        document.body.setAttribute("eurekaa_sidepanel", "true");
        //addcss();

        /*
        if(window.location.href.indexOf("singlmod=1") != -1)
        {
                initialize_ev();
        }  
        */
    }

    if(next == "do it")
    {
        var ur = window.location.origin //+ window.location.pathname;
        if(ur === "https://bard.google.com/" || ur === "https://bard.google.com")
        {
            T = 100;
            looper();
        }
    }

    /*
    if(document.querySelector('[data-placeholder="Enter a prompt here"]'))
    {
        document.querySelector('[data-placeholder="Enter a prompt here"]').addEventListener("mousemove", mouseov_bard);
        document.querySelector('[data-placeholder="Enter a prompt here"]').addEventListener("mouseover", mouseov_bard);
    }*/
};
/*
function initialize_ev()
{
    if(document.querySelector('[aria-label="Send message"]'))
    {
        document.querySelector('[aria-label="Send message"]').addEventListener("click", onceonly);
    }
    else if(document.querySelector('[mattooltip="Submit"]'))
    {
        document.querySelector('[mattooltip="Submit"]').addEventListener("click", onceonly);
    }
    else
    {
        setTimeout(initialize_ev, 750);
        return;
    }

    if(document.querySelector('[data-placeholder="Enter a prompt here"]'))
    {
        document.querySelector('[data-placeholder="Enter a prompt here"]').addEventListener("keypress", once_keypress);
    }
};
*/
/*
function mouseov_bard()
{
    if(document.querySelector('[data-placeholder="Enter a prompt here"]'))
    {
    document.querySelector('[data-placeholder="Enter a prompt here"]').focus();
    }
};*/

/*
function addcss()
{
    var sty = document.createElement("style");
    sty.innerHTML = 
    `

    `;

    document.body.appendChild(sty); //chat ui -> hide upgrade, cors
};
*/



        // Add an event listener to listen for messages from the iframe
       

/*
function emulateKeyInput(textarea, key) {
    var event = new Event('input', { bubbles: true, cancelable: false });
    event.key = key;
    event.keyCode = key.charCodeAt(0);
    textarea.dispatchEvent(event);
    return 1;
};
*/

function looper()
{
    if(gate === "open" && (document.querySelector('[data-placeholder="Enter a prompt here"]') || document.querySelector('[aria-label="Input for prompt text"]')) && document.readyState === 'complete')
    {
        now();
    }
    else
    {
        setTimeout(looper, 1000);
    }
};

function now()
{
    chrome.storage.local.get('query', function(result)
    {
        console.log("a4");

        if(document.querySelector('[data-placeholder="Enter a prompt here"]'))
        {
            var textarea = document.querySelector('[data-placeholder="Enter a prompt here"]');
        }
        else if(document.querySelector('[aria-label="Input for prompt text"]'))
        {
            var textarea = document.querySelector('[aria-label="Input for prompt text"]');
        }
        /*
        else
        {
            setTimeout(now, 1200);
            return;
        }*/

        textarea.focus();
        textarea.click();
        //textarea.innerHTML = `<p>` + result.query + `</p>`;

        var fragments = result.query.split('\n');
        var i = 0;

        //if(emulateKeyInput(textarea, 'result.query') === 1)
        if(emulateInput(result.query, textarea) === 1)
        {
            textarea.innerHTML = "";    
           
            for(i=0; i<fragments.length; i++)
            {
                var p = document.createElement("p");
                p.innerText = fragments[i];
                textarea.appendChild(p);
            }

            setTimeout(submit, T);
        }
    });
};

function emulateInput(text, textarea) 
{
    const event = new InputEvent('input', 
    {
        bubbles: true,
        cancelable: false,
        inputType: 'insertText',
        data: text
    });
  
    textarea.dispatchEvent(event);
    return 1;
};

function submit()
{
    if(document.querySelector('[aria-label="Send message"]'))
    {
        document.querySelector('[aria-label="Send message"]').click();
    }
    else if(document.querySelector('[mattooltip="Submit"]'))
    {
        document.querySelector('[mattooltip="Submit"]').click();
    }
};
/*
function onceonly()
{
    if(once === 0 && window.location.href.indexOf("singlmod=1") != -1)
    {
        //==-1 means not found, !=-1 means found
        //singlemod found ~ single mode it is
        once = 1;
        window.parent.postMessage('injifr-now', '*');
        //injifr

        removeevents();
    }  
    else
    {
        removeevents();
    }
};
*/
/*
function removeevents()
{
    if(document.querySelector('[aria-label="Send message"]'))
    {
        document.querySelector('[aria-label="Send message"]').removeEventListener("click", onceonly);
    }
    else if(document.querySelector('[mattooltip="Submit"]'))
    {
        document.querySelector('[mattooltip="Submit"]').removeEventListener("click", onceonly);
    }

    if(document.querySelector('[data-placeholder="Enter a prompt here"]'))
    {
        document.querySelector('[data-placeholder="Enter a prompt here"]').removeEventListener("keypress", once_keypress);
    }    
};
*/
/*
function once_keypress(e)
{
    e = e || window.event || event;
    if((e.key === "Enter" || e.keyCode === 13) && !e.shiftKey && !e.altKey && !e.ctrlKey)
    {
        //not shift+enter (new line)
        //just enter
        onceonly();
        return;
    } 
};*/