import React from "react";
import Autocomplete from "@material-ui/lab/Autocomplete";
import TextField from "@material-ui/core/TextField";

import { CFOP_LIST } from "../../data/cfopList";

// CFOP com busca (digita código ou descrição, filtra) — pedido do cliente
// pra não precisar decorar/procurar o código na hora de cadastrar. Lista
// inteira (~600 códigos) já vem embutida no bundle (`data/cfopList.js`),
// filtro é tudo client-side — diferente do `FinanceAsyncAutocomplete`
// (busca no servidor), não precisa disso aqui porque não é paginado nem
// específico de empresa. Valor do campo continua sendo só a string do
// código (ex. "5102"), igual já era antes — só a forma de escolher mudou.
const CfopAutocomplete = ({
  label = "CFOP",
  helperText,
  value,
  onChange,
  size = "small",
  disabled = false,
}) => {
  const selected = CFOP_LIST.find((opt) => opt.value === value) || (value ? { value, label: value } : null);

  return (
    <Autocomplete
      size={size}
      disabled={disabled}
      options={CFOP_LIST}
      value={selected}
      onChange={(event, newValue) => onChange(newValue ? newValue.value : "")}
      getOptionLabel={(opt) => opt?.label || ""}
      noOptionsText="Nenhum CFOP encontrado"
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder="Digite o código ou a descrição"
          helperText={helperText}
          variant="outlined"
          size={size}
        />
      )}
    />
  );
};

export default CfopAutocomplete;
