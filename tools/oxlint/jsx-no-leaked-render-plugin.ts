import type { Context, ESTree, Scope } from "@oxlint/plugins"
import { definePlugin, defineRule } from "@oxlint/plugins"

const comparisonOperators = new Set([
  "==",
  "!=",
  "===",
  "!==",
  "<",
  "<=",
  ">",
  ">=",
  "in",
  "instanceof",
])

function unwrap(expression: ESTree.Expression): ESTree.Expression {
  switch (expression.type) {
    case "ParenthesizedExpression":
    case "TSAsExpression":
    case "TSSatisfiesExpression":
    case "TSTypeAssertion":
    case "TSNonNullExpression":
    case "TSInstantiationExpression":
      return unwrap(expression.expression)
    default:
      return expression
  }
}

function isGlobalBoolean(context: Context, expression: ESTree.Expression): boolean {
  if (expression.type !== "Identifier" || expression.name !== "Boolean") return false
  let scope: Scope | null = context.sourceCode.getScope(expression)
  while (scope !== null) {
    let variable = scope.set.get("Boolean")
    if (variable !== undefined) return variable.defs.length === 0
    scope = scope.upper
  }
  return true
}

function hasSafeFalsyValue(context: Context, expression: ESTree.Expression): boolean {
  let node = unwrap(expression)
  switch (node.type) {
    case "Literal":
      return node.value !== 0 && node.value !== 0n
    case "UnaryExpression":
      return (
        node.operator === "!" ||
        node.operator === "void" ||
        node.operator === "typeof" ||
        node.operator === "delete"
      )
    case "BinaryExpression":
      return comparisonOperators.has(node.operator)
    case "CallExpression":
      return !node.optional && isGlobalBoolean(context, node.callee)
    case "LogicalExpression":
      if (node.operator === "||") return hasSafeFalsyValue(context, node.right)
      return hasSafeFalsyValue(context, node.left) && hasSafeFalsyValue(context, node.right)
    case "ConditionalExpression":
      return (
        hasSafeFalsyValue(context, node.consequent) && hasSafeFalsyValue(context, node.alternate)
      )
    case "JSXElement":
    case "JSXFragment":
    case "ArrayExpression":
    case "ObjectExpression":
    case "ArrowFunctionExpression":
    case "FunctionExpression":
    case "NewExpression":
      return true
    default:
      return false
  }
}

export const jsxNoLeakedRenderRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Require explicit conditions when && can leak a value into JSX children.",
    },
    schema: [],
    hasSuggestions: true,
    messages: {
      leakedRender:
        "This condition can leak a value such as 0 into JSX. Use Boolean coercion or a ternary with null.",
      coerce: "Coerce the condition to a Boolean.",
    },
  },
  create(context) {
    function checkCondition(expression: ESTree.Expression): void {
      let node = unwrap(expression)
      if (node.type === "LogicalExpression" && node.operator === "&&") {
        checkCondition(node.left)
        checkCondition(node.right)
        return
      }
      if (hasSafeFalsyValue(context, node)) return
      context.report({
        node: expression,
        messageId: "leakedRender",
        suggest: [
          {
            messageId: "coerce",
            fix(fixer) {
              return fixer.replaceText(expression, `!!(${context.sourceCode.getText(expression)})`)
            },
          },
        ],
      })
    }

    function checkRendered(expression: ESTree.Expression): void {
      let node = unwrap(expression)
      switch (node.type) {
        case "LogicalExpression":
          if (node.operator === "&&") checkCondition(node.left)
          else if (node.operator === "??") checkRendered(node.left)
          checkRendered(node.right)
          break
        case "ConditionalExpression":
          checkRendered(node.consequent)
          checkRendered(node.alternate)
          break
        case "AssignmentExpression":
          if (
            node.operator === "=" ||
            node.operator === "||=" ||
            node.operator === "&&=" ||
            node.operator === "??="
          )
            checkRendered(node.right)
          break
        case "AwaitExpression":
          checkRendered(node.argument)
          break
        case "ArrayExpression":
          for (let element of node.elements) {
            if (element !== null && element.type !== "SpreadElement") checkRendered(element)
          }
          break
        case "SequenceExpression": {
          let last = node.expressions.at(-1)
          if (last !== undefined) checkRendered(last)
          break
        }
      }
    }

    return {
      JSXExpressionContainer(node) {
        if (node.expression.type === "JSXEmptyExpression") return
        if (
          node.parent.type === "JSXAttribute" &&
          (node.parent.name.type !== "JSXIdentifier" || node.parent.name.name !== "children")
        )
          return
        checkRendered(node.expression)
      },
    }
  },
})

export default definePlugin({
  meta: { name: "remix-jsx" },
  rules: { "jsx-no-leaked-render": jsxNoLeakedRenderRule },
})
