export function getMeetingLink(roomId) {
  const id = String(roomId || "").trim();
  if (!id) return "";
  return `${window.location.origin}/room/${encodeURIComponent(id)}`;
}

/** Extract room id from a pasted code or full meeting URL */
export function parseRoomIdFromInput(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  if (trimmed.includes("/room/")) {
    try {
      const url = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)
        ? trimmed
        : `https://${trimmed}`;
      const parsed = new URL(url);
      const match = parsed.pathname.match(/\/room\/([^/?#]+)/);
      if (match?.[1]) {
        return decodeURIComponent(match[1]);
      }
    } catch {
      const fallback = trimmed.match(/\/room\/([^/?#\s]+)/);
      if (fallback?.[1]) {
        return decodeURIComponent(fallback[1]);
      }
    }
  }

  return trimmed;
}

export async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  return ok;
}
