import { toast } from "react-toastify";
import { i18n } from "../translate/i18n";
import { isString } from 'lodash';

// Códigos que são só um AVISO de "já existe um cadastro com esse dado"
// (não falha de verdade do sistema) — mostrados em amarelo (toast.warn),
// não vermelho, pra não parecer um erro (pedido do cliente, v2.3.323:
// "tudo certo, as caixinhas já estavam cadastrado só foi o nome mesmo
// que parecia ser um erro").
const WARNING_BACKEND_ERRORS = new Set([
	"ERR_FINANCE_AMMO_VOLUME_DUPLICATE_BARCODE",
	"ERR_FINANCE_WEAPON_UNIT_DUPLICATE_SERIAL",
]);

const toastError = err => {
	const errorMsg = err.response?.data?.error;
	if (errorMsg) {
		const toastFn = WARNING_BACKEND_ERRORS.has(errorMsg) ? toast.warn : toast.error;
		if (i18n.exists(`backendErrors.${errorMsg}`)) {
			toastFn(i18n.t(`backendErrors.${errorMsg}`), {
				toastId: errorMsg,
				autoClose: 2000,
				hideProgressBar: false,
				closeOnClick: true,
				pauseOnHover: true,
				draggable: true,
				progress: undefined,
				theme: "light",
			});
			return
		} else {
			toast.error(errorMsg, {
				toastId: errorMsg,
				autoClose: 2000,
				hideProgressBar: false,
				closeOnClick: true,
				pauseOnHover: true,
				draggable: true,
				progress: undefined,
				theme: "light",
			});
			return
		}
	} if (isString(err)) {
		toast.error(err);
		return
	} else {
		toast.error("An error occurred!");
		return
	}
};

export default toastError;
