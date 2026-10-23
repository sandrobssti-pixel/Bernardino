// Tabela de CFOP (Código Fiscal de Operações e Prestações) completa —
// pedido do cliente: "quando digitar aparece pra não ficar procurando".
// Fonte: https://github.com/gleisonnanet/cfop (CSV público, licença MIT),
// baixado em 2026-10-16. Inclui os códigos de cabeçalho de grupo (ex.:
// "1000 — ENTRADAS OU AQUISIÇÕES...") junto com os códigos de operação
// específicos — não são filtrados porque o arquivo fonte não distingue os
// dois de forma confiável, e aparecer um cabeçalho a mais na busca é
// inofensivo (o operador digita a descrição da operação de verdade, ex.
// "venda de mercadoria", e acha o código específico). Ver
// docs/MANUAL_TECNICO.md.
export const CFOP_LIST = [
  {
    "value": "1000",
    "label": "1000 — ENTRADAS OU AQUISIÇÕES DE SERVIÇOS DO ESTADO"
  },
  {
    "value": "1100",
    "label": "1100 — COMPRAS PARA INDUSTRIALIZAÇÃO, COMERCIALIZAÇÃO OU PRESTAÇÃO DE SERVIÇOS"
  },
  {
    "value": "1101",
    "label": "1101 — Compra para industrialização ou produção rural"
  },
  {
    "value": "1102",
    "label": "1102 — Compra para comercialização"
  },
  {
    "value": "1111",
    "label": "1111 — Compra para industrialização de mercadoria recebida anteriormente em consignação industrial"
  },
  {
    "value": "1113",
    "label": "1113 — Compra para comercialização, de mercadoria recebida anteriormente em consignação mercantil"
  },
  {
    "value": "1116",
    "label": "1116 — Compra para industrialização ou produção rural originada de encomenda para recebimento futuro"
  },
  {
    "value": "1117",
    "label": "1117 — Compra para comercialização originada de encomenda para recebimento futuro"
  },
  {
    "value": "1118",
    "label": "1118 — Compra de mercadoria para comercialização pelo adquirente originário, entregue pelo vendedor remetente ao destinatário, em venda à ordem"
  },
  {
    "value": "1120",
    "label": "1120 — Compra para industrialização, em venda à ordem, já recebida do vendedor remetente"
  },
  {
    "value": "1121",
    "label": "1121 — Compra para comercialização, em venda à ordem, já recebida do vendedor remetente"
  },
  {
    "value": "1122",
    "label": "1122 — Compra para industrialização em que a mercadoria foi remetida pelo fornecedor ao industrializador sem transitar pelo estabelecimento adquirente"
  },
  {
    "value": "1124",
    "label": "1124 — Industrialização efetuada por outra empresa"
  },
  {
    "value": "1125",
    "label": "1125 — Industrialização efetuada por outra empresa quando a mercadoria remetida para utilização no processo de industrialização não transitou pelo estabelecimento adquirente da mercadoria"
  },
  {
    "value": "1126",
    "label": "1126 — compras para utilização na prestação de serviços sujeitas ao ICMS"
  },
  {
    "value": "1128",
    "label": "1128 — compras para utilização na prestação de serviços sujeitas ao ISSQN"
  },
  {
    "value": "1150",
    "label": "1150 — TRANSFERÊNCIAS PARA INDUSTRIALIZAÇÃO, COMERCIALIZAÇÃO OU PRESTAÇÃO DE SERVIÇOS"
  },
  {
    "value": "1151",
    "label": "1151 — Transferência para industrialização ou produção rural"
  },
  {
    "value": "1152",
    "label": "1152 — Transferência para comercialização"
  },
  {
    "value": "1153",
    "label": "1153 — Transferência de energia elétrica para distribuição"
  },
  {
    "value": "1154",
    "label": "1154 — Transferência para utilização na prestação de serviço"
  },
  {
    "value": "1200",
    "label": "1200 — DEVOLUÇÕES DE VENDAS DE PRODUÇÃO PRÓPRIA, DE TERCEIROS OU ANULAÇÕES DE VALORES"
  },
  {
    "value": "1201",
    "label": "1201 — Devolução de venda de produção do estabelecimento"
  },
  {
    "value": "1202",
    "label": "1202 — Devolução de venda de mercadoria adquirida ou recebida de terceiros"
  },
  {
    "value": "1203",
    "label": "1203 — Devolução de venda de produção do estabelecimento, destinada à Zona Franca de Manaus ou Áreas de Livre Comércio"
  },
  {
    "value": "1204",
    "label": "1204 — Devolução de venda de mercadoria adquirida ou recebida de terceiros, destinada à Zona Franca de Manaus ou Áreas de Livre Comércio"
  },
  {
    "value": "1205",
    "label": "1205 — Anulação de valor relativo à prestação de serviço de comunicação"
  },
  {
    "value": "1206",
    "label": "1206 — Anulação de valor relativo à prestação de serviço de transporte"
  },
  {
    "value": "1207",
    "label": "1207 — Anulação de valor relativo à venda de energia elétrica"
  },
  {
    "value": "1208",
    "label": "1208 — Devolução de produção do estabelecimento, remetida em transferência"
  },
  {
    "value": "1209",
    "label": "1209 — Devolução de mercadoria adquirida ou recebida de terceiros, remetida em transferência"
  },
  {
    "value": "1250",
    "label": "1250 — COMPRAS DE ENERGIA ELÉTRICA"
  },
  {
    "value": "1251",
    "label": "1251 — Compra de energia elétrica para distribuição ou comercialização"
  },
  {
    "value": "1252",
    "label": "1252 — Compra de energia elétrica por estabelecimento industrial"
  },
  {
    "value": "1253",
    "label": "1253 — Compra de energia elétrica por estabelecimento comercial"
  },
  {
    "value": "1254",
    "label": "1254 — Compra de energia elétrica por estabelecimento prestador de serviço de transporte"
  },
  {
    "value": "1255",
    "label": "1255 — Compra de energia elétrica por estabelecimento prestador de serviço de comunicação"
  },
  {
    "value": "1256",
    "label": "1256 — Compra de energia elétrica por estabelecimento de produtor rural"
  },
  {
    "value": "1257",
    "label": "1257 — Compra de energia elétrica para consumo por demanda contratada"
  },
  {
    "value": "1300",
    "label": "1300 — AQUISIÇÕES DE SERVIÇOS DE COMUNICAÇÃO"
  },
  {
    "value": "1301",
    "label": "1301 — Aquisição de serviço de comunicação para execução de serviço da mesma natureza"
  },
  {
    "value": "1302",
    "label": "1302 — Aquisição de serviço de comunicação por estabelecimento industrial"
  },
  {
    "value": "1303",
    "label": "1303 — Aquisição de serviço de comunicação por estabelecimento comercial"
  },
  {
    "value": "1304",
    "label": "1304 — Aquisição de serviço de comunicação por estabelecimento de prestador de serviço de transporte"
  },
  {
    "value": "1305",
    "label": "1305 — Aquisição de serviço de comunicação por estabelecimento de geradora ou de distribuidora de energia elétrica 1.306 - Aquisição de serviço de comunicação por estabelecimento de produtor rural"
  },
  {
    "value": "1350",
    "label": "1350 — AQUISIÇÕES DE SERVIÇOS DE TRANSPORTE"
  },
  {
    "value": "1351",
    "label": "1351 — Aquisição de serviço de transporte para execução de serviço da mesma natureza"
  },
  {
    "value": "1352",
    "label": "1352 — Aquisição de serviço de transporte por estabelecimento industrial"
  },
  {
    "value": "1353",
    "label": "1353 — Aquisição de serviço de transporte por estabelecimento comercial"
  },
  {
    "value": "1354",
    "label": "1354 — Aquisição de serviço de transporte por estabelecimento de prestador de serviço de comunicação"
  },
  {
    "value": "1355",
    "label": "1355 — Aquisição de serviço de transporte por estabelecimento de geradora ou de distribuidora de energia elétrica"
  },
  {
    "value": "1356",
    "label": "1356 — Aquisição de serviço de transporte por estabelecimento de produtor rural"
  },
  {
    "value": "1360",
    "label": "1360 — Aquisição de serviço de transporte por contribuinte substituto em relação ao serviço de transporte"
  },
  {
    "value": "1400",
    "label": "1400 — ENTRADAS DE MERCADORIAS SUJEITAS AO REGIME DE SUBSTITUIÇÃO TRIBUTÁRIA"
  },
  {
    "value": "1401",
    "label": "1401 — Compra para industrialização ou produção rural em operação com mercadoria sujeita ao regime de substituição tributária"
  },
  {
    "value": "1403",
    "label": "1403 — Compra para comercialização em operação com mercadoria sujeita ao regime de substituição tributária"
  },
  {
    "value": "1406",
    "label": "1406 — Compra de bem para o ativo imobilizado cuja mercadoria está sujeita ao regime de substituição tributária"
  },
  {
    "value": "1407",
    "label": "1407 — Compra de mercadoria para uso ou consumo cuja mercadoria está sujeita ao regime de substituição tributária"
  },
  {
    "value": "1408",
    "label": "1408 — Transferência para industrialização ou produção rural em operação com mercadoria sujeita ao regime de substituição tributária"
  },
  {
    "value": "1409",
    "label": "1409 — Transferência para comercialização em operação com mercadoria sujeita ao regime de substituição tributária"
  },
  {
    "value": "1410",
    "label": "1410 — Devolução de venda de produção do estabelecimento em operação com produto sujeito ao regime de substituição tributária"
  },
  {
    "value": "1411",
    "label": "1411 — Devolução de venda de mercadoria adquirida ou recebida de terceiros em operação com mercadoria sujeita ao regime de substituição tributária 1.414 - Retorno de produção do estabelecimento, remetida para venda fora do estabelecimento em operação com  produto sujeito ao regime de substituição tributária"
  },
  {
    "value": "1415",
    "label": "1415 — Retorno de mercadoria adquirida ou recebida de terceiros, remetida para venda fora do estabelecimento em operação com mercadoria sujeita ao regime de substituição tributária"
  },
  {
    "value": "1450",
    "label": "1450 — SISTEMAS DE INTEGRAÇÃO"
  },
  {
    "value": "1451",
    "label": "1451 — Retorno de animal do estabelecimento produtor"
  },
  {
    "value": "1452",
    "label": "1452 — Retorno de insumo não utilizado na produção"
  },
  {
    "value": "1500",
    "label": "1500 — ENTRADAS DE MERCADORIAS REMETIDAS COM FIM ESPECÍFICO DE EXPORTAÇÃO E EVENTUAIS DEVOLUÇÕES"
  },
  {
    "value": "1501",
    "label": "1501 — Entrada de mercadoria recebida com fim específico de exportação"
  },
  {
    "value": "1503",
    "label": "1503 — Entrada decorrente de devolução de produto remetido com fim específico de exportação, de produção do estabelecimento"
  },
  {
    "value": "1504",
    "label": "1504 — Entrada decorrente de devolução de mercadoria remetida com fim específico de exportação, adquirida ou recebida de terceiros"
  },
  {
    "value": "1505",
    "label": "1505 — Entrada decorrente de devolução simbólica de mercadorias remetidas para formação de lote de exportação, de produtos industrializados ou produzidos pelo próprio estabelecimento"
  },
  {
    "value": "1506",
    "label": "1506 — Entrada decorrente de devolução simbólica de mercadorias, adquiridas ou recebidas de terceiros, remetidas para formação de lote de exportação"
  },
  {
    "value": "1550",
    "label": "1550 — OPERAÇÕES COM BENS DE ATIVO IMOBILIZADO E MATERIAIS PARA USO OU CONSUMO"
  },
  {
    "value": "1551",
    "label": "1551 — Compra de bem para o ativo imobilizado"
  },
  {
    "value": "1552",
    "label": "1552 — Transferência de bem do ativo imobilizado"
  },
  {
    "value": "1553",
    "label": "1553 — Devolução de venda de bem do ativo imobilizado"
  },
  {
    "value": "1554",
    "label": "1554 — Retorno de bem do ativo imobilizado remetido para uso fora do estabelecimento"
  },
  {
    "value": "1555",
    "label": "1555 — Entrada de bem do ativo imobilizado de terceiro, remetido para uso no estabelecimento"
  },
  {
    "value": "1556",
    "label": "1556 — Compra de material para uso ou consumo"
  },
  {
    "value": "1557",
    "label": "1557 — Transferência de material para uso ou consumo"
  },
  {
    "value": "1600",
    "label": "1600 — CRÉDITOS E RESSARCIMENTOS DE ICMS"
  },
  {
    "value": "1601",
    "label": "1601 — Recebimento, por transferência, de crédito de ICMS"
  },
  {
    "value": "1602",
    "label": "1602 — Recebimento, por transferência, de saldo credor de ICMS de outro estabelecimento da mesma empresa, para compensação de saldo devedor de ICMS"
  },
  {
    "value": "1603",
    "label": "1603 — Ressarcimento de ICMS retido por substituição tributária 1.604 - Lançamento do crédito relativo à compra de bem para o ativo imobilizado"
  },
  {
    "value": "1605",
    "label": "1605 — Recebimento, por transferência, de saldo devedor de ICMS de outro estabelecimento da mesma empresa"
  },
  {
    "value": "1652",
    "label": "1652 — Compra de combustível ou lubrificante para comercialização"
  },
  {
    "value": "1653",
    "label": "1653 — Compra de combustível ou lubrificante por consumidor ou usuário final"
  },
  {
    "value": "1658",
    "label": "1658 — Transferência de combustível e lubrificante para industrialização"
  },
  {
    "value": "1659",
    "label": "1659 — Transferência de combustível e lubrificante para comercialização"
  },
  {
    "value": "1660",
    "label": "1660 — Devolução de venda de combustível ou lubrificante destinado à industrialização subseqüente"
  },
  {
    "value": "1661",
    "label": "1661 — Devolução de venda de combustível ou lubrificante destinado à comercialização"
  },
  {
    "value": "1662",
    "label": "1662 — Devolução de venda de combustível ou lubrificante destinado a consumidor ou usuário final"
  },
  {
    "value": "1663",
    "label": "1663 — Entrada de combustível ou lubrificante para armazenagem"
  },
  {
    "value": "1664",
    "label": "1664 — Retorno de combustível ou lubrificante remetido para armazenagem"
  },
  {
    "value": "1900",
    "label": "1900 — OUTRAS ENTRADAS DE MERCADORIAS OU AQUISIÇÕES DE SERVIÇOS"
  },
  {
    "value": "1901",
    "label": "1901 — Entrada para industrialização por encomenda"
  },
  {
    "value": "1902",
    "label": "1902 — Retorno de mercadoria remetida para industrialização por encomenda"
  },
  {
    "value": "1903",
    "label": "1903 — Entrada de mercadoria remetida para industrialização e não aplicada no referido processo"
  },
  {
    "value": "1904",
    "label": "1904 — Retorno de remessa para venda fora do estabelecimento"
  },
  {
    "value": "1905",
    "label": "1905 — Entrada de mercadoria recebida para depósito em depósito fechado ou armazém geral"
  },
  {
    "value": "1906",
    "label": "1906 — Retorno de mercadoria remetida para depósito fechado ou armazém geral"
  },
  {
    "value": "1907",
    "label": "1907 — Retorno simbólico de mercadoria remetida para depósito fechado ou armazém geral"
  },
  {
    "value": "1908",
    "label": "1908 — Entrada de bem por conta de contrato de comodato"
  },
  {
    "value": "1909",
    "label": "1909 — Retorno de bem remetido por conta de contrato de comodato"
  },
  {
    "value": "1910",
    "label": "1910 — Entrada de bonificação, doação ou brinde"
  },
  {
    "value": "1911",
    "label": "1911 — Entrada de amostra grátis"
  },
  {
    "value": "1912",
    "label": "1912 — Entrada de mercadoria ou bem recebido para demonstração"
  },
  {
    "value": "1913",
    "label": "1913 — Retorno de mercadoria ou bem remetido para demonstração"
  },
  {
    "value": "1914",
    "label": "1914 — Retorno de mercadoria ou bem remetido para exposição ou feira"
  },
  {
    "value": "1915",
    "label": "1915 — Entrada de mercadoria ou bem recebido para conserto ou reparo"
  },
  {
    "value": "1916",
    "label": "1916 — Retorno de mercadoria ou bem remetido para conserto ou reparo"
  },
  {
    "value": "1917",
    "label": "1917 — Entrada de mercadoria recebida em consignação mercantil ou industrial"
  },
  {
    "value": "1918",
    "label": "1918 — Devolução de mercadoria remetida em consignação mercantil ou industrial"
  },
  {
    "value": "1919",
    "label": "1919 — Devolução simbólica de mercadoria vendida ou utilizada em processo industrial, remetida anteriormente em consignação mercantil ou industrial"
  },
  {
    "value": "1920",
    "label": "1920 — Entrada de vasilhame ou sacaria"
  },
  {
    "value": "1921",
    "label": "1921 — Retorno de vasilhame ou sacaria"
  },
  {
    "value": "1922",
    "label": "1922 — Lançamento efetuado a título de simples faturamento decorrente de compra para recebimento futuro"
  },
  {
    "value": "1923",
    "label": "1923 — Entrada de mercadoria recebida do vendedor remetente, em venda à ordem"
  },
  {
    "value": "1924",
    "label": "1924 — Entrada para industrialização por conta e ordem do adquirente da mercadoria, quando esta não transitar pelo estabelecimento do adquirente"
  },
  {
    "value": "1925",
    "label": "1925 — Retorno de mercadoria remetida para industrialização por conta e ordem do adquirente da mercadoria, quando esta não transitar pelo estabelecimento do adquirente"
  },
  {
    "value": "1926",
    "label": "1926 — Lançamento efetuado a título de reclassificação de mercadoria decorrente de formação de kit ou de sua desagregação"
  },
  {
    "value": "1931",
    "label": "1931 — Lançamento efetuado pelo tomador do serviço de transporte quando a responsabilidade de retenção do imposto for atribuída ao remetente ou alienante da mercadoria, pelo serviço de transporte realizado por transportador autônomo ou por transportador não inscrito na unidade da Federação onde iniciado o serviço"
  },
  {
    "value": "1932",
    "label": "1932 — Aquisição de serviço de transporte iniciado em unidade da Federação diversa daquela onde inscrito o prestador"
  },
  {
    "value": "1933",
    "label": "1933 — Aquisição de serviço tributado pelo ISSQN"
  },
  {
    "value": "1949",
    "label": "1949 — Outra entrada de mercadoria ou prestação de serviço não especificada"
  },
  {
    "value": "2000",
    "label": "2000 — ENTRADAS OU AQUISIÇÕES DE SERVIÇOS DE OUTROS ESTADOS"
  },
  {
    "value": "2100",
    "label": "2100 — COMPRAS PARA INDUSTRIALIZAÇÃO, COMERCIALIZAÇÃO OU PRESTAÇÃO DE SERVIÇOS"
  },
  {
    "value": "2101",
    "label": "2101 — Compra para industrialização ou produção rural"
  },
  {
    "value": "2102",
    "label": "2102 — Compra para comercialização"
  },
  {
    "value": "2111",
    "label": "2111 — Compra para industrialização de mercadoria recebida anteriormente em consignação industrial"
  },
  {
    "value": "2113",
    "label": "2113 — Compra para comercialização, de mercadoria recebida anteriormente em consignação mercantil"
  },
  {
    "value": "2116",
    "label": "2116 — Compra para industrialização ou produção rural originada de encomenda para recebimento futuro"
  },
  {
    "value": "2117",
    "label": "2117 — Compra para comercialização originada de encomenda para recebimento futuro"
  },
  {
    "value": "2118",
    "label": "2118 — Compra de mercadoria para comercialização pelo adquirente originário, entregue pelo vendedor remetente ao destinatário, em venda à ordem"
  },
  {
    "value": "2120",
    "label": "2120 — Compra para industrialização, em venda à ordem, já recebida do vendedor remetente 2.121 - Compra para comercialização, em venda à ordem, já recebida do vendedor remetente"
  },
  {
    "value": "2122",
    "label": "2122 — Compra para industrialização em que a mercadoria foi remetida pelo fornecedor ao industrializador sem transitar pelo estabelecimento adquirente"
  },
  {
    "value": "2124",
    "label": "2124 — Industrialização efetuada por outra empresa"
  },
  {
    "value": "2125",
    "label": "2125 — Industrialização efetuada por outra empresa quando a mercadoria remetida para utilização no processo de industrialização não transitou pelo estabelecimento adquirente da mercadoria"
  },
  {
    "value": "2126",
    "label": "2126 — Compra para utilização na prestação de serviço"
  },
  {
    "value": "2150",
    "label": "2150 — TRANSFERÊNCIAS PARA INDUSTRIALIZAÇÃO, COMERCIALIZAÇÃO OU PRESTAÇÃO DE SERVIÇOS"
  },
  {
    "value": "2151",
    "label": "2151 — Transferência para industrialização ou produção rural"
  },
  {
    "value": "2152",
    "label": "2152 — Transferência para comercialização"
  },
  {
    "value": "2153",
    "label": "2153 — Transferência de energia elétrica para distribuição"
  },
  {
    "value": "2154",
    "label": "2154 — Transferência para utilização na prestação de serviço"
  },
  {
    "value": "2200",
    "label": "2200 — DEVOLUÇÕES DE VENDAS DE PRODUÇÃO PRÓPRIA, DE TERCEIROS OU ANULAÇÕES DE VALORES"
  },
  {
    "value": "2201",
    "label": "2201 — Devolução de venda de produção do estabelecimento"
  },
  {
    "value": "2202",
    "label": "2202 — Devolução de venda de mercadoria adquirida ou recebida de terceiros"
  },
  {
    "value": "2203",
    "label": "2203 — Devolução de venda de produção do estabelecimento, destinada à Zona Franca de Manaus ou Áreas de Livre Comércio"
  },
  {
    "value": "2204",
    "label": "2204 — Devolução de venda de mercadoria adquirida ou recebida de terceiros, destinada à Zona Franca de Manaus ou Áreas de Livre Comércio"
  },
  {
    "value": "2205",
    "label": "2205 — Anulação de valor relativo à prestação de serviço de comunicação"
  },
  {
    "value": "2206",
    "label": "2206 — Anulação de valor relativo à prestação de serviço de transporte"
  },
  {
    "value": "2207",
    "label": "2207 — Anulação de valor relativo à venda de energia elétrica"
  },
  {
    "value": "2208",
    "label": "2208 — Devolução de produção do estabelecimento, remetida em transferência"
  },
  {
    "value": "2209",
    "label": "2209 — Devolução de mercadoria adquirida ou recebida de terceiros, remetida em transferência "
  },
  {
    "value": "2250",
    "label": "2250 — COMPRAS DE ENERGIA ELÉTRICA"
  },
  {
    "value": "2251",
    "label": "2251 — Compra de energia elétrica para distribuição ou comercialização"
  },
  {
    "value": "2252",
    "label": "2252 — Compra de energia elétrica por estabelecimento industrial"
  },
  {
    "value": "2253",
    "label": "2253 — Compra de energia elétrica por estabelecimento comercial"
  },
  {
    "value": "2254",
    "label": "2254 — Compra de energia elétrica por estabelecimento prestador de serviço de transporte"
  },
  {
    "value": "2255",
    "label": "2255 — Compra de energia elétrica por estabelecimento prestador de serviço de comunicação"
  },
  {
    "value": "2256",
    "label": "2256 — Compra de energia elétrica por estabelecimento de produtor rural"
  },
  {
    "value": "2257",
    "label": "2257 — Compra de energia elétrica para consumo por demanda contratada"
  },
  {
    "value": "2300",
    "label": "2300 — AQUISIÇÕES DE SERVIÇOS DE COMUNICAÇÃO"
  },
  {
    "value": "2301",
    "label": "2301 — Aquisição de serviço de comunicação para execução de serviço da mesma natureza"
  },
  {
    "value": "2302",
    "label": "2302 — Aquisição de serviço de comunicação por estabelecimento industrial"
  },
  {
    "value": "2303",
    "label": "2303 — Aquisição de serviço de comunicação por estabelecimento comercial"
  },
  {
    "value": "2304",
    "label": "2304 — Aquisição de serviço de comunicação por estabelecimento de prestador de serviço de transporte"
  },
  {
    "value": "2305",
    "label": "2305 — Aquisição de serviço de comunicação por estabelecimento de geradora ou de distribuidora de energia elétrica"
  },
  {
    "value": "2306",
    "label": "2306 — Aquisição de serviço de comunicação por estabelecimento de produtor rural"
  },
  {
    "value": "2351",
    "label": "2351 — Aquisição de serviço de transporte para execução de serviço da mesma natureza"
  },
  {
    "value": "2352",
    "label": "2352 — Aquisição de serviço de transporte por estabelecimento industrial"
  },
  {
    "value": "2353",
    "label": "2353 — Aquisição de serviço de transporte por estabelecimento comercial"
  },
  {
    "value": "2354",
    "label": "2354 — Aquisição de serviço de transporte por estabelecimento de prestador de serviço de comunicação"
  },
  {
    "value": "2355",
    "label": "2355 — Aquisição de serviço de transporte por estabelecimento de geradora ou de distribuidora de energia elétrica"
  },
  {
    "value": "2356",
    "label": "2356 — Aquisição de serviço de transporte por estabelecimento de produtor rural"
  },
  {
    "value": "2400",
    "label": "2400 — ENTRADAS DE MERCADORIAS SUJEITAS AO REGIME DE SUBSTITUIÇÃO TRIBUTÁRIA"
  },
  {
    "value": "2401",
    "label": "2401 — Compra para industrialização ou produção rural em operação com mercadoria sujeita ao regime desubstituição tributária"
  },
  {
    "value": "2403",
    "label": "2403 — Compra para comercialização em operação com mercadoria sujeita ao regime de substituição tributária"
  },
  {
    "value": "2406",
    "label": "2406 — Compra de bem para o ativo imobilizado cuja mercadoria está sujeita ao regime de substituição tributária"
  },
  {
    "value": "2407",
    "label": "2407 — Compra de mercadoria para uso ou consumo cuja mercadoria está sujeita ao regime de substituição tributária"
  },
  {
    "value": "2408",
    "label": "2408 — Transferência para industrialização ou produção rural em operação com mercadoria sujeita ao regime de substituição tributária"
  },
  {
    "value": "2409",
    "label": "2409 — Transferência para comercialização em operação com mercadoria sujeita ao regime de substituição tributária"
  },
  {
    "value": "2410",
    "label": "2410 — Devolução de venda de produção do estabelecimento em operação com produto sujeito ao regime desubstituição tributária"
  },
  {
    "value": "2411",
    "label": "2411 — Devolução de venda de mercadoria adquirida ou recebida de terceiros em operação com mercadoria sujeita ao regime de substituição tributária"
  },
  {
    "value": "2414",
    "label": "2414 — Retorno de produção do estabelecimento, remetida para venda fora do estabelecimento em operação com produto sujeito ao regime de substituição tributária"
  },
  {
    "value": "2415",
    "label": "2415 — Retorno de mercadoria adquirida ou recebida de terceiros, remetida para venda fora do estabelecimento em operação com mercadoria sujeita ao regime de substituição tributária"
  },
  {
    "value": "2500",
    "label": "2500 — ENTRADAS DE MERCADORIAS REMETIDAS COM FIM ESPECÍFICO DE EXPORTAÇÃO E EVENTUAIS DEVOLUÇÕES"
  },
  {
    "value": "2501",
    "label": "2501 — Entrada de mercadoria recebida com fim específico de exportação"
  },
  {
    "value": "2503",
    "label": "2503 — Entrada decorrente de devolução de produto remetido com fim específico de exportação, de produção do estabelecimento"
  },
  {
    "value": "2504",
    "label": "2504 — Entrada decorrente de devolução de mercadoria remetida com fim específico de exportação, adquirida ou recebida de terceiros"
  },
  {
    "value": "2505",
    "label": "2505 — Entrada decorrente de devolução simbólica de mercadorias remetidas para formação de lote de exportação, de produtos industrializados ou produzidos pelo próprio estabelecimento"
  },
  {
    "value": "2506",
    "label": "2506 — Entrada decorrente de devolução simbólica de mercadorias, adquiridas ou recebidas de terceiros, remetidas para formação de lote de exportação"
  },
  {
    "value": "2550",
    "label": "2550 — OPERAÇÕES COM BENS DE ATIVO IMOBILIZADO E MATERIAIS PARA USO OU CONSUMO"
  },
  {
    "value": "2551",
    "label": "2551 — Compra de bem para o ativo imobilizado"
  },
  {
    "value": "2552",
    "label": "2552 — Transferência de bem do ativo imobilizado"
  },
  {
    "value": "2553",
    "label": "2553 — Devolução de venda de bem do ativo imobilizado"
  },
  {
    "value": "2554",
    "label": "2554 — Retorno de bem do ativo imobilizado remetido para uso fora do estabelecimento"
  },
  {
    "value": "2555",
    "label": "2555 — Entrada de bem do ativo imobilizado de terceiro, remetido para uso no estabelecimento"
  },
  {
    "value": "2556",
    "label": "2556 — Compra de material para uso ou consumo"
  },
  {
    "value": "2557",
    "label": "2557 — Transferência de material para uso ou consumo"
  },
  {
    "value": "2600",
    "label": "2600 — CRÉDITOS E RESSARCIMENTOS DE ICMS"
  },
  {
    "value": "2603",
    "label": "2603 — Ressarcimento de ICMS retido por substituição tributária"
  },
  {
    "value": "2651",
    "label": "2651 — Compra de combustível ou lubrificante para industrialização subseqüente"
  },
  {
    "value": "2652",
    "label": "2652 — Compra de combustível ou lubrificante para comercialização"
  },
  {
    "value": "2653",
    "label": "2653 — Compra de combustível ou lubrificante por consumidor ou usuário final"
  },
  {
    "value": "2658",
    "label": "2658 — Transferência de combustível e lubrificante para industrialização"
  },
  {
    "value": "2659",
    "label": "2659 — Transferência de combustível e lubrificante para comercialização"
  },
  {
    "value": "2660",
    "label": "2660 — Devolução de venda de combustível ou lubrificante destinado à industrialização subseqüente"
  },
  {
    "value": "2661",
    "label": "2661 — Devolução de venda de combustível ou lubrificante destinado à comercialização"
  },
  {
    "value": "2662",
    "label": "2662 — Devolução de venda de combustível ou lubrificante destinado a consumidor ou usuário final"
  },
  {
    "value": "2663",
    "label": "2663 — Entrada de combustível ou lubrificante para armazenagem"
  },
  {
    "value": "2664",
    "label": "2664 — Retorno de combustível ou lubrificante remetido para armazenagem "
  },
  {
    "value": "2900",
    "label": "2900 — OUTRAS ENTRADAS DE MERCADORIAS OU AQUISIÇÕES DE SERVIÇOS"
  },
  {
    "value": "2901",
    "label": "2901 — Entrada para industrialização por encomenda"
  },
  {
    "value": "2902",
    "label": "2902 — Retorno de mercadoria remetida para industrialização por encomenda"
  },
  {
    "value": "2903",
    "label": "2903 — Entrada de mercadoria remetida para industrialização e não aplicada no referido processo"
  },
  {
    "value": "2904",
    "label": "2904 — Retorno de remessa para venda fora do estabelecimento"
  },
  {
    "value": "2905",
    "label": "2905 — Entrada de mercadoria recebida para depósito em depósito fechado ou armazém geral"
  },
  {
    "value": "2906",
    "label": "2906 — Retorno de mercadoria remetida para depósito fechado ou armazém geral"
  },
  {
    "value": "2907",
    "label": "2907 — Retorno simbólico de mercadoria remetida para depósito fechado ou armazém geral"
  },
  {
    "value": "2908",
    "label": "2908 — Entrada de bem por conta de contrato de comodato"
  },
  {
    "value": "2909",
    "label": "2909 — Retorno de bem remetido por conta de contrato de comodato"
  },
  {
    "value": "2910",
    "label": "2910 — Entrada de bonificação, doação ou brinde"
  },
  {
    "value": "2911",
    "label": "2911 — Entrada de amostra grátis"
  },
  {
    "value": "2912",
    "label": "2912 — Entrada de mercadoria ou bem recebido para demonstração"
  },
  {
    "value": "2913",
    "label": "2913 — Retorno de mercadoria ou bem remetido para demonstração"
  },
  {
    "value": "2914",
    "label": "2914 — Retorno de mercadoria ou bem remetido para exposição ou feira"
  },
  {
    "value": "2915",
    "label": "2915 — Entrada de mercadoria ou bem recebido para conserto ou reparo"
  },
  {
    "value": "2916",
    "label": "2916 — Retorno de mercadoria ou bem remetido para conserto ou reparo"
  },
  {
    "value": "2917",
    "label": "2917 — Entrada de mercadoria recebida em consignação mercantil ou industrial"
  },
  {
    "value": "2918",
    "label": "2918 — Devolução de mercadoria remetida em consignação mercantil ou industrial"
  },
  {
    "value": "2919",
    "label": "2919 — Devolução simbólica de mercadoria vendida ou utilizada em processo industrial, remetida anteriormente em consignação mercantil ou industrial"
  },
  {
    "value": "2920",
    "label": "2920 — Entrada de vasilhame ou sacaria"
  },
  {
    "value": "2921",
    "label": "2921 — Retorno de vasilhame ou sacaria"
  },
  {
    "value": "2922",
    "label": "2922 — Lançamento efetuado a título de simples faturamento decorrente de compra para recebimento futuro"
  },
  {
    "value": "2923",
    "label": "2923 — Entrada de mercadoria recebida do vendedor remetente, em venda à ordem"
  },
  {
    "value": "2924",
    "label": "2924 — Entrada para industrialização por conta e ordem do adquirente da mercadoria, quando esta não transitar pelo estabelecimento do adquirente"
  },
  {
    "value": "2925",
    "label": "2925 — Retorno de mercadoria remetida para industrialização por conta e ordem do adquirente da mercadoria, quando esta não transitar pelo estabelecimento do adquirente"
  },
  {
    "value": "2931",
    "label": "2931 — Lançamento efetuado pelo tomador do serviço de transporte quando a responsabilidade de retenção do imposto for atribuída ao remetente ou alienante da mercadoria, pelo serviço de transporte realizado por transportador autônomo ou por transportador não inscrito na unidade da Federação onde iniciado o serviço"
  },
  {
    "value": "2932",
    "label": "2932 — Aquisição de serviço de transporte iniciado em unidade da Federação diversa daquela onde inscrito o prestador"
  },
  {
    "value": "2933",
    "label": "2933 — Aquisição de serviço tributado pelo ISSQN"
  },
  {
    "value": "2949",
    "label": "2949 — Outra entrada de mercadoria ou prestação de serviço não especificado "
  },
  {
    "value": "3000",
    "label": "3000 — ENTRADAS OU AQUISIÇÕES DE SERVIÇOS DO EXTERIOR "
  },
  {
    "value": "3100",
    "label": "3100 — COMPRAS PARA INDUSTRIALIZAÇÃO, COMERCIALIZAÇÃO OU PRESTAÇÃO DE SERVIÇOS"
  },
  {
    "value": "3101",
    "label": "3101 — Compra para industrialização ou produção rural"
  },
  {
    "value": "3102",
    "label": "3102 — Compra para comercialização"
  },
  {
    "value": "3126",
    "label": "3126 — Compra para utilização na prestação de serviço"
  },
  {
    "value": "3127",
    "label": "3127 — Compra para industrialização sob o regime de \"drawback\" "
  },
  {
    "value": "3200",
    "label": "3200 — DEVOLUÇÕES DE VENDAS DE PRODUÇÃO PRÓPRIA, DE TERCEIROS OU ANULAÇÕES DE VALORES"
  },
  {
    "value": "3201",
    "label": "3201 — Devolução de venda de produção do estabelecimento"
  },
  {
    "value": "3202",
    "label": "3202 — Devolução de venda de mercadoria adquirida ou recebida de terceiros"
  },
  {
    "value": "3205",
    "label": "3205 — Anulação de valor relativo à prestação de serviço de comunicação"
  },
  {
    "value": "3206",
    "label": "3206 — Anulação de valor relativo à prestação de serviço de transporte"
  },
  {
    "value": "3207",
    "label": "3207 — Anulação de valor relativo à venda de energia elétrica"
  },
  {
    "value": "3211",
    "label": "3211 — Devolução de venda de produção do estabelecimento sob o regime de \"drawback\" "
  },
  {
    "value": "3250",
    "label": "3250 — COMPRAS DE ENERGIA ELÉTRICA"
  },
  {
    "value": "3251",
    "label": "3251 — Compra de energia elétrica para distribuição ou comercialização "
  },
  {
    "value": "3300",
    "label": "3300 — AQUISIÇÕES DE SERVIÇOS DE COMUNICAÇÃO"
  },
  {
    "value": "3301",
    "label": "3301 — Aquisição de serviço de comunicação para execução de serviço da mesma natureza "
  },
  {
    "value": "3350",
    "label": "3350 — AQUISIÇÕES DE SERVIÇOS DE TRANSPORTE"
  },
  {
    "value": "3351",
    "label": "3351 — Aquisição de serviço de transporte para execução de serviço da mesma natureza"
  },
  {
    "value": "3352",
    "label": "3352 — Aquisição de serviço de transporte por estabelecimento industrial"
  },
  {
    "value": "3353",
    "label": "3353 — Aquisição de serviço de transporte por estabelecimento comercial"
  },
  {
    "value": "3354",
    "label": "3354 — Aquisição de serviço de transporte por estabelecimento de prestador de serviço de comunicação"
  },
  {
    "value": "3355",
    "label": "3355 — Aquisição de serviço de transporte por estabelecimento de geradora ou de distribuidora de energia elétrica"
  },
  {
    "value": "3356",
    "label": "3356 — Aquisição de serviço de transporte por estabelecimento de produtor rural "
  },
  {
    "value": "3500",
    "label": "3500 — ENTRADAS DE MERCADORIAS REMETIDAS COM FIM ESPECÍFICO DE EXPORTAÇÃO E EVENTUAIS DEVOLUÇÕES"
  },
  {
    "value": "3503",
    "label": "3503 — Devolução de mercadoria exportada que tenha sido recebida com fim específico de exportação "
  },
  {
    "value": "3550",
    "label": "3550 — OPERAÇÕES COM BENS DE ATIVO IMOBILIZADO E MATERIAIS PARA USO OU CONSUMO"
  },
  {
    "value": "3551",
    "label": "3551 — Compra de bem para o ativo imobilizado"
  },
  {
    "value": "3553",
    "label": "3553 — Devolução de venda de bem do ativo imobilizado"
  },
  {
    "value": "3556",
    "label": "3556 — Compra de material para uso ou consumo"
  },
  {
    "value": "3651",
    "label": "3651 — Compra de combustível ou lubrificante para industrialização subseqüente"
  },
  {
    "value": "3652",
    "label": "3652 — Compra de combustível ou lubrificante para comercialização"
  },
  {
    "value": "3653",
    "label": "3653 — Compra de combustível ou lubrificante por consumidor ou usuário final "
  },
  {
    "value": "3900",
    "label": "3900 — OUTRAS ENTRADAS DE MERCADORIAS OU AQUISIÇÕES DE SERVIÇOS"
  },
  {
    "value": "3930",
    "label": "3930 — Lançamento efetuado a título de entrada de bem sob amparo de regime especial aduaneiro de admissão temporária"
  },
  {
    "value": "3949",
    "label": "3949 — Outra entrada de mercadoria ou prestação de serviço não especificado "
  },
  {
    "value": "5000",
    "label": "5000 — SAÍDAS OU PRESTAÇÕES DE SERVIÇOS PARA O ESTADO "
  },
  {
    "value": "5100",
    "label": "5100 — VENDAS DE PRODUÇÃO PRÓPRIA OU DE TERCEIROS"
  },
  {
    "value": "5101",
    "label": "5101 — Venda de produção do estabelecimento"
  },
  {
    "value": "5102",
    "label": "5102 — Venda de mercadoria adquirida ou recebida de terceiros"
  },
  {
    "value": "5103",
    "label": "5103 — Venda de produção do estabelecimento, efetuada fora do estabelecimento"
  },
  {
    "value": "5104",
    "label": "5104 — Venda de mercadoria adquirida ou recebida de terceiros, efetuada fora do estabelecimento"
  },
  {
    "value": "5105",
    "label": "5105 — Venda de produção do estabelecimento que não deva por ele transitar"
  },
  {
    "value": "5106",
    "label": "5106 — Venda de mercadoria adquirida ou recebida de terceiros, que não deva por ele transitar"
  },
  {
    "value": "5109",
    "label": "5109 — Venda de produção do estabelecimento, destinada à Zona Franca de Manaus ou Áreas de Livre Comércio"
  },
  {
    "value": "5110",
    "label": "5110 — Venda de mercadoria adquirida ou recebida de terceiros, destinada à Zona Franca de Manaus ou Áreas de Livre Comércio"
  },
  {
    "value": "5111",
    "label": "5111 — Venda de produção do estabelecimento remetida anteriormente em consignação industrial"
  },
  {
    "value": "5112",
    "label": "5112 — Venda de mercadoria adquirida ou recebida de terceiros remetida anteriormente em consignação industrial"
  },
  {
    "value": "5113",
    "label": "5113 — Venda de produção do estabelecimento remetida anteriormente em consignação mercantil"
  },
  {
    "value": "5114",
    "label": "5114 — Venda de mercadoria adquirida ou recebida de terceiros remetida anteriormente em consignação mercantil"
  },
  {
    "value": "5115",
    "label": "5115 — Venda de mercadoria adquirida ou recebida de terceiros, recebida anteriormente em consignação mercantil"
  },
  {
    "value": "5116",
    "label": "5116 — Venda de produção do estabelecimento originada de encomenda para entrega futura"
  },
  {
    "value": "5117",
    "label": "5117 — Venda de mercadoria adquirida ou recebida de terceiros, originada de encomenda para entrega futura"
  },
  {
    "value": "5118",
    "label": "5118 — Venda de produção do estabelecimento entregue ao destinatário por conta e ordem do adquirente originário, em venda à ordem"
  },
  {
    "value": "5119",
    "label": "5119 — Venda de mercadoria adquirida ou recebida de terceiros entregue ao destinatário por conta e ordem do adquirente originário, em venda à ordem"
  },
  {
    "value": "5120",
    "label": "5120 — Venda de mercadoria adquirida ou recebida de terceiros entregue ao destinatário pelo vendedor remetente, em venda à ordem"
  },
  {
    "value": "5122",
    "label": "5122 — Venda de produção do estabelecimento remetida para industrialização, por conta e ordem do adquirente, sem transitar pelo estabelecimento do adquirente"
  },
  {
    "value": "5123",
    "label": "5123 — Venda de mercadoria adquirida ou recebida de terceiros remetida para industrialização, por conta e ordem do adquirente, sem transitar pelo estabelecimento do adquirente"
  },
  {
    "value": "5124",
    "label": "5124 — Industrialização efetuada para outra empresa"
  },
  {
    "value": "5125",
    "label": "5125 — Industrialização efetuada para outra empresa quando a mercadoria recebida para utilização no processo de industrialização não transitar pelo estabelecimento adquirente da mercadoria"
  },
  {
    "value": "5150",
    "label": "5150 — TRANSFERÊNCIAS DE PRODUÇÃO PRÓPRIA OU DE TERCEIROS"
  },
  {
    "value": "5151",
    "label": "5151 — Transferência de produção do estabelecimento"
  },
  {
    "value": "5152",
    "label": "5152 — Transferência de mercadoria adquirida ou recebida de terceiros"
  },
  {
    "value": "5153",
    "label": "5153 — Transferência de energia elétrica"
  },
  {
    "value": "5155",
    "label": "5155 — Transferência de produção do estabelecimento, que não deva por ele transitar"
  },
  {
    "value": "5156",
    "label": "5156 — Transferência de mercadoria adquirida ou recebida de terceiros, que não deva por ele transitar"
  },
  {
    "value": "5200",
    "label": "5200 — DEVOLUÇÕES DE COMPRAS PARA INDUSTRIALIZAÇÃO, COMERCIALIZAÇÃO OU ANULAÇÕES DE VALORES"
  },
  {
    "value": "5201",
    "label": "5201 — Devolução de compra para industrialização ou produção rural"
  },
  {
    "value": "5202",
    "label": "5202 — Devolução de compra para comercialização"
  },
  {
    "value": "5205",
    "label": "5205 — Anulação de valor relativo a aquisição de serviço de comunicação"
  },
  {
    "value": "5206",
    "label": "5206 — Anulação de valor relativo a aquisição de serviço de transporte"
  },
  {
    "value": "5207",
    "label": "5207 — Anulação de valor relativo à compra de energia elétrica"
  },
  {
    "value": "5208",
    "label": "5208 — Devolução de mercadoria recebida em transferência para industrialização ou produção rural"
  },
  {
    "value": "5209",
    "label": "5209 — Devolução de mercadoria recebida em transferência para comercialização"
  },
  {
    "value": "5210",
    "label": "5210 — Devolução de compra para utilização na prestação de serviço sujeitas ao ICMS ou ISSQN"
  },
  {
    "value": "5250",
    "label": "5250 — VENDAS DE ENERGIA ELÉTRICA"
  },
  {
    "value": "5251",
    "label": "5251 — Venda de energia elétrica para distribuição ou comercialização"
  },
  {
    "value": "5252",
    "label": "5252 — Venda de energia elétrica para estabelecimento industrial"
  },
  {
    "value": "5253",
    "label": "5253 — Venda de energia elétrica para estabelecimento comercial"
  },
  {
    "value": "5254",
    "label": "5254 — Venda de energia elétrica para estabelecimento prestador de serviço de transporte"
  },
  {
    "value": "5255",
    "label": "5255 — Venda de energia elétrica para estabelecimento prestador de serviço de comunicação"
  },
  {
    "value": "5256",
    "label": "5256 — Venda de energia elétrica para estabelecimento de produtor rural"
  },
  {
    "value": "5257",
    "label": "5257 — Venda de energia elétrica para consumo por demanda contratada"
  },
  {
    "value": "5258",
    "label": "5258 — Venda de energia elétrica a não contribuinte "
  },
  {
    "value": "5300",
    "label": "5300 — PRESTAÇÕES DE SERVIÇOS DE COMUNICAÇÃO"
  },
  {
    "value": "5301",
    "label": "5301 — Prestação de serviço de comunicação para execução de serviço da mesma natureza"
  },
  {
    "value": "5302",
    "label": "5302 — Prestação de serviço de comunicação a estabelecimento industrial"
  },
  {
    "value": "5303",
    "label": "5303 — Prestação de serviço de comunicação a estabelecimento comercial"
  },
  {
    "value": "5304",
    "label": "5304 — Prestação de serviço de comunicação a estabelecimento de prestador de serviço de transporte"
  },
  {
    "value": "5305",
    "label": "5305 — Prestação de serviço de comunicação a estabelecimento de geradora ou de distribuidora de energia elétrica"
  },
  {
    "value": "5306",
    "label": "5306 — Prestação de serviço de comunicação a estabelecimento de produtor rural"
  },
  {
    "value": "5307",
    "label": "5307 — Prestação de serviço de comunicação a não contribuinte "
  },
  {
    "value": "5350",
    "label": "5350 — PRESTAÇÕES DE SERVIÇOS DE TRANSPORTE"
  },
  {
    "value": "5351",
    "label": "5351 — Prestação de serviço de transporte para execução de serviço da mesma natureza"
  },
  {
    "value": "5352",
    "label": "5352 — Prestação de serviço de transporte a estabelecimento industrial"
  },
  {
    "value": "5353",
    "label": "5353 — Prestação de serviço de transporte a estabelecimento comercial"
  },
  {
    "value": "5354",
    "label": "5354 — Prestação de serviço de transporte a estabelecimento de prestador de serviço de comunicação"
  },
  {
    "value": "5355",
    "label": "5355 — Prestação de serviço de transporte a estabelecimento de geradora ou de distribuidora de energia elétrica"
  },
  {
    "value": "5356",
    "label": "5356 — Prestação de serviço de transporte a estabelecimento de produtor rural"
  },
  {
    "value": "5357",
    "label": "5357 — Prestação de serviço de transporte a não contribuinte"
  },
  {
    "value": "5359",
    "label": "5359 — Prestação de serviço de transporte a contribuinte ou a não contribuinte quando a mercadoria transportada está dispensada de emissão de nota fiscal"
  },
  {
    "value": "5360",
    "label": "5360 — Prestação de serviço de transporte a contribuinte substituto em relação ao serviço de transporte"
  },
  {
    "value": "5400",
    "label": "5400 — SAÍDAS DE MERCADORIAS SUJEITAS AO REGIME DE SUBSTITUIÇÃO TRIBUTÁRIA"
  },
  {
    "value": "5401",
    "label": "5401 — Venda de produção do estabelecimento em operação com produto sujeito ao regime de substituição tributária, na condição de contribuinte substituto"
  },
  {
    "value": "5402",
    "label": "5402 — Venda de produção do estabelecimento de produto sujeito ao regime de substituição tributária, em operação entre contribuintes substitutos do mesmo produto"
  },
  {
    "value": "5403",
    "label": "5403 — Venda de mercadoria adquirida ou recebida de terceiros em operação com mercadoria sujeita ao regime de substituição tributária, na condição de contribuinte substituto"
  },
  {
    "value": "5405",
    "label": "5405 — Venda de mercadoria adquirida ou recebida de terceiros em operação com mercadoria sujeita ao regime de substituição tributária, na condição de contribuinte substituído"
  },
  {
    "value": "5408",
    "label": "5408 — Transferência de produção do estabelecimento em operação com produto sujeito ao regime de substituição tributária"
  },
  {
    "value": "5409",
    "label": "5409 — Transferência de mercadoria adquirida ou recebida de terceiros em operação com mercadoria sujeita ao regime de substituição tributária"
  },
  {
    "value": "5410",
    "label": "5410 — Devolução de compra para industrialização ou produção rural em operação com mercadoria sujeita ao regime de substituição tributária"
  },
  {
    "value": "5411",
    "label": "5411 — Devolução de compra para comercialização em operação com mercadoria sujeita ao regime de substituição tributária"
  },
  {
    "value": "5412",
    "label": "5412 — Devolução de bem do ativo imobilizado, em operação com mercadoria sujeita ao regime de substituição tributária"
  },
  {
    "value": "5413",
    "label": "5413 — Devolução de mercadoria destinada ao uso ou consumo, em operação com mercadoria sujeita ao regime de substituição tributária"
  },
  {
    "value": "5414",
    "label": "5414 — Remessa de produção do estabelecimento para venda fora do estabelecimento em operação com produto sujeito ao regime de substituição tributária"
  },
  {
    "value": "5415",
    "label": "5415 — Remessa de mercadoria adquirida ou recebida de terceiros para venda fora do estabelecimento, em operação com mercadoria sujeita ao regime de substituição tributária"
  },
  {
    "value": "5450",
    "label": "5450 — SISTEMAS DE INTEGRAÇÃO"
  },
  {
    "value": "5451",
    "label": "5451 — Remessa de animal e de insumo para estabelecimento produtor"
  },
  {
    "value": "5500",
    "label": "5500 — REMESSAS COM FIM ESPECÍFICO DE EXPORTAÇÃO E EVENTUAIS DEVOLUÇÕES"
  },
  {
    "value": "5501",
    "label": "5501 — Remessa de produção do estabelecimento, com fim específico de exportação 5.502 - Remessa de mercadoria adquirida ou recebida de terceiros, com fim específico de exportação"
  },
  {
    "value": "5503",
    "label": "5503 — Devolução de mercadoria recebida com fim específico de exportação"
  },
  {
    "value": "5504",
    "label": "5504 — Remessa de mercadorias para formação de lote de exportação, de produtos industrializados ou produzidos pelo próprio estabelecimento"
  },
  {
    "value": "5505",
    "label": "5505 — Remessa de mercadorias, adquiridas ou recebidas de terceiros, para formação de lote de exportação "
  },
  {
    "value": "5550",
    "label": "5550 — OPERAÇÕES COM BENS DE ATIVO IMOBILIZADO E MATERIAIS PARA USO OU CONSUMO"
  },
  {
    "value": "5551",
    "label": "5551 — Venda de bem do ativo imobilizado"
  },
  {
    "value": "5552",
    "label": "5552 — Transferência de bem do ativo imobilizado"
  },
  {
    "value": "5553",
    "label": "5553 — Devolução de compra de bem para o ativo imobilizado"
  },
  {
    "value": "5554",
    "label": "5554 — Remessa de bem do ativo imobilizado para uso fora do estabelecimento"
  },
  {
    "value": "5555",
    "label": "5555 — Devolução de bem do ativo imobilizado de terceiro, recebido para uso no estabelecimento"
  },
  {
    "value": "5556",
    "label": "5556 — Devolução de compra de material de uso ou consumo"
  },
  {
    "value": "5557",
    "label": "5557 — Transferência de material de uso ou consumo"
  },
  {
    "value": "5600",
    "label": "5600 — CRÉDITOS E RESSARCIMENTOS DE ICMS"
  },
  {
    "value": "5601",
    "label": "5601 — Transferência de crédito de ICMS acumulado"
  },
  {
    "value": "5602",
    "label": "5602 — Transferência de saldo credor de ICMS para outro estabelecimento da mesma empresa, destinado à compensação de saldo devedor de ICMS"
  },
  {
    "value": "5603",
    "label": "5603 — Ressarcimento de ICMS retido por substituição tributária"
  },
  {
    "value": "5605",
    "label": "5605 — Transferência de saldo devedor de ICMS de outro estabelecimento da mesma empresa"
  },
  {
    "value": "5606",
    "label": "5606 — Utilização de saldo credor de ICMS para extinção por compensação de débitos fiscais"
  },
  {
    "value": "5651",
    "label": "5651 — Venda de combustível ou lubrificante de produção do estabelecimento destinado à industrialização subseqüente"
  },
  {
    "value": "5652",
    "label": "5652 — Venda de combustível ou lubrificante de produção do estabelecimento destinado à comercialização"
  },
  {
    "value": "5653",
    "label": "5653 — Venda de combustível ou lubrificante de produção do estabelecimento destinado a consumidor ou usuário final"
  },
  {
    "value": "5654",
    "label": "5654 — Venda de combustível ou lubrificante adquirido ou recebido de terceiros destinado à industrialização subseqüente"
  },
  {
    "value": "5655",
    "label": "5655 — Venda de combustível ou lubrificante adquirido ou recebido de terceiros destinado à comercialização"
  },
  {
    "value": "5656",
    "label": "5656 — Venda de combustível ou lubrificante adquirido ou recebido de terceiros destinado a consumidor ou usuário final"
  },
  {
    "value": "5657",
    "label": "5657 — Remessa de combustível ou lubrificante adquirido ou recebido de terceiros para venda fora do estabelecimento"
  },
  {
    "value": "5658",
    "label": "5658 — Transferência de combustível ou lubrificante de produção do estabelecimento"
  },
  {
    "value": "5659",
    "label": "5659 — Transferência de combustível ou lubrificante adquirido ou recebido de terceiro"
  },
  {
    "value": "5660",
    "label": "5660 — Devolução de compra de combustível ou lubrificante adquirido para industrialização subseqüente"
  },
  {
    "value": "5661",
    "label": "5661 — Devolução de compra de combustível ou lubrificante adquirido para comercialização"
  },
  {
    "value": "5662",
    "label": "5662 — Devolução de compra de combustível ou lubrificante adquirido por consumidor ou usuário final"
  },
  {
    "value": "5663",
    "label": "5663 — Remessa para armazenagem de combustível ou lubrificante"
  },
  {
    "value": "5664",
    "label": "5664 — Retorno de combustível ou lubrificante recebido para armazenagem"
  },
  {
    "value": "5665",
    "label": "5665 — Retorno simbólico de combustível ou lubrificante recebido para armazenagem"
  },
  {
    "value": "5666",
    "label": "5666 — Remessa por conta e ordem de terceiros de combustível ou lubrificante recebido para armazenagem "
  },
  {
    "value": "5900",
    "label": "5900 — OUTRAS SAÍDAS DE MERCADORIAS OU PRESTAÇÕES DE SERVIÇOS"
  },
  {
    "value": "5901",
    "label": "5901 — Remessa para industrialização por encomenda"
  },
  {
    "value": "5902",
    "label": "5902 — Retorno de mercadoria utilizada na industrialização por encomenda"
  },
  {
    "value": "5903",
    "label": "5903 — Retorno de mercadoria recebida para industrialização e não aplicada no referido processo"
  },
  {
    "value": "5904",
    "label": "5904 — Remessa para venda fora do estabelecimento"
  },
  {
    "value": "5905",
    "label": "5905 — Remessa para depósito fechado ou armazém geral"
  },
  {
    "value": "5906",
    "label": "5906 — Retorno de mercadoria depositada em depósito fechado ou armazém geral"
  },
  {
    "value": "5907",
    "label": "5907 — Retorno simbólico de mercadoria depositada em depósito fechado ou armazém geral"
  },
  {
    "value": "5908",
    "label": "5908 — Remessa de bem por conta de contrato de comodato"
  },
  {
    "value": "5909",
    "label": "5909 — Retorno de bem recebido por conta de contrato de comodato"
  },
  {
    "value": "5910",
    "label": "5910 — Remessa em bonificação, doação ou brinde"
  },
  {
    "value": "5911",
    "label": "5911 — Remessa de amostra grátis"
  },
  {
    "value": "5912",
    "label": "5912 — Remessa de mercadoria ou bem para demonstração"
  },
  {
    "value": "5913",
    "label": "5913 — Retorno de mercadoria ou bem recebido para demonstração"
  },
  {
    "value": "5914",
    "label": "5914 — Remessa de mercadoria ou bem para exposição ou feira"
  },
  {
    "value": "5915",
    "label": "5915 — Remessa de mercadoria ou bem para conserto ou reparo"
  },
  {
    "value": "5916",
    "label": "5916 — Retorno de mercadoria ou bem recebido para conserto ou reparo"
  },
  {
    "value": "5917",
    "label": "5917 — Remessa de mercadoria em consignação mercantil ou industrial"
  },
  {
    "value": "5918",
    "label": "5918 — Devolução de mercadoria recebida em consignação mercantil ou industrial"
  },
  {
    "value": "5919",
    "label": "5919 — Devolução simbólica de mercadoria vendida ou utilizada em processo industrial, recebida anteriormente em consignação mercantil ou industrial"
  },
  {
    "value": "5920",
    "label": "5920 — Remessa de vasilhame ou sacaria"
  },
  {
    "value": "5921",
    "label": "5921 — Devolução de vasilhame ou sacaria"
  },
  {
    "value": "5922",
    "label": "5922 — Lançamento efetuado a título de simples faturamento decorrente de venda para entrega futura"
  },
  {
    "value": "5923",
    "label": "5923 — Remessa de mercadoria por conta e ordem de terceiros, em venda à ordem"
  },
  {
    "value": "5924",
    "label": "5924 — Remessa para industrialização por conta e ordem do adquirente da mercadoria, quando esta não transitar pelo estabelecimento do adquirente"
  },
  {
    "value": "5925",
    "label": "5925 — Retorno de mercadoria recebida para industrialização por conta e ordem do adquirente da mercadoria, quando aquela não transitar pelo estabelecimento do adquirente"
  },
  {
    "value": "5926",
    "label": "5926 — Lançamento efetuado a título de reclassificação de mercadoria decorrente de formação de kit ou de sua desagregação"
  },
  {
    "value": "5927",
    "label": "5927 — Lançamento efetuado a título de baixa de estoque decorrente de perda, roubo ou deterioração"
  },
  {
    "value": "5928",
    "label": "5928 — Lançamento efetuado a título de baixa de estoque decorrente do encerramento da atividade da empresa"
  },
  {
    "value": "5929",
    "label": "5929 — Lançamento efetuado em decorrência de emissão de documento fiscal relativo a operação ou prestação também registrada em equipamento Emissor de Cupom Fiscal - ECF"
  },
  {
    "value": "5931",
    "label": "5931 — Lançamento efetuado em decorrência da responsabilidade de retenção do imposto por substituição tributária, atribuída ao remetente ou alienante da mercadoria, pelo serviço de transporte realizado por transportador autônomo ou por transportador não inscrito na unidade da Federação onde iniciado o serviço"
  },
  {
    "value": "5932",
    "label": "5932 — Prestação de serviço de transporte iniciada em unidade da Federação diversa daquela onde inscrito o prestador"
  },
  {
    "value": "5933",
    "label": "5933 — Prestação de serviço tributado pelo ISSQN"
  },
  {
    "value": "5949",
    "label": "5949 — Outra saída de mercadoria ou prestação de serviço não especificado "
  },
  {
    "value": "6000",
    "label": "6000 — SAÍDAS OU PRESTAÇÕES DE SERVIÇOS PARA OUTROS ESTADOS "
  },
  {
    "value": "6100",
    "label": "6100 — VENDAS DE PRODUÇÃO PRÓPRIA OU DE TERCEIROS"
  },
  {
    "value": "6101",
    "label": "6101 — Venda de produção do estabelecimento"
  },
  {
    "value": "6102",
    "label": "6102 — Venda de mercadoria adquirida ou recebida de terceiros"
  },
  {
    "value": "6103",
    "label": "6103 — Venda de produção do estabelecimento, efetuada fora do estabelecimento"
  },
  {
    "value": "6104",
    "label": "6104 — Venda de mercadoria adquirida ou recebida de terceiros, efetuada fora do estabelecimento"
  },
  {
    "value": "6105",
    "label": "6105 — Venda de produção do estabelecimento que não deva por ele transitar"
  },
  {
    "value": "6106",
    "label": "6106 — Venda de mercadoria adquirida ou recebida de terceiros, que não deva por ele transitar"
  },
  {
    "value": "6107",
    "label": "6107 — Venda de produção do estabelecimento, destinada a não contribuinte"
  },
  {
    "value": "6108",
    "label": "6108 — Venda de mercadoria adquirida ou recebida de terceiros, destinada a não contribuinte"
  },
  {
    "value": "6109",
    "label": "6109 — Venda de produção do estabelecimento, destinada à Zona Franca de Manaus ou Áreas de Livre Comércio"
  },
  {
    "value": "6110",
    "label": "6110 — Venda de mercadoria adquirida ou recebida de terceiros, destinada à Zona Franca de Manaus ou Áreas de Livre Comércio"
  },
  {
    "value": "6111",
    "label": "6111 — Venda de produção do estabelecimento remetida anteriormente em consignação industrial"
  },
  {
    "value": "6112",
    "label": "6112 — Venda de mercadoria adquirida ou recebida de Terceiros remetida anteriormente em consignação industrial"
  },
  {
    "value": "6113",
    "label": "6113 — Venda de produção do estabelecimento remetida anteriormente em consignação mercantil"
  },
  {
    "value": "6114",
    "label": "6114 — Venda de mercadoria adquirida ou recebida de terceiros remetida anteriormente em consignação mercantil"
  },
  {
    "value": "6115",
    "label": "6115 — Venda de mercadoria adquirida ou recebida de terceiros, recebida anteriormente em consignação mercantil"
  },
  {
    "value": "6116",
    "label": "6116 — Venda de produção do estabelecimento originada de encomenda para entrega futura"
  },
  {
    "value": "6117",
    "label": "6117 — Venda de mercadoria adquirida ou recebida de terceiros, originada de encomenda para entrega futura"
  },
  {
    "value": "6118",
    "label": "6118 — Venda de produção do estabelecimento entregue ao destinatário por conta e ordem do adquirente originário, em venda à ordem"
  },
  {
    "value": "6119",
    "label": "6119 — Venda de mercadoria adquirida ou recebida de terceiros entregue ao destinatário por conta e ordem do adquirente originário, em venda à ordem"
  },
  {
    "value": "6120",
    "label": "6120 — Venda de mercadoria adquirida ou recebida de terceiros entregue ao destinatário pelo vendedor remetente, em venda à ordem"
  },
  {
    "value": "6122",
    "label": "6122 — Venda de produção do estabelecimento remetida para industrialização, por conta e ordem do adquirente, sem transitar pelo estabelecimento do adquirente"
  },
  {
    "value": "6123",
    "label": "6123 — Venda de mercadoria adquirida ou recebida de terceiros remetida para industrialização, por conta e ordem do adquirente, sem transitar pelo estabelecimento do adquirente"
  },
  {
    "value": "6124",
    "label": "6124 — Industrialização efetuada para outra empresa"
  },
  {
    "value": "6125",
    "label": "6125 — Industrialização efetuada para outra empresa quando a mercadoria recebida para utilização no processo de industrialização não transitar pelo estabelecimento adquirente da mercadoria"
  },
  {
    "value": "6150",
    "label": "6150 — TRANSFERÊNCIAS DE PRODUÇÃO PRÓPRIA OU DE TERCEIROS"
  },
  {
    "value": "6151",
    "label": "6151 — Transferência de produção do estabelecimento"
  },
  {
    "value": "6152",
    "label": "6152 — Transferência de mercadoria adquirida ou recebida de terceiros"
  },
  {
    "value": "6153",
    "label": "6153 — Transferência de energia elétrica 6.155 - Transferência de produção do estabelecimento, que não deva por ele transitar"
  },
  {
    "value": "6156",
    "label": "6156 — Transferência de mercadoria adquirida ou recebida de terceiros, que não deva por ele transitar"
  },
  {
    "value": "6200",
    "label": "6200 — DEVOLUÇÕES DE COMPRAS PARA INDUSTRIALIZAÇÃO, COMERCIALIZAÇÃO OU ANULAÇÕES DE VALORES"
  },
  {
    "value": "6201",
    "label": "6201 — Devolução de compra para industrialização ou produção rural"
  },
  {
    "value": "6202",
    "label": "6202 — Devolução de compra para comercialização"
  },
  {
    "value": "6205",
    "label": "6205 — Anulação de valor relativo a aquisição de serviço de comunicação"
  },
  {
    "value": "6206",
    "label": "6206 — Anulação de valor relativo a aquisição de serviço de transporte"
  },
  {
    "value": "6207",
    "label": "6207 — Anulação de valor relativo à compra de energia elétrica"
  },
  {
    "value": "6208",
    "label": "6208 — Devolução de mercadoria recebida em transferência para industrialização ou produção rural"
  },
  {
    "value": "6209",
    "label": "6209 — Devolução de mercadoria recebida em transferência para comercialização"
  },
  {
    "value": "6210",
    "label": "6210 — Devolução de compra para utilização na prestação de serviço "
  },
  {
    "value": "6250",
    "label": "6250 — VENDAS DE ENERGIA ELÉTRICA"
  },
  {
    "value": "6251",
    "label": "6251 — Venda de energia elétrica para distribuição ou comercialização"
  },
  {
    "value": "6252",
    "label": "6252 — Venda de energia elétrica para estabelecimento industrial"
  },
  {
    "value": "6253",
    "label": "6253 — Venda de energia elétrica para estabelecimento comercial"
  },
  {
    "value": "6254",
    "label": "6254 — Venda de energia elétrica para estabelecimento prestador de serviço de transporte"
  },
  {
    "value": "6255",
    "label": "6255 — Venda de energia elétrica para estabelecimento prestador de serviço de comunicação"
  },
  {
    "value": "6256",
    "label": "6256 — Venda de energia elétrica para estabelecimento de produtor rural"
  },
  {
    "value": "6257",
    "label": "6257 — Venda de energia elétrica para consumo por demanda contratada"
  },
  {
    "value": "6258",
    "label": "6258 — Venda de energia elétrica a não contribuinte"
  },
  {
    "value": "6300",
    "label": "6300 — PRESTAÇÕES DE SERVIÇOS DE COMUNICAÇÃO"
  },
  {
    "value": "6301",
    "label": "6301 — Prestação de serviço de comunicação para execução de serviço da mesma natureza"
  },
  {
    "value": "6302",
    "label": "6302 — Prestação de serviço de comunicação a estabelecimento industrial"
  },
  {
    "value": "6303",
    "label": "6303 — Prestação de serviço de comunicação a estabelecimento comercial"
  },
  {
    "value": "6304",
    "label": "6304 — Prestação de serviço de comunicação a estabelecimento de prestador de serviço de transporte"
  },
  {
    "value": "6305",
    "label": "6305 — Prestação de serviço de comunicação a estabelecimento de geradora ou de distribuidora de energia elétrica"
  },
  {
    "value": "6306",
    "label": "6306 — Prestação de serviço de comunicação a estabelecimento de produtor rural"
  },
  {
    "value": "6307",
    "label": "6307 — Prestação de serviço de comunicação a não contribuinte"
  },
  {
    "value": "6350",
    "label": "6350 — PRESTAÇÕES DE SERVIÇOS DE TRANSPORTE"
  },
  {
    "value": "6351",
    "label": "6351 — Prestação de serviço de transporte para execução de serviço da mesma natureza"
  },
  {
    "value": "6352",
    "label": "6352 — Prestação de serviço de transporte a estabelecimento industrial"
  },
  {
    "value": "6353",
    "label": "6353 — Prestação de serviço de transporte a estabelecimento comercial"
  },
  {
    "value": "6354",
    "label": "6354 — Prestação de serviço de transporte a estabelecimento de prestador de serviço de comunicação"
  },
  {
    "value": "6355",
    "label": "6355 — Prestação de serviço de transporte a estabelecimento de geradora ou de distribuidora de energia elétrica"
  },
  {
    "value": "6356",
    "label": "6356 — Prestação de serviço de transporte a estabelecimento de produtor rural"
  },
  {
    "value": "6357",
    "label": "6357 — Prestação de serviço de transporte a não contribuinte"
  },
  {
    "value": "6359",
    "label": "6359 — Prestação de serviço de transporte a contribuinte ou a não contribuinte quando a mercadoria transportada está dispensada de emissão de nota fiscal"
  },
  {
    "value": "6400",
    "label": "6400 — SAÍDAS DE MERCADORIAS SUJEITAS AO REGIME DE SUBSTITUIÇÃO TRIBUTÁRIA"
  },
  {
    "value": "6401",
    "label": "6401 — Venda de produção do estabelecimento em operação com produto sujeito ao regime de substituição tributária, na condição de contribuinte substituto"
  },
  {
    "value": "6402",
    "label": "6402 — Venda de produção do estabelecimento de produto sujeito ao regime de substituição tributária, em operação entre contribuintes substitutos do mesmo produto"
  },
  {
    "value": "6403",
    "label": "6403 — Venda de mercadoria adquirida ou recebida de terceiros em operação com mercadoria sujeita ao regime de substituição tributária, na condição de contribuinte substituto"
  },
  {
    "value": "6404",
    "label": "6404 — Venda de mercadoria sujeita ao regime de substituição tributária, cujo imposto já tenha sido retido anteriormente"
  },
  {
    "value": "6408",
    "label": "6408 — Transferência de produção do estabelecimento em operação com produto sujeito ao regime de substituição tributária"
  },
  {
    "value": "6409",
    "label": "6409 — Transferência de mercadoria adquirida ou recebida de terceiros em operação com mercadoria sujeita ao regime de substituição tributária"
  },
  {
    "value": "6410",
    "label": "6410 — Devolução de compra para industrialização ou produção rural em operação com mercadoria sujeita ao regime de substituição tributária"
  },
  {
    "value": "6411",
    "label": "6411 — Devolução de compra para comercialização em operação com mercadoria sujeita ao regime de substituição tributária"
  },
  {
    "value": "6412",
    "label": "6412 — Devolução de bem do ativo imobilizado, em operação com mercadoria sujeita ao regime de substituição tributária"
  },
  {
    "value": "6413",
    "label": "6413 — Devolução de mercadoria destinada ao uso ou consumo, em operação com mercadoria sujeita ao regime de substituição tributária"
  },
  {
    "value": "6414",
    "label": "6414 — Remessa de produção do estabelecimento para venda fora do estabelecimento em operação com produto sujeito ao regime de substituição tributária"
  },
  {
    "value": "6415",
    "label": "6415 — Remessa de mercadoria adquirida ou recebida de terceiros para venda fora do estabelecimento, em operação com mercadoria sujeita ao regime de substituição tributária"
  },
  {
    "value": "6500",
    "label": "6500 — REMESSAS COM FIM ESPECÍFICO DE EXPORTAÇÃO E EVENTUAIS DEVOLUÇÕES"
  },
  {
    "value": "6501",
    "label": "6501 — Remessa de produção do estabelecimento, com fim específico de exportação"
  },
  {
    "value": "6502",
    "label": "6502 — Remessa de mercadoria adquirida ou recebida de terceiros, com fim específico de exportação"
  },
  {
    "value": "6503",
    "label": "6503 — Devolução de mercadoria recebida com fim específico de exportação"
  },
  {
    "value": "6504",
    "label": "6504 — Remessa de mercadorias para formação de lote de exportação, de produtos industrializados ou produzidos pelo próprio estabelecimento"
  },
  {
    "value": "6505",
    "label": "6505 — Remessa de mercadorias, adquiridas ou recebidas de terceiros, para formação de lote de exportação"
  },
  {
    "value": "6550",
    "label": "6550 — OPERAÇÕES COM BENS DE ATIVO IMOBILIZADO E MATERIAIS PARA USO OU CONSUMO"
  },
  {
    "value": "6551",
    "label": "6551 — Venda de bem do ativo imobilizado"
  },
  {
    "value": "6552",
    "label": "6552 — Transferência de bem do ativo imobilizado"
  },
  {
    "value": "6553",
    "label": "6553 — Devolução de compra de bem para o ativo imobilizado"
  },
  {
    "value": "6554",
    "label": "6554 — Remessa de bem do ativo imobilizado para uso fora do estabelecimento"
  },
  {
    "value": "6555",
    "label": "6555 — Devolução de bem do ativo imobilizado de terceiro, recebido para uso no estabelecimento"
  },
  {
    "value": "6556",
    "label": "6556 — Devolução de compra de material de uso ou consumo"
  },
  {
    "value": "6557",
    "label": "6557 — Transferência de material de uso ou consumo"
  },
  {
    "value": "6600",
    "label": "6600 — CRÉDITOS E RESSARCIMENTOS DE ICMS"
  },
  {
    "value": "6603",
    "label": "6603 — Ressarcimento de ICMS retido por substituição tributária"
  },
  {
    "value": "6651",
    "label": "6651 — Venda de combustível ou lubrificante de produção do estabelecimento destinado à industrialização subseqüente"
  },
  {
    "value": "6652",
    "label": "6652 — Venda de combustível ou lubrificante de produção do estabelecimento destinado à comercialização"
  },
  {
    "value": "6653",
    "label": "6653 — Venda de combustível ou lubrificante de produção do estabelecimento destinado a consumidor ou usuário final"
  },
  {
    "value": "6654",
    "label": "6654 — Venda de combustível ou lubrificante adquirido ou recebido de terceiros destinado à industrialização subseqüente"
  },
  {
    "value": "6655",
    "label": "6655 — Venda de combustível ou lubrificante adquirido ou recebido de terceiros destinado à comercialização"
  },
  {
    "value": "6656",
    "label": "6656 — Venda de combustível ou lubrificante adquirido ou recebido de terceiros destinado a consumidor ou usuário final"
  },
  {
    "value": "6657",
    "label": "6657 — Remessa de combustível ou lubrificante adquirido ou recebido de terceiros para venda fora do estabelecimento"
  },
  {
    "value": "6658",
    "label": "6658 — Transferência de combustível ou lubrificante de produção do estabelecimento"
  },
  {
    "value": "6659",
    "label": "6659 — Transferência de combustível ou lubrificante adquirido ou recebido de terceiro"
  },
  {
    "value": "6660",
    "label": "6660 — Devolução de compra de combustível ou lubrificante adquirido para industrialização subseqüente"
  },
  {
    "value": "6661",
    "label": "6661 — Devolução de compra de combustível ou lubrificante adquirido para comercialização"
  },
  {
    "value": "6662",
    "label": "6662 — Devolução de compra de combustível ou lubrificante adquirido por consumidor ou usuário final"
  },
  {
    "value": "6663",
    "label": "6663 — Remessa para armazenagem de combustível ou lubrificante"
  },
  {
    "value": "6664",
    "label": "6664 — Retorno de combustível ou lubrificante recebido para armazenagem"
  },
  {
    "value": "6665",
    "label": "6665 — Retorno simbólico de combustível ou lubrificante recebido para armazenagem"
  },
  {
    "value": "6666",
    "label": "6666 — Remessa por conta e ordem de terceiros de combustível ou lubrificante recebido para armazenagem"
  },
  {
    "value": "6900",
    "label": "6900 — OUTRAS SAÍDAS DE MERCADORIAS OU PRESTAÇÕES DE SERVIÇOS"
  },
  {
    "value": "6901",
    "label": "6901 — Remessa para industrialização por encomenda"
  },
  {
    "value": "6902",
    "label": "6902 — Retorno de mercadoria utilizada na industrialização por encomenda"
  },
  {
    "value": "6903",
    "label": "6903 — Retorno de mercadoria recebida para industrialização e não aplicada no referido processo"
  },
  {
    "value": "6904",
    "label": "6904 — Remessa para venda fora do estabelecimento"
  },
  {
    "value": "6905",
    "label": "6905 — Remessa para depósito fechado ou armazém geral"
  },
  {
    "value": "6906",
    "label": "6906 — Retorno de mercadoria depositada em depósito fechado ou armazém geral"
  },
  {
    "value": "6907",
    "label": "6907 — Retorno simbólico de mercadoria depositada em depósito fechado ou armazém geral"
  },
  {
    "value": "6908",
    "label": "6908 — Remessa de bem por conta de contrato de comodato"
  },
  {
    "value": "6909",
    "label": "6909 — Retorno de bem recebido por conta de contrato de comodato"
  },
  {
    "value": "6910",
    "label": "6910 — Remessa em bonificação, doação ou brinde"
  },
  {
    "value": "6911",
    "label": "6911 — Remessa de amostra grátis"
  },
  {
    "value": "6912",
    "label": "6912 — Remessa de mercadoria ou bem para demonstração 6.913 - Retorno de mercadoria ou bem recebido para demonstração"
  },
  {
    "value": "6914",
    "label": "6914 — Remessa de mercadoria ou bem para exposição ou feira"
  },
  {
    "value": "6915",
    "label": "6915 — Remessa de mercadoria ou bem para conserto ou reparo"
  },
  {
    "value": "6916",
    "label": "6916 — Retorno de mercadoria ou bem recebido para conserto ou reparo"
  },
  {
    "value": "6917",
    "label": "6917 — Remessa de mercadoria em consignação mercantil ou industrial"
  },
  {
    "value": "6918",
    "label": "6918 — Devolução de mercadoria recebida em consignação mercantil ou industrial"
  },
  {
    "value": "6919",
    "label": "6919 — Devolução simbólica de mercadoria vendida ou utilizada em processo industrial, recebida anteriormente em consignação mercantil ou industrial"
  },
  {
    "value": "6920",
    "label": "6920 — Remessa de vasilhame ou sacaria"
  },
  {
    "value": "6921",
    "label": "6921 — Devolução de vasilhame ou sacaria"
  },
  {
    "value": "6922",
    "label": "6922 — Lançamento efetuado a título de simples faturamento decorrente de venda para entrega futura"
  },
  {
    "value": "6923",
    "label": "6923 — Remessa de mercadoria por conta e ordem de terceiros, em venda à ordem"
  },
  {
    "value": "6924",
    "label": "6924 — Remessa para industrialização por conta e ordem do adquirente da mercadoria, quando esta não transitar pelo estabelecimento do adquirente"
  },
  {
    "value": "6925",
    "label": "6925 — Retorno de mercadoria recebida para industrialização por conta e ordem do adquirente da mercadoria, quando aquela não transitar pelo estabelecimento do adquirente"
  },
  {
    "value": "6929",
    "label": "6929 — Lançamento efetuado em decorrência de emissão de documento fiscal relativo a operação ou prestação também registrada em equipamento Emissor de Cupom Fiscal - ECF"
  },
  {
    "value": "6931",
    "label": "6931 — Lançamento efetuado em decorrência da responsabilidade de retenção do imposto por substituição tributária, atribuída ao remetente ou alienante da mercadoria, pelo serviço de transporte realizado por transportador autônomo ou por transportador não inscrito na unidade da Federação onde iniciado o serviço"
  },
  {
    "value": "6932",
    "label": "6932 — Prestação de serviço de transporte iniciada em unidade da Federação diversa daquela onde inscrito o prestador"
  },
  {
    "value": "6933",
    "label": "6933 — Prestação de serviço tributado pelo ISSQN"
  },
  {
    "value": "6949",
    "label": "6949 — Outra saída de mercadoria ou prestação de serviço não especificado"
  },
  {
    "value": "7000",
    "label": "7000 — SAÍDAS OU PRESTAÇÕES DE SERVIÇOS PARA O EXTERIOR "
  },
  {
    "value": "7100",
    "label": "7100 — VENDAS DE PRODUÇÃO PRÓPRIA OU DE TERCEIROS"
  },
  {
    "value": "7101",
    "label": "7101 — Venda de produção do estabelecimento"
  },
  {
    "value": "7102",
    "label": "7102 — Venda de mercadoria adquirida ou recebida de terceiros"
  },
  {
    "value": "7105",
    "label": "7105 — Venda de produção do estabelecimento, que não deva por ele transitar"
  },
  {
    "value": "7106",
    "label": "7106 — Venda de mercadoria adquirida ou recebida de terceiros, que não deva por ele transitar"
  },
  {
    "value": "7127",
    "label": "7127 — Venda de produção do estabelecimento sob o regime de \"drawback\" "
  },
  {
    "value": "7200",
    "label": "7200 — DEVOLUÇÕES DE COMPRAS PARA INDUSTRIALIZAÇÃO, COMERCIALIZAÇÃO OU ANULAÇÕES DE VALORES"
  },
  {
    "value": "7201",
    "label": "7201 — Devolução de compra para industrialização ou produção rural"
  },
  {
    "value": "7202",
    "label": "7202 — Devolução de compra para comercialização"
  },
  {
    "value": "7205",
    "label": "7205 — Anulação de valor relativo à aquisição de serviço de comunicação"
  },
  {
    "value": "7206",
    "label": "7206 — Anulação de valor relativo a aquisição de serviço de transporte"
  },
  {
    "value": "7207",
    "label": "7207 — Anulação de valor relativo à compra de energia elétrica"
  },
  {
    "value": "7210",
    "label": "7210 — Devolução de compra para utilização na prestação de serviço"
  },
  {
    "value": "7211",
    "label": "7211 — Devolução de compras para industrialização sob o regime de drawback\" "
  },
  {
    "value": "7250",
    "label": "7250 — VENDAS DE ENERGIA ELÉTRICA"
  },
  {
    "value": "7251",
    "label": "7251 — Venda de energia elétrica para o exterior "
  },
  {
    "value": "7300",
    "label": "7300 — PRESTAÇÕES DE SERVIÇOS DE COMUNICAÇÃO"
  },
  {
    "value": "7301",
    "label": "7301 — Prestação de serviço de comunicação para execução de serviço da mesma natureza "
  },
  {
    "value": "7350",
    "label": "7350 — PRESTAÇÕES DE SERVIÇO DE TRANSPORTE"
  },
  {
    "value": "7358",
    "label": "7358 — Prestação de serviço de transporte "
  },
  {
    "value": "7500",
    "label": "7500 — EXPORTAÇÃO DE MERCADORIAS RECEBIDAS COM FIM ESPECÍFICO DE EXPORTAÇÃO"
  },
  {
    "value": "7501",
    "label": "7501 — Exportação de mercadorias recebidas com fim específico de exportação"
  },
  {
    "value": "7550",
    "label": "7550 — OPERAÇÕES COM BENS DE ATIVO IMOBILIZADO E MATERIAIS PARA USO OU CONSUMO"
  },
  {
    "value": "7551",
    "label": "7551 — Venda de bem do ativo imobilizado"
  },
  {
    "value": "7553",
    "label": "7553 — Devolução de compra de bem para o ativo imobilizado"
  },
  {
    "value": "7556",
    "label": "7556 — Devolução de compra de material de uso ou consumo"
  },
  {
    "value": "7651",
    "label": "7651 — Venda de combustível ou lubrificante de produção do estabelecimento"
  },
  {
    "value": "7654",
    "label": "7654 — Venda de combustível ou lubrificante adquirido ou recebido de terceiros"
  },
  {
    "value": "7900",
    "label": "7900 — OUTRAS SAÍDAS DE MERCADORIAS OU PRESTAÇÕES DE SERVIÇOS"
  },
  {
    "value": "7930",
    "label": "7930 — Lançamento efetuado atítulo de devolução de bem cuja entrada tenha ocorrido sob amparo de regime especial aduaneiro de admissão temporária"
  },
  {
    "value": "7949",
    "label": "7949 — Outra saída de mercadoria ou prestação de serviço não especificado"
  }
];
