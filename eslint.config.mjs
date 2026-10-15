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
const rendererFiles = ["artifacts/ens-landing/public/booth-render.js"];

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/playwright-report/**",
      "**/test-results/**",
      ".release-evidence/**",
      // Everything under public/ is a copied asset except the booth renderer,
      // which is 4,000 lines of hand-written JavaScript drawing the most
      // visible surface in the product. It was ignored here and excluded from
      // tsconfig's `src/**/*`, so nothing checked it at all - while every other
      // source file in the repo is parsed by something on every push.
      "artifacts/ens-landing/public/ens-workspace-assets/**",
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
  {
    ...eslint.configs.recommended,
    files: rendererFiles,
    languageOptions: {
      ...eslint.configs.recommended.languageOptions,
      // A classic script, not a module: it declares its state at the top level
      // and the page loads it with a plain <script src>.
      sourceType: "script",
      globals: {
        ...globals.browser,
        // Handed over by the module script in booth-render.html, which owns the
        // three.js side of the renderer.
        THREE: "readonly",
      },
    },
    rules: {
      ...eslint.configs.recommended.rules,
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "no-console": "off",
    },
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: [...frontendFiles, ...backendFiles],
  })),
  {
    files: backendFiles,
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      /**
       * Type-aware, so this block pays for a typed lint pass: 11s to 27s on
       * the backend. Worth it here, where an unhandled rejection takes the
       * process with it - a dropped `await` on a payment write is the case
       * this is guarding. The source was already clean when the rule went on,
       * which is the point: it locks in a standard the code already meets.
       */
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-explicit-any": "error",
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
      /**
       * On because there is nothing left to exempt: the renderer boundary now
       * states its real types, and the one remaining cast - a version record
       * whose `workspace` is optional - says so instead of hiding it.
       *
       * Deliberately without the type-aware pass the backend takes. A floating
       * promise in the browser does not take a process down, and the extra
       * ~30s on every lint buys less here.
       */
      "@typescript-eslint/no-explicit-any": "error",
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
