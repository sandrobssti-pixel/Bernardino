import React, { useState, useEffect } from "react";
import { makeStyles } from "@material-ui/core/styles";

import ModalImage from "react-modal-image";
import api from "../../services/api";

const useStyles = makeStyles(theme => ({
  messageMedia: {
    objectFit: "cover",
    margin: 15,
    width: 140,
    height: 140,
    borderRadius: 12,
    border: `3px solid ${theme.mode === "light" ? "#ffffff" : "rgba(30,41,59,0.8)"}`,
    boxShadow: theme.mode === "light"
      ? "0 4px 12px rgba(0,0,0,0.1)"
      : "0 4px 12px rgba(0,0,0,0.3)",
  },
}));

const ModalImageContatc = ({ imageUrl }) => {
  const classes = useStyles();
  const [fetching, setFetching] = useState(true);
  const [blobUrl, setBlobUrl] = useState("");
  

  useEffect(() => {
    if (!imageUrl) return;
    let objectUrl = null;

    const fetchImage = async () => {
      try {
        // Some contacts can carry malformed picture URLs that break XHR open().
        new URL(imageUrl, window.location.origin);
        const { data, headers } = await api.get(imageUrl, {
          responseType: "blob",
        });
        objectUrl = window.URL.createObjectURL(
          new Blob([data], { type: headers["content-type"] })
        );
        setBlobUrl(objectUrl);
      } catch (error) {
        setBlobUrl(imageUrl);
      } finally {
        setFetching(false);
      }
    };
    fetchImage();

    return () => {
      if (objectUrl) {
        window.URL.revokeObjectURL(objectUrl);
      }
    };
  }, [imageUrl]);

  return (
    <ModalImage
      className={classes.messageMedia}
      smallSrcSet={fetching ? imageUrl : blobUrl}
      medium={fetching ? imageUrl : blobUrl}
      large={fetching ? imageUrl : blobUrl}
      showRotate="true"
      alt="image"
    />
  );
};


export default ModalImageContatc;
