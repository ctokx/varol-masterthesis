var urlParams = new URLSearchParams(window.location.search);
var qValue = urlParams.get('q');
console.log(qValue); // null if parameter doesn't exist

document.getElementById("gemini").setAttribute("src", "https://srch.ing?q=" + qValue);