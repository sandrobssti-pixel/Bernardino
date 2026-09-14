// Evento disparado depois de um login bem-sucedido, pra avisar o App.js que
// já pode (re)buscar o branding (nome/logo/cores) pela rota autenticada
// /settings — escopada pela empresa de quem acabou de logar.
//
// Por que precisa disso: App.js é montado uma única vez pra vida inteira da
// SPA (login é só uma troca de rota via react-router, não recarrega a
// página) — o efeito que busca o branding só roda uma vez, ainda antes do
// login acontecer. Sem esse evento, o menu lateral só refletiria a
// identidade certa da empresa depois de um F5 manual.
export const BRANDING_REFRESH_EVENT = "atendeflow:branding-refresh";

export const dispatchBrandingRefresh = () => {
  try {
    window.dispatchEvent(new Event(BRANDING_REFRESH_EVENT));
  } catch (e) {
    // ambiente sem `window.dispatchEvent` (SSR/teste) — sem problema, é só
    // uma otimização de atualização imediata; o F5 continua funcionando.
  }
};
