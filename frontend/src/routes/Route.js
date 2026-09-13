import React, { useContext } from "react";
import { Route as RouterRoute, Redirect } from "react-router-dom";
import moment from "moment";

import { AuthContext } from "../context/Auth/AuthContext";
import BackdropLoading from "../components/BackdropLoading";
import { debugLogFrontend } from "../utils/runtimeDebug";

const Route = ({ component: Component, isPrivate = false, ...rest }) => {
	const { isAuth, loading, user } = useContext(AuthContext);
	const routePath = String(rest?.path || "");
	const isFinanceRoute = routePath.startsWith("/financeiro");
	const isSubscriptionExpired =
		user?.company?.id !== 1 &&
		Boolean(user?.company?.dueDate) &&
		moment(user.company.dueDate).isValid() &&
		moment().isSameOrAfter(moment(user.company.dueDate), "day");

	debugLogFrontend("route.render", {
		stage: "routing",
		message: `path=${rest.path || ""} isAuth=${isAuth} isPrivate=${isPrivate} loading=${loading}`,
	});

	// Evita "flash" da tela de login (com nome Whaticket/appName)
	// enquanto a sessão ainda está sendo revalidada.
	if (loading) {
		return <BackdropLoading />;
	}

	if (isAuth && isPrivate && isSubscriptionExpired && !isFinanceRoute) {
		return (
			<>
				<Redirect to={{ pathname: "/financeiro", state: { from: rest.location } }} />
			</>
		);
	}

	if (!isAuth && isPrivate) {
		return (
			<>
				<Redirect to={{ pathname: "/login", state: { from: rest.location } }} />
			</>
		);
	}

	if (isAuth && !isPrivate) {
		return (
			<>
				<Redirect to={{ pathname: isSubscriptionExpired ? "/financeiro" : "/", state: { from: rest.location } }} />;
			</>
		);
	}

	return (
		<>
			<RouterRoute {...rest} component={Component} />
		</>
	);
};

export default Route;
