import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";

import toastError from "../../errors/toastError";
import useMembers from "../../hooks/useMembers";
import MemberEditForm from "./MemberEditForm";

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(2, 2.5),
    flex: "1 1 auto",
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
}));

// Aba "Gerenciador CAC" dentro do ContactModal — pedido explícito do
// cliente (v2.3.269): em vez de uma tela separada pra editar o Associado
// vinculado a este Contato, tudo acontece aqui, sem navegar pra outro
// lugar. O conteúdo de edição em si (Dados/Endereço/Financeiro/
// Documentos/Controle de Acesso) mora em MemberEditForm.js — reaproveitado
// também pela tela cheia "Gerenciador CAC" (pages/Members), que antes
// (v2.3.274) não tinha nenhuma dessas seções. Ver docs/MANUAL_TECNICO.md.
const ContactCacTab = ({ contactId }) => {
  const classes = useStyles();
  const members = useMembers();
  const isMounted = useRef(true);
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchMember = useCallback(async () => {
    setLoading(true);
    try {
      const data = await members.getByContact(contactId);
      if (isMounted.current) setMember(data);
    } catch (err) {
      if (isMounted.current) setMember(null);
    }
    if (isMounted.current) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  useEffect(() => {
    if (contactId) fetchMember();
  }, [contactId, fetchMember]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const data = await members.linkFromContact(contactId);
      setMember(data);
      toast.success("Perfil CAC criado para este contato.");
    } catch (err) {
      toastError(err);
    }
    setCreating(false);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" className={classes.root}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!member) {
    return (
      <Box className={classes.root} textAlign="center" py={4}>
        <Typography variant="body1" gutterBottom>
          Este contato ainda não tem um perfil no Gerenciador CAC.
        </Typography>
        <Button
          type="button"
          variant="contained"
          color="primary"
          disabled={creating}
          onClick={handleCreate}
        >
          {creating ? "Criando..." : "Criar perfil CAC pra este contato"}
        </Button>
      </Box>
    );
  }

  // "name"/"email"/"phone"/"whatsapp" são do próprio Contato aqui (editados
  // em "Dados principais", não nesta aba) — por isso não aparecem como
  // campo editável (showIdentityFields=false) e o save sempre reforça os
  // valores atuais do Contato (extraSaveValues), nunca o que viria do
  // formulário (que nem mostra esses campos).
  return (
    <MemberEditForm
      member={member}
      onMemberChange={setMember}
      showIdentityFields={false}
      extraSaveValues={{
        name: member.name,
        phone: member.phone,
        email: member.email,
        whatsapp: member.whatsapp,
      }}
    />
  );
};

export default ContactCacTab;
