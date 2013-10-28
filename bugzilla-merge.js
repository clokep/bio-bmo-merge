/*
 * This requires two 3rd party node.js libraries:
 *  npm install async
 *  npm install bz
 *
 * See documentation at:
 *  https://github.com/harthur/bz.js
 *  https://github.com/caolan/async
 *
 * Create credentials.json which contains:
 * {source: ["user", "password"],
 *  target: ["user", "password"]}
 *
 * Run this as:
 *  node bugzilla-merge.js
 *
 * The conceptual algorithm this is trying to follow is:
 *  1.  Find all bugs on source.
 *  2.  Load each bug from source.
 *  3.  Load each attachment from source.
 *  4.  Create each bug on target.
 *  4a. "Transform" the bug.
 *  4b. If the initial comment had an attachment, add it as a second comment.
 *  5.  Append the extra comments and attachments to each bug.
 *  5a. "Transform" bug.
 *  6.  Update the CC list to the original list.
 *
 * Transforming the bug means updating links / bug numbers, Products and
 * Components to point to data on target.
 *
 * After each of these steps we save a file out to "keep" our progress.
 *
 * TODO:
 *  Attachments are not done at all.
 *  The transform function needs to be finished.
 *  Creating bugs has not been tested.
 */

var fs = require("fs");
var bz = require("bz");
var async = require("async");

var sourceCredentials = {};
var targetCredentials = {};

/*
 * Load user supplied credentials if they exist.
 */
fs.existsSync('credentials.json', function(aExists) {
  fs.readFileSync('credentials.json', function(aErr, aData) {
    if (aErr)
      throw aErr;

    var data = JSON.parse(aData);
    sourceCredentials = data.source;
    targetCredentials = data.target;
  })
});

var source = bz.createClient({
  url: "https://api-dev.bugzilla.mozilla.org/instantbird/",
  username: sourceCredentials[0],
  password: sourceCredentials[1],
  timeout: 300000
});

var target = bz.createClient({
  //url: "https://api-dev.source.mozilla.org/test/latest/",
  test: true,
  username: targetCredentials[0],
  password: targetCredentials[1],
  timeout: 30000
});

// Source bug ID to target bug ID.
var bugIdMap = {};
// Source attachment ID to target attachment ID.
var attachmentIdMap = {};
// Source user IDs to target user IDs.
var userIdMap = {};

// TODO These are set right now to only search for a few bugs to ease testing.
//var startDate = "1970-01-01";
var startDate = "2013-05-23";
//var searchParams = [["changed_after", startDate]];
var searchParams = [["id", "100,20,300,400,5,600,700,80,90,1000"]];
//var searchParams = [["id", "1"]];

async.waterfall([
    // First get the basic information for each bug.
    function(aCallback) {
      source.searchBugs(searchParams, function(aError, aBugs) {
        if (!aError) {
          console.log("Received information on " + aBugs.length + " bugs!");
          aCallback(null, aBugs);
        }
        else
          aCallback(aError);
      })
    },

    function(aBugs, aCallback) {
      // XXX for speed.
      aBugs = aBugs.slice(0, 10);
      saveToFile(aBugs, "bugs.json", aCallback);
    },

    // Then load the full bug for each one.
    function(aBugs, aCallback) {
      aBugs = aBugs.slice(1, 10);
      async.map(aBugs, function(aBug, aBzCallback) {
        source.getBug(aBug.id, [["include_fields", "_all"]], function(aError, aBug) {
          console.log("Loaded bug " + aBug.id + "!");
          aBzCallback(aError, aBug);
        });
      }, aCallback);
    },

    function(aBugs, aCallback) {
      saveToFile(aBugs, "bugs-full.json", aCallback);
    },

    // Load the attachments for each bug.
    function(aBugs, aCallback) {
      async.map(aBugs, function(aBug, aBzCallback) {
        source.bugAttachments(aBug.id, function(aError, aAttachments) {
          console.log("Loaded attachments from bug " + aBug.id + "!");
          aBug.attachments = aAttachments;
          aBzCallback(aError, aBug);
        })
      }, aCallback);
    },

    function(aBugs, aCallback) {
      saveToFile(aBugs, "attachments.json", aCallback);
    },

    // Start creating the bugs.
    function(aBugs, aCallback) {
      // Sort the bugs by ID.
      aBugs.sort(function(a, b) {
        return a.id - b.id;
      });

      var nextId = 0;

      // Then, create a new bug in the target for each bug.
      var newBugs = async.mapSeries(aBugs, function(aBug, aCallback) {
        var id = nextId++;
        console.log("Creating bug " + aBug.id + " -> " + id);
        // "Transform" the bug to fix bug links and references.
        aBug =  transformBug(aBug);
        // Because the API doesn't allow attachments to be added when
        // creating bugs, ensure we add it after.

        /*target.createBug(transformBug(aBug, bugIdMap), function(aError, aId) {
          if (hasAttachment) {
            // Attach
          }
          else if (!aError)
            aCallback(null, aId);
          else
            aCallback(aError);
        }*/
        bugIdMap[aBug.id] = id;
        aBug.old_id = aBug.id;
        aBug.id = id;
        aCallback(null, aBug);
      }, function(aError, aBugs) {
        console.log("All bugs created!");
        aCallback(aError, aBugs);
      });
    },

    function(aBugs, aCallback) {
      saveToFile(aBugs, "transformed.json", aCallback);
    },

    // Now we can append to the bugs in any order!
    function(aBugs, aCallback) {
      // Assume that
      // TODO
    },

    // Now append the CC information at the end (so that users don't get CC'd on
    // every change above).
    function(aCallback) {
      aCallback(null);
    }
  ], function (aError, aResult) {
    if (aError)
      console.log(aError)
    else
      console.log("Done!");
  }
);

// Source products -> target products.
function mapProductAndComponent(aProduct, aComponent) {
  // Addons/* -> Client Software/Instantbird/Demo Add-ons
  if (aProduct == "Add-ons") return ["Instantbird", "Demo Add-ons"];

  // Core/* -> Components/Chat Core/*
  if (aProduct == "Core") return ["Chat Core", aComponent];

  // Instantbird/* -> Client Software/Instantbird/*
  if (aProduct == "Instantbird (UI)") return ["Instantbird", aComponent];

  // Websites/* -> Other/Instantbird Servers/*
  if (aProduct == "Websites") return ["Instantbird Servers", aComponent];

  throw "Unable to map product/component.";
}

const bugPattern = /(bug\s#?|show_bug\.cgi\?id=)(\d+)/gi;
const attachmentPattern = /(attachment\s#?)(\d+)/gi;
const sourceUrlPattern = /bugzilla\.instantbird\.(?:org|com)/gi;
/*
 * Fix up the fields of a bug to account for changed bug information. This
 * includes:
 *  bug links (bug #### and full links) in summary and comment text
 *  attachment (attachment ### and full links) links in summary and comment text
 *  creator and commentors (where appropriate)
 *  dependencies
 *  Map product, component and platform
 *  links to this bugzilla
 */
function transformBug(aBug) {
  function replaceBugNumber(aMatch, aBugStr, aBugNum) {
    return aBugStr + (bugIdMap.hasOwnProperty(aBugNum) ? bugIdMap[aBugNum] : aBugNum);
  }

  function replaceAttachmentNumber(aMatch, aAttachStr, aAttachNum) {
    return aAttachStr +
      (attachmentIdMap.hasOwnProperty(aAttachNum) ? attachmentIdMap[aAttachNum] : aAttachNum);
  }

  // Replace bug links in the summary and comments.
  // Additionally, replace any mention of BIO with BMO.
  aBug.summary = aBug.summary.replace(bugPattern, replaceBugNumber)
                             .replace(attachmentPattern, replaceAttachmentNumber)
                             .replace(sourceUrlPattern, "bugzilla.mozilla.org");
  if (aBug.comment) {
    aBug.comment = aBug.comment.map(function(aComment) {
      aComment.text = aComment.text.replace(bugPattern, replaceBugNumber)
                                   .replace(attachmentPattern, replaceAttachmentNumber)
                                   .replace(sourceUrlPattern, "bugzilla.mozilla.org");
      return aComment;
    });
  }

  // Fix the product and component.
  var pair = mapProductAndComponent(aBug.product, aBug.component);
  aBug.product = pair[0];
  aBug.component = pair[1];

  return aBug;
}

/*
 * Transform a bug to be appropriate for inital creation. This will remove
 * everything but:
 *  summary
 *  comment[0].text
 *
 * In particular, be sure the strip the CC list so people don't get tons of
 * bugmail.
 */
function stripBug(aBug) {
  return aBug;
}

function saveToFile(aObject, aFilename, aCallback) {
  fs.appendFile(aFilename, JSON.stringify(aObject, null, 4), function(aErr) {
    if (aErr)
      aCallback(aErr);
    else {
      console.log(aFilename + " was saved!");
      aCallback(null, aObject);
    }
  });
}

function downloadAttachment(bzRef, id, callback) {
  bzRef.APIRequest('/bug/' + id + '/attachment?attachmentdata=1', 'GET', callback);
}
