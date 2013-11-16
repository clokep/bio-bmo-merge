from bugzilla.models import Bug, Attachment
from scripts.attach import AttachmentAgent

class CommentAgent(AttachmentAgent):
    def create_bug(self, bug):
        """Create a new bug."""

        fields = {
            'product': bug.product,
            'component': bug.componen,
            'summary': bug.summary,
            'version': bug.version,
            'op_sys': bug.op_sys,
            'platform': bug.platform,
            'priority': bug.priority,
        }

        url = urljoin(self.API_ROOT, 'bug?%s' % self.qs())
        return Bug(**fields).post_to(url)

    def add_comment(self, bug_id, comment):
        self._comment(bug_id, comment)

    def add_attachment(self, bug_id, attachment):
        pass
