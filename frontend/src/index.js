import { Buffer } from "buffer";
import React from "react";
import ReactDOM from "react-dom";
import CssBaseline from "@material-ui/core/CssBaseline";
import * as serviceworker from './serviceWorker';
import App from "./App";
import AppRuntimeErrorBoundary from "./components/AppRuntimeErrorBoundary";
import { debugCaptureWindowErrors, debugLogFrontend } from "./utils/runtimeDebug";

window.Buffer = Buffer;

const isIosSafariBrowser = () => {
	try {
		const ua = window.navigator.userAgent || "";
		const isIOS =
			/iPad|iPhone|iPod/.test(ua) ||
			(window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
		const isSafari =
			/Safari/i.test(ua) &&
			!/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|GSA/i.test(ua);
		const isStandalone =
			window.matchMedia("(display-mode: standalone)").matches ||
			window.navigator.standalone === true;

		return isIOS && isSafari && !isStandalone;
	} catch (_) {
		return false;
	}
};

debugCaptureWindowErrors();
debugLogFrontend("app.bootstrap.start", {
	stage: "bootstrap",
	message: `path=${window.location.pathname}`,
});

ReactDOM.render(
	<AppRuntimeErrorBoundary>
		<CssBaseline>
			<App />
		</CssBaseline>
	</AppRuntimeErrorBoundary>,
	document.getElementById("root"),
	() => {
		debugLogFrontend("app.bootstrap.rendered", { stage: "bootstrap" });
	}
);

if (isIosSafariBrowser()) {
	debugLogFrontend("sw.unregister.ios-safari-browser", { stage: "service_worker" });
	serviceworker.unregister();
} else {
	debugLogFrontend("sw.register.default", { stage: "service_worker" });
	serviceworker.register();
}
