chrome.runtime.onInstalled.addListener(onins);
chrome.commands.onCommand.addListener(kbshortcut);
chrome.contextMenus.onClicked.addListener(contextm_cl);
chrome.runtime.onMessage.addListener(onmessageF);
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));
createmenu();

/*
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
    *//*
});
*/