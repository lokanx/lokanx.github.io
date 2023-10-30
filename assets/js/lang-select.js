(() => {
   // Only for root of application
   if (window.location.pathname !== "/") {
      return;
   }

   // Current language
   const activeLang = document.currentScript.getAttribute("data-active-lang");
   console.log(`Active lang: ${activeLang}`);
   if (!activeLang) {
      return;
   }

   // Supported languages
   const suportedLanguages = JSON.parse(
      document.currentScript.getAttribute("data-supported-languages") || "[]"
   );
   console.log(`Suported lang: ${JSON.stringify(suportedLanguages)}`);
   if (!suportedLanguages) {
      return;
   }

   // Default language
   const defaultLanguage =
      document.currentScript.getAttribute("data-default-lang");
   console.log(`Default lang: ${defaultLanguage}`);
   if (!defaultLanguage) {
      return;
   }

   // Browser language
   const browserLanguage = navigator.browserLanguagec || navigator.language;
   console.log(`Browser lang: ${browserLanguage}`);
   if (!browserLanguage) {
      return;
   }

   // Stored language
   let storedLang = localStorage
      ? localStorage.getItem("site_active_lang")
      : undefined;
   console.log(`Stored lang: ${storedLang}`);

   if (storedLang && !suportedLanguages.includes(storedLang)) {
      console.log(
         `Removing stored language ${storedLang} since it is not supported`
      );
      localStorage.removeItem("site_active_lang");
   }

   if (storedLang) {
      if (storedLang === activeLang) {
         console.log(`Active language ${activeLang} is correct`);
         return;
      }

      if (storedLang === defaultLanguage) {
         if (window.location.pathname !== "/") {
            window.location.pathname = "/";
         }
      } else {
         if (window.location.pathname !== `/${storedLang}/`) {
            window.location.pathname = `/${storedLang}/`;
         }
      }
      return;
   }

   if (suportedLanguages.includes(browserLanguage)) {
      console.log(`Active language language is now ${activeLang}`);
      localStorage.setItem("site_active_lang", browserLanguage);
      if (browserLanguage === defaultLanguage) {
         if (window.location.pathname !== "/") {
            window.location.pathname = "/";
         }
      } else {
         if (window.location.pathname !== `/${browserLanguage}/`) {
            window.location.pathname = `/${browserLanguage}/`;
         }
      }
      return;
   }

   localStorage.setItem("site_active_lang", defaultLanguage);
   if (window.location.pathname !== "/") {
      window.location.pathname = "/";
   }
})();
