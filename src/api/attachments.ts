import type { Attachment } from "@/types";
import { getApiUrl } from "./client";
import { idToStr } from "@/utils/format";

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function listAttachments(
  token: string,
  nodeId: string | number,
  userId: string | number,
  attachmentType?: string
): Promise<Attachment[]> {
  const params = new URLSearchParams();
  if (attachmentType) params.set("attachment_type", attachmentType);
  const qs = params.toString();
  const url = `${getApiUrl()}/nodes/${idToStr(nodeId)}/users/${idToStr(userId)}/attachments${qs ? "?" + qs : ""}`;
  const resp = await fetch(url, { headers: authHeaders(token) });
  if (!resp.ok) throw new Error(await resp.text());
  const data = await resp.json();
  return data.items ?? [];
}

export async function upsertAttachment(
  token: string,
  ownerNodeId: string | number,
  ownerUserId: string | number,
  attachmentType: string,
  subjectNodeId: string | number,
  subjectUserId: string | number,
  configJson?: Uint8Array
): Promise<Attachment> {
  const resp = await fetch(
    `${getApiUrl()}/nodes/${idToStr(ownerNodeId)}/users/${idToStr(ownerUserId)}/attachments/${attachmentType}/${idToStr(subjectNodeId)}/${idToStr(subjectUserId)}`,
    {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify({ config_json: configJson ? Array.from(configJson) : [] }),
    }
  );
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

export async function deleteAttachment(
  token: string,
  ownerNodeId: string | number,
  ownerUserId: string | number,
  attachmentType: string,
  subjectNodeId: string | number,
  subjectUserId: string | number
): Promise<void> {
  const resp = await fetch(
    `${getApiUrl()}/nodes/${idToStr(ownerNodeId)}/users/${idToStr(ownerUserId)}/attachments/${attachmentType}/${idToStr(subjectNodeId)}/${idToStr(subjectUserId)}`,
    { method: "DELETE", headers: authHeaders(token) }
  );
  if (!resp.ok) throw new Error(await resp.text());
}
