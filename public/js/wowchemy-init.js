(() => {
  // ns-hugo:G:\Other computers\My Computer\R\academic-website-git\themes\github.com\wowchemy\wowchemy-hugo-modules\wowchemy\assets\js\wowchemy-theming.js
  var body = document.body;
  function getThemeMode() {
    return parseInt(localStorage.getItem("wcTheme") || 2);
  }
  function canChangeTheme() {
    return Boolean(window.wc.darkLightEnabled);
  }
  function initThemeVariation() {
    if (!canChangeTheme()) {
      return {
        isDarkTheme: window.wc.isSiteThemeDark,
        themeMode: window.wc.isSiteThemeDark ? 1 : 0
      };
    }
    let currentThemeMode = getThemeMode();
    let isDarkTheme;
    switch (currentThemeMode) {
      case 0:
        isDarkTheme = false;
        break;
      case 1:
        isDarkTheme = true;
        break;
      default:
        if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
          isDarkTheme = true;
        } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
          isDarkTheme = false;
        } else {
          isDarkTheme = window.wc.isSiteThemeDark;
        }
        break;
    }
    if (isDarkTheme && !body.classList.contains("dark")) {
      console.debug("Applying Wowchemy dark theme");
      document.body.classList.add("dark");
    } else if (body.classList.contains("dark")) {
      console.debug("Applying Wowchemy light theme");
      document.body.classList.remove("dark");
    }
    return {
      isDarkTheme,
      themeMode: currentThemeMode
    };
  }

  // ns-params:@params
  var wcDarkLightEnabled = true;
  var wcIsSiteThemeDark = false;

  // js/wowchemy-init.js
  window.wc = {
    darkLightEnabled: wcDarkLightEnabled,
    isSiteThemeDark: wcIsSiteThemeDark
  };
  initThemeVariation();
})();
