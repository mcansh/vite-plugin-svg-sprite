import { describe, it } from "node:test"

import { RuleTester } from "oxlint/plugins-dev"

import { jsxNoLeakedRenderRule } from "./jsx-no-leaked-render-plugin.ts"

RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "tsx" } } })

function invalid(code: string, conditions: string[]): RuleTester.InvalidTestCase {
  return {
    code,
    output: null,
    errors: conditions.map((condition) => ({
      messageId: "leakedRender",
      suggestions: [
        {
          messageId: "coerce",
          output:
            code.slice(0, code.lastIndexOf(condition)) +
            `!!(${condition})` +
            code.slice(code.lastIndexOf(condition) + condition.length),
        },
      ],
    })),
  }
}

tester.run("jsx-no-leaked-render", jsxNoLeakedRenderRule, {
  valid: [
    "<>{!!count && <Item />}</>",
    "<>{!hidden && <Item />}</>",
    "<>{Boolean(count) && <Item />}</>",
    "<>{count > 0 && <Item />}</>",
    "<>{count === 1 && <Item />}</>",
    "<>{'key' in object && <Item />}</>",
    "<>{value instanceof Item && <Item />}</>",
    "<>{typeof value && <Item />}</>",
    "<>{void value && <Item />}</>",
    "<>{true && <Item />}</>",
    "<>{false && <Item />}</>",
    "<>{null && <Item />}</>",
    "<>{'' && <Item />}</>",
    "<>{1 && <Item />}</>",
    "<>{'text' && <Item />}</>",
    "<>{count ? <Item /> : null}</>",
    "<>{(count && other) ? <Item /> : null}</>",
    "<>{!!(count && other) && <Item />}</>",
    "<>{count || <Item />}</>",
    "<>{(count && <Item />) || null}</>",
    "<>{(count && <Item />) || <Fallback />}</>",
    "<>{(count || false) && <Item />}</>",
    "<>{[!!count && <Item />]}</>",
    "<>{(count && other, <Item />)}</>",
    "<>{Boolean(count && other) && <Item />}</>",
    "<Box value={count && other} />",
    "<Box onClick={() => count && action()} />",
    "<Box render={() => count && <Item />} />",
    "<>{format(count && other)}</>",
    "<>{!!count && !!other && <Item />}</>",
    "<>{(!!count as boolean) && <Item />}</>",
    "<>{result ||= !!count && <Item />}</>",
    "<>{result &&= !!count && <Item />}</>",
    "<>{result ??= !!count && <Item />}</>",
    "<>{result += count && <Item />}</>",
  ],
  invalid: [
    invalid("<>{result = count && <Item />}</>", ["count"]),
    invalid("<>{result ||= count && <Item />}</>", ["count"]),
    invalid("<>{result &&= count && <Item />}</>", ["count"]),
    invalid("<>{result ??= count && <Item />}</>", ["count"]),
    invalid("async function render() { return <>{await (count && <Item />)}</> }", ["count"]),
    invalid("<>{count && <Item />}</>", ["count"]),
    invalid("<>{items.length && <Item />}</>", ["items.length"]),
    invalid("<>{0 && <Item />}</>", ["0"]),
    invalid("<>{0n && <Item />}</>", ["0n"]),
    invalid("<>{NaN && <Item />}</>", ["NaN"]),
    invalid("<>{getCount() && <Item />}</>", ["getCount()"]),
    invalid("<>{+count && <Item />}</>", ["+count"]),
    invalid("<>{-count && <Item />}</>", ["-count"]),
    invalid("<>{count + 1 && <Item />}</>", ["count + 1"]),
    invalid("<>{count & mask && <Item />}</>", ["count & mask"]),
    invalid("<>{count++ && <Item />}</>", ["count++"]),
    invalid("<>{count && other && <Item />}</>", ["count", "other"]),
    invalid("<>{!!ready && (count && <Item />)}</>", ["count"]),
    invalid("<>{count && (other && <Item />)}</>", ["count", "other"]),
    invalid("<>{(count || other) && <Item />}</>", ["count || other"]),
    invalid("<>{(count && <Item />) ?? null}</>", ["count"]),
    invalid("<>{fallback || (count && <Item />)}</>", ["count"]),
    invalid("<>{ready ? count && <Item /> : null}</>", ["count"]),
    invalid("<>{ready ? null : count && <Item />}</>", ["count"]),
    invalid("<>{[count && <Item />]}</>", ["count"]),
    invalid("<>{(other, count && <Item />)}</>", ["count"]),
    invalid("<>{(count as number) && <Item />}</>", ["count as number"]),
    invalid("<>{(count as boolean) && <Item />}</>", ["count as boolean"]),
    invalid("<>{(count satisfies number) && <Item />}</>", ["count satisfies number"]),
    invalid("<>{count! && <Item />}</>", ["count!"]),
    invalid("<>{(count && <Item />) as unknown}</>", ["count"]),
    invalid("<>{(ready ? count : other) && <Item />}</>", ["ready ? count : other"]),
    invalid("<Box children={count && <Item />} />", ["count"]),
    invalid("<Box content={<>{count && <Item />}</>} />", ["count"]),
    invalid("function render(Boolean: Function) { return <>{Boolean(count) && <Item />}</> }", [
      "Boolean(count)",
    ]),
    invalid("let ready = true; ready = count; <>{ready && <Item />}</>", ["ready"]),
    invalid("<>{(/* keep */ count + other) && <Item />}</>", ["count + other"]),
  ],
})
