if (window != window.top && window.location.href.indexOf("singlmod=1") == -1) 
{
//== -1 means not found -> singlmod not found, dual mode it is -- unfocus, to move it to input
//iframe for sure

if(document.getElementsByTagName("html")[0])
{
    document.getElementsByTagName("html")[0].setAttribute("tabindex", "-1");
}

unset();
//document.addEventListener("readystatechange", unset);
document.addEventListener("DOMContentLoaded", unset);

//if(window.location.href.indexOf("browsebetter.io") === -1)
//{
window.addEventListener("focusin", unfocus);
//}
/*
window.onfocus = function()
{
    window.parent.focus();
    window.top.focus();
};*/

};//iframe for sure


function unset()
{
// Get all elements with a tabindex attribute
var elementsWithTabindex = document.querySelectorAll('[tabindex="0"]');

// Loop through the elements and set tabindex to -1
elementsWithTabindex.forEach(element => 
{
  element.setAttribute('tabindex', '-1');
  //window.parent.postMessage('frame loaded sccssflly', '*');
  window.parent.focus();
  window.top.focus();
});
};

function unfocus()
{
    window.blur();
    console.log("!focused");
    /*
    if(document.readyState === 'complete')
    {
        window.removeEventListener("focusin", unfocus);
    }
    */
    return;
};