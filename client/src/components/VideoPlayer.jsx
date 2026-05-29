import React, { forwardRef, useImperativeHandle, useRef } from "react";
import ReactPlayer from "react-player";

const VideoPlayer = forwardRef(function VideoPlayer(
  {
    videoUrl,
    playing,
    onPlay,
    onPause,
    onReady,
    onError,
    onProgress,
    onTimeUpdate,
    onSeeked,
    controls = false,
    interactionLocked = false,
  },
  ref,
) {
  const playerRef = useRef(null);

  useImperativeHandle(ref, () => ({
    seekTo: (seconds) => {
      const el = playerRef.current;
      if (!el) return;
      if (typeof el.seekTo === "function") {
        el.seekTo(seconds, "seconds");
        return;
      }
      el.currentTime = seconds;
    },
    getCurrentTime: () => {
      const el = playerRef.current;
      if (!el) return 0;
      if (typeof el.getCurrentTime === "function") {
        return el.getCurrentTime();
      }
      return el.currentTime ?? 0;
    },
  }));

  const youtubeConfig = interactionLocked
    ? { disablekb: 1, fs: 0 }
    : undefined;

  return (
    <div className="video-player-wrap">
      <ReactPlayer
        ref={playerRef}
        src={videoUrl}
        controls={controls}
        playing={playing}
        width="100%"
        height="100%"
        style={{ aspectRatio: "16/9" }}
        config={youtubeConfig ? { youtube: youtubeConfig } : undefined}
        onPlay={onPlay}
        onPause={onPause}
        onReady={onReady}
        onError={onError}
        onProgress={onProgress}
        onTimeUpdate={onTimeUpdate}
        onSeeked={onSeeked}
      />
      {interactionLocked && (
        <div
          className="video-player-shield"
          aria-hidden="true"
          title="Playback is controlled by the host"
        />
      )}
    </div>
  );
});

export default VideoPlayer;
