if (window != window.top) //an iframe
  {
   //asap
   window.addEventListener('message', receiveMessage, false);
   var dat;
  }

function receiveMessage(event) 
{
        if(event.origin.indexOf(chrome.runtime.id) != -1)
        {
            if (event.data.length > 1) 
            {
                console.log(event.data);
               
                dat = event.data;
                console.log(dat);

                if (document.readyState === 'complete') 
                {
                    pre();
                }
                else
                {
                    window.addEventListener("load", pre); //looper will start on input
                }  
            }
        }
};

function pre() 
{
    var promp = document.querySelector('[data-placeholder="Ask Gemini"]') || document.querySelector('[aria-label="Enter a prompt here"]') || document.querySelector('[enterkeyhint="send"]') || document.getElementsByTagName("rich-textarea")[0] || document.getElementsByClassName("text-input-field_textarea")[0];
    if (promp) 
    {
        putitinprompt(dat, promp);
    }
    else 
    {
        setTimeout(function () 
        {
            promp = document.querySelector('[data-placeholder="Ask Gemini"]') || document.querySelector('[aria-label="Enter a prompt here"]') || document.querySelector('[enterkeyhint="send"]') || document.getElementsByTagName("rich-textarea")[0] || document.getElementsByClassName("text-input-field_textarea")[0];
            if (promp) 
            {
                putitinprompt(dat, promp);
            }
        }, 1500);
    }
};

function putitinprompt(data, promp) 
{
var btn = document.querySelector('[aria-label="Send message"]') || document.querySelector(".send-button-icon") || document.querySelector('[fonticon="send"]');
if(promp)
{
    promp.click();
    promp.innerHTML = data;

    setTimeout(function()
    {
      if(btn)
      {
        btn.click();
      }
    }, 1000);
}
};