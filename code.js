// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// Helper function to check if a node is a Frame or AutoLayout
function isFrameOrAutoLayout(node) {
  return node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'COMPONENT_SET' || node.type === 'INSTANCE';
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
    counterAxisSpacing: null,
    paddingTop: null,
    paddingRight: null,
    paddingBottom: null,
    paddingLeft: null,
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
  }

  // Get padding values
  gapInfo.paddingTop = node.paddingTop;
  gapInfo.paddingRight = node.paddingRight;
  gapInfo.paddingBottom = node.paddingBottom;
  gapInfo.paddingLeft = node.paddingLeft;

  return gapInfo;
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

  return {
    success: true,
    gapInfo: gapInfo
  };
}

// Function to link gap to a design token (variable)
function linkGapToToken(nodeId, tokenName, gapType) {
  try {
    const node = figma.getNodeById(nodeId);
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

    // Get all variables in the document
    const variables = figma.variables.getLocalVariables();
    
    // Try to find existing variable with the token name
    let variable = variables.find(v => v.name === tokenName);

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
      const result = linkGapToToken(msg.nodeId, msg.tokenName, msg.gapType);
      figma.ui.postMessage({ type: 'link-result', data: result });
      
      // Re-scan after linking to update UI
      setTimeout(() => {
        const scanResult = scanSelection();
        figma.ui.postMessage({ type: 'scan-result', data: scanResult });
      }, 100);
    } else if (msg.type === 'cancel') {
      figma.closePlugin();
    }
  };
} else {
  // Show message for other editor types
  figma.notify('Este plugin solo funciona en Figma');
  figma.closePlugin();
}
