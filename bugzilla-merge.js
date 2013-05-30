var bz = require("bz");
var async = require("async");

var source = bz.createClient({
  //url: "https://api-dev.source.mozilla.org/instantbird/",
  //url: "https://api-dev.source.mozilla.org/test/latest/",
  test: true,
  username: "",
  password: "",
  timeout: 30000
});

var bugMap = {};

//var startDate = "1970-01-01";
var startDate = "2013-05-23";
async.waterfall([
    // First get the basic information for each bug.
    function(aCallback) {
      source.searchBugs([["changed_after", startDate]], function(aError, aBugs) {
        if (!aError) {
          // XXX for speed.
          aBugs = aBugs.slice(0, 10);

          console.log("Received information on " + aBugs.length + " bugs!");

          // Sort the bugs by ID.
          aBugs.sort(function(a, b) {
            return a.id - b.id;
          });

          var nextId = 0;

          // Then, create a new bug in the target for each bug.
          var newBugs = async.mapSeries(aBugs, function(aBug, aCallback) {
            var id = nextId++;
            console.log("Creating bug " + aBug.id + " -> " + id);
            // XXX need to "transform" the bug to fix bug links.
            /*target.createBug(transformBug(aBug, bugMap), function(aError, aId) {
              if (!aError) {
                aCallback(null, aId);
              }
              else
                aCallback(aError);
            }*/
            bugMap[aBug.id] = id;
            aBug.old_id = aBug.id;
            aBug.id = id;
            aCallback(null, aBug);
          }, function(aError, aBugs) {
            console.log("All bugs created!");
            aCallback(aError, aBugs);
          });
        }
        else
          aCallback(aError);
      })
    },
    // Now we can append to the bugs in any order!
    function(aBugs, aCallback) {
      // Assume that
      console.log(aBugs);
      aCallback(null);
    },
    // Now append the CC information at the end (so that users don't get CC'd on
    // every change above).
    function(aBugs, aCallback) {
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
    let bugNum = aBugNum;
    if (bugMap.hasOwnProperty(aBugNum))
      bugNum = bugMap[aBugNum];
    return aBugStr + bugNum;
  }
  // Replace bug links in the summary and comments.
  // Additionally, replace any mention of BIO with BMO.
  aBug.summary = aBug.summary.replace(bugPattern, replaceBugNumber)
                             .replace(sourceUrlPattern, "bugzilla.mozilla.org");
  aBug.comment = aBug.comment.map(function(aComment) {
    aComment.text = aComment.text.replace(bugPattern, replaceBugNumber)
                                 .replace(sourceUrlPattern, "bugzilla.mozilla.org");
    return aComment;
  });

  // Fix the product and component.
  [aBug.product, aBug.component] = mapProductAndComponent(aBug.product, aBug.component);

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
