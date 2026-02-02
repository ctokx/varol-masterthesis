var timerr;
if (window != window.top) 
{
       //iframe
       update_links();
       a_events();
       window.addEventListener('popstate', update_links);
       observerr(); 
}

function observerr()
{
// Select the target node where you want to observe changes
var targetNode = document.body; // You can choose any other suitable parent node

// Create a function to be called when a new <a> element is added
var handleNewAnchor = (mutationsList, observer) => 
{
  for (var mutation of mutationsList) 
  {
    if (mutation.type == 'childList') 
    {
      // Check if added nodes are <a> elements
      for (var node of mutation.addedNodes) 
      {
        if (node.nodeName == 'A' || node.tagName === 'a' || node.tagName === 'A') 
        {
          console.log('A new <a> element has been added:', node);
          clearTimeout(timerr);
          timerr = "";

          timerr = setTimeout(update_links, 300);
          // Do something with the new <a> element
        }
      }
    }
  }
};

// Create a MutationObserver instance
var observer = new MutationObserver(handleNewAnchor);

// Configure the observer to watch for changes in the target node's children
var observerConfig = { characterData: true, childList: true, subtree: true };
observer.observe(targetNode, observerConfig);

console.log("shouldbe");
};

function a_events()
{
        window.onmousedown = function(event) 
        {
            event = event || window.event;
            console.log("2");
            console.log(event.target);
            console.log(document.activeElement);  
        try
        {
            if(event.target && event.target.tagName === 'A')
            {
                event.preventDefault(); // Prevent the default behavior of following the link, that can happen onclick as well
                update_href(event.target);
            }
            else if
            ((event.target || event.target.parentElement) &&
             (event.target.tagName == "button" || event.target.tagName == "BUTTON" || event.target.parentElement.tagName == "button" || event.target.parentElement.tagName == "BUTTON" || event.target.parentElement.parentElement.tagName == "BUTTON" || event.target.parentElement.parentElement.tagName == "button") && 
             (event.target.textContent == 'Log in' || event.target.textContent == 'Sign up' || event.target.textContent == 'Sign in'  || event.target.parentElement.textContent == 'Sign in'))
            {
                event.preventDefault();
                console.log("logged");
                alert("Please log-in using a Browser tab & then re-open the SidePanel.");
                if(window.location.host == 'chat.openai.com' || window.location.origin == "https://chat.openai.com")
                {
                    //openinbrowser();
                    return false;
                }
                else
                {
                    //gem
                    messageparent();
                    return false;
                }
            }
            else if
            ((event.target || event.target.parentElement) && 
            (event.target.tagName == "button" || event.target.tagName == "BUTTON" || event.target.parentElement.tagName == "button" || event.target.parentElement.tagName == "BUTTON" || event.target.parentElement.parentElement.tagName == "BUTTON" || event.target.parentElement.parentElement.tagName == "button") && 
            (event.target.textContent == 'Upgrade to Plus' || event.target.textContent == 'Upgrade to ChatGPT Plus'))
            {
                event.preventDefault();
                console.log("logged");
                alert("For payment processing purposes, please open the site in a browser tab.");
                return false;
            }
            else if(event.target.parentElement && event.target.parentElement.tagName === 'A')
            {
                event.preventDefault(); // Prevent the default behavior of following the link
                update_href(event.target.parentElement);
            }
            else if(event.target.parentElement.parentElement && event.target.parentElement.parentElement.tagName === 'A')
            {
                event.preventDefault(); // Prevent the default behavior of following the link
                update_href(event.target.parentElement.parentElement);
            }
            else if(event.target.parentElement.parentElement.parentElement && event.target.parentElement.parentElement.parentElement.tagName === 'A')
            {
                event.preventDefault(); // Prevent the default behavior of following the link
                update_href(event.target.parentElement.parentElement.parentElement);
            }
            else if(event.target.parentElement.parentElement.parentElement.parentElement && event.target.parentElement.parentElement.parentElement.parentElement.tagName === 'A')
            {
                event.preventDefault(); // Prevent the default behavior of following the link
                update_href(event.target.parentElement.parentElement.parentElement.parentElement);
            }
            else if(document.activeElement && document.activeElement.tagName === 'A')
            {
                event.preventDefault(); // Prevent the default behavior of following the link
                update_href(document.activeElement);
            }   
            else if(document.activeElement.parentElement && document.activeElement.parentElement.tagName === 'A')
            {
                event.preventDefault(); // Prevent the default behavior of following the link
                update_href(document.activeElement.parentElement);
            }
            else if(document.activeElement.parentElement.parentElement && document.activeElement.parentElement.parentElement.tagName === 'A')
            {
                event.preventDefault(); // Prevent the default behavior of following the link
                update_href(document.activeElement.parentElement.parentElement);
            }      
        }
        catch(e)
        {
            console.log(e);
            return;
        } 
        };       
};

function update_href(ele)
{
    console.log("3");
    //just a confirmation
    //pkka tag is link?
    var href = ele.getAttribute('href'); // Get the URL from the clicked link
    if(href != null && href != "" && href != undefined && href != "#" && (href.indexOf("https://") != -1 || href.indexOf("http://") != -1))
    {
        if(href.indexOf("://gemini.google.com") === -1 && href.indexOf("://chat.openai.com") === -1)
        {
            console.log('Link clicked');
            ele.setAttribute("target", "_blank");
            return;
        }
        else if(href.indexOf("https://accounts.google.com/ServiceLogin?") != -1)
        {
            //oAuth URL -> change attribute
            console.log('Link clicked');
            ele.setAttribute("target", "_blank");
            setTimeout(messageparent, 100);
            return;           
        }
    }
    else
    {
        return;
    }
};


function update_links()
{
// Get all `<a>` tags on the page.
var aTags = document.querySelectorAll("a");
// Loop through the `<a>` tags and set the `target` attribute to `_blank`.
for (var aTag of aTags) 
{
    var href = aTag.getAttribute('href'); 
    if(href != null && href != "" && href != undefined && href != "#" && (href.indexOf("https://") != -1 || href.indexOf("http://") != -1))
    {
        if(/*href.indexOf("://www.google.com") === -1 &&*/ href.indexOf("://gemini.google.com") === -1 && href.indexOf("://chat.openai.com") === -1)
        {
         aTag.setAttribute("target", "_blank");

         /*
         aTag.onclick = function(e, aTag)
         {
            e = e || window.event;
            if(aTag)
            {
            console.log(aTag.getAttribute('href'));
            window.open(aTag.getAttribute('href'), "_blank");
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
            }
            else if(e.target.getAttribute('href'))
            {
            console.log(aTag.getAttribute('href'));
            window.open(aTag.getAttribute('href'), "_blank");
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
            }
         }
         */

        }
    }
}
};

/*
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
*/

function messageparent()
{
// Send a message from the iframe to the parent frame
window.parent.postMessage('Overlay notice active', '*');
};