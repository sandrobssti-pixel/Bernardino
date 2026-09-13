import { Box, Chip, TextField } from "@material-ui/core";
import Autocomplete from "@material-ui/lab/Autocomplete";
import React, { useEffect, useState } from "react";
import { i18n } from "../../translate/i18n";


export function StatusFilter({ onFiltered, className, containerStyle, textFieldProps }) {
  const [selecteds, setSelecteds] = useState([]);

  useEffect(() => {
    async function fetchData() {
      
    }
    fetchData();
  }, []);

  const onChange = async (value) => {
    setSelecteds(value);
    onFiltered(value);
  };

  const status = [
    { status: "open", name: `${i18n.t("tickets.search.filterConectionsOptions.open")}`, color: "#2563eb" },
    { status: "closed", name: `${i18n.t("tickets.search.filterConectionsOptions.closed")}`, color: "#059669" },
    { status: "pending", name: `${i18n.t("tickets.search.filterConectionsOptions.pending")}`, color: "#d97706" },
    { status: "group", name: "Grupos", color: "#7c3aed" },

  ];

  return (
    <Box style={{ padding: "0px 10px 10px", ...containerStyle }}>
      <Autocomplete 
       className={className}
       multiple      
       size="small"
       options={status}
       value={selecteds}
       onChange={(e, v, r) => onChange(v)}
       getOptionLabel={(option) => option.name}
       renderTags={(value, getTagProps) =>
         value.map((option, index) => (
           <Chip
             style={{
               backgroundColor: option.color || "#334155",
               border: `1px solid ${option.color || "#334155"}`,
               color: "#ffffff",
               fontWeight: 600
             }}
             label={option.name}
             {...getTagProps({ index })}
             size="small"
           />
         ))
       }
       renderInput={(params) => (
         <TextField
           {...params}
           variant="outlined"
           placeholder="Filtro por Status"
           {...textFieldProps}
         />
       )}
      />
    </Box>
  );
}
