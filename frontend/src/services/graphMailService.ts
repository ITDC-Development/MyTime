import { acquireMailToken } from './msalClient';

interface Attachment {
  name: string;
  contentBase64: string; // base64 PDF
}

export async function createOutlookDraft(subject: string, bodyHtml: string, attachments: Attachment[]): Promise<string> {
  const token = await acquireMailToken();

  const payload = {
    subject,
    body: { contentType: 'HTML', content: bodyHtml },
    attachments: attachments.map(a => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: a.name,
      contentType: 'application/pdf',
      contentBytes: a.contentBase64,
    })),
  };

  const res = await fetch('https://graph.microsoft.com/v1.0/me/messages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph API error ${res.status}: ${err}`);
  }

  const draft = await res.json();
  // webLink opens the draft directly in Outlook Web
  return draft.webLink as string;
}
