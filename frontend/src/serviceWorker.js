function notifyUpdateAvailable() {
  Promise.all([
    import('react'),
    import('react-toastify'),
    import('@material-ui/icons/Cached'),
  ]).then(([{ default: React }, { toast }, { default: CachedIcon }]) => {
    const reload = () => window.location.reload();

    const UpdateToast = () => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <CachedIcon fontSize="small" />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>Nova versão disponível</div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>
            Atualize para ver as últimas novidades.
          </div>
        </div>
        <button
          onClick={reload}
          style={{
            background: '#fff',
            color: '#1565c0',
            border: 'none',
            borderRadius: 4,
            padding: '6px 12px',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Atualizar agora
        </button>
      </div>
    );

    toast.info(<UpdateToast />, {
      autoClose: false,
      closeOnClick: false,
      icon: false,
      style: { background: '#1565c0', color: '#fff' },
    });
  });
}

export function register() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

      navigator.serviceWorker.register(swUrl)
        .catch((error) => {
          console.error('Erro durante o registro do service worker:', error);
        });

      // A primeira mudança de controller ocorre no registro inicial do SW
      // (via clients.claim()) e não representa uma atualização real.
      let hadControllerAtLoad = !!navigator.serviceWorker.controller;
      let refreshing = false;

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadControllerAtLoad) {
          hadControllerAtLoad = true;
          return;
        }
        if (refreshing) return;
        refreshing = true;
        notifyUpdateAvailable();
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
