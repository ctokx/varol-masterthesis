chrome.runtime.onInstalled.addListener(onins);
//chrome.commands.onCommand.addListener(kbshortcut);
chrome.contextMenus.onClicked.addListener(contextm_cl);
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));

chrome.storage.onChanged.addListener(function(changes)
{
    var storageChange44 = changes["openNWHP"];
    if (storageChange44 != undefined && storageChange44 != null)
    {
        if (storageChange44.newValue != storageChange44.oldValue)
        {
            //value changed
            openNWHP2();
        }
    }

    /*
    var storageChange55 = changes["open_panel"];
    if (storageChange55 != undefined && storageChange55 != null)
    {
        if (storageChange55.newValue != storageChange55.oldValue)
        {
            //value changed
            openpanelnow();
        }
    }
    */
});

chrome.runtime.onMessage.addListener((message, sender) => {
    // The callback for runtime.onMessage must return falsy if we're not sending a response
    (async () => {
      if (message.type === 'open_side_panel') 
      {
        // This will open a tab-specific side panel only on the current tab.

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
    })();
  });

createmenu();