// Catálogo do checklist de documentos do associado — referência real do
// clube-atirador.techsofttecnologia.com.br (tela "Documentos").
// "type" é a chave salva em MemberDocument.documentType (texto, não
// enum de banco — adicionar um tipo novo aqui não precisa de migration).
// "multiple: true" = sem slot fixo (tipo "Outros Documentos"/
// "Documentos Avulsos") — permite vários uploads, cada um com rótulo
// próprio, botão "+ Adicionar" em vez de "Anexar". Ver
// docs/MANUAL_TECNICO.md.
const DOCUMENT_GROUPS = [
  {
    key: "personal",
    label: null, // flat, sem accordion — mesmo visual da seção de topo da tela de referência
    items: [
      { type: "cpf", label: "CPF" },
      { type: "rg", label: "RG (frente e verso)" },
      { type: "cnh", label: "CNH" },
      { type: "proof_of_address", label: "Comprovante de Endereço" },
      { type: "criminal_record_certificate", label: "Certidão de Antecedentes Criminais" },
    ],
  },
  {
    key: "cr",
    label: "Certificado de Registro – CR",
    items: [
      { type: "cr_certificate", label: "Certificado de Registro – CR" },
      { type: "cr_concession_protocol", label: "Protocolo de Concessão/Renovação – CR" },
    ],
  },
  {
    key: "craf",
    label: "CRAFs e Guia de Trânsito",
    perWeapon: true, // ver MemberDocumentsSection.js — slot de CRAF é dinâmico, por arma própria/ativa
    items: [
      { type: "guia_transito", label: "Guia de Trânsito" },
    ],
  },
  {
    key: "disciplinary",
    label: "Histórico Disciplinar",
    items: [
      { type: "disciplinary_report", label: "Relatório de Indisciplina" },
    ],
  },
  {
    key: "cr_concession_docs",
    label: "Documentos para Concessão ou Revalidação de CR",
    items: [
      { type: "state_court_certificate", label: "Certidão da Justiça Estadual" },
      { type: "federal_court_certificate", label: "Certidão da Justiça Federal" },
      { type: "military_court_certificate", label: "Certidão da Justiça Militar" },
      { type: "electoral_court_certificate", label: "Certidão da Justiça Eleitoral" },
      { type: "civil_police_certificate", label: "Certidão da Polícia Civil" },
      { type: "distributor_registry_certificate", label: "Certidão do Cartório Distribuidor" },
      { type: "psychological_test", label: "Teste Psicológico" },
      { type: "shooting_test", label: "Teste de Tiro" },
      { type: "voter_title", label: "Título de Eleitor" },
      { type: "first_address_registry", label: "Primeiro Endereço Acervo" },
      { type: "second_address_registry", label: "Segundo Endereço Acervo" },
      {
        type: "other_documents",
        label: "Outros Documentos",
        multiple: true,
        addLabel: "Adicionar",
        emptyLabel: "Nenhum documento anexado",
      },
    ],
  },
  {
    key: "loose",
    label: "Documentos Avulsos",
    items: [
      {
        type: "loose_documents",
        label: "Documento avulso",
        multiple: true,
        addLabel: "Adicionar documento avulso",
        emptyLabel: "Nenhum documento avulso anexado",
      },
    ],
  },
];

export default DOCUMENT_GROUPS;
