import React from "react";

const ColorModeContext = React.createContext({
    toggleColorMode: () => { },
    setPrimaryColorLight: (_) => { },
    setPrimaryColorDark: (_) => { },
    setAppLogoLight: (_) => { },
    setAppLogoDark: (_) => { },
    setAppLogoFavicon: (_) => { },
    setAppLogoAppleTouchIcon: (_) => { },
    setAppLogoPwaAndroid192: (_) => { },
    setAppLogoPwaAndroid512: (_) => { },
    setAppLogoPwaMsTile150: (_) => { },
});

export default ColorModeContext;
