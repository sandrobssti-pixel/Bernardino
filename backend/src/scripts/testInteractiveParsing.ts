import { getBodyMessage } from "../services/WbotServices/wbotMessageListener";

type TestCase = {
  name: string;
  msg: any;
};

const tests: TestCase[] = [
  {
    name: "buttonsResponseMessage com selectedDisplayText",
    msg: {
      key: { id: "A1", fromMe: false, remoteJid: "5511999999999@s.whatsapp.net" },
      message: {
        buttonsResponseMessage: {
          selectedDisplayText: "Falar com suporte",
          selectedButtonId: "btn_support"
        }
      }
    }
  },
  {
    name: "listResponseMessage com title e rowId",
    msg: {
      key: { id: "A2", fromMe: false, remoteJid: "5511999999999@s.whatsapp.net" },
      message: {
        listResponseMessage: {
          title: "Financeiro",
          description: "Segunda via",
          singleSelectReply: {
            selectedRowId: "row_finance_2nd_copy"
          }
        }
      }
    }
  },
  {
    name: "listMessage estruturada (conteúdo recebido)",
    msg: {
      key: { id: "A3", fromMe: false, remoteJid: "5511999999999@s.whatsapp.net" },
      message: {
        listMessage: {
          title: "Menu Principal",
          description: "Escolha uma opção",
          footerText: "Atendimento 24h",
          sections: [
            {
              title: "Setor",
              rows: [
                { title: "Vendas", description: "Comprar", rowId: "vendas_1" },
                { title: "Suporte", description: "Ajuda técnica", rowId: "suporte_1" }
              ]
            }
          ]
        }
      }
    }
  },
  {
    name: "interactiveResponseMessage com paramsJson",
    msg: {
      key: { id: "A4", fromMe: false, remoteJid: "5511999999999@s.whatsapp.net" },
      message: {
        interactiveResponseMessage: {
          nativeFlowResponseMessage: {
            paramsJson: JSON.stringify({ id: "opt_42", title: "Consultar pedido" })
          }
        }
      }
    }
  },
  {
    name: "templateButtonReplyMessage com selectedDisplayText",
    msg: {
      key: { id: "A5", fromMe: false, remoteJid: "5511999999999@s.whatsapp.net" },
      message: {
        templateButtonReplyMessage: {
          selectedId: "tmpl_support",
          selectedDisplayText: "Suporte premium"
        }
      }
    }
  },
  {
    name: "interactiveMessage encapsulada em viewOnceMessage",
    msg: {
      key: { id: "A6", fromMe: false, remoteJid: "5511999999999@s.whatsapp.net" },
      message: {
        viewOnceMessage: {
          message: {
            interactiveMessage: {
              header: { title: "Atendimento" },
              body: { text: "Escolha uma opção" },
              footer: { text: "Powered by Meta" },
              nativeFlowMessage: {
                buttons: [
                  {
                    name: "quick_reply",
                    buttonParamsJson: JSON.stringify({
                      display_text: "Financeiro"
                    })
                  },
                  {
                    name: "single_select",
                    buttonParamsJson: JSON.stringify({
                      title: "Setores",
                      sections: [
                        {
                          title: "Times",
                          rows: [
                            { title: "Vendas", description: "Comprar" },
                            { title: "Suporte", description: "Ajuda" }
                          ]
                        }
                      ]
                    })
                  }
                ]
              }
            }
          }
        }
      }
    }
  }
];

console.log("=== TESTE INTERNO: PARSER INTERACTIVE/LISTA/BOTAO ===");

for (const test of tests) {
  const output = getBodyMessage(test.msg as any);
  console.log(`\\n[${test.name}]`);
  console.log(output);
}

console.log("\\n=== FIM TESTE ===");
process.exit(0);
