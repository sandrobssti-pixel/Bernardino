import React from "react";
import Avatar from "@material-ui/core/Avatar";
import Chip from "@material-ui/core/Chip";
import PersonIcon from "@material-ui/icons/Person";

// Cadastro de Associados (módulo add-on genérico — Plan.useMembers): quem é
// filiado/sócio/aluno da empresa. "category" é texto livre de propósito
// (não enum fixo) — cada empresa define suas próprias categorias
// ("atirador", "sócio", "aluno"...). Ver docs/MANUAL_TECNICO.md.
const STATUS_LABELS = {
  pending: "Pendente",
  active: "Ativo",
  inactive: "Inativo",
};

const STATUS_COLORS = {
  pending: "default",
  active: "primary",
  inactive: "secondary",
};

export const STATUS_OPTIONS = [
  { value: "pending", label: "Pendente" },
  { value: "active", label: "Ativo" },
  { value: "inactive", label: "Inativo" },
];

// Classificação legal CAC (Colecionador/Atirador/Caçador) — Decreto nº
// 11.615/2023, art. 2º, incisos XVII a XIX e XXV, e Decreto nº
// 12.345/2024, art. 2º, inciso XXXVI (Atirador Desportivo de Alto
// Rendimento). SEPARADA do campo "category" livre, que continua
// genérico pra qualquer tipo de clube — este campo só faz sentido pra
// clube de tiro, por isso fica opcional ("Não é CAC" como padrão).
export const CAC_CATEGORY_OPTIONS = [
  { value: "none", label: "Não é CAC" },
  { value: "atirador_desportivo", label: "Atirador Desportivo" },
  { value: "atirador_alto_rendimento", label: "Atirador Desportivo de Alto Rendimento" },
  { value: "cacador_excepcional", label: "Caçador Excepcional" },
  { value: "cacador_subsistencia", label: "Caçador de Subsistência" },
  { value: "colecionador", label: "Colecionador" },
];

// Texto informativo (Art. 38-C/38-D do Decreto nº 11.615/2023, na
// redação do Decreto nº 12.345/2024) — só exibição, SEM validação de
// quantidade de arma/munição ainda: o cadastro de Associados (Fase 1)
// não tem vínculo com arma/FinanceWeaponUnit nesta fase do projeto (ver
// docs/MANUAL_TECNICO.md, seção 241) — travar um número aqui sem ter o
// dado de verdade pra validar contra seria pior que não ter a regra.
export const CAC_CATEGORY_INFO = {
  atirador_alto_rendimento:
    "Art. 38-C/38-D do Decreto nº 11.615/2023 (redação dada pelo Decreto nº 12.345/2024): pode adquirir até 16 armas (até 8 de uso restrito) e até 20% a mais de munição/insumos no período de 12 meses, desde que necessárias à modalidade de competição em que estiver inscrito. Limite não validado automaticamente nesta fase (depende da integração com o cadastro de armas, ainda não construída).",
};

// CR (Certificado de Registro) do PRÓPRIO associado — órgão emissor.
// Referência real do clube-atirador.techsofttecnologia.com.br (tela
// "Editar Usuário"): "EB - Exército Brasileiro" e "PF - Polícia
// Federal" são os dois órgãos que emitem CR pra CAC no Brasil. Valor
// vazio "none" (não "" de verdade) pelo mesmo motivo de
// CAC_CATEGORY_OPTIONS acima — bug de exibição do <select> do MUI com
// "" selecionado, já documentado neste projeto (seção 236 do manual).
export const CR_ISSUING_AUTHORITY_OPTIONS = [
  { value: "none", label: "Não informado" },
  { value: "EB", label: "EB - Exército Brasileiro" },
  { value: "PF", label: "PF - Polícia Federal" },
  { value: "outro", label: "Outro" },
];

// Tipo do endereço principal — referência real do
// clube-atirador.techsofttecnologia.com.br (tela "Endereço"): "CACs
// podem ter mais de um endereço (rural, comercial, local de guarda de
// armas)". "residencial" default, nunca "" vazio (mesmo motivo acima).
export const ADDRESS_TYPE_OPTIONS = [
  { value: "residencial", label: "Residencial" },
  { value: "comercial", label: "Comercial" },
  { value: "rural", label: "Rural" },
  { value: "guarda_armas", label: "Local de guarda de armas" },
  { value: "outro", label: "Outro" },
];

// "Tipo de Uso" da arma pessoal do associado — confirmado via print real
// do clube-atirador.techsofttecnologia.com.br (seção "CRAFs e Guia de
// Trânsito" da tela Documentos): só arma "própria" (e ativa) gera campo
// de anexo de CRAF — as demais (importada do histórico, de terceiro/
// stand) não. Ver MemberWeaponsSection.js.
export const WEAPON_USAGE_TYPE_OPTIONS = [
  { value: "", label: "Não informado" },
  { value: "propria", label: "Própria" },
  { value: "importada_historico", label: "Importada (histórico)" },
  { value: "terceiro", label: "De terceiro" },
  { value: "stand", label: "Do clube/stand" },
];

export const StatusChip = ({ status }) => (
  <Chip
    size="small"
    label={STATUS_LABELS[status] || status}
    color={STATUS_COLORS[status] || "default"}
  />
);

export const memberColumns = [
  {
    field: "photoUrl",
    label: "",
    render: (r) => (
      <Avatar src={r.photoUrl || undefined} style={{ width: 32, height: 32 }}>
        {!r.photoUrl && <PersonIcon fontSize="small" />}
      </Avatar>
    ),
  },
  { field: "code", label: "Código" },
  { field: "name", label: "Nome" },
  { field: "document", label: "CPF" },
  { field: "category", label: "Categoria" },
  {
    field: "cacCategory",
    label: "Classe CAC",
    render: (r) =>
      r.cacCategory && r.cacCategory !== "none"
        ? CAC_CATEGORY_OPTIONS.find((o) => o.value === r.cacCategory)?.label || r.cacCategory
        : "—",
  },
  { field: "status", label: "Status", render: (r) => <StatusChip status={r.status} /> },
];

export const memberFields = [
  { name: "photoUrl", type: "photo", gridSize: 12 },
  { name: "code", label: "Código", gridSize: 4, disabledWhen: () => true },
  { name: "name", label: "Nome completo", gridSize: 8 },
  { name: "document", label: "CPF", gridSize: 4 },
  { name: "rg", label: "RG", gridSize: 4 },
  { name: "birthDate", label: "Data de nascimento", type: "date", gridSize: 4 },
  { name: "email", label: "E-mail", gridSize: 6 },
  { name: "phone", label: "Telefone", gridSize: 6 },
  { name: "whatsapp", label: "WhatsApp", gridSize: 6 },
  { name: "category", label: "Categoria (ex.: atirador, sócio, aluno)", gridSize: 6 },
  {
    name: "cacCategory",
    label: "Classe CAC (se for clube de tiro)",
    type: "select",
    options: CAC_CATEGORY_OPTIONS,
    defaultValue: "none",
    gridSize: 6,
  },
  {
    type: "sectionTitle",
    key: "cacInfo",
    label: "Atirador Desportivo de Alto Rendimento",
    helperText: CAC_CATEGORY_INFO.atirador_alto_rendimento,
    visibleWhen: (values) => values.cacCategory === "atirador_alto_rendimento",
  },
  {
    name: "status",
    label: "Status",
    type: "select",
    options: STATUS_OPTIONS,
    defaultValue: "pending",
    gridSize: 12,
  },
  {
    type: "sectionTitle",
    key: "crSection",
    label: "CR (Certificado de Registro) do associado",
  },
  { name: "crNumber", label: "Número do CR", gridSize: 4 },
  {
    name: "crIssuingAuthority",
    label: "Órgão emissor",
    type: "select",
    options: CR_ISSUING_AUTHORITY_OPTIONS,
    defaultValue: "none",
    gridSize: 4,
  },
  {
    name: "crValidUntil",
    label: "Validade do CR",
    type: "date",
    gridSize: 4,
  },
  {
    type: "sectionTitle",
    key: "addressSection",
    label: "Endereço principal",
    helperText: "Obrigatório, exceto o número do CR acima (associado pode ainda estar em trâmite).",
  },
  {
    name: "addressType",
    label: "Tipo",
    type: "select",
    options: ADDRESS_TYPE_OPTIONS,
    defaultValue: "residencial",
    gridSize: 4,
  },
  { name: "addressDescription", label: "Descrição (opcional)", gridSize: 8 },
  { name: "zipCode", label: "CEP", gridSize: 3, requiredWhen: () => true },
  { name: "street", label: "Rua", gridSize: 6, requiredWhen: () => true },
  { name: "number", label: "Número", gridSize: 3, requiredWhen: () => true },
  { name: "complement", label: "Complemento (opcional)", gridSize: 4 },
  { name: "neighborhood", label: "Bairro", gridSize: 4, requiredWhen: () => true },
  { name: "city", label: "Cidade", gridSize: 4, requiredWhen: () => true },
  { name: "state", label: "UF", gridSize: 4 },
  { name: "notes", label: "Observações", type: "textarea", gridSize: 12 },
];
