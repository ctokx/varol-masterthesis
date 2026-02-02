function onins(details) 
{
    if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) 
    {
      //var url = "https://chrome.google.com/webstore/detail/"+chrome.runtime.id+"/support"
      
      var url = "https://bit.ly/3MRfWlN";
      chrome.runtime.setUninstallURL(url); //fallback!

      chrome.tabs.create({ url: "chrome-extension://"+chrome.runtime.id+"/welcome.html" });
      //open guide when site ready!
    }
    else
    {
      //updated!
    }
};

function openNWHP2()
{
  chrome.tabs.create({ url: "chrome-extension://"+chrome.runtime.id+"/welcome.html?nt=true" });
};
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
  chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: 'Motion-menu',
    title: 'Open ChatGPT',
    contexts: ['all']
  });
}

/*
function kbshortcut(command) 
{
  console.log(command);
  if (command === "open_chatgpt") 
  {
    //chrome.sidePanel.open();
    //chrome.commands.executeCommand('_execute_action');
    /*chrome.sidePanel.setOptions
    ({
      path: 'sidepanel.html',
      enabled: true
    });
    */

    /*
  }
};
*/


function contextm_cl(info, tab) 
{
  if (info.menuItemId === 'Motion-menu') 
  {
    // Perform the primary action here
    console.log('Sample Context Menu clicked');
    //chrome.commands.executeCommand('open_chatgpt');
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
};
