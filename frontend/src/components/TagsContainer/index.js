import { Chip, Paper, TextField, makeStyles } from "@material-ui/core";
import Autocomplete from "@material-ui/lab/Autocomplete";
import React, { useEffect, useRef, useState } from "react";
import { isArray, isString } from "lodash";
import toastError from "../../errors/toastError";
import api from "../../services/api";

const useStyles = makeStyles(theme => ({
    container: {
        padding: "2px 8px",
        backgroundColor: "transparent",
        boxShadow: "none",
        [theme.breakpoints.down("sm")]: {
            padding: "1px 4px",
        },
    },
    autocomplete: {
        "& .MuiInputBase-root": {
            padding: "1px 6px !important",
            minHeight: "30px",
        },
        [theme.breakpoints.down("sm")]: {
            "& .MuiInputBase-root": {
                padding: "0 4px !important",
                minHeight: "18px",
            },
            "& .MuiAutocomplete-input": {
                fontSize: "0.62rem",
                padding: "1px 2px !important",
            },
        },
        "& .MuiOutlinedInput-root": {
            borderRadius: 8,
            backgroundColor: theme.mode === "light" ? "rgba(255,255,255,0.6)" : "rgba(30,41,59,0.4)",
            border: `1px solid ${theme.mode === "light" ? "rgba(148,163,184,0.2)" : "rgba(148,163,184,0.15)"}`,
            transition: "all 0.2s ease",
            "&:hover": {
                backgroundColor: theme.mode === "light" ? "rgba(255,255,255,0.8)" : "rgba(30,41,59,0.6)",
            },
            "&.Mui-focused": {
                backgroundColor: theme.mode === "light" ? "#ffffff" : "rgba(30,41,59,0.8)",
                borderColor: theme.mode === "light" ? "rgba(99,102,241,0.4)" : "rgba(99,102,241,0.5)",
                boxShadow: theme.mode === "light" ? "0 0 0 3px rgba(99,102,241,0.1)" : "0 0 0 3px rgba(99,102,241,0.15)",
            },
        },
        "& .MuiOutlinedInput-notchedOutline": {
            border: "none",
        },
    },
    chip: {
        height: 20,
        borderRadius: 4,
        fontSize: "0.7rem",
        fontWeight: 600,
        color: "#fff",
        margin: "1px 3px 1px 0",
        border: "1px solid rgba(255,255,255,0.2)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
        "& .MuiChip-deleteIcon": {
            color: "rgba(255,255,255,0.7)",
            fontSize: 16,
            "&:hover": {
                color: "#fff",
            },
        },
        [theme.breakpoints.down("sm")]: {
            height: 13,
            fontSize: "0.55rem",
            margin: "1px 2px 1px 0",
            "& .MuiChip-label": {
                paddingLeft: 5,
                paddingRight: 5,
            },
            "& .MuiChip-deleteIcon": {
                fontSize: 11,
                marginRight: 1,
            },
        },
    },
    dropdownPaper: {
        width: 320,
        borderRadius: 8,
        marginTop: 4,
        boxShadow: theme.mode === "light"
            ? "0 10px 25px rgba(0,0,0,0.15)"
            : "0 10px 25px rgba(0,0,0,0.4)",
        border: `1px solid ${theme.mode === "light" ? "rgba(148,163,184,0.2)" : "rgba(148,163,184,0.15)"}`,
    },
}));

export function TagsContainer({ contact, onChangeTags }) {
    const classes = useStyles();
    const [tags, setTags] = useState([]);
    const [selecteds, setSelecteds] = useState([]);
    const isMounted = useRef(true);

    useEffect(() => {
        return () => {
            isMounted.current = false
        }
    }, [])

    useEffect(() => {
        if (isMounted.current) {
            loadTags().then(() => {
                if (Array.isArray(contact.tags)) {
                    setSelecteds(contact.tags);
                } else {
                    setSelecteds([]);
                }
            });
        }
    }, [contact]);

    const createTag = async (data) => {
        try {
            const { data: responseData } = await api.post(`/tags`, data);
            return responseData;
        } catch (err) {
            toastError(err);
        }
    }

    const loadTags = async () => {
        try {
            const { data } = await api.get(`/tags/list`, 
            {params: { kanban: 0}
        });
            setTags(data);
        } catch (err) {
            toastError(err);
        }
    }

    const syncTags = async (data) => {
        try {
            const { data: responseData } = await api.post(`/tags/sync`, data);
            return responseData;
        } catch (err) {
            toastError(err);
        }
    }

    const onChange = async (value, reason) => {
        let optionsChanged = []
        if (reason === 'create-option') {
            if (isArray(value)) {
                for (let item of value) {
                    if (item.length < 3) {
                        toastError("Tag muito curta!");
                        return;
                    }
                    if (isString(item)) {
                        const newTag = await createTag({ name: item, kanban: 0, color: getRandomHexColor() })
                        optionsChanged.push(newTag);
                    } else {
                        optionsChanged.push(item);
                    }
                }
            }
            await loadTags();
        } else {
            optionsChanged = value;
        }
        setSelecteds(optionsChanged);
        if (typeof onChangeTags === "function") {
            onChangeTags(optionsChanged);
        }
        if (contact?.id) {
            await syncTags({ contactId: contact.id, tags: optionsChanged });
        }
    }

    function getRandomHexColor() {
        // Gerar valores aleatórios para os componentes de cor
        const red = Math.floor(Math.random() * 256); // Valor entre 0 e 255
        const green = Math.floor(Math.random() * 256); // Valor entre 0 e 255
        const blue = Math.floor(Math.random() * 256); // Valor entre 0 e 255
      
        // Converter os componentes de cor em uma cor hexadecimal
        const hexColor = `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;
      
        return hexColor;
    }

    return (
        <Paper className={classes.container}>
            <Autocomplete
                multiple
                size="small"
                options={tags}
                value={selecteds}
                freeSolo
                onChange={(e, v, r) => onChange(v, r)}
                getOptionLabel={(option) => option.name}
                className={classes.autocomplete}
                renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                        <Chip
                            className={classes.chip}
                            style={{
                                backgroundColor: option.color || '#64748b',
                            }}
                            label={option.name}
                            {...getTagProps({ index })}
                            size="small"
                        />
                    ))
                }
                renderInput={(params) => (
                    <TextField {...params} variant="outlined" placeholder="Tags" size="small" />
                )}
                PaperComponent={({ children }) => (
                    <Paper className={classes.dropdownPaper}>
                        {children}
                    </Paper>
                )}
            />
        </Paper>
    )
}
