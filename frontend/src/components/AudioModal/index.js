import { Button } from "@material-ui/core";
import React, { useRef, useEffect, useState } from "react";

const LS_NAME = 'audioMessageRate';

const AudioModal = ({url}) => {
    const audioRef = useRef(null);
    const [audioRate, setAudioRate] = useState(() => {
      const parsed = parseFloat(localStorage.getItem(LS_NAME) || "1");
      return Number.isFinite(parsed) ? parsed : 1;
    });
    const [showButtonRate, setShowButtonRate] = useState(false);
    const [sourceUrl, setSourceUrl] = useState(url);
    const [hasTriedFallback, setHasTriedFallback] = useState(false);
    useEffect(() => {
      setSourceUrl(url);
      setHasTriedFallback(false);
    }, [url]);

    useEffect(() => {
      if (audioRef.current) {
        audioRef.current.playbackRate = audioRate;
      }
      localStorage.setItem(LS_NAME, audioRate);
    }, [audioRate]);

    useEffect(() => {
      const audioEl = audioRef.current;
      if (!audioEl) return undefined;

      const handlePlaying = () => {
        setShowButtonRate(true);
      };
      const handlePause = () => {
        setShowButtonRate(false);
      };
      const handleEnded = () => {
        setShowButtonRate(false);
      };

      audioEl.addEventListener("playing", handlePlaying);
      audioEl.addEventListener("pause", handlePause);
      audioEl.addEventListener("ended", handleEnded);

      return () => {
        audioEl.removeEventListener("playing", handlePlaying);
        audioEl.removeEventListener("pause", handlePause);
        audioEl.removeEventListener("ended", handleEnded);
      };
    }, []);

    const toggleRate = () => {
      let newRate = null;

      switch (audioRate) {
        case 0.5:
          newRate = 1;
          break;
        case 1:
          newRate = 1.5;
          break;
        case 1.5:
          newRate = 2;
          break;
        case 2:
          newRate = 0.5;
          break;
        default:
          newRate = 1;
          break;
      }

      setAudioRate(newRate);
    };

    const swapExtension = (currentUrl, fromExt, toExt) => {
      const regex = new RegExp(`\\.${fromExt}(\\?.*)?$`, "i");
      return regex.test(currentUrl)
        ? currentUrl.replace(regex, `.${toExt}$1`)
        : currentUrl;
    };

    const handleAudioError = () => {
      if (hasTriedFallback) return;

      let fallbackUrl = sourceUrl;

      if (
        /\.ogg(\?.*)?$/i.test(sourceUrl) ||
        /\.oga(\?.*)?$/i.test(sourceUrl) ||
        /\.opus(\?.*)?$/i.test(sourceUrl)
      ) {
        fallbackUrl = swapExtension(sourceUrl, "ogg", "mp3");
        fallbackUrl = swapExtension(fallbackUrl, "oga", "mp3");
        fallbackUrl = swapExtension(fallbackUrl, "opus", "mp3");
      } else if (/\.mpeg(\?.*)?$/i.test(sourceUrl)) {
        fallbackUrl = swapExtension(sourceUrl, "mpeg", "mp3");
      }

      if (fallbackUrl !== sourceUrl) {
        setHasTriedFallback(true);
        setSourceUrl(fallbackUrl);
      }
    };

    return (
      <>
        <audio
          ref={audioRef}
          controls
          preload="metadata"
          playsInline
          src={sourceUrl}
          onError={handleAudioError}
        />
        {showButtonRate && (
          <Button
            style={{ marginLeft: "5px", marginTop: "-45px" }}
            onClick={toggleRate}
          >
            {audioRate}x
          </Button>
        )}
      </>
    );
}

export default AudioModal;
