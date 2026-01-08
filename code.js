// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// Helper function to check if a node is a Frame or AutoLayout
function isFrameOrAutoLayout(node) {
  return node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'COMPONENT_SET' || node.type === 'INSTANCE';
}

// Helper function to get variable name from variable ID
function getVariableName(variableId) {
  try {
    if (!figma.variables) {
      return null;
    }
    const variable = figma.variables.getVariableById(variableId);
    return variable ? variable.name : null;
  } catch (error) {
    return null;
  }
}

// Helper function to check if a property is bound to a variable
function getBoundVariableInfo(node, propertyName) {
  try {
    const boundVariable = node.getBoundVariable(propertyName);
    if (boundVariable && boundVariable.type === 'VARIABLE_ALIAS') {
      const variableName = getVariableName(boundVariable.id);
      return {
        isBound: true,
        variableId: boundVariable.id,
        variableName: variableName
      };
    }
    return { isBound: false, variableId: null, variableName: null };
  } catch (error) {
    return { isBound: false, variableId: null, variableName: null };
  }
}

// Helper function to get gap information from a node
function getGapInfo(node) {
  if (!isFrameOrAutoLayout(node)) {
    return null;
  }

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
    layoutMode: null,
    primaryAxisAlignItems: null,
    counterAxisAlignItems: null
  };

  // Check if it's an autolayout
  if (node.layoutMode !== 'NONE') {
    gapInfo.hasAutoLayout = true;
    gapInfo.layoutMode = node.layoutMode;
    gapInfo.itemSpacing = node.itemSpacing;
    gapInfo.counterAxisSpacing = node.counterAxisSpacing;
    gapInfo.primaryAxisAlignItems = node.primaryAxisAlignItems;
    gapInfo.counterAxisAlignItems = node.counterAxisAlignItems;

    // Check if itemSpacing is bound to a variable
    const itemSpacingVar = getBoundVariableInfo(node, 'itemSpacing');
    if (itemSpacingVar.isBound) {
      gapInfo.itemSpacingToken = itemSpacingVar.variableName;
    }

    // Check if counterAxisSpacing is bound to a variable
    const counterAxisSpacingVar = getBoundVariableInfo(node, 'counterAxisSpacing');
    if (counterAxisSpacingVar.isBound) {
      gapInfo.counterAxisSpacingToken = counterAxisSpacingVar.variableName;
    }
  }

  // Get padding values and check if they're bound to variables
  gapInfo.paddingTop = node.paddingTop;
  const paddingTopVar = getBoundVariableInfo(node, 'paddingTop');
  if (paddingTopVar.isBound) {
    gapInfo.paddingTopToken = paddingTopVar.variableName;
  }

  gapInfo.paddingRight = node.paddingRight;
  const paddingRightVar = getBoundVariableInfo(node, 'paddingRight');
  if (paddingRightVar.isBound) {
    gapInfo.paddingRightToken = paddingRightVar.variableName;
  }

  gapInfo.paddingBottom = node.paddingBottom;
  const paddingBottomVar = getBoundVariableInfo(node, 'paddingBottom');
  if (paddingBottomVar.isBound) {
    gapInfo.paddingBottomToken = paddingBottomVar.variableName;
  }

  gapInfo.paddingLeft = node.paddingLeft;
  const paddingLeftVar = getBoundVariableInfo(node, 'paddingLeft');
  if (paddingLeftVar.isBound) {
    gapInfo.paddingLeftToken = paddingLeftVar.variableName;
  }

  return gapInfo;
}

// Function to get all available tokens (variables)
function getAvailableTokens() {
  try {
    if (!figma.variables) {
      return [];
    }
    const variables = figma.variables.getLocalVariables();
    // Filter only FLOAT variables (for spacing/gaps)
    return variables
      .filter(v => v.resolvedType === 'FLOAT')
      .map(v => ({
        id: v.id,
        name: v.name
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    return [];
  }
}

// Function to scan selected nodes
function scanSelection() {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    return {
      success: false,
      message: 'Por favor, selecciona un Frame o AutoLayout'
    };
  }

  if (selection.length > 1) {
    return {
      success: false,
      message: 'Por favor, selecciona solo un Frame o AutoLayout'
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

  // Get available tokens
  const availableTokens = getAvailableTokens();

  return {
    success: true,
    gapInfo: gapInfo,
    availableTokens: availableTokens
  };
}

// Function to link gap to a design token (variable)
async function linkGapToToken(nodeId, tokenName, gapType, tokenId) {
  try {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node || !isFrameOrAutoLayout(node)) {
      return {
        success: false,
        message: 'No se pudo encontrar el nodo'
      };
    }

    // Check if variables API is available
    if (!figma.variables) {
      return {
        success: false,
        message: 'La API de Variables no está disponible. Asegúrate de usar Figma con soporte para Variables.'
      };
    }

    let variable = null;

    // If tokenId is provided, use existing token
    if (tokenId) {
      variable = figma.variables.getVariableById(tokenId);
      if (!variable) {
        return {
          success: false,
          message: 'No se pudo encontrar el token seleccionado'
        };
      }
    } else {
      // Get all variables in the document
      const variables = figma.variables.getLocalVariables();
      
      // Try to find existing variable with the token name
      variable = variables.find(v => v.name === tokenName);

      // If variable doesn't exist, create it
      if (!variable) {
        // Get the gap value to create the variable
        let gapValue = 0;
        if (gapType === 'itemSpacing' && node.itemSpacing) {
          gapValue = node.itemSpacing;
        } else if (gapType === 'counterAxisSpacing' && node.counterAxisSpacing) {
          gapValue = node.counterAxisSpacing;
        } else if (gapType === 'paddingTop' && node.paddingTop) {
          gapValue = node.paddingTop;
        } else if (gapType === 'paddingRight' && node.paddingRight) {
          gapValue = node.paddingRight;
        } else if (gapType === 'paddingBottom' && node.paddingBottom) {
          gapValue = node.paddingBottom;
        } else if (gapType === 'paddingLeft' && node.paddingLeft) {
          gapValue = node.paddingLeft;
        }

        // Create a new variable for spacing
        variable = figma.variables.createVariable(tokenName, 'FLOAT');
        variable.setValueForMode(variable.modes[0].modeId, gapValue);
      }
    }

    // Apply the variable to the gap
    const modeId = variable.modes[0].modeId;
    const variableAlias = {
      type: 'VARIABLE_ALIAS',
      id: variable.id
    };

    if (gapType === 'itemSpacing' && node.layoutMode !== 'NONE') {
      node.setBoundVariable('itemSpacing', variableAlias);
    } else if (gapType === 'counterAxisSpacing' && node.layoutMode !== 'NONE') {
      node.setBoundVariable('counterAxisSpacing', variableAlias);
    } else if (gapType === 'paddingTop') {
      node.setBoundVariable('paddingTop', variableAlias);
    } else if (gapType === 'paddingRight') {
      node.setBoundVariable('paddingRight', variableAlias);
    } else if (gapType === 'paddingBottom') {
      node.setBoundVariable('paddingBottom', variableAlias);
    } else if (gapType === 'paddingLeft') {
      node.setBoundVariable('paddingLeft', variableAlias);
    }

    return {
      success: true,
      message: 'Gap vinculado exitosamente al token "' + tokenName + '"'
    };
  } catch (error) {
    return {
      success: false,
      message: 'Error al vincular: ' + error.message
    };
  }
}

// Main plugin code - only runs in Figma
if (figma.editorType === 'figma') {
  figma.showUI(__html__, { width: 400, height: 600 });

  // Send initial scan when plugin opens
  const initialScan = scanSelection();
  figma.ui.postMessage({ type: 'scan-result', data: initialScan });

  // Listen for selection changes
  figma.on('selectionchange', () => {
    const scanResult = scanSelection();
    figma.ui.postMessage({ type: 'scan-result', data: scanResult });
  });

  // Handle messages from UI
  figma.ui.onmessage = (msg) => {
    if (msg.type === 'scan') {
      const scanResult = scanSelection();
      figma.ui.postMessage({ type: 'scan-result', data: scanResult });
    } else if (msg.type === 'link-token') {
      linkGapToToken(msg.nodeId, msg.tokenName, msg.gapType, msg.tokenId).then(result => {
        figma.ui.postMessage({ type: 'link-result', data: result });
        
        // Re-scan after linking to update UI
        setTimeout(() => {
          const scanResult = scanSelection();
          figma.ui.postMessage({ type: 'scan-result', data: scanResult });
        }, 100);
      }).catch(error => {
        figma.ui.postMessage({ 
          type: 'link-result', 
          data: { 
            success: false, 
            message: 'Error al vincular: ' + error.message 
          } 
        });
      });
    } else if (msg.type === 'cancel') {
      figma.closePlugin();
    }
  };
} else {
  // Show message for other editor types
  figma.notify('Este plugin solo funciona en Figma');
  figma.closePlugin();
}
