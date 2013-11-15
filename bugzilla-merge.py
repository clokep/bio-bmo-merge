from bugzilla.agents import BMOAgent, BugzillaAgent
from bugzilla.utils import get_credentials
from scripts.attach import AttachmentAgent
from os import mkdir, path
import shutil
import urllib

# Transform the fields from BIO to BMO, including:
#   Product
#   Component
#
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
def transform(bug):
    return bug

# We can use "None" for both instead to not authenticate
username, password = get_credentials()

# If you're stupid and type in the wrong password...
#import keyring
#keyring.set_password("bugzilla", username, "")

# Load our agent for BMO
bio = BugzillaAgent("https://api-dev.bugzilla.mozilla.org/instantbird/",
                    username, password)
bioa = AttachmentAgent(bio)
bioUrl = "https://bugzilla.instantbird.org"
#bmo = BMOAgent(username, password)
bmo = BugzillaAgent("https://api-dev.bugzilla.mozilla.org/test/latest",
                    username, password)
bmoa = AttachmentAgent(bmo)

# Set whatever REST API options we want
options = {
    'changed_after':    '2013-11-12',
    #'include_fields':   '_default,attachments',
    'include_fields':   '_all',
}

# Get the bugs from the source.
buglist = bio.get_bug_list(options)

print "Found %s bugs" % (len(buglist))

# Create the directory for attachments.
attachmentsDir = "attachments"
shutil.rmtree(attachmentsDir)
mkdir(attachmentsDir)

# Download all attachments.
for bug in buglist:
    print bug
    for attachment in bug.attachments:
        print attachment
        url = bioUrl + "/attachment.cgi?id=" + str(attachment.id)
        urllib.urlretrieve(url, path.join(attachmentsDir, str(attachment.id)))

# Create new bugs from the first comment + add an attachment if there is one.

# Now add all other comments / attachments in order.
