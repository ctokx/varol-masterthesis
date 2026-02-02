document.addEventListener("DOMContentLoaded", function () {
  var userApiKey = "";


    var tweetText;
  const responses = document.getElementById("responses");
  const loader = document.getElementById("loader");
  // Get the element with the specific class
    

  document.getElementById("ws-1").addEventListener("click",() => setTweetStyle(1));
  document.getElementById("ws-2").addEventListener("click",() => setTweetStyle(2));
  document.getElementById("ws-0").addEventListener("click",() => setTweetStyle(0));


  chrome.storage.local.get(["apiKey"]).then((result) => {
    if(result.apiKey == undefined){
      document.getElementById("enter-api-key").style.display = "block";
      document.getElementById("tweet-interface").style.display = "none";
    }else{
      console.log(result);
      console.log("Value currently is " + result.apiKey);
      document.getElementById("api-key-input").value = result.apiKey;
      userApiKey = result.apiKey;
    }
  });


  const apiButton = document.getElementById("api-button");//change API button 
  apiButton.addEventListener("click", function() {
    const apiKey = document.getElementById("api-key-input").value;
    
    if(apiKey == ""){
      alert("please enter your API key");
    }else{
      userApiKey = apiKey;
      setApiKey(apiKey);
      alert("Api key saved");
      document.getElementById("enter-api-key").style.display = "none";
      document.getElementById("tweet-interface").style.display = "block";
    }
  });

  const changeApiButton = document.getElementById("change-api-key");//tweet button
  changeApiButton.addEventListener("click", function() {

      document.getElementById("enter-api-key").style.display = "block";
      document.getElementById("tweet-interface").style.display = "none";
    
  });



  const button = document.getElementById("button");//tweet button
    button.addEventListener("click", function () {
        
        chrome.permissions.request({ origins: ['https://twitter.com/*'] }, function (granted) {
            if (granted) {
                console.log('Permission to access Twitter has been granted.');

                
                // Get the HTML content of the current active tab
                chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                    // Get the URL of the current tab
                    

                    
                });
            } else {
                console.log('Permission to access Twitter has been denied.');
                alert('Permission to access Twitter has been denied.');
            }
        });

        
    //message.innerText = "Here is a response";
      document.getElementById("responses").innerText = "\r\n\r\ngenerating responses...";
      loader.style.display = "block";
      //const tweetId = getTweetId();

        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {

            var currentTabUrl = tabs[0].url;
            console.log('Current tab URL:', currentTabUrl);
            // Extract the ID number from the URL
            var tweetID = currentTabUrl.match(/\/(\d+)$/)[1];
            console.log('ID number:', tweetID);
            

            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: () => document.body.innerHTML
            }).then((results) => {
                var htmlContent = results[0].result;
                //console.log(htmlContent);
                // Create a new DOM element from the HTML content
                var tempEl = document.createElement('div');
                tempEl.innerHTML = htmlContent;
                // Find the div element containing the tweet
                var tweetContainer = tempEl.querySelector('.css-901oao.r-1nao33i.r-37j5jr.r-1inkyih.r-16dba41.r-rjixqe.r-bcqeeo.r-bnwqim.r-qvutc0');
                // Verify that tweetContainer is not null or undefined

                if (tweetContainer) {
                    // Find the tweet element within the container
                    var tweetElement = tweetContainer.querySelector('.css-901oao.css-16my406.r-poiln3.r-bcqeeo.r-qvutc0');

                    // Verify that tweetElement is not null or undefined
                    if (tweetElement) {
                        // Extract the text content of the tweet
                        tweetText = tweetElement.textContent;

                        console.log('tweet Text ' + tweetText);

                        console.log('ID fetch', tweetID);

                        fetch("https://functions.purplepanda.be/twittergpt/api/gpt-api-new.php?tweetContent=" + encodeURI(tweetText) + "&ws=" + tweetStyle + "&tweetID=" + tweetID + "&api-key=" + userApiKey)
                            .then(response => {
                                // Check the status of the response
                                if (response.ok) {
                                    // If the request is successful, return the response JSON
                                    return response.json();
                                } else {
                                    // If the request is not successful, throw an error
                                    throw new Error(response.statusText);
                                }
                            })
                            .then(data => {
                                // Do something with the data

                                var tweets = data.choices[0].text;
                                tweets = tweets.replace("1.", "\r\n 1.");
                                tweets = tweets.replace("2.", "\r\n 2.");
                                tweets = tweets.replace("3.", "\r\n 3.");

                                document.getElementById("responses").innerText = tweets;
                                loader.style.display = "none";
                            })
                            .catch(error => {
                                // Handle any errors
                                alert("There was an error, make sure you have: \n\n * Entered a correct API key. \n * Have credits left in your OpenAI account \n * Are currently on a tweet page. (with an url like this: https://twitter.com/theowzrev/status/1616093047112011778). \n \n if issue persists contact @rikvk01 on twitter.");
                            });

                    } else {
                        console.error('Could not find tweet element within container');
                        alert('Could not find tweet element within container');

                    }

                } else {
                    console.error('Could not find tweet container');
                    alert('Could not find tweet container');
                }
            });
    });
  });
});


var tweetStyle = 2;

function setTweetStyle(n){
  tweetStyle = n;
  resetWritingStyle(0);
  resetWritingStyle(1);
  resetWritingStyle(2);

  highlightWritingStyle(n);
}

function highlightWritingStyle(n){

    document.getElementById("ws-"+n).style.border = "1px solid #01a9f4";
    //document.getElementById("ws-"+n).style.background-color = "#daf3ff";
    document.getElementById("ws-"+n).style.color = "#01a9f4";

}

function resetWritingStyle(n){
    document.getElementById("ws-"+n).style.border = "1px solid #d7dfe3";
    //document.getElementById("ws-"+n).style.background-color = "#e5edf0";
    document.getElementById("ws-"+n).style.color = "#4e4e4e";

}

function getTweetId(url){
  const lastSegment = url.split("/").pop();
  return(lastSegment);
}

function setApiKey(key){
  chrome.storage.local.set({ "apiKey": key }).then(() => {
    console.log("Value is set to " + key);
  });
}