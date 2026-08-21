import eslint from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const frontendFiles = ["artifacts/ens-landing/src/**/*.{ts,tsx}"];
/**
 * shadcn/ui primitives are vendored, not authored here. They are generated from
 * an upstream template and re-generated when it moves, so accessibility findings
 * in them belong upstream rather than as local patches that the next generate
 * would silently drop.
 */
const vendoredUiFiles = ["artifacts/ens-landing/src/components/ui/**/*.{ts,tsx}"];
const backendFiles = ["artifacts/api-server/src/**/*.ts"];
const scriptFiles = ["scripts/**/*.mjs"];

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/playwright-report/**",
      "**/test-results/**",
      ".release-evidence/**",
      "artifacts/ens-landing/public/**",
      "artifacts/ens-landing/attached_assets/**",
      "attached_assets/**",
    ],
  },
  {
    ...eslint.configs.recommended,
    files: scriptFiles,
    languageOptions: {
      ...eslint.configs.recommended.languageOptions,
      globals: globals.node,
    },
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: [...frontendFiles, ...backendFiles],
  })),
  {
    files: backendFiles,
    languageOptions: { globals: globals.node },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "no-console": "off",
    },
  },
  // ── Accessibility ────────────────────────────────────────────────────────
  // The app has had real a11y defects that review missed: dialogs claiming
  // aria-modal with no focus trap, public pages with no main landmark, and
  // click handlers on elements a keyboard can never reach. These rules make
  // that class of regression fail the build instead of the next audit.
  {
    files: frontendFiles,
    ignores: vendoredUiFiles,
    plugins: { "jsx-a11y": jsxA11y },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,

      // `role` is also a domain prop here - <StaffQuotes role="chief" /> means
      // chief-or-pm, not an ARIA role. Limit the check to real DOM elements.
      "jsx-a11y/aria-role": ["error", { ignoreNonDOM: true }],

      // AX-01, closed: the workspace inspector's captions are associated with
      // their controls now, and the ones that captioned a group of buttons
      // rather than a single control became role="group" + aria-labelledby.
      //
      // depth 3 because the rule searches only two levels deep by default and
      // several labels nest their text one level further -
      // <label><span><span>{t(...)}</span></span></label>. Those were reported
      // as "must have accessible text" while being perfectly well labelled at
      // runtime; the fix was to configure the rule, not to change the markup.
      "jsx-a11y/label-has-associated-control": ["error", { depth: 3 }],

      // Deliberately off. The rule targets autofocus on page load, which is
      // disorienting. Every use here is the first field of a dialog that the
      // user just opened, or of the login form on a dedicated /login route -
      // in both cases moving focus to the field is the expected behaviour and
      // the alternative is a keyboard user tabbing in from the page start.
      "jsx-a11y/no-autofocus": "off",
    },
  },
  {
    // AX-02. Five elements carry a click handler without a keyboard listener on
    // the same element. Each was checked individually and four of them already
    // have a keyboard path the rule cannot see:
    //
    //   PMWorkspace / WorkspaceBomPanel - the row also has onFocusCapture, so
    //   focusing any child selects it. The click is the mouse equivalent.
    //   Adding onKeyDown here would hijack Enter and Space inside the row's
    //   own text input.
    //
    //   WorkspaceCatalogPanel - the card duplicates a dedicated +/- button
    //   pair that is always visible and always focusable. Click-the-card is a
    //   shortcut, not the only way in. The wrapper cannot take role="button"
    //   because those buttons are inside it.
    //
    //   PMClients - the div's only handler is stopPropagation, guarding the row
    //   click from its action buttons. It has no behaviour to key-activate.
    //
    // ClientWorkspace is the one genuine gap: pins are placed at pointer
    // coordinates on the 3D canvas, and there is no keyboard equivalent. That
    // needs a product decision about how a keyboard user places a pin, so it
    // stays listed here rather than being papered over.
    files: [
      "artifacts/ens-landing/src/pages/pm/PMWorkspace.tsx",
      "artifacts/ens-landing/src/pages/pm/WorkspaceBomPanel.tsx",
      "artifacts/ens-landing/src/pages/pm/WorkspaceCatalogPanel.tsx",
      "artifacts/ens-landing/src/pages/pm/PMClients.tsx",
      "artifacts/ens-landing/src/pages/client/ClientWorkspace.tsx",
    ],
    rules: {
      "jsx-a11y/click-events-have-key-events": "off",
      "jsx-a11y/no-static-element-interactions": "off",
    },
  },
  {
    files: frontendFiles,
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "no-console": "off",
    },
  },
);
