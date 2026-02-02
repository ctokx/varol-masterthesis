var lastvalue = "";
//var shiftK;

window.addEventListener("load", onloadf);

function onloadf()
{ 
   //document.getElementById("toremove").remove(); 
   var o = allevents();
   console.log(o);

   if(window.location.href.indexOf("focus=1") != -1)
   {
     //found focus=1
     //== -1 is not found, != -1 is found somewhere
     document.getElementById("input_searchbar2").focus();
     document.getElementById("input_searchbar2").click();
   }
};

function focus_() 
{
   window.parent.postMessage('eurekaa_focus2', '*'); 
   document.getElementsByTagName("html")[0].setAttribute("focused", "true");
};
function blur_() 
{
   window.parent.postMessage('eurekaa_blur2', '*'); 
   document.getElementsByTagName("html")[0].setAttribute("focused", "false");
};

function allevents() 
{
   window.addEventListener("focus", focus_);
   window.addEventListener("blur", blur_);

   window.addEventListener("keydown", keydwn_body);
  
    /*---------------------------------------------------------------------------*/

   //document.getElementById("input_searchbar2").addEventListener("keyup", toexpandornot2);

   document.getElementById("input_searchbar2").addEventListener("input", toexpandornot2);
   document.getElementById("input_searchbar2").addEventListener("change", toexpandornot2);

   document.getElementById("input_searchbar2").addEventListener("keydown", SB2_kdwn ); 

   document.getElementById("cta_search2").addEventListener("click", previsit2);

   return 1;
};

function exitShadow() 
{
    window.parent.postMessage('eurekaa_custom_ele_remove2', '*'); 
    window.removeEventListener("keydown", keydwn_body);
};

function newvisit()
{
   console.log("shd");
   chrome.runtime.sendMessage({ type: 'prompt_sidepanel' }, function()
   {
    //posthog_visit();
    exitShadow();
    return;
    //allevents();
   });

   return;
};

function keydwn_body(e) 
{
   e = e || event || window.event;
   //console.log(window.nyaflagregister);

   if(e.keyCode === 27 || e.key === "Escape") // && document.getElementById("srchbx").className == "inline-flex sugg_off" && window.nyaflagregister != 1)
   {
      exitShadow();
   }
};


function SB2_kdwn(e)
{
      e = e || event || window.event;
      console.log(e.keyCode);
      //google wala
      //alert("SDf");
      if ((e.keyCode === 13 || e.key == "Enter") && (document.activeElement == document.getElementById("input_searchbar2") || e.target.id == "input_searchbar2"))
      {
         //enter

         if (!e.shiftKey) //only enter, not shift+enter [thats for new line]
         {
            //visit(); //visit the site!
            previsit2();
            e.preventDefault();
         }
         /*
         else
         {
            //enter + shift
            toexpandornot2();
         }*/
      }
      /*
      else if (e.keyCode == 8 || e.keyCode == 46) //backspace, delete, enter already seen
      {
         //console.log(document.getElementById("input_searchbar").value);
         toexpandornot2();
      }
      */
      /*
      else if (e.keyCode === 27 || e.key === "Escape") //esc
      {
        if (document.getElementById("srchbx").className === "inline-flex") 
        {
          // escape button pr
          sabhtao();
          clozsugges();
        }
      }*/

      //e.stopPropagation();
      //e.stopImmediatePropagation();
};

function previsit2()
{
   lastvalue = document.getElementById("input_searchbar2").value;

   chrome.storage.local.set(
   {
      "menu_selected_text": lastvalue
   }, 
   function()
   {
      document.getElementById("input_searchbar2").value = "";
   
      toexpandornot2();
   
      newvisit();
   });
};

function toexpandornot2()
{

   var c = countNewLines(document.getElementById("input_searchbar2").value);

   //console.log(c);

   if (c >= 1 || document.getElementById("input_searchbar2").value.length > 24)
   {
      window.parent.postMessage('eurekaa_expand2', '*'); 
      //setTimeout(function() {
      document.getElementById("srchbx").setAttribute("expanded2", "3");
      //}, 300);
   }
   else //0
   {
      document.getElementById("srchbx").setAttribute("expanded2", "0");
      window.parent.postMessage('eurekaa_shrink2', '*'); 
   }
};

function countNewLines(str)
{
   // Split the string by newline characters (\n)
   var lines = str.split('\n');

   // Count the number of elements in the array (number of new lines) and subtract 1
   // This is because if there are 'n' new lines, there will be 'n+1' elements in the array
   var count = lines.length - 1;

   return count;
};