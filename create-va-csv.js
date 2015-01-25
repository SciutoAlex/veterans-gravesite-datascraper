var jsdom  = require('jsdom');
var fs     = require('fs');
var jquery = require('jquery');
var cheerio = require('cheerio');
var request = require('request');
var csv = require('csv')

//Record Names
var records = [['last_name', 'first_and_other_name', 'date_of_birth', 'date_of_death', 'wars_participated_in', 'rank', 'service', 'buried_cemetary', 'veteran_cem_boolean', 'veteran_cem_location', 'address_string', 'phone']];
var i = 0;


//Get File Names
var transcriptList = [];
transcriptList = fs.readdirSync("./transcripts");

//Variables to control which shows to request.
var maxFileNumber = transcriptList.length-1;
var minFileNumber = 0;
var counter = minFileNumber;

//Check to see if there are html files to combine
if(!fs.existsSync('./transcripts')) {
  console.log("Hey there's no data!");
  process.exit(code=1);
}

//Begin the show
console.log('Beginning Parse');
next();
function next() {
  if(counter < maxFileNumber) {
    counter++;
    fs.readFile(returnFileName(counter), 'utf8', function(err, body) {
      if(!err) {
        addHtmlToCsv(records, body, next);
        // console.log('Show No.'+ counter +' parsed');
      } else {
        console.log(err)
        next();
      }
    });
  } else {
    csv.stringify(records, function(err, data) {
      if(!err) {
        if(!fs.existsSync('./output')) {
          fs.mkdirSync('./output');
        }
        fs.writeFile('./output/data.csv', data);
      } else {
        console.log('something went wrong with the csv stringify');
      }
    })
  }
}


//function that loads the html and allows jQuery like parsing.
function addHtmlToCsv(obj, html, cb) {
  $ = cheerio.load(html);
  var showCounter = 0;
  var seriesCounter = obj.length;


  var allTrs = $('tr');
  var entries = $('tr')
  .each(function(i,e) {
    $(this).attr('data-count', i);
  })
  .filter(function() {
    return $(this).find('td').eq(0).attr('colspan') == 3;
  });

  entries.each(function(d,i) {
    var currentCounter = $(this).attr('data-count');
    var nextCounter = entries.eq(d+1).attr('data-count')-1;
    if(currentCounter && nextCounter) {
      var data = ["", "", "", "", "", "", "", "", "", "", "", ""];
      var wife = false;
      for(var i = currentCounter ; i < nextCounter ; i++) {
        wife = checkWife(allTrs.eq(i));
        checkPos(data, allTrs.eq(i));
        checkDeath(data, allTrs.eq(i));
        checkBirth(data, allTrs.eq(i));
        checkWar(data, allTrs.eq(i));
        var officicalBurial = checkBurialOfficial(data, allTrs.eq(i), i, allTrs);
        if(!officicalBurial) {
          checkBurial(data, allTrs.eq(i), i, allTrs);
        }
        checkName(data, allTrs.eq(i));
      }
      if(!wife) {
        records.push(data);
        process.stdout.clearLine();  // clear current text
        process.stdout.cursorTo(0);  // move cursor to beginning of line
        i = (i + 1) % 6;
        var dots = new Array(i + 1).join(".");
        process.stdout.write("Waiting" + dots);  // write text
      }
    }
  });
  cb();
}

//function to check if the record is a wife, husband, or minor child.
function checkWife(tr, i) {
  if((tr.find('td').eq(1).text().indexOf("WIFE OF") != -1)) {
    return true;
  } else if((tr.find('td').eq(1).text().indexOf("(MINOR CHILD)") != -1)) {
    return true;
  } else if((tr.find('td').eq(1).text().indexOf("HUSBAND OF") != -1)) {
    return true;
  } else {
    return false;
  }

}

//check if the tr element contains burial information from a non-official cemetary
//if so, saves the burial data in the correct spot in the array.
function checkBurial(data, tr, i, allTrs) {
  var one = tr.find('td').eq(0).text()
  if((tr.find('td').eq(1).text().indexOf("BURIED AT:") != -1) && (tr.find('td').eq(1).text().split(":")[1].trim() == "")) {
    data[7] = allTrs.eq(i+1).find('td').eq(1).text().trim();
    data[8] = false;
    data[10] = allTrs.eq(i+2).find('td').eq(1).text().trim();
    data[11] = allTrs.eq(i+3).find('td').eq(1).text().trim();
    return true;
  }
  return false;
}

//check if the tr element contains burial information from a official cemetary
//if so, saves the burial data in the correct spot in the array.
function checkBurialOfficial(data, tr, i, allTrs) {
  var one = tr.find('td').eq(0).text()
  if((tr.find('td').eq(1).text().indexOf("BURIED AT:") != -1) && (tr.find('td').eq(1).text().split(":")[1].trim() != "")) {
    data[9] = tr.find('td').eq(1).text().split(":")[1].trim();
    data[7] = allTrs.eq(i+1).find('td').eq(1).text().trim();
    data[10] = allTrs.eq(i+2).find('td').eq(1).text().trim();
    data[11] = allTrs.eq(i+3).find('td').eq(1).text().trim();
    data[8] = true;
    return true;
  }
  return false;
}

//check if the tr element contains a person's name. This is done by checking to see if the
//first <td> element is not empty (thus containing XX. indicating result count) and the second
//<td> contains text (the name itself).
//if so, saves the name data in the correct spot in the array.
function checkName(data, tr) {
  var one = tr.find('td').eq(0).text()
  if((tr.find('td').eq(0).text() != "") && tr.find('td').eq(1).text()) {
    var strings = tr.find('td').eq(1).text().split(","); //what about multiple commas? ford, john, jr?
    if(strings[1]) {
      data[0] = strings[0].trim();
      data[1] = strings[1].trim();
    } else {
      data[0] = strings[0].trim();
    }
  }
}

//check if the tr element contains a person's birth date and death date. Done by checking to see if
//the strings "DATE OF BIRTH" or "DATE OF DEATH" are contained in the correct <td> element.
//if so, saves the name data in the correct spot in the array.
function checkBirth(data, tr) {
  if((tr.find('td').eq(1).text().indexOf("DATE OF BIRTH") != -1)) {
    var birth = tr.find('td').eq(1).text().substr(20, tr.find('td').eq(1).text().length);
    data[2] = birth.trim();
  }
}

function checkDeath(data, tr) {
  if((tr.find('td').eq(1).text().indexOf("DATE OF DEATH") != -1)) {
    var birth = tr.find('td').eq(1).text().substr(20, tr.find('td').eq(1).text().length);
    data[3] = birth.trim();
  }
}


//Two functions for checking if string is a war string. This is done by checking a list of common
//wars I saw looking through the data.
function checkWar(data, tr) {
  if(checkIfWarString(tr.find('td').eq(1).text())) {
    data[4] = tr.find('td').eq(1).text().trim();
  }
}

function checkIfWarString(str) {
  var returnVal = false;

  var wars = ["World War II", "World War I", "Vietnam", "Korea", "Civil War", "PERSIAN GULF", "AFGHANISTAN", "COLD WAR", "MEXICAN BORDER"];
  wars.map(function(val) {
    if(str.toLowerCase().indexOf(val.toLowerCase()) != -1) {
      returnVal = true;
    }
  })

  return returnVal;
}

//Two functions for checking if string is a position. This is done by checking a list of common
//wars I saw looking through the data.
function checkPos(data, tr) {
  if(checkIfPosString(tr.find('td').eq(1).text()) && !checkIfWarString(tr.find('td').eq(1).text())) {
    var split = tr.find('td').eq(1).text().trim().split("   ");
    if (split.length == 1) {
      data[5] = split[0];

    } else {
      data[5] = split[1];
      data[6] = split[0];
    }

  }
}


function checkIfPosString(str) {
  var returnVal = false;

  var services = ["US MARINE CORPS", "AIR FORCE", "ARMY", "NAVY", "USN"];
  var ranks = ["PFC", "INFANTRY", "SGT", "SEAMAN", "COL", "SGN", "CIVIL", "MOMM3", "1st LT", "2nd lt", "CPL", "SP4", "YN1", "OM2" ]
  var comb = services.concat(ranks);
  comb.map(function(val) {
    if(str.toLowerCase().indexOf(" "+val.toLowerCase()) != -1) {
      returnVal = true;
    }
  })

  return returnVal;
}


function returnFileName(number) {
  return "./transcripts/"+transcriptList[number]+"";
}
