var activ, which_mode, selectedtext, chatgpt, bard, finalprompt = "", goahead = 0;
//var should_inj_ad = -1;

if(window.location.href.indexOf("C=1") != -1)
{
    //single mode
    activ = "chatgpt";
    document.body.id = "onlymode_chatgpt";
    which_mode = "single";
    document.body.setAttribute("firstvisit", "notneeded");
}
else if(window.location.href.indexOf("B=1") != -1)
{
    //single mode
    activ = "bard";
    document.body.id = "onlymode_bard";
    which_mode = "single";
    document.body.setAttribute("firstvisit", "notneeded");
}
else if(window.location.href.indexOf("promptmode=1") != -1)
{
    //prompt-mode
    activ = localStorage.getItem("active");
    which_mode = "dual";
    document.body.setAttribute("firstvisit", "notneeded");

    chrome.storage.local.get(["menu_selected_text"]).then((result) => 
    {
        if(result.menu_selected_text && result.menu_selected_text != null && result.menu_selected_text != undefined && result.menu_selected_text != "")
        {
            //not removed- prompting mode
            selectedtext = result.menu_selected_text;
            promptmode_on();
            
            chrome.storage.local.remove('menu_selected_text', function() 
            {
                console.log('been removed');
            });   
        }
        else
        {
            //already removed, 2nd visit
            document.body.removeAttribute("firstvisit");

            chrome.sidePanel.setOptions({
                path: 'sidepanel.html'
              });
              //reset!
              /* 
              1. prompt mode on - menuselected saved
              2. used in sidebar, menuselected removed
              3. next visit by user from any touch point 
              4. Imp: the sidepanel path is already preset from before
              5. sidepanel path needs to be reset for proper use
              */
        }
    });
}
else
{
    //normal, dual mode
    activ = localStorage.getItem("active");
    which_mode = "dual";
}

window.addEventListener('message', onmsg, false);

function promptmode_on()
{

  console.log(selectedtext);

  if(window.location.href.indexOf("Summarize") != -1)
  {
    finalprompt = 
`Write a concise summary that captures and encapsulates the essence, main points, important takeaways, and key highlights of the given textual content:

` +  selectedtext;
  }
  else if(window.location.href.indexOf("Simplify") != -1)
  {
    finalprompt = 
`Simplify the following given textual content so that it is simple and easy to understand, ensuring clarity while retaining the essence, core message, and key points:

` +  selectedtext;
  }
  else if(window.location.href.indexOf("Explain") != -1)
  {
    finalprompt = 
`Simplify and explain the following given textual content so that it is simple, digestible, clear, and easy to understand, while retaining the essence, context, core message, and key points:

` +  selectedtext;
  }
  else if(window.location.href.indexOf("Learnings") != -1)
  {
    finalprompt = 
`Extract and derive key learnings and core insights from the following given textual content:

` +  selectedtext;
  }
  else if(window.location.href.indexOf("Actionables") != -1)
  {
    finalprompt = 
`Analyze the following given textual content to extract and list down all the key action items & tasks:

` +  selectedtext;
  }
  else if(window.location.href.indexOf("Examples") != -1)
  {
    finalprompt = 
`Provide comprehensive examples that accurately illustrate and demonstrate the key points, concepts, & ideas presented in the following given textual content:
       
` +  selectedtext;
  }
  else if(window.location.href.indexOf("Rephrase") != -1)
  {
    finalprompt = 
`Create a rephrased version of the following given textual content to improve clarity and readability, while preserving the original meaning:
       
` +  selectedtext;
  }
  else if(window.location.href.indexOf("Paraphrase") != -1)
  {
    finalprompt = 
`Reconstruct the following given textual content by paraphrasing it, while retaining its original intent:

` +  selectedtext;
  }
  else if(window.location.href.indexOf("Proofread") != -1)
  {
    finalprompt = 
`Please thoroughly proofread, analyze, and review the following given textual content for any spelling mistakes, grammatical errors, tenses, style-related issues, typographical issues, punctuation errors, inconsistencies, or any other types of problems or issues that may be present:

` +  selectedtext;
  }
  else if(window.location.href.indexOf("Readability") != -1)
  {
    finalprompt = 
`Please improve the readability of the following given textual content, including improvements in sentence structure, clarity, formatting, style, punctuation, tone, comprehension, coherence, etc:

` +  selectedtext;
  }
  else if(window.location.href.indexOf("FormalTone") != -1)
  {
    finalprompt = 
`Please rewrite the following given text to convey the same information in a formal language, tone and style, suitable for professional or academic contextual setups:

` +  selectedtext;
  }
  else if(window.location.href.indexOf("InformalTone") != -1)
  {
    finalprompt = 
`Please rewrite the following given text in a more casual, informal, conversational, loose, personal, and relaxed langauge, tone and style:

` +  selectedtext;
  }
  else if(window.location.href.indexOf("FriendlyTone") != -1)
  {
    finalprompt = 
`Please rewrite the following given text using a warm, engaging, and inviting language and style, with a more personal, casual, friendly, relaxed, conversational, and approachable tone, while maintaining the original message and intent:

` +  selectedtext;
  }
  else if(window.location.href.indexOf("ObjectiveTone") != -1)
  {
    finalprompt = 
`Please rewrite the following given text in a more objective way, removing any subjective opinions, assumptions, or biases to ensure that the information is presented in an objective, clear, neutral, unbiased, and factual manner, while maintaining the original meaning and intent:

` +  selectedtext;
  }
  else if(window.location.href.indexOf("PersuasiveTone") != -1)
  {
    finalprompt = 
`Please transform the following given text into a compelling and persuasive piece, using persuasive language techniques and a convincing and captivating tone and style, in order to effectively engage and influence the readers while maintaining the core message, intent, and information:

` +  selectedtext;
  }
  else if(window.location.href.indexOf("TellMore") != -1)
  {
    finalprompt = 
`Please elaborate, explain, and tell me more about the following provided textual content:

` +  selectedtext;
  }  
  else if(window.location.href.indexOf("DirectPrompt") != -1)
  {
    finalprompt = selectedtext;
  }


};

/*
function w_keydown()
{
    if(which_mode == "dual")
    {
    window.focus();
    document.getElementById("input_searchbar").focus();
    }
    return;
};
*/

function refocus()
{
    if(which_mode == "dual")
    {
      window.focus();
      //document.getElementById("input_searchbar").click();
      document.getElementById("input_searchbar").focus();
    }
    return;
};

/*
function refocus2()
{
    if(which_mode == "dual")
    {
    window.focus();
    document.getElementById("input_searchbar").focus();
    }
};
*/

window.addEventListener("load", function()
{
    allevents();
    //loadScript();
    refocus();
    //setInterval(refocus, 100);
});

function openhelp()
{
    chrome.tabs.create({ url: "chrome-extension://"+chrome.runtime.id+"/welcome.html" });
};

function allevents()
{

if(which_mode == "dual")
{
document.getElementById("input_searchbar").addEventListener("mousemove", refocus);
document.getElementById("input_searchbar").addEventListener("mouseover", refocus);

document.getElementById("input_searchbar").addEventListener("blur", refocus);
window.addEventListener("blur", refocus);
document.body.addEventListener("blur", refocus);

window.addEventListener("keydown", refocus);

document.getElementById("input_searchbar").addEventListener("keydown", keydwn_input);
document.getElementById("input_searchbar").addEventListener("input", inputchanged);
document.getElementById("input_searchbar").addEventListener("change", inputchanged);
document.getElementById("entercta").addEventListener("click", hitenter);
}

/*
if(document.getElementById("chatgpt"))
{
    document.getElementById("chatgpt").addEventListener("mouseover", mouseov);
}*/
/*
if(document.getElementById("adcont"))
{
    document.getElementById("adcont").addEventListener("mouseover", mouseov2);
}
*/
document.getElementById("clickhere").addEventListener("click", openhelp);

//document.getElementById("chatgpt").focus();

//document.getElementById("chatgpt").contentWindow.focus();
//document.getElementById("frames").addEventListener("scroll", disablescroll);
//document.getElementById("frames").addEventListener("wheel", disablescroll);
/*
document.getElementById("adcont").addEventListener("scroll", disablescroll2);
document.getElementById("adcont").addEventListener("wheel", disablescroll2);
*/

// Attach an event listener to the window's resize event
window.addEventListener("resize", recheck_);

document.getElementById("chatgpt_s").addEventListener("click", set_chatgpt);
document.getElementById("bard_s").addEventListener("click", set_bard);

//document.getElementById("leftA").addEventListener("click", togglemodel);
//document.getElementById("rightA").addEventListener("click", togglemodel);

//window.addEventListener("mousemove", focuss);
/*
document.getElementById("input_searchbar").focus();
document.getElementById("input_searchbar").click();*/
//document.getElementById("input_searchbar").addEventListener("mouseover", inputactiv);
};

/*
set_now()
>
loadchatgpt() || loadbard() [load events]
>
setchatgpt() || setbard() [set src]
>
recheck() refocus() 
>
bardactive() || chatgptactive() [FE settings]

_______

toggle()
>
set_bard() || set_chatgpt() [save, BE, variable]
>
chatgptactive() || bardactive() [FE settings]
*/

async function set_now()
{
if(activ)
{
    if(activ == "chatgpt")
    {
        loadchatgpt();
    }
    else
    {
        loadbard();
    }
}
else
{
    loadchatgpt();
}
};

function inputvisible()
{
    /*
    if(document.body.getAttribute("inputvisible") != "true")
    {
        */
       // document.body.setAttribute("inputvisible", "true");
        if(finalprompt != "")
        {
            //run that.
            setTimeout(runprompt, 250);
        }
   // }
    
    refocus();
};

function runprompt() 
{
    chrome.storage.local.set
    (
        {
           "query": finalprompt
        }, 
        function()
        {
            if(finalprompt != "")
            {
              finalprompt = "";
              //callchatgpt(); /* moved to postmessage based sync */
              //callbard();
              looper2();

              //check_for_ad();
            }
        }
    );  
};
/*
function check_for_ad()
{
    if(goahead === 1)
    {
        if (typeof injifr === "function")
        {
            goahead = 2;
            //injifr();
        } 
        else
        {
            setTimeout(check_for_ad, 1200);
        }
    }  
};
*/
function looper2()
{
    if(document.getElementById("trck") && document.getElementById("trck").contentWindow.document.readyState === "complete")
    {
        //iframe exists + loaded properly
        //can send message safely
        document.getElementById("trck").contentWindow.postMessage('used_contextmenu_action' + " - " + window.location.href, '*');
    }
    else
    {
        //wait - try again in 1.5s
        setTimeout(looper2, 1500);   
    }
};

function loadchatgpt() 
{
    console.log("setC");
    setchatgpt(); //set SRC, set lazyloading, recheck FE [scrollto, underline]

    if(which_mode == "dual")
    {
        //normal func, dual mode, more loading functions
        
        document.getElementById("chatgpt").addEventListener("load", function()
        {
            setbard();            
        }); 
        //after loading - load other one, set its src, turn off lazyloading, recheck FE [scrollto, underline]
        document.getElementById("bard").addEventListener("load", function()
        {   
            recheck_();
            inputvisible();
        });
    }
    //chatgptactive(); //FE: scrollto, underline    
};

function loadbard() 
{
    console.log("setB"); 
    setbard(); //set bard

    if(which_mode == "dual")
    {
    
    document.getElementById("bard").addEventListener("load", function()
    {
        setchatgpt();
    });
    document.getElementById("chatgpt").addEventListener("load", function()
    {   
        recheck_();     
        inputvisible();
    });
    }
    //bardactive();   
};
/*
function disablescroll2(e) 
{
 e = e || event || window.event;
 e.preventDefault();
 e.stopImmediatePropagation();
 e.stopPropagation();
 return false;
};
*/
/*
function disablescroll(e) 
{
 e = e || event || window.event;
 if(document.body.getAttribute("firstvisit") != "notyet")
 {
    e.preventDefault();

    if(activ)
    {
        if(activ == "chatgpt")
        {
            document.getElementById("chatgpt").scrollIntoView({ behavior: "instant" });
        }
        else
        {
            document.getElementById("bard").scrollIntoView({ behavior: "instant" });
        }
    }
    else
    {
        document.getElementById("chatgpt").scrollIntoView({ behavior: "instant" });
    }   
   
    e.stopImmediatePropagation();
    e.stopPropagation();
    return false;
 }
};
*/

async function setchatgpt()
{
    if(which_mode == "single") //single mode
    {
        document.getElementById("chatgpt").setAttribute("tabindex", "0");
        document.getElementById("chatgpt").setAttribute("src", document.getElementById("chatgpt").getAttribute("data-src") + "?singlmod=1");
    }  
    else 
    {
        //dual mode, normal mode
        document.getElementById("chatgpt").setAttribute("src", document.getElementById("chatgpt").getAttribute("data-src"));
    }
    
    document.getElementById("chatgpt").setAttribute("loading", "eager");
    recheck_();
    console.log("chatgpt src");
    //document.body.setAttribute("input_active", "true");

    refocus(); //set udhar hi krdia
};
/*
function add_bar()
{
    if(document.getElementById("input_searchbar") == null)
    {
    document.getElementById("inputA").innerHTML = 
    `
    `;
    document.getElementById("input_searchbar").click();
    document.getElementById("input_searchbar").focus();

    allevents(2);
    }
    else
    {
        document.getElementById("input_searchbar").click();
        document.getElementById("input_searchbar").focus();       
    }
};
*/
async function setbard()
{
    //console.log("onload event B");
    if(which_mode == "single") //single mode
    {
        //single mode
        document.getElementById("bard").setAttribute("tabindex", "0");
        document.getElementById("bard").setAttribute("src", document.getElementById("bard").getAttribute("data-src") + "?singlmod=1");
    }
    else
    {
        //normal~ dual mode
        document.getElementById("bard").setAttribute("src", document.getElementById("bard").getAttribute("data-src"));
    }
    
    document.getElementById("bard").setAttribute("loading", "eager");
    recheck_();   
    console.log("bard src");
        
    refocus();
    //document.body.setAttribute("input_active", "true");
};

function recheck_()
{
    console.log(activ);

    if(activ)
    {
        if(activ == "chatgpt")
        {
            chatgptactive();
            console.log("gpt");
        }
        else
        {
            bardactive();
            console.log("brd");
        }
    }
    else
    {
        chatgptactive();
        console.log("gpt");
    } 
    
    refocus(); //udhar hi set h
    //document.getElementById("input_searchbar").focus();
};

function bardactive()
{
    document.getElementById("frames").setAttribute("context", "bard");
    //document.getElementById("frames").scrollLeft = document.getElementById("frames").scrollWidth;
    document.getElementById("bard").scrollIntoView({ behavior: "instant" });
    //document.getElementById("frames").className = "bardactive";
    document.getElementById("bard_s").className = "active";
    document.getElementById("chatgpt_s").className = "";
    //document.getElementById("frames").addEventListener("scroll", disablescroll);
};

function chatgptactive()
{
    document.getElementById("frames").setAttribute("context", "chatgpt");
    document.getElementById("chatgpt").scrollIntoView({ behavior: "instant" });
    //document.getElementById("frames").className = "chatgptactive";
    document.getElementById("chatgpt_s").className = "active";
    document.getElementById("bard_s").className = "";
    //document.getElementById("frames").addEventListener("scroll", disablescroll);
};

function inputchanged()
{
    if(document.getElementById("input_searchbar").value != null && document.getElementById("input_searchbar").value != undefined && document.getElementById("input_searchbar").value != "" && document.getElementById("input_searchbar").value != " ")
    {
        //not null/undef/""/empty
        //~ some value exists
        document.body.setAttribute("canfocus", "true");
    }
    else
    {
        //null/empty value
        document.body.setAttribute("canfocus", "false");
    }
};

/*
function inputactiv()
{
    document.getElementById("input_searchbar").focus();
};
*/

/*
function focuss() 
{
    window.focus();
    document.getElementById("input_searchbar").focus();
}
*/

function togglemodel() 
{
    if(activ == "chatgpt")
    {
        set_bard(); //toggle event
    }
    else
    {
        set_chatgpt(); //toggle event
    }
};

function keydwn_input(e)
{
    e = e || event || window.event;
    if((e.key === "Enter" || e.keyCode === 13) && !e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey)
    {
        //only enter pressed
        hitenter();
        e.preventDefault();
        e.stopImmediatePropagation();
        e.stopPropagation();
        return false;
    }
};


/*
function check_ad() 
{
    if(should_inj_ad === 1)
    {
        //if 1 -> injifr func would exist
        if(document.getElementById("gadsfr") == null)
        {
            injifr();    
        }
        else
        {
            console.log("How again??");
        }
    }
    else if(should_inj_ad === -1)
    {
        setTimeout(check_ad, 1200);
    }
};
*/

function hitenter()
{
    if(document.body.getAttribute("firstvisit") == "notyet")
    {
        document.body.setAttribute("firstvisit", "done!");
        setTimeout(hitenter, 200);
        return;
        //check_ad();
    }
    else
    {
    chrome.storage.local.set
    (
        {
           "query": document.getElementById("input_searchbar").value
        }, 
        function()
        {
            document.getElementById("input_searchbar").value = "";
            inputchanged();
            callchatgpt();
            callbard();

            //check_for_ad();
        }
    );
    }
};

function callchatgpt()
{
    if(document.getElementById("chatgpt") && chatgpt == "loaded")
    {
        document.getElementById("chatgpt").contentWindow.postMessage('next_input', '*');
    }
    else
    {
        setTimeout(callchatgpt, 700);
    }
};
function callbard()
{
    if(document.getElementById("bard") && bard == "loaded")
    {
        document.getElementById("bard").contentWindow.postMessage('next_input', '*');
    }
    else
    {
        setTimeout(callbard, 700);
    }
};

function set_chatgpt()
{
    //document.getElementById("frames").removeEventListener("scroll", disablescroll);
    
    localStorage.setItem("active", "chatgpt"); //BE
    activ = "chatgpt";
    chatgptactive(); //FE
};

function set_bard()
{
    //document.getElementById("frames").removeEventListener("scroll", disablescroll);
    
    localStorage.setItem("active", "bard"); //BE
    activ = "bard";
    bardactive(); //FE
};


/*
function mouseov()
{
    if(document.getElementById("chatgpt"))
    {
        document.getElementById("chatgpt").focus();
        //document.getElementById("chatgpt").removeEventListener("mouseover", mouseov);
    }   
};*/
/*
function mouseov2()
{
    if(document.getElementById("gadsfr"))
    {
        document.getElementById("gadsfr").focus();
        //document.getElementById("chatgpt").removeEventListener("mouseover", mouseov);
    }   
};
*/





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

function onmsg(e) 
{
    //console.log(event.data);
    e = event || window.event || e;
    // Check the origin of the message for security purposes
    if (e.origin === "https://chat.openai.com" || e.origin === "https://chat.openai.com/" || e.origin === "https://bard.google.com/" || e.origin === "https://bard.google.com") 
    {
        console.log(e.data);
        if(e.data == "Overlay notice active")
        {
            showoverlay();
        }
        else if(e.data == "frame loaded sccssflly")
        {
            if(e.origin === "https://chat.openai.com" || e.origin === "https://chat.openai.com/")
            {
                chatgpt = "loaded";
            }
            else
            {
                bard = "loaded";
            }

            refocus();
        }
        else if(e.data === "injifr-now" && which_mode === "single")
        {
            /*
            chrome.storage.local.get(["installdate"]).then((result) => 
            {
                if(Number(result.installdate) == 1)
                {
                    //injifr();
                }
            });
            */
           return;
        }
        else if(e.data == "Eurekaaframecalling_from_chatgpt")
        {
            if(window.location.href.indexOf("promptmode=1") != -1) //this is sidepanel url- wont change or update as such
            //if(typeof(selectedtext) != 'undefined') //selectedtext is not undefined ~ it is defined
            {
                //prompt mode
                automode_chatgpt();
            }
            else
            {
                //hitenter mode, no need to save because it will trigger with nextinput
                document.getElementById("chatgpt").contentWindow.postMessage('chatgpt_pl_continue', '*');
            }
        }     
        else if(e.data == "Eurekaaframecalling_from_bard")
        {
            if(window.location.href.indexOf("promptmode=1") != -1)
            //if(typeof(selectedtext) != 'undefined') //selectedtext is not undefined ~ it is defined
            {
                //prompt mode
                automode_bard();
            }
            else
            {
                //hitenter mode, no need to save because it will trigger with nextinput
                document.getElementById("bard").contentWindow.postMessage('bard_pl_continue', '*');
            }
        } 
    }
    /*
    else if (e.origin == "https://s3.browsebetter.io" || e.origin == "https://s3.browsebetter.io/") 
    {
        
         console.log('Received message:', event.data);
         if(e.data == "Loadedd successfullyy!!")
         {
             console.log(e.data);
             document.body.className = "adon";
             refocus();
             //document.getElementById("input_searchbar").focus();
             
             //loaded = 1;
             //loaded
         }
         
    }
    */
};

function automode_chatgpt()
{
    if(finalprompt === "") //finalprompt has been reset (url has prompt on) ~ means ~ query has been saved in the storage > now send
    {
        document.getElementById("chatgpt").contentWindow.postMessage('chatgpt_pl_continue_automatically', '*');
    }
    else
    {
        setTimeout(automode_chatgpt, 250);
    }
};

function automode_bard()
{
    if(finalprompt === "") //finalprompt has been reset (url has prompt on) ~ means ~ query has been saved in the storage > now send
    {
        document.getElementById("bard").contentWindow.postMessage('bard_pl_continue_automatically', '*');
    }
    else
    {
        setTimeout(automode_bard, 250);
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