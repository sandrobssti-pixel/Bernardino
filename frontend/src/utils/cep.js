// Busca endereço por CEP (ViaCEP, público/sem chave) — pedido do cliente:
// em qualquer cadastro com CEP, digitar o número já preenche rua/bairro/
// cidade/estado sozinho. Nunca trava o formulário se falhar (CEP
// inválido, API fora do ar) — quem usa o sistema sempre pode digitar o
// endereço na mão como já fazia antes.
export const fetchAddressByCep = async (cep) => {
  const digits = (cep || "").replace(/\D/g, "");
  if (digits.length !== 8) return null;

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const data = await response.json();
    if (!data || data.erro) return null;

    return {
      street: data.logradouro || "",
      neighborhood: data.bairro || "",
      city: data.localidade || "",
      state: data.uf || "",
    };
  } catch {
    return null;
  }
};
