import React, { useEffect, useRef, useState } from "react";
import Autocomplete from "@material-ui/lab/Autocomplete";
import TextField from "@material-ui/core/TextField";
import CircularProgress from "@material-ui/core/CircularProgress";

// Campo de busca com filtro (autocomplete) pra escolher um registro de
// outro cadastro (produto, cliente, fornecedor) sem precisar rolar uma
// lista enorme catando um por um — pedido do cliente depois de importar
// o catálogo real (65+ produtos). Busca no servidor (`fetchOptions`,
// debounced) em vez de só filtrar uma lista já carregada, porque o
// `list()` de cada cadastro é paginado (20 por página) — carregar tudo de
// uma vez não escala. Ver docs/MANUAL_TECNICO.md.
//
// `initialOptions`: além do resultado da busca, sempre inclui essas opções
// (tipicamente o registro já selecionado, pra aparecer mesmo que não esteja
// entre os 20 primeiros da busca em branco — ex.: editando uma conta cujo
// fornecedor não é um dos mais recentes).
const FinanceAsyncAutocomplete = ({
  label,
  placeholder,
  value,
  onChange,
  fetchOptions,
  getOptionLabel,
  renderOption,
  initialOptions = [],
  size = "small",
  disabled = false,
  // `freeSolo` (v2.3.194) — pedido do cliente: campo de SKU com o mesmo
  // dropdown-ao-vivo do "Produto/serviço", mas que continua aceitando
  // texto livre digitado (item avulso, sem produto vinculado), igual já
  // funcionava antes. Nesse modo `value`/`onChange` podem receber uma
  // STRING (texto digitado, sem selecionar da lista) em vez de só o
  // objeto do produto — quem usa decide o que fazer com cada caso.
  freeSolo = false,
}) => {
  const [options, setOptions] = useState(initialOptions);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const debounceRef = useRef(null);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Só entra em ação no modo `freeSolo` com `value` em texto (string) —
  // nos outros usos (Produto/serviço, Cliente, Fornecedor) `value` é
  // sempre objeto ou `null`, então essa condição nunca bate e nada muda
  // pra eles. Mantém o texto digitado em sincronia quando `value` é
  // atualizado de fora (ex.: campo limpo ao trocar de linha/item).
  useEffect(() => {
    if (freeSolo && typeof value === "string") {
      setInputValue(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freeSolo, value]);

  // Garante que as opções iniciais (ex.: registro já selecionado ao editar)
  // sempre apareçam na lista, mesmo antes de qualquer busca.
  useEffect(() => {
    setOptions((prev) => {
      const byId = new Map(prev.map((o) => [o.id, o]));
      initialOptions.forEach((o) => {
        if (o && o.id !== undefined) byId.set(o.id, o);
      });
      return Array.from(byId.values());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOptions]);

  const runSearch = (searchParam) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await fetchOptions(searchParam);
        if (isMounted.current) {
          const byId = new Map((results || []).map((o) => [o.id, o]));
          if (value && value.id !== undefined) byId.set(value.id, value);
          setOptions(Array.from(byId.values()));
        }
      } catch (err) {
        // Busca falhou não impede o resto do formulário de funcionar.
      }
      if (isMounted.current) setLoading(false);
    }, 350);
  };

  return (
    <Autocomplete
      freeSolo={freeSolo}
      autoSelect={freeSolo}
      size={size}
      disabled={disabled}
      options={options}
      loading={loading}
      value={value || (freeSolo ? "" : null)}
      onChange={onChange}
      inputValue={inputValue}
      onInputChange={(event, newInputValue, reason) => {
        setInputValue(newInputValue);
        if (reason === "input") runSearch(newInputValue);
      }}
      onFocus={() => {
        if (options.length <= initialOptions.length) runSearch("");
      }}
      getOptionLabel={getOptionLabel}
      renderOption={renderOption}
      noOptionsText="Nenhum resultado"
      loadingText="Buscando..."
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          variant="outlined"
          size={size}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={16} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
};

export default FinanceAsyncAutocomplete;
