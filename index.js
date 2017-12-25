const { addNamed } = require('@babel/helper-module-imports')

module.exports = function ({ types: t, template }) {
  const visited = Symbol('visited')
  const importCssId = Symbol('importCssId')
  const loadTemplate = template('Promise.all([IMPORT, IMPORT_CSS(MODULE)]).then(proms => proms[0])')
  const getImportArgPath = p => p.parentPath.get('arguments')[0]
  const trimChunkName = baseDir => baseDir.replace(/^[./]+|(\.js$)/g, '')

  function getImportCss(p) {
    if (!p.hub.file[importCssId]) {
      const importCss = addNamed(
        p.hub.file.path,
        'default',
        'babel-plugin-dual-import-with-mode/importCss.js',
        { nameHint: 'importCss' }
      )

      p.hub.file[importCssId] = importCss
    }

    return p.hub.file[importCssId]
  }

  function createTrimmedChunkName(importArgNode) {
    if (importArgNode.quasis) {
      const quasis = importArgNode.quasis.slice(0)
      const baseDir = trimChunkName(quasis[0].value.cooked)
      quasis[0] = Object.assign({}, quasis[0], {
        value: { raw: baseDir, cooked: baseDir }
      })

      return Object.assign({}, importArgNode, {
        quasis
      })
    }

    const moduleName = trimChunkName(importArgNode.value)
    return t.stringLiteral(moduleName)
  }

  function getMagicCommentChunkName(importArgNode) {
    const { quasis, expressions } = importArgNode
    if (!quasis) return trimChunkName(importArgNode.value)

    const baseDir = quasis[0].value.cooked
    const hasExpressions = expressions.length > 0
    const chunkName = baseDir + (hasExpressions ? '[request]' : '')
    return trimChunkName(chunkName)
  }

  function promiseAll(p, { mode }) {
    const argPath = getImportArgPath(p)
    const importArgNode = argPath.node
    const chunkName = getMagicCommentChunkName(importArgNode)

    delete argPath.node.leadingComments
    argPath.addComment('leading', ` webpackChunkName: '${chunkName}' `)
    argPath.addComment('leading', ` webpackMode: '${mode}' `)

    return loadTemplate({
      IMPORT: argPath.parent,
      IMPORT_CSS: getImportCss(p),
      MODULE: createTrimmedChunkName(importArgNode)
    }).expression
  }

  return {
    name: 'dual-import-with-mode',
    visitor: {
      Import(p, { opts }) {
        if (p[visited]) return
        p[visited] = true
        p.parentPath.replaceWith(promiseAll(p, opts))
      }
    }
  }
}
