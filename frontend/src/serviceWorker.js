// O aviso "Nova versão disponível" (toast com botão "Atualizar agora")
// foi removido a pedido do cliente (v2.3.170) — o `reload()` do botão
// derrubava o operador de volta pra tela inicial no meio de um
// atendimento, obrigando a procurar o ticket de novo. O service worker
// continua registrado e atualizando em segundo plano (skipWaiting +
// clients.claim() em public/service-worker.js) — a aba só passa a usar a
// versão nova na PRÓXIMA vez que recarregar sozinha (login, F5 manual),
// nunca forçado por aqui.
export function register() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

      navigator.serviceWorker.register(swUrl)
        .catch((error) => {
          console.error('Erro durante o registro do service worker:', error);
        });
    });
  }
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    if (typeof navigator.serviceWorker.getRegistrations === "function") {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          registrations.forEach((registration) => {
            registration.unregister();
          });
        })
        .catch((error) => {
          console.error('Erro durante o desregistro do service worker:', error);
        });
      return;
    }

    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error('Erro durante o desregistro do service worker:', error);
      });
  }
}
