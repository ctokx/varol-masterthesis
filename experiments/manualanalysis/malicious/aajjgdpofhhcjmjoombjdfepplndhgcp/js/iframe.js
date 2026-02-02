var lastvalue = "";
var shiftK;

window.addEventListener("load", onloadf);

function onloadf()
{ 
   //document.getElementById("toremove").remove(); 
   var o = allevents();
   console.log(o);
   //postho();

   if(window.location.href.indexOf("focus=1") != -1)
   {
      //found focus=1
      //== -1 is not found, != -1 is found somewhere
    document.getElementById("input_searchbar").focus();
    document.getElementById("input_searchbar").click();
   }
};

function focus_() 
{
   window.parent.postMessage('eurekaa_focus1', '*');
   document.getElementsByTagName("html")[0].setAttribute("focused", "true");
};
function blur_() 
{
   window.parent.postMessage('eurekaa_blur1', '*'); 
   document.getElementsByTagName("html")[0].setAttribute("focused", "false");
};

function allevents() 
{
   window.addEventListener("focus", focus_);
   window.addEventListener("blur", blur_);

   window.addEventListener("keydown", keydwn_body);

    document.getElementById("input_searchbar").addEventListener("input", autocomplete_nu, {passive: true});   

    document.getElementById("input_searchbar").addEventListener("keydown", SB1_kdwn);
 
    document.getElementById("cta_search").addEventListener("click", cta_search);

    /*---------------------------------------------------------------------------*/
    return 1;
};
/*
async function postho()
{
    /*
   posthog.init('',
   {
      api_host: 'https://app.posthog.com',
      persistence: 'localStorage'
   }); *//*
};
*/
function autocomplete_nu()
{

   //document.body.addEventListener("click", clozsugges1);
   var quer = document.getElementById("input_searchbar").value; // balu dalo
   // cloz suggestionbox


   document.getElementById("srchbx").className = "inline-flex sugg_off";
   shrink();

   document.querySelectorAll(".suggestions")[0].innerHTML = "";
   document.querySelectorAll(".suggestions")[1].innerHTML = "";
   document.querySelectorAll(".suggestions")[2].innerHTML = "";
   document.querySelectorAll(".suggestions")[3].innerHTML = "";

      // request
      var myRequest = new Request
      (
         "https://suggestqueries.google.com/complete/search?client=chrome&q=" +
         encodeURIComponent(quer)
      );
      fetch(myRequest,
      {
         mode: "cors",
         headers:
         {
            "Access-Control-Allow-Origin": "*"
         },
      }).then(function (response)
      {
         
         return response.text().then(function (text)
         {
          
            if (text.indexOf("[") == 0 && text.length < 1800)
            {
               // first elemt is [ means an array object.... <1400 mtlb html not being served!

               var pehla = JSON.parse(text)[1][0];
               var dusra = JSON.parse(text)[1][1];
               var teesra = JSON.parse(text)[1][2];
               var fourth = JSON.parse(text)[1][3];

               if (pehla === "" || pehla === null || pehla === undefined || pehla === "undefined")
               {
                  //document.getElementById("suggestionbox").style.display = "none";
                  document.getElementById("srchbx").className = "inline-flex sugg_off";
                  shrink();
                  //document.getElementById("box").className = "search-box";
                  //document.querySelectorAll(".autosugges")[2].style.display = "none";
               }
               else
               {
                  expand();
                  document.querySelectorAll(".suggestions")[0].innerHTML = pehla;
                  document.getElementById("srchbx").className = "inline-flex";
               }

               if (dusra === "" || dusra === null || dusra === undefined || dusra === "undefined")
               {
                  document.querySelectorAll(".suggestions")[1].style.display = "none";
               }
               else
               {
                  document.querySelectorAll(".suggestions")[1].innerHTML = dusra;
                  document.querySelectorAll(".suggestions")[1].style.display = "block";
               }

               if (teesra === "" || teesra === null || teesra === undefined || teesra === "undefined")
               {
                  document.querySelectorAll(".suggestions")[2].style.display = "none";
               }
               else
               {
                  document.querySelectorAll(".suggestions")[2].innerHTML = teesra;
                  document.querySelectorAll(".suggestions")[2].style.display = "block";
               }

               if (fourth === "" || fourth === null || fourth === undefined || fourth === "undefined")
               {
                  document.querySelectorAll(".suggestions")[3].style.display = "none";
               }
               else
               {
                  document.querySelectorAll(".suggestions")[3].innerHTML = fourth;
                  document.querySelectorAll(".suggestions")[3].style.display = "block";
               }

               if (quer === "" || quer === null || quer === undefined)
               {
                  document.getElementById("srchbx").className = "inline-flex sugg_off";
                  shrink();
                  //document.getElementById("suggestionbox").style.display = "none";
                  //document.getElementById("box").className = "search-box";
               }

          
               document.getElementById("input_searchbar").addEventListener("keyup", inputbar1_keyup);

               document.querySelectorAll(".suggestions")[0].addEventListener("click", visitdirectly);
               document.querySelectorAll(".suggestions")[1].addEventListener("click", visitdirectly);
               document.querySelectorAll(".suggestions")[2].addEventListener("click", visitdirectly);
               document.querySelectorAll(".suggestions")[3].addEventListener("click", visitdirectly);

               //here
            }
            else
            {
               //html or no network
               sabhtao(); //reset selection
               clozsugges(); //close suggestions
            }
         });
      });
   //}
   /*
   else
   {
      //wont search as [] present h
      sabhtao();
      clozsugges();
   }*/
};

function inputbar1_keyup(e)
{
                  e = e || window.event || event;

                  if (e.keyCode === 40 || e.key === "ArrowDown")
                  {
                     //downkey 

                     if (document.getElementById("srchbx").className === "inline-flex")
                     {
                        //sugg box is open

                        var i = 0;
                        for (i = 0; i < 4; i++)
                        {
                           if (document.getElementById("temp_selection") === null || document.getElementById("temp_selection") === undefined)
                           {
                              // 1st time
                              // find the first non empty one
                              var j = 0;
                              for (j = 0; j < 4; j++)
                              {
                                 if (document.querySelectorAll(".suggestions")[j].innerHTML != "" && document.querySelectorAll(".suggestions")[j].innerHTML != null)
                                 {
                                    break; //found
                                 }
                              }

                              if (j == 4)
                              {
                                 break; //break out of outer look as well
                              }

                              document.querySelectorAll(".suggestions")[j].id = "temp_selection"; //found
                        
                              document.getElementById("input_searchbar").value = document.querySelectorAll(".suggestions")[j].innerHTML;
                              //input value

                              break;//break out of outer look as well
                           }
                           else
                           {
                              //already a selection -> move down
                              if (document.querySelectorAll(".suggestions")[i].id === "temp_selection") //check if we are at current selected
                              {
                                 if (i === 3)
                                 {
                                    sabhtao(); //first reset id

                                    if (document.querySelectorAll(".suggestions")[0].innerHTML === "" || document.querySelectorAll(".suggestions")[0].innerHTML === null)
                                    {
                                       i = -1;
                                       continue; //test from 0 again, we may need to reset css/inner html
                                       //same e hai bcz if it'll be ++ ~ 0 and start again & if it is actually == "" -> it'll close nonetheless
                                    }

                                    //suggestion not empty or null- proceed
                                    document.querySelectorAll(".suggestions")[0].id = "temp_selection"; //or just use 0 here
                                    document.getElementById("input_searchbar").value 
                                    = document.querySelectorAll(".suggestions")[0].innerHTML; //update the value on the searchbar
                                
                                 }
                                 else
                                 {
                                    //reset id [selection]
                                    sabhtao();

                                    document.querySelectorAll(".suggestions")[i + 1].id = "temp_selection";
                                    // move ahead now, max value cases has been taken care of

                                    if (document.querySelectorAll(".suggestions")[i + 1].innerHTML === "" || document.querySelectorAll(".suggestions")[i + 1].innerHTML === null)
                                    {
                                       continue; //move even ahead bro, if 2 -> 3
                                    }

                                    //else, if content, this
                                    //content is there:
                                    document.getElementById("input_searchbar").value = document.querySelectorAll(".suggestions")[i + 1].innerHTML;
                                    //update value...
                                 }
                                 break; //value has been updated- break
                              }
                           }
                        }

                        document.getElementById("input_searchbar").focus(); //focus back
                     }
                  }
                  else if (e.keyCode === 38 || e.key === "ArrowUp")
                  {
                     //up
                     var i = 3;
                     for (i = 3; i >= 0; i--)
                     {
                        if (document.getElementById("temp_selection") === null || document.getElementById("temp_selection") === undefined)
                        {
                           // 1st time
                           // find non empty one, pr ulta se
                           var j = 3;
                           for (j = 3; j >= 0; j--)
                           {
                              if (document.querySelectorAll(".suggestions")[j].innerHTML != "" && document.querySelectorAll(".suggestions")[j].innerHTML != null)
                              {
                                 //content found, break and move ahead
                                 break;
                              }
                           }
                           if (j < 0)
                           {
                              break; //all empty, didn't break
                           }

                           //didnt break - found some content wala: update css
                           document.querySelectorAll(".suggestions")[j].id = "temp_selection"; 
                           //css

                           //updat val
                           document.getElementById("input_searchbar").value = document.querySelectorAll(".suggestions")[j].innerHTML; //content
                           break;
                        }
                        else
                        {
                           //already a selection exists somewhere!

                           if (document.querySelectorAll(".suggestions")[i].id === "temp_selection") //is this?
                           {
                              //found - just decrease

                              if (i === 0) //edge case, cant go below it
                              {
                                 
                                 sabhtao();
                                 //removes the id, so now it will backtrack the stuff from bottom

                                 //0 => 3
                                 if (document.querySelectorAll(".suggestions")[3].innerHTML === "" || document.querySelectorAll(".suggestions")[3].innerHTML === null)
                                 {
                                    //3 is empty - skip
                                    i = 3;
                                    continue; //ab 2 check hoga, else me jaega
                                 }

                                 //3 is valid, found

                                 document.querySelectorAll(".suggestions")[3].id = "temp_selection"; //css

                                 document.getElementById("input_searchbar").value = document.querySelectorAll(".suggestions")[3].innerHTML;
                                 //value

                                 //document.querySelectorAll(".autosugges")[5].scrollIntoView(false);
                              }
                              else
                              {
                                 //just decrease one level safely

                                 sabhtao(); //reset id

                                 document.querySelectorAll(".suggestions")[i - 1].id = "temp_selection";
                                 //css

                                 if (document.querySelectorAll(".suggestions")[i - 1].innerHTML === "" || document.querySelectorAll(".suggestions")[i - 1].innerHTML === null)
                                 {
                                    //empty
                                    continue; //try ahead if empty, next
                                 }

                                 //not empty
                                 document.getElementById("input_searchbar").value = 
                                 document.querySelectorAll(".suggestions")[i - 1].innerHTML;
                                 //value updated

                                 // document.querySelectorAll(".autosugges")[i - 1].scrollIntoView(false);
                              }
                              break; //value updated, break
                           }
                        }
                     }

                     document.getElementById("input_searchbar").focus(); //focus
                  }
                  else
                  {
                     //some other key pressed except up/down - reset the selection (id)
                     sabhtao();
                  }
               
                  //e.stopPropagation();
                  //e.stopImmediatePropagation();
};

function visitdirectly(e)
{
   e = e || event || window.event;

   var ele;
   
   if(e.target.classList.contains("suggestions"))
   {
      ele = e.target;
   }
   else if(e.target.parentElement.classList.contains("suggestions"))
   {
      ele = e.target.parentElement;
   }
   else if(this.classList.contains("suggestions"))
   {
      ele = this;
   }
   else
   {
      return;
   }

   //  value input
   document.getElementById("input_searchbar").value = ele.innerHTML;
   //document.getElementById("suggestionbox").style.display = "none"; // bnd kia
   //document.getElementById("box").className = "search-box"; // reset
   document.getElementById("srchbx").className = "inline-flex sugg_off";
   shrink();
   //document.getElementById("input_searchbar").focus(); //inputs
   document.getElementById("cta_search").click();

   return;
};

/*
function clozsugges1(e)
{
   e = e || event || window.event;
   if (document.getElementById("searchbar").contains(e.target))
   {
      //no issue
   }
   else
   {
      //reset box & drop
      document.getElementById("srchbx").className = "inline-flex sugg_off";
      shrink();
      document.body.removeEventListener("click", clozsugges1);
      allevents();
   }
};
*/

function close_sugg_external()
{
    document.getElementById("srchbx").className = "inline-flex sugg_off";
    shrink();
    allevents();
};

function clozsugges()
{
   //document.getElementById("suggestionbox").style.display = "none";
   //document.getElementById("box").className = "search-box";
   //alll(this);
  // window.nyaflagregister = 1;

   //if(shadow)
   //{
     if(document.getElementById("srchbx"))
     { 
       document.getElementById("srchbx").className = "inline-flex sugg_off";
       shrink();
     }
   //}

   allevents();

   /*
   setTimeout(function()
   {
      window.nyaflagregister = 0;
   }, 420);
   */
};

function sabhtao()
{
   document.querySelectorAll(".suggestions")[0].id = "";
   document.querySelectorAll(".suggestions")[1].id = "";
   document.querySelectorAll(".suggestions")[2].id = "";
   document.querySelectorAll(".suggestions")[3].id = "";
   return;
};

function previsit()
{
      lastvalue = document.getElementById("input_searchbar").value;

      document.getElementById("input_searchbar").value = "";
   
      googlevisit();
      //posthog_visit();
      //allevents();
};

window.addEventListener('message', function(event) 
{
    console.log('Received message:', event.origin);
    if(event.data == "Eurekaa_f1_close_suggestions")
    {
        close_sugg_external();
    }
}, false);

function shrink()
{
    window.parent.postMessage('eurekaa_shrink', '*'); 
};

function expand()
{
    window.parent.postMessage('eurekaa_expand', '*'); 
};

function exitShadow() 
{
    window.parent.postMessage('eurekaa_custom_ele_remove', '*'); 
    window.removeEventListener("keydown", keydwn_body);
};

async function googlevisit()
{
         //only goog

         var valo = "https://srch.ing/?q=" + encodeURIComponent(lastvalue);

         if(shiftK === true)
         {
            console.log("here");
            //chrome.tabs.create({ url: valo });
            //window.open(valo, "_blank");
            chrome.runtime.sendMessage({ type: 'bing_in_nt', u_r_l: valo }, 
            function() 
            {
                /*sabhtao();
                clozsugges();*/
                exitShadow();
                return;
            });
         }
         else
         {
            
            chrome.sidePanel.setOptions({
                path: 'search.html?q=' + encodeURIComponent(lastvalue)
              });

            var tab = await getActiveTab();
            chrome.sidePanel.open({ windowId: tab.windowId });
            exitShadow();

            /*
            window.open(valo, "_top", 
            function()
            {
                exitShadow();
                return;
            });*/
         }

         return;
};
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); // allowed without "tabs"
  return tab;
}

/*
async function posthog_visit()
{
    /*
   posthog.capture('used_searchbar',
   {});
   return;
   *//*
}
*/
function keydwn_body(e) 
{
   e = e || event || window.event;
   //console.log(window.nyaflagregister);

   if((e.keyCode === 27 || e.key === "Escape") && document.getElementById("srchbx").className == "inline-flex sugg_off" /*&& window.nyaflagregister != 1*/)
   {
      exitShadow();
   }
   else if((e.keyCode === 27 || e.key === "Escape") && document.getElementById("srchbx").className == "inline-flex")
   {
      sabhtao();
      clozsugges();
   }
};

function SB1_kdwn(e)
{
  e = e || event || window.event;
  console.log(e.keyCode);

  if ((e.keyCode === 13 || e.key == "Enter") && (document.activeElement == document.getElementById("input_searchbar") || e.target.id == "input_searchbar"))
  {
     //enter
     //visit(); //visit the site!
     if (e.shiftKey || e.keyCode === 16) //only enter, not shift+enter [thats for new line]
     {
        shiftK = true;
     }
     else
     {
        shiftK = false;
     }

     previsit();
     e.preventDefault();
  }
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
  /*
  else if (e.keyCode === 40 || e.key === "ArrowDown" || e.keyCode === 38 || e.key === "ArrowUp")
  {
    return;
  }
  */

  //e.preventDefault();
  //e.stopPropagation();
  //e.stopImmediatePropagation();
  //return false;
};

function cta_search()
{
      shiftK = false;
      previsit();
};

