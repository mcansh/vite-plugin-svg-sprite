# JSX conditional rendering rule

`jsx-no-leaked-render-plugin.ts` implements `remix-jsx/jsx-no-leaked-render` with
`@oxlint/plugins`. The root `oxlint.config.ts` enables it for JavaScript and
TypeScript, including JSX. It does not depend on React or ESLint.

The rule reports `&&` conditions that can return a visible falsy value such as
`0`, `0n`, or `NaN` as JSX children. Use explicit Boolean coercion or a ternary.
The first example is reported. The remaining examples are accepted.

```tsx
<>{items.length && <List />}</>

<>{items.length > 0 && <List />}</>
<>{!!items.length && <List />}</>
<>{Boolean(items.length) && <List />}</>
<>{items.length ? <List /> : null}</>
```

Editor suggestions wrap each unsafe condition in `!!(...)`. Suggestions preserve
operator precedence and evaluate the condition once. There is no automatic fix
because suppressing a rendered zero needs the author's decision.

The rule checks nested logical expressions, ternary result branches, array
elements, assignments, awaited expressions, TypeScript expression wrappers, and
the `children` prop. Other props,
callback bodies, and function arguments do not count as rendered children.
An `||` fallback consumes an earlier falsy result, so
`(count && <Item />) || null` is accepted. A `??` fallback can still leak zero.

This is a syntax-based rule. Identifiers, member access, and arbitrary function
calls require explicit coercion even when TypeScript declares a Boolean type.
Only the unshadowed global `Boolean` function counts as Boolean coercion.
Empty strings are accepted for modern web JSX rendering.

This rule does not implement the ESLint rule's configuration options or enforce a
preferred conditional style. It does not trace values through variables,
function returns, or array spreads.

Run its parser-backed tests with the installed Oxlint test runner.

```sh
node --test tools/oxlint/jsx-no-leaked-render-plugin.test.ts
```
