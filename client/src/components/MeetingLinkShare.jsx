import { useState } from "react";
import { copyToClipboard, getMeetingLink } from "../utils/meetingLink";

function MeetingLinkShare({ roomId, variant = "default" }) {
  const [copied, setCopied] = useState(false);
  const link = getMeetingLink(roomId);

  const handleCopy = async () => {
    if (!link) return;
    try {
      const ok = await copyToClipboard(link);
      if (ok) {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      setCopied(false);
    }
  };

  if (!link) return null;

  return (
    <div className={`meeting-link-share meeting-link-share--${variant}`}>
      <div className="meeting-link-label-row">
        <span className="meeting-link-label">Meeting link</span>
        <span className="meeting-link-hint">Share so others can join</span>
      </div>
      <div className="meeting-link-row">
        <input
          className="meeting-link-input"
          type="text"
          readOnly
          value={link}
          aria-label="Meeting invite link"
          onFocus={(e) => e.target.select()}
        />
        <button
          type="button"
          className={`meeting-link-copy${copied ? " meeting-link-copy--done" : ""}`}
          onClick={handleCopy}
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
    </div>
  );
}

export default MeetingLinkShare;
