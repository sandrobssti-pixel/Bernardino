import React, { useState, useEffect, useCallback } from "react";
import Box from "@material-ui/core/Box";
import CircularProgress from "@material-ui/core/CircularProgress";

import SaleList from "../SaleList";
import toastError from "../../errors/toastError";

// Busca as listas que o formulário de venda precisa (clientes, produtos,
// CFOP padrão da configuração fiscal) antes de montar a SaleList — feito
// aqui em vez de dentro do SaleModal pra não recarregar isso toda vez que o
// modal abre/fecha (fica só uma vez, ao entrar na aba Vendas).
const FiscalSalesPanel = ({ finance, fiscal }) => {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [fiscalConfig, setFiscalConfig] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [customersData, productsData, configData] = await Promise.all([
        finance.customers.list({ searchParam: "" }),
        finance.products.list({ searchParam: "" }),
        fiscal.config.show(),
      ]);
      setCustomers(customersData.records || []);
      setProducts(productsData.records || []);
      setFiscalConfig(configData);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" my={6}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <SaleList
      fiscal={fiscal}
      customers={customers}
      products={products}
      fiscalConfig={fiscalConfig}
    />
  );
};

export default FiscalSalesPanel;
