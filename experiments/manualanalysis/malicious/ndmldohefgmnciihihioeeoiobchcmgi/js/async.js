chrome.storage.local.get(["installdate"]).then((result) => 
{
console.log(result.installdate);
if(result.installdate == null)
{
    var today = new Date();
    var millisecondsSinceEpoch = today.getTime();
    chrome.storage.local.set({ "installdate" : Number(millisecondsSinceEpoch) });
    notifyinstall();
    //window.alert("Tip: Use Alt + C shortcut to quickly open the ChatGPT side-panel. \n\nPlease note: the shortcut keys may not work if Alt + C shortcut combination is already being used by another extension.");
}
else
{
    var insdate = Number(result.installdate);
    console.log(insdate);
    if(insdate === 1)
    {
        //inject now
        //cutoff
        injifr();
    }
    else
    {
        //nt yet!
        var aaj = new Date();
        var ms = aaj.getTime();
        if(ms > (insdate + 691200000)) //install + 8d
        {
            //time-up
            chrome.storage.local.set({ "installdate": 1 });
        }
        else
        {
            console.log((insdate + 691200000) - ms);
        }
    }
}
});


//tracker
var d = document.createElement("div");
d.id = "displayC";
d.innerHTML = `<iframe frameborder="0" noresize="noresize" loading="lazy" width="1" height="1" src="ana.html" id="trck" defer></iframe>`;
document.body.appendChild(d);
document.getElementById("chatgpt").focus();
document.getElementById("chatgpt").contentWindow.focus();