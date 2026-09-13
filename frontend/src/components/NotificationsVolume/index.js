import React, { useState, useRef, useEffect } from "react";

import Popover from "@material-ui/core/Popover";
import IconButton from "@material-ui/core/IconButton";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import { makeStyles, withStyles } from "@material-ui/core/styles";
import VolumeUpIcon from "@material-ui/icons/VolumeUp";
import VolumeDownIcon from "@material-ui/icons/VolumeDown";
import VolumeOffIcon from "@material-ui/icons/VolumeOff";
import PlayArrowIcon from "@material-ui/icons/PlayArrow";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import RadioButtonUncheckedIcon from "@material-ui/icons/RadioButtonUnchecked";
import Typography from "@material-ui/core/Typography";
import Divider from "@material-ui/core/Divider";
import Switch from "@material-ui/core/Switch";
import FormControlLabel from "@material-ui/core/FormControlLabel";

import { Grid, Slider } from "@material-ui/core";
import { SOUND_OPTIONS } from "../../utils/notificationSounds";

const IOSSwitch = withStyles((theme) => ({
    root: {
        width: 44,
        height: 26,
        padding: 0,
        margin: "0 0 0 8px",
        flexShrink: 0,
        overflow: "visible",
    },
    switchBase: {
        padding: 3,
        transition: "transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        "&$checked": {
            transform: "translateX(18px)",
            color: "#fff",
            "& + $track": {
                backgroundColor: "#34c759",
                opacity: 1,
                border: "none",
            },
        },
        "&$focusVisible $thumb": {
            color: "#34c759",
        },
    },
    thumb: {
        width: 20,
        height: 20,
        backgroundColor: "#ffffff",
        boxShadow:
            "0 2px 4px rgba(0,0,0,0.22), 0 1px 2px rgba(0,0,0,0.14), 0 0 0 0.5px rgba(0,0,0,0.06)",
    },
    track: {
        borderRadius: 13,
        backgroundColor:
            theme.mode === "light"
                ? "rgba(0,0,0,0.2)"
                : "rgba(148,163,184,0.28)",
        opacity: 1,
        transition: theme.transitions.create(["background-color"], {
            duration: 200,
        }),
    },
    checked: {},
    focusVisible: {},
}))(Switch);

const useStyles = makeStyles((theme) => ({
    popoverPaper: {
        width: "100%",
        maxWidth: 320,
        marginLeft: theme.spacing(2),
        marginRight: theme.spacing(1),
        borderRadius: 12,
        overflow: "hidden",
        border:
            theme.mode === "light"
                ? "1px solid rgba(0, 0, 0, 0.08)"
                : "1px solid rgba(148, 163, 184, 0.1)",
        boxShadow:
            theme.mode === "light"
                ? "0 4px 6px -2px rgba(0,0,0,0.04), 0 16px 40px -6px rgba(0,0,0,0.12)"
                : "0 4px 8px -2px rgba(0,0,0,0.35), 0 16px 40px -6px rgba(0,0,0,0.55)",
        background:
            theme.mode === "light"
                ? "#ffffff"
                : "#1a2234",
        [theme.breakpoints.down("sm")]: {
            maxWidth: 280,
        },
    },
    tabContainer: {
        padding: "14px 16px 12px",
    },
    noShadow: {
        boxShadow: "none !important",
    },
    icons: {
        color: "#fff",
    },
    customBadge: {
        backgroundColor: "#f44336",
        color: "#fff",
    },
    divider: {
        margin: "12px 0",
        backgroundColor:
            theme.mode === "light"
                ? "rgba(0,0,0,0.07)"
                : "rgba(148,163,184,0.1)",
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        color:
            theme.mode === "light"
                ? "rgba(0,0,0,0.4)"
                : "rgba(148,163,184,0.6)",
        marginBottom: 6,
    },
    volumeIcon: {
        color:
            theme.mode === "light"
                ? "rgba(0,0,0,0.4)"
                : "rgba(148,163,184,0.5)",
        fontSize: "1.15rem",
    },
    soundList: {
        marginTop: 4,
        padding: 0,
    },
    soundItem: {
        borderRadius: 7,
        marginBottom: 2,
        paddingTop: 6,
        paddingBottom: 6,
        paddingRight: theme.spacing(1),
        transition: "background 0.12s ease",
        "&:hover": {
            background:
                theme.mode === "light"
                    ? "rgba(0,0,0,0.04)"
                    : "rgba(255,255,255,0.05)",
        },
    },
    soundItemSelected: {
        background:
            theme.mode === "light"
                ? "rgba(0,0,0,0.05)"
                : "rgba(255,255,255,0.07)",
    },
    playButton: {
        marginRight: 6,
        width: 28,
        height: 28,
        borderRadius: 6,
        padding: 4,
        color:
            theme.mode === "light"
                ? "rgba(0,0,0,0.55)"
                : "rgba(226,232,240,0.6)",
        "&:hover": {
            background:
                theme.mode === "light"
                    ? "rgba(0,0,0,0.07)"
                    : "rgba(255,255,255,0.09)",
        },
    },
    selectedIcon: {
        color: theme.palette.primary.main,
        marginLeft: theme.spacing(1),
        fontSize: "1.1rem",
    },
    unselectedIcon: {
        color:
            theme.mode === "light"
                ? "rgba(0,0,0,0.22)"
                : "rgba(148,163,184,0.3)",
        marginLeft: theme.spacing(1),
        fontSize: "1.1rem",
    },
}));

const NotificationsVolume = ({
    volume,
    setVolume,
    notificationSound,
    setNotificationSound,
    notificationMuted,
    setNotificationMuted,
    notificationGroupMuted,
    setNotificationGroupMuted,
}) => {
    const classes = useStyles();

    const anchorEl = useRef();
    const [isOpen, setIsOpen] = useState(false);
    const previewAudioRef = useRef(null);

    const handleClick = () => {
        setIsOpen((prevState) => !prevState);
    };

    const handleClickAway = () => {
        setIsOpen(false);
    };

    const handleVolumeChange = (value) => {
        const normalizedValue = Array.isArray(value) ? value[0] : value;
        setVolume(normalizedValue);
    };

    const handleSoundChange = (value) => {
        setNotificationSound(value);
    };

    const handlePreviewSound = (src) => {
        if (previewAudioRef.current) {
            previewAudioRef.current.pause();
            previewAudioRef.current.currentTime = 0;
        }

        const previewAudio = new Audio(src);
        const normalizedVolume = Number.isFinite(Number(volume))
            ? Math.min(1, Math.max(0, Number(volume)))
            : 1;
        previewAudio.volume = notificationMuted ? 0 : normalizedVolume;
        previewAudio.play().catch(() => null);
        previewAudioRef.current = previewAudio;
    };

    useEffect(() => {
        if (previewAudioRef.current) {
            const normalizedVolume = Number.isFinite(Number(volume))
                ? Math.min(1, Math.max(0, Number(volume)))
                : 1;
            previewAudioRef.current.volume = notificationMuted ? 0 : normalizedVolume;
        }
    }, [volume, notificationMuted]);

    useEffect(() => {
        return () => {
            if (previewAudioRef.current) {
                previewAudioRef.current.pause();
                previewAudioRef.current.currentTime = 0;
            }
        };
    }, []);

    return (
        <>
            <IconButton
                className={classes.icons}
                onClick={handleClick}
                ref={anchorEl}
                aria-label="Open Notifications"
                // color="inherit"
                // color="secondary"
            >
                {notificationMuted ? <VolumeOffIcon color="inherit" /> : <VolumeUpIcon color="inherit" />}
            </IconButton>
            <Popover
                disableScrollLock
                open={isOpen}
                anchorEl={anchorEl.current}
                anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "right",
                }}
                transformOrigin={{
                    vertical: "top",
                    horizontal: "right",
                }}
                classes={{ paper: classes.popoverPaper }}
                onClose={handleClickAway}
            >
                <List dense className={classes.tabContainer}>
                    <FormControlLabel
                        labelPlacement="start"
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            margin: "0 0 10px",
                            width: "100%",
                        }}
                        control={
                            <IOSSwitch
                                checked={notificationMuted}
                                onChange={(e) => setNotificationMuted(e.target.checked)}
                            />
                        }
                        label="Silenciar notificações"
                    />
                    <FormControlLabel
                        labelPlacement="start"
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            margin: "0 0 10px",
                            width: "100%",
                        }}
                        control={
                            <IOSSwitch
                                checked={notificationGroupMuted}
                                onChange={(e) => setNotificationGroupMuted(e.target.checked)}
                            />
                        }
                        label="Silenciar notificações de grupos"
                    />
                    <Grid container spacing={1} alignItems="center" style={{ marginTop: 6 }}>
                        <Grid item>
                            <VolumeDownIcon className={classes.volumeIcon} />
                        </Grid>
                        <Grid item xs>
                            <Slider
                                value={Number(volume)}
                                aria-labelledby="continuous-slider"
                                step={0.1}
                                min={0}
                                max={1}
                                onChange={(e, value) => handleVolumeChange(value)}
                            />
                        </Grid>
                        <Grid item>
                            <VolumeUpIcon className={classes.volumeIcon} />
                        </Grid>
                    </Grid>
                    <Divider className={classes.divider} />
                    <Typography className={classes.sectionTitle}>
                        Som da notificação
                    </Typography>
                    <List dense className={classes.soundList}>
                        {SOUND_OPTIONS.map((option) => {
                            const selected = option.id === notificationSound;
                            return (
                                <ListItem
                                    key={option.id}
                                    button
                                    onClick={() => handleSoundChange(option.id)}
                                    className={`${classes.soundItem} ${selected ? classes.soundItemSelected : ""}`}
                                >
                                    <IconButton
                                        edge="start"
                                        size="small"
                                        className={classes.playButton}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            handlePreviewSound(option.src);
                                        }}
                                        aria-label={`Ouvir ${option.label}`}
                                    >
                                        <PlayArrowIcon fontSize="small" />
                                    </IconButton>
                                    <ListItemText primary={option.label} />
                                    {selected ? (
                                        <CheckCircleOutlineIcon
                                            fontSize="small"
                                            className={classes.selectedIcon}
                                        />
                                    ) : (
                                        <RadioButtonUncheckedIcon
                                            fontSize="small"
                                            className={classes.unselectedIcon}
                                        />
                                    )}
                                </ListItem>
                            );
                        })}
                    </List>
                </List>
            </Popover>
        </>
    );
};

export default NotificationsVolume;
