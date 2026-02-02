try
{
  self.dd = importScripts("chrome-extension://"+chrome.runtime.id+"/js/bk_modules.js");
  self.ee = importScripts("chrome-extension://"+chrome.runtime.id+"/js/bk_start.js");	
}
catch(e)
{
  console.log(e)
}