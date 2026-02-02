var selectedtext;
var finalprompt;

window.addEventListener("load", onlo);

function onlo()
{
if(window.location.href.indexOf("promptmode=1") != -1)
{
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
};
window.addEventListener('message', onmsg, false);

function onmsg(e) 
{
    //console.log(event.data);
    e = event || window.event || e;
    // Check the origin of the message for security purposes
    if (e.origin === "https://gemini.google.com/" || e.origin === "https://gemini.google.com") 
    {
        console.log(e.data);
        if(e.data == "Overlay notice active")
        {
            showoverlay();
        }
    }
};
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

if(finalprompt)
{
 document.getElementById("gemini").contentWindow.postMessage(finalprompt, '*');
}

};
