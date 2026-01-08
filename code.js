// Gap to Token - Figma Plugin
// Scans gaps from frames/autolayouts and links them to design tokens

// Helper: Check if node is Frame or AutoLayout
function isFrameOrAutoLayout(node) {
  return ['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE'].includes(node.type);
}

// Helper: Get variable name from ID
function getVariableName(variableId) {
  try {
    if (!figma.variables) return null;
    const variable = figma.variables.getVariableById(variableId);
    return variable ? variable.name : null;
  } catch {
    return null;
  }
}

// Helper: Check if property is bound to variable
function getBoundVariableInfo(node, propertyName) {
  try {
    const boundVariable = node.getBoundVariable(propertyName);
    if (boundVariable?.type === 'VARIABLE_ALIAS') {
      return {
        isBound: true,
        variableId: boundVariable.id,
        variableName: getVariableName(boundVariable.id)
      };
    }
  } catch {
    // Property might not support variables
  }
  return { isBound: false, variableId: null, variableName: null };
}

// Helper: Get gap information from node
function getGapInfo(node) {
  if (!isFrameOrAutoLayout(node)) return null;

  const gapInfo = {
    nodeId: node.id,
    nodeName: node.name,
    nodeType: node.type,
    hasAutoLayout: false,
    itemSpacing: null,
    itemSpacingToken: null,
    counterAxisSpacing: null,
    counterAxisSpacingToken: null,
    paddingTop: null,
    paddingTopToken: null,
    paddingRight: null,
    paddingRightToken: null,
    paddingBottom: null,
    paddingBottomToken: null,
    paddingLeft: null,
    paddingLeftToken: null,
    layoutMode: null
  };

  // Check AutoLayout properties
  if (node.layoutMode !== 'NONE') {
    gapInfo.hasAutoLayout = true;
    gapInfo.layoutMode = node.layoutMode;
    gapInfo.itemSpacing = node.itemSpacing;
    gapInfo.counterAxisSpacing = node.counterAxisSpacing;

    const itemSpacingVar = getBoundVariableInfo(node, 'itemSpacing');
    if (itemSpacingVar.isBound) {
      gapInfo.itemSpacingToken = itemSpacingVar.variableName;
    }

    const counterAxisSpacingVar = getBoundVariableInfo(node, 'counterAxisSpacing');
    if (counterAxisSpacingVar.isBound) {
      gapInfo.counterAxisSpacingToken = counterAxisSpacingVar.variableName;
    }
  }

  // Get padding values and check for bound variables
  const paddingProps = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];
  paddingProps.forEach(prop => {
    gapInfo[prop] = node[prop];
    const varInfo = getBoundVariableInfo(node, prop);
    if (varInfo.isBound) {
      gapInfo[prop + 'Token'] = varInfo.variableName;
    }
  });

  return gapInfo;
}

// Get all available spacing tokens (FLOAT variables)
function getAvailableTokens() {
  try {
    if (!figma.variables) return [];
    return figma.variables.getLocalVariables()
      .filter(v => v.resolvedType === 'FLOAT')
      .map(v => ({ id: v.id, name: v.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

// Scan selected nodes
function scanSelection() {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    return {
      success: false,
      message: 'Selecciona un Frame o AutoLayout'
    };
  }

  if (selection.length > 1) {
    return {
      success: false,
      message: 'Selecciona solo un elemento'
    };
  }

  const node = selection[0];
  const gapInfo = getGapInfo(node);

  if (!gapInfo) {
    return {
      success: false,
      message: 'El elemento seleccionado no es un Frame o AutoLayout'
    };
  }

  return {
    success: true,
    gapInfo: gapInfo,
    availableTokens: getAvailableTokens()
  };
}

// Link gap to design token
async function linkGapToToken(nodeId, tokenName, gapType, tokenId) {
  try {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node || !isFrameOrAutoLayout(node)) {
      return {
        success: false,
        message: 'No se pudo encontrar el nodo'
      };
    }

    if (!figma.variables) {
      return {
        success: false,
        message: 'La API de Variables no está disponible'
      };
    }

    let variable = null;

    // Use existing token if ID provided
    if (tokenId) {
      variable = figma.variables.getVariableById(tokenId);
      if (!variable) {
        return {
          success: false,
          message: 'No se pudo encontrar el token seleccionado'
        };
      }
    } else {
      // Find or create variable
      const variables = figma.variables.getLocalVariables();
      variable = variables.find(v => v.name === tokenName);

      if (!variable) {
        // Get gap value
        const gapValueMap = {
          itemSpacing: node.itemSpacing,
          counterAxisSpacing: node.counterAxisSpacing,
          paddingTop: node.paddingTop,
          paddingRight: node.paddingRight,
          paddingBottom: node.paddingBottom,
          paddingLeft: node.paddingLeft
        };

        const gapValue = gapValueMap[gapType] || 0;

        // Create new variable
        variable = figma.variables.createVariable(tokenName, 'FLOAT');
        variable.setValueForMode(variable.modes[0].modeId, gapValue);
      }
    }

    // Apply variable to gap
    const variableAlias = {
      type: 'VARIABLE_ALIAS',
      id: variable.id
    };

    const gapTypeMap = {
      itemSpacing: () => node.layoutMode !== 'NONE' && node.setBoundVariable('itemSpacing', variableAlias),
      counterAxisSpacing: () => node.layoutMode !== 'NONE' && node.setBoundVariable('counterAxisSpacing', variableAlias),
      paddingTop: () => node.setBoundVariable('paddingTop', variableAlias),
      paddingRight: () => node.setBoundVariable('paddingRight', variableAlias),
      paddingBottom: () => node.setBoundVariable('paddingBottom', variableAlias),
      paddingLeft: () => node.setBoundVariable('paddingLeft', variableAlias)
    };

    if (gapTypeMap[gapType]) {
      gapTypeMap[gapType]();
    }

    return {
      success: true,
      message: `Vinculado al token "${variable.name}"`
    };
  } catch (error) {
    return {
      success: false,
      message: `Error: ${error.message}`
    };
  }
}

// Main plugin code
if (figma.editorType === 'figma') {
  figma.showUI(__html__, { width: 420, height: 640 });

  // Initial scan
  const initialScan = scanSelection();
  figma.ui.postMessage({ type: 'scan-result', data: initialScan });

  // Listen for selection changes
  figma.on('selectionchange', () => {
    const scanResult = scanSelection();
    figma.ui.postMessage({ type: 'scan-result', data: scanResult });
  });

  // Handle UI messages
  figma.ui.onmessage = (msg) => {
    if (msg.type === 'scan') {
      const scanResult = scanSelection();
      figma.ui.postMessage({ type: 'scan-result', data: scanResult });
    } else if (msg.type === 'link-token') {
      linkGapToToken(msg.nodeId, msg.tokenName, msg.gapType, msg.tokenId)
        .then(result => {
          figma.ui.postMessage({ type: 'link-result', data: result });
          setTimeout(() => {
            const scanResult = scanSelection();
            figma.ui.postMessage({ type: 'scan-result', data: scanResult });
          }, 100);
        })
        .catch(error => {
          figma.ui.postMessage({
            type: 'link-result',
            data: {
              success: false,
              message: `Error: ${error.message}`
            }
          });
        });
    } else if (msg.type === 'cancel') {
      figma.closePlugin();
    }
  };
} else {
  figma.notify('Este plugin solo funciona en Figma');
  figma.closePlugin();
}
