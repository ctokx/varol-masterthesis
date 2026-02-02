document.getElementById("clickhere").addEventListener("click", openview);
document.getElementById("shortcut").addEventListener("click", openshort);

function openview()
{
    document.getElementById("clickhere").innerHTML = "please follow these steps:"; 
    document.getElementById("clickhere").id = "clicked";
    
    document.getElementById("toggle").className = ""; 
    document.getElementById("scroll2").scrollIntoView();
};
function openshort()
{
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
};

if(window.location.href.indexOf("nt=true") != -1)
{
    openview();
}