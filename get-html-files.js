var fs     = require('fs');
var request = require('request');
var cheerio = require('cheerio');


var BASE_URL = "http://gravelocator.cem.va.gov";

//Get the list of 5000 names
var names = require('./names.js').getNames();
var namesCounter = {};
var counter = 0;

//random variables
var interval;


//Create a directory for the files if one doesn't exist
if(!fs.existsSync('./transcripts')) {
  fs.mkdirSync('./transcripts');
}




//Begin the show
console.log('beginning download');
mainLoop();


//Function called when main loop is finished. If successful, goes to the next name, if not, pauses
//the loop and repeats with the same name.
function nextMainLoop(success) {
  if(success) {
    counter++;
    mainLoop();
  } else {
    setTimeout(mainLoop, 5000);
  }
}

//Starts the main loop. Submits a form query to the VA. Gets the first result page
//back, stores it, then creates a subloop for each subsequent page.
function mainLoop() {
  if(counter < names.length) {
    console.log('started main loop. Requesting name.');
    if(checkIfNameFullyDownloaded(names[counter])) {
      nextMainLoop(true);
    } else {
      var i = 0;
      interval = setInterval(function() {
        process.stdout.clearLine();  // clear current text
        process.stdout.cursorTo(0);  // move cursor to beginning of line
        i = (i + 1) % 6;
        var dots = new Array(i + 1).join(".");
        process.stdout.write("Waiting" + dots);  // write text
      },2500);
      request.post({url: BASE_URL + "/index.html", form:returnFormData(names[counter])}, function(err, res, body) {
        clearInterval(interval);
        if(err) { console.log(err); }
        console.log("main counter = " + counter);
        console.log("main name = " + names[counter]);
        saveData(body, names[counter], function(err) {
          if(err) { console.log(err); }
          var nextHref = checkIfNextHref(body);
          if(nextHref) {
            secondaryLoop(nextHref);
          } else {
            nextMainLoop(true);
          }
        });

      });
    }

  } else {
    console.log('done!');
  }
}

//Function called when the secondary loop ends AND there are more
//secondary pages to download.
function nextSecondaryLoop(success, url) {
  if(success) {
    secondaryLoop(url)
  } else {
    setTimeout(function(){
      secondaryLoop(url);
    }, 10000 + Math.random()*10000);
  }
}

//Function that GETs the next html results. Page One is accessed through a
//POST request. Everything else is a GET request.
function secondaryLoop(url) {
  setTimeout(function() {
    console.log('secondary loop.');
    request({url: BASE_URL + url}, function(err, res, body) {
      if(err) { console.log(err); }
      saveData(body, names[counter], function(err) {
        if(!err) {
          var nextHref = checkIfNextHref(body);
          if(nextHref) {
            nextSecondaryLoop(true, nextHref);
          } else {
            nextMainLoop(true);
          }
        } else {
          console.log(err);
          if(nextHref) {
            nextSecondaryLoop(false, url);
          } else {
            nextMainLoop(true);
          }
        }
      });
    });
  }, 100 + Math.random() * 700);
}


//Save the HTML body to its own file in the transcripts directory
function saveData(body, name, cb) {
  if (body) {
    fs.writeFile(returnFileName(name), body, function(err) {
      if(err) {
        console.log(err);
        cb(err);
      } else {
        console.log(name+"-"+namesCounter[name]+" was saved successfully");
        cb(err);
      }
    });
  } else {
    console.log('no body!');
    cb();
  }
}

//return what to call the new files
function returnFileName(name) {
  if(namesCounter[name] == undefined) {
    console.log("new name!");
    namesCounter[name] = 0;
    console.log(namesCounter);
  } else {
    console.log("incremented name")
    namesCounter[name]++;
  }

  return "./transcripts/"+name+"-"+namesCounter[name]+".html";
}


//In order to not have to start at the beginning of the 5000 names, this function
//checks to see if a particular name has been fully downloaded. This is done by
//checking to see if the next name on the list has begun the download process.

//TEST
// console.log(checkIfNameFullyDownloaded(returnListName()[0]));
function checkIfNameFullyDownloaded(pin) {
  var list = names;
  var indx = list.indexOf(pin);

  var currentFiles = fs.readdirSync('./transcripts');
  currentFiles = currentFiles.map(function(file) {
    return file.split("-")[0];
  })
  var nextName = list[indx+1];
  return (nextName && currentFiles.indexOf(nextName) != -1)
}


//Function used by secondary loop to see if there is a next page of results.

//TEST
// request("http://gravelocator.cem.va.gov/index.html?e=bb3203abc1fc39c082c35e8888dd3d37e163cf3760709bc6c82937c65713650a7fd69171429d1799869d1ade5d8b715d4dad496cce13ef01024f125c4d8de87c03b0406f5480e78f8518ac31328aaeed674d7e21fce32d07aad1065863c85d27c680d49c980db501", function(err, res, body)  {
//   var t = checkIfNextHref(body);
// });

function checkIfNextHref(body) {
  $ = cheerio.load(body);
  var returnVal = "";
  var nextHref = $('a').filter(function() { return $(this).text().toLowerCase().trim() == 'next';});
  if (nextHref.length == 1) {
    returnVal = nextHref.attr('href').trim();
  }
  // console.log("return Value:")
  // console.log(returnVal || false)
  return returnVal || false;
}

//Funciton to return a JS object with the correct form data.
function returnFormData(name) {
  return {
    cemetery: "",
    last_nme_opt:1,
    last_nme:name,
    first_nme_opt:1,
    first_nme: "",
    mid_nme_opt:1,
    mid_nme:"",
    birth_mm:"",
    birth_yy:"",
    x:25,
    y:20,
    death_mm:"",
    death_yy:"",
  }
}
