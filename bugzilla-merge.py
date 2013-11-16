from bugzilla.agents import BMOAgent, BugzillaAgent
from bugzilla.utils import get_credentials
from scripts.attach import AttachmentAgent
from os import mkdir, path
import shutil
import urllib
from CommentAgent import CommentAgent

# See https://bmo.etherpad.mozilla.org/bugzilla-instantbird-merge for many of
# the details about how this script was developed.

# Transform the fields from BIO to BMO, including:
#   product
#   component
#   platform
#   op_sys
#
# This will be run once on each bug.
def mapFields(bug):
    # Addons/* -> Client Software/Instantbird/Demo Add-ons
    if (bug.product == "Add-ons"):
        bug.product = "Instantbird"
        bug.component = "Demo Add-ons"
    # Core/* -> Components/Chat Core/*
    elif (bug.product == "Core"):
        bug.product = "Chat Core"
    # Instantbird/* -> Client Software/Instantbird/*
    elif (bug.product == "Instantbird (UI)"):
        bug.product = "Instantbird"
    # Websites/* -> Other/Instantbird Servers/*
    elif (bug.product == "Websites"):
        bug.product = "Instantbird Servers"
    else:
        print "Unable to map product: %s" % bug.product
        raise Exception("Unable to map product", bug.product)

    # BIO separate PC and Mac, BMO has both as x86.
    if (bug.platform == "PC" or bug.platform == "Mac"):
        bug.platform = "x86"

    # This will knowingly cause some dataloss, but it should be minimal.
    if (bug.op_sys == "Windows (all)"):
        bug.op_sys = "Windows XP"
    if (bug.op_sys.startswith("Mac OS")):
        bug.op_sys = "Mac OS X"

# Also modify some fields to properly reference the new bug and attachment
# numbers:
#   Comment
#   Summary
#   Blocks
#   Depends
#
# Also, modify some fields for changes in email addreses:
#   Creator
#   Commentor
#   CC list

# Create mapping data structures.
bugIdMap = {}
attachmentIdMap = {}

def mapIds(text):
    #bugPattern = /(bug\s#?|show_bug\.cgi\?id=)(\d+)/gi;
    #attachmentPattern = /(attachment\s#?)(\d+)/gi;
    #sourceUrlPattern = /bugzilla\.instantbird\.(?:org|com)/gi;
    return text

# We can use "None" for both instead to not authenticate
username, password = get_credentials()
username2, password2 = get_credentials("bmo")

# If you're stupid and type in the wrong password...
#import keyring
#keyring.set_password("bugzilla", username, "")

# Load our agent for BMO
bio = BugzillaAgent("https://api-dev.bugzilla.mozilla.org/instantbird/",
                    username, password)
bioUrl = "https://bugzilla.instantbird.org"
#bmo = BMOAgent(username, password)
bmo = CommentAgent("https://api-dev.bugzilla.mozilla.org/test/latest/",
                   username2, password2)

# Set whatever REST API options we want
options = {
    'changed_after':    '2013-11-12',
    #'include_fields':   '_default,attachments',
    'include_fields':   '_all',
}

# Get the bugs from the source.
bugs = bio.get_bug_list(options)

print "Found %s bugs" % (len(bugs))

# Create the directory for attachments.
attachmentsDir = "attachments"
print "Removing '%s' directory" % attachmentsDir
shutil.rmtree(attachmentsDir)
print "Creating '%s' directory" % attachmentsDir
mkdir(attachmentsDir)

# Sort the bugs by ID.
print "Sorting bugs"
bugs.sort(key=lambda bug: bug.id)

# Download all attachments.
print "Downloading attachments..."
for bug in bugs:
    #print u"Processing bug %d - %s" % (bug.id, bug.summary)
    print "Processing bug %s" % bug.id
    for attachment in bug.attachments:
        #print "Downloading attachment %d - %s" %(attachment.id, attachment.description)
        print "Downloading attachment %d" % attachment.id
        url = bioUrl + "/attachment.cgi?id=" + str(attachment.id)
        urllib.urlretrieve(url, path.join(attachmentsDir, str(attachment.id)))

# Create new bugs from the first comment + add an attachment if there is one.
print "Creating bugs..."
for bug in bugs:
    # First update the fields.
    mapFields(bug)
    bug.summary = mapIds(bug.summary)
    #ref = bmo.create_bug(bug)
    # Get the new ID from the reference.
    #newId = ref.rsplit("/", 1)[1]
    newId = bug.id * 10
    print "Added bug %d as %d" %(bug.id, newId)
    bugIdMap[bug.id] = newId

# Sort the attachments by date.
attachments = [[bug.id, attachment] for bug in bugs for attachment in bug.attachments]
attachments.sort(key=lambda attachment: attachment[1].creation_time)

# Add all the attachments.
for attachment in attachments:
    #text = mapIds(comment[1].text)
    #print "Adding attachment %d - %s" %(attachment[0], text)
    #bmo.add_attachment(attachment[0], attachment[1])
    pass

# Sort the comments / attachments by date.
comments = [[bug.id, comment] for bug in bugs for comment in bug.comments]
comments.sort(key=lambda comment: comment[1].creation_time)

# Add all the comments.
for comment in comments:
    text = mapIds(comment[1].text)
    print "Adding comment to bug %d - %s" %(comment[0], text)
    #bmo.add_comment(comment[0], text)

# Now add dependencies, CC list.
for bug in bugs:
    pass
