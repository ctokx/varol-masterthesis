function onins(details) 
{
    if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) 
    {
      //var url = "https://chrome.google.com/webstore/detail/"+chrome.runtime.id+"/support"
      
      var url = "https://chrome.google.com/webstore/detail/"+chrome.runtime.id+"/support"
      
      chrome.runtime.setUninstallURL(url); //fallback!

      chrome.tabs.create({ url: "chrome-extension://"+chrome.runtime.id+"/welcome.html" });
      //open guide when site ready!
    }
    else
    {
      //updated!
    }

chrome.storage.local.get(["installdate"]).then((result) => 
{
console.log(result.installdate);
if(result.installdate === null)
{
    var today = new Date();
    var millisecondsSinceEpoch = today.getTime();
    chrome.storage.local.set({ "installdate" : Number(millisecondsSinceEpoch) });
    //notifyinstall(); //moved to welcome js

    //should_inj_ad = 0;
    //window.alert("Tip: Use Alt + C shortcut to quickly open the ChatGPT side-panel. \n\nPlease note: the shortcut keys may not work if Alt + C shortcut combination is already being used by another extension.");
}
});

};
/*
function openNWHP2()
{
  chrome.tabs.create({ url: "chrome-extension://"+chrome.runtime.id+"/welcome.html?nt=true" });
};
*/
/*
function openpanelnow()
{

 chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) 
 {
    if (tabs && tabs.length > 0) 
    {
      // tabs[0] will contain the currently active tab
      var currentActiveTab = tabs[0];
      console.log('Current Active Tab:', currentActiveTab);

      chrome.sidePanel.open({  tabId: currentActiveTab.id });
      chrome.sidePanel.setOptions({
      tabId: currentActiveTab.id,
      path: 'sidepanel.html',
      enabled: true
      });
    } 
    else 
    {
      console.log('No active tab found.');
    }
  });
};
*/

function createmenu()
{
  chrome.contextMenus.removeAll(function()
  {
    
    chrome.contextMenus.create({
      id: 'DirectPrompt',
      title: 'Directly prompt the selected text',
      contexts: ['selection', 'editable']
    });

    chrome.contextMenus.create({
      id: 'Seperator4',
      contexts: ['selection', 'editable'],
      type: "separator"
    }); //title not req, just a sep

    chrome.contextMenus.create({
      id: 'Summarize',
      title: 'Summarize this',
      contexts: ['selection', 'editable']
    });

    
    chrome.contextMenus.create({
      id: 'Simplify',
      title: 'Simplify this',
      contexts: ['selection', 'editable']
    });

    chrome.contextMenus.create({
      id: 'Explain',
      title: 'Clarify and explain this',
      contexts: ['selection', 'editable']
    });

    chrome.contextMenus.create({
      id: 'Learnings',
      title: 'Extract key learnings',
      contexts: ['selection', 'editable']
    });

    chrome.contextMenus.create({
      id: 'Actionables',
      title: 'Extract key action items',
      contexts: ['selection', 'editable']
    });

    chrome.contextMenus.create({
      id: 'Examples',
      title: 'Analyze and give examples',
      contexts: ['selection', 'editable']
    });

    chrome.contextMenus.create({
      id: 'TellMore',
      title: 'Tell me more about this',
      contexts: ['selection', 'editable']
    });

    chrome.contextMenus.create({
      id: 'Seperator2',
      contexts: ['selection', 'editable'],
      type: "separator"
    }); //title not req, just a sep

    chrome.contextMenus.create({
      id: 'Rephrase',
      title: 'Rephrase this',
      contexts: ['selection', 'editable']
    });

    chrome.contextMenus.create({
      id: 'Paraphrase',
      title: 'Paraphrase this',
      contexts: ['selection', 'editable']
    });

    chrome.contextMenus.create({
      id: 'Proofread',
      title: 'Proofread for mistakes and grammar',
      contexts: ['selection', 'editable']
    });

    chrome.contextMenus.create({
      id: 'Readability',
      title: 'Improve readability',
      contexts: ['selection', 'editable']
    });

    chrome.contextMenus.create({
      id: 'Seperator3',
      contexts: ['selection', 'editable'],
      type: "separator"
    }); //title not req, just a sep  

    chrome.contextMenus.create({
      id: 'FormalTone',
      title: 'Rewrite using a formal tone',
      contexts: ['selection', 'editable']
    });

    /*
    chrome.contextMenus.create({
      id: 'InformalTone',
      title: 'Rewrite using an informal tone',
      contexts: ['selection', 'editable']
    });
    */

    chrome.contextMenus.create({
      id: 'FriendlyTone',
      title: 'Rewrite using a friendly tone',
      contexts: ['selection', 'editable']
    });

    chrome.contextMenus.create({
      id: 'ObjectiveTone',
      title: 'Rewrite to make it more objective',
      contexts: ['selection', 'editable']
    });

    chrome.contextMenus.create({
      id: 'PersuasiveTone',
      title: 'Rewrite to make it more persuasive',
      contexts: ['selection', 'editable']
    });


    /*
    chrome.contextMenus.create({
      id: 'Seperator1',
      contexts: ['selection', 'editable'],
      type: "separator"
    }); //title not req, just a sep
    */
   /*
    chrome.contextMenus.create({
      id: 'Open_Eurekaa',
      title: 'Open Eurekaa',
      contexts: ["page", "frame", "link", "image", "video", "audio", "browser_action", "page_action", "action"]
    }); //type not req, defaults h
     */
  });

};
//parentId? later!


// Manifest needs: "permissions": ["activeTab", "sidePanel", "commands"]
// (No "tabs" permission.)

async function getActiveTab() {
  var [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); // allowed without "tabs"
  return tab;
}

async function trySend(tabId, payload) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, payload, (res) => {
      var err = chrome.runtime.lastError;
      if (err) return reject(err);
      resolve(res);
    });
  });
}

async function kbshortcut(command) {
  console.log(command);

  if (command === "open_promptbar") {
    var tab = await getActiveTab();
    if (!tab) return;

    try {
      // If the content script is active on this page, this will succeed.
      await trySend(tab.id, { msg: "show_the_overlay_prompt" });
      // done.
    } catch (e) {
      if(e.message.indexOf("port closed") == -1)
      {
      //console.log(e.message);
      // Content script not running here (e.g., Web Store, chrome://, extension pages)
      /*
      await chrome.sidePanel.setOptions({ path: "sidepanel.html" });
      await chrome.sidePanel.open({ windowId: tab.windowId });
      */
             chrome.tabs.create({
            url: "https://gemini.google.com"
        });
      }
    }
  }

  else if (command === "open_searchbar") {
    var tab = await getActiveTab();
    if (!tab) return;

    try {
      await trySend(tab.id, { msg: "show_the_overlay_search" });
    } catch (e) {
      if(e.message.indexOf("port closed") == -1)
      {
        chrome.tabs.create({
        url: "https://google.com"
        });
      }
      // Fallback for pages where content scripts can't run.
    }
  }

}



function contextm_cl(info, tab) 
{

  /*
  if (info.menuItemId === 'Open_Eurekaa') 
  {
    // Perform the primary action here
    console.log('Open_Eurekaa');
    //chrome.commands.executeCommand('open_chatgpt');
    chrome.sidePanel.setOptions({
      path: 'sidepanel.html'
    });

    chrome.sidePanel.open({ windowId: tab.windowId });
  }
  else 
  */
  if(
    info.menuItemId === 'Summarize' || 
    info.menuItemId === 'Simplify' || 
    info.menuItemId === 'Explain' || 
    info.menuItemId === 'Learnings' || 
    info.menuItemId === 'Actionables' || 
    info.menuItemId === 'Examples' || 
    info.menuItemId === 'Rephrase' || 
    info.menuItemId === 'Paraphrase' || 
    info.menuItemId === 'Proofread' || 
    info.menuItemId === 'Readability' || 
    info.menuItemId === 'FormalTone' ||
    info.menuItemId === 'InformalTone' || 
    info.menuItemId === 'FriendlyTone' ||
    info.menuItemId === 'ObjectiveTone' ||
    info.menuItemId === 'PersuasiveTone' ||
    info.menuItemId === 'TellMore' || 
    info.menuItemId === 'DirectPrompt'
  )
  {
    //save text
    chrome.storage.local.set({ "menu_selected_text" : info.selectionText }, 
    async function()
    {
      //next
      var path_ = 'sidepanel.html?promptmode=1&' + info.menuItemId + "=1" + "&random=" + getRandomInt();

      chrome.sidePanel.setOptions({
        path: path_
      });

      await chrome.sidePanel.open({ windowId: tab.windowId });
    });
  }
};

function getRandomInt() 
{
  return performance.now();
  //Math.floor(Math.random() * 1001);
};

async function onmessageF(message, sender, sendResponse)
{
    // The callback for runtime.onMessage must return falsy if we're not sending a response
  //  ( () => {
      console.log("gotcha?");

      if (message.type == 'prompt_sidepanel') 
      {
        console.log("gotcha");
        //next
        var path_ = 'sidepanel.html?promptmode=1&' + 'DirectPrompt' + "=1" + "&random=" + getRandomInt();

        chrome.sidePanel.setOptions({ path: path_ });

        await chrome.sidePanel.open({ windowId: sender.tab.windowId });
      }
      else if (message.type == 'bing_in_nt') 
      {
        chrome.tabs.create({ url: message.u_r_l });
      }
      else if (message.type === 'open_side_panel') 
      {
        // This will open a tab-specific side panel only on the current tab.

        chrome.sidePanel.setOptions
        ({
          path: 'sidepanel.html'
        });
        await chrome.sidePanel.open({ windowId: sender.tab.windowId });
        /*
        await chrome.sidePanel.open({ tabId: sender.tab.id });
        await chrome.sidePanel.setOptions({
          tabId: sender.tab.id,
          path: 'sidepanel.html',
          enabled: true
        });
        */
        /*
        chrome.tabs.query({}, function(tabs) 
        {
          for (let i = 0; i < tabs.length; i++) 
          {
              if (tabs[i].id != sender.tab.id) 
              {
                 chrome.sidePanel.setOptions({
                  tabId: tabs[i].id,
                  enabled: false
                });                
              }
          }
      });
      */
      }
      else if(message.type === 'reset_the_sidepanel_path')
      {
        chrome.sidePanel.setOptions
        ({
          path: 'sidepanel.html'
        });
        console.log("done_reset");
      }
   // })();
};