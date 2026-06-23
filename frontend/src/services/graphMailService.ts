import { acquireMailToken } from './msalClient';

interface Attachment {
  name: string;
  contentBase64: string; // base64 PDF
}

const GRAPH = 'https://graph.microsoft.com/v1.0';
const CHUNK_SIZE = 320 * 1024 * 20; // 6.25 MB — must be a multiple of 320 KB per Graph API spec

async function uploadAttachment(messageId: string, token: string, attachment: Attachment): Promise<void> {
  const binary = atob(attachment.contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const fileSize = bytes.length;

  const sessionRes = await fetch(`${GRAPH}/me/messages/${messageId}/attachments/createUploadSession`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      AttachmentItem: { attachmentType: 'file', name: attachment.name, size: fileSize },
    }),
  });
  if (!sessionRes.ok) throw new Error(`Upload session error ${sessionRes.status}: ${await sessionRes.text()}`);
  const { uploadUrl } = await sessionRes.json();

  let offset = 0;
  while (offset < fileSize) {
    const chunk = bytes.slice(offset, Math.min(offset + CHUNK_SIZE, fileSize));
    const end = offset + chunk.length - 1;
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Range': `bytes ${offset}-${end}/${fileSize}`,
      },
      body: chunk,
    });
    if (!putRes.ok && putRes.status !== 201) {
      throw new Error(`Chunk upload failed at ${offset}: ${putRes.status} — ${await putRes.text()}`);
    }
    offset += chunk.length;
  }
}

export async function createOutlookDraft(subject: string, bodyHtml: string, attachments: Attachment[], preToken?: string): Promise<string> {
  const token = preToken ?? await acquireMailToken();

  // Create draft without attachments to avoid payload size limits
  const res = await fetch(`${GRAPH}/me/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject, body: { contentType: 'HTML', content: bodyHtml } }),
  });
  if (!res.ok) throw new Error(`Graph API error ${res.status}: ${await res.text()}`);

  const draft = await res.json();

  // Upload each PDF via upload session (supports large files)
  for (const attachment of attachments) {
    await uploadAttachment(draft.id as string, token, attachment);
  }

  return draft.webLink as string;
}
